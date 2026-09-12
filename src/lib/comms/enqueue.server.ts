import {
  assertCanSend,
  prefsFromPatient,
  type CommsChannel,
  type CommsPurpose,
} from "./preferences";

export type EnqueueInput = {
  clinicId: string;
  patientId: string;
  channel: CommsChannel;
  purpose: CommsPurpose;
  body: string;
  subject?: string | null;
  templateKey?: string | null;
  toAddress?: string | null;
  scheduledFor?: string | null;
  relatedEntity?: string | null;
  relatedId?: string | null;
  createdBy?: string | null;
};

/**
 * The only insert into `communications`. Phase 8 drains queued rows; Phase 9
 * calls this from real flows. A provider outage must not lose the row.
 */
export async function enqueueCommunication(
  supabase: { from: (table: string) => any },
  input: EnqueueInput,
): Promise<{ id: string }> {
  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .select(
      "id, email, phone, email_opt_in, sms_opt_in, reminders_opt_in, marketing_opt_in, unsubscribed_at",
    )
    .eq("id", input.patientId)
    .maybeSingle();
  if (patientError) throw new Error(patientError.message);
  if (!patient) throw new Error("Patient not found");

  const toAddress =
    input.toAddress?.trim() ||
    (input.channel === "email" ? String(patient.email ?? "").trim() : String(patient.phone ?? "").trim());

  const decision = assertCanSend(prefsFromPatient(patient), input.purpose, input.channel, toAddress);
  if (!decision.ok) throw new Error(decision.reason);

  const { data, error } = await supabase
    .from("communications")
    .insert({
      clinic_id: input.clinicId,
      patient_id: input.patientId,
      channel: input.channel,
      purpose: input.purpose,
      to_address: toAddress,
      template_key: input.templateKey ?? null,
      subject: input.subject?.trim() || null,
      body: input.body,
      status: "queued",
      attempts: 0,
      scheduled_for: input.scheduledFor || new Date().toISOString(),
      created_by: input.createdBy ?? null,
      related_entity: input.relatedEntity ?? null,
      related_id: input.relatedId ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id as string };
}
