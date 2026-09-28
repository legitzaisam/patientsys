/**
 * The clinic's metrics, defined once. Insights, Dashboard, Retention,
 * Performance, My Profile → Performance, the earnings CSV and the test
 * snapshot all read these functions; nothing re-derives a figure locally.
 *
 * Decisions (28 Sep 2026 review):
 * - Visit: one attended appointment. Several treatments on one appointment
 *   are one visit; a treatment with no appointment (a walk-in) is its own.
 * - Booked: any appointment not cancelled, no-shows and future bookings
 *   included. Attended: `attended` and started. A no-show is booked but
 *   neither a visit nor a treatment. A future consultation is booked, not
 *   consulted.
 * - Money in integer pence. Earned = treatments performed minus refunds;
 *   Collected = money received, deposits included, refunds off; Outstanding
 *   = Earned − Collected. Shares are per line at the stamped rate.
 * - Dormant: treated before, no visit in the 12 months before the period
 *   end. Never treated is a separate count.
 * - New patients, Rebooked and the New patients chart follow the picker.
 * - Default range: the 12 whole calendar months ending with the current
 *   month, in Europe/London time.
 * - Deleted patients (`deleted_at`) are left out of every count. Archived
 *   patients stay in Total, not in Active; their money still counts.
 * - There is no "rescheduled" status (a reschedule edits the same row) and
 *   no test-record flag.
 * - Every rate has a fixed denominator, is clamped to 0–100% and is null
 *   ("—") when the denominator is 0.
 */
export * from "./period";
export * from "./rules";
export * from "./visits";
export * from "./money";
export * from "./funnel";
export * from "./book";
export * from "./retention";
export * from "./dashboard";
export * from "./definitions";
export * from "./appointment-flags";
export { metricsSnapshot, type MetricsSnapshot, type SnapshotRows } from "./snapshot";
