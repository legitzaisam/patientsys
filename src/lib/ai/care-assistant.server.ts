/**
 * The portal's care assistant.
 *
 * It answers "what do I do before my session", "when is my next step" and
 * similar orientation questions using the patient's own plan as context. It
 * is deliberately NOT a clinician: the system prompt forbids diagnosis,
 * dosage changes and any judgement about whether a symptom is serious, and
 * routes all of that to Messages so a human answers.
 *
 * Cohere backs it when COHERE_API_KEY is set; without a key (or when the API
 * errors or rate-limits) it falls back to a deterministic reply so the portal
 * degrades to something honest instead of a spinner.
 */

const DEFAULT_MODEL = "command-a-plus-05-2026";

export type CareContext = {
  question: string;
  firstName: string;
  planName: string | null;
  currentStep: { title: string; detail: string } | null;
  nextAppointment: { treatment: string; startsAt: string } | null;
};

export type CareAnswer = {
  answer: string;
  /** True when a human should pick this up; the UI offers a Messages link. */
  referToClinic: boolean;
  source: "model" | "fallback";
};

/** Phrases that must always reach a human rather than a model. */
const CLINICAL_TRIGGERS = [
  "infected",
  "infection",
  "bleeding",
  "blister",
  "allergic",
  "swelling",
  "swollen",
  "severe pain",
  "fever",
  "pus",
  "scar",
  "numb",
  "vision",
  "emergency",
];

function looksClinical(question: string) {
  const q = question.toLowerCase();
  return CLINICAL_TRIGGERS.some((t) => q.includes(t));
}

function systemPrompt(ctx: CareContext) {
  return [
    `You are the care assistant in ${ctx.firstName}'s skin-clinic patient portal.`,
    ctx.planName ? `Their current plan is the ${ctx.planName}.` : "They have no active plan right now.",
    ctx.currentStep ? `The step they are on is "${ctx.currentStep.title}": ${ctx.currentStep.detail}` : "",
    ctx.nextAppointment
      ? `Their next appointment is ${ctx.nextAppointment.treatment} on ${new Date(ctx.nextAppointment.startsAt).toDateString()}.`
      : "They have no appointment booked.",
    "Answer only about their plan, routine, preparation and aftercare, in two or three short sentences of plain British English.",
    "Never diagnose, never suggest or change a medication or dose, and never judge whether a symptom is serious or safe.",
    "If the question is clinical, or you are not certain, say so briefly and tell them to message the clinic.",
    "No markdown, no lists, no sign-off.",
  ]
    .filter(Boolean)
    .join(" ");
}

function fallbackAnswer(ctx: CareContext): CareAnswer {
  if (looksClinical(ctx.question)) {
    return {
      answer:
        "That one needs a clinician rather than me. Send it to your clinic through Messages and someone will come back to you.",
      referToClinic: true,
      source: "fallback",
    };
  }
  if (ctx.currentStep) {
    return {
      answer: `Right now you're on "${ctx.currentStep.title}". ${ctx.currentStep.detail} If you need anything more specific, message your clinic and they'll help.`,
      referToClinic: false,
      source: "fallback",
    };
  }
  return {
    answer:
      "I can help with your plan, your routine and how to prepare for appointments. For anything clinical, message your clinic and they'll reply.",
    referToClinic: false,
    source: "fallback",
  };
}

export async function answerCareQuestion(ctx: CareContext): Promise<CareAnswer> {
  // Clinical questions never reach the model, key or no key.
  if (looksClinical(ctx.question)) {
    return {
      answer:
        "That sounds like something your clinician should look at. Please message your clinic through Messages — if it is urgent, call them directly.",
      referToClinic: true,
      source: "fallback",
    };
  }

  const key = process.env["COHERE_API_KEY"]?.trim();
  if (!key) return fallbackAnswer(ctx);

  try {
    const response = await fetch("https://api.cohere.ai/v2/chat", {
      method: "POST",
      headers: { Authorization: `bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env["COHERE_MODEL"]?.trim() || DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt(ctx) },
          { role: "user", content: ctx.question },
        ],
        max_tokens: 200,
        temperature: 0.3,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      console.warn(`[care-assistant] Cohere ${response.status}`);
      return fallbackAnswer(ctx);
    }
    const payload: any = await response.json();
    const text = (payload?.message?.content ?? [])
      .filter((part: any) => part?.type === "text")
      .map((part: any) => part.text)
      .join(" ")
      .trim();
    if (!text) return fallbackAnswer(ctx);
    return { answer: text, referToClinic: false, source: "model" };
  } catch (error) {
    console.warn(`[care-assistant] call failed: ${(error as Error).message}`);
    return fallbackAnswer(ctx);
  }
}
