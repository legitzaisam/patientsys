import { Link } from "@tanstack/react-router";
import { LoadError, LoadingCard, type LoadStatus } from "@/components/dashboard/load-state";
import { JOURNEY_PHASE_META } from "@/lib/journey-phases";
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

/** Shared with the Patients journey board, so both surfaces name the phases the same way. */
const PHASE_META: Record<JourneyPhase["phase"], { label: string; sub: string }> = JOURNEY_PHASE_META;

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
export function TreatmentJourneys({
  journeys,
  status = "ready",
  onRetry,
}: {
  journeys: Journeys | undefined;
  status?: LoadStatus;
  onRetry?: () => void;
}) {
  const phases = (journeys?.phases ?? []).filter((p) => p.count > 0);
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="section-title">Active treatment journeys</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {status === "ready"
              ? `${journeys?.activeCount ?? 0} patient${(journeys?.activeCount ?? 0) === 1 ? "" : "s"} on a phased plan, grouped by where they are. Each row shows the next step; late steps are flagged. Open a row to act on it.`
              : "Patients on a phased plan, grouped by where they are."}
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
      {status === "error" ? (
        <LoadError what="the treatment journeys" onRetry={onRetry} />
      ) : status === "loading" ? (
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-4" data-qc="journeys-loading">
          <LoadingCard lines={3} />
          <LoadingCard lines={3} />
          <LoadingCard lines={3} />
          <LoadingCard lines={3} />
        </div>
      ) : phases.length === 0 ? (
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
                        {/* Straight to the plan card on the record's Treatments tab. */}
                        <Link
                          to="/patients/$id"
                          params={{ id: plan.patientId }}
                          search={{ tab: "treatments" }}
                          hash="plan"
                          data-qc="plan-link"
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
                            {/* Name over up to two lines, kind chip beneath so a narrow
                                column never squeezes the name into a sliver. */}
                            <p className="line-clamp-2 break-words text-2xs text-muted-foreground">
                              {plan.name}
                            </p>
                            {KIND_CHIP[plan.kind ?? ""] ? (
                              <span className="mt-0.5 inline-block rounded-full bg-sky-bg px-1.5 py-px text-[10px] font-semibold text-sky-ink shadow-inset-hi">
                                {KIND_CHIP[plan.kind ?? ""]}
                              </span>
                            ) : null}
                            {plan.nextStep ? (
                              <p className="mt-0.5 min-w-0 truncate text-2xs text-ink-2">
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
