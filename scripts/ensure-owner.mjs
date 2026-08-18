/**
 * Creates/updates a clinic owner account.
 * Usage (from repo root, after SUPABASE_SERVICE_ROLE_KEY is in .env):
 *   OWNER_EMAIL='you@example.com' OWNER_PASSWORD='…' OWNER_NAME='Your Name' node scripts/ensure-owner.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";

function loadDotEnv() {
  const env = {};
  for (const line of readFileSync(".env", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

const fileEnv = loadDotEnv();
const url = fileEnv.SUPABASE_URL;
const serviceKey = fileEnv.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.OWNER_EMAIL;
const password = process.env.OWNER_PASSWORD;
const fullName = process.env.OWNER_NAME || "Clinic Owner";

if (!url || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}
if (!email || !password) {
  console.error("Set OWNER_EMAIL and OWNER_PASSWORD in the environment");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

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
  if (created.error || !created.data.user) {
    throw new Error(created.error?.message ?? "Could not create user");
  }
  user = created.data.user;
  console.log("created_user", user.id);
} else {
  const updated = await admin.auth.admin.updateUserById(user.id, {
    password,
    email_confirm: true,
    user_metadata: { ...user.user_metadata, full_name: fullName },
  });
  if (updated.error || !updated.data.user) {
    throw new Error(updated.error?.message ?? "Could not update user");
  }
  user = updated.data.user;
  console.log("updated_user", user.id);
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

console.log("owner_ready", email);
