/**
 * Whether a booking in the diary is actually *for* a treatment plan's next
 * step. The journey board, the Treatments tab plan card and the dashboard's
 * Attention Needed list all ask this question, so they all call this.
 *
 * Decisions (28 Sep 2026):
 * - A booking counts as the step's when the Book button linked it
 *   (plan_milestones.appointment_id) or, for a session step, when its
 *   treatment matches the plan's treatment.
 * - A step with its own live booking is not overdue, however late the due
 *   date. A booking for something else leaves the step overdue and is named
 *   on the plan card so nobody thinks the chase is done.
 * - Not turning up is a no show and stays one until that booking is
 *   rescheduled (back to booked) or cancelled. Cancelling brings back overdue.
 */

/** How far back a missed step booking still counts as an open no show. */
export const NO_SHOW_LOOKBACK_DAYS = 90;

/** The ISO cut-off for that window, for the appointment queries. */
export function noShowLookbackISO(now = new Date()) {
  return new Date(now.getTime() - NO_SHOW_LOOKBACK_DAYS * 86_400_000).toISOString();
}

export type PlanStepAppointment = {
  id: string;
  starts_at: string;
  status: string | null;
  catalogue_id?: string | null;
  treatment_name?: string | null;
};

export type PlanStepMilestone = {
  id: string;
  kind?: string | null;
  dueDate?: string | null;
  appointmentId?: string | null;
};

export type PlanStepState = {
  /** The live booking that fulfils this step. */
  stepBookedAt: string | null;
  /** The patient's earliest live booking, whatever it is for. */
  nextBookingAt: string | null;
  /** The treatment of that booking, set only when it is not this step's. */
  otherBookingTreatment: string | null;
  /** A booking for this step the patient did not turn up to. */
  noShowAt: string | null;
  /** Late and unbooked: a live booking for the step clears it. */
  overdue: boolean;
};

export function planStepState(input: {
  nextMilestone: PlanStepMilestone | null;
  planCatalogueId?: string | null;
  /** This patient's appointments; past ones are needed for the no show. */
  appointments: readonly PlanStepAppointment[];
  /** Clinic day key (YYYY-MM-DD) used to judge the due date. */
  todayKey: string;
  nowISO: string;
}): PlanStepState {
  const { nextMilestone, planCatalogueId, appointments, todayKey, nowISO } = input;

  const fulfilsStep = (appt: PlanStepAppointment) => {
    if (!nextMilestone) return false;
    if (nextMilestone.appointmentId && appt.id === nextMilestone.appointmentId) return true;
    if ((nextMilestone.kind ?? "session") !== "session") return false;
    return Boolean(planCatalogueId) && appt.catalogue_id === planCatalogueId;
  };

  let stepBookedAt: string | null = null;
  let nextBooking: PlanStepAppointment | null = null;
  let noShow: PlanStepAppointment | null = null;

  for (const appt of appointments) {
    if (appt.status === "booked" && appt.starts_at >= nowISO) {
      if (!nextBooking || appt.starts_at < nextBooking.starts_at) nextBooking = appt;
      if (fulfilsStep(appt) && (!stepBookedAt || appt.starts_at < stepBookedAt)) {
        stepBookedAt = appt.starts_at;
      }
      continue;
    }
    // The most recent one they missed; an older miss is water under the bridge.
    if (appt.status === "no_show" && fulfilsStep(appt)) {
      if (!noShow || appt.starts_at > noShow.starts_at) noShow = appt;
    }
  }

  const bookingIsForStep = Boolean(nextBooking && fulfilsStep(nextBooking));
  const dueDate = nextMilestone?.dueDate ?? null;

  return {
    stepBookedAt,
    nextBookingAt: nextBooking?.starts_at ?? null,
    otherBookingTreatment:
      nextBooking && !bookingIsForStep ? (nextBooking.treatment_name ?? null) : null,
    // Rebooking the same row puts it back to booked, which clears the tag.
    noShowAt: stepBookedAt ? null : (noShow?.starts_at ?? null),
    overdue: Boolean(dueDate && dueDate < todayKey && !stepBookedAt),
  };
}
