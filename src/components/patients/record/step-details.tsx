import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ToneChip } from "@/components/patients/record/chips";
import type { PlanRiskRow, RoadmapStep } from "@/components/patients/record/skin-plan-roadmap";
import { setMilestoneChecklistItem } from "@/lib/clinic.functions";
import {
  clockTime,
  longDate,
  shortDate,
  shortDay,
  stepChip,
  stepNeedsBooking,
  stepTone,
} from "@/lib/patients/record-overview";
import { cn } from "@/lib/utils";

const TILE = "rounded-xl border px-3 py-2.5";

/**
 * The selected roadmap step: its dates, the patient's checklist with who
 * ticked what, and the clinic's two actions. Clinic-owned items are ticked
 * here; the patient's own items only show their state.
 */
export function StepDetails({
  step,
  risk,
  patientId,
  canTick,
  canBook,
  canEdit,
  onBook,
  onEdit,
}: {
  step: RoadmapStep | null;
  risk: PlanRiskRow | null;
  patientId: string;
  canTick: boolean;
  canBook: boolean;
  canEdit: boolean;
  onBook: (stepId: string) => void;
  onEdit: (step: RoadmapStep) => void;
}) {
  const queryClient = useQueryClient();
  const tick = useMutation({
    mutationFn: useServerFn(setMilestoneChecklistItem),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["patient-plan", patientId] });
      void queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!step) {
    return (
      <section className="glass-card flex flex-col gap-3 px-[22px] py-5" data-qc="step-details">
        <h2 className="text-[15.5px] font-medium text-foreground">Step details</h2>
        <p className="text-sm text-ink-2">
          Choose a step on the roadmap to see its dates and checklist.
        </p>
      </section>
    );
  }

  const done = stepTone(step.status) === "done";
  const chip = stepChip(step);
  const missed = Boolean(risk?.noShowAt) && step.status === "current";
  const needsBooking = stepNeedsBooking(step);
  const checklist = step.checklist ?? [];
  const ticked = checklist.filter((c) => c.done).length;
  const canBookThis = canBook && !done && !step.bookedAt && !step.appointment;

  return (
    <section
      className="glass-card flex flex-col gap-3 px-[22px] py-5"
      data-qc="step-details"
      data-step={step.id}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15.5px] font-medium text-foreground">Step details</h2>
        {missed ? (
          <ToneChip tone="alert">No show</ToneChip>
        ) : (
          <ToneChip tone={chip.tone}>{chip.label}</ToneChip>
        )}
      </div>
      <div className="text-[15px] font-semibold text-foreground">{step.title}</div>
      {step.detail ? <p className="-mt-1.5 text-xs text-ink-2">{step.detail}</p> : null}

      <div className="grid grid-cols-2 gap-2">
        <div className={cn(TILE, "border-edge-2 bg-[rgba(255,255,255,0.6)]")}>
          <div className="text-[11.5px] text-ink-2">Due date</div>
          <div className="text-[13px] font-semibold text-foreground">
            {step.date ? longDate(step.date) : "No due date"}
          </div>
        </div>
        {done ? (
          <div className={cn(TILE, "border-edge-2 bg-[rgba(255,255,255,0.6)]")}>
            <div className="text-[11.5px] text-ink-2">Completed</div>
            <div className="text-[13px] font-semibold text-foreground">
              {step.completedAt ? longDate(step.completedAt) : "Done"}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              TILE,
              needsBooking
                ? "border-[rgba(220,108,150,0.2)] bg-[rgba(250,204,226,0.3)]"
                : "border-edge-2 bg-[rgba(255,255,255,0.6)]",
            )}
            data-qc="step-booked-for"
            data-booked={step.bookedAt ? "true" : "false"}
          >
            <div className="text-[11.5px] text-ink-2">Booked for</div>
            <div
              className={cn(
                "text-[13px] font-semibold",
                needsBooking ? "text-destructive-ink" : "text-foreground",
              )}
            >
              {step.bookedAt
                ? `${shortDay(step.bookedAt)} · ${clockTime(step.bookedAt)}`
                : missed && risk?.noShowAt
                  ? `Missed ${shortDate(risk.noShowAt)}`
                  : "Not booked"}
            </div>
          </div>
        )}
      </div>

      <div
        className="flex flex-col gap-[7px] rounded-[14px] border border-edge-2 bg-[rgba(255,255,255,0.6)] p-3"
        data-qc="step-checklist"
      >
        <div className="flex justify-between text-[12.5px]">
          <b className="font-semibold text-foreground">Patient checklist</b>
          <span className="text-ink-2">
            {checklist.length ? `${ticked} of ${checklist.length}` : "None"}
          </span>
        </div>
        {checklist.length === 0 ? (
          <p className="text-xs text-ink-2">No checklist for this step.</p>
        ) : (
          checklist.map((item) => {
            const owner = item.doneByKind ?? (item.byClinic ? "clinic" : "patient");
            const clinicCanTick = item.byClinic && canTick && !done;
            const box = (
              <span
                className={cn(
                  "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] text-[9px] text-white",
                  item.done
                    ? "bg-success"
                    : item.byClinic
                      ? "border-[1.5px] border-[#e2c46b]"
                      : "border-[1.5px] border-[rgba(192,200,210,0.9)]",
                )}
                aria-hidden
              >
                {item.done ? "✓" : ""}
              </span>
            );
            return (
              <div
                key={item.id}
                className="flex items-center gap-2 text-[12.5px] text-foreground"
                data-qc="step-checklist-item"
                data-done={item.done ? "true" : "false"}
                data-owner={item.byClinic ? "clinic" : "patient"}
              >
                {clinicCanTick ? (
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left disabled:cursor-default"
                    onClick={() => tick.mutate({ data: { id: item.id, done: !item.done } })}
                    disabled={tick.isPending}
                    aria-pressed={item.done}
                    aria-label={`${item.done ? "Untick" : "Tick"} ${item.label}`}
                    data-qc="step-checklist-tick"
                  >
                    {box}
                    <span className="flex-1">{item.label}</span>
                  </button>
                ) : (
                  <>
                    {box}
                    <span className="flex-1">{item.label}</span>
                  </>
                )}
                {item.done ? (
                  <span className="text-[11px] text-ink-2">
                    {owner}
                    {item.doneAt ? ` · ${shortDate(item.doneAt)}` : ""}
                  </span>
                ) : item.byClinic ? (
                  <span className="text-[11px] font-semibold text-accent-ink">
                    {canTick ? "You can tick" : "Clinic ticks"}
                  </span>
                ) : (
                  <span className="text-[11px] text-ink-2">patient</span>
                )}
              </div>
            );
          })
        )}
      </div>

      {canBookThis || canEdit ? (
        <div className="flex flex-wrap gap-1.5">
          {canBookThis ? (
            <Button
              type="button"
              className="h-auto rounded-full px-[13px] py-1.5 text-xs"
              onClick={() => onBook(step.id)}
              data-qc="plan-book"
            >
              Book this step
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              className="h-auto rounded-full border-edge-2 bg-[rgba(255,255,255,0.7)] px-[13px] py-1.5 text-xs font-medium"
              onClick={() => onEdit(step)}
              data-qc="step-edit"
            >
              Edit step
            </Button>
          ) : null}
        </div>
      ) : null}
      <p className="text-[11.5px] text-ink-2">
        Changes here show on the patient's Timeline straight away.
      </p>
    </section>
  );
}
