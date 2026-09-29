/**
 * Keyword triage for portal messages. A patient message that mentions a
 * symptom, a worry or a time-critical question becomes an "Urgent question"
 * task for their practitioner with a four-hour reply target; everything else
 * stays in the chat. Pure and deliberately conservative: false negatives
 * still reach the inbox, false positives cost a practitioner a glance.
 */

const SYMPTOM_WORDS = [
  "swelling",
  "swollen",
  "bruis",
  "redness",
  "red ",
  "rash",
  "blister",
  "lump",
  "bump",
  "pain",
  "hurt",
  "burn",
  "numb",
  "tingl",
  "itch",
  "bleed",
  "pus",
  "infect",
  "fever",
  "dizzy",
  "blurr",
  "droop",
  "uneven",
  "asymmetr",
  "allerg",
  "reaction",
  "hard ",
  "hot ",
  "throb",
  "vision",
  "headache",
  "nausea",
];

const WORRY_WORDS = [
  "normal?",
  "is this normal",
  "is it normal",
  "should i be worried",
  "worried",
  "concern",
  "urgent",
  "emergency",
  "asap",
  "help",
  "not sure if",
  "ok to",
  "okay to",
  "safe to",
  "can i",
  "should i",
];

const NOISE_PATTERNS = [
  /^thank/i,
  /^thanks/i,
  /^great/i,
  /^perfect/i,
  /^see you/i,
  /^ok\b/i,
  /^okay\b/i,
];

export type TriageResult = { urgent: boolean; reason: "symptom" | "worry" | "question" | null };

/** True when the message reads like something a clinician should answer within hours. */
export function triageMessage(body: string | null | undefined): TriageResult {
  const text = (body ?? "").trim();
  if (!text) return { urgent: false, reason: null };
  // Short pleasantries with nothing asked are never urgent.
  if (NOISE_PATTERNS.some((p) => p.test(text)) && text.length < 60 && !text.includes("?"))
    return { urgent: false, reason: null };
  const lower = ` ${text.toLowerCase()} `;
  if (SYMPTOM_WORDS.some((w) => lower.includes(w))) return { urgent: true, reason: "symptom" };
  if (WORRY_WORDS.some((w) => lower.includes(w))) return { urgent: true, reason: "worry" };
  // A plain question about aftercare still deserves a timely answer.
  if (
    /\?\s*$/.test(text) &&
    /\b(after|day|days|treatment|session|gym|exercise|sun|makeup|alcohol|shower|sleep|fly|flight)\b/i.test(
      text,
    )
  ) {
    return { urgent: true, reason: "question" };
  }
  return { urgent: false, reason: null };
}

/** Short preview for a task title: "Is redness on day 3 normal?" from a longer message. */
export function questionPreview(body: string, max = 60): string {
  const text = body.replace(/\s+/g, " ").trim();
  const firstQuestion = text.match(/[^.!?]*\?/);
  const pick = (firstQuestion?.[0] ?? text).trim();
  if (pick.length <= max) return pick;
  return `${pick.slice(0, max - 1).trimEnd()}…`;
}
