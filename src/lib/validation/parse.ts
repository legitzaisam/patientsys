/**
 * One set of wordings for validation failures, used on both sides.
 *
 * Zod's defaults read like a stack trace — "String must contain at least 1
 * character(s)" — which is no better under a form field than it is in a toast.
 * `friendlyErrors` rewrites them once; `parseInput` applies it on the server and
 * the pilot forms pass it to `zodResolver`, so a field says the same thing
 * wherever it is rejected.
 *
 * Why `parseInput` rather than `.validator(Schema)`: TanStack Start detects
 * Standard Schema and reports failures as
 * `new Error(JSON.stringify(issues, undefined, 2))`, and around fifty call sites
 * do `onError: (e) => toast.error(e.message)` — so a bad field would render a
 * multi-line JSON blob in a toast.
 */
import { z } from "zod";

/**
 * `first_name` → `First name`, `fullName` → `Full name`,
 * `attachments.0.path` → `Attachments 1 path`.
 */
function label(path: (string | number)[]): string {
  if (path.length === 0) return "Value";
  const readable = path
    .map((part) =>
      typeof part === "number"
        ? String(part + 1)
        : part.replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase(),
    )
    .join(" ");
  return readable.charAt(0).toUpperCase() + readable.slice(1);
}

const friendlyErrors: z.ZodErrorMap = (issue, ctx) => {
  const name = label(issue.path);
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return issue.received === "undefined" || issue.received === "null"
        ? { message: `${name} is required` }
        : { message: `${name} must be ${issue.expected}` };
    case z.ZodIssueCode.too_small:
      return issue.type === "string" && issue.minimum === 1
        ? { message: `${name} is required` }
        : { message: `${name} is too small (minimum ${issue.minimum})` };
    case z.ZodIssueCode.too_big:
      return issue.type === "string"
        ? { message: `${name} is too long (maximum ${issue.maximum} characters)` }
        : { message: `${name} is too large (maximum ${issue.maximum})` };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: `${name} is not a valid option` };
    case z.ZodIssueCode.invalid_union:
      return { message: `${name} is not valid` };
    default:
      // Anything raised by a superRefine already carries its own wording.
      return { message: ctx.defaultError };
  }
};

/**
 * Set globally rather than passed per call. Every consumer of these schemas —
 * `parseInput` on the server and `zodResolver` in the pilot forms — then reports
 * the same wording without having to thread an option through, and zod is used
 * for nothing else in this codebase. Importing any schema pulls this in, because
 * schemas.ts imports primitives.ts which imports this module.
 */
z.setErrorMap(friendlyErrors);

/**
 * Validate `data`, or throw an Error naming the offending fields.
 *
 * The `as T` on the way out is deliberate. `exactOptionalPropertyTypes` is on and
 * zod's `.optional()` produces `field: T | undefined` rather than `field?: T`, so
 * an inferred return type would fight the compiler at every handler. Keeping the
 * validator's declared parameter type means the runtime gains validation with no
 * call-site type churn; `scripts/check-validators.mjs` is what stops a schema
 * drifting from the annotation it guards.
 */
export function parseInput<T>(schema: z.ZodTypeAny, data: T): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data as T;

  const seen = new Set<string>();
  const messages: string[] = [];
  for (const issue of result.error.issues) {
    if (seen.has(issue.message)) continue;
    seen.add(issue.message);
    messages.push(issue.message);
    if (messages.length === 3) break;
  }
  const extra = result.error.issues.length - messages.length;
  throw new Error(messages.join("; ") + (extra > 0 ? ` (and ${extra} more)` : ""));
}
