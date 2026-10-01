import { useState } from "react";
import { X } from "lucide-react";
import { staffLane } from "@/lib/staff-lane";
import type { TaskView_, TasksSummary } from "@/lib/tasks/service";
import { dueAtForPreset, suggestedAssignee, type DuePreset } from "@/lib/tasks/types";
import type { Outcome } from "@/lib/tasks/outcomes";
import { cn } from "@/lib/utils";

const PANEL = "max-w-[520px] rounded-2xl bg-card p-4 shadow-[inset_0_0_0_1px_var(--accent-line)]";
const EYEBROW = "font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-accent-ink";

type Member = TasksSummary["team"][number];

const INLINE_DUES: { key: DuePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "3d", label: "In 3 days" },
];

/**
 * The owner's inline delegate panel: five teammate tiles (suggested first),
 * a due segmented control, an optional note and the "lands in" line.
 */
export function DelegatePanel({
  task,
  team,
  ownerId,
  onAssign,
  onClose,
}: {
  task: TaskView_;
  team: Member[];
  ownerId: string | null;
  onAssign: (assigneeId: string, name: string, dueAt: string, note: string) => void;
  onClose: () => void;
}) {
  const suggestion = suggestedAssignee({
    type: task.type,
    patientPractitionerId: task.patient.practitionerId,
    ownerId,
  });
  const suggestedId =
    suggestion.assigneeId ??
    team.find((m) => m.role === "front_desk")?.id ??
    team.find((m) => m.role === "owner")?.id ??
    null;
  const [who, setWho] = useState<string | null>(task.assigneeId ?? suggestedId);
  const [due, setDue] = useState<DuePreset>("today");
  const [note, setNote] = useState("");
  const chosen = team.find((m) => m.id === who) ?? null;
  const first = chosen ? staffLane(chosen.id, chosen.name).first : "…";
  const sorted = [...team]
    .sort((a, b) => (a.id === suggestedId ? -1 : b.id === suggestedId ? 1 : a.open - b.open))
    .slice(0, 5);

  return (
    <div className={PANEL} data-qc="delegate-panel">
      <div className="flex items-center justify-between gap-2">
        <p className={EYEBROW}>Delegate this task</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-ink-3 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Teammate">
        {sorted.map((m) => {
          const lane = staffLane(m.id, m.name);
          const on = m.id === who;
          const isSuggested = m.id === suggestedId;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setWho(m.id)}
              data-qc={`delegate-who-${m.id}`}
              className={cn(
                "relative flex min-h-[70px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-center transition-[background-color,box-shadow]",
                on
                  ? "bg-card shadow-[0_0_0_1.5px_var(--accent-deep),0_6px_16px_-8px_rgba(122,98,32,0.5)]"
                  : "shadow-[inset_0_0_0_1px_rgba(47,63,102,0.07)] hover:bg-[rgba(47,63,102,0.04)]",
              )}
            >
              {isSuggested ? (
                <span className="absolute -top-2 rounded-full bg-accent px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-accent-foreground">
                  Suggested
                </span>
              ) : null}
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-accent-foreground",
                  lane.tone.edge,
                )}
                aria-hidden
              >
                {lane.initials}
              </span>
              <span className="text-[11.5px] font-semibold leading-tight text-foreground">
                {lane.short}
              </span>
              <span className="text-[10.5px] text-ink-3">{m.open} open</span>
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-ink-3">Due</span>
        <div
          className="flex h-[30px] items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi"
          role="radiogroup"
          aria-label="Due"
        >
          {INLINE_DUES.map((d) => (
            <button
              key={d.key}
              type="button"
              role="radio"
              aria-checked={due === d.key}
              onClick={() => setDue(d.key)}
              data-qc={`delegate-due-${d.key}`}
              className={cn(
                "h-6 cursor-pointer rounded-full px-3 text-[11.5px] tracking-[0.02em] transition-colors",
                due === d.key
                  ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                  : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note for them (optional)"
        aria-label="Note for the assignee"
        data-qc="delegate-note"
        className="mt-3 h-9 w-full rounded-xl border border-edge-2 bg-glass-2 px-3 text-[12.5px] shadow-inset-hi placeholder:text-ink-3 focus:outline-none focus:ring-2 focus:ring-ring"
      />
      <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-ink-3">
        <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
        Lands in {first}'s Tasks and on their dashboard under “Attention needed”.
      </p>
      <button
        type="button"
        disabled={!chosen}
        onClick={() => chosen && onAssign(chosen.id, chosen.name, dueAtForPreset(due), note.trim())}
        data-qc="delegate-submit"
        className="mt-3 h-9 w-full cursor-pointer rounded-full bg-accent text-[13px] font-semibold text-accent-foreground shadow-inset-hi transition-[filter] hover:brightness-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
      >
        Assign to {first}
      </button>
    </div>
  );
}

/** The outcome chips: "How did it go?" for practitioners, "Log the outcome" for front desk. */
export function OutcomePanel({
  title,
  outcomes,
  onPick,
  onClose,
}: {
  title: string;
  outcomes: Outcome[];
  onPick: (o: Outcome) => void;
  onClose: () => void;
}) {
  return (
    <div className={PANEL} data-qc="outcome-panel">
      <div className="flex items-center justify-between gap-2">
        <p className={EYEBROW}>{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-ink-3 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {outcomes.map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={() => onPick(o)}
            data-qc={`outcome-${o.label
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/-$/, "")}`}
            className={cn(
              "h-8 cursor-pointer rounded-full px-3.5 text-[12.5px] font-semibold shadow-inset-hi transition-[filter,background-color] hover:brightness-[0.97]",
              o.kind === "complete" && o.resolution === "booked"
                ? "bg-accent text-accent-foreground"
                : "bg-[rgba(47,63,102,0.06)] text-foreground hover:bg-[rgba(47,63,102,0.1)]",
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
