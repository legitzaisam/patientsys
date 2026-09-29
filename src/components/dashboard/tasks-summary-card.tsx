import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, ListChecks } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getTasksSummary } from "@/lib/clinic.functions";
import { staffLane } from "@/lib/staff-lane";
import type { TasksSummary } from "@/lib/tasks/service";
import { TASK_TYPE_META } from "@/lib/tasks/types";
import { useTasksLiveSync } from "@/lib/use-tasks-sync";
import { cn } from "@/lib/utils";

/**
 * The dashboard's view of tasks: an aggregate only. How many are open and
 * overdue for this person, what kinds they are, and the role's own numbers
 * (team load, clinical questions, today's calls). Every action lives on the
 * Tasks page, one click away.
 */
export function TasksSummaryCard() {
  useTasksLiveSync();
  const fetchSummary = useServerFn(getTasksSummary);
  const { data, isLoading } = useQuery({
    queryKey: ["tasks-summary"],
    queryFn: () => fetchSummary(),
  });

  return (
    <section className="mt-2" data-qc="tasks-summary">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="section-title">My tasks</h2>
          <p className="text-xs text-muted-foreground">
            What needs doing for patients. Do it on the Tasks page.
          </p>
        </div>
        <Link
          to="/tasks"
          data-qc="tasks-summary-open"
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-accent px-3.5 text-[12.5px] font-semibold text-accent-foreground shadow-inset-hi transition-[filter] hover:brightness-[0.97]"
        >
          Open Tasks
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      {isLoading || !data ? (
        <Card className="p-5 text-sm text-muted-foreground" data-qc="my-tasks">
          Loading…
        </Card>
      ) : (
        <Body summary={data} />
      )}
    </section>
  );
}

function Body({ summary }: { summary: TasksSummary }) {
  const mineWord =
    summary.role === "owner" || summary.role === "manager"
      ? "open across the team"
      : "open for you";
  const open =
    summary.role === "owner" || summary.role === "manager" ? summary.open : summary.openForMe;
  return (
    <Card
      className="flex flex-col gap-4 p-5"
      data-qc="my-tasks"
      data-open={open}
      data-overdue={summary.overdue}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="flex items-center gap-2 text-[26px] font-semibold leading-none tracking-[-0.01em] text-foreground">
          <ListChecks className="h-5 w-5 text-ink-3" aria-hidden />
          {open}
        </span>
        <span className="text-[13px] text-ink-2">{mineWord}</span>
        {summary.overdue ? (
          <span
            className="text-[13px] font-semibold text-destructive-ink"
            data-qc="tasks-summary-overdue"
          >
            {summary.overdue} overdue
          </span>
        ) : null}
        {summary.dueToday ? (
          <span className="text-[13px] text-ink-2">{summary.dueToday} due today</span>
        ) : null}
      </div>

      {summary.byType.length ? (
        <div className="flex flex-wrap gap-1.5" data-qc="tasks-summary-types">
          {summary.byType.map((t) => (
            <Link
              key={t.type}
              to="/tasks"
              search={{ types: t.type } as never}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold shadow-inset-hi transition-[filter] hover:brightness-[0.97]",
                TASK_TYPE_META[t.type].chip,
              )}
            >
              {t.label}
              <span className="tabular-nums opacity-80">{t.open}</span>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">All clear. Nothing waiting for anyone.</p>
      )}

      {summary.role === "owner" || summary.role === "manager" ? (
        <TeamLoad summary={summary} />
      ) : null}
      {summary.role === "practitioner" ? (
        <Stats
          items={[
            {
              n: summary.questions,
              label: "Clinical questions",
              tone: summary.questions ? "pink" : "plain",
              view: "questions",
            },
            { n: summary.openForMe, label: "Assigned to you", tone: "plain", view: "assigned" },
            {
              n: summary.patientsWithOthers,
              label: "Your patients, with others",
              tone: "plain",
              view: "patients_with_others",
            },
          ]}
        />
      ) : null}
      {summary.role === "front_desk" ? (
        <Stats
          items={[
            { n: summary.openForMe, label: "In your queue", tone: "plain", view: "queue" },
            { n: summary.pool, label: "Waiting in pool", tone: "plain", view: "pool" },
            { n: summary.bookedToday, label: "Booked today", tone: "green", view: "done" },
            {
              n: summary.retriesScheduled,
              label: "Retries scheduled",
              tone: "violet",
              view: "retries",
            },
          ]}
        />
      ) : null}

      <p className="text-[12px] text-ink-3" data-qc="tasks-summary-auto">
        {summary.autoClosedThisWeek ? (
          <>
            <span className="font-semibold text-success-ink">
              {summary.autoClosedThisWeek} closed automatically
            </span>{" "}
            this week when patients booked or replied.
          </>
        ) : (
          "Tasks close themselves when the patient books or replies."
        )}
      </p>
    </Card>
  );
}

function TeamLoad({ summary }: { summary: TasksSummary }) {
  const max = Math.max(1, ...summary.team.map((m) => m.open));
  return (
    <div className="flex flex-col gap-1.5" data-qc="tasks-summary-team">
      {summary.team.map((m) => {
        const lane = staffLane(m.id, m.name);
        return (
          <Link
            key={m.id}
            to="/tasks"
            search={{ person: m.id } as never}
            className="flex items-center gap-2.5 rounded-lg px-1 py-1 transition-colors hover:bg-[rgba(47,63,102,0.05)]"
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9.5px] font-semibold text-accent-foreground",
                lane.tone.edge,
              )}
              aria-hidden
            >
              {lane.initials}
            </span>
            <span className="w-24 shrink-0 truncate text-[12.5px] text-foreground">
              {lane.short}
            </span>
            <span
              className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[rgba(47,63,102,0.08)]"
              aria-hidden
            >
              <span
                className="h-full bg-accent-deep"
                style={{ width: `${((m.open - m.overdue) / max) * 100}%` }}
              />
              <span
                className="h-full bg-destructive"
                style={{ width: `${(m.overdue / max) * 100}%` }}
              />
            </span>
            <span className="w-14 shrink-0 text-right text-[12px] tabular-nums text-ink-2">
              {m.open}
              {m.overdue ? <span className="text-destructive-ink"> · {m.overdue}</span> : null}
            </span>
          </Link>
        );
      })}
      <div className="mt-1 flex gap-4 text-[12px] text-ink-2">
        <span>
          <span className="font-semibold text-foreground">{summary.pool}</span> in the front desk
          pool
        </span>
        <span>
          <span
            className={cn(
              "font-semibold",
              summary.unassigned ? "text-destructive-ink" : "text-foreground",
            )}
          >
            {summary.unassigned}
          </span>{" "}
          unassigned
        </span>
      </div>
    </div>
  );
}

function Stats({
  items,
}: {
  items: Array<{
    n: number;
    label: string;
    tone: "pink" | "plain" | "green" | "violet";
    view: string;
  }>;
}) {
  const tone: Record<string, string> = {
    pink: "bg-destructive-bg text-destructive-ink",
    plain: "bg-[rgba(47,63,102,0.04)] text-foreground",
    green: "bg-success-bg text-success-ink",
    violet: "bg-warning-bg text-warning-ink",
  };
  return (
    <div className="grid grid-cols-2 gap-2" data-qc="tasks-summary-stats">
      {items.map((s) => (
        <Link
          key={s.label}
          to="/tasks"
          search={{ view: s.view } as never}
          className={cn("rounded-xl p-3 transition-[filter] hover:brightness-[0.98]", tone[s.tone])}
        >
          <p className="text-[20px] font-semibold leading-none tabular-nums">{s.n}</p>
          <p className="mt-1 text-[11.5px] opacity-80">{s.label}</p>
        </Link>
      ))}
    </div>
  );
}
