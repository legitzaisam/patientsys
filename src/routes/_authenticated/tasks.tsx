import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useFloatingDock } from "@/components/floating-dock/dock-context";
import { PaginationBar } from "@/components/pagination-bar";
import { RouteErrorBoundary } from "@/components/route-error-boundary";
import { AssignTaskDialog } from "@/components/tasks/assign-task-dialog";
import { TaskRow, type RowAction } from "@/components/tasks/task-row";
import { DelegatePanel, OutcomePanel } from "@/components/tasks/task-panels";
import { FRONT_DESK_OUTCOMES, PRACTITIONER_OUTCOMES, type Outcome } from "@/lib/tasks/outcomes";
import {
  BulkBar,
  TasksNav,
  TeamPanel,
  TodaysCallsPanel,
  YourDayPanel,
} from "@/components/tasks/tasks-side-panels";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import { getTasksSummary, listPatients, listTasks } from "@/lib/clinic.functions";
import { canSee } from "@/lib/access-catalogue";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { switchDemoRole } from "@/lib/demo/switch-role";
import type { PatientType } from "@/lib/patients/records-summary";
import { can } from "@/lib/permissions";
import { staffLane } from "@/lib/staff-lane";
import { taskRole, type TaskView_ } from "@/lib/tasks/service";
import {
  DEFAULT_VIEW,
  isTaskType,
  isTaskView,
  ROLE_VIEWS,
  TASK_TYPE_META,
  type TaskType,
  type TaskView,
} from "@/lib/tasks/types";
import { useIdentity } from "@/lib/use-identity";
import { useTasksLiveSync } from "@/lib/use-tasks-sync";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tasks")({
  validateSearch: (search: Record<string, unknown>): TasksSearch => {
    const parsed: TasksSearch = {};
    if (isTaskView(search?.["view"])) parsed.view = search["view"];
    if (typeof search?.["types"] === "string" && search["types"]) parsed.types = search["types"];
    if (typeof search?.["person"] === "string" && search["person"])
      parsed.person = search["person"];
    if (typeof search?.["task"] === "string" && search["task"]) parsed.task = search["task"];
    const page = Number(search?.["page"]);
    if (Number.isInteger(page) && page > 1) parsed.page = page;
    return parsed;
  },
  head: () => ({
    meta: [
      { title: "Tasks — Aetheria" },
      {
        name: "description",
        content:
          "One list of what needs doing for patients: chases, recalls, clinical questions, offers and plan support, by role.",
      },
      { property: "og:title", content: "Tasks — Aetheria" },
      { property: "og:description", content: "What needs doing for patients, by role." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TasksPage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary error={error} reset={reset} area="tasks" />
  ),
});

type TasksSearch = {
  view?: TaskView;
  types?: string;
  person?: string;
  task?: string;
  page?: number;
};

const TYPE_CHIPS: TaskType[] = [
  "chase_booking",
  "rebook_no_show",
  "question",
  "recall",
  "send_offer",
  "plan_support",
];

/** Rows a page: long enough to work through, short enough that the rail stays in view. */
const PAGE_SIZE = 10;

/** Demo only: the mock's "Viewing as" pill. In the app the role comes from who is signed in. */
const DEMO_PERSONAS = [
  { label: "Owner / manager", role: "owner", matches: ["owner", "manager"] },
  { label: "Practitioner", role: "practitioner", matches: ["practitioner"] },
  { label: "Front desk", role: "front_desk", matches: ["front_desk"] },
] as const;

function TasksPage() {
  const { data: identity } = useIdentity();
  const search = Route.useSearch();
  const navigate = useNavigate();
  useTasksLiveSync();

  const role = identity
    ? taskRole({
        userId: identity.userId,
        roles: identity.roles,
        isManager: identity.isManager,
        isOwner: identity.isOwner,
        isAdmin: identity.isAdmin,
      })
    : "front_desk";
  const views = ROLE_VIEWS[role];
  const personId = identity?.isManager ? (search.person ?? null) : null;
  const view: TaskView = personId
    ? "person"
    : search.view && views.some((v) => v.view === search.view)
      ? search.view
      : DEFAULT_VIEW[role];
  const types = useMemo(() => (search.types ?? "").split(",").filter(isTaskType), [search.types]);

  const go = (
    patch: {
      view?: TaskView | undefined;
      types?: TaskType[] | undefined;
      person?: string | null | undefined;
      task?: string | null | undefined;
      page?: number | undefined;
    },
    opts: { resetScroll?: boolean } = {},
  ) => {
    const next: Record<string, string | number> = {};
    const v = patch.view === undefined ? (personId ? undefined : search.view) : patch.view;
    if (v && v !== DEFAULT_VIEW[role]) next["view"] = v;
    const t = patch.types ?? types;
    if (t.length) next["types"] = t.join(",");
    const person = patch.person === undefined ? personId : patch.person;
    if (person) next["person"] = person;
    const task = patch.task === undefined ? search.task : patch.task;
    if (task) next["task"] = task;
    // A different list starts on page 1; only an explicit page (or the same list) keeps one.
    const listChanged =
      patch.view !== undefined || patch.types !== undefined || patch.person !== undefined;
    const page = patch.page ?? (listChanged ? 1 : search.page);
    if (page && page > 1) next["page"] = page;
    void navigate({
      to: "/tasks",
      search: next as never,
      replace: true,
      resetScroll: opts.resetScroll ?? true,
    });
  };

  const fetchTasks = useServerFn(listTasks);
  const { data: list, isLoading } = useQuery({
    queryKey: ["tasks", view, personId ?? "", types.join(",")],
    queryFn: () =>
      fetchTasks({
        data: {
          view,
          ...(personId ? { assigneeId: personId } : {}),
          ...(types.length ? { types } : {}),
        },
      }),
    enabled: !!identity?.isStaff,
  });
  const fetchSummary = useServerFn(getTasksSummary);
  const { data: summary } = useQuery({
    queryKey: ["tasks-summary"],
    queryFn: () => fetchSummary(),
    enabled: !!identity?.isStaff,
  });
  const fetchPatients = useServerFn(listPatients);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const { data: patients } = useQuery({
    queryKey: ["patients"],
    queryFn: () => fetchPatients(),
    enabled: newTaskOpen,
  });

  const actions = useTaskActions();
  // Reply opens the patient's thread in the chat bubble; the question counts as
  // answered once a message actually goes out to that patient.
  const { requestChat, patientMessageSent } = useFloatingDock();
  const replying = useRef<TaskView_ | null>(null);
  const reply = (t: TaskView_) => {
    replying.current = t;
    requestChat({ patientId: t.patient.id, patientName: t.patient.name });
  };
  useEffect(() => {
    const t = replying.current;
    if (!t || !patientMessageSent || patientMessageSent.patientId !== t.patient.id) return;
    replying.current = null;
    void actions.complete(t, "replied", "Replied");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientMessageSent?.seq]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openPanel, setOpenPanel] = useState<{ id: string; mode: "delegate" | "outcome" } | null>(
    null,
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<TaskView_ | null>(null);
  useEffect(() => {
    setSelected(new Set());
    setOpenPanel(null);
  }, [view, personId]);

  // ---------------------------------------------------------------- paging
  // Rows keep the server's grouping and order but read each task from the
  // (optimistically patched) flat list, so a handled row leaves at once.
  const groups = list?.groups;
  const rows = useMemo(() => {
    const byId = new Map((list?.tasks ?? []).map((t) => [t.id, t]));
    return (groups ?? []).flatMap((g) =>
      g.tasks.flatMap((t) => {
        const live = byId.get(t.id);
        return live
          ? [{ bucket: g.bucket, label: g.label, total: g.tasks.length, task: live }]
          : [];
      }),
    );
  }, [groups, list?.tasks]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, search.page ?? 1), pageCount);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  // The page's rows, regrouped; a group that started on an earlier page says so.
  const pageGroups = pageRows.reduce<
    Array<{ bucket: string; label: string; total: number; continued: boolean; tasks: TaskView_[] }>
  >((acc, r) => {
    const last = acc[acc.length - 1];
    if (last && last.bucket === r.bucket) last.tasks.push(r.task);
    else {
      const first = rows.findIndex((x) => x.bucket === r.bucket);
      acc.push({
        bucket: r.bucket,
        label: r.label,
        total: r.total,
        continued: rows[first]?.task.id !== r.task.id,
        tasks: [r.task],
      });
    }
    return acc;
  }, []);

  // A deep link to one task lands on its page, scrolls it into view and highlights it once.
  useEffect(() => {
    if (!search.task || !list?.tasks.length) return;
    const idx = rows.findIndex((r) => r.task.id === search.task);
    const target = idx >= 0 ? Math.floor(idx / PAGE_SIZE) + 1 : page;
    if (target !== page) {
      go({ page: target });
      return;
    }
    const el = document.querySelector(`[data-task-id="${search.task}"]`);
    if (el) {
      // After the router's own scroll-to-top for the page change.
      window.requestAnimationFrame(() => el.scrollIntoView({ block: "center" }));
      el.classList.add("ring-2", "ring-accent-deep");
      window.setTimeout(() => el.classList.remove("ring-2", "ring-accent-deep"), 1600);
    }
    // Clearing `task` from the URL must not scroll the list back to the top.
    go({ task: null }, { resetScroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.task, list?.tasks.length, page]);

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!identity.isStaff || !canSee(identity, "tasks"))
    return <div className="p-12 text-sm text-muted-foreground">Staff access only.</div>;

  const manager = role === "owner" || role === "manager";
  const viewerName = identity.profile?.full_name ?? "You";
  const team = summary?.team ?? [];
  const ownerId = team.find((m) => m.role === "owner")?.id ?? null;
  const nameOf = (id: string | null) => team.find((m) => m.id === id)?.name ?? null;
  const counts = new Map<TaskView, number>((summary?.views ?? []).map((v) => [v.view, v.count]));
  const tasks = list?.tasks ?? [];
  const title = personId
    ? (nameOf(personId) ?? "Team member")
    : (views.find((v) => v.view === view)?.label ?? "Tasks");
  const openCount = tasks.filter((t) => t.status === "open" || t.status === "snoozed").length;
  const roleLabel =
    role === "owner"
      ? "Clinic owner"
      : role === "manager"
        ? "Manager"
        : role === "practitioner"
          ? "Practitioner"
          : "Front desk";

  const pick = (task: TaskView_, o: Outcome) => {
    setOpenPanel(null);
    if (o.kind === "complete" && o.resolution) void actions.complete(task, o.resolution, o.label);
    else if (o.kind === "handoff") void actions.handOff(task);
    else if (o.kind === "attempt" && o.outcome) void actions.attempt(task, o.outcome);
    else if (o.kind === "escalate") void actions.escalate(task);
  };

  const rowActions = (t: TaskView_): RowAction[] => {
    const meta = TASK_TYPE_META[t.type];
    const primaryLabel = t.type === "question" ? "Reply" : meta.actionLabel;
    if (manager) {
      return [
        {
          label: primaryLabel,
          kind: "primary",
          onClick: () =>
            t.type === "question"
              ? reply(t)
              : void actions.complete(
                  t,
                  t.type === "send_offer" ? "approved" : "handled",
                  t.type === "send_offer" ? "Approved" : "Handled",
                ),
        },
        {
          label: t.assigneeId ? "Reassign" : "Delegate",
          onClick: () =>
            setOpenPanel((p) =>
              p?.id === t.id && p.mode === "delegate" ? null : { id: t.id, mode: "delegate" },
            ),
        },
        {
          label: "Handled",
          kind: "done",
          onClick: () => void actions.complete(t, "handled", "Handled"),
        },
      ];
    }
    if (role === "practitioner") {
      if (t.assigneeId === identity.userId) {
        if (t.type === "question") {
          return [
            { label: "Reply", kind: "primary", onClick: () => reply(t) },
            { label: "Snooze 2h", onClick: () => void actions.snooze(t, 2) },
          ];
        }
        return [
          {
            label: primaryLabel,
            kind: "primary",
            onClick: () => void actions.complete(t, "handled", "Handled"),
          },
          {
            label: "Done…",
            onClick: () =>
              setOpenPanel((p) =>
                p?.id === t.id && p.mode === "outcome" ? null : { id: t.id, mode: "outcome" },
              ),
          },
          ...(t.can.handoff
            ? [{ label: "Hand to front desk", onClick: () => void actions.handOff(t) }]
            : []),
        ];
      }
      return t.can.takeOver || (!t.assigneeId && t.assigneeRole === "practitioner")
        ? [
            {
              label: t.assigneeId ? "Take over" : "Take it",
              kind: "primary" as const,
              onClick: () => void actions.claim(t, { userId: identity.userId, name: viewerName }),
            },
          ]
        : [];
    }
    // Front desk
    if (t.assigneeId === identity.userId) {
      return [
        {
          label: "Call",
          kind: "primary",
          onClick: () =>
            setOpenPanel((p) =>
              p?.id === t.id && p.mode === "outcome" ? null : { id: t.id, mode: "outcome" },
            ),
        },
        { label: "Send booking link", onClick: () => void actions.attempt(t, "link_sent") },
        {
          label: "Log outcome…",
          onClick: () =>
            setOpenPanel((p) =>
              p?.id === t.id && p.mode === "outcome" ? null : { id: t.id, mode: "outcome" },
            ),
        },
      ];
    }
    if (t.can.claim) {
      return [
        {
          label: "Claim",
          kind: "primary",
          onClick: () => void actions.claim(t, { userId: identity.userId, name: viewerName }),
        },
        {
          label: "Send booking link",
          onClick: async () => {
            const r = await actions.claim(t, { userId: identity.userId, name: viewerName });
            if (r) void actions.attempt(t, "link_sent");
          },
        },
      ];
    }
    return [];
  };

  const ownerLine = (t: TaskView_): string | null => {
    if (t.status !== "open" && t.status !== "snoozed") return null;
    if (role === "practitioner" && t.assigneeId !== identity.userId) {
      if (!t.assigneeId)
        return t.assigneeRole === "front_desk"
          ? "In the front desk pool, not claimed yet"
          : "Unassigned";
      return `With ${t.assigneeName ? staffLane(t.assigneeId, t.assigneeName).short : "a colleague"}${t.attempts ? ` · attempt ${Math.min(t.attempts + 1, 3)} of 3` : ""}`;
    }
    if (role === "front_desk" && !t.assigneeId)
      return t.source === "rule"
        ? `Added by rule “${t.sourceLabel ?? "automation"}”`
        : "In the front desk pool";
    return null;
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const assignTo = (memberId: string, ids: string[]) => {
    const name = nameOf(memberId) ?? "teammate";
    const patients =
      ids.length === 1 ? tasks.find((t) => t.id === ids[0])?.patient.firstName : undefined;
    void actions.assign(ids, memberId, staffLane(memberId, name).short, {
      ...(patients ? { patients } : {}),
    });
    setSelected(new Set());
    setDragId(null);
    setHoverId(null);
    setOpenPanel(null);
  };

  return (
    <AppShell identity={identity}>
      <div className="page-header !mb-4">
        <div>
          <h1 className="page-title">Tasks</h1>
          <p className="page-subtitle">
            {viewerName} · {roleLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {DEMO_MODE ? (
            <div className="flex items-center gap-2" data-qc="tasks-viewing-as">
              <span className="text-[12.5px] text-ink-3 max-sm:hidden">Viewing as</span>
              <div
                className="flex h-[34px] items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi"
                role="group"
                aria-label="Viewing as"
              >
                {DEMO_PERSONAS.map((p) => {
                  const on = (p.matches as readonly string[]).includes(role);
                  return (
                    <button
                      key={p.role}
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        if (!on) switchDemoRole(p.role);
                      }}
                      data-qc={`tasks-viewing-as-${p.role}`}
                      className={cn(
                        "h-7 cursor-pointer whitespace-nowrap rounded-full px-3.5 text-xs tracking-[0.02em] transition-colors",
                        on
                          ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                          : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]",
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <Button
            type="button"
            onClick={() => setNewTaskOpen(true)}
            data-qc="tasks-new"
            className="h-[34px]"
          >
            New task
          </Button>
        </div>
      </div>

      <div
        className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[190px_minmax(0,1fr)] xl:grid-cols-[190px_minmax(0,1fr)_270px]"
        data-qc="tasks-layout"
      >
        <TasksNav
          role={role}
          view={view}
          personId={personId}
          counts={counts}
          autoClosed={summary?.autoClosedThisWeek ?? 0}
          onPick={(v) => go({ view: v, person: null })}
        />

        <Card
          className="min-h-[640px] min-w-0 rounded-[18px] p-4 sm:p-5"
          data-qc="tasks-main"
          data-view={view}
        >
          {/* The title never shrinks; on a narrow card the type chips wrap under it as a row. */}
          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
            <div className="shrink-0">
              <h2 className="flex items-baseline gap-2 whitespace-nowrap text-[17px] font-semibold text-foreground">
                {title}
                <span className="text-[13px] font-normal text-ink-3" data-qc="tasks-open-count">
                  {isLoading ? "…" : `${openCount} ${view === "done" ? "done" : "open"}`}
                </span>
              </h2>
            </div>
            <div
              className="flex max-w-full flex-wrap gap-1.5"
              role="group"
              aria-label="Filter by type"
              data-qc="tasks-type-filter"
            >
              {TYPE_CHIPS.filter((t) => role !== "front_desk" || t !== "question").map((t) => {
                const m = TASK_TYPE_META[t];
                const on = types.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => go({ types: on ? types.filter((x) => x !== t) : [...types, t] })}
                    data-qc={`tasks-type-${t}`}
                    className={cn(
                      "h-7 shrink-0 cursor-pointer whitespace-nowrap rounded-full border px-3 text-[12px] font-medium transition-colors",
                      on
                        ? cn("border-transparent font-semibold shadow-inset-hi", m.chip)
                        : "border-edge bg-glass-2 text-ink-2 shadow-inset-hi hover:bg-accent-wash hover:text-foreground",
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {manager && selected.size > 0 ? (
            <BulkBar
              count={selected.size}
              onHandled={() => {
                void actions.completeMany([...selected]);
                setSelected(new Set());
              }}
              onClear={() => setSelected(new Set())}
            />
          ) : null}

          {rows.length === 0 && !isLoading ? (
            <p className="py-16 text-center text-sm text-muted-foreground" data-qc="tasks-empty">
              All clear. Nothing waiting here.
            </p>
          ) : null}

          {pageGroups.map((g) => (
            <section key={g.bucket} className="mb-4" data-qc={`tasks-group-${g.bucket}`}>
              <h3
                className={cn(
                  "mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
                  g.bucket === "overdue" ? "text-destructive-ink" : "text-ink-3",
                )}
              >
                {g.label} · {g.total}
                {g.continued ? <span className="font-normal text-ink-3"> · continued</span> : null}
              </h3>
              <ul className="flex flex-col divide-y divide-edge-2">
                {g.tasks.map((t) => {
                  const open = openPanel?.id === t.id;
                  const panel =
                    open && openPanel?.mode === "delegate" ? (
                      <DelegatePanel
                        task={t}
                        team={team}
                        ownerId={ownerId}
                        onAssign={(id, _name, dueAt, note) => {
                          void actions.assign([t.id], id, staffLane(id, nameOf(id)).short, {
                            dueAt,
                            ...(note ? { note } : {}),
                            patients: t.patient.firstName,
                          });
                          setOpenPanel(null);
                        }}
                        onClose={() => setOpenPanel(null)}
                      />
                    ) : open && openPanel?.mode === "outcome" ? (
                      <OutcomePanel
                        title={role === "front_desk" ? "Log the call" : "How did it go?"}
                        outcomes={
                          role === "front_desk" ? FRONT_DESK_OUTCOMES : PRACTITIONER_OUTCOMES
                        }
                        onPick={(o) => pick(t, o)}
                        onClose={() => setOpenPanel(null)}
                      />
                    ) : null;
                  return (
                    <TaskRow
                      key={t.id}
                      task={t}
                      role={role}
                      actions={rowActions(t)}
                      selectable={manager && (t.status === "open" || t.status === "snoozed")}
                      selected={selected.has(t.id)}
                      onToggleSelect={() => toggleSelect(t.id)}
                      draggable={manager && (t.status === "open" || t.status === "snoozed")}
                      onDragStart={(e) => {
                        try {
                          e.dataTransfer.setData("text/plain", t.id);
                          e.dataTransfer.effectAllowed = "move";
                        } catch {
                          /* jsdom */
                        }
                        setDragId(t.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setHoverId(null);
                      }}
                      dragging={dragId === t.id}
                      open={open}
                      panel={panel}
                      ownerLine={ownerLine(t)}
                    />
                  );
                })}
              </ul>
            </section>
          ))}

          <PaginationBar
            page={page}
            pageCount={pageCount}
            total={rows.length}
            from={rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
            to={Math.min(rows.length, page * PAGE_SIZE)}
            onPage={(next) => {
              go({ page: next });
              setOpenPanel(null);
            }}
            noun="tasks"
            qc="tasks-pagination"
            className="mt-1 border-t border-edge-2 px-2.5 pt-3"
          />
        </Card>

        <div className="min-w-0 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-4">
          {summary ? (
            manager ? (
              <TeamPanel
                summary={summary}
                personId={personId}
                selectedCount={selected.size}
                dragging={dragId !== null}
                hoverId={hoverId}
                onHover={setHoverId}
                onDrop={(id, carried) => {
                  const taskId = dragId ?? carried;
                  if (taskId) assignTo(id, [taskId]);
                }}
                onClick={(id) => {
                  if (selected.size) assignTo(id, [...selected]);
                  else go({ person: personId === id ? null : id, view: undefined });
                }}
              />
            ) : role === "practitioner" ? (
              <YourDayPanel summary={summary} onPick={(v) => go({ view: v })} />
            ) : (
              <TodaysCallsPanel summary={summary} />
            )
          ) : null}
        </div>
      </div>

      <AssignTaskDialog
        open={!!assignFor}
        onOpenChange={(v) => {
          if (!v) setAssignFor(null);
        }}
        patient={
          assignFor
            ? {
                id: assignFor.patient.id,
                firstName: assignFor.patient.firstName,
                name: assignFor.patient.name,
                avatarUrl: assignFor.patient.avatarUrl,
                context: assignFor.context,
                practitionerId: assignFor.patient.practitionerId,
              }
            : null
        }
        defaultType={assignFor?.type ?? "chase_booking"}
        viewerId={identity.userId}
        canAssignOthers={can(identity, "tasks.assign_any")}
      />
      <NewTaskPicker
        open={newTaskOpen}
        onClose={() => setNewTaskOpen(false)}
        patients={
          (patients ?? []) as Array<{
            id: string;
            first_name: string;
            last_name: string;
            avatar_url?: string | null;
            summary?: { primaryPractitionerId: string | null; type?: PatientType } | null;
          }>
        }
        onPick={(p) => {
          setNewTaskOpen(false);
          setAssignFor({
            id: "",
            patient: {
              id: p.id,
              name: `${p.first_name} ${p.last_name}`,
              firstName: p.first_name,
              avatarUrl: p.avatar_url ?? null,
              phone: null,
              practitionerId: p.summary?.primaryPractitionerId ?? null,
              patientType: p.summary?.type ?? null,
            },
            type: "chase_booking",
            typeLabel: "",
            title: "",
            context: null,
            source: "manual",
            sourceLabel: null,
            assigneeId: null,
            assigneeName: null,
            assigneeRole: null,
            createdBy: null,
            note: null,
            dueAt: null,
            dueLabel: "",
            bucket: "today",
            attempts: 0,
            nextRetryAt: null,
            escalated: false,
            status: "open",
            resolution: null,
            resolvedAt: null,
            priority: 2,
            links: {},
            createdAt: "",
            can: {
              select: false,
              delegate: false,
              handoff: false,
              claim: false,
              takeOver: false,
              complete: false,
              attempt: false,
              escalateToClinician: false,
              snooze: false,
            },
          });
        }}
      />
    </AppShell>
  );
}

/** "New task" first asks which patient, then opens the Assign dialog for them. */
function NewTaskPicker({
  open,
  onClose,
  patients,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  patients: Array<{
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string | null;
    summary?: { primaryPractitionerId: string | null; type?: PatientType } | null;
  }>;
  onPick: (p: {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url?: string | null;
    summary?: { primaryPractitionerId: string | null; type?: PatientType } | null;
  }) => void;
}) {
  const [q, setQ] = useState("");
  useEffect(() => {
    if (open) setQ("");
  }, [open]);
  if (!open) return null;
  const term = q.trim().toLowerCase();
  const matches = term
    ? patients
        .filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(term))
        .slice(0, 8)
    : [];
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[rgba(47,63,102,0.28)] p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="New task"
      data-qc="new-task-picker"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[460px] rounded-[22px] bg-popover p-4 shadow-popover backdrop-blur-glass"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-[15px] font-semibold text-foreground">New task</p>
        <p className="mt-0.5 text-[12.5px] text-ink-3">Who is it for?</p>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search patient…"
          aria-label="Search patient"
          data-qc="new-task-search"
          className="mt-3 h-10 w-full rounded-xl border border-edge-2 bg-glass-2 px-3 text-sm shadow-inset-hi placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <ul className="mt-2 flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p)}
                data-qc="new-task-patient"
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 text-left text-[13.5px] text-foreground hover:bg-[rgba(47,63,102,0.06)]"
              >
                {p.first_name} {p.last_name}
              </button>
            </li>
          ))}
          {term && matches.length === 0 ? (
            <li className="px-2 py-3 text-[12.5px] text-ink-3">No patient matches that.</li>
          ) : null}
        </ul>
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
