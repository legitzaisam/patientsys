/**
 * Shared database plumbing for the scripts in this folder.
 *
 * Supabase stopped resolving `db.<ref>.supabase.co` for projects without the
 * IPv4 add-on, so the direct host is only a fallback now. Set DATABASE_URL in
 * .env to the connection string from Project Settings > Database.
 */
import postgres from "postgres";
import { readFileSync } from "node:fs";

export function loadDotEnv(file = ".env") {
  const env = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const eq = trimmed.indexOf("=");
    env[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return env;
}

export function resolveDbUrl(env = loadDotEnv()) {
  if (env.DATABASE_URL || process.env.DATABASE_URL) {
    return env.DATABASE_URL || process.env.DATABASE_URL;
  }
  const ref = env.SUPABASE_PROJECT_ID;
  const password = env.DATABASE_PASSWORD || process.env.DATABASE_PASSWORD;
  if (!ref || !password) return null;
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

export function connect() {
  const url = resolveDbUrl();
  if (!url) {
    console.error(
      "Need DATABASE_URL in .env (Project Settings > Database > Connection string).\n" +
        "DATABASE_PASSWORD alone only works on projects with the IPv4 add-on.",
    );
    process.exit(1);
  }
  return postgres(url, { ssl: "require", max: 1, onnotice: () => {} });
}
