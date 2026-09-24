/** Read-side shapes shared by the portal, the record page and the designer. */
import type { OfferSource, OfferStatus, TemplateStage } from "./stages";

export type OfferTemplateRow = {
  id: string;
  clinic_id: string;
  name: string;
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
  automation_enabled: boolean;
  automation_delay_days: number;
  last_automation_at: string | null;
  created_by: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  /** From listOfferTemplates: sends by effective status. */
  counts?: Record<string, number>;
};

export const OFFER_STATUS_LABEL: Record<OfferStatus, string> = {
  sent: "Sent",
  viewed: "Viewed",
  claimed: "Claimed",
  expired: "Expired",
  cancelled: "Withdrawn",
};

export const OFFER_SOURCE_LABEL: Record<OfferSource, string> = {
  automation: "Automatic",
  one_off: "From the record",
  bulk: "Patient list",
  insights: "Insights",
};

export function shortDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export type PatientOfferRow = {
  id: string;
  patient_id: string;
  template_id: string | null;
  stage: string;
  headline: string;
  body: string;
  value_text: string | null;
  code: string | null;
  cta_label: string;
  status: string;
  source: string;
  communication_id: string | null;
  sent_by: string | null;
  sent_at: string;
  viewed_at: string | null;
  claimed_at: string | null;
  expires_at: string | null;
};

export type PatientOfferView = {
  id: string;
  patient_id: string;
  template_id: string | null;
  stage: TemplateStage;
  headline: string;
  body: string;
  value_text: string | null;
  code: string | null;
  cta_label: string;
  status: OfferStatus;
  source: OfferSource;
  communication_id: string | null;
  sent_by: string | null;
  sent_at: string;
  viewed_at: string | null;
  claimed_at: string | null;
  expires_at: string | null;
  /** Still claimable: sent or viewed and not past its expiry. */
  live: boolean;
};

/** A sent or viewed offer past its expiry reads as expired without a write. */
export function effectiveOfferStatus(row: Pick<PatientOfferRow, "status" | "expires_at">, now = new Date()): OfferStatus {
  const status = row.status as OfferStatus;
  if ((status === "sent" || status === "viewed") && row.expires_at && new Date(row.expires_at) < now) {
    return "expired";
  }
  return status;
}

export function patientOfferView(row: PatientOfferRow, now = new Date()): PatientOfferView {
  const status = effectiveOfferStatus(row, now);
  return {
    id: row.id,
    patient_id: row.patient_id,
    template_id: row.template_id,
    stage: row.stage as TemplateStage,
    headline: row.headline,
    body: row.body,
    value_text: row.value_text,
    code: row.code,
    cta_label: row.cta_label,
    status,
    source: row.source as OfferSource,
    communication_id: row.communication_id,
    sent_by: row.sent_by,
    sent_at: row.sent_at,
    viewed_at: row.viewed_at,
    claimed_at: row.claimed_at,
    expires_at: row.expires_at,
    live: status === "sent" || status === "viewed",
  };
}

/** The claimed, unexpired offer front desk should apply at booking, if any. */
export function liveClaimedOffer<T extends Pick<PatientOfferRow, "status" | "expires_at" | "claimed_at">>(
  rows: T[],
  now = new Date(),
): T | null {
  return (
    rows
      .filter((r) => r.status === "claimed" && (!r.expires_at || new Date(r.expires_at) >= now))
      .sort((a, b) => (b.claimed_at ?? "").localeCompare(a.claimed_at ?? ""))[0] ?? null
  );
}
