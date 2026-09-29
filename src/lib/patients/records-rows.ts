import { clinicDayDiff, clinicDayKey } from "@/lib/clinic-time";
import { visitsByPatient } from "@/lib/metrics/definitions";
import {
  patientType,
  type PatientType,
  type PlanFacts,
  type PortalSignal,
} from "@/lib/patients/records-summary";
import { isOpen, type TaskRow } from "@/lib/tasks/service";
import { planFacts, primaryPractitioners, type SnapshotRows } from "@/lib/tasks/snapshot";
import { taskDueLabel, dueBucket, type TaskType } from "@/lib/tasks/types";
import { triageMessage, questionPreview } from "@/lib/tasks/urgent-triage";

/**
 * The per-patient facts the Records table and its drawer need beyond what
 * `listPatients` already returns: patient type, primary practitioner, active
 * plan, open tasks (from `tasks`), the portal signal, a pending offer and a
 * short activity feed. Built once for the whole list from raw rows, in
 * production and in the demo alike.
 */

export type RecordsOpenTask = {
  id: string;
  type: TaskType;
  title: string;
  assigneeId: string | null;
  assigneeName: string | null;
  dueLabel: string;
  late: boolean;
};

export type RecordsActivity = { text: string; at: string };

export type RecordsSummary = {
  type: PatientType;
  visitCount: number;
  primaryPractitionerId: string | null;
  primaryPractitionerName: string | null;
  plan: (PlanFacts & { phase: string }) | null;
  planStep: { title: string; dueDate: string | null; overdue: boolean } | null;
  noShowAt: string | null;
  openTasks: RecordsOpenTask[];
  portal: PortalSignal | null;
  pendingOffer: { id: string; headline: string } | null;
  activity: RecordsActivity[];
};

type DocumentRowLike = {
  patient_id: string;
  title?: string | null;
  status?: string | null;
  signed_at?: string | null;
  sent_at?: string | null;
  created_at?: string | null;
};
type CheckinRowLike = { patient_id: string; created_at: string };
type OfferRowLike = {
  id: string;
  patient_id: string;
  status: string;
  headline?: string | null;
  expires_at?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  claimed_at?: string | null;
};
type PatientRowLike = {
  id: string;
  first_name?: string | null;
  status?: string | null;
  user_id?: string | null;
  created_at?: string | null;
};

export type RecordsRows = Omit<SnapshotRows, "rules" | "ownerId" | "patientOffers" | "patients"> & {
  patients: PatientRowLike[];
  patientOffers: OfferRowLike[];
  documents: DocumentRowLike[];
  recoveryCheckins: CheckinRowLike[];
  nameOf: (id: string | null | undefined) => string | null;
};

const ACTIVITY_LIMIT = 4;
const QUIET_DAYS = 14;

export function buildRecordsSummaries(rows: RecordsRows): Map<string, RecordsSummary> {
  const now = rows.now;
  const nowISO = now.toISOString();
  const todayKey = clinicDayKey(now);
  const plans = planFacts(rows);
  const planByPatient = new Map<string, (typeof plans)[number]>();
  for (const p of plans) if (!planByPatient.has(p.patientId)) planByPatient.set(p.patientId, p);
  const practitioners = primaryPractitioners({
    patients: rows.patients,
    treatments: rows.treatments,
    appointments: rows.appointments,
    plans,
    now,
  });
  const visits = visitsByPatient(rows.treatments);

  const tasksBy = new Map<string, TaskRow[]>();
  for (const t of rows.tasks) {
    if (!isOpen(t)) continue;
    const list = tasksBy.get(t.patient_id) ?? [];
    list.push(t);
    tasksBy.set(t.patient_id, list);
  }
  const messagesBy = new Map<string, RecordsRows["messages"]>();
  for (const m of rows.messages) {
    const list = messagesBy.get(m.patient_id) ?? [];
    list.push(m);
    messagesBy.set(m.patient_id, list);
  }
  const photoCount = new Map<string, number>();
  for (const a of rows.journalAttachments)
    if (a.kind === "photo") photoCount.set(a.entry_id, (photoCount.get(a.entry_id) ?? 0) + 1);
  const journalBy = new Map<string, Array<{ at: string; photos: number }>>();
  for (const e of rows.journalEntries) {
    if (e.shared_with_clinic === false) continue;
    const list = journalBy.get(e.patient_id) ?? [];
    list.push({ at: e.created_at, photos: photoCount.get(e.id) ?? 0 });
    journalBy.set(e.patient_id, list);
  }
  const checkinsBy = new Map<string, string[]>();
  for (const c of rows.recoveryCheckins) {
    const list = checkinsBy.get(c.patient_id) ?? [];
    list.push(c.created_at);
    checkinsBy.set(c.patient_id, list);
  }
  const docsBy = new Map<string, DocumentRowLike[]>();
  for (const d of rows.documents) {
    const list = docsBy.get(d.patient_id) ?? [];
    list.push(d);
    docsBy.set(d.patient_id, list);
  }
  const offersBy = new Map<string, OfferRowLike[]>();
  for (const o of rows.patientOffers) {
    const list = offersBy.get(o.patient_id) ?? [];
    list.push(o);
    offersBy.set(o.patient_id, list);
  }
  const attendedBy = new Map<string, RecordsRows["appointments"]>();
  for (const a of rows.appointments) {
    if (a.status !== "attended") continue;
    const list = attendedBy.get(a.patient_id) ?? [];
    list.push(a);
    attendedBy.set(a.patient_id, list);
  }

  const out = new Map<string, RecordsSummary>();
  for (const p of rows.patients) {
    const plan = planByPatient.get(p.id) ?? null;
    const mine = visits.get(p.id) ?? [];
    const planFactsOut: RecordsSummary["plan"] = plan
      ? {
          id: plan.id,
          name: plan.name,
          done: plan.done,
          total: plan.total,
          nextStep: plan.nextStepTitle,
          overdue: plan.overdue,
          phase: plan.phase,
        }
      : null;
    const openTasks: RecordsOpenTask[] = (tasksBy.get(p.id) ?? [])
      .sort((a, b) => a.priority - b.priority || (a.due_at ?? "9").localeCompare(b.due_at ?? "9"))
      .map((t) => ({
        id: t.id,
        type: t.type,
        title: t.title,
        assigneeId: t.assignee_id,
        assigneeName: t.assignee_id
          ? rows.nameOf(t.assignee_id)
          : t.assignee_role === "front_desk"
            ? "Front desk pool"
            : null,
        dueLabel: taskDueLabel({ dueAt: t.due_at, type: t.type, escalated: !!t.escalated_at }, now),
        late: dueBucket(t.due_at, now) === "overdue",
      }));

    // Portal signal, most telling first.
    const msgs = [...(messagesBy.get(p.id) ?? [])].sort((a, b) =>
      a.created_at > b.created_at ? -1 : 1,
    );
    const lastPatientMsg = msgs.find((m) => m.author === "patient") ?? null;
    const urgent =
      msgs.find((m) => m.author === "patient" && !m.read_at && triageMessage(m.body).urgent) ??
      null;
    const recentPhotos = (journalBy.get(p.id) ?? []).filter(
      (j) => j.photos > 0 && clinicDayDiff(clinicDayKey(new Date(j.at)), todayKey) <= 7,
    );
    const unsignedForms = (docsBy.get(p.id) ?? []).filter(
      (d) => d.status === "sent" || d.status === "viewed",
    );
    const lastPortalAt = [
      lastPatientMsg?.created_at,
      ...(journalBy.get(p.id) ?? []).map((j) => j.at),
      ...(checkinsBy.get(p.id) ?? []),
    ]
      .filter((x): x is string => !!x)
      .sort()
      .at(-1);
    let portal: PortalSignal | null = null;
    if (urgent)
      portal = {
        kind: "urgent_question",
        when: urgent.created_at,
        preview: questionPreview(urgent.body ?? ""),
      };
    else if (recentPhotos.length) {
      const latest = recentPhotos.sort((a, b) => (a.at > b.at ? -1 : 1))[0]!;
      portal = {
        kind: "photos_uploaded",
        count: recentPhotos.reduce((n, j) => n + j.photos, 0),
        when: latest.at,
      };
    } else if (mine.length === 0 && unsignedForms.length)
      portal = { kind: "form_incomplete", percent: 80 };
    else if (
      lastPatientMsg &&
      clinicDayDiff(clinicDayKey(new Date(lastPatientMsg.created_at)), todayKey) <= 3
    )
      portal = { kind: "replied", when: lastPatientMsg.created_at };
    else if (
      p.user_id &&
      lastPortalAt &&
      clinicDayDiff(clinicDayKey(new Date(lastPortalAt)), todayKey) >= QUIET_DAYS
    )
      portal = {
        kind: "quiet",
        days: clinicDayDiff(clinicDayKey(new Date(lastPortalAt)), todayKey),
      };

    const liveOffer =
      (offersBy.get(p.id) ?? []).find(
        (o) =>
          (o.status === "sent" || o.status === "viewed") &&
          (!o.expires_at || o.expires_at > nowISO),
      ) ?? null;

    // Activity: newest first, from the portal and the diary.
    const activity: RecordsActivity[] = [];
    for (const m of msgs.filter((m) => m.author === "patient").slice(0, 2)) {
      activity.push({
        text: `Sent a message: “${questionPreview(m.body ?? "", 48)}”`,
        at: m.created_at,
      });
    }
    for (const j of (journalBy.get(p.id) ?? []).filter((j) => j.photos > 0).slice(-2)) {
      activity.push({
        text: `Uploaded ${j.photos} progress photo${j.photos === 1 ? "" : "s"}`,
        at: j.at,
      });
    }
    for (const c of (checkinsBy.get(p.id) ?? []).slice(-1))
      activity.push({ text: "Completed aftercare check-in", at: c });
    for (const d of (docsBy.get(p.id) ?? [])
      .filter((d) => d.status === "signed" && d.signed_at)
      .slice(-1)) {
      activity.push({ text: `Signed ${d.title ?? "a form"}`, at: d.signed_at! });
    }
    for (const a of (attendedBy.get(p.id) ?? [])
      .sort((x, y) => (x.starts_at > y.starts_at ? -1 : 1))
      .slice(0, 2)) {
      const who = rows.nameOf(a.practitioner_id ?? null);
      activity.push({
        text: `${a.treatment_name ?? "Visit"}${who ? ` · ${who}` : ""}`,
        at: a.starts_at,
      });
    }
    if (liveOffer)
      activity.push({
        text: `Win-back offer drafted: ${liveOffer.headline ?? "offer"}`,
        at: liveOffer.sent_at ?? nowISO,
      });
    for (const t of (tasksBy.get(p.id) ?? []).filter((t) => t.source === "manual").slice(0, 1)) {
      activity.push({
        text: `Task assigned by ${rows.nameOf(t.created_by) ?? "the clinic"}`,
        at: t.created_at,
      });
    }
    activity.sort((a, b) => (a.at > b.at ? -1 : 1));

    const primaryId = practitioners.get(p.id) ?? null;
    out.set(p.id, {
      type: patientType({ plan: planFactsOut, visitCount: mine.length }),
      visitCount: mine.length,
      primaryPractitionerId: primaryId,
      primaryPractitionerName: rows.nameOf(primaryId),
      plan: planFactsOut,
      planStep: plan?.nextMilestone
        ? {
            title: plan.nextMilestone.title,
            dueDate: plan.nextMilestone.dueDate,
            overdue: plan.overdue,
          }
        : null,
      noShowAt: plan?.noShowAt ?? null,
      openTasks,
      portal,
      pendingOffer: liveOffer
        ? { id: liveOffer.id, headline: liveOffer.headline ?? "Win-back offer" }
        : null,
      activity: activity.slice(0, ACTIVITY_LIMIT),
    });
  }
  return out;
}
