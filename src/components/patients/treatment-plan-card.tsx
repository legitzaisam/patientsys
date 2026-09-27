/**
 * The patient's active treatment plan(s) at the top of the Treatments tab
 * (`#plan`): the same rows the journey board and the dashboard journeys read,
 * so sessions done, the next step and its date agree everywhere.
 */
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, ClipboardList } from "lucide-react";
import { listTreatmentPlans } from "@/lib/clinic.functions";
import { JOURNEY_PHASE_META } from "@/lib/journey-phases";
import { nextStepLine, planDateLabel, riskChipLabel } from "@/components/patients/plan-step-copy";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PlanRow = {
  id: string;
  name: string;
  phase: keyof typeof JOURNEY_PHASE_META;
  done: number;
  total: number;
  nextMilestone: { id: string; title: string; kind: string; dueDate?: string | null } | null;
  overdue: boolean;
  atRisk: boolean;
  riskReason: string | null;
  nextBookingAt?: string | null;
  practitionerName?: string | null;
};

export function TreatmentPlanCard({ patientId }: { patientId: string }) {
  const fetchPlans = useServerFn(listTreatmentPlans);
  const { data } = useQuery({
    queryKey: ["treatment-plans", "patient", patientId],
    queryFn: () => fetchPlans({ data: { patient_id: patientId } }),
  });
  const plans = (data ?? []) as PlanRow[];
  if (plans.length === 0) return null;

  return (
    <Card id="plan" className="scroll-mt-20 p-5" data-qc="treatment-plan-card">
      <div className="mb-3">
        <h3 className="section-title">Treatment plan</h3>
        <p className="text-xs text-muted-foreground">
          Where this patient is on their journey; the same figures as the journey board.
        </p>
      </div>
      <ul className="space-y-3">
        {plans.map((plan) => {
          const pct = plan.total ? Math.round((plan.done / plan.total) * 100) : 0;
          const label = planDateLabel(plan);
          const phase = JOURNEY_PHASE_META[plan.phase];
          return (
            <li
              key={plan.id}
              className="rounded-xl border border-edge bg-glass-2/70 px-4 py-3 shadow-inset-hi"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {phase?.label ?? plan.phase}
                    {plan.practitionerName ? ` · ${plan.practitionerName}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-2xs font-semibold shadow-inset-hi",
                    plan.atRisk
                      ? "bg-destructive-bg text-destructive-ink"
                      : "bg-success-bg text-success-ink",
                  )}
                >
                  {riskChipLabel(plan)}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-glass-2 shadow-inset-hi">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      plan.overdue ? "bg-destructive-ink/60" : "bg-accent-line",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span
                  className="shrink-0 text-2xs tabular-nums text-muted-foreground"
                  data-qc="plan-progress"
                >
                  {plan.done} of {plan.total} steps
                </span>
              </div>
              {plan.nextMilestone || label ? (
                <p
                  className={cn(
                    "mt-2 flex items-center gap-1.5 text-2xs",
                    plan.overdue ? "text-destructive-ink" : "text-ink-2",
                  )}
                  data-qc="plan-step"
                >
                  <ClipboardList
                    className={cn(
                      "h-3 w-3 shrink-0",
                      plan.overdue ? "text-destructive-ink" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                  <span className={cn("truncate", plan.overdue && "font-semibold")}>
                    {nextStepLine(plan)}
                  </span>
                  {label ? (
                    <span
                      className={cn(
                        "ml-auto flex shrink-0 items-center gap-1 tabular-nums",
                        plan.overdue
                          ? "font-semibold text-destructive-ink"
                          : "text-muted-foreground",
                      )}
                    >
                      <CalendarClock className="h-3 w-3" aria-hidden />
                      {label}
                    </span>
                  ) : null}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
