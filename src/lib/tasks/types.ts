import { clinicDayDiff, clinicDayKey } from "@/lib/clinic-time";

/**
 * Shared vocabulary for the Tasks page, the patient drawer, the dashboard
 * aggregate and the server functions. Pure: no fetching, no React.
 *
 * "The Patients page is for seeing, the Tasks page is for doing": every open
 * task is one thing somebody has to do for one patient, and completing it once
 * clears it everywhere.
 */

export type TaskType =
  | "chase_booking"
  | "recall"
  | "question"
  | "send_offer"
  | "plan_support"
  | "rebook_no_show"
  | "custom";

export type TaskStatus = "open" | "snoozed" | "done" | "auto_closed" | "cancelled";
export type TaskSource = "rule" | "portal" | "manual";
export type TaskBucket = "overdue" | "today" | "week" | "later";
export type PoolRole = "front_desk" | "practitioner" | "manager";
export type TaskRole = "owner" | "manager" | "practitioner" | "front_desk";

export type TaskPrimaryAction =
  "call" | "reply" | "send_link" | "approve" | "review" | "message" | "send";

export const TASK_TYPES: readonly TaskType[] = [
  "chase_booking",
  "rebook_no_show",
  "question",
  "recall",
  "send_offer",
  "plan_support",
  "custom",
];

/** Chip colours reuse the existing semantic families; no-show is the one new one. */
export const TASK_TYPE_META: Record<
  TaskType,
  { label: string; chip: string; dot: string; action: TaskPrimaryAction; actionLabel: string }
> = {
  chase_booking: {
    label: "Chase booking",
    chip: "bg-warning-bg text-warning-ink",
    dot: "bg-warning",
    action: "call",
    actionLabel: "Call",
  },
  recall: {
    label: "Recall",
    chip: "bg-sky-bg text-sky-ink",
    dot: "bg-sky",
    action: "call",
    actionLabel: "Call",
  },
  question: {
    label: "Urgent question",
    chip: "bg-destructive-bg text-destructive-ink",
    dot: "bg-destructive",
    action: "reply",
    actionLabel: "Reply",
  },
  send_offer: {
    label: "Send offer",
    chip: "bg-accent-soft text-accent-ink",
    dot: "bg-accent-deep",
    action: "approve",
    actionLabel: "Approve",
  },
  plan_support: {
    label: "Plan support",
    chip: "bg-success-bg text-success-ink",
    dot: "bg-success",
    action: "review",
    actionLabel: "Review",
  },
  rebook_no_show: {
    label: "Rebook no-show",
    chip: "bg-noshow-bg text-noshow-ink",
    dot: "bg-noshow",
    action: "call",
    actionLabel: "Call",
  },
  custom: {
    label: "Task",
    chip: "bg-glass-2 text-ink-2",
    dot: "bg-ink-3",
    action: "message",
    actionLabel: "Open",
  },
};

export type TaskView =
  | "mine"
  | "team"
  | "unassigned"
  | "pool"
  | "auto"
  | "done"
  | "assigned"
  | "questions"
  | "patients_with_others"
  | "queue"
  | "retries"
  | "person";

export const TASK_VIEWS: readonly TaskView[] = [
  "mine",
  "team",
  "unassigned",
  "pool",
  "auto",
  "done",
  "assigned",
  "questions",
  "patients_with_others",
  "queue",
  "retries",
  "person",
];

/** Left-nav views per role, in display order; the first is the default. */
export const ROLE_VIEWS: Record<TaskRole, readonly { view: TaskView; label: string }[]> = {
  owner: [
    { view: "mine", label: "My tasks" },
    { view: "team", label: "Whole team" },
    { view: "unassigned", label: "Unassigned" },
    { view: "pool", label: "Front desk pool" },
    { view: "auto", label: "Created by rules" },
    { view: "done", label: "Done today" },
  ],
  manager: [
    { view: "mine", label: "My tasks" },
    { view: "team", label: "Whole team" },
    { view: "unassigned", label: "Unassigned" },
    { view: "pool", label: "Front desk pool" },
    { view: "auto", label: "Created by rules" },
    { view: "done", label: "Done today" },
  ],
  practitioner: [
    { view: "assigned", label: "Assigned to me" },
    { view: "questions", label: "Clinical questions" },
    { view: "patients_with_others", label: "My patients, with others" },
    { view: "done", label: "Done today" },
  ],
  front_desk: [
    { view: "queue", label: "My queue" },
    { view: "pool", label: "Front desk pool" },
    { view: "retries", label: "Retries due today" },
    { view: "done", label: "Done today" },
  ],
};

export function isTaskView(value: unknown): value is TaskView {
  return typeof value === "string" && (TASK_VIEWS as readonly string[]).includes(value);
}

export function isTaskType(value: unknown): value is TaskType {
  return typeof value === "string" && (TASK_TYPES as readonly string[]).includes(value);
}

/** Front desk logs at most this many contact attempts; the third miss escalates to the owner. */
export const MAX_CONTACT_ATTEMPTS = 3;
/** Clinical questions carry a reply target measured from the message. */
export const QUESTION_REPLY_HOURS = 4;
/** A missed call is retried after this many clinic days. */
export const RETRY_AFTER_DAYS = 2;

export const CONTACT_TASK_TYPES: readonly TaskType[] = [
  "chase_booking",
  "recall",
  "rebook_no_show",
];

export function isContactTask(type: TaskType) {
  return CONTACT_TASK_TYPES.includes(type);
}

/** Days from a clinic day key to the Sunday that ends its week (0 on a Sunday). */
function daysToSunday(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dow = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return (7 - dow) % 7;
}

/**
 * Which group a due instant falls in on the clinic's calendar: Overdue, Today,
 * Later this week (up to Sunday) or Later.
 */
export function dueBucket(dueAt: string | null | undefined, now: Date = new Date()): TaskBucket {
  if (!dueAt) return "later";
  const todayKey = clinicDayKey(now);
  const dueKey = clinicDayKey(new Date(dueAt));
  const diff = clinicDayDiff(todayKey, dueKey);
  if (diff < 0) return "overdue";
  if (diff === 0) return new Date(dueAt).getTime() < now.getTime() ? "overdue" : "today";
  if (diff <= daysToSunday(todayKey)) return "week";
  return "later";
}

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function shortDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  });
}

/**
 * The due column: "2 days late", "Escalated", "3h 20m left", "Today", "Thu",
 * "Before 5 Oct". Time-boxed tasks (questions) count down within the day.
 */
export function taskDueLabel(
  input: {
    dueAt: string | null | undefined;
    type?: TaskType;
    escalated?: boolean;
    status?: TaskStatus;
    resolution?: string | null;
  },
  now: Date = new Date(),
): string {
  if (input.status === "done" || input.status === "auto_closed") {
    return input.resolution ? resolutionLabel(input.resolution) : "Done";
  }
  if (input.escalated) return "Escalated";
  if (!input.dueAt) return "No due date";
  const due = new Date(input.dueAt);
  const ms = due.getTime() - now.getTime();
  const bucket = dueBucket(input.dueAt, now);
  if (bucket === "overdue") {
    const days = clinicDayDiff(clinicDayKey(due), clinicDayKey(now));
    if (days <= 0) return "Late today";
    return `${days} ${days === 1 ? "day" : "days"} late`;
  }
  if (input.type === "question" && ms < 24 * 3_600_000) {
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m left` : `${m}m left`;
  }
  if (bucket === "today") return "Today";
  const dayDiff = clinicDayDiff(clinicDayKey(now), clinicDayKey(due));
  if (dayDiff === 1) return "Tomorrow";
  if (bucket === "week") return WEEKDAY[due.getDay()] ?? shortDay(input.dueAt);
  return `Before ${shortDay(input.dueAt)}`;
}

const RESOLUTION_LABEL: Record<string, string> = {
  booked: "Booked",
  will_book: "Spoke, will book",
  no_answer: "No answer",
  voicemail: "Left voicemail",
  not_continuing: "Not continuing plan",
  replied: "Replied",
  approved: "Approved",
  handled: "Handled",
  reviewed: "Reviewed",
  sent: "Sent",
  auto_booked: "Closed: patient booked",
  auto_replied: "Closed: patient replied",
  auto_resolved: "Closed automatically",
};

export function resolutionLabel(resolution: string) {
  return RESOLUTION_LABEL[resolution] ?? resolution.replace(/_/g, " ");
}

/**
 * Who a task should go to by default. Clinical work goes to the patient's
 * practitioner, offers to the owner, chasing to the front desk pool.
 */
export function suggestedAssignee(input: {
  type: TaskType;
  patientPractitionerId: string | null | undefined;
  ownerId: string | null | undefined;
}): { assigneeId: string | null; assigneeRole: PoolRole | null } {
  switch (input.type) {
    case "question":
    case "plan_support":
      return input.patientPractitionerId
        ? { assigneeId: input.patientPractitionerId, assigneeRole: null }
        : { assigneeId: null, assigneeRole: "practitioner" };
    case "send_offer":
      return input.ownerId
        ? { assigneeId: input.ownerId, assigneeRole: null }
        : { assigneeId: null, assigneeRole: "manager" };
    case "chase_booking":
    case "recall":
    case "rebook_no_show":
    case "custom":
      return { assigneeId: null, assigneeRole: "front_desk" };
  }
}

/** Why a teammate is suggested, for the Who list in the Assign dialog. */
export function suggestionReason(type: TaskType): string {
  switch (type) {
    case "question":
    case "plan_support":
      return "Patient's practitioner";
    case "send_offer":
      return "Approves offers";
    default:
      return "Handles booking chases";
  }
}

/** Due presets offered by the delegate panel and the Assign dialog. */
export type DuePreset = "4h" | "today" | "tomorrow" | "3d";

export const DUE_PRESETS: readonly { key: DuePreset; label: string }[] = [
  { key: "4h", label: "Within 4 hours" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "3d", label: "In 3 days" },
];

/** End of the clinic day (18:00 London) `days` days from now, or now + 4 h. */
export function dueAtForPreset(preset: DuePreset, now: Date = new Date()): string {
  if (preset === "4h") return new Date(now.getTime() + 4 * 3_600_000).toISOString();
  const days = preset === "today" ? 0 : preset === "tomorrow" ? 1 : 3;
  const key = clinicDayKey(new Date(now.getTime() + days * 86_400_000));
  // 18:00 in Europe/London; the offset is resolved from that day's noon.
  const noonUTC = new Date(`${key}T12:00:00Z`);
  const londonHour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(noonUTC),
  );
  const offsetHours = londonHour - 12;
  return new Date(Date.parse(`${key}T18:00:00Z`) - offsetHours * 3_600_000).toISOString();
}

/** "Rule · Skin plan step overdue", "Portal · Urgent portal question", "Manual · Assigned by Dr Amara Osei". */
export function taskSourceLine(source: TaskSource, sourceLabel: string | null | undefined) {
  const prefix = source === "rule" ? "Rule" : source === "portal" ? "Portal" : "Manual";
  return sourceLabel ? `${prefix} · ${sourceLabel}` : prefix;
}
