/**
 * Demo twin of visit-stage.server.ts over the in-memory fixtures. Same rule,
 * same notification, so the arrival → waiting behaviour is identical with
 * DEMO=1.
 */
import {
  CLINIC_ID,
  appointments,
  catalogue,
  documents,
  newId,
  patients,
  staffNotifications,
  userRoles,
} from "@/lib/demo/data";
import type { AdvanceResult } from "@/lib/visit-stage.server";
import { consentReady, consentState, type ConsentState } from "@/lib/visit-stage";

type Row = Record<string, any>;

export function demoConsentStateOf(appt: Row): ConsentState {
  const doc = appt["consent_document_id"]
    ? (documents as Row[]).find((d) => d["id"] === appt["consent_document_id"])
    : null;
  const item = appt["catalogue_id"] ? (catalogue as Row[]).find((c) => c["id"] === appt["catalogue_id"]) : null;
  return consentState({
    documentStatus: doc?.["status"] ?? null,
    requiresConsent: item ? Boolean(item["requires_consent"]) : null,
  });
}

export function advanceToWaitingIfReadyDemo(
  lookup: { appointmentId: string } | { consentDocumentId: string },
): AdvanceResult {
  const appt = (appointments as Row[]).find((a) =>
    "appointmentId" in lookup ? a["id"] === lookup.appointmentId : a["consent_document_id"] === lookup.consentDocumentId,
  );
  if (!appt) return { advanced: false, reason: "not_found", stage: null };
  if (appt["stage"] !== "arrived") return { advanced: false, reason: "not_arrived", stage: appt["stage"] };
  if (!consentReady(demoConsentStateOf(appt))) {
    return { advanced: false, reason: "consent_outstanding", stage: appt["stage"] };
  }

  appt["stage"] = "waiting";
  appt["status"] = "attended";
  appt["updated_at"] = new Date().toISOString();

  let recipients: string[] = appt["practitioner_id"] ? [appt["practitioner_id"]] : [];
  if (recipients.length === 0) {
    recipients = [
      ...new Set(
        (userRoles as Row[])
          .filter((r) => r["role"] === "owner" || r["role"] === "manager")
          .map((r) => r["user_id"] as string),
      ),
    ];
  }
  const patient = (patients as Row[]).find((p) => p["id"] === appt["patient_id"]);
  const who = `${patient?.["first_name"] ?? ""} ${patient?.["last_name"] ?? ""}`.trim() || "A patient";
  const at = new Date(appt["starts_at"]).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  for (const rid of recipients) {
    (staffNotifications as Row[]).unshift({
      id: newId("l9"),
      clinic_id: CLINIC_ID,
      recipient_id: rid,
      sender_id: null,
      urgent: false,
      kind: "patient_waiting",
      title: `${who} is waiting`,
      body: `${appt["treatment_name"]} · booked ${at}. Consent complete — ready to start treatment.`,
      patient_id: appt["patient_id"],
      appointment_id: appt["id"],
      read_at: null,
      created_at: new Date().toISOString(),
    });
  }
  return {
    advanced: true,
    stage: "waiting",
    appointmentId: appt["id"],
    patientId: appt["patient_id"],
    practitionerId: appt["practitioner_id"] ?? null,
  };
}
