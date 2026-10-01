import { clinicDayDiff, clinicDayKey } from "@/lib/clinic-time";
import type { TaskType } from "@/lib/tasks/types";

/**
 * Derivations for the Patients → Records table and its drawer. Pure: the
 * server hands over the facts (last treatment, next booking, next due date,
 * active plan, open tasks, portal signals) and these turn them into the type
 * line, the calm-by-default next-treatment cell, the plan bar and the
 * suggested next step.
 */

export type PatientType = "skin_plan" | "regular" | "new";

export const PATIENT_TYPE_META: Record<
  PatientType,
  { label: string; dot: string; ink: string; pill: string }
> = {
  skin_plan: {
    label: "Skin plan",
    dot: "bg-accent-deep",
    ink: "text-accent-ink",
    pill: "bg-accent-soft text-accent-ink",
  },
  regular: { label: "Regular", dot: "bg-ink-3", ink: "text-ink-2", pill: "bg-glass-2 text-ink-2" },
  new: { label: "New patient", dot: "bg-sky", ink: "text-sky-ink", pill: "bg-sky-bg text-sky-ink" },
};

/** Rebook window: unbooked treatments due inside this many days read loud. */
export const REBOOK_WINDOW_DAYS = 14;

export type PlanFacts = {
  id: string;
  name: string;
  done: number;
  total: number;
  nextStep: string | null;
  /** Set when the next step is late and unbooked. */
  overdue: boolean;
};

export function patientType(input: {
  plan: PlanFacts | null | undefined;
  visitCount: number;
}): PatientType {
  return patientTypeFrom(Boolean(input.plan), input.visitCount > 0);
}

/** The same taxonomy from bare facts, for places that only know "has a plan" and "has visited". */
export function patientTypeFrom(hasPlan: boolean, hasVisited: boolean): PatientType {
  if (hasPlan) return "skin_plan";
  return hasVisited ? "regular" : "new";
}

/** "Skin plan · 5/8", "Regular", "New patient", with " · Inactive" appended. */
export function typeLine(type: PatientType, plan: PlanFacts | null | undefined, inactive: boolean) {
  const base =
    type === "skin_plan" && plan
      ? `${PATIENT_TYPE_META.skin_plan.label} · ${plan.done}/${plan.total}`
      : PATIENT_TYPE_META[type].label;
  return inactive ? `${base} · Inactive` : base;
}

/** "5 days ago", "5 wks ago", "4 months ago", "2 years ago". */
export function relativeAgo(iso: string, now: Date = new Date()): string {
  const days = Math.max(0, clinicDayDiff(clinicDayKey(new Date(iso)), clinicDayKey(now)));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} wks ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const years = Math.round(days / 365);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function monthYear(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export type NextTreatmentState =
  | { kind: "booked"; at: string; name: string; main: string; sub: string; tone: "calm" }
  | {
      kind: "due";
      dueDate: string;
      name: string;
      days: number;
      main: string;
      sub: string;
      tone: "loud" | "calm";
    }
  | {
      kind: "overdue";
      dueDate: string;
      name: string;
      days: number;
      main: string;
      sub: string;
      tone: "overdue";
    }
  | { kind: "later"; dueDate: string; name: string; main: string; sub: string; tone: "muted" }
  | { kind: "none"; main: string; sub: string; tone: "muted" };

/**
 * Calm by default, loud by exception. Booked: "23 Oct · Mesotherapy #2" /
 * "Booked". Due within the window and unbooked: "Due in 3 days" in accent ink.
 * Overdue: "95 days overdue" in destructive ink. Later: "Due Aug 2027".
 */
export function nextTreatmentState(
  input: {
    nextAppointment:
      | { starts_at: string; treatment_name: string; treatment_number?: number | null }
      | null
      | undefined;
    nextDue: { next_due_at: string | null; name: string } | null | undefined;
    /** The plan's next step when there is an active plan; wins over the treatment due date. */
    planStep?: { title: string; dueDate: string | null; overdue: boolean } | null;
  },
  now: Date = new Date(),
): NextTreatmentState {
  if (input.nextAppointment) {
    const a = input.nextAppointment;
    const name = a.treatment_number
      ? `${a.treatment_name} #${a.treatment_number}`
      : a.treatment_name;
    return {
      kind: "booked",
      at: a.starts_at,
      name,
      main: `${shortDate(a.starts_at)} · ${name}`,
      sub: "Booked",
      tone: "calm",
    };
  }
  const todayKey = clinicDayKey(now);
  const candidate = input.planStep?.dueDate
    ? { name: input.planStep.title, dueDate: input.planStep.dueDate }
    : input.nextDue?.next_due_at
      ? { name: input.nextDue.name, dueDate: input.nextDue.next_due_at.slice(0, 10) }
      : null;
  if (!candidate) return { kind: "none", main: "—", sub: "Nothing planned", tone: "muted" };
  const days = clinicDayDiff(todayKey, candidate.dueDate);
  if (days < 0) {
    const late = -days;
    return {
      kind: "overdue",
      dueDate: candidate.dueDate,
      name: candidate.name,
      days: late,
      main: `${late} ${late === 1 ? "day" : "days"} overdue`,
      sub: `${candidate.name} · not booked`,
      tone: "overdue",
    };
  }
  if (days <= REBOOK_WINDOW_DAYS) {
    const main = days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : `Due in ${days} days`;
    return {
      kind: "due",
      dueDate: candidate.dueDate,
      name: candidate.name,
      days,
      main,
      sub: `${candidate.name} · not booked`,
      tone: "loud",
    };
  }
  if (days <= 90) {
    return {
      kind: "due",
      dueDate: candidate.dueDate,
      name: candidate.name,
      days,
      main: `Due ${shortDate(`${candidate.dueDate}T12:00:00`)}`,
      sub: `${candidate.name} · not booked`,
      tone: "calm",
    };
  }
  return {
    kind: "later",
    dueDate: candidate.dueDate,
    name: candidate.name,
    main: `Due ${monthYear(`${candidate.dueDate}T12:00:00`)}`,
    sub: candidate.name,
    tone: "muted",
  };
}

/** One 5px segment per plan step: done, current (pink when overdue), future. */
export function planSegments(
  plan: PlanFacts,
): Array<"done" | "current" | "current_overdue" | "future"> {
  return Array.from({ length: Math.max(0, plan.total) }, (_, j) =>
    j < plan.done
      ? "done"
      : j === plan.done
        ? plan.overdue
          ? "current_overdue"
          : "current"
        : "future",
  );
}

export type SuggestionAction =
  | "send_booking_link"
  | "call"
  | "assign"
  | "approve_offer"
  | "open_task"
  | "message"
  | "book"
  | "review_photos"
  | "reactivate"
  | "send_form_reminder";

export type Suggestion = {
  text: string;
  actions: Array<{ label: string; action: SuggestionAction }>;
};

export type PortalSignal =
  | { kind: "opened_link"; when: string }
  | { kind: "urgent_question"; when: string; preview: string }
  | { kind: "photos_uploaded"; count: number; when: string }
  | { kind: "form_incomplete"; percent: number }
  | { kind: "quiet"; days: number }
  | { kind: "replied"; when: string };

/**
 * The sentence at the top of the drawer, generated from the patient's state.
 * The first matching rule wins; the drawer shows at most two actions.
 */
export function suggestedNextStep(input: {
  firstName: string;
  pronoun?: "She" | "He" | "They";
  inactive: boolean;
  type: PatientType;
  next: NextTreatmentState;
  plan: PlanFacts | null | undefined;
  lastTreatment: { name: string; at: string } | null | undefined;
  noShowAt?: string | null;
  openTasks: Array<{ type: TaskType; assigneeName: string | null; dueLabel: string }>;
  pendingOffer?: { headline: string } | null;
  portal?: PortalSignal | null;
  now?: Date;
}): Suggestion {
  const now = input.now ?? new Date();
  const who = input.pronoun ?? "They";
  const has = (t: TaskType) => input.openTasks.find((x) => x.type === t);

  if (input.inactive) {
    return {
      text: `Marked inactive${input.lastTreatment ? `; last seen ${relativeAgo(input.lastTreatment.at, now)}` : ""}. Nothing to do.`,
      actions: [{ label: "Reactivate", action: "reactivate" }],
    };
  }

  const question = has("question");
  if (question) {
    return {
      text: `${input.firstName} asked a question in the portal${input.portal?.kind === "urgent_question" ? `: “${input.portal.preview}”` : ""}. ${question.assigneeName ?? "Someone"} has ${question.dueLabel.toLowerCase()} on the reply target.`,
      actions: [
        { label: "Open question", action: "open_task" },
        { label: "Reassign", action: "assign" },
      ],
    };
  }

  if (input.noShowAt) {
    return {
      text: `Missed ${input.plan?.nextStep ? input.plan.nextStep.toLowerCase() : "the last booking"} on ${shortDate(input.noShowAt)}${input.portal?.kind === "quiet" ? " and hasn't replied since" : ""}. A call usually works better after a no-show.`,
      actions: [
        { label: "Call now", action: "call" },
        { label: "Rebook", action: "book" },
      ],
    };
  }

  if (input.pendingOffer) {
    return {
      text: `${input.lastTreatment ? `${relativeAgo(input.lastTreatment.at, now).replace(" ago", "")} since the last visit. ` : ""}A win-back offer (“${input.pendingOffer.headline}”) is drafted and waiting for approval.`,
      actions: [
        { label: "Approve offer", action: "approve_offer" },
        { label: "Edit offer", action: "message" },
      ],
    };
  }

  if (input.portal?.kind === "photos_uploaded") {
    return {
      text: `Uploaded ${input.portal.count} progress photo${input.portal.count === 1 ? "" : "s"} in the portal ${relativeAgo(input.portal.when, now).toLowerCase()}. Review them before the next session.`,
      actions: [
        { label: "Review photos", action: "review_photos" },
        { label: "Message", action: "message" },
      ],
    };
  }

  if (input.next.kind === "overdue") {
    const chased = has("chase_booking") ?? has("recall");
    const link =
      input.portal?.kind === "opened_link"
        ? ` ${who} opened the booking link ${relativeAgo(input.portal.when, now).toLowerCase()} but didn't finish.`
        : "";
    return {
      text: `${input.next.name} is ${input.next.main.toLowerCase()} and nothing is booked.${link}${chased ? ` ${chased.assigneeName ?? "Front desk"} is chasing (${chased.dueLabel.toLowerCase()}).` : ""}`,
      actions: [
        { label: "Call now", action: "call" },
        {
          label: chased ? "Open task" : "Send booking link",
          action: chased ? "open_task" : "send_booking_link",
        },
      ],
    };
  }

  if (input.next.kind === "due" && input.next.tone === "loud") {
    const link =
      input.portal?.kind === "opened_link"
        ? ` ${who} opened the booking link in the portal ${relativeAgo(input.portal.when, now).toLowerCase()} but didn't finish.`
        : "";
    return {
      text: `${input.next.name} is ${input.next.main.toLowerCase()} and nothing is booked.${link}`,
      actions: [
        { label: "Send booking link", action: "send_booking_link" },
        { label: "Call now", action: "call" },
      ],
    };
  }

  if (input.type === "new" && input.next.kind === "booked") {
    const form =
      input.portal?.kind === "form_incomplete"
        ? ` The medical form is ${input.portal.percent}% complete in the portal.`
        : "";
    return {
      text: `New patient with a consultation on ${shortDate(input.next.at)}.${form}`,
      actions: form
        ? [
            { label: "Send form reminder", action: "send_form_reminder" },
            { label: "Message", action: "message" },
          ]
        : [{ label: "Message", action: "message" }],
    };
  }

  const support = has("plan_support");
  if (support) {
    return {
      text: `${support.assigneeName ?? "The practitioner"} has a follow-up ${support.dueLabel.toLowerCase() === "today" ? "today" : `on ${support.dueLabel}`}.`,
      actions: [
        { label: "Open task", action: "open_task" },
        { label: "Message", action: "message" },
      ],
    };
  }

  if (input.next.kind === "booked") {
    return {
      text: `All set: ${input.next.name} is booked for ${shortDate(input.next.at)}. A reminder goes out automatically 48h before.`,
      actions: [
        { label: "Message", action: "message" },
        { label: "Add task", action: "assign" },
      ],
    };
  }

  if (input.next.kind === "due") {
    return {
      text: `Rebook window opens soon: ${input.next.name} is due ${shortDate(`${input.next.dueDate}T12:00:00`)}. An automatic reminder goes out first, so no task is needed unless ${who.toLowerCase()} ${who === "They" ? "don't" : "doesn't"} book.`,
      actions: [
        { label: "Send now instead", action: "send_booking_link" },
        { label: "Message", action: "message" },
      ],
    };
  }

  if (input.next.kind === "later") {
    return {
      text: `Next ${input.next.name} is due ${monthYear(`${input.next.dueDate}T12:00:00`)}. Nothing to do yet.`,
      actions: [
        { label: "Message", action: "message" },
        { label: "Add task", action: "assign" },
      ],
    };
  }

  return {
    text: input.lastTreatment
      ? "Nothing planned after the last visit. Worth a check-in."
      : "No treatments yet.",
    actions: [
      { label: "Message", action: "message" },
      { label: "Add task", action: "assign" },
    ],
  };
}
