import { clinicDayDiff } from "@/lib/clinic-time";

/**
 * Copy for a treatment plan's next step, shared by the journey board and the
 * Treatments tab plan card so both say the same thing about the same plan.
 */

type PlanStepInput = {
  nextMilestone: { title: string; dueDate?: string | null } | null;
  overdue: boolean;
  atRisk: boolean;
  riskReason: string | null;
  nextBookingAt?: string | null;
  /** The booking that is for this step, when there is one. */
  stepBookedAt?: string | null;
  /** What the patient's booking is for, when it is not this step. */
  otherBookingTreatment?: string | null;
  /** A booking for this step the patient did not turn up to. */
  noShowAt?: string | null;
};

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "Due 28 Sep" when nothing is booked, "3d overdue" once the step has slipped. */
export function dueLabel(dueDate?: string | null) {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T12:00:00`);
  const today = new Date();
  const days = Math.round(
    (due.getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).getTime()) /
      86400000,
  );
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due ${due.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
}

/** "Booked 28 Sep": the date is in the diary. */
export function bookedLabel(iso: string) {
  return `Booked ${shortDate(iso)}`;
}

/** "7 days overdue" for a slipped step; null when the step is not late. */
export function overdueLabel(plan: PlanStepInput) {
  const dueDate = plan.nextMilestone?.dueDate;
  if (!plan.overdue || !dueDate) return null;
  const due = new Date(`${dueDate}T12:00:00`);
  const today = new Date();
  const days = Math.max(
    1,
    Math.round(
      (new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12).getTime() -
        due.getTime()) /
        86400000,
    ),
  );
  return `${days} ${days === 1 ? "day" : "days"} overdue`;
}

/**
 * The booking *for this step*, else the due date. A booking for something else
 * is named by bookingMismatchLine instead, and an overdue step's lateness
 * lives on the step line.
 */
export function planDateLabel(plan: PlanStepInput) {
  if (plan.stepBookedAt) return bookedLabel(plan.stepBookedAt);
  if (plan.overdue) return null;
  return dueLabel(plan.nextMilestone?.dueDate);
}

/**
 * "23 Oct booking is for Profhilo, not this step" — so nobody reads the diary
 * entry as the chase being done. Null when the booking is for this step.
 */
export function bookingMismatchLine(plan: PlanStepInput) {
  if (!plan.nextBookingAt || !plan.otherBookingTreatment) return null;
  return `${shortDate(plan.nextBookingAt)} booking is for ${plan.otherBookingTreatment}, not this step`;
}

/** "Did not attend 24 Sep" for a step booking the patient missed. */
export function noShowLine(plan: PlanStepInput) {
  return plan.noShowAt ? `Did not attend ${shortDate(plan.noShowAt)}` : null;
}

export function riskChipLabel(plan: PlanStepInput) {
  if (plan.noShowAt) return "No show";
  if (plan.overdue) return "Overdue";
  if (plan.atRisk) return plan.riskReason ?? "At risk";
  return "On track";
}

/** The chip already says Overdue, so an overdue step is just its title. */
export function nextStepLine(plan: PlanStepInput) {
  const title = plan.nextMilestone?.title ?? "Next step";
  return plan.overdue ? title : `Next: ${title}`;
}

/** Attention Needed lists a skin-plan step that is overdue or due within this many clinic days. */
export const SKIN_PLAN_ATTENTION_DAYS = 14;

/** True when the next skin-plan step belongs on Attention needed. */
export function skinPlanDueForAttention(dueDate: string | null | undefined, todayKey: string) {
  if (!dueDate) return false;
  return clinicDayDiff(todayKey, dueDate) <= SKIN_PLAN_ATTENTION_DAYS;
}

/**
 * Attention Needed “Skin-plan treatment due”: what the diary is doing instead,
 * else the lateness, else the due date, else the chase.
 */
export function attentionDueSubtitle(plan: PlanStepInput) {
  const late = overdueLabel(plan);
  const mismatch = plan.otherBookingTreatment
    ? `Booked for ${plan.otherBookingTreatment}, not this step`
    : null;
  if (mismatch) return late ? `${mismatch} · ${late}` : mismatch;
  return late ?? dueLabel(plan.nextMilestone?.dueDate) ?? "No upcoming booking";
}
