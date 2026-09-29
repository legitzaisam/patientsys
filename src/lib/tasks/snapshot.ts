import { clinicDayKey } from "@/lib/clinic-time";
import { nextDueFor, visitsByPatient, type TreatmentLike } from "@/lib/metrics/definitions";
import { noShowLookbackISO, planStepState, type PlanStepAppointment } from "@/lib/plan-step-state";
import type {
  MessageSnapshot,
  NewRuleTask,
  OpenTaskSnapshot,
  PatientSnapshot,
  PhotoUploadSnapshot,
  PlanSnapshot,
  RuleLike,
  RuleSnapshot,
} from "@/lib/tasks/evaluate-rules";
import type { TaskRow } from "@/lib/tasks/service";

/**
 * Turns raw table rows into the evaluator's snapshot. The production handler
 * fetches the rows from Supabase and the demo handler reads the fixture
 * arrays; both call this, so the rules see the same facts derived the same
 * way (`planStepState` for plan steps, `nextDueFor` for regulars).
 */

export type PatientRowLike = { id: string; first_name?: string | null; status?: string | null };
export type TreatmentRowLike = TreatmentLike & { name?: string | null };
export type AppointmentRowLike = {
  id: string;
  patient_id: string;
  status: string | null;
  starts_at: string;
  created_at?: string | null;
  practitioner_id?: string | null;
  catalogue_id?: string | null;
  treatment_name?: string | null;
};
export type PlanRowLike = {
  id: string;
  patient_id: string;
  practitioner_id?: string | null;
  name: string;
  phase: string;
  status: string;
  catalogue_id?: string | null;
  total_sessions?: number | null;
};
export type MilestoneRowLike = {
  id: string;
  plan_id: string;
  idx: number;
  title: string;
  kind?: string | null;
  status: string;
  due_date?: string | null;
  appointment_id?: string | null;
};
export type MessageRowLike = {
  id: string;
  patient_id: string;
  author: string;
  body?: string | null;
  created_at: string;
  read_at?: string | null;
};
export type JournalEntryRowLike = {
  id: string;
  patient_id: string;
  created_at: string;
  shared_with_clinic?: boolean | null;
};
export type JournalAttachmentRowLike = { entry_id: string; kind: string };
export type OfferRowLike = { patient_id: string; status: string; expires_at?: string | null };
export type RuleRowLike = {
  id: string;
  key: string;
  name: string;
  enabled?: boolean | null;
  conditions?: unknown;
  task_type?: string | null;
  assign_strategy: string;
  assign_person?: string | null;
  due_offset_hours?: number | null;
  escalate_after_hours?: number | null;
  escalate_to_role?: string | null;
};

export type SnapshotRows = {
  now: Date;
  ownerId: string | null;
  rules: RuleRowLike[];
  patients: PatientRowLike[];
  treatments: TreatmentRowLike[];
  appointments: AppointmentRowLike[];
  treatmentPlans: PlanRowLike[];
  planMilestones: MilestoneRowLike[];
  messages: MessageRowLike[];
  journalEntries: JournalEntryRowLike[];
  journalAttachments: JournalAttachmentRowLike[];
  patientOffers: OfferRowLike[];
  tasks: TaskRow[];
};

export type PlanFactsRow = PlanSnapshot & {
  phase: string;
  catalogueId: string | null;
  nextStepTitle: string | null;
};

/** Every active plan with its step state, keyed by patient; shared by the snapshot and the Records rows. */
export function planFacts(
  rows: Pick<SnapshotRows, "now" | "appointments" | "treatmentPlans" | "planMilestones">,
): PlanFactsRow[] {
  const nowISO = rows.now.toISOString();
  const todayKey = clinicDayKey(rows.now);
  const lookbackISO = noShowLookbackISO(rows.now);
  const apptsByPatient = new Map<string, PlanStepAppointment[]>();
  for (const a of rows.appointments) {
    if (a.status !== "booked" && a.status !== "no_show") continue;
    if (a.starts_at < lookbackISO) continue;
    const list = apptsByPatient.get(a.patient_id) ?? [];
    list.push({
      id: a.id,
      starts_at: a.starts_at,
      status: a.status,
      catalogue_id: a.catalogue_id ?? null,
      treatment_name: a.treatment_name ?? null,
    });
    apptsByPatient.set(a.patient_id, list);
  }
  const milestonesByPlan = new Map<string, MilestoneRowLike[]>();
  for (const m of rows.planMilestones) {
    const list = milestonesByPlan.get(m.plan_id) ?? [];
    list.push(m);
    milestonesByPlan.set(m.plan_id, list);
  }
  return rows.treatmentPlans
    .filter((p) => p.status === "active")
    .map((p) => {
      const mine = [...(milestonesByPlan.get(p.id) ?? [])].sort((a, b) => (a.idx > b.idx ? 1 : -1));
      const done = mine.filter((m) => m.status === "done" || m.status === "skipped").length;
      const next =
        mine.find((m) => m.status === "current") ??
        mine.find((m) => m.status === "upcoming") ??
        null;
      const appts = apptsByPatient.get(p.patient_id) ?? [];
      const step = planStepState({
        nextMilestone: next
          ? {
              id: next.id,
              kind: next.kind ?? null,
              dueDate: next.due_date ?? null,
              appointmentId: next.appointment_id ?? null,
            }
          : null,
        planCatalogueId: p.catalogue_id ?? null,
        appointments: appts,
        todayKey,
        nowISO,
      });
      const missed = step.noShowAt
        ? appts.find((a) => a.status === "no_show" && a.starts_at === step.noShowAt)
        : null;
      return {
        id: p.id,
        patientId: p.patient_id,
        practitionerId: p.practitioner_id ?? null,
        name: p.name,
        phase: p.phase,
        catalogueId: p.catalogue_id ?? null,
        done,
        total: mine.length || p.total_sessions || 0,
        nextMilestone: next
          ? { id: next.id, title: next.title, dueDate: next.due_date ?? null }
          : null,
        nextStepTitle: next?.title ?? null,
        overdue: step.overdue,
        stepBookedAt: step.stepBookedAt,
        otherBookingTreatment: step.otherBookingTreatment,
        noShowAt: step.noShowAt,
        noShowAppointmentId: missed?.id ?? null,
      };
    });
}

/** Who treats a patient: the plan's practitioner, else the next booking's, else the last treatment's. */
export function primaryPractitioners(rows: {
  patients: PatientRowLike[];
  treatments: TreatmentRowLike[];
  appointments: AppointmentRowLike[];
  plans: readonly Pick<PlanSnapshot, "patientId" | "practitionerId">[];
  now: Date;
}): Map<string, string | null> {
  const nowISO = rows.now.toISOString();
  const out = new Map<string, string | null>();
  const planPrac = new Map<string, string | null>();
  for (const p of rows.plans)
    if (!planPrac.has(p.patientId)) planPrac.set(p.patientId, p.practitionerId);
  const nextPrac = new Map<string, { at: string; id: string }>();
  for (const a of rows.appointments) {
    if (a.status !== "booked" || a.starts_at < nowISO || !a.practitioner_id) continue;
    const prev = nextPrac.get(a.patient_id);
    if (!prev || a.starts_at < prev.at)
      nextPrac.set(a.patient_id, { at: a.starts_at, id: a.practitioner_id });
  }
  const lastPrac = new Map<string, { at: string; id: string }>();
  for (const t of rows.treatments) {
    if (!t.practitioner_id) continue;
    const prev = lastPrac.get(t.patient_id);
    if (!prev || t.performed_at > prev.at)
      lastPrac.set(t.patient_id, { at: t.performed_at, id: t.practitioner_id });
  }
  for (const p of rows.patients) {
    out.set(p.id, planPrac.get(p.id) ?? nextPrac.get(p.id)?.id ?? lastPrac.get(p.id)?.id ?? null);
  }
  return out;
}

const STAFF_AUTHOR = "staff";
const PATIENT_AUTHOR = "patient";

export function buildRuleSnapshot(rows: SnapshotRows): RuleSnapshot {
  const now = rows.now;
  const nowISO = now.toISOString();
  const plans = planFacts(rows);
  const plansByPatient = new Set(plans.map((p) => p.patientId));
  const visits = visitsByPatient(rows.treatments);
  const practitioners = primaryPractitioners({ ...rows, plans, now });
  const sinceNoShow = new Date(now.getTime() - 21 * 86_400_000).toISOString();
  const liveOffer = new Set(
    rows.patientOffers
      .filter(
        (o) =>
          (o.status === "sent" || o.status === "viewed") &&
          (!o.expires_at || o.expires_at > nowISO),
      )
      .map((o) => o.patient_id),
  );
  const spend = new Map<string, number>();
  for (const t of rows.treatments)
    spend.set(t.patient_id, (spend.get(t.patient_id) ?? 0) + Number(t.price ?? 0));

  const upcomingBy = new Map<string, Array<{ startsAt: string; createdAt: string }>>();
  const missedBy = new Map<
    string,
    Array<{ appointmentId: string; startsAt: string; treatmentName: string }>
  >();
  for (const a of rows.appointments) {
    if (a.status === "booked" && a.starts_at >= nowISO) {
      const list = upcomingBy.get(a.patient_id) ?? [];
      list.push({ startsAt: a.starts_at, createdAt: a.created_at ?? a.starts_at });
      upcomingBy.set(a.patient_id, list);
    } else if (a.status === "no_show" && a.starts_at >= sinceNoShow) {
      const list = missedBy.get(a.patient_id) ?? [];
      list.push({
        appointmentId: a.id,
        startsAt: a.starts_at,
        treatmentName: a.treatment_name ?? "appointment",
      });
      missedBy.set(a.patient_id, list);
    }
  }

  const patients: PatientSnapshot[] = rows.patients.map((p) => {
    const mine = visits.get(p.id) ?? [];
    const last = mine[mine.length - 1] ?? null;
    const due = nextDueFor(mine);
    return {
      id: p.id,
      firstName: p.first_name ?? "",
      status: String(p.status ?? "active").toLowerCase(),
      practitionerId: practitioners.get(p.id) ?? null,
      hasActivePlan: plansByPatient.has(p.id),
      lastVisitAt: last?.performed_at ?? null,
      visitCount: mine.length,
      lifetimeSpend: spend.get(p.id) ?? 0,
      nextDue: due?.next_due_at
        ? { name: due.name ?? "Treatment", dueDate: String(due.next_due_at).slice(0, 10) }
        : null,
      upcoming: upcomingBy.get(p.id) ?? [],
      missed: missedBy.get(p.id) ?? [],
      hasLiveOffer: liveOffer.has(p.id),
    };
  });

  // Patient messages with the first staff reply after each, if any.
  const byPatientMessages = new Map<string, MessageRowLike[]>();
  for (const m of rows.messages) {
    const list = byPatientMessages.get(m.patient_id) ?? [];
    list.push(m);
    byPatientMessages.set(m.patient_id, list);
  }
  const messages: MessageSnapshot[] = [];
  for (const [patientId, list] of byPatientMessages) {
    const sorted = [...list].sort((a, b) => (a.created_at > b.created_at ? 1 : -1));
    sorted.forEach((m, i) => {
      if (m.author !== PATIENT_AUTHOR) return;
      const reply = sorted.slice(i + 1).find((x) => x.author === STAFF_AUTHOR);
      messages.push({
        id: m.id,
        patientId,
        body: m.body ?? "",
        createdAt: m.created_at,
        readAt: m.read_at ?? null,
        repliedAt: reply?.created_at ?? null,
      });
    });
  }

  // Portal photo uploads: shared journal entries with photo attachments.
  const attachmentCount = new Map<string, number>();
  for (const a of rows.journalAttachments) {
    if (a.kind !== "photo") continue;
    attachmentCount.set(a.entry_id, (attachmentCount.get(a.entry_id) ?? 0) + 1);
  }
  const photoUploads: PhotoUploadSnapshot[] = rows.journalEntries
    .filter((e) => e.shared_with_clinic !== false && (attachmentCount.get(e.id) ?? 0) > 0)
    .map((e) => ({
      patientId: e.patient_id,
      at: e.created_at,
      count: attachmentCount.get(e.id) ?? 0,
    }));

  const openTasks: OpenTaskSnapshot[] = rows.tasks
    .filter((t) => t.status === "open" || t.status === "snoozed")
    .map((t) => ({
      id: t.id,
      type: t.type,
      patientId: t.patient_id,
      source: t.source,
      dedupeKey: t.dedupe_key,
      ruleId: t.rule_id,
      autoClose: t.auto_close,
      createdAt: t.created_at,
      escalateAt: t.escalate_at,
      escalatedAt: t.escalated_at,
      links: (t.links as Record<string, unknown>) ?? {},
    }));

  const rules: RuleLike[] = rows.rules.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    enabled: r.enabled !== false,
    conditions: (r.conditions as Record<string, unknown>) ?? {},
    task_type: (r.task_type as RuleLike["task_type"]) ?? null,
    assign_strategy: r.assign_strategy,
    assign_person: r.assign_person ?? null,
    due_offset_hours: Number(r.due_offset_hours ?? 24),
    escalate_after_hours: r.escalate_after_hours == null ? null : Number(r.escalate_after_hours),
    escalate_to_role: r.escalate_to_role ?? null,
  }));

  return { now, ownerId: rows.ownerId, rules, plans, patients, messages, photoUploads, openTasks };
}

/** The row a new rule task is inserted as, from the evaluator's proposal. */
export function newTaskRow(
  proposal: NewRuleTask,
  clinicId: string,
  id: string,
  nowISO: string,
): TaskRow {
  const esc = proposal.escalatedNow;
  return {
    id,
    clinic_id: clinicId,
    patient_id: proposal.patientId,
    type: proposal.type,
    title: proposal.title,
    context: proposal.context,
    source: proposal.source,
    source_label: proposal.ruleName,
    rule_id: proposal.ruleId,
    dedupe_key: proposal.dedupeKey,
    assignee_id: esc?.toId ?? proposal.assigneeId,
    assignee_role: esc?.toId ? null : proposal.assigneeRole,
    created_by: null,
    note: null,
    priority: proposal.priority,
    due_at: proposal.dueAt,
    escalate_at: proposal.escalateAt,
    escalated_at: esc ? nowISO : null,
    escalated_to: esc?.toId ?? null,
    attempts: 0,
    next_retry_at: null,
    snoozed_until: null,
    status: "open",
    resolution: null,
    resolved_by: null,
    resolved_at: null,
    auto_close: true,
    links: proposal.links,
    created_at: nowISO,
    updated_at: nowISO,
  };
}
