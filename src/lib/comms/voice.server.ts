/**
 * Browser voice calls (demo): env plumbing and the Twilio Voice AccessToken.
 *
 * Follows the comms convention (config.server.ts / sms.server.ts): talk to
 * Twilio without the heavyweight SDK. The AccessToken is a standard HS256 JWT
 * signed with the API key secret — ~20 lines with node:crypto.
 *
 * Every patient is deterministically hashed onto one of the (few, verified)
 * numbers in TWILIO_DEMO_NUMBERS, so demo calls always ring a phone you own.
 * See docs/voice-call-setup.md for the one-time console setup.
 */
import { createHmac } from "node:crypto";

function env(name: string): string | null {
  return process.env[name]?.trim() || null;
}

export function voiceDemoNumbers(): string[] {
  return (env("TWILIO_DEMO_NUMBERS") ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

export function voiceAvailable(): boolean {
  return Boolean(
    env("TWILIO_ACCOUNT_SID") &&
      env("TWILIO_API_KEY_SID") &&
      env("TWILIO_API_KEY_SECRET") &&
      env("TWILIO_TWIML_APP_SID") &&
      voiceDemoNumbers().length > 0,
  );
}

/** Deterministic pool pick: the same patient always rings the same phone. */
export function voiceTargetFor(patientId: string): { phone: string; label: string } | null {
  const pool = voiceDemoNumbers();
  if (pool.length === 0) return null;
  let hash = 0;
  for (let i = 0; i < patientId.length; i++) hash = (hash * 31 + patientId.charCodeAt(i)) >>> 0;
  const index = hash % pool.length;
  return { phone: pool[index]!, label: `Demo line ${index + 1}` };
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

/**
 * Twilio Voice AccessToken (https://www.twilio.com/docs/iam/access-tokens):
 * HS256 JWT, cty "twilio-fat;v=1", iss = API key SID, sub = Account SID,
 * with a voice grant pointing at the TwiML App that dials the target.
 */
export function mintVoiceToken(identity: string): string {
  const accountSid = env("TWILIO_ACCOUNT_SID");
  const apiKeySid = env("TWILIO_API_KEY_SID");
  const apiKeySecret = env("TWILIO_API_KEY_SECRET");
  const twimlAppSid = env("TWILIO_TWIML_APP_SID");
  if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
    throw new Error("Voice calling is not configured");
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT", cty: "twilio-fat;v=1" };
  const payload = {
    jti: `${apiKeySid}-${now}`,
    iss: apiKeySid,
    sub: accountSid,
    iat: now,
    exp: now + 3600,
    grants: {
      identity,
      voice: { outgoing: { application_sid: twimlAppSid } },
    },
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createHmac("sha256", apiKeySecret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}
