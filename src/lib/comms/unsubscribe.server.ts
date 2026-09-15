import { createHmac, timingSafeEqual } from "node:crypto";
import { DEMO_MODE } from "@/lib/demo/enabled";

/**
 * Stateless one-click unsubscribe tokens: HMAC(patient_id, secret). Nothing to
 * store, nothing to enumerate — a token is only mintable by us and names one
 * patient. Rotating COMMS_UNSUBSCRIBE_SECRET invalidates every link in flight,
 * which is the correct blast radius for a leaked secret.
 */

function secretKey(): string | null {
  const configured = process.env["COMMS_UNSUBSCRIBE_SECRET"]?.trim();
  if (configured) return configured;
  // Demo runs without env; a fixed key keeps the flow walkable end-to-end.
  return DEMO_MODE ? "demo-unsubscribe-secret" : null;
}

function mac(patientId: string, key: string) {
  return createHmac("sha256", key).update(patientId).digest("hex").slice(0, 32);
}

export function unsubscribeToken(patientId: string): string | null {
  const key = secretKey();
  if (!key || !patientId) return null;
  return `${patientId}.${mac(patientId, key)}`;
}

/** Returns the patient id the token names, or null for anything invalid. */
export function verifyUnsubscribeToken(token: string): string | null {
  const key = secretKey();
  if (!key) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const patientId = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(mac(patientId, key));
  if (given.length !== expected.length) return null;
  return timingSafeEqual(given, expected) ? patientId : null;
}

/** Footer line appended to non-transactional email at dispatch time. */
export function unsubscribeFooter(patientId: string, origin?: string | null): string | null {
  const base = (origin ?? process.env["APP_ORIGIN"] ?? "").trim().replace(/\/$/, "");
  const token = unsubscribeToken(patientId);
  if (!base || !token) return null;
  return `To stop these messages: ${base}/u/${token}`;
}
