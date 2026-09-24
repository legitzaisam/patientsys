/**
 * Putting an offer in front of patients. One code path for the record's
 * Send offer, the table's bulk send, the Insights lists and the automation;
 * production and demo differ only in the store they pass in.
 */
import { assertCanSend, prefsFromPatient, type CommsChannel, type CommsPrefs } from "@/lib/comms/preferences";
import type { EnqueueInput } from "@/lib/comms/enqueue.server";
import { offerClaimUrl, offerExpiry, renderOffer, type OfferSource, type TemplateStage } from "./stages";

export type SendableTemplate = {
  id: string;
  stage: TemplateStage;
  subject: string;
  headline: string;
  body: string;
  value_text: string | null;
  code: string | null;
  cta_label: string;
  valid_days: number;
  send_email: boolean;
  send_sms: boolean;
  show_in_portal: boolean;
};

export type SendablePatient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  status: string | null;
  marketing_opt_in?: boolean | null;
  email_opt_in?: boolean | null;
  sms_opt_in?: boolean | null;
  reminders_opt_in?: boolean | null;
  unsubscribed_at?: string | null;
};

export type PatientOfferInsert = {
  clinic_id: string;
  patient_id: string;
  template_id: string;
  stage: string;
  headline: string;
  body: string;
  value_text: string | null;
  code: string | null;
  cta_label: string;
  status: "sent";
  source: OfferSource;
  sent_by: string | null;
  sent_at: string;
  expires_at: string;
};

export type OfferStore = {
  clinicId: string;
  clinicName: string;
  /** Absolute origin for the claim link, e.g. https://clinic.example. */
  origin: string;
  getPatients(ids: string[]): Promise<SendablePatient[]>;
  insertOffer(row: PatientOfferInsert): Promise<string>;
  linkCommunication(offerId: string, communicationId: string): Promise<void>;
  /** Throws with the PECR reason when the send is not allowed. */
  enqueue(input: EnqueueInput & { bodyHtml?: string | null }): Promise<{ id: string }>;
};

type Decision = { ok: true } | { ok: false; reason: string };

export type SendResult = {
  sent: { patient_id: string; name: string; offer_id: string; channels: CommsChannel[]; note: string | null }[];
  skipped: { patient_id: string; name: string; reason: string }[];
};

export async function sendOfferToPatients(
  store: OfferStore,
  template: SendableTemplate,
  patientIds: string[],
  opts: {
    source: OfferSource;
    sentBy: string | null;
    personalLine?: string | null;
    /**
     * One-off sends still create the portal card when the patient has not
     * consented to marketing email (staff are told up front). Automation
     * skips them instead: an unasked-for marketing card is not what the
     * patient signed up for.
     */
    portalOnlyWhenNoConsent: boolean;
    now?: Date;
  },
): Promise<SendResult> {
  const now = opts.now ?? new Date();
  const result: SendResult = { sent: [], skipped: [] };
  const ids = [...new Set(patientIds)];
  if (ids.length === 0) return result;
  const patients = await store.getPatients(ids);
  const byId = new Map(patients.map((p) => [p.id, p]));

  for (const patientId of ids) {
    const patient = byId.get(patientId);
    if (!patient) {
      result.skipped.push({ patient_id: patientId, name: "Unknown patient", reason: "Patient not found." });
      continue;
    }
    const name = `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || "Patient";
    if (patient.status === "archived") {
      result.skipped.push({ patient_id: patientId, name, reason: "This patient is archived." });
      continue;
    }
    const prefs = prefsFromPatient(patient as Partial<CommsPrefs>);
    const email: Decision = template.send_email
      ? assertCanSend(prefs, "marketing", "email", (patient.email ?? "").trim())
      : { ok: false, reason: "Email is switched off for this template." };
    const sms: Decision = template.send_sms
      ? assertCanSend(prefs, "marketing", "sms", (patient.phone ?? "").trim())
      : { ok: false, reason: "SMS is switched off for this template." };
    const blockedReason = !email.ok ? email.reason : !sms.ok ? sms.reason : null;

    const anyChannel = email.ok || sms.ok;
    if (!anyChannel && (!template.show_in_portal || !opts.portalOnlyWhenNoConsent)) {
      result.skipped.push({ patient_id: patientId, name, reason: blockedReason ?? "No channel available." });
      continue;
    }

    const sentAt = now.toISOString();
    const expiresAt = offerExpiry(sentAt, template.valid_days);
    const offerId = await store.insertOffer({
      clinic_id: store.clinicId,
      patient_id: patientId,
      template_id: template.id,
      stage: template.stage,
      headline: template.headline,
      body: template.body,
      value_text: template.value_text,
      code: template.code,
      cta_label: template.cta_label,
      status: "sent",
      source: opts.source,
      sent_by: opts.sentBy,
      sent_at: sentAt,
      expires_at: expiresAt,
    });

    const rendered = renderOffer(template, patient, {
      clinicName: store.clinicName,
      claimUrl: offerClaimUrl(store.origin, offerId),
      personalLine: opts.personalLine ?? null,
      expiresAt,
    });
    const channels: CommsChannel[] = [];
    if (email.ok) {
      const { id } = await store.enqueue({
        clinicId: store.clinicId,
        patientId,
        channel: "email",
        purpose: "marketing",
        subject: rendered.subject,
        body: rendered.text,
        bodyHtml: rendered.html,
        templateKey: "offer",
        relatedEntity: "patient_offers",
        relatedId: offerId,
        createdBy: opts.sentBy,
      });
      await store.linkCommunication(offerId, id);
      channels.push("email");
    }
    if (sms.ok) {
      const smsBody = [
        `${store.clinicName}: ${rendered.card.headline}.`,
        rendered.card.value_text,
        rendered.card.code ? `Quote ${rendered.card.code} when you book.` : null,
        offerClaimUrl(store.origin, offerId),
      ]
        .filter(Boolean)
        .join(" ");
      await store.enqueue({
        clinicId: store.clinicId,
        patientId,
        channel: "sms",
        purpose: "marketing",
        body: smsBody,
        templateKey: "offer",
        relatedEntity: "patient_offers",
        relatedId: offerId,
        createdBy: opts.sentBy,
      });
      channels.push("sms");
    }
    result.sent.push({
      patient_id: patientId,
      name,
      offer_id: offerId,
      channels,
      note: channels.length === 0 ? `Portal only — ${blockedReason ?? "no channel available."}` : null,
    });
  }
  return result;
}

/** How a one-off send to this patient would go, for the dialog to say up front. */
export function describeOfferChannels(
  patient: Partial<SendablePatient>,
  template: Pick<SendableTemplate, "send_email" | "send_sms" | "show_in_portal">,
) {
  const prefs = prefsFromPatient(patient as Partial<CommsPrefs>);
  const email = template.send_email && assertCanSend(prefs, "marketing", "email", (patient.email ?? "").trim());
  const sms = template.send_sms && assertCanSend(prefs, "marketing", "sms", (patient.phone ?? "").trim());
  const channels: string[] = [];
  if (email && email.ok) channels.push("email");
  if (sms && sms.ok) channels.push("SMS");
  if (template.show_in_portal) channels.push("portal card");
  const blocked = email && !email.ok ? email.reason : sms && !sms.ok ? sms.reason : null;
  return { channels, blocked, portalOnly: channels.length === 1 && channels[0] === "portal card" };
}
