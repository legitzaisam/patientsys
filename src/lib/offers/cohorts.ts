/**
 * Who is in which offer stage today. Pure: production and demo gather the
 * rows (patients, appointments, treatments, plans, milestones, existing
 * offers) and hand them here, the same way `buildInsights` works.
 */
import { isConsultation } from "@/lib/insights.server";
import { assertCanSend, prefsFromPatient, type CommsPrefs } from "@/lib/comms/preferences";
import {
  delayElapsed,
  OFFER_STAGES,
  stageOf,
  type OfferStage,
  type PatientFacts,
} from "./stages";

export type CohortPatientRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  created_at: string;
  marketing_opt_in?: boolean | null;
  email_opt_in?: boolean | null;
  sms_opt_in?: boolean | null;
  reminders_opt_in?: boolean | null;
  unsubscribed_at?: string | null;
};

export type CohortInput = {
  patients: CohortPatientRow[];
  appointments: {
    patient_id: string;
    starts_at: string;
    status: string | null;
    treatment_name: string | null;
    catalogue_id: string | null;
  }[];
  treatments: {
    patient_id: string;
    performed_at: string;
    name: string | null;
    catalogue_id: string | null;
  }[];
  catalogue: { id: string; category: string | null }[];
  plans: {
    id: string;
    patient_id: string;
    status: string | null;
    started_at: string | null;
    duration_days: number | null;
    total_sessions: number | null;
  }[];
  milestones: { plan_id: string; kind: string | null; status: string | null }[];
  offers: { patient_id: string; stage: string; status: string; source: string }[];
  now?: Date;
};

export type CohortMember = {
  patient_id: string;
  name: string;
  email: string | null;
  stage: OfferStage;
  /** ISO date the patient entered the stage. */
  since: string;
  facts: PatientFacts;
};

/** Every patient with a stage, plus the facts that put them there. */
export function buildStageCohorts(input: CohortInput): CohortMember[] {
  const now = input.now ?? new Date();
  const catalogueById = new Map(input.catalogue.map((c) => [c.id, c]));
  const consult = (name: string | null, catalogueId: string | null) =>
    isConsultation({
      name,
      category: catalogueId ? catalogueById.get(catalogueId)?.category ?? null : null,
    });

  const apptsBy = groupBy(input.appointments, (a) => a.patient_id);
  const txBy = groupBy(input.treatments, (t) => t.patient_id);
  const plansBy = groupBy(input.plans, (p) => p.patient_id);
  const milestonesBy = groupBy(input.milestones, (m) => m.plan_id);

  const members: CohortMember[] = [];
  for (const patient of input.patients) {
    if (patient.status === "archived") continue;
    const appts = apptsBy.get(patient.id) ?? [];
    const tx = txBy.get(patient.id) ?? [];

    const consultDates = [
      ...tx.filter((t) => consult(t.name, t.catalogue_id)).map((t) => t.performed_at),
      ...appts
        .filter((a) => a.status !== "cancelled" && a.status !== "no_show" && consult(a.treatment_name, a.catalogue_id))
        .map((a) => a.starts_at),
    ].sort();
    const treatmentDates = tx
      .filter((t) => !consult(t.name, t.catalogue_id))
      .map((t) => t.performed_at)
      .sort();
    const hasUpcomingBooking = appts.some(
      (a) => a.status !== "cancelled" && a.status !== "no_show" && new Date(a.starts_at) >= now,
    );
    const active = (plansBy.get(patient.id) ?? []).find((p) => p.status === "active");
    const activePlan = active
      ? {
          startedAt: active.started_at ?? patient.created_at,
          durationDays: active.duration_days ?? null,
          sessionsTotal: active.total_sessions ?? 0,
          sessionsDone: (milestonesBy.get(active.id) ?? []).filter(
            (m) => m.kind === "session" && (m.status === "done" || m.status === "skipped"),
          ).length,
        }
      : null;

    const facts: PatientFacts = {
      createdAt: patient.created_at,
      firstConsultAt: consultDates[0] ?? null,
      treatmentDates,
      hasUpcomingBooking,
      activePlan,
    };
    const result = stageOf(facts, now);
    if (!result) continue;
    members.push({
      patient_id: patient.id,
      name: `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || "Patient",
      email: patient.email?.trim() || null,
      stage: result.stage,
      since: result.since,
      facts,
    });
  }
  return members;
}

export type PreviewRow = { patient_id: string; name: string; email: string | null; since: string };
export type SkipReason =
  | "no_marketing_consent"
  | "already_offered"
  | "no_email"
  | "waiting_for_delay";

export type StagePreview = {
  stage: OfferStage;
  willSend: PreviewRow[];
  skipped: (PreviewRow & { reason: SkipReason; detail: string })[];
};

/**
 * Split one stage's cohort into who receives the offer on the next run and
 * who is skipped, with the reason. Used for the designer's preview and by the
 * automation itself, so what staff see is what will happen.
 */
export function previewStage(
  members: CohortMember[],
  patients: CohortPatientRow[],
  offers: CohortInput["offers"],
  stage: OfferStage,
  delayDays: number,
  now = new Date(),
): StagePreview {
  const patientById = new Map(patients.map((p) => [p.id, p]));
  const offered = new Set(offers.filter((o) => o.stage === stage).map((o) => o.patient_id));
  const preview: StagePreview = { stage, willSend: [], skipped: [] };
  for (const m of members.filter((m) => m.stage === stage)) {
    const row: PreviewRow = { patient_id: m.patient_id, name: m.name, email: m.email, since: m.since };
    const patient = patientById.get(m.patient_id);
    if (!patient) continue;
    if (offered.has(m.patient_id)) {
      preview.skipped.push({ ...row, reason: "already_offered", detail: "Already offered this stage." });
      continue;
    }
    const decision = assertCanSend(prefsFromPatient(patient as Partial<CommsPrefs>), "marketing", "email", m.email ?? "");
    if (!decision.ok) {
      preview.skipped.push({
        ...row,
        reason: m.email ? "no_marketing_consent" : "no_email",
        detail: decision.reason,
      });
      continue;
    }
    if (!delayElapsed(m.since, delayDays, now)) {
      const readyOn = new Date(new Date(m.since).getTime() + delayDays * 86400000);
      preview.skipped.push({
        ...row,
        reason: "waiting_for_delay",
        detail: `In this stage for ${Math.max(0, Math.floor((now.getTime() - new Date(m.since).getTime()) / 86400000))} of ${delayDays} days; ready ${readyOn.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.`,
      });
      continue;
    }
    preview.willSend.push(row);
  }
  return preview;
}

/** Counts per stage for the designer's stage cards. */
export function stageCounts(members: CohortMember[]) {
  const counts = Object.fromEntries(OFFER_STAGES.map((s) => [s, 0])) as Record<OfferStage, number>;
  for (const m of members) counts[m.stage] += 1;
  return counts;
}

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}
