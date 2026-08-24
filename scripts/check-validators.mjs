/**
 * Every server function that takes input must run it through a zod schema, and
 * that schema must cover exactly the fields the validator declares.
 *
 * The field-coverage rule is the important one. `z.object()` strips keys it does
 * not know about, and parseInput() returns the value as the validator's declared
 * type, so a field missing from a schema does not fail loudly — it silently
 * arrives at the handler as `undefined` while TypeScript still believes it is a
 * string. That is exactly how `treatment_id` was dropped from SendDocument while
 * this phase was being written, and nothing but this check noticed.
 *
 * Production and demo are compared against each other too, since both files
 * import the same schema module and a divergence there means demo mode is
 * enforcing different rules from the real thing.
 */
import { readFileSync } from "node:fs";

const PROD = "src/lib/clinic.functions.ts";
const DEMO = "src/lib/clinic.functions.demo.ts";
const SCHEMAS = "src/lib/validation/schemas.ts";

/** Split an object body on top-level separators and take each key name. */
function topLevelKeys(body) {
  const parts = [];
  let depth = 0;
  let buf = "";
  for (const ch of body) {
    if ("{[(<".includes(ch)) depth++;
    else if ("}])>".includes(ch)) depth--;
    if ((ch === "," || ch === ";") && depth === 0) {
      parts.push(buf);
      buf = "";
    } else buf += ch;
  }
  parts.push(buf);
  return parts
    .map((part) => {
      const clean = part
        .replace(/\/\*\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "")
        .trim();
      const m = clean.match(/^([A-Za-z_][\w]*)\??\s*[:,]?/);
      return m ? m[1] : null;
    })
    .filter(Boolean);
}

/** Body of the `{...}` whose opening brace sits at `open`. */
function braceBody(text, open) {
  let depth = 0;
  let i = open;
  for (; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) break;
    }
  }
  return text.slice(open + 1, i);
}

/** Each handler that has a validator, with the validator's full source. */
function readValidators(file) {
  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");
  const found = new Map();
  let current = null;
  lines.forEach((line, i) => {
    const m = line.match(/^export const (\w+) = createServerFn/);
    if (m) current = m[1];
    if (!line.includes(".validator(")) return;
    let depth = 0;
    for (const ch of line) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
    }
    let j = i;
    const buf = [line];
    while (depth > 0 && j < lines.length - 1) {
      j++;
      buf.push(lines[j]);
      for (const ch of lines[j]) {
        if (ch === "(") depth++;
        if (ch === ")") depth--;
      }
    }
    found.set(current, { text: buf.join("\n"), line: i + 1, source });
  });
  return found;
}

const schemaSource = readFileSync(SCHEMAS, "utf8");
const schemas = new Map();
for (const m of schemaSource.matchAll(/export const (\w+) = z\.object\(\{/g)) {
  schemas.set(m[1], new Set(topLevelKeys(braceBody(schemaSource, m.index + m[0].length - 1))));
}

const prod = readValidators(PROD);
const demo = readValidators(DEMO);
const errors = [];
const used = new Set();

/** Field names the validator's parameter annotation declares. */
function declaredFields(text, source) {
  const alias = text.match(/\(\s*data:\s*(\w+)\s*\)/);
  if (alias) {
    const at = source.indexOf(`export type ${alias[1]} = {`);
    if (at === -1) return null;
    return topLevelKeys(braceBody(source, source.indexOf("{", at)));
  }
  const at = text.indexOf("data");
  const open = text.indexOf("{", at);
  return open === -1 ? [] : topLevelKeys(braceBody(text, open));
}

for (const [name, info] of prod) {
  const ref = info.text.match(/parseInput\(\s*schemas\.(\w+)/);
  if (!ref) {
    errors.push(`${PROD}:${info.line}  ${name} still has a pass-through validator`);
    continue;
  }
  const schemaName = ref[1];
  used.add(schemaName);
  const fields = schemas.get(schemaName);
  if (!fields) {
    errors.push(
      `${PROD}:${info.line}  ${name} references schemas.${schemaName}, which does not exist`,
    );
    continue;
  }

  const declared = declaredFields(info.text, info.source);
  if (declared) {
    const missing = declared.filter((f) => !fields.has(f));
    const extra = [...fields].filter((f) => !declared.includes(f));
    if (missing.length)
      errors.push(
        `${PROD}:${info.line}  ${name}: schemas.${schemaName} is missing ${missing.join(", ")} — z.object() would silently drop ${missing.length > 1 ? "these" : "it"}`,
      );
    if (extra.length)
      errors.push(
        `${PROD}:${info.line}  ${name}: schemas.${schemaName} declares unknown field(s) ${extra.join(", ")}`,
      );
  }

  const twin = demo.get(name);
  if (!twin) {
    errors.push(`${DEMO}  ${name} has no validator, but the production one does`);
    continue;
  }
  const twinRef = twin.text.match(/parseInput\(\s*schemas\.(\w+)/);
  if (!twinRef) errors.push(`${DEMO}:${twin.line}  ${name} still has a pass-through validator`);
  else if (twinRef[1] !== schemaName)
    errors.push(
      `${DEMO}:${twin.line}  ${name} validates with schemas.${twinRef[1]} but production uses schemas.${schemaName}`,
    );
}

for (const name of demo.keys()) {
  if (!prod.has(name))
    errors.push(`${DEMO}  ${name} has a validator with no production counterpart`);
}

for (const name of schemas.keys()) {
  if (!used.has(name)) errors.push(`${SCHEMAS}  ${name} is exported but no validator uses it`);
}

if (errors.length) {
  console.error(`\nvalidator check FAILED — ${errors.length} problem(s):\n`);
  errors.forEach((e) => console.error("  " + e));
  console.error("");
  process.exit(1);
}

console.log(
  `validator check ok — ${prod.size} validators, each parsed by a schema covering exactly its declared fields, production and demo in step`,
);
