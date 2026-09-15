/**
 * Message bodies for the outbox. Isomorphic on purpose: the client previews
 * with the same code the server enqueues with, so what staff see is what the
 * patient gets.
 */
import type { CommsChannel, CommsPurpose } from "./preferences";

/** The variable set staff can use in templates, shared by every composer. */
export const TEMPLATE_VARIABLES = [
  { token: "{{first_name}}", label: "First name" },
  { token: "{{full_name}}", label: "Full name" },
  { token: "{{treatment}}", label: "Treatment" },
  { token: "{{due_date}}", label: "Due date" },
  { token: "{{clinic}}", label: "Clinic" },
] as const;

/**
 * Fill {{variables}} in a template body. Unknown variables are left visible
 * rather than silently blanked, so a typo is caught in the preview instead of
 * reaching a patient as an empty gap.
 */
export function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => vars[key] ?? match);
}

/**
 * Which channels a send should use. One rule, one place: email when there is
 * an address, SMS added for reminders (where it moves no-shows), and SMS as
 * the fallback when a patient has a phone but no email.
 */
export function channelsFor(
  patient: { email?: string | null; phone?: string | null },
  purpose: CommsPurpose,
): CommsChannel[] {
  const hasEmail = Boolean(patient.email?.trim());
  const hasPhone = Boolean(patient.phone?.trim());
  const channels: CommsChannel[] = [];
  if (hasEmail) channels.push("email");
  if (hasPhone && (purpose === "reminder" || !hasEmail)) channels.push("sms");
  return channels;
}

/** Absolute link to the public signing page for a document's access token. */
export function publicSigningUrl(origin: string | null | undefined, accessToken: string) {
  const base = (origin ?? "").replace(/\/$/, "");
  return `${base}/d/${accessToken}`;
}

/** Reschedule / booking-change notice for email, SMS and the portal thread. */
export function bookingUpdatedMessage(opts: {
  name: string;
  treatment: string;
  treatmentNumber?: number | string | null;
  when: string;
  practitioner?: string | null;
}) {
  const tx =
    opts.treatmentNumber != null && opts.treatmentNumber !== ""
      ? ` (treatment #${opts.treatmentNumber})`
      : "";
  const withWho = opts.practitioner ? ` with ${opts.practitioner}` : "";
  return (
    `Hi ${opts.name}, your ${opts.treatment}${tx} appointment has been rescheduled to ` +
    `${opts.when}${withWho}. If this time does not work for you, please contact the clinic ` +
    `and we will find another.`
  );
}

/** Consent/form request email. `reminder` softens the subject on a resend. */
export function consentRequestMessage(opts: {
  name: string;
  title: string;
  url: string;
  reminder?: boolean;
}) {
  const subject = opts.reminder
    ? `Reminder: ${opts.title} is waiting for your signature`
    : `${opts.title} — please review and sign`;
  const body =
    `Hi ${opts.name}, ${opts.title} is ready for you to review and sign. ` +
    `Sign it securely here — no account needed: ${opts.url} ` +
    `You can also sign in to your patient portal instead. ` +
    `If you were not expecting this, please contact the clinic.`;
  return { subject, body };
}
