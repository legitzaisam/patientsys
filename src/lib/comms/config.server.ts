import { DEMO_MODE } from "@/lib/demo/enabled";

/** True when nothing may leave the building for this channel. */
export function commsSandbox(channel: "email" | "sms"): boolean {
  if (DEMO_MODE) return true;
  if (process.env["COMMS_SANDBOX"] === "1") return true;
  if (channel === "email") return !process.env["RESEND_API_KEY"]?.trim();
  return !process.env["TWILIO_ACCOUNT_SID"]?.trim() || !process.env["TWILIO_AUTH_TOKEN"]?.trim();
}

export function commsFromEmail(): string | null {
  return process.env["COMMS_FROM_EMAIL"]?.trim() || null;
}

export function commsFromName(): string | null {
  return process.env["COMMS_FROM_NAME"]?.trim() || null;
}

export function commsSmsFrom(): string | null {
  return process.env["TWILIO_FROM"]?.trim() || null;
}

export function commsDrainSecret(): string | null {
  return process.env["COMMS_DRAIN_SECRET"]?.trim() || null;
}

export const COMMS_MAX_ATTEMPTS = 8;
export const COMMS_CLAIM_LIMIT = 20;
export const COMMS_STALE_SENDING_MS = 5 * 60 * 1000;

export function backoffSeconds(attempts: number): number {
  return Math.min(15 * 2 ** Math.max(0, attempts - 1), 3600);
}
