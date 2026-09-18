import { Link } from "@tanstack/react-router";
import { PatientAvatar } from "@/components/patient-avatar";
import { Card } from "@/components/ui/card";

type JourneyPlan = {
  id: string;
  patientId: string;
  patientName: string;
  avatarUrl?: string | null;
  name: string;
  done: number;
  total: number;
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

const PHASE_META: Record<JourneyPhase["phase"], { label: string; sub: string }> = {
  consult: { label: "Consultation & prep", sub: "New plans and pre-treatment preparation" },
  foundation: { label: "Foundation", sub: "Assess, plan and prepare" },
  build: { label: "Build & support", sub: "Continue treatment and monitor progress" },
  results: { label: "Results & confidence", sub: "Complete the plan and maintain results" },
};

/**
 * "Active treatment journeys" from the Advanced mockup — the dashboard's
 * bottom section. One column per plan phase with a progress track and the
 * first few patients, each row linking to the record.
 */
export function TreatmentJourneys({ journeys }: { journeys: Journeys | undefined }) {
  const phases = (journeys?.phases ?? []).filter((p) => p.count > 0);
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="section-title">
            Active treatment journeys
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {journeys?.activeCount ?? 0} patients on a phased treatment plan.
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
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${phases.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {phases.map((phase) => {
            const meta = PHASE_META[phase.phase];
            return (
              <Card key={phase.phase} className="p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                  <p className="shrink-0 text-2xs text-muted-foreground">
                    {phase.count} patient{phase.count === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="mt-0.5 text-2xs text-muted-foreground">{meta.sub}</p>
                <ul className="mt-3 space-y-1.5">
                  {phase.plans.map((plan) => {
                    const pct = plan.total ? Math.round((plan.done / plan.total) * 100) : 0;
                    return (
                      <li key={plan.id}>
                        <Link
                          to="/patients/$id"
                          params={{ id: plan.patientId }}
                          className="flex items-center gap-2.5 rounded-xl py-2 transition-colors hover:bg-[rgba(47,63,102,0.08)]"
                        >
                          <PatientAvatar
                            patientId={plan.patientId}
                            name={plan.patientName}
                            photoUrl={plan.avatarUrl}
                            size="sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-foreground">{plan.patientName}</p>
                            <p className="truncate text-2xs text-muted-foreground">{plan.name}</p>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-glass-2 shadow-inset-hi">
                              <div
                                className="h-full rounded-full bg-accent-line transition-[width]"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                          <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
                            {plan.done} of {plan.total}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
