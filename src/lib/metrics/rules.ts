/**
 * The status and exclusion rules every count uses. One place, so "booked",
 * "attended" and "on the list" never mean two things on two pages.
 *
 * - On the list: every patient record not deleted (`deleted_at` empty).
 *   Archived patients stay on the list and in Total, but are not Active;
 *   their past treatments still count as money.
 * - Booked: any appointment that is not cancelled, including no-shows and
 *   future bookings. A reschedule edits the same row, so it is never counted
 *   twice (there is no "rescheduled" status).
 * - Attended: status `attended` and a start at or before now. A no-show is
 *   booked, but it is neither a visit nor a treatment.
 * - Live future booking: status `booked`, starting after now. This is what
 *   "booked ahead" and "has something booked" read.
 * - Consultation: catalogue category "Consultation", or a name containing
 *   "consult".
 */

export type PatientStatusRow = { status?: string | null; deleted_at?: string | null };
export type AppointmentStatusRow = { status?: string | null; starts_at: string };

export function isOnList(patient: PatientStatusRow): boolean {
  return !patient.deleted_at;
}

export function isActivePatient(patient: PatientStatusRow): boolean {
  return isOnList(patient) && (patient.status ?? "active") === "active";
}

export function isBooked(appointment: { status?: string | null }): boolean {
  return appointment.status !== "cancelled";
}

export function isAttended(appointment: AppointmentStatusRow, nowMs: number): boolean {
  return appointment.status === "attended" && new Date(appointment.starts_at).getTime() <= nowMs;
}

export function isLiveFuture(appointment: AppointmentStatusRow, nowMs: number): boolean {
  return (appointment.status ?? "booked") === "booked" && new Date(appointment.starts_at).getTime() > nowMs;
}

export function isConsultation(input: { category?: string | null; name?: string | null }): boolean {
  if ((input.category ?? "").trim().toLowerCase() === "consultation") return true;
  return /consult/i.test(input.name ?? "");
}

export const INSIGHTS_SOURCES = ["website", "instagram", "referral", "walk_in", "other"] as const;
export type InsightsSource = (typeof INSIGHTS_SOURCES)[number];

export const SOURCE_LABEL: Record<InsightsSource, string> = {
  website: "Website",
  instagram: "Instagram",
  referral: "Referral",
  walk_in: "Walk-in",
  other: "Other",
};

export function normalizeSource(value: string | null | undefined): InsightsSource {
  const key = (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (INSIGHTS_SOURCES as readonly string[]).includes(key) ? (key as InsightsSource) : "other";
}

/**
 * A rate as a fraction of 1, clamped to 0–1, or null when there is nothing to
 * divide by (shown as "—").
 */
export function rate(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return Math.min(1, Math.max(0, numerator / denominator));
}

/** A rate as a whole percent (0–100), or null when the denominator is 0. */
export function percent(numerator: number, denominator: number): number | null {
  const r = rate(numerator, denominator);
  return r === null ? null : Math.round(r * 100);
}

/** Whole percents for a list of counts that add to 100 (largest remainder). All 0 when the total is 0. */
export function sharePercents(counts: readonly number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => 0);
  const exact = counts.map((c) => (c * 100) / total);
  const out = exact.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = exact
    .map((x, i) => ({ rest: x - Math.floor(x), i }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i]! += 1;
    left -= 1;
  }
  return out;
}
