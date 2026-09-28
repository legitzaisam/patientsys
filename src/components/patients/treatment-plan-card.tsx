/**
 * The patient's active treatment plan(s) at the top of the Treatments tab
 * (`#plan`): the same rows the journey board and the dashboard journeys read,
 * so sessions done, the next step and its date agree everywhere.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarClock, CalendarPlus, ClipboardList } from "lucide-react";
import {
  getCatalogue,
  listPatients,
  listPractitioners,
  listTreatmentPlans,
} from "@/lib/clinic.functions";
import { JOURNEY_PHASE_META } from "@/lib/journey-phases";
import {
  bookingMismatchLine,
  nextStepLine,
  noShowLine,
  overdueLabel,
  planDateLabel,
  riskChipLabel,
} from "@/components/patients/plan-step-copy";
import { QuickAddAppointment } from "@/components/quick-add-appointment";
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
  stepBookedAt?: string | null;
  otherBookingTreatment?: string | null;
  noShowAt?: string | null;
  practitionerId?: string | null;
  practitionerName?: string | null;
};

export function TreatmentPlanCard({ patientId }: { patientId: string }) {
  const fetchPlans = useServerFn(listTreatmentPlans);
  const { data } = useQuery({
    queryKey: ["treatment-plans", "patient", patientId],
    queryFn: () => fetchPlans({ data: { patient_id: patientId } }),
  });
  // Booking a step from here needs the same three lists as the journey board,
  // cached under the same keys the Records tab and the diary use.
  const fetchPatients = useServerFn(listPatients);
  const { data: patients } = useQuery({ queryKey: ["patients"], queryFn: () => fetchPatients() });
  const fetchPractitioners = useServerFn(listPractitioners);
  const { data: practitioners } = useQuery({
    queryKey: ["practitioners"],
    queryFn: () => fetchPractitioners(),
  });
  const fetchCatalogue = useServerFn(getCatalogue);
  const { data: catalogue } = useQuery({
    queryKey: ["catalogue"],
    queryFn: () => fetchCatalogue(),
  });
  const [booking, setBooking] = useState<PlanRow | null>(null);
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
          const late = overdueLabel(plan);
          const note = noShowLine(plan) ?? bookingMismatchLine(plan);
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
                    {late ? "," : null}
                  </span>
                  {late ? <span className="shrink-0 tabular-nums">{late}</span> : null}
                  {label ? (
                    <span className="ml-auto flex shrink-0 items-center gap-1 tabular-nums text-muted-foreground">
                      <CalendarClock className="h-3 w-3" aria-hidden />
                      {label}
                    </span>
                  ) : null}
                </p>
              ) : null}
              {note || !plan.stepBookedAt ? (
                <div className="mt-1.5 flex items-center gap-2 pl-[1.125rem]">
                  {note ? (
                    <p className="min-w-0 flex-1 text-2xs text-muted-foreground" data-qc="plan-booking-note">
                      {note}
                    </p>
                  ) : (
                    <span className="flex-1" />
                  )}
                  {plan.stepBookedAt ? null : (
                    <button
                      type="button"
                      data-qc="plan-book"
                      onClick={() => setBooking(plan)}
                      className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-full bg-accent px-2.5 text-2xs font-semibold text-accent-foreground shadow-inset-hi transition-[filter] hover:brightness-[0.97]"
                    >
                      <CalendarPlus className="h-3 w-3" aria-hidden />
                      Book
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {booking ? (
        <QuickAddAppointment
          patients={(patients ?? []) as any[]}
          practitioners={(practitioners ?? []) as any[]}
          catalogue={(catalogue ?? []) as any[]}
          date={new Date()}
          defaultPatientId={patientId}
          defaultPractitionerId={booking.practitionerId ?? undefined}
          milestoneId={booking.nextMilestone?.id}
          open
          onOpenChange={(v) => {
            if (!v) setBooking(null);
          }}
          title={`Book ${booking.name}`}
          centered
        >
          <span className="sr-only">Book next step</span>
        </QuickAddAppointment>
      ) : null}
    </Card>
  );
}
