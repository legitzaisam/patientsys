/**
 * The one server-side rule that moves an appointment from "arrived" to
 * "waiting": the patient is here and their consent is complete (signed, or
 * not required for this treatment). Called wherever either half can become
 * true — marking arrival, signing in clinic, the portal signing, and the
 * public magic link — so the stage is never left behind whichever happened
 * last.
 *
 * Reaching "waiting" tells the practitioner: a `patient_waiting` notification
 * to whoever holds the booking (else the clinic's managers), carrying the
 * appointment so the bell and dock can open the treatment form directly.
 *
 * Server-only. Takes any Supabase-shaped client so it works for a staff
 * session, the clinic-scoped admin client (portal signing) and the raw
 * service client behind the public link.
 */
import { consentReady, consentState, stageHeldForConsent, type ConsentState } from "@/lib/visit-stage";

type Db = { from: (table: string) => any };

type Lookup = { appointmentId: string } | { consentDocumentId: string };

export type AdvanceResult =
  | { advanced: false; reason: "not_found" | "not_arrived" | "consent_outstanding"; stage: string | null }
  | { advanced: true; stage: "waiting"; appointmentId: string; patientId: string; practitionerId: string | null };

const SELECT =
  "id, clinic_id, stage, status, patient_id, practitioner_id, catalogue_id, consent_document_id, treatment_name, starts_at, documents(status), treatment_catalogue(requires_consent), patients(first_name, last_name)";

export function consentStateOf(row: {
  documents?: { status?: string | null } | null;
  treatment_catalogue?: { requires_consent?: boolean | null } | null;
}): ConsentState {
  return consentState({
    documentStatus: row.documents?.status ?? null,
    requiresConsent: row.treatment_catalogue?.requires_consent ?? null,
  });
}

/**
 * Waiting without a signed form is not a valid stage. Pull those visits back
 * to arrived so the diary, the dock and the schedule all stop at arrival.
 */
export async function holdArrivedUntilConsent(db: Db, rows: any[]) {
  const held = (rows ?? []).filter((row) => stageHeldForConsent(row?.stage, consentStateOf(row)) !== row?.stage);
  if (held.length === 0) return;
  const ids = held.map((row) => row.id).filter(Boolean);
  if (ids.length === 0) return;
  const { error } = await db.from("appointments").update({ stage: "arrived" }).in("id", ids).eq("stage", "waiting");
  if (error) throw new Error(error.message);
  for (const row of held) row.stage = "arrived";
}

export async function advanceToWaitingIfReady(db: Db, lookup: Lookup): Promise<AdvanceResult> {
  let query = db.from("appointments").select(SELECT);
  query = "appointmentId" in lookup ? query.eq("id", lookup.appointmentId) : query.eq("consent_document_id", lookup.consentDocumentId);
  const { data: rows, error } = await query.limit(1);
  if (error) throw new Error(error.message);
  const appt = (rows ?? [])[0];
  if (!appt) return { advanced: false, reason: "not_found", stage: null };
  if (appt.stage !== "arrived") return { advanced: false, reason: "not_arrived", stage: appt.stage };
  if (!consentReady(consentStateOf(appt))) return { advanced: false, reason: "consent_outstanding", stage: appt.stage };

  const { error: updateError } = await db
    .from("appointments")
    .update({ stage: "waiting", status: "attended" })
    .eq("id", appt.id)
    .eq("stage", "arrived");
  if (updateError) throw new Error(updateError.message);

  await notifyWaiting(db, appt);
  return {
    advanced: true,
    stage: "waiting",
    appointmentId: appt.id,
    patientId: appt.patient_id,
    practitionerId: appt.practitioner_id ?? null,
  };
}

async function notifyWaiting(db: Db, appt: any) {
  let recipients: string[] = appt.practitioner_id ? [appt.practitioner_id] : [];
  if (recipients.length === 0) {
    const { data: roles } = await db.from("user_roles").select("user_id").in("role", ["owner", "manager"]);
    recipients = [...new Set((roles ?? []).map((r: { user_id: string }) => r.user_id))] as string[];
  }
  if (recipients.length === 0) return;
  const who = `${appt.patients?.first_name ?? ""} ${appt.patients?.last_name ?? ""}`.trim() || "A patient";
  const at = new Date(appt.starts_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const { error } = await db.from("staff_notifications").insert(
    recipients.map((id) => ({
      clinic_id: appt.clinic_id,
      recipient_id: id,
      sender_id: null,
      urgent: false,
      kind: "patient_waiting",
      title: `${who} is waiting`,
      body: `${appt.treatment_name} · booked ${at}. Consent complete — ready to start treatment.`,
      patient_id: appt.patient_id,
      appointment_id: appt.id,
    })),
  );
  if (error) throw new Error(error.message);
}
