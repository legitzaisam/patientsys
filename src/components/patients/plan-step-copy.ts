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

/**
 * An overdue step keeps its due copy even when a visit is booked, so staff can
 * still see how late it is; the booking is added, not swapped in.
 */
export function planDateLabel(plan: PlanStepInput) {
  const booked = plan.nextBookingAt ? bookedLabel(plan.nextBookingAt) : null;
  if (plan.overdue) {
    const due = dueLabel(plan.nextMilestone?.dueDate);
    return [due, booked].filter(Boolean).join(" · ") || null;
  }
  return booked ?? dueLabel(plan.nextMilestone?.dueDate);
}

export function riskChipLabel(plan: PlanStepInput) {
  if (plan.overdue) return "Overdue";
  if (plan.atRisk) return plan.riskReason ?? "At risk";
  return "On track";
}

export function nextStepLine(plan: PlanStepInput) {
  const title = plan.nextMilestone?.title ?? "next step";
  return plan.overdue ? `Overdue: ${title}` : `Next: ${title}`;
}
