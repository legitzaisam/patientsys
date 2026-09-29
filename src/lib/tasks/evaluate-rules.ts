import { clinicDayDiff, clinicDayKey } from "@/lib/clinic-time";
import { questionPreview, triageMessage } from "@/lib/tasks/urgent-triage";
import { isContactTask, suggestedAssignee, type PoolRole, type TaskType } from "@/lib/tasks/types";

/**
 * The rule evaluator. Given a snapshot of the clinic (plans with their step
 * state, patients with their due dates and bookings, unread portal messages,
 * portal photo uploads, open tasks) and the clinic's enabled rules, it says
 * which rule tasks should exist right now and which open tasks no longer
 * have a reason to. Pure: the server functions build the snapshot, apply the
 * result (`syncRuleTasks`) and write the audit rows.
 *
 * Every reason has one `dedupe_key`, so evaluating twice creates nothing
 * twice, and a task closes itself the moment its reason is gone (booked,
 * replied, step done).
 */

export type RuleKey =
  | "plan_step_overdue"
  | "plan_step_due_unbooked"
  | "urgent_portal_question"
  | "rebook_window"
  | "no_show"
  | "lapsing_regular"
  | "progress_photos";

export type RuleLike = {
  id: string;
  key: RuleKey | string;
  name: string;
  enabled: boolean;
  conditions: Record<string, unknown> | null;
  task_type: TaskType | null;
  assign_strategy: string;
  assign_person?: string | null;
  due_offset_hours: number;
  escalate_after_hours: number | null;
  escalate_to_role: string | null;
};

export type PlanSnapshot = {
  id: string;
  patientId: string;
  practitionerId: string | null;
  name: string;
  done: number;
  total: number;
  nextMilestone: { id: string; title: string; dueDate: string | null } | null;
  overdue: boolean;
  stepBookedAt: string | null;
  otherBookingTreatment: string | null;
  noShowAt: string | null;
  /** The booking id the patient missed, when known. */
  noShowAppointmentId?: string | null;
};

export type PatientSnapshot = {
  id: string;
  firstName: string;
  status: string;
  /** The practitioner who holds the next booking, else who treated them last. */
  practitionerId: string | null;
  hasActivePlan: boolean;
  lastVisitAt: string | null;
  visitCount: number;
  lifetimeSpend: number;
  nextDue: { name: string; dueDate: string } | null;
  /** Live future bookings: when they start and when they were made. */
  upcoming: Array<{ startsAt: string; createdAt: string }>;
  /** Recent missed bookings not covered by a plan step. */
  missed: Array<{ appointmentId: string; startsAt: string; treatmentName: string }>;
  /** A win-back offer already sent and still live. */
  hasLiveOffer: boolean;
  reminderSentAt?: string | null;
};

export type MessageSnapshot = {
  id: string;
  patientId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  /** First staff message after this one, when there is one. */
  repliedAt: string | null;
};

export type PhotoUploadSnapshot = { patientId: string; at: string; count: number };

export type OpenTaskSnapshot = {
  id: string;
  type: TaskType;
  patientId: string;
  source: "rule" | "portal" | "manual";
  dedupeKey: string | null;
  ruleId: string | null;
  autoClose: boolean;
  createdAt: string;
  escalateAt: string | null;
  escalatedAt: string | null;
  links: Record<string, unknown>;
};

export type RuleSnapshot = {
  now: Date;
  ownerId: string | null;
  rules: RuleLike[];
  plans: PlanSnapshot[];
  patients: PatientSnapshot[];
  messages: MessageSnapshot[];
  photoUploads: PhotoUploadSnapshot[];
  openTasks: OpenTaskSnapshot[];
};

export type NewRuleTask = {
  dedupeKey: string;
  ruleId: string;
  ruleKey: string;
  ruleName: string;
  type: TaskType;
  source: "rule" | "portal";
  patientId: string;
  title: string;
  context: string;
  assigneeId: string | null;
  assigneeRole: PoolRole | null;
  dueAt: string;
  escalateAt: string | null;
  priority: 1 | 2 | 3;
  links: Record<string, unknown>;
  /**
   * Set when the escalation window had already passed by the time the reason
   * was noticed (a backfill, or a rule evaluated late): the task starts with
   * its escalation target so the list reads the same on the first load as on
   * the next.
   */
  escalatedNow?: { toId: string | null; toRole: string | null };
};

export type CloseTask = {
  taskId: string;
  resolution: "auto_booked" | "auto_replied" | "auto_resolved";
};
export type EscalateTask = { taskId: string; toId: string | null; toRole: string | null };

export type RuleEvaluation = {
  create: NewRuleTask[];
  close: CloseTask[];
  escalate: EscalateTask[];
  /** Every dedupe key that still has a live reason, capped or not. */
  valid: Set<string>;
};

/** How many open tasks a flood-prone rule may hold at once, unless the rule says otherwise. */
const DEFAULT_MAX_OPEN: Partial<Record<RuleKey, number>> = {
  rebook_window: 12,
  lapsing_regular: 6,
};
const QUESTION_LOOKBACK_DAYS = 7;
const NO_SHOW_LOOKBACK_DAYS = 14;
const PHOTO_LOOKBACK_DAYS = 7;

const HOUR = 3_600_000;
const DAY = 86_400_000;

function addHours(iso: string | Date, hours: number) {
  const base = typeof iso === "string" ? new Date(iso) : iso;
  return new Date(base.getTime() + hours * HOUR).toISOString();
}

function atClinicEvening(dayKey: string) {
  // 18:00 London on the given day; the offset is read from that day's noon.
  const noon = new Date(`${dayKey}T12:00:00Z`);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(noon),
  );
  return new Date(Date.parse(`${dayKey}T18:00:00Z`) - (hour - 12) * HOUR).toISOString();
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  });
}

/** "Microneedling session 2" → "microneedling session 2"; acronyms ("PRP Hair") keep their case. */
function lower(s: string) {
  const words = s.split(" ");
  const first = words[0] ?? "";
  if (/^[A-Z]{2,}$/.test(first)) return s;
  // A Title Case treatment name ("Chemical Peel") reads as a name; leave it.
  if (words.slice(1).some((w) => /^[A-Z]/.test(w))) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function cond<T>(rule: RuleLike, key: string, fallback: T): T {
  const v = rule.conditions?.[key];
  return v === undefined || v === null ? fallback : (v as T);
}

function money(n: number) {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function assignment(
  rule: RuleLike,
  type: TaskType,
  patientPractitionerId: string | null,
  ownerId: string | null,
): { assigneeId: string | null; assigneeRole: PoolRole | null } {
  switch (rule.assign_strategy) {
    case "patient_practitioner":
      return patientPractitionerId
        ? { assigneeId: patientPractitionerId, assigneeRole: null }
        : { assigneeId: ownerId, assigneeRole: ownerId ? null : "practitioner" };
    case "owner":
      return ownerId
        ? { assigneeId: ownerId, assigneeRole: null }
        : { assigneeId: null, assigneeRole: "manager" };
    case "person":
      return rule.assign_person
        ? { assigneeId: rule.assign_person, assigneeRole: null }
        : suggestedAssignee({ type, patientPractitionerId, ownerId });
    case "front_desk_pool":
    default:
      return { assigneeId: null, assigneeRole: "front_desk" };
  }
}

export function evaluateRules(snap: RuleSnapshot): RuleEvaluation {
  const now = snap.now;
  const nowISO = now.toISOString();
  const todayKey = clinicDayKey(now);
  const rules = new Map<string, RuleLike>();
  for (const r of snap.rules) if (r.enabled) rules.set(r.key, r);
  const patients = new Map(snap.patients.map((p) => [p.id, p]));
  const openByKey = new Map<string, OpenTaskSnapshot>();
  for (const t of snap.openTasks) if (t.dedupeKey) openByKey.set(t.dedupeKey, t);
  const openCountByRule = new Map<string, number>();
  for (const t of snap.openTasks) {
    if (t.ruleId) openCountByRule.set(t.ruleId, (openCountByRule.get(t.ruleId) ?? 0) + 1);
  }

  const valid = new Set<string>();
  const candidates: NewRuleTask[] = [];

  const propose = (task: NewRuleTask) => {
    valid.add(task.dedupeKey);
    if (!openByKey.has(task.dedupeKey)) candidates.push(task);
  };

  const practitionerFor = (patientId: string, plan?: PlanSnapshot | null) =>
    plan?.practitionerId ?? patients.get(patientId)?.practitionerId ?? null;

  // ---------------------------------------------------------------- plans
  const overdueRule = rules.get("plan_step_overdue");
  const dueRule = rules.get("plan_step_due_unbooked");
  const noShowRule = rules.get("no_show");
  const photosRule = rules.get("progress_photos");
  const planPatients = new Set<string>();

  for (const plan of snap.plans) {
    planPatients.add(plan.patientId);
    const step = plan.nextMilestone;
    if (!step) continue;
    const patient = patients.get(plan.patientId);
    const prac = practitionerFor(plan.patientId, plan);
    const daysLate = step.dueDate ? clinicDayDiff(step.dueDate, todayKey) : null;

    if (noShowRule && plan.noShowAt && !plan.stepBookedAt) {
      const type = noShowRule.task_type ?? "rebook_no_show";
      const key = `no_show:${step.id}`;
      const dueAt = addHours(plan.noShowAt, noShowRule.due_offset_hours);
      propose({
        dedupeKey: key,
        ruleId: noShowRule.id,
        ruleKey: noShowRule.key,
        ruleName: noShowRule.name,
        type,
        source: "rule",
        patientId: plan.patientId,
        title: `Rebook missed ${lower(step.title)}`,
        context: `Did not attend ${shortDate(plan.noShowAt)} · no reply since`,
        ...assignment(noShowRule, type, prac, snap.ownerId),
        dueAt,
        escalateAt: noShowRule.escalate_after_hours
          ? addHours(dueAt, noShowRule.escalate_after_hours)
          : null,
        priority: 1,
        links: {
          plan_id: plan.id,
          milestone_id: step.id,
          appointment_id: plan.noShowAppointmentId ?? null,
        },
      });
      continue;
    }

    if (overdueRule && plan.overdue && !plan.stepBookedAt && step.dueDate && daysLate !== null) {
      const grace = cond<number>(overdueRule, "grace_days", 2);
      if (daysLate >= grace) {
        const type = overdueRule.task_type ?? "chase_booking";
        const key = `plan_step_overdue:${step.id}`;
        // It should have been chased by the grace day's evening plus the offset.
        const graceDay = new Date(Date.parse(`${step.dueDate}T12:00:00Z`) + grace * DAY);
        const dueAt = addHours(
          atClinicEvening(clinicDayKey(graceDay)),
          overdueRule.due_offset_hours - 24,
        );
        const mismatch = plan.otherBookingTreatment
          ? ` · ${plan.otherBookingTreatment} booked instead`
          : "";
        propose({
          dedupeKey: key,
          ruleId: overdueRule.id,
          ruleKey: overdueRule.key,
          ruleName: overdueRule.name,
          type,
          source: "rule",
          patientId: plan.patientId,
          title: `Chase to book ${lower(step.title)}`,
          context: `Skin plan step ${daysLate} ${daysLate === 1 ? "day" : "days"} overdue${mismatch}`,
          ...assignment(overdueRule, type, prac, snap.ownerId),
          dueAt,
          escalateAt: overdueRule.escalate_after_hours
            ? addHours(dueAt, overdueRule.escalate_after_hours)
            : null,
          priority: daysLate > 14 ? 1 : 2,
          links: { plan_id: plan.id, milestone_id: step.id },
        });
        continue;
      }
    }

    if (dueRule && !plan.overdue && !plan.stepBookedAt && step.dueDate && daysLate !== null) {
      const within = cond<number>(dueRule, "within_days", 7);
      const daysToGo = -daysLate;
      if (daysToGo >= 0 && daysToGo <= within) {
        const type = dueRule.task_type ?? "chase_booking";
        const key = `plan_step_due:${step.id}`;
        const dueAt = addHours(nowISO, dueRule.due_offset_hours);
        const when =
          daysToGo === 0
            ? "Due today"
            : daysToGo === 1
              ? "Due tomorrow"
              : `Due in ${daysToGo} days`;
        const mismatch = plan.otherBookingTreatment
          ? ` · ${plan.otherBookingTreatment} booked instead`
          : "";
        propose({
          dedupeKey: key,
          ruleId: dueRule.id,
          ruleKey: dueRule.key,
          ruleName: dueRule.name,
          type,
          source: "rule",
          patientId: plan.patientId,
          title: `Chase to book ${lower(step.title)}`,
          context: `${when} · not booked${mismatch}`,
          ...assignment(dueRule, type, prac, snap.ownerId),
          dueAt,
          escalateAt: null,
          priority: 2,
          links: { plan_id: plan.id, milestone_id: step.id },
        });
      }
    }

    if (photosRule) {
      const uploads = snap.photoUploads.filter(
        (u) =>
          u.patientId === plan.patientId &&
          clinicDayDiff(clinicDayKey(new Date(u.at)), todayKey) <= PHOTO_LOOKBACK_DAYS,
      );
      if (uploads.length) {
        const latest = uploads.reduce((a, b) => (a.at > b.at ? a : b));
        const count = uploads.reduce((n, u) => n + u.count, 0);
        const type = photosRule.task_type ?? "plan_support";
        const key = `photos:${plan.patientId}:${clinicDayKey(new Date(latest.at))}`;
        const nextVisit =
          patient?.upcoming.map((u) => new Date(u.startsAt).toISOString()).sort()[0] ?? null;
        const dueAt =
          nextVisit && nextVisit > nowISO
            ? nextVisit
            : addHours(nowISO, photosRule.due_offset_hours);
        propose({
          dedupeKey: key,
          ruleId: photosRule.id,
          ruleKey: photosRule.key,
          ruleName: photosRule.name,
          type,
          source: "portal",
          patientId: plan.patientId,
          title: `Review ${lower(plan.name.replace(/ (Plan|Course|Programme|Series|Track|Journey)$/, ""))} progress photos`,
          context: `${count} photo${count === 1 ? "" : "s"} uploaded in portal${nextVisit ? ` · next visit ${shortDate(nextVisit)}` : ` · ${lower(step.title)}`}`,
          ...assignment(photosRule, type, prac, snap.ownerId),
          dueAt,
          escalateAt: null,
          priority: 2,
          links: { plan_id: plan.id, milestone_id: step.id },
        });
      }
    }
  }

  // ---------------------------------------------------------------- portal questions
  const questionRule = rules.get("urgent_portal_question");
  if (questionRule) {
    for (const m of snap.messages) {
      if (m.repliedAt) continue;
      if (clinicDayDiff(clinicDayKey(new Date(m.createdAt)), todayKey) > QUESTION_LOOKBACK_DAYS)
        continue;
      if (!triageMessage(m.body).urgent) continue;
      const patient = patients.get(m.patientId);
      const plan = snap.plans.find((p) => p.patientId === m.patientId) ?? null;
      const type = questionRule.task_type ?? "question";
      const key = `portal_question:${m.id}`;
      const dueAt = addHours(m.createdAt, questionRule.due_offset_hours);
      const minutesAgo = Math.max(
        1,
        Math.round((now.getTime() - new Date(m.createdAt).getTime()) / 60_000),
      );
      const ago =
        minutesAgo < 60
          ? `${minutesAgo} min ago`
          : minutesAgo < 24 * 60
            ? `${Math.round(minutesAgo / 60)}h ago`
            : shortDate(m.createdAt);
      const about = plan
        ? `${plan.name}${plan.nextMilestone ? `, ${lower(plan.nextMilestone.title)}` : ""}`
        : (patient?.nextDue?.name ?? "");
      propose({
        dedupeKey: key,
        ruleId: questionRule.id,
        ruleKey: questionRule.key,
        ruleName: questionRule.name,
        type,
        source: "portal",
        patientId: m.patientId,
        title: `Reply: “${questionPreview(m.body)}”`,
        context: `Sent via portal ${ago}${about ? ` · ${about}` : ""}`,
        ...assignment(questionRule, type, practitionerFor(m.patientId, plan), snap.ownerId),
        dueAt,
        escalateAt: questionRule.escalate_after_hours
          ? addHours(m.createdAt, questionRule.escalate_after_hours)
          : null,
        priority: 1,
        links: { message_id: m.id, plan_id: plan?.id ?? null },
      });
    }
  }

  // ---------------------------------------------------------------- regulars
  const recallRule = rules.get("rebook_window");
  const lapsingRule = rules.get("lapsing_regular");
  const recallCandidates: Array<{ task: NewRuleTask; sortKey: number }> = [];
  const lapsingCandidates: Array<{ task: NewRuleTask; sortKey: number }> = [];

  for (const p of snap.patients) {
    if (p.status !== "active" || p.hasActivePlan || planPatients.has(p.id)) continue;
    const upcoming = p.upcoming.length > 0;

    if (noShowRule && !upcoming) {
      for (const miss of p.missed) {
        if (clinicDayDiff(clinicDayKey(new Date(miss.startsAt)), todayKey) > NO_SHOW_LOOKBACK_DAYS)
          continue;
        const type = noShowRule.task_type ?? "rebook_no_show";
        const dueAt = addHours(miss.startsAt, noShowRule.due_offset_hours);
        propose({
          dedupeKey: `no_show_appt:${miss.appointmentId}`,
          ruleId: noShowRule.id,
          ruleKey: noShowRule.key,
          ruleName: noShowRule.name,
          type,
          source: "rule",
          patientId: p.id,
          title: `Rebook missed ${lower(miss.treatmentName)}`,
          context: `Did not attend ${shortDate(miss.startsAt)} · nothing rebooked`,
          ...assignment(noShowRule, type, p.practitionerId, snap.ownerId),
          dueAt,
          escalateAt: noShowRule.escalate_after_hours
            ? addHours(dueAt, noShowRule.escalate_after_hours)
            : null,
          priority: 1,
          links: { appointment_id: miss.appointmentId },
        });
      }
    }

    if (recallRule && !upcoming && p.nextDue) {
      const nudge = cond<number>(recallRule, "nudge_days", 7);
      const daysOpen = clinicDayDiff(p.nextDue.dueDate, todayKey);
      const lapse = lapsingRule ? cond<number>(lapsingRule, "lapse_days", 120) : Infinity;
      const sinceVisit = p.lastVisitAt
        ? clinicDayDiff(clinicDayKey(new Date(p.lastVisitAt)), todayKey)
        : 0;
      if (daysOpen >= nudge && sinceVisit < lapse) {
        const type = recallRule.task_type ?? "recall";
        const key = `rebook_window:${p.id}:${p.nextDue.dueDate}`;
        const dueAt = addHours(atClinicEvening(todayKey), recallRule.due_offset_hours - 24);
        recallCandidates.push({
          sortKey: daysOpen,
          task: {
            dedupeKey: key,
            ruleId: recallRule.id,
            ruleKey: recallRule.key,
            ruleName: recallRule.name,
            type,
            source: "rule",
            patientId: p.id,
            title: `${p.nextDue.name} recall`,
            context: `Window opened ${daysOpen} days ago · auto reminder unanswered`,
            ...assignment(recallRule, type, p.practitionerId, snap.ownerId),
            dueAt,
            escalateAt: null,
            priority: 2,
            links: { treatment_name: p.nextDue.name, due_date: p.nextDue.dueDate },
          },
        });
      }
    }

    if (lapsingRule && !upcoming && p.lastVisitAt && !p.hasLiveOffer && p.visitCount >= 2) {
      const lapse = cond<number>(lapsingRule, "lapse_days", 120);
      const sinceVisit = clinicDayDiff(clinicDayKey(new Date(p.lastVisitAt)), todayKey);
      if (sinceVisit >= lapse) {
        const type = lapsingRule.task_type ?? "send_offer";
        const key = `lapsing:${p.id}:${clinicDayKey(new Date(p.lastVisitAt))}`;
        lapsingCandidates.push({
          sortKey: -p.lifetimeSpend,
          task: {
            dedupeKey: key,
            ruleId: lapsingRule.id,
            ruleKey: lapsingRule.key,
            ruleName: lapsingRule.name,
            type,
            source: "rule",
            patientId: p.id,
            title: `Approve win-back offer for ${p.firstName}`,
            context: `${sinceVisit} days since last visit · ${money(p.lifetimeSpend)} lifetime spend`,
            ...assignment(lapsingRule, type, p.practitionerId, snap.ownerId),
            dueAt: addHours(nowISO, lapsingRule.due_offset_hours),
            escalateAt: null,
            priority: 3,
            links: { last_visit_at: p.lastVisitAt },
          },
        });
      }
    }
  }

  // Flood-prone rules: every matching key stays valid (so nothing closes for
  // lack of room), but only the cap's worth of new ones are created.
  const capped = (
    rule: RuleLike | undefined,
    list: Array<{ task: NewRuleTask; sortKey: number }>,
    fallback: number,
  ) => {
    if (!rule) return;
    for (const c of list) valid.add(c.task.dedupeKey);
    const max = cond<number>(rule, "max_open", fallback);
    let room = Math.max(0, max - (openCountByRule.get(rule.id) ?? 0));
    for (const c of list.sort((a, b) => a.sortKey - b.sortKey)) {
      if (room <= 0) break;
      if (openByKey.has(c.task.dedupeKey)) continue;
      candidates.push(c.task);
      room -= 1;
    }
  };
  capped(recallRule, recallCandidates, DEFAULT_MAX_OPEN.rebook_window ?? 12);
  capped(lapsingRule, lapsingCandidates, DEFAULT_MAX_OPEN.lapsing_regular ?? 6);

  // ---------------------------------------------------------------- closes
  const close: CloseTask[] = [];
  for (const t of snap.openTasks) {
    if (!t.autoClose) continue;
    const patient = patients.get(t.patientId);
    const bookedAfter = (patient?.upcoming ?? []).some((u) => u.createdAt > t.createdAt);
    if (t.source !== "manual") {
      if (t.dedupeKey && valid.has(t.dedupeKey)) continue;
      if (!t.dedupeKey) continue;
      // The reason is gone. Say why when we can tell.
      if (t.dedupeKey.startsWith("portal_question:")) {
        const m = snap.messages.find((x) => x.id === t.links["message_id"]);
        close.push({
          taskId: t.id,
          resolution: m?.repliedAt || !m ? "auto_replied" : "auto_resolved",
        });
      } else if (
        isContactTask(t.type) &&
        (bookedAfter || snap.plans.some((p) => p.patientId === t.patientId && p.stepBookedAt))
      ) {
        close.push({ taskId: t.id, resolution: "auto_booked" });
      } else {
        close.push({ taskId: t.id, resolution: "auto_resolved" });
      }
      continue;
    }
    // A manual chase closes itself once the patient books after it was raised.
    if (isContactTask(t.type) && bookedAfter)
      close.push({ taskId: t.id, resolution: "auto_booked" });
  }

  // ---------------------------------------------------------------- escalations
  const escalationTarget = (ruleId: string | null, patientId: string) => {
    const rule = ruleId ? snap.rules.find((r) => r.id === ruleId) : null;
    const toRole = rule?.escalate_to_role ?? "owner";
    const plan = snap.plans.find((p) => p.patientId === patientId) ?? null;
    const toId =
      toRole === "owner"
        ? snap.ownerId
        : toRole === "practitioner"
          ? (practitionerFor(patientId, plan) ?? snap.ownerId)
          : snap.ownerId;
    return { toId, toRole };
  };
  const escalate: EscalateTask[] = [];
  const closing = new Set(close.map((c) => c.taskId));
  for (const t of snap.openTasks) {
    if (closing.has(t.id) || t.escalatedAt || !t.escalateAt || t.escalateAt > nowISO) continue;
    escalate.push({ taskId: t.id, ...escalationTarget(t.ruleId, t.patientId) });
  }
  for (const c of candidates) {
    if (c.escalateAt && c.escalateAt <= nowISO)
      c.escalatedNow = escalationTarget(c.ruleId, c.patientId);
  }

  return { create: candidates, close, escalate, valid };
}
