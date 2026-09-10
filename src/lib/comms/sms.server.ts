import { commsSandbox, commsSmsFrom } from "./config.server";
import type { ProviderResult } from "./email.server";

export async function sendSms(input: { to: string; body: string }): Promise<ProviderResult> {
  const from = commsSmsFrom();
  if (commsSandbox("sms")) {
    console.info("[comms:sandbox] sms", { to: input.to });
    return { ok: true, provider: "sandbox", messageId: `sandbox:${crypto.randomUUID()}` };
  }
  const sid = process.env["TWILIO_ACCOUNT_SID"]!.trim();
  const token = process.env["TWILIO_AUTH_TOKEN"]!.trim();
  if (!from) return { ok: false, error: "TWILIO_FROM is not set." };

  const body = new URLSearchParams({
    To: input.to,
    From: from,
    Body: input.body,
  });
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );
  const payload = (await response.json().catch(() => null)) as {
    sid?: string;
    message?: string;
    error_message?: string;
  } | null;
  if (!response.ok || !payload?.sid) {
    return {
      ok: false,
      error: payload?.error_message || payload?.message || `Twilio returned ${response.status}`,
    };
  }
  return { ok: true, provider: "twilio", messageId: payload.sid };
}
