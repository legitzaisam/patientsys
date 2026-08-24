/**
 * Shared building blocks for the server function schemas.
 *
 * Deliberately no `.uuid()` and no `.datetime()`. Demo fixture ids are
 * `a10000-0000-4000-8000-000000000001` — six-four-four-four-twelve, not a
 * valid UUID (see `id()` in src/lib/demo/data.ts) — and date fields mix
 * `YYYY-MM-DD` (`date_of_birth`) with full ISO strings (`starts_at`). Asserting
 * either format would reject input the app accepts today, so these primitives
 * bound length and type only.
 */
import { z } from "zod";
import { checkEmail } from "@/lib/email";
// Side-effect import: installs the shared wording for validation failures.
import "./parse";

/** A row identifier. Bounded well above the 36 characters a UUID needs. */
export const id = z.string().trim().min(1).max(64);
/**
 * Optional means "may be absent *or* blank". Forms post `String(f.get(x) ?? "")`
 * for unfilled selects and dates — a photo with no treatment, a patient with no
 * date of birth — and every handler reads those with `|| null`. Requiring a
 * non-empty value here would reject input the app has always accepted.
 */
export const optionalId = z.string().trim().max(64).optional();

/** Free text with a ceiling; `required` also rejects whitespace-only input. */
export const text = (max: number) => z.string().trim().max(max);
export const requiredText = (max: number) => z.string().trim().min(1).max(max);
export const optionalText = (max: number) => text(max).optional();
export const nullableText = (max: number) => text(max).nullable().optional();

/** Dates stay format-free; see the note at the top of this file. */
export const dateString = z.string().trim().min(1).max(64);
/** Blank allowed, for the same reason as `optionalId`. */
export const optionalDateString = z.string().trim().max(64).optional();

const emailShape = (allowEmpty: boolean) =>
  z
    .string()
    .trim()
    .max(320)
    .superRefine((value, ctx) => {
      if (allowEmpty && value === "") return;
      const result = checkEmail(value);
      if (!result.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: result.error });
    });

/**
 * Reuses `checkEmail` rather than `z.string().email()` so the server and the
 * client forms agree on what a valid address is, typo suggestions included.
 */
export const email = emailShape(false);
export const optionalEmail = emailShape(true).optional();
export const nullableEmail = emailShape(true).nullable().optional();

/** Money in pounds. Non-negative, with a ceiling that catches slipped decimals. */
export const money = z.number().finite().min(0).max(1_000_000);
export const optionalMoney = money.optional();
export const nullableMoney = money.nullable().optional();

/** Appointment and catalogue durations, in minutes. */
export const durationMinutes = z
  .number()
  .int()
  .min(0)
  .max(24 * 60);
export const optionalDurationMinutes = durationMinutes.optional();
export const nullableDurationMinutes = durationMinutes.nullable().optional();

export const staffRole = z.enum(["owner", "manager", "practitioner", "front_desk"]);
/** `owner` is not assignable through the permission grid. */
export const assignableRole = z.enum(["manager", "front_desk", "practitioner"]);

export const appointmentStatus = z.enum(["booked", "attended", "cancelled", "no_show"]);
export const paymentStatus = z.enum(["unpaid", "deposit_paid", "paid", "refunded"]);
export const appointmentStage = z.enum([
  "booked",
  "arrived",
  "waiting",
  "in_treatment",
  "aftercare",
  "complete",
  "no_show",
]);
export const documentKind = z.enum([
  "consent",
  "treatment_plan",
  "consultation",
  "aftercare",
  "other",
]);
export const paymentLinkKind = z.enum(["deposit", "full", "balance"]);

/**
 * Handlers cap attachments at five with `.slice(0, 5)`. The ceiling here is
 * deliberately looser so a sixth file is still truncated rather than rejected,
 * which is how the app behaves today.
 */
export const attachments = z
  .array(
    z.object({
      path: requiredText(500),
      name: requiredText(300),
      type: text(150),
      size: z
        .number()
        .int()
        .min(0)
        .max(100 * 1024 * 1024),
    }),
  )
  .max(20)
  .optional();

/** Staff picked as recipients of a recall task. */
export const recipients = z.array(z.object({ id, label: requiredText(200) })).max(50);

/** Password rules live in the handlers; this only bounds the field. */
export const password = z.string().min(1).max(200);

/**
 * Bridges a text input to a numeric rule. Number fields in the UI hold strings,
 * so the raw value is coerced exactly as the submit handler would — blank means
 * `whenBlank` — and then checked against the same schema the server applies, so
 * a bound like the 24-hour appointment ceiling shows up under the field rather
 * than coming back later as a toast. The value stays a string.
 */
export const numericText = (rule: z.ZodTypeAny, whenBlank: number | null) =>
  z.string().superRefine((raw, ctx) => {
    const value = raw.trim() === "" ? whenBlank : Number(raw);
    const result = rule.safeParse(value);
    if (result.success) return;
    // Re-raised without the inner message so the wording is recomputed against
    // this field's path — otherwise every numeric error reads "Value is too …".
    for (const { message, path, ...rest } of result.error.issues) {
      ctx.addIssue(rest as z.IssueData);
    }
  });
