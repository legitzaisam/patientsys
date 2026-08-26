/**
 * Clinic isolation has to hold for every query, not most of them.
 *
 * Every request runs on a service-role client, so the database's RESTRICTIVE
 * policies do not constrain application traffic — the wrapper in
 * auth/clinic-scope.server.ts is the isolation. This script checks the three
 * ways that wrapper can be bypassed:
 *
 *   1. a hardcoded clinic id, which stamps every write with the same tenant;
 *   2. the module-level `supabaseAdmin`, which never passes through it;
 *   3. a new table nobody classified as scoped or exempt.
 *
 * (3) is the one worth having. The first two are today's mistakes; the third is
 * the mistake someone makes in six months.
 */
import { readFileSync } from "node:fs";

const FUNCTIONS = "src/lib/clinic.functions.ts";
const SCOPE_FILE = "src/lib/auth/clinic-scope.server.ts";
const MIDDLEWARE = "src/lib/auth/session-middleware.server.ts";
const TYPES = "src/integrations/supabase/types.ts";

const source = readFileSync(FUNCTIONS, "utf8");
const scopeSource = readFileSync(SCOPE_FILE, "utf8");
const middleware = readFileSync(MIDDLEWARE, "utf8");
const types = readFileSync(TYPES, "utf8");

const errors = [];

/** 1. No hardcoded clinic id anywhere in the server functions. */
for (const [i, line] of source.split("\n").entries()) {
  if (/["'][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}["']/i.test(line)) {
    errors.push(`${FUNCTIONS}:${i + 1}  hardcoded uuid — clinic comes from the request`);
  }
}

/**
 * 2. The raw admin client is only allowed where it cannot reach a table:
 *    inside adminClient() itself, and in the two Auth-only ban helpers.
 */
const rawAdmin = [...source.matchAll(/const \{ supabaseAdmin \} = await import/g)];
const ALLOWED_RAW_ADMIN = 3;
if (rawAdmin.length > ALLOWED_RAW_ADMIN) {
  errors.push(
    `${FUNCTIONS}  ${rawAdmin.length} raw supabaseAdmin imports, expected ${ALLOWED_RAW_ADMIN}. ` +
      `Use adminClient(context) so .from() is clinic-scoped.`,
  );
}

/** 3. The middleware still wraps the client it hands to handlers. */
if (!/clinicScoped\(/.test(middleware)) {
  errors.push(`${MIDDLEWARE}  no longer wraps the database client with clinicScoped()`);
}

/** 4. Every table with a clinic_id is classified, and nothing claims one it lacks. */
/** Read one array/set literal by name, stopping at its closing bracket. */
function tableList(name, close) {
  const start = scopeSource.indexOf(name);
  const end = scopeSource.indexOf(close, start);
  if (start === -1 || end === -1) {
    errors.push(`${SCOPE_FILE}  could not read the ${name} list`);
    return new Set();
  }
  return new Set([...scopeSource.slice(start, end).matchAll(/"(\w+)"/g)].map((m) => m[1]));
}

const declaredScoped = tableList("CLINIC_SCOPED_TABLES", "] as const");
const declaredUnscoped = tableList("UNSCOPED_TABLES", "]);");

/**
 * Table name -> whether its Row type carries clinic_id, read from the generated
 * types. Anchored on the `public` schema specifically: `graphql_public` also
 * declares Tables, and it comes first in the file.
 */
const publicStart = types.indexOf("  public: {");
const tablesBlock = types.slice(
  types.indexOf("Tables: {", publicStart),
  types.indexOf("    Views: {", publicStart),
);
const actual = new Map();
for (const m of tablesBlock.matchAll(/^      (\w+): \{\n\s+Row: \{\n([\s\S]*?)^\s{8}\}/gm)) {
  actual.set(m[1], /^\s+clinic_id\??:/m.test(m[2]));
}

if (actual.size === 0) {
  errors.push(`${TYPES}  could not parse any tables — the generated shape changed`);
}

for (const [table, hasClinicId] of actual) {
  const classified = declaredScoped.has(table) || declaredUnscoped.has(table);
  if (!classified) {
    errors.push(
      `${SCOPE_FILE}  table "${table}" is in neither list — add it to ` +
        (hasClinicId ? "CLINIC_SCOPED_TABLES" : "UNSCOPED_TABLES"),
    );
  } else if (hasClinicId && !declaredScoped.has(table)) {
    errors.push(`${SCOPE_FILE}  table "${table}" has a clinic_id but is listed as unscoped`);
  } else if (!hasClinicId && declaredScoped.has(table)) {
    errors.push(`${SCOPE_FILE}  table "${table}" is listed as scoped but has no clinic_id column`);
  }
}

if (errors.length) {
  console.error(`\ntenancy check FAILED — ${errors.length} problem(s):\n`);
  errors.forEach((e) => console.error("  " + e));
  console.error("");
  process.exit(1);
}

console.log(
  `tenancy check ok — ${actual.size} tables classified ` +
    `(${declaredScoped.size} clinic-scoped, ${declaredUnscoped.size} exempt), ` +
    `no hardcoded clinic and no unscoped admin queries`,
);
