/**
 * Retention's headline rate, shared by the Retention page and the Dashboard
 * KPI: of patients with a visit in the 12 calendar months up to a point in
 * time, the share with two or more visits in those months. Visits, not
 * treatment rows (visits.ts). The due, overdue and to-chase states live in
 * definitions.ts.
 */
import { monthsBefore } from "./period";
import { repeatRate } from "./visits";

export const RETENTION_LOOKBACK_MONTHS = 12;

/** The rolling 12-month repeat rate as of `atMs`. */
export function rollingRetention(visits: Map<string, readonly { patient_id: string; performed_at: string }[]>, atMs: number) {
  return repeatRate(visits, monthsBefore(atMs, RETENTION_LOOKBACK_MONTHS), atMs);
}

/** The same rate over a shorter lookback in days (the week-by-week trend). */
export function rollingRetentionDays(
  visits: Map<string, readonly { patient_id: string; performed_at: string }[]>,
  atMs: number,
  days: number,
) {
  return repeatRate(visits, atMs - days * 86_400_000 + 1, atMs);
}
