/**
 * Apply supabase/migrations/*.sql to the remote database.
 * Requires DATABASE_URL in .env, or DATABASE_PASSWORD to build the direct URL.
 */
import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

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
const ref = fileEnv.SUPABASE_PROJECT_ID;
const password = fileEnv.DATABASE_PASSWORD || process.env.DATABASE_PASSWORD;
const dbUrl =
  fileEnv.DATABASE_URL ||
  (password && ref
    ? `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`
    : null);

if (!dbUrl) {
  console.error("Need DATABASE_URL or DATABASE_PASSWORD in .env to apply SQL migrations.");
  process.exit(1);
}

const sqlFiles = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .sort();

const sql = postgres(dbUrl, { ssl: "require", max: 1, onnotice: () => {} });
try {
  await sql`select 1`;
  console.log("db_connected", sqlFiles.length, "migrations");
  for (const file of sqlFiles) {
    const body = readFileSync(join("supabase/migrations", file), "utf8");
    process.stdout.write(`apply ${file} ... `);
    try {
      await sql.unsafe(body);
      console.log("ok");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already exists/i.test(msg)) {
        console.log("skip (already exists)");
        continue;
      }
      console.log("FAIL");
      console.error(msg);
      process.exit(1);
    }
  }
  console.log("migrations_done");
} finally {
  await sql.end({ timeout: 5 });
}
