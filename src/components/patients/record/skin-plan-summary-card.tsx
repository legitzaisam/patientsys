import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToneChip } from "@/components/patients/record/chips";
import { RecordCard, recordLinkClass } from "@/components/patients/record/record-card";
import { JOURNEY_PHASE_META, type JourneyPhaseKey } from "@/lib/journey-phases";
import {
  planMonths,
  relativeDays,
  shortDay,
  upNextStep,
  type RoadmapMonthLike,
} from "@/lib/patients/record-overview";
import { cn } from "@/lib/utils";

/** What getPatientPlanDetail returns, as the Overview card reads it. */
export type PlanDetail = {
  plan: {
    id: string;
    name: string;
    phase: string | null;
    status: string;
    practitionerId: string | null;
    practitionerName: string | null;
    milestonesDone: number;
    milestonesTotal: number;
  };
  roadmap: RoadmapMonthLike[];
  milestoneAppointmentIds: string[];
};

const SEGMENT: Record<"done" | "current" | "upcoming", string> = {
  done: "bg-success",
  current: "bg-accent shadow-[0_0_0_3px_rgba(238,212,136,0.4)]",
  upcoming: "bg-[rgba(192,200,210,0.45)]",
};

/**
 * The condensed skin plan on the Overview: the month-split progress bar, the
 * step that is up next with its booking state and a Book button, and the
 * patient's checklist count. The full roadmap lives on Treatments.
 */
export function SkinPlanSummaryCard({
  detail,
  now,
  canBook,
  onBook,
  onOpenRoadmap,
}: {
  detail: PlanDetail | null | undefined;
  now: Date;
  canBook: boolean;
  onBook: (stepId: string) => void;
  onOpenRoadmap: () => void;
}) {
  const months = detail ? planMonths(detail.roadmap) : null;
  const next = detail ? upNextStep(detail.roadmap) : null;
  const phase = detail?.plan.phase
    ? (JOURNEY_PHASE_META[detail.plan.phase as JourneyPhaseKey]?.label ?? detail.plan.phase)
    : null;

  return (
    <RecordCard
      icon={<TrendingUp />}
      tone="success"
      title="Skin plan"
      meta={months && months.total > 0 ? `Month ${months.current} of ${months.total}` : undefined}
      data-qc="skin-plan-card"
      footer={
        <>
          <span className="whitespace-nowrap text-xs text-ink-2">
            {next ? (
              <>
                Checklist{" "}
                <b className="font-semibold text-foreground">
                  {next.checklistDone} of {next.checklistTotal}
                </b>
              </>
            ) : detail ? (
              "Every step done"
            ) : (
              "No plan yet"
            )}
          </span>
          <button
            type="button"
            className={recordLinkClass}
            onClick={onOpenRoadmap}
            data-qc="skin-plan-roadmap"
          >
            Open roadmap →
          </button>
        </>
      }
    >
      {!detail ? (
        <p className="text-sm text-ink-2">
          No active skin plan. Start one from the journey board and it shows here, on Treatments and
          in the patient's portal.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13.5px] font-semibold text-foreground">{detail.plan.name}</span>
            <span className="text-xs text-ink-2">
              {[phase, detail.plan.practitionerName].filter(Boolean).join(" · ")}
            </span>
          </div>

          {months && months.total > 0 ? (
            <div className="flex flex-col gap-1.5" data-qc="skin-plan-months">
              <div
                className="grid gap-1.5"
                style={{
                  gridTemplateColumns: months.months.map((m) => `${m.steps.length}fr`).join(" "),
                }}
              >
                {months.months.map((m) => (
                  <div
                    key={m.n}
                    className="grid gap-[3px]"
                    style={{ gridTemplateColumns: `repeat(${m.steps.length}, 1fr)` }}
                  >
                    {m.steps.map((tone, i) => (
                      <div
                        key={i}
                        className={cn("h-2 rounded-full", SEGMENT[tone])}
                        data-tone={tone}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div
                className="grid gap-1.5 text-[11px] text-ink-3"
                style={{
                  gridTemplateColumns: months.months.map((m) => `${m.steps.length}fr`).join(" "),
                }}
              >
                {months.months.map((m) => (
                  <span key={m.n} className="truncate">
                    {m.title}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {next ? (
            <div
              className="flex items-center gap-3 rounded-2xl border border-accent-line bg-accent-wash px-3.5 py-3"
              data-qc="skin-plan-next"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="text-[11px] font-semibold tracking-[0.04em] text-accent-ink">
                  UP NEXT · STEP {next.index} OF {next.total}
                </span>
                <span className="text-[13.5px] font-semibold text-foreground">{next.title}</span>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
                  {next.dueDate ? (
                    <span>
                      Due {shortDay(next.dueDate)} · {relativeDays(next.dueDate, now)}
                    </span>
                  ) : (
                    <span>No due date</span>
                  )}
                  {next.booked ? (
                    <ToneChip tone="done">
                      Booked{next.bookedAt ? ` ${shortDay(next.bookedAt)}` : ""}
                    </ToneChip>
                  ) : next.needsBooking ? (
                    <ToneChip tone="alert" data-qc="skin-plan-not-booked">
                      Not booked
                    </ToneChip>
                  ) : null}
                </div>
              </div>
              {next.needsBooking && canBook ? (
                <Button
                  type="button"
                  className="h-auto rounded-full px-[15px] py-[7px] text-[12.5px]"
                  onClick={() => onBook(next.id)}
                  data-qc="skin-plan-book"
                >
                  Book
                </Button>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-ink-2">Every step of this plan is done.</p>
          )}
        </>
      )}
    </RecordCard>
  );
}
