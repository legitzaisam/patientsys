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
};

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
  return `Booked ${new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`;
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
 * The booking if there is one, else the due date. An overdue step's lateness
 * lives on the step line, so here it only gets its booking.
 */
export function planDateLabel(plan: PlanStepInput) {
  const booked = plan.nextBookingAt ? bookedLabel(plan.nextBookingAt) : null;
  if (plan.overdue) return booked;
  return booked ?? dueLabel(plan.nextMilestone?.dueDate);
}

export function riskChipLabel(plan: PlanStepInput) {
  if (plan.overdue) return "Overdue";
  if (plan.atRisk) return plan.riskReason ?? "At risk";
  return "On track";
}

/** The chip already says Overdue, so an overdue step is just its title. */
export function nextStepLine(plan: PlanStepInput) {
  const title = plan.nextMilestone?.title ?? "Next step";
  return plan.overdue ? title : `Next: ${title}`;
}
