/**
 * Apply supabase/migrations/*.sql to the remote database.
 *
 * Records every file it applies in supabase_migrations.schema_migrations and
 * skips anything already recorded, so this agrees with `supabase db push`
 * instead of racing it. The previous version replayed all 44 files on every
 * run and wrote nothing to the ledger, which is how the ledger drifted from
 * the schema in the first place (audit 5.4).
 *
 *   node scripts/apply-migrations.mjs             apply pending migrations
 *   node scripts/apply-migrations.mjs --status    list pending, change nothing
 *   node scripts/apply-migrations.mjs --mark      record pending as applied
 *   node scripts/apply-migrations.mjs --only 2026 restrict to matching names
 *
 * `--mark` exists for migrations applied out-of-band: it reconciles the ledger
 * without re-running the SQL. `--only` is for staging a phase whose migrations
 * depend on application changes landing between them.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { connect } from "./lib/db.mjs";

const mode = process.argv.includes("--status")
  ? "status"
  : process.argv.includes("--mark")
    ? "mark"
    : "apply";

const onlyAt = process.argv.indexOf("--only");
const only = onlyAt === -1 ? null : process.argv[onlyAt + 1];

/** Supabase keys the ledger on the leading timestamp, not the whole filename. */
const versionOf = (file) => file.split("_")[0];

const files = readdirSync("supabase/migrations")
  .filter((f) => f.endsWith(".sql"))
  .filter((f) => !only || f.includes(only))
  .sort();

const sql = connect();
try {
  await sql`create schema if not exists supabase_migrations`;
  await sql`
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    )`;

  const applied = new Set(
    (await sql`select version from supabase_migrations.schema_migrations`).map((r) => r.version),
  );
  const pending = files.filter((f) => !applied.has(versionOf(f)));

  console.log(`ledger ${applied.size} applied, ${files.length} files, ${pending.length} pending`);
  if (pending.length === 0) {
    console.log("nothing to do");
  } else if (mode === "status") {
    pending.forEach((f) => console.log(`  pending ${f}`));
  } else {
    for (const file of pending) {
      const version = versionOf(file);
      const body = readFileSync(join("supabase/migrations", file), "utf8");
      process.stdout.write(`${mode === "mark" ? "mark" : "apply"} ${file} ... `);
      try {
        if (mode === "apply") await sql.unsafe(body);
        await sql`
          insert into supabase_migrations.schema_migrations (version, name)
          values (${version}, ${file}) on conflict (version) do nothing`;
        console.log("ok");
      } catch (err) {
        console.log("FAIL");
        console.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    }
    console.log("migrations_done");
  }
} finally {
  await sql.end({ timeout: 5 });
}
