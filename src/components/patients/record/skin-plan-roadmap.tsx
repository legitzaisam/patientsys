import { ToneChip } from "@/components/patients/record/chips";
import type { PlanDetail } from "@/components/patients/record/skin-plan-summary-card";
import { bookingMismatchLine, noShowLine } from "@/components/patients/plan-step-copy";
import {
  stepChip,
  stepDateLine,
  stepNeedsBooking,
  stepTone,
  upNextStep,
  type RoadmapStepLike,
} from "@/lib/patients/record-overview";
import { cn } from "@/lib/utils";

/**
 * The plan row the journey board and the dashboard read (listTreatmentPlans):
 * what the diary is doing instead of this step, and whether the patient
 * missed it. The roadmap says the same about the current step.
 */
export type PlanRiskRow = {
  id: string;
  nextMilestone: { id: string; title: string; dueDate?: string | null } | null;
  overdue: boolean;
  atRisk: boolean;
  riskReason: string | null;
  nextBookingAt?: string | null;
  stepBookedAt?: string | null;
  otherBookingTreatment?: string | null;
  noShowAt?: string | null;
};

/** A step as the roadmap and the Step details panel read it. */
export type RoadmapStep = Omit<RoadmapStepLike, "checklist"> & {
  detail?: string | null;
  checklist?: {
    id: string;
    label: string;
    done: boolean;
    byClinic: boolean;
    doneAt?: string | null;
    doneByKind?: "patient" | "clinic" | null;
  }[];
};

/**
 * The full skin plan on Treatments: the same months and steps as the
 * patient's Timeline, every row visible, the current step on a gold wash and
 * the selected one outlined. Clicking a row opens it in Step details.
 */
export function SkinPlanRoadmap({
  detail,
  risk,
  selectedId,
  onSelect,
}: {
  detail: PlanDetail;
  risk: PlanRiskRow | null;
  selectedId: string | null;
  onSelect: (stepId: string) => void;
}) {
  const current = upNextStep(detail.roadmap);
  const pct =
    detail.plan.milestonesTotal === 0
      ? 0
      : Math.round((detail.plan.milestonesDone / detail.plan.milestonesTotal) * 100);
  const note = risk ? (noShowLine(risk) ?? bookingMismatchLine(risk)) : null;

  return (
    <section
      id="plan"
      className="glass-card flex scroll-mt-20 flex-col gap-2.5 px-[22px] py-5"
      data-qc="treatment-plan-card"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-medium text-foreground">Skin plan roadmap</h2>
          <p className="mt-0.5 text-xs text-ink-2">
            {[detail.plan.name, detail.plan.practitionerName].filter(Boolean).join(" · ")} · same
            view as the patient's Timeline
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-xs tabular-nums text-ink-2" data-qc="plan-progress">
            {detail.plan.milestonesDone} of {detail.plan.milestonesTotal} milestones
          </span>
          <div className="h-[5px] w-[110px] rounded-full bg-[rgba(192,200,210,0.42)]" aria-hidden>
            <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {detail.roadmap.map((month) => {
        const monthDone = month.steps.every((s) => stepTone(s.status) === "done");
        return (
          <div key={month.n} className="flex flex-col gap-1.5" data-qc="roadmap-month">
            <div className="flex items-center gap-2.5 rounded-[14px] bg-[rgba(238,212,136,0.16)] px-3.5 py-2.5">
              <span
                className={cn(
                  "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  monthDone
                    ? "bg-success text-white"
                    : "border-[1.5px] border-[rgba(192,200,210,0.9)] bg-white text-foreground",
                )}
                aria-hidden
              >
                {month.n}
              </span>
              <div className="text-[13px] text-foreground">
                <b className="font-semibold">{month.month}</b>
                {month.title ? <span> {month.title}</span> : null}
              </div>
            </div>
            <ul className="flex flex-col gap-1.5 pl-4">
              {month.steps.map((step) => {
                const isCurrent = step.id === current?.id;
                const isSelected = step.id === selectedId;
                const chip = stepChip(step);
                const missed = isCurrent && Boolean(risk?.noShowAt);
                const needsBooking = stepNeedsBooking(step);
                return (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(step.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-[9px] text-left transition-colors",
                        isCurrent
                          ? "border-[rgba(214,183,92,0.5)] bg-[rgba(250,237,194,0.8)]"
                          : "border-edge-2 bg-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.9)]",
                        isSelected && "shadow-[0_0_0_2px_var(--accent-line)]",
                      )}
                      data-qc={isCurrent ? "plan-step" : "roadmap-step"}
                      data-step={step.id}
                      data-status={step.status}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-foreground">
                          {step.title}
                        </div>
                        <div className="text-[11.5px] text-ink-2">
                          {stepDateLine(step, { missed })}
                        </div>
                        {isCurrent && note ? (
                          <div className="text-[11.5px] text-ink-2" data-qc="plan-booking-note">
                            {note}
                          </div>
                        ) : null}
                      </div>
                      {missed ? (
                        <ToneChip tone="alert">No show</ToneChip>
                      ) : needsBooking ? (
                        <ToneChip tone="alert">Not booked</ToneChip>
                      ) : null}
                      <ToneChip tone={chip.tone}>{chip.label}</ToneChip>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
