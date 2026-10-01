import type { Ctx } from "@/lib/auth/guards.server";
import { clinicScoped } from "@/lib/auth/clinic-scope.server";
import { patientTypeFrom } from "@/lib/patients/records-summary";
import { evaluateRules } from "@/lib/tasks/evaluate-rules";
import {
  planAutoClose,
  planEscalate,
  type PatientLite,
  type TaskEventInput,
  type TaskRow,
  type TeamMemberLike,
  type Transition,
} from "@/lib/tasks/service";
import {
  buildRuleSnapshot,
  newTaskRow,
  planFacts,
  primaryPractitioners,
  type AppointmentRowLike,
  type JournalAttachmentRowLike,
  type JournalEntryRowLike,
  type MessageRowLike,
  type MilestoneRowLike,
  type OfferRowLike,
  type PatientRowLike,
  type PlanRowLike,
  type RuleRowLike,
  type TreatmentRowLike,
} from "@/lib/tasks/snapshot";
import type { TaskRole } from "@/lib/tasks/types";

/**
 * Supabase I/O for the task handlers in clinic.functions.ts: load the rows
 * the pure service and evaluator work on, reconcile rule tasks, apply a
 * transition and write its audit row, and notify. Everything is read
 * through the caller's clinic-scoped client; writes that must not depend on
 * the caller's own RLS row (notifications, rule tasks) go through the
 * clinic-scoped admin client, the way the rest of the file does.
 */

const STAFF_ROLES = new Set(["owner", "manager", "practitioner", "front_desk"]);
const SYNC_GAP_MS = 15_000;
const syncedAt = new Map<string, number>();

function clinicIdOf(ctx: Ctx): string {
  if (!ctx.clinicId) throw new Error("Your account is not linked to a clinic.");
  return ctx.clinicId;
}

/** Clinic-scoped admin client, typed like `ctx.supabase` so rows flow through as they do elsewhere in the handlers. */
async function adminFor(ctx: Ctx): Promise<Ctx["supabase"]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return clinicScoped(supabaseAdmin, ctx.clinicId);
}

function daysAgoISO(now: Date, days: number) {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

export type TaskContext = {
  now: Date;
  ownerId: string | null;
  rows: TaskRow[];
  team: TeamMemberLike[];
  patientPractitioner: (patientId: string) => string | null;
  patientLite: (patientId: string) => PatientLite | null;
  nameOf: (id: string | null) => string | null;
};

/** The task rows the page reads: everything open plus what closed this week. */
export async function loadTaskRows(ctx: Ctx, now: Date): Promise<TaskRow[]> {
  const { data, error } = await ctx.supabase
    .from("tasks")
    .select("*")
    .or(`status.in.(open,snoozed),resolved_at.gte.${daysAgoISO(now, 7)}`)
    .order("created_at", { ascending: false })
    .limit(2_000);
  if (error) throw new Error(error.message);
  return (data ?? []) as TaskRow[];
}

export async function loadTeam(ctx: Ctx): Promise<{
  team: TeamMemberLike[];
  ownerId: string | null;
  nameOf: (id: string | null) => string | null;
}> {
  const [{ data: roles }, { data: profiles }] = await Promise.all([
    ctx.supabase.from("user_roles").select("user_id, role"),
    ctx.supabase.from("profiles").select("id, full_name, archived_at"),
  ]);
  type ProfileRow = { id: string; full_name: string | null; archived_at: string | null };
  type RoleRow = { user_id: string; role: string };
  const profileRows = (profiles ?? []) as ProfileRow[];
  const roleRows = (roles ?? []) as RoleRow[];
  const names = new Map<string, string>(
    profileRows.map((p) => [p.id, p.full_name ?? "Team member"]),
  );
  const archived = new Set(profileRows.filter((p) => p.archived_at).map((p) => p.id));
  const team: TeamMemberLike[] = [];
  let ownerId: string | null = null;
  for (const r of roleRows) {
    if (!STAFF_ROLES.has(r.role) || archived.has(r.user_id)) continue;
    if (r.role === "owner" && !ownerId) ownerId = r.user_id;
    if (!names.has(r.user_id)) continue;
    team.push({ id: r.user_id, fullName: names.get(r.user_id)!, role: r.role as TaskRole });
  }
  return { team, ownerId, nameOf: (id) => (id ? (names.get(id) ?? null) : null) };
}

/** Patients with who treats them, for scoping and the task rows. */
export async function loadPatientContext(ctx: Ctx, now: Date, patientIds?: string[]) {
  let patientsQuery = ctx.supabase
    .from("patients")
    .select("id, first_name, last_name, avatar_url, phone, status, user_id, last_visit_at");
  if (patientIds?.length) patientsQuery = patientsQuery.in("id", patientIds);
  const [{ data: patients }, { data: treatments }, { data: appointments }, { data: plans }] =
    await Promise.all([
      patientsQuery,
      ctx.supabase
        .from("treatments")
        .select("patient_id, performed_at, practitioner_id")
        .gte("performed_at", daysAgoISO(now, 730)),
      ctx.supabase
        .from("appointments")
        .select("id, patient_id, status, starts_at, practitioner_id")
        .gte("starts_at", now.toISOString())
        .eq("status", "booked"),
      ctx.supabase
        .from("treatment_plans")
        .select("patient_id, practitioner_id")
        .eq("status", "active"),
    ]);
  type PatientRow = PatientRowLike & {
    last_name?: string | null;
    avatar_url?: string | null;
    phone?: string | null;
    last_visit_at?: string | null;
  };
  const patientRows = (patients ?? []) as PatientRow[];
  const treatmentRows = (treatments ?? []) as TreatmentRowLike[];
  const planRows = (plans ?? []) as Pick<PlanRowLike, "patient_id" | "practitioner_id">[];
  const practitioners = primaryPractitioners({
    patients: patientRows,
    treatments: treatmentRows,
    appointments: (appointments ?? []) as AppointmentRowLike[],
    plans: planRows.map((p) => ({
      patientId: p.patient_id,
      practitionerId: p.practitioner_id ?? null,
    })),
    now,
  });
  const onPlan = new Set(planRows.map((p) => p.patient_id));
  const visited = new Set(treatmentRows.map((t) => t.patient_id));
  const byId = new Map<string, PatientRow>(patientRows.map((p) => [p.id, p]));
  return {
    patientPractitioner: (id: string) => practitioners.get(id) ?? null,
    patientLite: (id: string): PatientLite | null => {
      const p = byId.get(id);
      if (!p) return null;
      return {
        id: p.id,
        first_name: p.first_name ?? "",
        last_name: p.last_name ?? "",
        avatar_url: p.avatar_url ?? null,
        phone: p.phone ?? null,
        practitionerId: practitioners.get(id) ?? null,
        patientType: patientTypeFrom(onPlan.has(id), visited.has(id) || !!p.last_visit_at),
      };
    },
  };
}

export async function loadTaskContext(ctx: Ctx): Promise<TaskContext> {
  const now = new Date();
  await syncRuleTasks(ctx, now);
  const [rows, teamInfo, patientInfo] = await Promise.all([
    loadTaskRows(ctx, now),
    loadTeam(ctx),
    loadPatientContext(ctx, now),
  ]);
  return { now, rows, ...teamInfo, ...patientInfo };
}

export async function fetchTask(ctx: Ctx, taskId: string): Promise<TaskRow> {
  const { data, error } = await ctx.supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Task not found");
  return data as TaskRow;
}

export async function recordTaskEvent(
  ctx: Ctx,
  taskId: string,
  event: TaskEventInput,
  actorId: string | null,
): Promise<number> {
  const admin = await adminFor(ctx);
  const { data, error } = await admin
    .from("task_events")
    .insert({
      clinic_id: clinicIdOf(ctx),
      task_id: taskId,
      actor_id: actorId,
      kind: event.kind,
      data: event.data,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return Number(data.id);
}

/** Apply a transition's patch and write its event; the row is updated in place too. */
export async function applyTransition(
  ctx: Ctx,
  row: TaskRow,
  transition: Transition,
  actorId: string | null,
): Promise<number> {
  const { error } = await ctx.supabase.from("tasks").update(transition.patch).eq("id", row.id);
  if (error) throw new Error(error.message);
  Object.assign(row, transition.patch);
  return recordTaskEvent(ctx, row.id, transition.event, actorId);
}

export async function insertTask(
  ctx: Ctx,
  row: Omit<TaskRow, "id" | "created_at" | "updated_at"> &
    Partial<Pick<TaskRow, "created_at" | "updated_at">>,
): Promise<TaskRow> {
  const { data, error } = await ctx.supabase.from("tasks").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  return data as TaskRow;
}

export async function notifyStaff(
  ctx: Ctx,
  recipients: string[],
  note: { kind: string; title: string; body: string },
) {
  const targets = recipients.filter((r) => r && r !== ctx.userId);
  if (!targets.length) return;
  const admin = await adminFor(ctx);
  await admin.from("staff_notifications").insert(
    targets.map((recipient_id) => ({
      clinic_id: clinicIdOf(ctx),
      recipient_id,
      sender_id: ctx.userId,
      kind: note.kind,
      title: note.title,
      body: note.body,
    })),
  );
}

export async function patientNameOf(ctx: Ctx, patientId: string): Promise<string> {
  const { data } = await ctx.supabase
    .from("patients")
    .select("first_name, last_name")
    .eq("id", patientId)
    .maybeSingle();
  return data ? `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim() : "the patient";
}

/**
 * Reconcile rule tasks for the clinic: evaluate the rules over a bounded
 * snapshot, insert what is missing (one row per dedupe key; the partial
 * unique index makes a race harmless), auto-close what no longer applies and
 * escalate what has waited too long. Runs at most once per SYNC_GAP_MS per
 * clinic per server, so a page of parallel reads shares one pass.
 */
export async function syncRuleTasks(
  ctx: Ctx,
  now: Date = new Date(),
  force = false,
): Promise<void> {
  const clinicId = clinicIdOf(ctx);
  const last = syncedAt.get(clinicId) ?? 0;
  if (!force && now.getTime() - last < SYNC_GAP_MS) return;
  syncedAt.set(clinicId, now.getTime());
  const nowISO = now.toISOString();
  const admin = await adminFor(ctx);

  const [
    { data: rules },
    { data: patients },
    { data: treatments },
    { data: appointments },
    { data: plans },
    { data: messages },
    { data: journalEntries },
    { data: offers },
    { data: tasks },
    teamInfo,
  ] = await Promise.all([
    admin.from("automation_rules").select("*").eq("enabled", true),
    admin.from("patients").select("id, first_name, status, user_id").neq("status", "archived"),
    admin
      .from("treatments")
      .select("patient_id, name, performed_at, next_due_at, practitioner_id, price")
      .gte("performed_at", daysAgoISO(now, 730)),
    admin
      .from("appointments")
      .select(
        "id, patient_id, status, starts_at, created_at, practitioner_id, catalogue_id, treatment_name",
      )
      .gte("starts_at", daysAgoISO(now, 120)),
    admin
      .from("treatment_plans")
      .select("id, patient_id, practitioner_id, name, phase, status, catalogue_id, total_sessions")
      .eq("status", "active"),
    admin
      .from("messages")
      .select("id, patient_id, author, body, created_at, read_at")
      .gte("created_at", daysAgoISO(now, 30)),
    admin
      .from("journal_entries")
      .select("id, patient_id, created_at, shared_with_clinic")
      .gte("created_at", daysAgoISO(now, 14)),
    admin
      .from("patient_offers")
      .select("patient_id, status, expires_at")
      .in("status", ["sent", "viewed"]),
    admin.from("tasks").select("*").in("status", ["open", "snoozed"]),
    loadTeam(ctx),
  ]);
  const planRows = (plans ?? []) as PlanRowLike[];
  const entryRows = (journalEntries ?? []) as JournalEntryRowLike[];
  const [{ data: milestones }, { data: attachments }] = await Promise.all([
    planRows.length
      ? admin
          .from("plan_milestones")
          .select("id, plan_id, idx, title, kind, status, due_date, appointment_id")
          .in(
            "plan_id",
            planRows.map((p) => p.id),
          )
      : Promise.resolve({ data: [] as MilestoneRowLike[] }),
    entryRows.length
      ? admin
          .from("journal_attachments")
          .select("entry_id, kind")
          .in(
            "entry_id",
            entryRows.map((e) => e.id),
          )
      : Promise.resolve({ data: [] as JournalAttachmentRowLike[] }),
  ]);

  const snapshot = buildRuleSnapshot({
    now,
    ownerId: teamInfo.ownerId,
    rules: (rules ?? []) as RuleRowLike[],
    patients: (patients ?? []) as PatientRowLike[],
    treatments: (treatments ?? []) as TreatmentRowLike[],
    appointments: (appointments ?? []) as AppointmentRowLike[],
    treatmentPlans: planRows,
    planMilestones: (milestones ?? []) as MilestoneRowLike[],
    messages: (messages ?? []) as MessageRowLike[],
    journalEntries: entryRows,
    journalAttachments: (attachments ?? []) as JournalAttachmentRowLike[],
    patientOffers: (offers ?? []) as OfferRowLike[],
    tasks: (tasks ?? []) as TaskRow[],
  });
  const result = evaluateRules(snapshot);

  for (const proposal of result.create) {
    const { id: _unused, ...row } = newTaskRow(proposal, clinicId, "", nowISO);
    void _unused;
    // A concurrent pass may have inserted the same key; the partial unique
    // index rejects the duplicate (23505) and this pass moves on.
    const { data: inserted, error } = await admin
      .from("tasks")
      .insert(row)
      .select("id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") continue;
      throw new Error(error.message);
    }
    if (!inserted) continue;
    await admin.from("task_events").insert({
      clinic_id: clinicId,
      task_id: inserted.id,
      actor_id: null,
      kind: "created",
      data: {
        rule: proposal.ruleKey,
        assignee_id: row.assignee_id,
        assignee_role: row.assignee_role,
        ...(proposal.escalatedNow
          ? { escalated_to: row.escalated_to, to_role: proposal.escalatedNow.toRole }
          : {}),
      },
    });
  }
  const openById = new Map(((tasks ?? []) as TaskRow[]).map((t) => [t.id, t]));
  for (const close of result.close) {
    const row = openById.get(close.taskId);
    if (!row) continue;
    const transition = planAutoClose(row, close.resolution, nowISO);
    await admin.from("tasks").update(transition.patch).eq("id", row.id);
    await admin.from("task_events").insert({
      clinic_id: clinicId,
      task_id: row.id,
      actor_id: null,
      kind: transition.event.kind,
      data: transition.event.data,
    });
  }
  for (const esc of result.escalate) {
    const row = openById.get(esc.taskId);
    if (!row) continue;
    const transition = planEscalate(row, esc.toId, esc.toRole, nowISO, null);
    await admin.from("tasks").update(transition.patch).eq("id", row.id);
    await admin.from("task_events").insert({
      clinic_id: clinicId,
      task_id: row.id,
      actor_id: null,
      kind: "escalated",
      data: transition.event.data,
    });
    if (esc.toId) {
      await admin.from("staff_notifications").insert({
        clinic_id: clinicId,
        recipient_id: esc.toId,
        sender_id: null,
        kind: "task_escalated",
        title: "A task was escalated to you",
        body: `${row.title} has waited too long and is now yours.`,
      });
    }
  }
}

type RecordsOfferRow = OfferRowLike & {
  id: string;
  headline?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  claimed_at?: string | null;
};
type RecordsDocumentRow = {
  patient_id: string;
  title?: string | null;
  status?: string | null;
  signed_at?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
};
type RecordsCheckinRow = { patient_id: string; created_at: string };

/** Rows the Records builder needs beyond the patient list. */
export async function loadRecordsRows(ctx: Ctx, now: Date) {
  const [
    { data: treatments },
    { data: appointments },
    { data: plans },
    { data: messages },
    { data: journalEntries },
    { data: offers },
    { data: tasks },
    { data: documents },
    { data: checkins },
  ] = await Promise.all([
    ctx.supabase
      .from("treatments")
      .select("patient_id, name, performed_at, next_due_at, practitioner_id, price"),
    ctx.supabase
      .from("appointments")
      .select(
        "id, patient_id, status, starts_at, created_at, practitioner_id, catalogue_id, treatment_name",
      )
      .gte("starts_at", daysAgoISO(now, 120)),
    ctx.supabase
      .from("treatment_plans")
      .select("id, patient_id, practitioner_id, name, phase, status, catalogue_id, total_sessions")
      .eq("status", "active"),
    ctx.supabase
      .from("messages")
      .select("id, patient_id, author, body, created_at, read_at")
      .gte("created_at", daysAgoISO(now, 30)),
    ctx.supabase
      .from("journal_entries")
      .select("id, patient_id, created_at, shared_with_clinic")
      .gte("created_at", daysAgoISO(now, 30)),
    ctx.supabase
      .from("patient_offers")
      .select("id, patient_id, status, headline, expires_at, sent_at, viewed_at, claimed_at")
      .in("status", ["sent", "viewed"]),
    ctx.supabase.from("tasks").select("*").in("status", ["open", "snoozed"]),
    ctx.supabase
      .from("documents")
      .select("patient_id, title, status, signed_at, sent_at, created_at")
      .gte("created_at", daysAgoISO(now, 180)),
    ctx.supabase
      .from("recovery_checkins")
      .select("patient_id, created_at")
      .gte("created_at", daysAgoISO(now, 30)),
  ]);
  const planRows = (plans ?? []) as PlanRowLike[];
  const entryRows = (journalEntries ?? []) as JournalEntryRowLike[];
  const [{ data: milestones }, { data: attachments }] = await Promise.all([
    planRows.length
      ? ctx.supabase
          .from("plan_milestones")
          .select("id, plan_id, idx, title, kind, status, due_date, appointment_id")
          .in(
            "plan_id",
            planRows.map((p) => p.id),
          )
      : Promise.resolve({ data: [] as MilestoneRowLike[] }),
    entryRows.length
      ? ctx.supabase
          .from("journal_attachments")
          .select("entry_id, kind")
          .in(
            "entry_id",
            entryRows.map((e) => e.id),
          )
      : Promise.resolve({ data: [] as JournalAttachmentRowLike[] }),
  ]);
  return {
    treatments: (treatments ?? []) as TreatmentRowLike[],
    appointments: (appointments ?? []) as AppointmentRowLike[],
    treatmentPlans: planRows,
    planMilestones: (milestones ?? []) as MilestoneRowLike[],
    messages: (messages ?? []) as MessageRowLike[],
    journalEntries: entryRows,
    journalAttachments: (attachments ?? []) as JournalAttachmentRowLike[],
    patientOffers: (offers ?? []) as RecordsOfferRow[],
    tasks: (tasks ?? []) as TaskRow[],
    documents: (documents ?? []) as RecordsDocumentRow[],
    recoveryCheckins: (checkins ?? []) as RecordsCheckinRow[],
  };
}

export { planFacts };
