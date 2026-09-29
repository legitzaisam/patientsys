import { Card } from "@/components/ui/card";
import { staffLane } from "@/lib/staff-lane";
import type { TasksSummary } from "@/lib/tasks/service";
import { ROLE_VIEWS, type TaskRole, type TaskView } from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  practitioner: "Practitioner",
  front_desk: "Front desk",
};

/** Left nav: the role's views with counts and the "closed automatically" footnote. */
export function TasksNav({
  role,
  view,
  personId,
  counts,
  autoClosed,
  onPick,
}: {
  role: TaskRole;
  view: TaskView;
  personId: string | null;
  counts: Map<TaskView, number>;
  autoClosed: number;
  onPick: (view: TaskView) => void;
}) {
  return (
    <nav
      className="flex min-w-0 max-w-full flex-col gap-0.5 rounded-2xl border border-edge bg-glass-2 p-1 shadow-inset-hi lg:sticky lg:top-4"
      aria-label="Task views"
      data-qc="tasks-nav"
    >
      <div className="scroll-x-plain flex min-w-0 max-w-full gap-0.5 lg:flex-col">
        {ROLE_VIEWS[role].map((v) => {
          const on = view === v.view && !personId;
          return (
            <button
              key={v.view}
              type="button"
              onClick={() => onPick(v.view)}
              aria-current={on ? "page" : undefined}
              data-qc={`tasks-view-${v.view}`}
              className={cn(
                "flex h-9 shrink-0 cursor-pointer items-center justify-between gap-3 whitespace-nowrap rounded-xl px-3 text-[13px] transition-colors lg:w-full",
                on
                  ? "bg-card font-semibold text-foreground shadow-[0_1px_2px_rgba(47,63,102,0.1)]"
                  : "text-ink-2 hover:bg-[rgba(47,63,102,0.06)] hover:text-foreground",
              )}
            >
              {v.label}
              <span
                className={cn("text-[12px] tabular-nums", on ? "text-foreground" : "text-ink-3")}
              >
                {counts.get(v.view) ?? 0}
              </span>
            </button>
          );
        })}
      </div>
      {autoClosed > 0 ? (
        <p
          className="hidden border-t border-edge-2 px-3 pb-2 pt-3 text-[12px] leading-relaxed text-ink-2 lg:block"
          data-qc="tasks-auto-closed"
        >
          <span className="font-semibold text-success-ink">{autoClosed} closed automatically</span>{" "}
          this week, when patients booked or replied before anyone had to chase.
        </p>
      ) : null}
    </nav>
  );
}

/** Owner: the Team panel. Rows are drop targets; a click filters or, with a selection, assigns. */
export function TeamPanel({
  summary,
  personId,
  selectedCount,
  dragging,
  hoverId,
  onHover,
  onDrop,
  onClick,
}: {
  summary: TasksSummary;
  personId: string | null;
  selectedCount: number;
  dragging: boolean;
  hoverId: string | null;
  onHover: (id: string | null) => void;
  /** `taskId` is what the drag carried in `dataTransfer`, for drops that land before React saw the drag start. */
  onDrop: (id: string, taskId: string | null) => void;
  onClick: (id: string) => void;
}) {
  const max = Math.max(1, ...summary.team.map((m) => m.open));
  const hint = dragging
    ? "Drop on a teammate to assign"
    : selectedCount
      ? `Tap a teammate to assign ${selectedCount} selected`
      : "Drag a task onto someone, or tap to see their list";
  return (
    <Card className="flex flex-col gap-2 p-4" data-qc="team-panel">
      <div>
        <h2 className="section-title">Team</h2>
        <p
          className={cn(
            "mt-0.5 text-[12px]",
            dragging || selectedCount ? "font-semibold text-accent-ink" : "text-ink-3",
          )}
          data-qc="team-hint"
        >
          {hint}
        </p>
      </div>
      <ul className="flex flex-col gap-1">
        {summary.team.map((m) => {
          const lane = staffLane(m.id, m.name);
          const on = personId === m.id;
          const hover = hoverId === m.id;
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onClick(m.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (hoverId !== m.id) onHover(m.id);
                }}
                onDragLeave={() => hoverId === m.id && onHover(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  let carried: string | null = null;
                  try {
                    carried = e.dataTransfer.getData("text/plain") || null;
                  } catch {
                    carried = null;
                  }
                  onDrop(m.id, carried);
                }}
                data-qc={`team-member-${m.id}`}
                data-drop-target
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-[background-color,box-shadow] duration-150",
                  hover && "bg-accent-wash shadow-[0_0_0_2px_var(--accent-deep)]",
                  !hover && on && "bg-accent-soft/60 shadow-[inset_0_0_0_1.5px_var(--accent-line)]",
                  !hover &&
                    !on &&
                    (dragging || selectedCount
                      ? "shadow-[inset_0_0_0_1.5px_var(--accent-line)]"
                      : "hover:bg-[rgba(47,63,102,0.05)]"),
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-accent-foreground",
                    lane.tone.edge,
                  )}
                  aria-hidden
                >
                  {lane.initials}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-semibold text-foreground">
                      {m.name}
                    </span>
                    <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-foreground">
                      {m.open}
                    </span>
                  </span>
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[11.5px] text-ink-3">{ROLE_LABEL[m.role] ?? m.role}</span>
                    {m.overdue ? (
                      <span className="text-[11px] font-semibold text-destructive-ink">
                        {m.overdue} overdue
                      </span>
                    ) : null}
                  </span>
                  <span
                    className="mt-1.5 flex h-1 overflow-hidden rounded-full bg-[rgba(47,63,102,0.08)]"
                    aria-hidden
                  >
                    <span
                      className="h-full rounded-full bg-accent-deep"
                      style={{ width: `${((m.open - m.overdue) / max) * 100}%` }}
                    />
                    <span
                      className="h-full rounded-full bg-destructive"
                      style={{ width: `${(m.overdue / max) * 100}%` }}
                    />
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-[rgba(47,63,102,0.04)] p-3" data-qc="team-pool">
          <p className="text-[20px] font-semibold leading-none text-foreground">{summary.pool}</p>
          <p className="mt-1 text-[11.5px] text-ink-2">In front desk pool</p>
        </div>
        <div className="rounded-xl bg-destructive-bg p-3" data-qc="team-unassigned">
          <p className="text-[20px] font-semibold leading-none text-destructive-ink">
            {summary.unassigned}
          </p>
          <p className="mt-1 text-[11.5px] text-destructive-ink">Unassigned</p>
        </div>
      </div>
    </Card>
  );
}

/** Practitioner: Your day. */
export function YourDayPanel({
  summary,
  onPick,
}: {
  summary: TasksSummary;
  onPick: (view: TaskView) => void;
}) {
  const tiles: Array<{
    view: TaskView;
    n: number;
    label: string;
    sub: string;
    tone: "pink" | "plain";
  }> = [
    {
      view: "questions",
      n: summary.questions,
      label: "Clinical questions",
      sub: "Reply within 4 hours of the message",
      tone: "pink",
    },
    {
      view: "assigned",
      n: summary.openForMe,
      label: "Assigned to you",
      sub: "Close each one with an outcome",
      tone: "plain",
    },
    {
      view: "patients_with_others",
      n: summary.patientsWithOthers,
      label: "Your patients, with others",
      sub: "Read-only. Take over any time",
      tone: "plain",
    },
  ];
  return (
    <Card className="flex flex-col gap-2 p-4" data-qc="your-day-panel">
      <h2 className="section-title">Your day</h2>
      {tiles.map((t) => (
        <button
          key={t.view}
          type="button"
          onClick={() => onPick(t.view)}
          data-qc={`your-day-${t.view}`}
          className={cn(
            "flex cursor-pointer items-center justify-between gap-3 rounded-xl p-3 text-left transition-[filter] hover:brightness-[0.98]",
            t.tone === "pink" ? "bg-destructive-bg" : "bg-[rgba(47,63,102,0.04)]",
          )}
        >
          <span className="min-w-0">
            <span
              className={cn(
                "block text-[13px] font-semibold",
                t.tone === "pink" ? "text-destructive-ink" : "text-foreground",
              )}
            >
              {t.label}
            </span>
            <span
              className={cn(
                "block text-[11.5px]",
                t.tone === "pink" ? "text-destructive-ink/80" : "text-ink-3",
              )}
            >
              {t.sub}
            </span>
          </span>
          <span
            className={cn(
              "text-[20px] font-semibold tabular-nums",
              t.tone === "pink" ? "text-destructive-ink" : "text-foreground",
            )}
          >
            {t.n}
          </span>
        </button>
      ))}
      <p className="pt-1 text-[12px] leading-relaxed text-ink-2">
        Can't reach someone? Choose <span className="font-semibold text-foreground">No answer</span>{" "}
        and it goes to the front desk to retry. Only managers can assign to other practitioners.
      </p>
    </Card>
  );
}

/** Front desk: Today's calls. */
export function TodaysCallsPanel({ summary }: { summary: TasksSummary }) {
  const total = summary.handledToday + summary.openForMe;
  const pct = total ? Math.round((summary.handledToday / total) * 100) : 0;
  return (
    <Card className="flex flex-col gap-3 p-4" data-qc="todays-calls-panel">
      <div>
        <h2 className="section-title">Today's calls</h2>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-[rgba(47,63,102,0.08)]"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-success transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[12px] text-ink-2" data-qc="calls-progress">
          {summary.handledToday} of {total} handled
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          {
            n: summary.openForMe,
            label: "In your queue",
            cls: "bg-[rgba(47,63,102,0.04)] text-foreground",
          },
          {
            n: summary.pool,
            label: "Waiting in pool",
            cls: "bg-[rgba(47,63,102,0.04)] text-foreground",
          },
          { n: summary.bookedToday, label: "Booked today", cls: "bg-success-bg text-success-ink" },
          {
            n: summary.retriesScheduled,
            label: "Retries scheduled",
            cls: "bg-warning-bg text-warning-ink",
          },
        ].map((s) => (
          <div key={s.label} className={cn("rounded-xl p-3", s.cls)}>
            <p className="text-[20px] font-semibold leading-none tabular-nums">{s.n}</p>
            <p className="mt-1 text-[11.5px] opacity-80">{s.label}</p>
          </div>
        ))}
      </div>
      <p className="text-[12px] leading-relaxed text-ink-2">
        Three missed attempts escalate to the owner automatically. Clinical questions never land
        here. <span className="font-semibold text-foreground">Needs clinician</span> sends it to the
        practitioner.
      </p>
    </Card>
  );
}

/** Owner: the bar above the list once rows are selected. */
export function BulkBar({
  count,
  onHandled,
  onClear,
}: {
  count: number;
  onHandled: () => void;
  onClear: () => void;
}) {
  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-accent-wash px-3.5 py-2.5 shadow-[inset_0_0_0_1px_var(--accent-line)]"
      data-qc="bulk-bar"
    >
      <span className="text-[13px] font-semibold text-foreground">{count} selected</span>
      <span className="text-[12px] text-ink-2">Tap a teammate on the right to assign, or</span>
      <button
        type="button"
        onClick={onHandled}
        data-qc="bulk-handled"
        className="h-7 cursor-pointer rounded-full bg-[rgba(47,63,102,0.08)] px-3 text-[12px] font-semibold text-foreground hover:bg-[rgba(47,63,102,0.12)]"
      >
        Mark handled
      </button>
      <button
        type="button"
        onClick={onClear}
        data-qc="bulk-clear"
        className="ml-auto h-7 cursor-pointer px-2 text-[12px] font-semibold text-ink-2 underline underline-offset-[3px] hover:text-foreground"
      >
        Clear
      </button>
    </div>
  );
}
