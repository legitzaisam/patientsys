/**
 * The four journey phases a treatment plan moves through. One definition for
 * the dashboard's journey columns and the Patients journey board, so the same
 * phase never carries two names or two descriptions.
 */
export type JourneyPhaseKey = "consult" | "foundation" | "build" | "results";

export type JourneyPhaseMeta = {
  phase: JourneyPhaseKey;
  label: string;
  /** What the phase holds and what the clinic should be doing about it. */
  sub: string;
};

export const JOURNEY_PHASES: readonly JourneyPhaseMeta[] = [
  {
    phase: "consult",
    label: "Consultation & prep",
    sub: "Not yet in treatment: book the consultation or first session.",
  },
  {
    phase: "foundation",
    label: "Foundation",
    sub: "Early sessions: keep the next booking in the diary.",
  },
  {
    phase: "build",
    label: "Build & support",
    sub: "Mid-course: watch progress and check in between visits.",
  },
  {
    phase: "results",
    label: "Results & review",
    sub: "Finishing: take results photos and agree maintenance.",
  },
];

export const JOURNEY_PHASE_META: Record<JourneyPhaseKey, JourneyPhaseMeta> = Object.fromEntries(
  JOURNEY_PHASES.map((p) => [p.phase, p]),
) as Record<JourneyPhaseKey, JourneyPhaseMeta>;
