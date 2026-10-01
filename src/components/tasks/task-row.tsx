import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { PatientAvatar } from "@/components/patient-avatar";
import { ContactMenu } from "@/components/tasks/contact-menu";
import { PATIENT_TYPE_META } from "@/lib/patients/records-summary";
import type { TaskView_ } from "@/lib/tasks/service";
import { staffLane } from "@/lib/staff-lane";
import {
  TASK_TYPE_META,
  isContactTask,
  MAX_CONTACT_ATTEMPTS,
  type TaskRole,
} from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

export type RowAction = {
  label: string;
  onClick?: () => void;
  kind?: "primary" | "ghost" | "done";
  /** Call / Message / Email — does not mark the task handled. */
  contact?: boolean;
};

/**
 * One task: who it is for, what needs doing and why, who has it, when it is
 * due, and the actions the viewer may take. The inline delegate / outcome
 * panel renders below it when open.
 */
export function TaskRow({
  task,
  role,
  actions,
  selectable,
  selected,
  onToggleSelect,
  draggable,
  onDragStart,
  onDragEnd,
  dragging,
  open,
  panel,
  onUndo,
  ownerLine,
}: {
  task: TaskView_;
  role: TaskRole;
  actions: RowAction[];
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  dragging: boolean;
  open: boolean;
  panel: React.ReactNode;
  onUndo?: (() => void) | undefined;
  /** "With Sofia M. · attempt 2 of 3", "In the front desk pool, not claimed yet", "Unassigned". */
  ownerLine?: string | null;
}) {
  const meta = TASK_TYPE_META[task.type];
  const done = task.status === "done" || task.status === "auto_closed";
  const lane = task.assigneeId ? staffLane(task.assigneeId, task.assigneeName) : null;
  const pooled = !task.assigneeId && task.assigneeRole === "front_desk";
  const showAttempts =
    !done &&
    isContactTask(task.type) &&
    !!task.assigneeId &&
    (role === "front_desk" || role === "owner" || role === "manager");
  const overdue = task.bucket === "overdue";
  const patientMeta = task.patient.patientType
    ? PATIENT_TYPE_META[task.patient.patientType]
    : null;

  return (
    <li
      data-qc="task-row"
      data-task-id={task.id}
      data-type={task.type}
      data-bucket={task.bucket}
      data-status={task.status}
      data-source={task.source}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      className={cn(
        "grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-xl px-2.5 py-3.5 transition-[background-color,opacity] duration-150 sm:grid-cols-[auto_36px_minmax(0,1fr)_32px_100px]",
        selectable && "sm:grid-cols-[20px_36px_minmax(0,1fr)_32px_100px]",
        !selectable && "sm:grid-cols-[36px_minmax(0,1fr)_32px_100px]",
        open && "bg-accent-wash/70",
        !open && selected && "bg-[rgba(47,63,102,0.04)]",
        dragging && "bg-accent-soft/60",
        done && "opacity-50",
        draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      {selectable ? (
        <div className="hidden pt-2 sm:block">
          <Checkbox
            checked={selected}
            onCheckedChange={onToggleSelect}
            aria-label={`Select ${task.title}`}
            data-qc="task-select"
          />
        </div>
      ) : null}
      <Link
        to="/patients"
        search={{ sel: task.patient.id } as never}
        className="pt-0.5"
        title={`${task.patient.name} in Records`}
      >
        <PatientAvatar
          patientId={task.patient.id}
          name={task.patient.name}
          photoUrl={task.patient.avatarUrl}
          size={36}
        />
      </Link>
      <div className="min-w-0 sm:col-span-1">
        <p
          className={cn(
            "text-[14px] font-semibold leading-snug text-foreground",
            done && "line-through",
          )}
          data-qc="task-title"
        >
          {task.title}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-ink-2">
          <Link
            to="/patients"
            search={{ sel: task.patient.id } as never}
            className="font-semibold text-foreground hover:text-accent-ink"
          >
            {task.patient.name}
          </Link>
          {task.context ? ` · ${task.context}` : ""}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span
            className={cn(
              "inline-flex h-[22px] items-center rounded-full px-2 text-[11px] font-semibold shadow-inset-hi",
              meta.chip,
            )}
            data-qc="task-type"
          >
            {meta.label}
          </span>
          {patientMeta ? (
            <span
              className={cn(
                "inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold shadow-inset-hi",
                patientMeta.pill,
              )}
              data-qc="task-patient-type"
              data-patient-type={task.patient.patientType}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", patientMeta.dot)} aria-hidden />
              {patientMeta.label}
            </span>
          ) : null}
        </div>
        {task.note ? (
          <p
            className="mt-2 rounded-xl bg-accent-wash px-3 py-2 text-[12.5px] leading-relaxed text-foreground"
            data-qc="task-note"
          >
            “{task.note}”
          </p>
        ) : null}
        {ownerLine ? (
          <p
            className="mt-2 inline-flex h-6 items-center rounded-full bg-[rgba(47,63,102,0.06)] px-2.5 text-[11.5px] font-medium text-ink-2"
            data-qc="task-owner-line"
          >
            {ownerLine}
          </p>
        ) : null}
        {showAttempts ? (
          <p
            className="mt-2 flex items-center gap-2 text-[11.5px] text-ink-2"
            data-qc="task-attempts"
            data-attempts={task.attempts}
          >
            <span className="flex items-center gap-1" aria-hidden>
              {Array.from({ length: MAX_CONTACT_ATTEMPTS }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 w-3.5 rounded-full",
                    i < task.attempts
                      ? "bg-warning"
                      : i === task.attempts
                        ? "bg-foreground"
                        : "bg-[rgba(47,63,102,0.12)]",
                  )}
                />
              ))}
            </span>
            {task.nextRetryAt && task.attempts > 0
              ? `Retry ${new Date(task.nextRetryAt).toLocaleDateString("en-GB", { weekday: "short" })} · `
              : ""}
            Attempt {Math.min(task.attempts + 1, MAX_CONTACT_ATTEMPTS)} of {MAX_CONTACT_ATTEMPTS}
          </p>
        ) : null}
        {!done && actions.length && !open ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5" data-qc="task-actions">
            {actions.map((a) =>
              a.contact ? (
                <ContactMenu
                  key={a.label}
                  patientId={task.patient.id}
                  patientName={task.patient.name}
                  phone={task.patient.phone}
                  email={task.patient.email}
                  kind={a.kind === "ghost" ? "ghost" : "primary"}
                />
              ) : (
                <button
                  key={a.label}
                  type="button"
                  onClick={a.onClick}
                  data-qc={`task-action-${a.label
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/-$/, "")}`}
                  className={cn(
                    "inline-flex h-7 cursor-pointer items-center gap-1 rounded-full px-3 text-[12px] font-semibold shadow-inset-hi transition-[filter,background-color] hover:brightness-[0.97]",
                    a.kind === "primary" && "bg-accent text-accent-foreground",
                    a.kind === "done" &&
                      "bg-transparent text-success-ink shadow-none hover:bg-success-bg",
                    (!a.kind || a.kind === "ghost") &&
                      "bg-[rgba(47,63,102,0.06)] text-foreground hover:bg-[rgba(47,63,102,0.1)]",
                  )}
                >
                  {a.kind === "done" ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                  {a.label}
                </button>
              ),
            )}
          </div>
        ) : null}
        {done && onUndo ? (
          <button
            type="button"
            onClick={onUndo}
            data-qc="task-undo"
            className="mt-2 inline-flex h-7 cursor-pointer items-center rounded-full bg-[rgba(47,63,102,0.06)] px-3 text-[12px] font-semibold text-foreground hover:bg-[rgba(47,63,102,0.1)]"
          >
            Undo
          </button>
        ) : null}
        {open ? <div className="mt-3">{panel}</div> : null}
      </div>
      <div className="flex justify-end pt-0.5">
        <span
          className={cn(
            "flex h-[30px] w-[30px] items-center justify-center rounded-full text-[10.5px] font-semibold",
            lane
              ? cn(lane.tone.edge, "text-accent-foreground")
              : pooled
                ? "bg-[rgba(47,63,102,0.08)] text-ink-2"
                : "bg-card text-destructive-ink shadow-[inset_0_0_0_1.5px_var(--destructive)]",
          )}
          title={task.assigneeName ?? (pooled ? "Front desk pool" : "Unassigned")}
          data-qc="task-assignee"
          data-assignee={task.assigneeId ?? (pooled ? "pool" : "none")}
        >
          {lane ? lane.initials : pooled ? "FD" : "?"}
        </span>
      </div>
      <p
        className={cn(
          "col-span-3 -mt-1 text-[12.5px] font-semibold sm:col-span-1 sm:mt-0 sm:pt-1 sm:text-right",
          done
            ? "text-success-ink"
            : overdue || task.escalated
              ? "text-destructive-ink"
              : "text-ink-2",
        )}
        data-qc="task-due"
      >
        {task.dueLabel}
      </p>
    </li>
  );
}
