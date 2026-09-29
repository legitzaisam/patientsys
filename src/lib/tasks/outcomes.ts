import type { AttemptOutcome } from "@/lib/tasks/service";

/** What a task can end with, per role, and what each pick does. */
export type Outcome = {
  label: string;
  resolution: string | null;
  kind: "complete" | "handoff" | "attempt" | "escalate" | "noop";
  outcome?: AttemptOutcome;
};

export const PRACTITIONER_OUTCOMES: Outcome[] = [
  { label: "Booked", resolution: "booked", kind: "complete" },
  { label: "Spoke, will book", resolution: "will_book", kind: "complete" },
  { label: "No answer, pass to front desk", resolution: null, kind: "handoff" },
  { label: "Not continuing plan", resolution: "not_continuing", kind: "complete" },
];

export const FRONT_DESK_OUTCOMES: Outcome[] = [
  { label: "Booked", resolution: "booked", kind: "complete" },
  { label: "No answer", resolution: null, kind: "attempt", outcome: "no_answer" },
  { label: "Left voicemail", resolution: null, kind: "attempt", outcome: "voicemail" },
  { label: "Needs clinician", resolution: null, kind: "escalate" },
  { label: "Pass to colleague", resolution: null, kind: "handoff" },
];
