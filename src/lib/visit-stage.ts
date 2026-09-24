/**
 * The rules behind a visit's stage. Pure and shared by the production
 * handlers, the demo twins and the diary UI, so all three agree on when a
 * patient may move to "waiting" and which stages the manual menu offers.
 *
 * Stage vocabulary (appointments.stage):
 *   booked → arrived → waiting → in_treatment → aftercare → complete
 *   no_show sits beside the line.
 *
 * A patient is only "waiting" once they have arrived AND a consent form is
 * signed. That holds for every treatment, including ones the catalogue does
 * not require a form for in advance: if the diary still says consent is due,
 * the journey stops at "arrived" until they sign in clinic.
 * From there the treatment form drives in_treatment → aftercare → complete.
 */

export type VisitStage = "booked" | "arrived" | "waiting" | "in_treatment" | "aftercare" | "complete" | "no_show";

export type ConsentState = "not_required" | "outstanding" | "signed";

export type ConsentInput = {
  /** The linked consent document's status, if one has been issued. */
  documentStatus?: string | null;
  /** From the catalogue item; null means unknown, treated as required. */
  requiresConsent?: boolean | null;
};

/** Whether this visit can proceed as far as consent is concerned. */
export function consentState(input: ConsentInput): ConsentState {
  if (input.documentStatus === "signed") return "signed";
  if (input.requiresConsent === false) return "not_required";
  return "outstanding";
}

/**
 * Whether the visit may leave "arrived". Only a signed form counts — a
 * catalogue flag of "not required" still shows as consent due until they sign.
 */
export function consentReady(state: ConsentState) {
  return state === "signed";
}

/** Waiting without a signed consent is held at arrived. Later stages are left as recorded. */
export function stageHeldForConsent(stage: VisitStage, consent: ConsentState): VisitStage {
  if (stage === "waiting" && !consentReady(consent)) return "arrived";
  return stage;
}

/** Where an arriving patient lands: waiting if consent is done, else arrived. */
export function stageAfterArrival(consent: ConsentState): Extract<VisitStage, "arrived" | "waiting"> {
  return consentReady(consent) ? "waiting" : "arrived";
}

export type StageOption = {
  key: VisitStage;
  /** Selectable at all. */
  enabled: boolean;
  /** Why it is not, in words the menu can show. */
  reason?: string;
  /** Choosing it opens the treatment form instead of flipping the stage. */
  opensForm?: boolean;
};

export const STAGE_ORDER: VisitStage[] = ["booked", "arrived", "waiting", "in_treatment", "aftercare", "complete"];

/**
 * The guided manual menu. Reception's stages (booked, arrived, no_show) stay
 * free. Waiting is only offered once consent is complete. In treatment opens
 * the form — the form is how treatment starts. Aftercare and complete stay
 * available for the rare visit recorded without the form.
 */
export function manualStageOptions(input: { current: VisitStage; consent: ConsentState }): StageOption[] {
  const ready = consentReady(input.consent);
  const options: StageOption[] = STAGE_ORDER.map((key) => {
    if (key === "waiting" && !ready) {
      return { key, enabled: false, reason: "Consent is outstanding — complete it in clinic first" };
    }
    if (key === "in_treatment") {
      return { key, enabled: true, opensForm: true };
    }
    return { key, enabled: true };
  });
  options.push({ key: "no_show", enabled: true });
  return options;
}

/** Whether the treatment form may start for a visit at this stage with this consent. */
export function canStartTreatment(input: { stage: VisitStage; consent: ConsentState }) {
  if (!consentReady(input.consent)) return { ok: false as const, reason: "Consent is outstanding" };
  if (input.stage === "complete") return { ok: false as const, reason: "This visit is already complete" };
  if (input.stage === "no_show") return { ok: false as const, reason: "This visit was marked as a no-show" };
  return { ok: true as const };
}

/** Human labels shared by the diary and the form. */
export const STAGE_LABEL: Record<VisitStage, string> = {
  booked: "Booked",
  arrived: "Arrived",
  waiting: "Waiting",
  in_treatment: "In treatment",
  aftercare: "Aftercare",
  complete: "Complete",
  no_show: "No show",
};

/** Asked on the consent form, before treatment or on arrival if it is still unsigned. A "yes" is a contraindication. */
export const CONTRAINDICATIONS: { key: string; label: string; hint: string }[] = [
  {
    key: "pregnant_breastfeeding",
    label: "Are you pregnant, trying to conceive, or breastfeeding?",
    hint: "Delay toxin, filler, peels, laser and most energy devices.",
  },
  {
    key: "blood_thinners",
    label: "Are you taking a blood thinner, or do you have a bleeding or clotting disorder?",
    hint: "Aspirin, warfarin, apixaban, rivaroxaban, clopidogrel. Do not stop a prescribed thinner without the prescriber.",
  },
  {
    key: "active_infection",
    label: "Is there an infection, cold sore, or broken skin in the area to be treated?",
    hint: "Postpone until it has settled. An active cold sore delays lip and perioral work.",
  },
  {
    key: "herpes_history",
    label: "Have you ever had cold sores?",
    hint: "Ask before lip filler, peels and laser. Antiviral cover may be needed.",
  },
  {
    key: "neuromuscular",
    label: "Do you have a neuromuscular condition, such as myasthenia gravis?",
    hint: "Botulinum toxin is contraindicated.",
  },
  {
    key: "product_allergy",
    label: "Any allergy to lidocaine, hyaluronidase, or the product planned today?",
    hint: "Check before filler, including emergency dissolution.",
  },
  {
    key: "keloid",
    label: "Do you form keloid or hypertrophic scars?",
    hint: "Caution with needling, filler and energy devices.",
  },
  {
    key: "isotretinoin",
    label: "Have you taken isotretinoin in the last 12 months, or a strong retinoid recently?",
    hint: "Peels and laser usually wait. Pause topical retinoids for several days.",
  },
  {
    key: "recent_skin",
    label: "Any recent sunburn, peel, or other treatment in this area?",
    hint: "Wait until the skin has recovered.",
  },
  {
    key: "previous_reaction",
    label: "Have you reacted badly to toxin, filler, a peel, or laser before?",
    hint: "Including vascular compromise, prolonged swelling, or a result to avoid repeating.",
  },
];

/** Three checks the practitioner confirms in the room, immediately before starting. A "yes" needs a note. */
export const PRE_TREATMENT_CHECKS: { key: string; label: string; hint: string }[] = [
  {
    key: "changes_since_last",
    label: "Any change in health, medication, or allergies since the last treatment?",
    hint: "Including anything new since the consent form was signed.",
  },
  {
    key: "anything_today",
    label: "Anything new today — illness, a skin change, or a recent treatment — to know before starting?",
    hint: "What you can see now, and what the patient has just told you.",
  },
  {
    key: "reason_to_wait",
    label: "Any reason not to go ahead with the treatment agreed?",
    hint: "If yes, pause and record why before you start.",
  },
];

export type PreCheckAnswer = { answer: "yes" | "no" | "na"; note?: string };
export type PreChecks = Record<string, PreCheckAnswer>;

/** Any "yes" is something to settle before treatment starts. */
export function preCheckFlags(checks: PreChecks) {
  return PRE_TREATMENT_CHECKS.filter((c) => checks[c.key]?.answer === "yes");
}

/** The consent wording used when a form is created in clinic on the spot. */
export const CONSENT_BODY_DEFAULT =
  "I confirm the risks, benefits and alternatives have been explained to me, that I have had the chance to ask questions, and I consent to the treatment described above.";
