import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCheck } from "lucide-react";
import { ToneChip, type ChipTone } from "@/components/patients/record/chips";
import {
  RecordCard,
  recordLinkClass,
  recordRowClass,
} from "@/components/patients/record/record-card";
import { AssignTaskDialog } from "@/components/tasks/assign-task-dialog";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import { listPatientTasks } from "@/lib/clinic.functions";
import { can } from "@/lib/permissions";
import { staffLane } from "@/lib/staff-lane";
import type { TaskView_ } from "@/lib/tasks/service";
import { TASK_TYPE_META, type TaskType } from "@/lib/tasks/types";
import { useIdentity } from "@/lib/use-identity";
import { useTasksLiveSync } from "@/lib/use-tasks-sync";
import { cn } from "@/lib/utils";

/** The record's type chips: Chase booking in the review purple, Recall in sky, the rest as the Tasks page. */
const TYPE_TONE: Partial<Record<TaskType, ChipTone>> = {
  chase_booking: "review",
  recall: "sky",
  rebook_no_show: "alert",
  question: "current",
  plan_support: "done",
  send_offer: "moderate",
};

/**
 * The Overview's Tasks and recalls card: what is open for this patient, who
 * has it and when it is due. A tick on a row completes it (with Undo, through
 * the same action the Tasks page uses); everything else still happens on the
 * Tasks page, which each row opens.
 */
export function TasksRecallsCard({
  patientId,
  patientName,
  patientFirstName,
  avatarUrl,
  practitionerId,
  context,
}: {
  patientId: string;
  patientName: string;
  patientFirstName: string;
  avatarUrl?: string | null;
  practitionerId?: string | null;
  context?: string | null;
}) {
  const { data: identity } = useIdentity();
  useTasksLiveSync(patientId);
  const fetchTasks = useServerFn(listPatientTasks);
  const { data, isLoading } = useQuery({
    queryKey: ["patient-tasks", patientId],
    queryFn: () => fetchTasks({ data: { patient_id: patientId } }),
  });
  const actions = useTaskActions();
  const [assignOpen, setAssignOpen] = useState(false);
  // Rows ticked here read as done at once; the refetch after the server call confirms it.
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const tasks = (data ?? []) as TaskView_[];
  const open = tasks.filter((t) => t.status === "open" || t.status === "snoozed");
  const recent = tasks.filter((t) => t.status === "done" || t.status === "auto_closed").slice(0, 3);
  const openCount = open.filter((t) => !ticked.has(t.id)).length;

  // Ids whose server call has finished; the next refetch carries the truth, so
  // the local tick comes off then (and Undo, which refetches again, reads fresh).
  const settled = useRef(new Set<string>());
  const untick = (id: string) =>
    setTicked((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  const toggle = (t: TaskView_) => {
    if (ticked.has(t.id) || !t.can.complete) return;
    setTicked((s) => new Set(s).add(t.id));
    // run() resolves null when the call failed (already rolled back and toasted) or was skipped.
    void actions.complete(t, "handled", "Handled").then((result) => {
      if (result === null) untick(t.id);
      else settled.current.add(t.id);
    });
  };
  useEffect(() => {
    for (const id of settled.current) {
      settled.current.delete(id);
      untick(id);
    }
  }, [data]);

  return (
    <RecordCard
      icon={<CheckCheck />}
      tone="warning"
      title="Tasks and recalls"
      meta={isLoading ? "…" : openCount === 0 ? "All done" : `${openCount} open`}
      data-qc="patient-tasks"
      data-open={String(openCount)}
      className="scroll-mt-24"
      footer={
        <>
          {identity?.isStaff ? (
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              data-qc="patient-tasks-assign"
              className="inline-flex cursor-pointer items-center whitespace-nowrap rounded-full bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-bloom transition-[filter] hover:brightness-[0.97]"
            >
              + Assign task
            </button>
          ) : (
            <span />
          )}
          <Link to="/tasks" className={recordLinkClass} data-qc="patient-tasks-open">
            Open Tasks →
          </Link>
        </>
      }
    >
      <span id="tasks" className="sr-only" aria-hidden />
      <span id="recall" className="sr-only" aria-hidden />
      {isLoading ? <p className="text-sm text-ink-2">Loading…</p> : null}
      {!isLoading && open.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-edge-2 bg-glass-2 px-4 py-6 text-center text-sm text-ink-2">
          Nothing open. Automations are watching this patient.
        </p>
      ) : null}
      {open.length ? (
        <ul className="flex flex-col gap-2">
          {open.map((t) => (
            <TaskRow key={t.id} task={t} done={ticked.has(t.id)} onToggle={() => toggle(t)} />
          ))}
        </ul>
      ) : null}
      {recent.length ? (
        <details className="text-[12.5px]">
          <summary className="cursor-pointer text-ink-3 hover:text-foreground">
            Recently closed ({recent.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2 opacity-70">
            {recent.map((t) => (
              <TaskRow key={t.id} task={t} done />
            ))}
          </ul>
        </details>
      ) : null}

      <AssignTaskDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        patient={{
          id: patientId,
          firstName: patientFirstName,
          name: patientName,
          avatarUrl: avatarUrl ?? null,
          context: context ?? null,
          practitionerId: practitionerId ?? null,
        }}
        viewerId={identity?.userId ?? ""}
        canAssignOthers={can(identity, "tasks.assign_any")}
      />
    </RecordCard>
  );
}

/** Kept for callers that still import the old name. */
export const PatientTasksPanel = TasksRecallsCard;

function TaskRow({
  task,
  done,
  onToggle,
}: {
  task: TaskView_;
  done: boolean;
  onToggle?: () => void;
}) {
  const meta = TASK_TYPE_META[task.type];
  const lane = task.assigneeId ? staffLane(task.assigneeId, task.assigneeName) : null;
  const closed = done || task.status === "done" || task.status === "auto_closed";
  const canTick = Boolean(onToggle) && task.can.complete && !closed;
  const who =
    task.assigneeName ?? (task.assigneeRole === "front_desk" ? "Front desk" : "Unassigned");
  const dueWord = task.dueLabel.charAt(0).toLowerCase() + task.dueLabel.slice(1);
  return (
    <li
      className={cn(
        recordRowClass,
        "flex items-start gap-3 transition-colors hover:bg-[rgba(255,255,255,0.9)]",
      )}
      data-qc="patient-task"
      data-status={closed ? "done" : task.status}
    >
      <button
        type="button"
        onClick={canTick ? onToggle : undefined}
        disabled={!canTick}
        aria-label={closed ? "Done" : `Mark ${task.title} as handled`}
        data-qc="patient-task-tick"
        // The circle is 18px as drawn; the button around it is the tap target
        // (28px, so it is still 24px once the iPad's 0.9 zoom applies).
        className={cn(
          "group/tick -m-[5px] mt-[-4px] flex h-7 w-7 shrink-0 items-center justify-center",
          canTick ? "cursor-pointer" : "cursor-default",
        )}
      >
        <span
          className={cn(
            "flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] text-white",
            closed ? "bg-success" : "border-[1.5px] border-[rgba(70,85,122,0.4)]",
            canTick && !closed && "group-hover/tick:border-success",
          )}
          aria-hidden
        >
          {closed ? "✓" : ""}
        </span>
      </button>
      <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
        <Link
          to="/tasks"
          search={{ task: task.id } as never}
          className={cn(
            "break-words text-[13.5px] font-medium text-foreground line-clamp-2 hover:text-accent-ink",
            closed && "line-through opacity-55",
          )}
        >
          {task.title}
        </Link>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
          <ToneChip tone={TYPE_TONE[task.type] ?? "upcoming"}>{meta.label}</ToneChip>
          <span
            className={cn(
              "inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[9px] font-bold",
              lane ? lane.tone.edge : "bg-accent-soft text-accent-ink",
            )}
            title={who}
            aria-hidden
          >
            {lane ? lane.initials : "FD"}
          </span>
          <span>
            {/* A hand-written context is short ("Auto-created from 27 Sep"); a rule's is a sentence, so show who holds it instead. */}
            {task.context && task.source === "manual" ? `${task.context} · ` : `${who} · `}
            <span
              className={cn(
                closed
                  ? "text-success-ink"
                  : task.bucket === "overdue"
                    ? "font-semibold text-destructive-ink"
                    : "",
              )}
            >
              {closed ? task.dueLabel : `due ${dueWord}`}
            </span>
          </span>
        </div>
      </div>
    </li>
  );
}
