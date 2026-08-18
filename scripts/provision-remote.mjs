/**
 * Provision the linked Supabase project: storage buckets + owner account.
 * Schema must already exist (see supabase/migrations). Run from repo root:
 *   OWNER_EMAIL='…' OWNER_PASSWORD='…' OWNER_NAME='…' node scripts/provision-remote.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";
const BUCKETS = ["patient-photos", "message-attachments", "staff-files"];

function loadDotEnv() {
  const env = {};
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const fileEnv = loadDotEnv();
const url = fileEnv.SUPABASE_URL;
const serviceKey = fileEnv.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.OWNER_EMAIL;
const password = process.env.OWNER_PASSWORD;
const fullName = process.env.OWNER_NAME || "Zaisam Aldulimi";

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error: clinicsError } = await admin.from("clinics").select("id").limit(1);
const schemaOk = !clinicsError;
if (schemaOk) console.log("schema_ok");
else console.log("schema_missing", clinicsError.code ?? "", clinicsError.message);

for (const name of BUCKETS) {
  const { data: existing } = await admin.storage.getBucket(name);
  if (existing) {
    console.log("bucket_exists", name);
    continue;
  }
  const { error } = await admin.storage.createBucket(name, {
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
  });
  if (error && !/already exists/i.test(error.message)) throw error;
  console.log("bucket_created", name);
}

if (!email || !password) {
  console.error("Set OWNER_EMAIL and OWNER_PASSWORD");
  process.exit(1);
}

const { data: list, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
if (listError) throw listError;

let user = (list.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
if (!user) {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (created.error || !created.data.user) throw new Error(created.error?.message ?? "createUser failed");
  user = created.data.user;
  console.log("created_user", user.id);
} else {
  const updated = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: { ...user.user_metadata, full_name: fullName },
  });
  if (updated.error || !updated.data.user) throw new Error(updated.error?.message ?? "updateUser failed");
  user = updated.data.user;
  console.log("updated_user", user.id);
}

if (!schemaOk) {
  console.error("auth_user_ready_but_schema_missing");
  process.exit(2);
}

const { error: profileError } = await admin.from("profiles").upsert({
  id: user.id,
  clinic_id: CLINIC_ID,
  full_name: fullName,
  job_title: "Clinic Owner",
});
if (profileError) throw profileError;

await admin.from("user_roles").delete().eq("user_id", user.id).eq("role", "patient");
const { error: roleError } = await admin.from("user_roles").upsert(
  { user_id: user.id, role: "owner" },
  { onConflict: "user_id,role" },
);
if (roleError) throw roleError;

console.log("owner_ready");
