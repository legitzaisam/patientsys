/**
 * Who is in which offer stage today. Pure: production and demo gather the
 * rows (patients, appointments, treatments, plans, milestones, existing
 * offers) and hand them here, the same way `buildInsights` works.
 */
import { isConsultation } from "@/lib/insights.server";
import { upcomingBookingSet, visitsByPatient } from "@/lib/metrics/definitions";
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
  offers: {
    patient_id: string;
    stage: string;
    status: string;
    source: string;
    template_id?: string | null;
    expires_at?: string | null;
  }[];
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
  // Shared definitions: visits per patient (oldest first) and who has a live booking ahead.
  const txBy = visitsByPatient(input.treatments);
  const upcoming = upcomingBookingSet(input.appointments, now.getTime());
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
    const hasUpcomingBooking = upcoming.has(patient.id);
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
  | "has_live_offer"
  | "no_email"
  | "waiting_for_delay";

export type StagePreview = {
  stage: OfferStage;
  willSend: PreviewRow[];
  /** Due now but without marketing consent: they get the portal card only. */
  portalOnly: PreviewRow[];
  skipped: (PreviewRow & { reason: SkipReason; detail: string })[];
};

/** The template's rules, as `sendOfferToPatients` enforces them. */
export type PreviewRules = {
  templateId?: string | null;
  onePerPatient?: boolean | null;
  noStacking?: boolean | null;
  /** When the template shows a portal card, no-consent patients are "portal only" rather than skipped. */
  showInPortal?: boolean | null;
};

/** Sent, viewed or claimed and not past its expiry. */
export function isLiveOffer(offer: { status: string; expires_at?: string | null }, now: Date) {
  if (offer.status !== "sent" && offer.status !== "viewed" && offer.status !== "claimed") {
    return false;
  }
  return !offer.expires_at || new Date(offer.expires_at) >= now;
}

/**
 * Split one stage's cohort into who receives the offer on the next run, who
 * gets the portal card only, and who is skipped, with the reason. Used for the
 * designer's preview and by the automation itself, so what staff see is what
 * will happen.
 */
export function previewStage(
  members: CohortMember[],
  patients: CohortPatientRow[],
  offers: CohortInput["offers"],
  stage: OfferStage,
  delayDays: number,
  now = new Date(),
  rules: PreviewRules = {},
): StagePreview {
  const patientById = new Map(patients.map((p) => [p.id, p]));
  const offered = new Set(offers.filter((o) => o.stage === stage).map((o) => o.patient_id));
  const hadTemplate = new Set(
    rules.onePerPatient && rules.templateId
      ? offers.filter((o) => o.template_id === rules.templateId).map((o) => o.patient_id)
      : [],
  );
  const hasLive = new Set(
    rules.noStacking ? offers.filter((o) => isLiveOffer(o, now)).map((o) => o.patient_id) : [],
  );
  const preview: StagePreview = { stage, willSend: [], portalOnly: [], skipped: [] };
  for (const m of members.filter((m) => m.stage === stage)) {
    const row: PreviewRow = { patient_id: m.patient_id, name: m.name, email: m.email, since: m.since };
    const patient = patientById.get(m.patient_id);
    if (!patient) continue;
    if (offered.has(m.patient_id)) {
      preview.skipped.push({ ...row, reason: "already_offered", detail: "Already offered this stage." });
      continue;
    }
    if (hadTemplate.has(m.patient_id)) {
      preview.skipped.push({
        ...row,
        reason: "already_offered",
        detail: "Already had this offer (one per patient).",
      });
      continue;
    }
    if (hasLive.has(m.patient_id)) {
      preview.skipped.push({
        ...row,
        reason: "has_live_offer",
        detail: "Has a live offer already (no stacking).",
      });
      continue;
    }
    const decision = assertCanSend(prefsFromPatient(patient as Partial<CommsPrefs>), "marketing", "email", m.email ?? "");
    if (!decision.ok && !rules.showInPortal) {
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
    if (decision.ok) preview.willSend.push(row);
    else preview.portalOnly.push(row);
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
