/**
 * Demo-mode AI patient: when staff message a patient in the chat, the
 * "patient" texts back. Replies come from Cohere's chat API when
 * COHERE_API_KEY is set (free trial keys: 1,000 calls/month, 20 req/min) and
 * from a rotating canned pool otherwise, so demos never stall on a missing
 * key, a rate limit, or a network hiccup.
 *
 * Server-side only: the key never reaches the browser, and the reply is
 * appended straight into the in-memory messages fixture that the chat polls.
 */
import { CLINIC_ID, appointments, messages, newId, patients, treatments } from "@/lib/demo/data";

const DEFAULT_MODEL = "command-a-plus-05-2026";
const REPLY_DELAY_MS = () => 4000 + Math.random() * 4000;

const CANNED_REPLIES = [
  "Thanks for letting me know!",
  "Perfect, that works for me.",
  "Great, see you then — thank you!",
  "Okay lovely, thanks. Is there anything I need to do beforehand?",
  "That's fine by me. Afternoon works best if there's a choice.",
  "Got it, thanks for checking in. All feeling fine so far.",
  "Thanks! Quick one — is parking still easy near the clinic?",
  "Sounds good, see you at my next appointment.",
];

function age(dob: unknown): number | null {
  if (typeof dob !== "string" || !dob) return null;
  const years = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000);
  return Number.isFinite(years) ? Math.floor(years) : null;
}

function personaFor(patient: any): string {
  const name = `${patient.first_name} ${patient.last_name}`.trim();
  const years = age(patient.date_of_birth);
  const history = treatments
    .filter((t: any) => t.patient_id === patient.id)
    .slice(0, 3)
    .map((t: any) => `${t.name} on ${String(t.performed_at).slice(0, 10)}`)
    .join("; ");
  const upcoming = appointments
    .filter((a: any) => a.patient_id === patient.id && new Date(a.starts_at) > new Date() && a.status !== "cancelled")
    .sort((a: any, b: any) => String(a.starts_at).localeCompare(String(b.starts_at)))[0] as any;

  return [
    `You are ${name}${years ? `, ${years}` : ""}, a patient of an aesthetics clinic, texting with the clinic's staff.`,
    history ? `Your recent treatments: ${history}.` : "",
    upcoming
      ? `Your next appointment: ${upcoming.treatment_name} on ${String(upcoming.starts_at).slice(0, 10)}.`
      : "You have no appointment booked right now.",
    patient.allergies && patient.allergies !== "None known" ? `Allergies: ${patient.allergies}.` : "",
    "Reply exactly as this patient would over SMS: one or two short sentences, casual and polite, British English.",
    "No markdown, no lists, no sign-off, at most one emoji and only if natural.",
    "Stay consistent with the conversation so far. Never mention being an AI or a demo.",
  ]
    .filter(Boolean)
    .join(" ");
}

async function cohereReply(patient: any): Promise<string | null> {
  const key = process.env["COHERE_API_KEY"]?.trim();
  if (!key) return null;
  const model = process.env["COHERE_MODEL"]?.trim() || DEFAULT_MODEL;

  // The model speaks as the patient: staff messages read as "user", the
  // patient's own messages as "assistant".
  const thread = messages
    .filter((m: any) => m.patient_id === patient.id)
    .sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)))
    .slice(-12)
    .map((m: any) => ({
      role: m.author === "patient" ? ("assistant" as const) : ("user" as const),
      content: String(m.body ?? ""),
    }))
    .filter((m) => m.content);

  try {
    const response = await fetch("https://api.cohere.ai/v2/chat", {
      method: "POST",
      headers: {
        Authorization: `bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: personaFor(patient) }, ...thread],
        max_tokens: 120,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      console.warn(`[patient-ai] Cohere ${response.status}: ${(await response.text()).slice(0, 200)}`);
      return null;
    }
    const payload: any = await response.json();
    const text = (payload?.message?.content ?? [])
      .filter((part: any) => part?.type === "text")
      .map((part: any) => part.text)
      .join(" ")
      .trim();
    return text || null;
  } catch (error) {
    console.warn(`[patient-ai] Cohere call failed: ${(error as Error).message}`);
    return null;
  }
}

function cannedReply(patientId: string): string {
  // Rotate per patient so consecutive fallbacks vary.
  const count = messages.filter((m: any) => m.patient_id === patientId && m.author === "patient").length;
  let hash = 0;
  for (let i = 0; i < patientId.length; i++) hash = (hash * 31 + patientId.charCodeAt(i)) >>> 0;
  return CANNED_REPLIES[(hash + count) % CANNED_REPLIES.length]!;
}

/** One timer per patient: rapid staff messages collapse into a single reply. */
const pendingReplies = new Map<string, ReturnType<typeof setTimeout>>();

export function isPatientReplyPending(patientId: string): boolean {
  return pendingReplies.has(patientId);
}

export function schedulePatientReply(patientId: string) {
  const patient = patients.find((p: any) => p.id === patientId);
  if (!patient) return;

  const existing = pendingReplies.get(patientId);
  if (existing) clearTimeout(existing);

  pendingReplies.set(
    patientId,
    setTimeout(async () => {
      let body: string | null = null;
      try {
        body = await cohereReply(patient);
      } finally {
        messages.push({
          id: newId("h9"),
          clinic_id: CLINIC_ID,
          patient_id: patientId,
          author: "patient",
          author_id: null,
          body: body ?? cannedReply(patientId),
          attachments: [],
          read_at: null,
          created_at: new Date().toISOString(),
        });
        pendingReplies.delete(patientId);
      }
    }, REPLY_DELAY_MS()),
  );
}
