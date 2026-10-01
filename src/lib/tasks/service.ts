import { clinicDayDiff, clinicDayKey } from "@/lib/clinic-time";
import type { PatientType } from "@/lib/patients/records-summary";
import {
  dueBucket,
  isContactTask,
  MAX_CONTACT_ATTEMPTS,
  RETRY_AFTER_DAYS,
  TASK_TYPE_META,
  taskDueLabel,
  type PoolRole,
  type TaskBucket,
  type TaskRole,
  type TaskSource,
  type TaskStatus,
  type TaskType,
  type TaskView,
} from "@/lib/tasks/types";

/**
 * The task rules that do not depend on where the rows live. The production
 * handlers read rows from Supabase and the demo handlers from the fixture
 * arrays; both hand them here to decide who may see what, which view a task
 * belongs to, what a write changes and how the page's summary adds up. Every
 * write returns a `patch` and the `event` to record, so Undo can put the
 * previous state back.
 */

export type TaskRow = {
  id: string;
  clinic_id: string;
  patient_id: string;
  type: TaskType;
  title: string;
  context: string | null;
  source: TaskSource;
  source_label: string | null;
  rule_id: string | null;
  dedupe_key: string | null;
  assignee_id: string | null;
  assignee_role: string | null;
  created_by: string | null;
  note: string | null;
  priority: number;
  due_at: string | null;
  escalate_at: string | null;
  escalated_at: string | null;
  escalated_to: string | null;
  attempts: number;
  next_retry_at: string | null;
  snoozed_until: string | null;
  status: TaskStatus;
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  auto_close: boolean;
  links: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type TaskViewer = {
  userId: string;
  roles: readonly string[];
  isManager: boolean;
  isOwner?: boolean;
  isAdmin?: boolean;
  permissions?: readonly string[];
};

export type TeamMemberLike = {
  id: string;
  fullName: string;
  role: TaskRole;
};

export type PatientLite = {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  phone?: string | null;
  /** The practitioner who treats them (plan practitioner, else last/next booking). */
  practitionerId: string | null;
  /** Skin plan, regular or new — the same taxonomy as the Records table. */
  patientType: PatientType;
};

export type TaskEventInput = {
  kind: string;
  data: Record<string, unknown>;
};

const OPEN: readonly TaskStatus[] = ["open", "snoozed"];

export function isOpen(t: Pick<TaskRow, "status">) {
  return OPEN.includes(t.status);
}

export function taskRole(viewer: TaskViewer): TaskRole {
  if (viewer.isOwner || viewer.isAdmin) return "owner";
  if (viewer.isManager) return "manager";
  if (viewer.roles.includes("practitioner")) return "practitioner";
  return "front_desk";
}

function isFrontDesk(viewer: TaskViewer) {
  return (
    !viewer.isManager &&
    viewer.roles.includes("front_desk") &&
    !viewer.roles.includes("practitioner")
  );
}

/**
 * Who may see a task at all. Managers see everything. A practitioner sees
 * what is assigned to them, what is pooled for practitioners and every task
 * on their own patients. Front desk sees their own, the front-desk pool and
 * unassigned chases; clinical questions never reach them.
 */
export function canSeeTask(
  t: TaskRow,
  viewer: TaskViewer,
  patientPractitioner: (patientId: string) => string | null,
): boolean {
  if (viewer.isManager) return true;
  if (t.assignee_id === viewer.userId) return true;
  if (isFrontDesk(viewer)) {
    if (t.type === "question") return false;
    if (t.assignee_id) return false;
    return t.assignee_role === "front_desk" || t.assignee_role === null;
  }
  if (viewer.roles.includes("practitioner")) {
    if (!t.assignee_id && t.assignee_role === "practitioner") return true;
    return patientPractitioner(t.patient_id) === viewer.userId;
  }
  return false;
}

export function inView(
  t: TaskRow,
  view: TaskView,
  viewer: TaskViewer,
  personId: string | null,
  patientPractitioner: (patientId: string) => string | null,
  now: Date,
): boolean {
  const open = isOpen(t);
  const todayKey = clinicDayKey(now);
  switch (view) {
    case "mine":
    case "assigned":
    case "queue":
      return open && t.assignee_id === viewer.userId;
    case "team":
      return open;
    case "unassigned":
      return open && !t.assignee_id && !t.assignee_role;
    case "pool":
      return open && !t.assignee_id && t.assignee_role === "front_desk";
    case "auto":
      return open && t.source !== "manual";
    case "done":
      return (
        (t.status === "done" || t.status === "auto_closed") &&
        !!t.resolved_at &&
        clinicDayKey(new Date(t.resolved_at)) === todayKey &&
        (viewer.isManager ||
          t.assignee_id === viewer.userId ||
          t.resolved_by === viewer.userId ||
          patientPractitioner(t.patient_id) === viewer.userId)
      );
    case "questions":
      return open && t.type === "question" && t.assignee_id === viewer.userId;
    case "patients_with_others":
      return (
        open &&
        patientPractitioner(t.patient_id) === viewer.userId &&
        t.assignee_id !== viewer.userId
      );
    case "retries":
      return (
        open &&
        t.assignee_id === viewer.userId &&
        !!t.next_retry_at &&
        clinicDayKey(new Date(t.next_retry_at)) <= todayKey
      );
    case "person":
      return open && !!personId && t.assignee_id === personId;
  }
}

export type TaskGroup = { bucket: TaskBucket; label: string; tasks: TaskView_[] };

export type TaskView_ = {
  id: string;
  patient: {
    id: string;
    name: string;
    firstName: string;
    avatarUrl: string | null;
    phone: string | null;
    practitionerId: string | null;
    /** Null when the patient record could not be loaded. */
    patientType: PatientType | null;
  };
  type: TaskType;
  typeLabel: string;
  title: string;
  context: string | null;
  source: TaskSource;
  sourceLabel: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeRole: PoolRole | null;
  createdBy: string | null;
  note: string | null;
  dueAt: string | null;
  dueLabel: string;
  bucket: TaskBucket;
  attempts: number;
  nextRetryAt: string | null;
  escalated: boolean;
  status: TaskStatus;
  resolution: string | null;
  resolvedAt: string | null;
  priority: number;
  links: Record<string, string | null>;
  createdAt: string;
  /** What the viewer may do with it. */
  can: {
    select: boolean;
    delegate: boolean;
    handoff: boolean;
    claim: boolean;
    takeOver: boolean;
    complete: boolean;
    attempt: boolean;
    escalateToClinician: boolean;
    snooze: boolean;
  };
};

/** Only the id-like values of `links` travel to the client. */
function serialisableLinks(
  links: Record<string, unknown> | null | undefined,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(links ?? {})) {
    if (v === null || v === undefined) out[k] = null;
    else if (typeof v === "string" || typeof v === "number") out[k] = String(v);
  }
  return out;
}

export function shapeTask(
  t: TaskRow,
  viewer: TaskViewer,
  patient: PatientLite | null,
  nameOf: (id: string | null) => string | null,
  now: Date,
): TaskView_ {
  const role = taskRole(viewer);
  const open = isOpen(t);
  const mine = t.assignee_id === viewer.userId;
  const pooled = !t.assignee_id;
  const frontDeskPool = pooled && (t.assignee_role === "front_desk" || t.assignee_role === null);
  const ownPatient = patient?.practitionerId === viewer.userId;
  const manager = role === "owner" || role === "manager";
  const practitioner = role === "practitioner";
  const frontDesk = role === "front_desk";
  return {
    id: t.id,
    patient: {
      id: t.patient_id,
      name: patient ? `${patient.first_name} ${patient.last_name}`.trim() : "Patient",
      firstName: patient?.first_name ?? "Patient",
      avatarUrl: patient?.avatar_url ?? null,
      phone: patient?.phone ?? null,
      practitionerId: patient?.practitionerId ?? null,
      patientType: patient?.patientType ?? null,
    },
    type: t.type,
    typeLabel: TASK_TYPE_META[t.type].label,
    title: t.title,
    context: t.context,
    source: t.source,
    sourceLabel: t.source_label,
    assigneeId: t.assignee_id,
    assigneeName: nameOf(t.assignee_id),
    assigneeRole: (t.assignee_role as PoolRole | null) ?? null,
    createdBy: t.created_by,
    note: t.note,
    dueAt: t.due_at,
    dueLabel: taskDueLabel(
      {
        dueAt: t.due_at,
        type: t.type,
        escalated: !!t.escalated_at && open,
        status: t.status,
        resolution: t.resolution,
      },
      now,
    ),
    bucket: open ? dueBucket(t.due_at, now) : "later",
    attempts: t.attempts,
    nextRetryAt: t.next_retry_at,
    escalated: !!t.escalated_at,
    status: t.status,
    resolution: t.resolution,
    resolvedAt: t.resolved_at,
    priority: t.priority,
    links: serialisableLinks(t.links),
    createdAt: t.created_at,
    can: {
      select: manager && open,
      delegate: manager && open,
      handoff: open && (practitioner || manager) && mine && isContactTask(t.type),
      claim: open && frontDesk && frontDeskPool && t.type !== "question",
      takeOver: open && practitioner && !mine && ownPatient,
      complete: open && (manager || mine),
      attempt: open && mine && isContactTask(t.type) && (frontDesk || manager),
      escalateToClinician: open && frontDesk && mine,
      snooze: open && mine && t.type === "question",
    },
  };
}

export const GROUP_LABEL: Record<TaskBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "Later this week",
  later: "Later",
};

export function groupTasks(list: TaskView_[]): TaskGroup[] {
  const order: TaskBucket[] = ["overdue", "today", "week", "later"];
  const byPriority = (a: TaskView_, b: TaskView_) =>
    a.priority - b.priority ||
    (a.dueAt ?? "9").localeCompare(b.dueAt ?? "9") ||
    a.createdAt.localeCompare(b.createdAt);
  return order
    .map((bucket) => ({
      bucket,
      label: GROUP_LABEL[bucket],
      tasks: list.filter((t) => t.bucket === bucket).sort(byPriority),
    }))
    .filter((g) => g.tasks.length > 0);
}

// ---------------------------------------------------------------- transitions

export type Transition = { patch: Partial<TaskRow>; event: TaskEventInput };

/** The fields Undo restores. */
export function snapshotOf(t: TaskRow) {
  return {
    assignee_id: t.assignee_id,
    assignee_role: t.assignee_role,
    status: t.status,
    resolution: t.resolution,
    resolved_by: t.resolved_by,
    resolved_at: t.resolved_at,
    attempts: t.attempts,
    next_retry_at: t.next_retry_at,
    snoozed_until: t.snoozed_until,
    due_at: t.due_at,
    note: t.note,
    escalated_at: t.escalated_at,
    escalated_to: t.escalated_to,
  };
}

export type TaskSnapshot = ReturnType<typeof snapshotOf>;

export function planAssign(
  t: TaskRow,
  input: { assigneeId: string; dueAt?: string | null; note?: string | null },
  actorId: string,
  actorName: string,
  nowISO: string,
): Transition {
  const reassigned = !!t.assignee_id && t.assignee_id !== input.assigneeId;
  return {
    patch: {
      assignee_id: input.assigneeId,
      assignee_role: null,
      ...(input.dueAt ? { due_at: input.dueAt } : {}),
      ...(input.note !== undefined && input.note !== null ? { note: input.note || null } : {}),
      ...(t.source === "manual" ? { source_label: `Assigned by ${actorName}` } : {}),
      status: t.status === "snoozed" ? "open" : t.status,
      updated_at: nowISO,
    },
    event: {
      kind: reassigned ? "reassigned" : "assigned",
      data: {
        previous: snapshotOf(t),
        assignee_id: input.assigneeId,
        due_at: input.dueAt ?? null,
        note: input.note ?? null,
        actor_id: actorId,
      },
    },
  };
}

export function planHandOff(
  t: TaskRow,
  role: PoolRole,
  actorId: string,
  nowISO: string,
): Transition {
  return {
    patch: { assignee_id: null, assignee_role: role, updated_at: nowISO },
    event: {
      kind: "handed_off",
      data: { previous: snapshotOf(t), assignee_role: role, actor_id: actorId },
    },
  };
}

export function planClaim(t: TaskRow, actorId: string, nowISO: string): Transition {
  return {
    patch: { assignee_id: actorId, assignee_role: null, updated_at: nowISO },
    event: {
      kind: "claimed",
      data: { previous: snapshotOf(t), assignee_id: actorId, actor_id: actorId },
    },
  };
}

export function planTakeOver(t: TaskRow, actorId: string, nowISO: string): Transition {
  return {
    patch: { assignee_id: actorId, assignee_role: null, updated_at: nowISO },
    event: {
      kind: "reassigned",
      data: { previous: snapshotOf(t), assignee_id: actorId, actor_id: actorId, take_over: true },
    },
  };
}

export type AttemptOutcome = "no_answer" | "voicemail" | "link_sent";

/** One contact attempt. The third miss escalates to the owner; earlier ones schedule a retry. */
export function planAttempt(
  t: TaskRow,
  outcome: AttemptOutcome,
  actorId: string,
  ownerId: string | null,
  now: Date,
): Transition & { escalated: boolean } {
  const nowISO = now.toISOString();
  const attempts = t.attempts + 1;
  if (attempts >= MAX_CONTACT_ATTEMPTS && ownerId) {
    return {
      escalated: true,
      patch: {
        attempts,
        next_retry_at: null,
        assignee_id: ownerId,
        assignee_role: null,
        escalated_at: nowISO,
        escalated_to: ownerId,
        updated_at: nowISO,
      },
      event: {
        kind: "escalated",
        data: {
          previous: snapshotOf(t),
          outcome,
          attempts,
          escalated_to: ownerId,
          actor_id: actorId,
        },
      },
    };
  }
  const retry = new Date(now.getTime() + RETRY_AFTER_DAYS * 86_400_000);
  retry.setHours(10, 0, 0, 0);
  return {
    escalated: false,
    patch: { attempts, next_retry_at: retry.toISOString(), updated_at: nowISO },
    event: {
      kind: "attempt",
      data: {
        previous: snapshotOf(t),
        outcome,
        attempts,
        next_retry_at: retry.toISOString(),
        actor_id: actorId,
      },
    },
  };
}

export function planComplete(
  t: TaskRow,
  resolution: string,
  actorId: string,
  nowISO: string,
): Transition {
  return {
    patch: {
      status: "done",
      resolution,
      resolved_by: actorId,
      resolved_at: nowISO,
      next_retry_at: null,
      snoozed_until: null,
      updated_at: nowISO,
    },
    event: { kind: "done", data: { previous: snapshotOf(t), resolution, actor_id: actorId } },
  };
}

export function planAutoClose(t: TaskRow, resolution: string, nowISO: string): Transition {
  return {
    patch: {
      status: "auto_closed",
      resolution,
      resolved_by: null,
      resolved_at: nowISO,
      next_retry_at: null,
      snoozed_until: null,
      updated_at: nowISO,
    },
    event: { kind: "auto_closed", data: { previous: snapshotOf(t), resolution } },
  };
}

export function planSnooze(t: TaskRow, hours: number, actorId: string, now: Date): Transition {
  const until = new Date(now.getTime() + hours * 3_600_000).toISOString();
  return {
    patch: {
      status: "snoozed",
      snoozed_until: until,
      due_at: until,
      updated_at: now.toISOString(),
    },
    event: { kind: "snoozed", data: { previous: snapshotOf(t), until, hours, actor_id: actorId } },
  };
}

export function planEscalate(
  t: TaskRow,
  toId: string | null,
  toRole: string | null,
  nowISO: string,
  actorId: string | null,
): Transition {
  return {
    patch: {
      escalated_at: nowISO,
      escalated_to: toId,
      ...(toId ? { assignee_id: toId, assignee_role: null } : {}),
      updated_at: nowISO,
    },
    event: {
      kind: "escalated",
      data: { previous: snapshotOf(t), escalated_to: toId, to_role: toRole, actor_id: actorId },
    },
  };
}

/** Restore the state an event carried as `previous`. */
export function planUndo(
  t: TaskRow,
  previous: TaskSnapshot,
  actorId: string,
  nowISO: string,
): Transition {
  return {
    patch: { ...previous, updated_at: nowISO },
    event: { kind: "undone", data: { restored: previous, actor_id: actorId } },
  };
}

// ---------------------------------------------------------------- summary

export type TasksSummary = {
  role: TaskRole;
  openForMe: number;
  open: number;
  overdue: number;
  dueToday: number;
  unassigned: number;
  pool: number;
  autoClosedThisWeek: number;
  byType: Array<{ type: TaskType; label: string; open: number }>;
  views: Array<{ view: TaskView; count: number }>;
  team: Array<{ id: string; name: string; role: TaskRole; open: number; overdue: number }>;
  /** Practitioner: questions on their plate, assigned, patients with others. */
  questions: number;
  patientsWithOthers: number;
  /** Front desk: today's calls. */
  handledToday: number;
  bookedToday: number;
  retriesScheduled: number;
};

export function summarise(
  rows: TaskRow[],
  viewer: TaskViewer,
  team: TeamMemberLike[],
  patientPractitioner: (patientId: string) => string | null,
  views: readonly TaskView[],
  now: Date,
): TasksSummary {
  const visible = rows.filter((t) => canSeeTask(t, viewer, patientPractitioner));
  const open = visible.filter(isOpen);
  const todayKey = clinicDayKey(now);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
  const mine = open.filter((t) => t.assignee_id === viewer.userId);
  const doneToday = rows.filter(
    (t) =>
      (t.status === "done" || t.status === "auto_closed") &&
      t.resolved_at &&
      clinicDayKey(new Date(t.resolved_at)) === todayKey,
  );
  const typeCounts = new Map<TaskType, number>();
  for (const t of open) typeCounts.set(t.type, (typeCounts.get(t.type) ?? 0) + 1);
  return {
    role: taskRole(viewer),
    openForMe: mine.length,
    open: open.length,
    overdue: open.filter((t) => dueBucket(t.due_at, now) === "overdue").length,
    dueToday: open.filter((t) => dueBucket(t.due_at, now) === "today").length,
    unassigned: open.filter((t) => !t.assignee_id && !t.assignee_role).length,
    pool: open.filter((t) => !t.assignee_id && t.assignee_role === "front_desk").length,
    autoClosedThisWeek: rows.filter(
      (t) => t.status === "auto_closed" && (t.resolved_at ?? "") >= weekAgo,
    ).length,
    byType: [...typeCounts.entries()]
      .map(([type, n]) => ({ type, label: TASK_TYPE_META[type].label, open: n }))
      .sort((a, b) => b.open - a.open),
    views: views.map((view) => ({
      view,
      count: visible.filter((t) => inView(t, view, viewer, null, patientPractitioner, now)).length,
    })),
    team: team.map((m) => {
      const theirs = rows.filter((t) => isOpen(t) && t.assignee_id === m.id);
      return {
        id: m.id,
        name: m.fullName,
        role: m.role,
        open: theirs.length,
        overdue: theirs.filter((t) => dueBucket(t.due_at, now) === "overdue").length,
      };
    }),
    questions: mine.filter((t) => t.type === "question").length,
    patientsWithOthers: open.filter(
      (t) => patientPractitioner(t.patient_id) === viewer.userId && t.assignee_id !== viewer.userId,
    ).length,
    handledToday: doneToday.filter((t) => t.resolved_by === viewer.userId).length,
    bookedToday: doneToday.filter(
      (t) => t.resolution === "booked" && t.resolved_by === viewer.userId,
    ).length,
    retriesScheduled: mine.filter((t) => !!t.next_retry_at).length,
  };
}

// ---------------------------------------------------------------- dashboard rows

/** Due inside this many clinic days (or already late) reads as Urgent on the dashboard. */
export const TASK_ATTENTION_URGENT_DAYS = 3;
/** Due inside this many clinic days reads as This week; later than that stays on the Tasks page only. */
export const TASK_ATTENTION_WEEK_DAYS = 10;

/** Which Attention needed accordion a task type lands in. */
export const TASK_ATTENTION_KIND: Record<TaskType, string> = {
  rebook_no_show: "no_show",
  recall: "recall",
  question: "question",
  chase_booking: "chase_booking",
  send_offer: "send_offer",
  plan_support: "plan_support",
  custom: "tasks",
};

export type TaskAttentionItem = {
  id: string;
  kind: string;
  urgency: "urgent" | "this_week";
  title: string;
  subtitle: string;
  patientId: string;
  taskId: string;
  /** Whether Done on the dashboard may close it: the holder, or a manager. Pool tasks must be claimed first. */
  completable: boolean;
  href: string;
};

/** Urgent, This week, or null when the task is too far out for the dashboard. */
export function taskAttentionUrgency(
  dueAt: string | null,
  now: Date,
): TaskAttentionItem["urgency"] | null {
  if (!dueAt) return "this_week";
  if (dueBucket(dueAt, now) === "overdue") return "urgent";
  const days = clinicDayDiff(clinicDayKey(now), clinicDayKey(new Date(dueAt)));
  if (days <= TASK_ATTENTION_URGENT_DAYS) return "urgent";
  if (days <= TASK_ATTENTION_WEEK_DAYS) return "this_week";
  return null;
}

/**
 * The open tasks on this person's plate: assigned to them, plus the truly
 * unassigned ones for the owner and managers (someone has to pick them up) and
 * the unclaimed front-desk pool for the front desk.
 */
export function onMyPlate(t: TaskRow, viewer: TaskViewer): boolean {
  if (t.assignee_id === viewer.userId) return true;
  if (t.assignee_id) return false;
  const role = taskRole(viewer);
  if (role === "owner" || role === "manager") return !t.assignee_role;
  if (role === "front_desk") return t.assignee_role === "front_desk";
  return false;
}

/** The Tasks page view a dashboard row opens on, so the deep link lands on a list that holds the task. */
function taskAttentionHref(t: TaskRow, viewer: TaskViewer): string {
  const view =
    t.assignee_id === viewer.userId
      ? null
      : t.assignee_role === "front_desk"
        ? "pool"
        : "unassigned";
  return `/tasks?task=${t.id}${view ? `&view=${view}` : ""}`;
}

/**
 * The dashboard's Attention needed lists each task on the viewer's plate under
 * the accordion for its type: Urgent when late or due within three clinic
 * days, This week when due within ten. Completing it anywhere clears it here.
 */
export function taskAttentionItems(
  rows: TaskRow[],
  viewer: TaskViewer,
  patientLite: (patientId: string) => PatientLite | null,
  now: Date,
): TaskAttentionItem[] {
  const patientPractitioner = (id: string) => patientLite(id)?.practitionerId ?? null;
  const out: TaskAttentionItem[] = [];
  for (const t of rows) {
    if (!isOpen(t) || !onMyPlate(t, viewer) || !canSeeTask(t, viewer, patientPractitioner))
      continue;
    const urgency = taskAttentionUrgency(t.due_at, now);
    if (!urgency) continue;
    const patient = patientLite(t.patient_id);
    const name = patient ? `${patient.first_name} ${patient.last_name}`.trim() : "Patient";
    out.push({
      id: `task-${t.id}`,
      kind: TASK_ATTENTION_KIND[t.type],
      urgency,
      title: `${name} — ${t.title}`,
      subtitle: `${t.title} · ${taskDueLabel({ dueAt: t.due_at, type: t.type, escalated: !!t.escalated_at }, now)}`,
      patientId: t.patient_id,
      taskId: t.id,
      completable: t.assignee_id === viewer.userId || viewer.isManager,
      href: taskAttentionHref(t, viewer),
    });
  }
  return out;
}
