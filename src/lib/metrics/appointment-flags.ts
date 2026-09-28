/**
 * What an appointment still needs. One place for the flags the diary's
 * "Needs action" control, the dashboard's Attention list and the record's
 * booking badge all read, so a booking is never "unpaid" on one screen and
 * fine on another.
 */
import { DAY_MS } from "./definitions";

export type FlagKey =
  | "unpaid"
  | "deposit_due"
  | "balance_due"
  | "consent_due"
  | "running_late"
  | "no_show"
  | "details_incomplete";

export const FLAG_LABEL: Record<FlagKey, string> = {
  unpaid: "Unpaid",
  deposit_due: "Deposit due",
  balance_due: "Balance due",
  consent_due: "Consent due",
  running_late: "Running late",
  no_show: "No show",
  details_incomplete: "Details incomplete",
};

export type AppointmentFlagInput = {
  starts_at: string;
  status?: string | null;
  stage?: string | null;
  payment_status?: string | null;
  /** Consent document state as the views expose it. */
  documents?: { status?: string | null } | null;
  details_incomplete?: boolean | null;
};

/* Arrival phases, shared with the staff dock's arrival alerts. */
export type ArrivalPhase = "due" | "arrival" | "late" | "overdue";
export const ARRIVAL_WINDOW_BEFORE_MS = 5 * 60 * 1000;
export const ARRIVAL_LATE_AFTER_MS = 5 * 60 * 1000;
export const ARRIVAL_OVERDUE_AFTER_MS = 15 * 60 * 1000;

/**
 * Where a booked (not yet arrived) appointment sits against the clock: due in
 * the next five minutes, arrival window, running late, or overdue.
 */
export function phaseOf(startsAtMs: number, nowMs: number): ArrivalPhase | null {
  const diff = startsAtMs - nowMs;
  if (diff > ARRIVAL_WINDOW_BEFORE_MS) return null;
  if (diff > 0) return "due";
  if (-diff < ARRIVAL_LATE_AFTER_MS) return "arrival";
  if (-diff < ARRIVAL_OVERDUE_AFTER_MS) return "late";
  return "overdue";
}

/** Booked, past its start by more than the arrival window, and nobody has marked them in. */
export function isRunningLate(a: AppointmentFlagInput, nowMs: number): boolean {
  if (a.status === "cancelled" || a.status === "no_show") return false;
  const stage = a.stage ?? "booked";
  if (stage !== "booked") return false;
  const phase = phaseOf(new Date(a.starts_at).getTime(), nowMs);
  return phase === "late" || phase === "overdue";
}

/** Calendar days from today to the appointment day (negative when past). */
export function daysUntil(a: AppointmentFlagInput, nowMs: number): number {
  const start = new Date(a.starts_at);
  const now = new Date(nowMs);
  const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((startDay - today) / DAY_MS);
}

export type AppointmentFlags = {
  flags: Set<FlagKey>;
  /** For deposit_due: urgent inside the clinic's lead window, otherwise this_week. */
  depositUrgency: "urgent" | "this_week" | null;
  /** The chase-list kind for the dashboard, if any. */
  needsAction: boolean;
};

/**
 * Flags for one appointment. `depositLeadDays` comes from Settings (Payments
 * and deposits); a booking inside that window with nothing paid is urgent.
 */
export function appointmentFlags(
  a: AppointmentFlagInput,
  opts: { nowMs: number; depositLeadDays: number },
): AppointmentFlags {
  const flags = new Set<FlagKey>();
  let depositUrgency: AppointmentFlags["depositUrgency"] = null;
  const cancelled = a.status === "cancelled";
  const stage = a.stage ?? (a.status === "no_show" ? "no_show" : "booked");

  if (stage === "no_show" || a.status === "no_show") flags.add("no_show");

  if (!cancelled) {
    const pay = a.payment_status ?? "unpaid";
    const days = daysUntil(a, opts.nowMs);
    if (pay === "unpaid") {
      flags.add("unpaid");
      // Unpaid and still ahead of the day: the deposit is what is owed. On
      // the day itself, or afterwards, it reads as unpaid only.
      if (days > 0) {
        flags.add("deposit_due");
        depositUrgency = days <= opts.depositLeadDays ? "urgent" : "this_week";
      }
    } else if (pay === "deposit_paid") {
      flags.add("balance_due");
    }
    if (a.documents?.status !== "signed") flags.add("consent_due");
    if (a.details_incomplete) flags.add("details_incomplete");
    if (isRunningLate(a, opts.nowMs)) flags.add("running_late");
  }

  return { flags, depositUrgency, needsAction: flags.size > 0 };
}

/** The five types the diary's Needs action menu lists, in display order. */
export const NEEDS_ACTION_TYPES = [
  "unpaid",
  "deposit_due",
  "consent_due",
  "running_late",
  "details_incomplete",
] as const satisfies readonly FlagKey[];
export type NeedsActionType = (typeof NEEDS_ACTION_TYPES)[number];

/** Attention Needed This week Deposit due: at most this many clinic days after today. */
export const ATTENTION_DEPOSIT_WEEK_DAYS = 10;

/** How far ahead to load unpaid bookings for the Attention deposit lists. */
export function attentionDepositHorizonDays(leadDays: number) {
  return Math.max(leadDays, ATTENTION_DEPOSIT_WEEK_DAYS);
}

/** Urgent inside the lead window; This week after that, up to 10 clinic days; otherwise omit. */
export function attentionDepositUrgency(
  daysUntil: number,
  leadDays: number,
): "urgent" | "this_week" | null {
  if (daysUntil < 0 || daysUntil > ATTENTION_DEPOSIT_WEEK_DAYS) return null;
  return daysUntil <= leadDays ? "urgent" : "this_week";
}

/**
 * One patient, one Deposit due card. If they already owe a deposit inside
 * the urgent window, later unpaid bookings stay off This week.
 */
export function dropThisWeekDepositsIfUrgent<
  T extends { kind?: string; urgency?: string; patientId?: string | null },
>(items: T[]): T[] {
  const urgentPatients = new Set(
    items
      .filter((item) => item.kind === "deposit_due" && item.urgency === "urgent" && item.patientId)
      .map((item) => item.patientId as string),
  );
  if (urgentPatients.size === 0) return items;
  return items.filter(
    (item) =>
      item.kind !== "deposit_due" ||
      item.urgency !== "this_week" ||
      !item.patientId ||
      !urgentPatients.has(item.patientId),
  );
}
