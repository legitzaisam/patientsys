/**
 * Print a deterministic snapshot of the security-relevant database surface:
 * grants, constraints, policies, triggers, indexes and the migration ledger.
 *
 * Read-only. Run it before and after a schema change and diff the two — that
 * diff is the evidence a migration did what it claimed and nothing else.
 *
 *   node scripts/db-snapshot.mjs > /tmp/before.txt
 */
import { connect } from "./lib/db.mjs";

const sql = connect();
const out = [];
const section = (title) => out.push(`\n## ${title}`);
const rows = (list, format) => list.forEach((r) => out.push(`  ${format(r)}`));

try {
  section("grants (public schema, by role and privilege)");
  rows(
    await sql`
      select grantee, privilege_type, count(*)::int as tables
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
      group by 1, 2 order by 1, 2`,
    (r) => `${r.grantee.padEnd(14)} ${r.privilege_type.padEnd(12)} ${r.tables}`,
  );

  section("default privileges (what new tables will inherit)");
  rows(
    await sql`
      select pg_get_userbyid(d.defaclrole) as owner, d.defaclacl::text as acl
      from pg_default_acl d join pg_namespace n on n.oid = d.defaclnamespace
      where n.nspname = 'public' and d.defaclobjtype = 'r' order by 1`,
    (r) => `${r.owner}: ${r.acl}`,
  );

  section("row counts");
  rows(
    await sql`
      select relname, n_live_tup::int as rows from pg_stat_user_tables
      where schemaname = 'public' order by relname`,
    (r) => `${r.relname.padEnd(28)} ${r.rows}`,
  );

  section("clinic_id column (nullability and null rows)");
  const clinicCols = await sql`
    select table_name, is_nullable from information_schema.columns
    where table_schema = 'public' and column_name = 'clinic_id' order by table_name`;
  for (const c of clinicCols) {
    const [{ nulls }] = await sql`
      select count(*)::int as nulls from ${sql(c.table_name)} where clinic_id is null`;
    out.push(`  ${c.table_name.padEnd(28)} nullable=${c.is_nullable.padEnd(4)} nulls=${nulls}`);
  }

  section("tables with no clinic_id column");
  rows(
    await sql`
      select t.tablename from pg_tables t
      where t.schemaname = 'public' and not exists (
        select 1 from information_schema.columns c
        where c.table_schema = 'public' and c.table_name = t.tablename
          and c.column_name = 'clinic_id')
      order by 1`,
    (r) => r.tablename,
  );

  section("policies");
  const policies = await sql`
    select tablename, policyname, permissive, cmd,
           coalesce(qual, '') as qual, coalesce(with_check, '') as with_check
    from pg_policies where schemaname = 'public' order by tablename, policyname`;
  out.push(
    `  total=${policies.length} restrictive=${policies.filter((p) => p.permissive === "RESTRICTIVE").length} ` +
      `mentioning_clinic_id=${policies.filter((p) => `${p.qual}${p.with_check}`.includes("clinic_id")).length}`,
  );
  rows(
    policies,
    (p) =>
      `${p.tablename.padEnd(26)} ${p.permissive === "RESTRICTIVE" ? "R" : "P"} ${p.cmd.padEnd(6)} ${p.policyname}`,
  );

  section("constraints (primary, unique, foreign, check)");
  rows(
    await sql`
      select c.conrelid::regclass::text as tbl, c.conname, c.contype,
             c.confdeltype, pg_get_constraintdef(c.oid) as def
      from pg_constraint c join pg_namespace n on n.oid = c.connamespace
      where n.nspname = 'public' and c.contype in ('p', 'u', 'f', 'c', 'x')
      order by 1, 2`,
    (r) =>
      `${r.tbl.padEnd(26)} ${r.contype}${r.contype === "f" ? `/${r.confdeltype}` : " "} ${r.conname.padEnd(46)} ${r.def}`,
  );

  section("triggers (user-defined)");
  rows(
    await sql`
      select c.relname as tbl, t.tgname, pg_get_triggerdef(t.oid) as def
      from pg_trigger t join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and not t.tgisinternal order by 1, 2`,
    (r) => `${r.tbl.padEnd(26)} ${r.tgname.padEnd(34)} ${r.def.replace(/\s+/g, " ")}`,
  );

  section("indexes");
  const indexes = await sql`
    select tablename, indexname, indexdef from pg_indexes
    where schemaname = 'public' order by tablename, indexname`;
  out.push(`  total=${indexes.length}`);
  rows(indexes, (r) => `${r.tablename.padEnd(26)} ${r.indexname.padEnd(44)} ${r.indexdef}`);

  section("security definer functions");
  rows(
    await sql`
      select p.proname, p.prosecdef, pg_get_function_identity_arguments(p.oid) as args,
             coalesce(array_to_string(p.proconfig, ','), '') as config
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef order by 1`,
    (r) => `${r.proname}(${r.args}) ${r.config}`,
  );

  section("migration ledger");
  const applied = await sql`
    select version from supabase_migrations.schema_migrations order by version`;
  out.push(`  applied=${applied.length}`);
  rows(applied, (r) => r.version);

  console.log(out.join("\n"));
} finally {
  await sql.end({ timeout: 5 });
}
