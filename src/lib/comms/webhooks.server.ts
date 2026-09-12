import { createHmac, timingSafeEqual } from "node:crypto";

export function applyWebhookStatus(event: "sent" | "bounced" | "failed") {
  if (event === "sent") return { status: "sent" as const, error: null };
  if (event === "bounced") return { status: "bounced" as const };
  return { status: "failed" as const };
}

export function verifyResendSignature(opts: {
  payload: string;
  svixId: string;
  svixTimestamp: string;
  svixSignature: string;
  secret: string;
}): boolean {
  const key = opts.secret.startsWith("whsec_") ? Buffer.from(opts.secret.slice(6), "base64") : Buffer.from(opts.secret);
  const signed = `${opts.svixId}.${opts.svixTimestamp}.${opts.payload}`;
  const digest = createHmac("sha256", key).update(signed).digest("base64");
  const expected = `v1,${digest}`;
  return opts.svixSignature.split(" ").some((part) => safeEqual(part.trim(), expected));
}

export function verifyTwilioSignature(opts: {
  url: string;
  params: Record<string, string>;
  signature: string;
  authToken: string;
}): boolean {
  const sorted = Object.keys(opts.params)
    .sort()
    .reduce((acc, key) => acc + key + opts.params[key], opts.url);
  const digest = createHmac("sha1", opts.authToken).update(sorted).digest("base64");
  return safeEqual(digest, opts.signature);
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function markCommunicationByProviderId(
  db: { from: (table: string) => any },
  providerMessageId: string,
  event: "sent" | "bounced" | "failed",
  error?: string,
) {
  const patch: Record<string, unknown> = applyWebhookStatus(event);
  if (error && event !== "sent") patch["error"] = error;
  if (event === "sent") patch["sent_at"] = new Date().toISOString();
  const { error: updateError } = await db
    .from("communications")
    .update(patch)
    .eq("provider_message_id", providerMessageId);
  if (updateError) throw new Error(updateError.message);
}
