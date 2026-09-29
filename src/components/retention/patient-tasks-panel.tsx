import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AssignTaskDialog } from "@/components/tasks/assign-task-dialog";
import { listPatientTasks } from "@/lib/clinic.functions";
import { can } from "@/lib/permissions";
import { staffLane } from "@/lib/staff-lane";
import type { TaskView_ } from "@/lib/tasks/service";
import { TASK_TYPE_META } from "@/lib/tasks/types";
import { useIdentity } from "@/lib/use-identity";
import { useTasksLiveSync } from "@/lib/use-tasks-sync";
import { cn } from "@/lib/utils";

/**
 * The patient record's tasks card: what is open for this patient, who has
 * it and when it is due, with a way to add one. Actions (complete, hand off,
 * reassign) live on the Tasks page, which each row opens.
 */
export function PatientTasksPanel({
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
  const [assignOpen, setAssignOpen] = useState(false);
  const tasks = (data ?? []) as TaskView_[];
  const open = tasks.filter((t) => t.status === "open" || t.status === "snoozed");
  const recent = tasks.filter((t) => t.status === "done" || t.status === "auto_closed").slice(0, 3);

  return (
    <Card className="mt-4 min-w-0 p-5" id="tasks" data-qc="patient-tasks" data-open={open.length}>
      <span id="recall" className="sr-only" aria-hidden />
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="section-title">Tasks</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {open.length === 0
              ? "Nothing open. Automations are watching this patient."
              : `${open.length} open · done on the Tasks page`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {identity?.isStaff ? (
            <button
              type="button"
              onClick={() => setAssignOpen(true)}
              data-qc="patient-tasks-assign"
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-full bg-accent px-3 text-[12px] font-semibold text-accent-foreground shadow-inset-hi transition-[filter] hover:brightness-[0.97]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Assign task
            </button>
          ) : null}
          <Link
            to="/tasks"
            className="inline-flex h-8 items-center gap-1 rounded-full bg-[rgba(47,63,102,0.06)] px-3 text-[12px] font-semibold text-foreground hover:bg-[rgba(47,63,102,0.1)]"
            data-qc="patient-tasks-open"
          >
            Open Tasks
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {open.length ? (
        <ul className="divide-y divide-edge-2">
          {open.map((t) => (
            <TaskLine key={t.id} task={t} />
          ))}
        </ul>
      ) : null}
      {recent.length ? (
        <details className="mt-3 text-[12.5px]">
          <summary className="cursor-pointer text-ink-3 hover:text-foreground">
            Recently closed ({recent.length})
          </summary>
          <ul className="mt-1 divide-y divide-edge-2 opacity-70">
            {recent.map((t) => (
              <TaskLine key={t.id} task={t} />
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
    </Card>
  );
}

function TaskLine({ task }: { task: TaskView_ }) {
  const meta = TASK_TYPE_META[task.type];
  const lane = task.assigneeId ? staffLane(task.assigneeId, task.assigneeName) : null;
  const done = task.status === "done" || task.status === "auto_closed";
  return (
    <li className="min-w-0">
      <Link
        to="/tasks"
        search={{ task: task.id } as never}
        className="flex min-w-0 items-center gap-2.5 overflow-hidden rounded-lg px-1 py-2 transition-colors hover:bg-[rgba(47,63,102,0.05)]"
        data-qc="patient-task"
        data-status={task.status}
      >
        <span
          className={cn(
            "inline-flex h-[22px] shrink-0 items-center rounded-full px-2 text-[11px] font-semibold shadow-inset-hi",
            meta.chip,
          )}
        >
          {meta.label}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 break-words text-[13px] text-foreground line-clamp-1",
            done && "line-through",
          )}
        >
          {task.title}
        </span>
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[7.5px] font-bold text-accent-foreground",
            lane ? lane.tone.edge : "bg-glass-2 text-ink-3",
          )}
          title={task.assigneeName ?? "Front desk pool"}
          aria-hidden
        >
          {lane ? lane.initials : "FD"}
        </span>
        <span
          className={cn(
            "shrink-0 text-[12px] font-semibold",
            done
              ? "text-success-ink"
              : task.bucket === "overdue"
                ? "text-destructive-ink"
                : "text-ink-2",
          )}
        >
          {task.dueLabel}
        </span>
      </Link>
    </li>
  );
}
