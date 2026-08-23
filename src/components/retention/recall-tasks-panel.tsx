import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, MoreHorizontal, Pencil, PhoneCall, Send, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteRecallTask,
  listRecallTasks,
  listTeam,
  setRecallTaskStatus,
  updateRecallTask,
} from "@/lib/clinic.functions";
import { invalidateRecallTasks, useRecallTasksLiveSync } from "@/lib/use-recall-tasks-sync";
import { useIdentity } from "@/lib/use-identity";

type Status = "sent" | "contacted" | "completed";

const STATUS: Record<Status, { label: string }> = {
  sent: { label: "Sent" },
  contacted: { label: "Contacted" },
  completed: { label: "Completed" },
};

const STEPS: { key: Status; label: string; icon: typeof Send }[] = [
  { key: "sent", label: "Sent", icon: Send },
  { key: "contacted", label: "Contacted", icon: PhoneCall },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
];

const ROLE_LABEL: Record<string, string> = {
  owner: "Manager",
  practitioner: "Practitioner",
  front_desk: "Receptionist",
};

const RETRACT_UNDO_MS = 6000;

function formatDay(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MetaSep() {
  return <span className="text-ink-3"> · </span>;
}

function MetaStamp({ at, prefix }: { at: string; prefix?: string }) {
  return (
    <>
      {prefix ? `${prefix} ` : null}
      <span className="tabular-nums">{formatDay(at)}</span>
      <MetaSep />
      <span className="font-semibold tabular-nums text-accent-ink">{formatTime(at)}</span>
    </>
  );
}

type AssigneeOption = { id: string; label: string; taskId: string };

function EditRecallDialog({
  open,
  onOpenChange,
  taskId,
  initialAssigneeIds,
  initialNote,
  onRequestRetract,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  initialAssigneeIds: string[];
  initialNote: string;
  onRequestRetract: () => void;
}) {
  const queryClient = useQueryClient();
  const fetchTeam = useServerFn(listTeam);
  const updateTask = useServerFn(updateRecallTask);
  const [selected, setSelected] = useState<string[]>(initialAssigneeIds);
  const [note, setNote] = useState(initialNote);

  useEffect(() => {
    if (!open) return;
    setSelected(initialAssigneeIds);
    setNote(initialNote);
  }, [open, initialAssigneeIds, initialNote]);

  const { data: team } = useQuery({
    queryKey: ["team", "recall-task"],
    queryFn: () => fetchTeam(),
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const recipients = useMemo(
    () => (team ?? []).filter((m: any) => m.role === "practitioner" || m.role === "front_desk"),
    [team],
  );

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const save = useMutation({
    mutationFn: () => {
      const picked = recipients
        .filter((m: any) => selected.includes(m.userId))
        .map((m: any) => ({ id: m.userId as string, label: (m.fullName || m.email) as string }));
      if (!picked.length) throw new Error("Pick at least one team member");
      return updateTask({
        data: { task_id: taskId, recipients: picked, note: note.trim() || undefined },
      });
    },
    onSuccess: (res: any) => {
      toast.success(res?.reassigned ? "Recall task reassigned" : "Recall task updated");
      void invalidateRecallTasks(queryClient);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[22px] border-edge-2 bg-card/95 p-5 shadow-popover sm:rounded-[22px]"
      >
        <DialogHeader className="shrink-0 pr-8 text-left">
          <DialogTitle>
            Edit recall task
          </DialogTitle>
          <DialogDescription>
            Change who should chase this patient, update the note, or retract assignments.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            {recipients.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No practitioners or receptionists yet — add them under Team.
              </p>
            ) : (
              recipients.map((m: any) => (
                <label
                  key={m.userId}
                  className="flex cursor-pointer items-center gap-2.5 rounded-2xl border border-edge bg-glass-2 px-3.5 py-2.5 text-xs transition-colors hover:bg-accent-wash"
                >
                  <Checkbox
                    checked={selected.includes(m.userId)}
                    onCheckedChange={() => toggle(m.userId)}
                  />
                  <span className="min-w-0 flex-1 font-medium text-foreground">
                    {m.fullName || m.email}
                  </span>
                  <span className="shrink-0 text-2xs text-muted-foreground">
                    {ROLE_LABEL[m.role] ?? m.role}
                  </span>
                </label>
              ))
            )}
          </div>

          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Note for the team…"
            className="rounded-2xl text-xs"
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            className="text-xs text-destructive hover:bg-destructive-bg hover:text-destructive-ink"
            disabled={save.isPending}
            onClick={() => {
              onOpenChange(false);
              onRequestRetract();
            }}
          >
            <Undo2 className="mr-1 h-3.5 w-3.5" />
            Retract
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="text-xs"
              disabled={save.isPending}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RetractRecallDialog({
  open,
  onOpenChange,
  assignees,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignees: AssigneeOption[];
  onConfirm: (picked: AssigneeOption[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(() => assignees.map((a) => a.id));

  useEffect(() => {
    if (!open) return;
    setSelected(assignees.map((a) => a.id));
  }, [open, assignees]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allSelected = selected.length === assignees.length && assignees.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[22px] border-edge-2 bg-card/95 p-5 shadow-popover sm:rounded-[22px]"
      >
        <DialogHeader className="shrink-0 pr-8 text-left">
          <DialogTitle>
            Retract assignment
          </DialogTitle>
          <DialogDescription>
            Choose who to remove from this chase-up. They’ll disappear from My tasks.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-foreground">Assignees</p>
            <button
              type="button"
              className="text-xs font-medium text-accent-ink hover:underline"
              onClick={() => setSelected(allSelected ? [] : assignees.map((a) => a.id))}
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
          </div>

          <div className="space-y-2">
            {assignees.map((a) => (
              <label
                key={a.id}
                className="flex cursor-pointer items-center gap-2.5 rounded-2xl border border-edge bg-glass-2 px-3.5 py-2.5 text-xs transition-colors hover:bg-accent-wash"
              >
                <Checkbox checked={selected.includes(a.id)} onCheckedChange={() => toggle(a.id)} />
                <span className="font-medium text-foreground">{a.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="text-xs"
            disabled={!selected.length}
            onClick={() => {
              const picked = assignees.filter((a) => selected.includes(a.id));
              if (!picked.length) return;
              onConfirm(picked);
              onOpenChange(false);
            }}
          >
            Retract
            {selected.length === 1
              ? " 1 person"
              : selected.length > 1
                ? ` ${selected.length} people`
                : ""}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Recall tasks for a patient, with a sent → contacted → completed tracker. */
export function RecallTasksPanel({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const { data: identity } = useIdentity();
  const fetchTasks = useServerFn(listRecallTasks);
  const setStatus = useServerFn(setRecallTaskStatus);
  const removeTask = useServerFn(deleteRecallTask);
  useRecallTasksLiveSync(patientId);
  const [editing, setEditing] = useState<{
    taskId: string;
    assigneeIds: string[];
    note: string;
    assignees: AssigneeOption[];
  } | null>(null);
  const [retracting, setRetracting] = useState<{
    taskId: string;
    assignees: AssigneeOption[];
  } | null>(null);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const store = timers.current;
    return () => {
      Object.values(store).forEach(clearTimeout);
    };
  }, []);

  const { data: tasks } = useQuery({
    queryKey: ["recall-tasks", patientId],
    queryFn: () => fetchTasks({ data: { patient_id: patientId } }),
    refetchInterval: 30_000,
  });

  const update = useMutation({
    mutationFn: (vars: { task_id: string; status: Status }) => setStatus({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(`Recall task marked ${STATUS[vars.status].label.toLowerCase()}`);
      void invalidateRecallTasks(queryClient);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const commitRetract = (taskId: string, assigneeIds: string[]) => {
    void removeTask({ data: { task_id: taskId, assignee_ids: assigneeIds } })
      .then(() => {
        void invalidateRecallTasks(queryClient);
      })
      .catch((e: Error) => {
        setPendingIds((prev) => prev.filter((id) => !assigneeIds.includes(id)));
        toast.error(e.message);
      });
  };

  const requestRetract = (taskId: string, picked: AssigneeOption[]) => {
    const assigneeIds = picked.map((p) => p.id);
    const taskIds = picked.map((p) => p.taskId);
    const batchKey = taskIds.slice().sort().join(",");
    const existing = timers.current[batchKey];
    if (existing) clearTimeout(existing);

    setPendingIds((prev) => [...new Set([...prev, ...taskIds])]);

    timers.current[batchKey] = setTimeout(() => {
      delete timers.current[batchKey];
      setPendingIds((prev) => prev.filter((id) => !taskIds.includes(id)));
      commitRetract(taskId, assigneeIds);
    }, RETRACT_UNDO_MS);

    const names = picked.map((p) => p.label);
    const summary =
      names.length === 1
        ? `Retracted ${names[0]}`
        : names.length === 2
          ? `Retracted ${names[0]} and ${names[1]}`
          : `Retracted ${names.length} assignees`;

    toast.success(summary, {
      action: {
        label: "Undo",
        onClick: () => {
          const timer = timers.current[batchKey];
          if (timer) clearTimeout(timer);
          delete timers.current[batchKey];
          setPendingIds((prev) => prev.filter((id) => !taskIds.includes(id)));
          toast.success("Assignment restored");
        },
      },
      duration: RETRACT_UNDO_MS,
    });
  };

  const rows = ((tasks as any[]) ?? []).filter((t) => !pendingIds.includes(t.id));
  // Tasks sent to several people share a group: show them as one chase-up.
  const groups = Object.values(
    rows.reduce<Record<string, any[]>>((acc, t) => {
      const key = (t.group_id as string) ?? (t.id as string);
      (acc[key] ??= []).push(t);
      return acc;
    }, {}),
  );

  const canUpdateGroup = (group: any[]) => {
    if (!identity) return false;
    if (identity.isManager || identity.roles?.includes("front_desk")) return true;
    return group.some((g) => g.assigned_to === identity.userId);
  };

  const toAssignees = (group: any[]): AssigneeOption[] =>
    group
      .filter((g: any) => g.assigned_to)
      .map((g: any) => ({
        id: g.assigned_to as string,
        label: (g.assigned_label as string) || "Assignee",
        taskId: g.id as string,
      }));

  if (groups.length === 0 && pendingIds.length === 0) {
    return (
      <Card className="mt-4 p-5">
        <h3 className="section-title">Recall tasks</h3>
        <p className="text-xs text-muted-foreground">
          No recall tasks yet. Assign one from the Retention page by hovering a patient's
          practitioner.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-4 p-5">
      <div className="mb-3">
        <h3 className="section-title">Recall tasks</h3>
        <p className="text-xs text-muted-foreground">
          Mark contacted or completed — status syncs live for the whole team.
        </p>
      </div>
      <ul className="space-y-2">
        {groups.map((group) => {
          const mine = group.find((g: any) => g.assigned_to === identity?.userId);
          const t = mine ?? group[0];
          const status = t.status as Status;
          const assignees = group
            .map((g: any) => g.assigned_label)
            .filter(Boolean)
            .join(" · ");
          const title = assignees ? `Assigned to ${assignees}` : "Assigned to the team";
          const reassignedAt =
            group.map((g: any) => g.reassigned_at as string | null).find(Boolean) ?? null;
          const hasMeta = Boolean(
            t.created_at ||
              reassignedAt ||
              t.contacted_at ||
              t.completed_at ||
              (t.status_by_label && status !== "sent"),
          );
          const canUpdate = canUpdateGroup(group);
          const canEdit = Boolean(identity?.isManager);
          const assigneeOptions = toAssignees(group);

          return (
            <li
              key={t.group_id ?? t.id}
              className="rounded-xl border border-edge bg-glass-2/60 px-3.5 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                    {title}
                  </p>
                  {hasMeta ? (
                    <p className="mt-0.5 truncate text-2xs text-muted-foreground">
                      {t.created_at ? <MetaStamp at={t.created_at} /> : null}
                      {reassignedAt ? (
                        <>
                          {t.created_at ? <MetaSep /> : null}
                          <MetaStamp at={reassignedAt} prefix="Reassigned" />
                        </>
                      ) : null}
                      {t.contacted_at ? (
                        <>
                          {t.created_at || reassignedAt ? <MetaSep /> : null}
                          <MetaStamp at={t.contacted_at} prefix="Contacted" />
                        </>
                      ) : null}
                      {t.completed_at ? (
                        <>
                          {t.created_at || reassignedAt || t.contacted_at ? <MetaSep /> : null}
                          <MetaStamp at={t.completed_at} prefix="Completed" />
                        </>
                      ) : null}
                      {t.status_by_label && status !== "sent" ? (
                        <>
                          <MetaSep />
                          {t.status_by_label}
                        </>
                      ) : null}
                    </p>
                  ) : null}
                </div>
                {canEdit ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="mt-0.5 h-7 w-7 shrink-0 text-muted-foreground"
                        aria-label="Recall task options"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 rounded-xl">
                      <DropdownMenuItem
                        onClick={() =>
                          setEditing({
                            taskId: t.id,
                            assigneeIds: group.map((g: any) => g.assigned_to).filter(Boolean),
                            note: t.note ?? "",
                            assignees: assigneeOptions,
                          })
                        }
                      >
                        <Pencil className="mr-2 h-3.5 w-3.5" />
                        Edit assignment
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive-bg focus:text-destructive-ink"
                        onClick={() =>
                          setRetracting({
                            taskId: t.id,
                            assignees: assigneeOptions,
                          })
                        }
                      >
                        <Undo2 className="mr-2 h-3.5 w-3.5" />
                        Retract assignment
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>

              {t.note ? (
                <p className="mt-2.5 text-sm leading-relaxed text-foreground">{t.note}</p>
              ) : null}

              {canUpdate ? (
                <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-edge/70 pt-2">
                  {STEPS.map((s) => (
                    <Button
                      key={s.key}
                      size="sm"
                      variant={status === s.key ? "secondary" : "ghost"}
                      className="h-7 text-2xs"
                      disabled={update.isPending || status === s.key}
                      onClick={() => update.mutate({ task_id: t.id, status: s.key })}
                    >
                      <s.icon className="mr-1 h-3 w-3" />
                      {s.label}
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="mt-2.5 border-t border-edge/70 pt-2 text-2xs text-ink-3">
                  Waiting on {assignees || "the assigned team member"} to update this.
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {editing ? (
        <EditRecallDialog
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          taskId={editing.taskId}
          initialAssigneeIds={editing.assigneeIds}
          initialNote={editing.note}
          onRequestRetract={() => {
            setRetracting({ taskId: editing.taskId, assignees: editing.assignees });
            setEditing(null);
          }}
        />
      ) : null}

      {retracting ? (
        <RetractRecallDialog
          open
          onOpenChange={(open) => {
            if (!open) setRetracting(null);
          }}
          assignees={retracting.assignees}
          onConfirm={(picked) => requestRetract(retracting.taskId, picked)}
        />
      ) : null}
    </Card>
  );
}
