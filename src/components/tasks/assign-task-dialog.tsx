import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { PatientAvatar } from "@/components/patient-avatar";
import { createTask, getTasksSummary } from "@/lib/clinic.functions";
import { staffLane } from "@/lib/staff-lane";
import { invalidateTaskQueries } from "@/lib/use-tasks-sync";
import {
  DUE_PRESETS,
  dueAtForPreset,
  suggestedAssignee,
  suggestionReason,
  TASK_TYPE_META,
  type DuePreset,
  type TaskType,
} from "@/lib/tasks/types";
import { cn } from "@/lib/utils";

export type AssignTaskPatient = {
  id: string;
  firstName: string;
  name: string;
  avatarUrl?: string | null;
  /** "Anti-Wrinkle Maintenance · top-up 65 days overdue" */
  context?: string | null;
  practitionerId?: string | null;
};

const TYPES: TaskType[] = [
  "chase_booking",
  "recall",
  "question",
  "send_offer",
  "plan_support",
  "rebook_no_show",
];

const ROLE_LABEL: Record<string, string> = {
  owner: "Clinic owner",
  manager: "Manager",
  practitioner: "Practitioner",
  front_desk: "Front desk",
};

function template(type: TaskType, first: string, context: string | null | undefined) {
  switch (type) {
    case "chase_booking":
      return `Hi ${first}, your next treatment is due. Here's a link to pick a time that suits you →`;
    case "recall":
      return `Hi ${first}, it's been a while! Shall we get your next appointment in the diary?`;
    case "question":
      return `Reply to ${first}'s question${context ? ` about ${context.toLowerCase()}` : ""}.`;
    case "plan_support":
      return `Check in with ${first} on how they're finding the plan so far.`;
    case "send_offer":
      return `Send ${first} an offer for this month.`;
    case "rebook_no_show":
      return `Contact ${first} to rebook the missed appointment.`;
    default:
      return `A task for ${first}.`;
  }
}

/**
 * D · Assign a task. Opens from the drawer's "+ Assign task", from a row on
 * the Tasks page or from "New task": what needs doing, who (suggested by
 * type and workload), when, and three switches. Assigning to someone else
 * needs `tasks.assign_any`; the list only offers yourself otherwise.
 */
export function AssignTaskDialog({
  open,
  onOpenChange,
  patient,
  defaultType = "chase_booking",
  viewerId,
  canAssignOthers,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: AssignTaskPatient | null;
  defaultType?: TaskType;
  viewerId: string;
  canAssignOthers: boolean;
  onCreated?: (taskId: string) => void;
}) {
  const queryClient = useQueryClient();
  const fetchSummary = useServerFn(getTasksSummary);
  const { data: summary } = useQuery({
    queryKey: ["tasks-summary"],
    queryFn: () => fetchSummary(),
    enabled: open,
  });
  const team = summary?.team ?? [];
  const ownerId = team.find((m) => m.role === "owner")?.id ?? null;

  const [type, setType] = useState<TaskType>(defaultType);
  const [who, setWho] = useState<string | null>(null);
  const [due, setDue] = useState<DuePreset>("tomorrow");
  const [autoClose, setAutoClose] = useState(true);
  const [notify, setNotify] = useState(true);
  const [rule, setRule] = useState(false);

  useEffect(() => {
    if (open) {
      setType(defaultType);
      setWho(null);
      setDue(defaultType === "question" ? "4h" : "tomorrow");
      setAutoClose(true);
      setNotify(true);
      setRule(false);
    }
  }, [open, defaultType]);

  const suggested = useMemo(
    () =>
      suggestedAssignee({ type, patientPractitionerId: patient?.practitionerId ?? null, ownerId }),
    [type, patient?.practitionerId, ownerId],
  );
  const suggestedId =
    suggested.assigneeId ??
    team.find((m) => m.role === "front_desk")?.id ??
    team.find((m) => m.role === "owner")?.id ??
    null;
  const people = canAssignOthers
    ? [...team].sort((a, b) =>
        a.id === suggestedId ? -1 : b.id === suggestedId ? 1 : a.open - b.open,
      )
    : team.filter((m) => m.id === viewerId);
  const chosen = who ?? (canAssignOthers ? suggestedId : viewerId);
  const chosenMember = people.find((m) => m.id === chosen) ?? null;

  const create = useMutation({
    mutationFn: useServerFn(createTask),
    onSuccess: (res: { task: { id: string } }) => {
      toast.success(
        `${patient?.firstName ?? "Task"} assigned to ${
          chosenMember ? staffLane(chosenMember.id, chosenMember.name).short : "the team."
        } Added to their Tasks and dashboard.`,
      );
      void invalidateTaskQueries(queryClient);
      onOpenChange(false);
      onCreated?.(res.task.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!patient) return null;
  const meta = TASK_TYPE_META[type];
  const ruleLine = `When a patient like ${patient.firstName} needs this → ${meta.label} → ${chosenMember ? staffLane(chosenMember.id, chosenMember.name).short : "the team"} → due ${DUE_PRESETS.find((d) => d.key === due)?.label.toLowerCase()}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[calc(calc(100*var(--app-dvh))-2rem)] max-w-[540px] grid-rows-[minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-[22px] p-0"
        data-qc="assign-task-dialog"
      >
        {/* The body scrolls on its own so the close button and the footer stay put. */}
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto p-5">
          <header className="flex items-center gap-3 pr-8">
            <PatientAvatar
              patientId={patient.id}
              name={patient.name}
              photoUrl={patient.avatarUrl}
              size={40}
            />
            <div className="min-w-0">
              <DialogTitle className="truncate text-[17px] font-semibold tracking-[-0.01em]">
                Assign a task: {patient.name}
              </DialogTitle>
              <DialogDescription className="truncate text-[13px] text-ink-3">
                {patient.context ?? "Pick what needs doing and who should do it."}
              </DialogDescription>
            </div>
          </header>

          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              What needs doing
            </p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Task type">
              {TYPES.map((t) => {
                const m = TASK_TYPE_META[t];
                const on = t === type;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setType(t);
                      setWho(null);
                      if (t === "question") setDue("4h");
                    }}
                    data-qc={`assign-type-${t}`}
                    className={cn(
                      "h-8 cursor-pointer rounded-full border px-3.5 text-[13px] font-medium transition-colors",
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
            <p
              className="mt-3 rounded-xl bg-[rgba(47,63,102,0.04)] px-3.5 py-3 text-[13px] leading-relaxed text-ink-2"
              data-qc="assign-template"
            >
              {template(type, patient.firstName, patient.context)}
            </p>
          </section>

          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Who
            </p>
            <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Assign to">
              {people.map((m) => {
                const lane = staffLane(m.id, m.name);
                const on = m.id === chosen;
                const isSuggested = m.id === suggestedId && canAssignOthers;
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setWho(m.id)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors",
                      on
                        ? "border-transparent bg-accent-wash shadow-[inset_0_0_0_1.5px_var(--accent-line)]"
                        : "border-edge-2 hover:bg-[rgba(47,63,102,0.04)]",
                    )}
                    data-qc={`assign-who-${m.id}`}
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        on ? "border-foreground" : "border-ink-3/60",
                      )}
                      aria-hidden
                    >
                      {on ? <span className="h-2 w-2 rounded-full bg-foreground" /> : null}
                    </span>
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-accent-foreground",
                        lane.tone.edge,
                      )}
                      aria-hidden
                    >
                      {lane.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-foreground">
                        {m.name}
                      </span>
                      <span className="block truncate text-[12px] text-ink-3">
                        {isSuggested ? suggestionReason(type) : (ROLE_LABEL[m.role] ?? m.role)} ·{" "}
                        {m.open} open
                      </span>
                    </span>
                    {isSuggested ? (
                      <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-accent-ink">
                        Suggested
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {people.length === 0 ? (
                <p className="text-[12.5px] text-ink-3">Loading the team…</p>
              ) : null}
            </div>
          </section>

          <section>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Due
            </p>
            <div
              className="flex h-[34px] w-fit max-w-full items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi"
              role="radiogroup"
              aria-label="Due"
            >
              {DUE_PRESETS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  role="radio"
                  aria-checked={due === d.key}
                  onClick={() => setDue(d.key)}
                  data-qc={`assign-due-${d.key}`}
                  className={cn(
                    "h-7 cursor-pointer whitespace-nowrap rounded-full px-3.5 text-xs tracking-[0.02em] transition-colors",
                    due === d.key
                      ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                      : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2.5 border-t border-edge-2 pt-4">
            <label className="flex cursor-pointer items-center gap-3 text-[13px] text-foreground">
              <Switch
                checked={autoClose}
                onCheckedChange={setAutoClose}
                aria-label="Finish automatically when the patient books or replies"
                data-qc="assign-auto-resolve"
              />
              Close automatically when {patient.firstName} books or replies
            </label>
            <label className="flex cursor-pointer items-center gap-3 text-[13px] text-foreground">
              <Switch
                checked={notify}
                onCheckedChange={setNotify}
                aria-label="Notify them"
                data-qc="assign-notify"
              />
              Notify them in the app and by email
            </label>
            <label className="flex cursor-pointer items-center gap-3 text-[13px] text-foreground">
              <Switch
                checked={rule}
                onCheckedChange={setRule}
                aria-label="Make this a rule"
                data-qc="assign-rule"
              />
              Do this automatically for similar patients
            </label>
            {rule ? (
              <p
                className="rounded-xl bg-success-bg px-3.5 py-2.5 text-[12.5px] text-success-ink"
                data-qc="assign-rule-preview"
              >
                <span className="font-semibold">New rule preview:</span> {ruleLine}.
              </p>
            ) : null}
          </section>
        </div>
        <DialogFooter className="flex-row justify-end gap-2 border-t border-edge-2 px-5 py-3.5 sm:justify-end">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!chosen || create.isPending}
            data-qc="assign-submit"
            onClick={() =>
              create.mutate({
                data: {
                  patient_id: patient.id,
                  type,
                  ...(chosen ? { assigneeId: chosen } : {}),
                  dueAt: dueAtForPreset(due),
                  autoClose,
                  notify,
                  saveAsRule: rule,
                },
              })
            }
          >
            Assign to {chosenMember ? staffLane(chosenMember.id, chosenMember.name).short : "…"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
