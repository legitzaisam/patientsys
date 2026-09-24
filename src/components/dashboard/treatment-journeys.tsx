import { Link } from "@tanstack/react-router";
import { PatientAvatar } from "@/components/patient-avatar";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type JourneyPlan = {
  id: string;
  patientId: string;
  patientName: string;
  avatarUrl?: string | null;
  name: string;
  done: number;
  total: number;
  /** The step that is up next, if the plan has one left. */
  nextStep?: string | null;
  nextDue?: string | null;
  overdue?: boolean;
  /** A clinical course, a maintenance/review track, or a win-back track. */
  kind?: "treatment" | "review" | "re_engagement" | string;
};

type JourneyPhase = {
  phase: "consult" | "foundation" | "build" | "results";
  count: number;
  plans: JourneyPlan[];
};

export type Journeys = {
  activeCount: number;
  overdueCount?: number;
  phases: JourneyPhase[];
};

/**
 * Each phase says what it holds and what the clinic should be doing about the
 * patients in it, so the column reads as a to-do rather than a label.
 */
const PHASE_META: Record<JourneyPhase["phase"], { label: string; sub: string }> = {
  consult: { label: "Consultation & prep", sub: "Not yet in treatment — book the consultation or first session." },
  foundation: { label: "Foundation", sub: "Early sessions — keep the next booking in the diary." },
  build: { label: "Build & support", sub: "Mid-course — watch progress and check in between visits." },
  results: { label: "Results & confidence", sub: "Finishing — take results photos and agree maintenance." },
};

/** Non-clinical plans say what they are; a treatment course needs no chip. */
const KIND_CHIP: Record<string, string> = {
  review: "Review track",
  re_engagement: "Win-back track",
};

function dueLabel(nextDue: string, overdue: boolean) {
  const days = Math.round((new Date(nextDue).getTime() - Date.now()) / 86400000);
  if (overdue) return `${Math.abs(days)}d late`;
  if (days === 0) return "due today";
  return `due in ${days}d`;
}

/**
 * "Active treatment journeys" — the dashboard's bottom section. One column per
 * plan phase; each row is a patient with their plan, the step that is up next
 * and how many steps are done. Rows open the patient record.
 */
export function TreatmentJourneys({ journeys }: { journeys: Journeys | undefined }) {
  const phases = (journeys?.phases ?? []).filter((p) => p.count > 0);
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="section-title">Active treatment journeys</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {journeys?.activeCount ?? 0} patient{(journeys?.activeCount ?? 0) === 1 ? "" : "s"} on a phased plan,
            grouped by where they are. Each row shows the next step; late steps are flagged. Open a row to act on it.
          </p>
        </div>
        <Link
          to="/patients"
          search={{ tab: "board" }}
          className="shrink-0 text-xs font-semibold text-accent-ink underline-offset-4 hover:underline"
        >
          View journey board →
        </Link>
      </div>
      {phases.length === 0 ? (
        <Card className="p-6">
          <p className="text-center text-sm text-muted-foreground">
            No active treatment plans yet — start one from a patient record or the journey board.
          </p>
        </Card>
      ) : (
        // items-start with a shared min-height: a one-patient column stays the
        // same size as its neighbours' headers plus two rows, and no longer
        // stretches to a four-patient column's height.
        <div
          className={`grid grid-cols-1 items-start gap-4 sm:grid-cols-2 ${phases.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
        >
          {phases.map((phase) => {
            const meta = PHASE_META[phase.phase];
            const more = phase.count - phase.plans.length;
            return (
              <Card key={phase.phase} className="flex min-h-[15.5rem] flex-col p-4" data-qc={`journey-${phase.phase}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                  <p className="shrink-0 text-2xs text-muted-foreground">
                    {phase.count} patient{phase.count === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="mt-0.5 text-2xs text-muted-foreground">{meta.sub}</p>
                <ul className="-mx-3 mt-3 space-y-1.5">
                  {phase.plans.map((plan) => {
                    const pct = plan.total ? Math.round((plan.done / plan.total) * 100) : 0;
                    return (
                      <li key={plan.id}>
                        <Link
                          to="/patients/$id"
                          params={{ id: plan.patientId }}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-[rgba(47,63,102,0.08)]"
                        >
                          <PatientAvatar
                            patientId={plan.patientId}
                            name={plan.patientName}
                            photoUrl={plan.avatarUrl}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-foreground">{plan.patientName}</p>
                            <p className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                              <span className="truncate">{plan.name}</span>
                              {KIND_CHIP[plan.kind ?? ""] ? (
                                <span className="shrink-0 rounded-full bg-sky-bg px-1.5 py-px text-[10px] font-semibold text-sky-ink shadow-inset-hi">
                                  {KIND_CHIP[plan.kind ?? ""]}
                                </span>
                              ) : null}
                            </p>
                            {plan.nextStep ? (
                              <p className="mt-0.5 truncate text-2xs text-ink-2">
                                Next: {plan.nextStep}
                                {plan.nextDue ? (
                                  <span
                                    className={cn(
                                      "ml-1",
                                      plan.overdue ? "font-semibold text-destructive-ink" : "text-muted-foreground",
                                    )}
                                  >
                                    · {dueLabel(plan.nextDue, !!plan.overdue)}
                                  </span>
                                ) : null}
                              </p>
                            ) : (
                              <p className="mt-0.5 text-2xs text-muted-foreground">All steps done</p>
                            )}
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-glass-2 shadow-inset-hi">
                              <div
                                className={cn("h-full rounded-full transition-[width]", plan.overdue ? "bg-destructive-ink/60" : "bg-accent-line")}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <span className="shrink-0 text-right text-2xs tabular-nums leading-tight text-muted-foreground">
                            {plan.done} of {plan.total}
                            <br />
                            steps done
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
                {more > 0 ? (
                  <Link
                    to="/patients"
                    search={{ tab: "board" }}
                    className="mt-auto pt-2 text-2xs font-semibold text-accent-ink underline-offset-4 hover:underline"
                  >
                    +{more} more on the board →
                  </Link>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
