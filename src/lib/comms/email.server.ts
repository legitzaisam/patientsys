import { commsFromEmail, commsFromName, commsSandbox } from "./config.server";

export type ProviderResult =
  | { ok: true; provider: string; messageId: string }
  | { ok: false; error: string };

export async function sendEmail(input: {
  to: string;
  subject: string;
  body: string;
  fromEmail?: string | null;
  fromName?: string | null;
}): Promise<ProviderResult> {
  const fromEmail = input.fromEmail?.trim() || commsFromEmail();
  const fromName = input.fromName?.trim() || commsFromName();
  const subject = input.subject.trim() || "Message from your clinic";

  if (commsSandbox("email")) {
    console.info("[comms:sandbox] email", { to: input.to, subject });
    return { ok: true, provider: "sandbox", messageId: `sandbox:${crypto.randomUUID()}` };
  }
  if (!fromEmail) return { ok: false, error: "COMMS_FROM_EMAIL is not set." };

  const key = process.env["RESEND_API_KEY"]!.trim();
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject,
      text: input.body,
    }),
  });
  const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!response.ok || !payload?.id) {
    return { ok: false, error: payload?.message || `Resend returned ${response.status}` };
  }
  return { ok: true, provider: "resend", messageId: payload.id };
}
