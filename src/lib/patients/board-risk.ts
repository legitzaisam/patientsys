import { clinicDayDiff, clinicDayKey } from "@/lib/clinic-time";

/**
 * Risk vocabulary for the Journey board's triage tiles and patient pills. It
 * reads the same facts `planStepState` already produces for every plan row
 * (stepBookedAt, otherBookingTreatment, noShowAt, overdue), so the board, the
 * plan card and the dashboard cannot disagree about a plan.
 */

export type RiskKey = "overdue" | "noshow" | "mismatch" | "nobook" | "ontrack";
export type TileKey = RiskKey | "due_this_week";
export type DueBucketKey = "overdue" | "week" | "fortnight" | "later";

export const RISK_ORDER: readonly RiskKey[] = [
  "overdue",
  "noshow",
  "mismatch",
  "nobook",
  "ontrack",
];
export const TILE_ORDER: readonly TileKey[] = [
  "overdue",
  "noshow",
  "mismatch",
  "nobook",
  "due_this_week",
  "ontrack",
];

export const RISK_META: Record<
  TileKey,
  {
    label: string;
    description: string;
    fill: string;
    ink: string;
    dot: string;
    ring: string;
    /** The colour token behind the selected ring, for inline `box-shadow`s. */
    ringVar: string;
  }
> = {
  overdue: {
    label: "Overdue",
    description: "Step date passed, nothing booked",
    fill: "bg-destructive-bg",
    ink: "text-destructive-ink",
    dot: "bg-destructive",
    ring: "ring-destructive",
    ringVar: "--destructive",
  },
  noshow: {
    label: "No-show",
    description: "Missed a booked step",
    fill: "bg-noshow-bg",
    ink: "text-noshow-ink",
    dot: "bg-noshow",
    ring: "ring-noshow",
    ringVar: "--noshow",
  },
  mismatch: {
    label: "Wrong booking",
    description: "Booked, but for a different treatment",
    fill: "bg-sky-bg",
    ink: "text-sky-ink",
    dot: "bg-sky",
    ring: "ring-sky",
    ringVar: "--sky",
  },
  nobook: {
    label: "No booking",
    description: "Next step not in the diary yet",
    fill: "bg-warning-bg",
    ink: "text-warning-ink",
    dot: "bg-warning",
    ring: "ring-warning",
    ringVar: "--warning",
  },
  due_this_week: {
    label: "Due this week",
    description: "Unbooked steps due within 7 days",
    fill: "bg-accent-soft",
    ink: "text-accent-ink",
    dot: "bg-accent-deep",
    ring: "ring-accent-deep",
    ringVar: "--accent-deep",
  },
  ontrack: {
    label: "On track",
    description: "Next step booked in the diary",
    fill: "bg-success-bg",
    ink: "text-success-ink",
    dot: "bg-success",
    ring: "ring-success",
    ringVar: "--success",
  },
};

export type BoardRiskInput = {
  nextMilestone: { dueDate?: string | null } | null;
  overdue: boolean;
  stepBookedAt?: string | null;
  otherBookingTreatment?: string | null;
  noShowAt?: string | null;
};

/** No-show → wrong booking → overdue → no booking → on track. */
export function boardRisk(plan: BoardRiskInput): RiskKey {
  if (plan.noShowAt) return "noshow";
  if (plan.stepBookedAt) return "ontrack";
  if (plan.otherBookingTreatment) return "mismatch";
  if (plan.overdue) return "overdue";
  return "nobook";
}

/** Overdue / next 7 days / next 14 days / later, by the step's due date. */
export function dueBucketKey(
  plan: BoardRiskInput,
  todayKey: string = clinicDayKey(),
): DueBucketKey {
  if (plan.noShowAt) return "overdue";
  const dueDate = plan.nextMilestone?.dueDate;
  if (!dueDate) return "later";
  const days = clinicDayDiff(todayKey, dueDate);
  if (days < 0 && !plan.stepBookedAt) return "overdue";
  if (days <= 7) return "week";
  if (days <= 14) return "fortnight";
  return "later";
}

/** Whether a plan lights up for a tile. "Due this week" is the unbooked steps due inside 7 days. */
export function tileMatches(
  tile: TileKey,
  plan: { risk: RiskKey; dueBucket: DueBucketKey },
): boolean {
  if (tile === "due_this_week") return plan.dueBucket === "week" && plan.risk === "nobook";
  return plan.risk === tile;
}

/** The first selected tile a plan matches, for the pill's fill; null when none. */
export function hitTile(
  tiles: readonly TileKey[],
  plan: { risk: RiskKey; dueBucket: DueBucketKey },
): TileKey | null {
  return tiles.find((t) => tileMatches(t, plan)) ?? null;
}

/** Sort weight: riskier first, then sooner. */
export function riskUrgency(
  plan: { risk: RiskKey; nextMilestone: { dueDate?: string | null } | null },
  todayKey: string = clinicDayKey(),
) {
  const days = plan.nextMilestone?.dueDate
    ? clinicDayDiff(todayKey, plan.nextMilestone.dueDate)
    : 999;
  return RISK_ORDER.indexOf(plan.risk) * 1000 + days;
}

export function isTileKey(value: unknown): value is TileKey {
  return typeof value === "string" && (TILE_ORDER as readonly string[]).includes(value);
}

/** The dashboard's `?risk=1` deep link: the three "needs a human" states. */
export const RISK_DEEP_LINK_TILES: readonly TileKey[] = ["overdue", "noshow", "nobook"];
