/**
 * The rules behind a visit's stage. Pure and shared by the production
 * handlers, the demo twins and the diary UI, so all three agree on when a
 * patient may move to "waiting" and which stages the manual menu offers.
 *
 * Stage vocabulary (appointments.stage):
 *   booked → arrived → waiting → in_treatment → aftercare → complete
 *   no_show sits beside the line.
 *
 * The feedback's rule: a patient is only "waiting" once they have arrived AND
 * their consent is complete. If consent is outstanding when they arrive,
 * reception has them sign it in clinic, and signing is what moves them on.
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

export function consentReady(state: ConsentState) {
  return state === "signed" || state === "not_required";
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

/** The standard pre-treatment checks read through on page 1 of the form. */
export const PRE_TREATMENT_CHECKS: { key: string; label: string; hint: string }[] = [
  {
    key: "history_unchanged",
    label: "Medical history and medications unchanged since last visit",
    hint: "Ask about new diagnoses, prescriptions, supplements and blood thinners.",
  },
  {
    key: "not_pregnant",
    label: "Not pregnant, trying, or breastfeeding",
    hint: "Applies to injectables, peels, retinoids and most energy-based treatments.",
  },
  {
    key: "no_recent_actives",
    label: "No recent sun exposure, retinoids or exfoliating actives",
    hint: "Typically 48 hours for actives, two weeks for sun, per the treatment.",
  },
  {
    key: "allergies_confirmed",
    label: "Allergies confirmed and products checked against them",
    hint: "Read the allergies on the record back to the patient.",
  },
  {
    key: "expectations_agreed",
    label: "Treatment plan and expected result agreed",
    hint: "Including areas, product, dose and what to expect over the next two weeks.",
  },
];

export type PreCheckAnswer = { answer: "yes" | "no" | "na"; note?: string };
export type PreChecks = Record<string, PreCheckAnswer>;

/** Any "no" on a pre-check is a flag the practitioner has to have addressed. */
export function preCheckFlags(checks: PreChecks) {
  return PRE_TREATMENT_CHECKS.filter((c) => checks[c.key]?.answer === "no");
}

/** The consent wording used when a form is created in clinic on the spot. */
export const CONSENT_BODY_DEFAULT =
  "I confirm the risks, benefits and alternatives have been explained to me, that I have had the chance to ask questions, and I consent to the treatment described above.";
