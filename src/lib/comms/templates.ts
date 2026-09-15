/**
 * Message bodies for the outbox. Isomorphic on purpose: the client previews
 * with the same code the server enqueues with, so what staff see is what the
 * patient gets.
 */

/** Absolute link to the public signing page for a document's access token. */
export function publicSigningUrl(origin: string | null | undefined, accessToken: string) {
  const base = (origin ?? "").replace(/\/$/, "");
  return `${base}/d/${accessToken}`;
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
