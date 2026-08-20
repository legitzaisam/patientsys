/**
 * Create/update demo staff logins on the linked Supabase project.
 * Schema must already exist. Run from repo root:
 *   node scripts/provision-staff.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";

const STAFF = [
  {
    email: "sofia.marchetti@aetheria.clinic",
    password: "Reception1!",
    fullName: "Sofia Marchetti",
    jobTitle: "Receptionist",
    role: "front_desk",
  },
  {
    email: "nadia.rahman@aetheria.clinic",
    password: "Practitioner1!",
    fullName: "Dr Nadia Rahman",
    jobTitle: "Aesthetic Practitioner",
    role: "practitioner",
    registrationBody: "NMC",
    registrationNumber: "18C4471E",
    commissionRate: 45,
  },
  {
    email: "tom.whitfield@aetheria.clinic",
    password: "Practitioner2!",
    fullName: "Dr Tom Whitfield",
    jobTitle: "Aesthetic Doctor",
    role: "practitioner",
    registrationBody: "GMC",
    registrationNumber: "7719034",
    commissionRate: 42,
  },
];

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

if (!url || !serviceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error: clinicsError } = await admin.from("clinics").select("id").limit(1);
if (clinicsError) {
  console.error("schema_missing", clinicsError.message);
  process.exit(2);
}

const { data: list, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
if (listError) throw listError;

const results = [];

for (const staff of STAFF) {
  let user = (list.users ?? []).find((u) => (u.email ?? "").toLowerCase() === staff.email.toLowerCase());

  if (!user) {
    const created = await admin.auth.admin.createUser({
      email: staff.email,
      password: staff.password,
      email_confirm: true,
      user_metadata: { full_name: staff.fullName },
    });
    if (created.error || !created.data.user) {
      throw new Error(`${staff.email}: ${created.error?.message ?? "createUser failed"}`);
    }
    user = created.data.user;
    console.log("created_user", staff.email, user.id);
  } else {
    const updated = await admin.auth.admin.updateUserById(user.id, {
      password: staff.password,
      email_confirm: true,
      user_metadata: { ...user.user_metadata, full_name: staff.fullName },
    });
    if (updated.error || !updated.data.user) {
      throw new Error(`${staff.email}: ${updated.error?.message ?? "updateUser failed"}`);
    }
    user = updated.data.user;
    console.log("updated_user", staff.email, user.id);
  }

  const { error: profileError } = await admin.from("profiles").upsert({
    id: user.id,
    clinic_id: CLINIC_ID,
    full_name: staff.fullName,
    job_title: staff.jobTitle,
    registration_body: staff.registrationBody ?? null,
    registration_number: staff.registrationNumber ?? null,
    commission_rate: staff.commissionRate ?? 0,
  });
  if (profileError) throw profileError;

  await admin.from("user_roles").delete().eq("user_id", user.id).neq("role", "patient");
  const { error: roleError } = await admin.from("user_roles").upsert(
    { user_id: user.id, role: staff.role },
    { onConflict: "user_id,role" },
  );
  if (roleError) throw roleError;

  results.push({
    role: staff.role,
    name: staff.fullName,
    email: staff.email,
    password: staff.password,
  });
}

console.log("\nstaff_ready");
for (const r of results) {
  console.log(`${r.role}\t${r.name}\t${r.email}\t${r.password}`);
}
