import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PatientAvatar } from "@/components/patient-avatar";
import { staffLane } from "@/lib/staff-lane";
import { cn } from "@/lib/utils";
import {
  nextTreatmentState,
  PATIENT_TYPE_META,
  planSegments,
  relativeAgo,
  suggestedNextStep,
  typeLine,
  type Suggestion,
  type SuggestionAction,
} from "@/lib/patients/records-summary";
import { TASK_TYPE_META } from "@/lib/tasks/types";
import { isInactive, type PatientRow } from "@/components/patients/records-types";

export type DrawerAction = SuggestionAction;

/**
 * The Records drawer: who the patient is, what to do next, the last and next
 * treatment, the plan bar, their open tasks and recent activity. Every action
 * pill hands off to the tab (Book, Send booking link, Assign task…); the
 * drawer itself only reads.
 */
export function PatientDrawer({
  patient,
  now,
  onAction,
  onAssignTask,
  onOpenTask,
}: {
  patient: PatientRow;
  now: Date;
  onAction: (action: DrawerAction, patient: PatientRow) => void;
  onAssignTask: (patient: PatientRow) => void;
  onOpenTask: (taskId: string) => void;
}) {
  const s = patient.summary;
  const inactive = isInactive(patient);
  const type = s?.type ?? "regular";
  const meta = PATIENT_TYPE_META[type];
  const fullName = `${patient.first_name} ${patient.last_name}`.trim();
  const next = nextTreatmentState(
    {
      nextAppointment: patient.nextAppointment,
      nextDue: patient.nextDue,
      planStep: s?.planStep ?? null,
    },
    now,
  );
  const pronoun =
    patient.title === "Mr" || patient.title === "Dr"
      ? ("He" as const)
      : patient.title
        ? ("She" as const)
        : ("They" as const);
  const suggestion: Suggestion = suggestedNextStep({
    firstName: patient.first_name,
    pronoun,
    inactive,
    type,
    next,
    plan: s?.plan ?? null,
    lastTreatment: patient.lastTreatment
      ? { name: patient.lastTreatment.name, at: patient.lastTreatment.performed_at }
      : null,
    noShowAt: s?.noShowAt ?? null,
    openTasks: (s?.openTasks ?? []).map((t) => ({
      type: t.type,
      assigneeName: t.assigneeName,
      dueLabel: t.dueLabel,
    })),
    pendingOffer: s?.pendingOffer ?? null,
    portal: s?.portal ?? null,
    now,
  });
  const tasks = s?.openTasks ?? [];

  return (
    <aside
      className="flex flex-col gap-4 rounded-[20px] bg-card p-5 shadow-popover"
      data-qc="patient-drawer"
      data-patient-id={patient.id}
      aria-label={`${fullName} details`}
    >
      <header className="flex items-center gap-3">
        <span className={cn("shrink-0", inactive && "grayscale-[0.8]")}>
          <PatientAvatar
            patientId={patient.id}
            name={fullName}
            photoUrl={patient.avatar_url}
            size={52}
          />
        </span>
        <div className="min-w-0">
          <Link
            to="/patients/$id"
            params={{ id: patient.id }}
            className="block truncate text-[18px] font-semibold leading-tight text-foreground hover:text-accent-ink"
            data-qc="drawer-name"
          >
            {fullName}
          </Link>
          <p className="mt-0.5 truncate text-[12.5px] text-ink-3">
            {patient.reference ?? "No reference"}
            {s?.primaryPractitionerName ? ` · with ${s.primaryPractitionerName}` : ""}
          </p>
        </div>
      </header>

      <div>
        <span
          className={cn(
            "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold shadow-inset-hi",
            meta.pill,
          )}
          data-qc="drawer-type"
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} aria-hidden />
          {typeLine(type, s?.plan ?? null, inactive)}
        </span>
      </div>

      <section
        className="rounded-2xl bg-accent-wash p-4 shadow-[inset_0_0_0_1px_var(--accent-line)]"
        data-qc="drawer-suggestion"
      >
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-accent-ink">
          Suggested next step
        </p>
        <p className="mt-1.5 text-[13.5px] leading-[1.5] text-foreground">{suggestion.text}</p>
        {suggestion.actions.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestion.actions.slice(0, 2).map((a, i) => (
              <button
                key={a.action}
                type="button"
                onClick={() =>
                  a.action === "assign" ? onAssignTask(patient) : onAction(a.action, patient)
                }
                data-qc={`drawer-action-${a.action}`}
                className={cn(
                  "h-8 cursor-pointer rounded-full px-3.5 text-[12.5px] font-semibold shadow-inset-hi transition-[filter,background-color] hover:brightness-[0.97]",
                  i === 0
                    ? "bg-accent text-accent-foreground"
                    : "bg-[rgba(47,63,102,0.06)] text-foreground hover:bg-[rgba(47,63,102,0.1)]",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-[rgba(47,63,102,0.04)] p-3" data-qc="drawer-last">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">Last</p>
          <p className="mt-1 text-[13px] font-semibold text-foreground">
            {patient.lastTreatment?.name ?? "—"}
          </p>
          <p className="text-[12px] text-ink-3">
            {patient.lastTreatment
              ? relativeAgo(patient.lastTreatment.performed_at, now)
              : "No treatments yet"}
          </p>
        </div>
        <div className="rounded-xl bg-[rgba(47,63,102,0.04)] p-3" data-qc="drawer-next">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-3">Next</p>
          <p
            className={cn(
              "mt-1 text-[13px] font-semibold",
              next.tone === "overdue"
                ? "text-destructive-ink"
                : next.tone === "loud"
                  ? "text-accent-ink"
                  : next.tone === "muted"
                    ? "text-ink-3"
                    : "text-foreground",
            )}
          >
            {next.main}
          </p>
          <p className="text-[12px] text-ink-3">{next.sub}</p>
        </div>
      </div>

      {s?.plan ? (
        <section className="rounded-xl border border-edge-2 p-3" data-qc="drawer-plan">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[13px] font-semibold text-foreground">{s.plan.name}</p>
            <p className="font-mono text-[11.5px] tabular-nums text-ink-2">
              {s.plan.done}/{s.plan.total}
            </p>
          </div>
          <div className="mt-2 flex gap-[3px]" aria-hidden>
            {planSegments(s.plan).map((seg, i) => (
              <span
                key={i}
                className={cn(
                  "h-[5px] flex-1 rounded-full",
                  seg === "done" && "bg-accent-deep",
                  seg === "current" && "bg-accent",
                  seg === "current_overdue" && "bg-destructive",
                  seg === "future" && "bg-[rgba(47,63,102,0.1)]",
                )}
              />
            ))}
          </div>
          {s.plan.nextStep ? (
            <p className="mt-2 text-[12px] text-ink-2">Next: {s.plan.nextStep}</p>
          ) : null}
        </section>
      ) : null}

      <section data-qc="drawer-tasks">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Open tasks
          </h3>
          <button
            type="button"
            onClick={() => onAssignTask(patient)}
            data-qc="drawer-assign-task"
            className="-my-1 inline-flex min-h-7 cursor-pointer items-center gap-1 py-1 text-[12px] font-semibold text-accent-ink hover:text-foreground"
          >
            <Plus className="h-3 w-3" aria-hidden />
            Assign task
          </button>
        </div>
        {tasks.length ? (
          <ul className="flex flex-col gap-1.5">
            {tasks.map((t) => {
              const tm = TASK_TYPE_META[t.type];
              const lane = t.assigneeId ? staffLane(t.assigneeId, t.assigneeName) : null;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onOpenTask(t.id)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-xl px-1.5 py-1.5 text-left transition-colors hover:bg-[rgba(47,63,102,0.05)]"
                    data-qc="drawer-task"
                  >
                    <span
                      className={cn(
                        "inline-flex h-[22px] shrink-0 items-center rounded-full px-2 text-[11px] font-semibold shadow-inset-hi",
                        tm.chip,
                      )}
                    >
                      {tm.label}
                    </span>
                    <span
                      className={cn(
                        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[7.5px] font-bold text-accent-foreground",
                        lane ? lane.tone.edge : "bg-glass-2 text-ink-3",
                      )}
                      aria-hidden
                    >
                      {lane ? lane.initials : "FD"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">
                      {t.assigneeName ?? "Front desk pool"}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-[12px] font-semibold",
                        t.late ? "text-destructive-ink" : "text-ink-2",
                      )}
                    >
                      {t.dueLabel}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-[12.5px] text-ink-3" data-qc="drawer-tasks-empty">
            Nothing open. Automations are watching this patient.
          </p>
        )}
      </section>

      <section data-qc="drawer-activity">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
          Recent activity
        </h3>
        {s?.activity.length ? (
          <ul className="flex flex-col gap-2">
            {s.activity.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-[12.5px]">
                <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-sky" aria-hidden />
                <span className="min-w-0 flex-1 text-foreground">{a.text}</span>
                <span className="shrink-0 text-ink-3">{relativeAgo(a.at, now)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-ink-3">No portal or diary activity yet.</p>
        )}
      </section>
    </aside>
  );
}
