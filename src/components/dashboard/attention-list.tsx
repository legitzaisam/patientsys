import { Link } from "@tanstack/react-router";
import { LoadError, LoadingCard, type LoadStatus } from "@/components/dashboard/load-state";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Bell, Check, ChevronDown } from "lucide-react";
import { useTaskActions } from "@/components/tasks/use-task-actions";
import { dropThisWeekDepositsIfUrgent } from "@/lib/metrics/appointment-flags";
import { cn } from "@/lib/utils";

type AttentionRaw = {
  id: string;
  kind: string;
  urgency: string;
  title: string;
  subtitle?: string;
  patientId?: string;
  appointmentId?: string;
  href?: string;
  /** Set on rows that mirror a task, so Done here completes it on the Tasks page too. */
  taskId?: string;
  /** False when the viewer must claim the task first (an unclaimed pool task); no Done button then. */
  completable?: boolean;
};

type TaskPerson = {
  key: string;
  name: string;
  href: string;
  patientId?: string;
  subtitleParts: { treatment: string; suffix?: string }[];
  taskIds: string[];
};

/** Mark this person's tasks under one accordion as handled. */
type CompleteTasks = (ids: string[], who: string) => void;

const APPOINTMENT_ATTENTION_KINDS = new Set([
  "deposit_due",
  "balance_due",
  "consent_due",
  "no_show",
  "payment_due",
]);

const APPOINTMENT_SUMMARY_LIMIT = 2;

type TaskGroup = {
  kind: string;
  label: string;
  chipClass: string;
  people: TaskPerson[];
};

const KIND_ORDER = [
  "no_show",
  "deposit_due",
  "consent_due",
  "payment_due",
  "balance_due",
  "question",
  "chase_booking",
  "recall",
  "send_offer",
  "plan_support",
  "tasks",
  "treatment_due",
  "incomplete_profile",
  "staff_request",
  "compliance_due",
] as const;

const PREVIEW_LIMIT = 4;

/** Task kinds reuse the chip colours of their type on the Tasks page. */
const CHIP_META: Record<string, { label: string; className: string }> = {
  no_show: { label: "No show", className: "bg-destructive-bg text-destructive-ink" },
  deposit_due: { label: "Deposit due", className: "bg-destructive-bg text-destructive-ink" },
  consent_due: { label: "Consent due", className: "bg-warning-bg text-consent-ink" },
  payment_due: { label: "Unpaid", className: "bg-destructive-bg text-destructive-ink" },
  balance_due: { label: "Balance due", className: "bg-warning-bg text-warning-ink" },
  question: { label: "Patient questions", className: "bg-destructive-bg text-destructive-ink" },
  chase_booking: { label: "Chase booking", className: "bg-warning-bg text-warning-ink" },
  recall: { label: "Recall", className: "bg-sky-bg text-sky-ink" },
  send_offer: { label: "Send offer", className: "bg-accent-soft text-accent-ink" },
  plan_support: { label: "Plan support", className: "bg-success-bg text-success-ink" },
  tasks: { label: "Tasks", className: "bg-accent-soft text-accent-ink" },
  treatment_due: { label: "Skin-plan treatment due", className: "bg-accent-soft text-accent-ink" },
  incomplete_profile: { label: "Incomplete profile", className: "bg-warning-bg text-warning-ink" },
  staff_request: { label: "Requests to approve", className: "bg-accent-soft text-accent-ink" },
  compliance_due: {
    label: "Registration or insurance",
    className: "bg-warning-bg text-warning-ink",
  },
};

function nameFromTitle(title: string) {
  const idx = title.indexOf(" — ");
  return (idx >= 0 ? title.slice(0, idx) : title).trim() || "Unknown";
}

function parseAttentionSubtitle(subtitle?: string): { treatment: string; suffix?: string } | null {
  if (!subtitle?.trim()) return null;
  const s = subtitle.trim();
  if (s.startsWith("Due ")) return { treatment: s };

  const noClock = s.replace(/\s·\s\d{1,2}:\d{2}$/, "").trim();
  const splitAt = noClock.lastIndexOf(" · ");
  if (splitAt === -1) return { treatment: noClock };

  const treatment = noClock.slice(0, splitAt).trim();
  const suffix = noClock.slice(splitAt + 3).trim();
  return treatment ? { treatment, suffix: suffix || undefined } : null;
}

function isClockTime(suffix: string) {
  return /^\d{1,2}:\d{2}$/.test(suffix);
}

function formatSubtitlePart(part: { treatment: string; suffix?: string }) {
  if (!part.suffix) return part.treatment;
  if (isClockTime(part.suffix)) return `${part.treatment} · ${part.suffix}`;
  return `${part.suffix} · ${part.treatment}`;
}

function formatMergedSubtitle(parts: { treatment: string; suffix?: string }[]): string | null {
  if (parts.length === 0) return null;
  if (parts.length === 1) return formatSubtitlePart(parts[0]!);

  const bySuffix = new Map<string, string[]>();
  const bare: string[] = [];

  for (const part of parts) {
    if (!part.suffix) {
      if (!bare.includes(part.treatment)) bare.push(part.treatment);
      continue;
    }
    const list = bySuffix.get(part.suffix) ?? [];
    if (!list.includes(part.treatment)) list.push(part.treatment);
    bySuffix.set(part.suffix, list);
  }

  const segments = [
    ...bare,
    ...[...bySuffix.entries()].map(([suffix, treatments]) =>
      isClockTime(suffix)
        ? treatments.map((treatment) => `${treatment} · ${suffix}`).join(" · ")
        : `${suffix} · ${treatments.join(", ")}`,
    ),
  ];
  return segments.join(" · ") || null;
}

function subtitleKey(part: { treatment: string; suffix?: string }) {
  return `${part.treatment}|${part.suffix ?? ""}`;
}

function treatmentFromSubtitle(subtitle?: string) {
  return parseAttentionSubtitle(subtitle);
}

function hrefFor(item: AttentionRaw) {
  if (item.href) return item.href;
  if (item.patientId) return `/patients/${item.patientId}`;
  if (item.appointmentId) return `/schedule?day=${new Date().toISOString().slice(0, 10)}`;
  return "/patients";
}

function patientBookingsChaseHref(patientId: string) {
  return `/patients/${patientId}?tab=treatments&chase=1`;
}

function displaySubtitle(person: TaskPerson, kind: string) {
  if (
    APPOINTMENT_ATTENTION_KINDS.has(kind) &&
    person.subtitleParts.length > APPOINTMENT_SUMMARY_LIMIT
  ) {
    return "Several appointments";
  }
  return formatMergedSubtitle(person.subtitleParts);
}

function displayHref(person: TaskPerson, kind: string) {
  if (
    APPOINTMENT_ATTENTION_KINDS.has(kind) &&
    person.subtitleParts.length > APPOINTMENT_SUMMARY_LIMIT &&
    person.patientId
  ) {
    return patientBookingsChaseHref(person.patientId);
  }
  return person.href;
}

function personKey(item: AttentionRaw) {
  if (item.patientId) return `patient:${item.patientId}`;
  if (item.kind === "staff_request") return `id:${item.id}`;
  if (item.href) return `href:${item.href}`;
  return `id:${item.id}`;
}

function groupByTask(items: AttentionRaw[]): TaskGroup[] {
  const byKind = new Map<string, Map<string, TaskPerson>>();

  for (const item of items) {
    let people = byKind.get(item.kind);
    if (!people) {
      people = new Map();
      byKind.set(item.kind, people);
    }
    const key = personKey(item);
    const existing = people.get(key);
    const parsed = treatmentFromSubtitle(item.subtitle);
    if (existing) {
      if (
        parsed &&
        !existing.subtitleParts.some((part) => subtitleKey(part) === subtitleKey(parsed))
      ) {
        existing.subtitleParts.push(parsed);
      }
      if (item.taskId && item.completable !== false) existing.taskIds.push(item.taskId);
      continue;
    }
    people.set(key, {
      key,
      name: nameFromTitle(item.title),
      href: hrefFor(item),
      ...(item.patientId ? { patientId: item.patientId } : {}),
      subtitleParts: parsed ? [parsed] : [],
      taskIds: item.taskId && item.completable !== false ? [item.taskId] : [],
    });
  }

  const kinds = [...byKind.keys()].sort((a, b) => {
    const ai = KIND_ORDER.indexOf(a as (typeof KIND_ORDER)[number]);
    const bi = KIND_ORDER.indexOf(b as (typeof KIND_ORDER)[number]);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return kinds.map((kind) => {
    const meta = CHIP_META[kind] ?? {
      label: kind.replace(/_/g, " "),
      className: "bg-glass-2 text-muted-foreground",
    };
    return {
      kind,
      label: meta.label,
      chipClass: meta.className,
      people: [...(byKind.get(kind)?.values() ?? [])],
    };
  });
}

export function AttentionList({
  items,
  status = "ready",
  onRetry,
}: {
  items: any[];
  status?: LoadStatus;
  onRetry?: () => void;
}) {
  items = dropThisWeekDepositsIfUrgent(items.filter((i) => i.kind !== "message"));
  const urgent = items.filter((i) => i.urgency === "urgent");
  const thisWeek = items.filter((i) => i.urgency === "this_week");
  // Done on a task row goes through the Tasks page's own action: optimistic,
  // with Undo in the toast, and it refreshes this list and the Tasks page.
  const actions = useTaskActions();
  const completeTasks: CompleteTasks = (ids, who) => void actions.completeFromDashboard(ids, who);

  if (status === "error") return <LoadError what="the attention list" onRetry={onRetry} />;
  if (status === "loading") {
    return (
      <div className="grid gap-4 lg:grid-cols-2" data-qc="attention-loading">
        <LoadingCard lines={3} />
        <LoadingCard lines={3} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-edge-2 bg-glass-2 p-8 text-center">
        <Bell className="mx-auto h-5 w-5 text-ink-3" />
        <p className="mt-2 text-sm text-muted-foreground">Nothing needs attention right now.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
      <AttentionSection title="Urgent" items={urgent} tone="urgent" completeTasks={completeTasks} />
      <AttentionSection
        title="This week"
        items={thisWeek}
        tone="muted"
        completeTasks={completeTasks}
      />
    </div>
  );
}

function AttentionSection({
  title,
  items,
  tone,
  completeTasks,
}: {
  title: string;
  items: AttentionRaw[];
  tone: "urgent" | "muted";
  completeTasks: CompleteTasks;
}) {
  const tasks = useMemo(() => groupByTask(items), [items]);
  const taskCount = tasks.reduce((sum, t) => sum + t.people.length, 0);
  const [openKinds, setOpenKinds] = useState<Set<string>>(() => new Set());

  const toggleKind = (kind: string) => {
    setOpenKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  return (
    <div
      className="glass-card flex max-h-[28rem] flex-col overflow-hidden p-0"
      data-qc={tone === "urgent" ? "attention-urgent" : "attention-this-week"}
    >
      <div className="sticky top-0 z-[1] flex shrink-0 items-center gap-2 border-b border-glass-line bg-card/95 px-4 py-3 backdrop-blur-sm">
        {tone === "urgent" ? (
          <AlertCircle className="h-4 w-4 text-destructive" />
        ) : (
          <Bell className="h-4 w-4 text-ink-3" />
        )}
        <h3
          className={`text-sm font-semibold ${tone === "urgent" ? "text-destructive" : "text-foreground"}`}
        >
          {title}
        </h3>
        <span className="ml-auto rounded-full border border-edge bg-glass-2 px-2 py-0.5 text-2xs font-semibold text-muted-foreground shadow-inset-hi">
          {taskCount}
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-3">
        {tasks.length === 0 ? (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            {tone === "urgent" ? "Nothing urgent right now." : "Nothing due this week."}
          </p>
        ) : (
          tasks.map((task) => (
            <TaskCategory
              key={task.kind}
              task={task}
              open={openKinds.has(task.kind)}
              onToggle={() => toggleKind(task.kind)}
              completeTasks={completeTasks}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TaskCategory({
  task,
  open,
  onToggle,
  completeTasks,
}: {
  task: TaskGroup;
  open: boolean;
  onToggle: () => void;
  completeTasks: CompleteTasks;
}) {
  const dot = dotFor(task.kind);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? task.people : task.people.slice(0, PREVIEW_LIMIT);
  const hiddenCount = task.people.length - PREVIEW_LIMIT;

  return (
    <section className="rounded-xl">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-1.5 py-2 text-left transition-colors hover:bg-[rgba(47,63,102,0.08)] active:bg-[rgba(47,63,102,0.14)]"
      >
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`}
        />
        <h4
          data-qc={`attention-kind-${task.kind}`}
          className="min-w-0 flex-1 truncate text-xs font-semibold tracking-[0.02em] text-foreground"
        >
          {task.label}
        </h4>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-2xs font-semibold shadow-inset-hi ${task.chipClass}`}
        >
          {task.people.length}
        </span>
      </button>

      {open && (
        <ul className="mb-1 ml-1 space-y-0.5 border-l border-glass-line pl-3">
          {visible.map((person) => (
            <AttentionPersonRow
              key={person.key}
              person={person}
              kind={task.kind}
              subtitle={displaySubtitle(person, task.kind)}
              href={displayHref(person, task.kind)}
              dot={dot}
              onDone={
                person.taskIds.length
                  ? () => completeTasks(person.taskIds, person.name.split(" ")[0] ?? person.name)
                  : undefined
              }
            />
          ))}
          {hiddenCount > 0 && (
            <li>
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="w-full cursor-pointer rounded-md px-1.5 py-1.5 text-left text-2xs font-semibold text-accent-ink transition-colors hover:bg-[rgba(47,63,102,0.08)] hover:underline"
              >
                {showAll ? "Show less" : `Show ${hiddenCount} more`}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

function DoneButton({ onDone, who }: { onDone: () => void; who: string }) {
  return (
    <button
      type="button"
      onClick={onDone}
      title={`Mark ${who}'s task as handled`}
      aria-label={`Mark ${who}'s task as handled`}
      data-qc="attention-task-done"
      className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full text-ink-3 transition-colors hover:bg-success-bg hover:text-success-ink active:bg-success-bg"
    >
      <Check className="h-3.5 w-3.5" aria-hidden />
    </button>
  );
}

function AttentionPersonRow({
  person,
  kind,
  subtitle,
  href,
  dot,
  onDone,
}: {
  person: TaskPerson;
  kind: string;
  subtitle: string | null;
  href: string;
  dot: string;
  onDone?: (() => void) | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [truncated, setTruncated] = useState(false);
  const summarized = subtitle === "Several appointments";

  useLayoutEffect(() => {
    if (expanded || summarized) return;
    const el = textRef.current;
    if (!el) return;
    const measure = () => setTruncated(el.scrollWidth > el.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [expanded, person.name, subtitle, summarized]);

  const line = (
    <>
      <span className="font-semibold text-foreground">{person.name}</span>
      {subtitle ? <span className="font-normal text-muted-foreground"> · {subtitle}</span> : null}
    </>
  );

  const expandable = Boolean(subtitle) && !summarized && (truncated || expanded);

  const rowQc = `attention-${kind.replace(/_/g, "-")}`;
  const who = person.name.split(" ")[0] ?? person.name;

  if (!expandable) {
    return (
      <li data-qc={rowQc} data-task-ids={person.taskIds.join(" ") || undefined}>
        <div className="flex items-center gap-1 rounded-md pr-1 transition-colors hover:bg-[rgba(47,63,102,0.08)]">
          <Link
            to={href as any}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 active:bg-[rgba(47,63,102,0.14)]"
          >
            <i className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
            <p
              ref={textRef}
              className="min-w-0 flex-1 truncate text-[13px] leading-snug text-foreground"
            >
              {line}
            </p>
          </Link>
          {onDone ? <DoneButton onDone={onDone} who={who} /> : null}
        </div>
      </li>
    );
  }

  return (
    <li data-qc={rowQc} data-task-ids={person.taskIds.join(" ") || undefined}>
      <div className="flex items-start gap-1 rounded-md py-1.5 pl-1.5 pr-1 transition-colors hover:bg-[rgba(47,63,102,0.08)]">
        <i className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
        <div className="min-w-0 flex-1 pl-1">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            title={expanded ? undefined : (subtitle ?? undefined)}
            className="w-full cursor-pointer text-left"
          >
            <p
              ref={textRef}
              className={cn("text-[13px] leading-snug text-foreground", !expanded && "truncate")}
            >
              {line}
            </p>
          </button>
          {expanded ? (
            <Link
              to={href as any}
              className="mt-1 inline-flex text-2xs font-semibold text-accent-ink hover:underline"
            >
              {onDone ? "Open task" : "Open record"}
            </Link>
          ) : null}
        </div>
        {onDone ? <DoneButton onDone={onDone} who={who} /> : null}
      </div>
    </li>
  );
}

function dotFor(kind: string) {
  switch (kind) {
    case "no_show":
    case "deposit_due":
    case "payment_due":
    case "balance_due":
    case "question":
      return "bg-destructive";
    case "consent_due":
      return "bg-consent";
    case "chase_booking":
      return "bg-warning";
    case "recall":
      return "bg-sky";
    case "plan_support":
      return "bg-success";
    case "send_offer":
      return "bg-accent-deep";
    case "tasks":
    case "treatment_due":
      return "bg-accent";
    case "incomplete_profile":
    case "compliance_due":
      return "bg-warning";
    case "staff_request":
      return "bg-accent";
    default:
      return "bg-bar";
  }
}
