/**
 * Draft with AI for the offer designer. Cohere returns the fields as JSON;
 * without a key (or on any failure) the stage default is returned, lightly
 * shaped by the brief, so the button always fills the form.
 */
import { STAGE_DEFAULT_DRAFT, STAGE_META, type OfferDraft, type TemplateStage } from "./stages";

const DEFAULT_MODEL = "command-a-plus-05-2026";

export type DraftTone = "warm" | "playful" | "clinical";

export type DraftInput = {
  stage: TemplateStage;
  brief: string;
  tone: DraftTone;
  clinicName: string;
};

export type DraftResult = OfferDraft & { source: "model" | "fallback" };

const TONE_NOTE: Record<DraftTone, string> = {
  warm: "Warm and personal, like a note from a practitioner who remembers the patient.",
  playful: "Light and upbeat, a little playful, still professional.",
  clinical: "Calm, clear and matter-of-fact; no exclamation marks.",
};

function fallbackDraft(input: DraftInput): DraftResult {
  const base = STAGE_DEFAULT_DRAFT[input.stage];
  const brief = input.brief.trim();
  // The brief usually names the offer ("20% off peels in October"); use it as
  // the value line so the fallback still reflects what the user typed.
  const value = brief && brief.length <= 80 ? brief : base.value_text;
  return { ...base, value_text: value, source: "fallback" };
}

export async function draftOffer(input: DraftInput): Promise<DraftResult> {
  const key = process.env["COHERE_API_KEY"]?.trim();
  if (!key) return fallbackDraft(input);

  const meaning =
    input.stage === "custom"
      ? "a one-off offer the clinic sends by hand to chosen patients"
      : `patients who are in the "${STAGE_META[input.stage].label}" stage: ${STAGE_META[input.stage].meaning}`;

  try {
    const response = await fetch("https://api.cohere.ai/v2/chat", {
      method: "POST",
      headers: { Authorization: `bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env["COHERE_MODEL"]?.trim() || DEFAULT_MODEL,
        messages: [
          {
            role: "system",
            content:
              `You write short marketing emails for ${input.clinicName}, a UK aesthetics clinic. ` +
              "Reply with JSON only: {\"name\": string, \"subject\": string, \"headline\": string, \"body\": string, \"value_text\": string, \"cta_label\": string}. " +
              "name is a short internal label (max 40 chars). subject is the email subject (max 70 chars) and may use {{first_name}} or {{clinic}}. " +
              "headline is one line (max 60 chars). body is two short paragraphs separated by a blank line, plain text, no links, no prices you were not given, British spelling. " +
              "value_text is the offer in one line (max 60 chars). cta_label is the button text (max 30 chars). " +
              "Never promise clinical outcomes; do not mention specific medical claims.",
          },
          {
            role: "user",
            content:
              `Audience: ${meaning}\nTone: ${TONE_NOTE[input.tone]}\nBrief from the clinic: ${input.brief.trim() || "(none given — use the stage)"}`,
          },
        ],
        max_tokens: 500,
        temperature: 0.6,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      console.warn(`[offers:draft] Cohere ${response.status}`);
      return fallbackDraft(input);
    }
    const payload: any = await response.json();
    const text = (payload?.message?.content ?? [])
      .filter((part: any) => part?.type === "text")
      .map((part: any) => part.text)
      .join("")
      .trim();
    const parsed = JSON.parse(text);
    const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
    const base = STAGE_DEFAULT_DRAFT[input.stage];
    const subject = str(parsed?.subject, 140);
    const headline = str(parsed?.headline, 120);
    const body = str(parsed?.body, 2000);
    if (!subject || !headline || !body) return fallbackDraft(input);
    return {
      name: str(parsed?.name, 60) ?? base.name,
      subject,
      headline,
      body,
      value_text: str(parsed?.value_text, 100) ?? base.value_text,
      cta_label: str(parsed?.cta_label, 40) ?? base.cta_label,
      source: "model",
    };
  } catch (error) {
    console.warn(`[offers:draft] call failed: ${(error as Error).message}`);
    return fallbackDraft(input);
  }
}
