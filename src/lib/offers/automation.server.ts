/**
 * Stage automation. Runs at the start of every outbox drain — the cron route
 * (admin client, every clinic) and the staff "Process queue" (request client,
 * one clinic) — so switching a stage on means "goes out on the next run".
 *
 * For each enabled template: today's cohort for its stage, minus anyone
 * already offered that stage, minus anyone still inside the delay, minus
 * anyone without marketing consent (automation never creates a portal-only
 * card; that is a decision a person makes). Then the shared send path with
 * `source: automation`. The partial unique index on `patient_offers` makes a
 * concurrent second run a no-op rather than a double send.
 */
import { enqueueCommunication } from "@/lib/comms/enqueue.server";
import { buildStageCohorts, previewStage } from "./cohorts";
import { sendOfferToPatients, type OfferStore } from "./send";
import type { OfferStage } from "./stages";

type Db = { from: (table: string) => any };

export type AutomationSummary = { templates: number; sent: number; skipped: number };

const PATIENT_COLUMNS =
  "id, first_name, last_name, email, phone, status, created_at, marketing_opt_in, email_opt_in, sms_opt_in, reminders_opt_in, unsubscribed_at";

export async function runOfferAutomation(
  db: Db,
  opts: { clinicId?: string; origin?: string | null; now?: Date } = {},
): Promise<AutomationSummary> {
  const summary: AutomationSummary = { templates: 0, sent: 0, skipped: 0 };
  let q = db
    .from("offer_templates")
    .select("*")
    .eq("automation_enabled", true)
    .is("archived_at", null)
    .neq("stage", "custom");
  if (opts.clinicId) q = q.eq("clinic_id", opts.clinicId);
  const { data: templates, error } = await q;
  if (error) throw new Error(error.message);
  if (!templates || templates.length === 0) return summary;

  const byClinic = new Map<string, any[]>();
  for (const t of templates as any[]) {
    const list = byClinic.get(t.clinic_id) ?? [];
    list.push(t);
    byClinic.set(t.clinic_id, list);
  }
  const origin = (opts.origin?.trim() || process.env["APP_ORIGIN"]?.trim() || "").replace(/\/$/, "");
  const now = opts.now ?? new Date();

  for (const [clinicId, clinicTemplates] of byClinic) {
    const input = await cohortInput(db, clinicId);
    const members = buildStageCohorts({ ...input, now });
    const { data: clinicRow } = await db.from("clinics").select("name").eq("id", clinicId).maybeSingle();
    const store: OfferStore = {
      clinicId,
      clinicName: clinicRow?.name ?? "Your clinic",
      origin,
      async getPatients(ids) {
        const { data, error: e } = await db.from("patients").select(PATIENT_COLUMNS).in("id", ids);
        if (e) throw new Error(e.message);
        return data ?? [];
      },
      async insertOffer(row) {
        const { data, error: e } = await db.from("patient_offers").insert(row).select("id").single();
        if (e) throw new Error(e.message);
        return data.id as string;
      },
      async linkCommunication(offerId, communicationId) {
        const { error: e } = await db
          .from("patient_offers")
          .update({ communication_id: communicationId })
          .eq("id", offerId);
        if (e) throw new Error(e.message);
      },
      enqueue: (i) => enqueueCommunication(db, i),
    };

    for (const tmpl of clinicTemplates) {
      summary.templates += 1;
      const preview = previewStage(
        members,
        input.patients,
        input.offers,
        tmpl.stage as OfferStage,
        Number(tmpl.automation_delay_days ?? 0),
        now,
      );
      summary.skipped += preview.skipped.length;
      if (preview.willSend.length > 0) {
        const result = await sendOfferToPatients(
          store,
          tmpl,
          preview.willSend.map((r) => r.patient_id),
          { source: "automation", sentBy: null, portalOnlyWhenNoConsent: false, now },
        );
        summary.sent += result.sent.length;
        summary.skipped += result.skipped.length;
        // Keep the in-memory list current so a second template in the same
        // run does not re-offer the same patient for the same stage.
        for (const s of result.sent) {
          input.offers.push({ patient_id: s.patient_id, stage: tmpl.stage, status: "sent", source: "automation" });
        }
      }
      await db
        .from("offer_templates")
        .update({ last_automation_at: now.toISOString() })
        .eq("id", tmpl.id);
    }
  }
  return summary;
}

async function cohortInput(db: Db, clinicId: string) {
  const [patients, appointments, treatments, catalogue, plans, offers] = await Promise.all([
    db.from("patients").select(PATIENT_COLUMNS).eq("clinic_id", clinicId),
    db
      .from("appointments")
      .select("patient_id, starts_at, status, treatment_name, catalogue_id")
      .eq("clinic_id", clinicId),
    db.from("treatments").select("patient_id, performed_at, name, catalogue_id").eq("clinic_id", clinicId),
    db.from("treatment_catalogue").select("id, category").eq("clinic_id", clinicId),
    db
      .from("treatment_plans")
      .select("id, patient_id, status, started_at, duration_days, total_sessions")
      .eq("clinic_id", clinicId)
      .eq("status", "active"),
    db.from("patient_offers").select("patient_id, stage, status, source").eq("clinic_id", clinicId),
  ]);
  for (const r of [patients, appointments, treatments, catalogue, plans, offers]) {
    if (r.error) throw new Error(r.error.message);
  }
  const planIds = (plans.data ?? []).map((p: any) => p.id as string);
  const milestones = planIds.length
    ? await db.from("plan_milestones").select("plan_id, kind, status").in("plan_id", planIds)
    : { data: [], error: null };
  if (milestones.error) throw new Error(milestones.error.message);
  return {
    patients: (patients.data ?? []) as any[],
    appointments: (appointments.data ?? []) as any[],
    treatments: (treatments.data ?? []) as any[],
    catalogue: (catalogue.data ?? []) as any[],
    plans: (plans.data ?? []) as any[],
    milestones: (milestones.data ?? []) as any[],
    offers: (offers.data ?? []) as any[],
  };
}
