/**
 * Every server function must declare its access rule in src/lib/auth/policy.ts
 * and must actually call authorize() with its own name.
 *
 * This is the control that would have caught the six unguarded clinical writers
 * found in the Phase 3 audit — savePatient, addTreatment, saveAppointment,
 * sendDocument, reviewHistory and saveAppointmentNote all reached the database
 * with no authorization at all. A missing entry or a missing call is a hole, so
 * both are errors here rather than warnings.
 */
import { readFileSync } from "node:fs";

const FUNCTIONS = "src/lib/clinic.functions.ts";
const POLICY_FILE = "src/lib/auth/policy.ts";

const source = readFileSync(FUNCTIONS, "utf8");
const policySource = readFileSync(POLICY_FILE, "utf8");

const declared = new Set(
  [...policySource.matchAll(/^\s{2}(\w+):\s*\{\s*kind:/gm)].map((m) => m[1]),
);

const lines = source.split("\n");
const handlers = [];
lines.forEach((line, i) => {
  const m = line.match(/^export const (\w+) = createServerFn/);
  if (m) handlers.push({ name: m[1], line: i });
});

const errors = [];

handlers.forEach((h, i) => {
  const end = i + 1 < handlers.length ? handlers[i + 1].line : lines.length;
  const body = lines.slice(h.line, end).join("\n");

  if (!declared.has(h.name)) {
    errors.push(`${FUNCTIONS}:${h.line + 1}  ${h.name} has no entry in POLICY`);
  }
  if (!new RegExp(`authorize\\(\\s*(context|ctx)[^)]*"${h.name}"`).test(body)) {
    errors.push(`${FUNCTIONS}:${h.line + 1}  ${h.name} never calls authorize(ctx, "${h.name}")`);
  }
});

const handlerNames = new Set(handlers.map((h) => h.name));
for (const name of declared) {
  if (!handlerNames.has(name)) {
    errors.push(`${POLICY_FILE}  ${name} is declared in POLICY but no such handler exists`);
  }
}

if (errors.length) {
  console.error(`\npolicy check FAILED — ${errors.length} problem(s):\n`);
  errors.forEach((e) => console.error("  " + e));
  console.error("");
  process.exit(1);
}

console.log(`policy check ok — ${handlers.length} handlers, all declared and all calling authorize()`);
