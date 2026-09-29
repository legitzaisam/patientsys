import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  assignTasks,
  claimTask,
  completeTask,
  completeTasks,
  escalateToClinician,
  handOffToPool,
  logTaskAttempt,
  snoozeTask,
  undoTaskEvent,
} from "@/lib/clinic.functions";
import type { TaskView_ } from "@/lib/tasks/service";
import type { AttemptOutcome } from "@/lib/tasks/service";
import { invalidateTaskQueries } from "@/lib/use-tasks-sync";

type ListData = { view: string; tasks: TaskView_[]; groups: unknown };

/** "Sofia M." + "." reads as "Sofia M.." — end the sentence once. */
const sentence = (name: string) => (name.endsWith(".") ? name : `${name}.`);

/**
 * Every write on the Tasks page goes through here: apply the change to the
 * cached list at once, call the server, then show a toast with Undo (which
 * restores the previous state through the audit event). On error the cache
 * rolls back and the error is the toast.
 */
export function useTaskActions() {
  const queryClient = useQueryClient();
  const doAssign = useServerFn(assignTasks);
  const doHandOff = useServerFn(handOffToPool);
  const doClaim = useServerFn(claimTask);
  const doAttempt = useServerFn(logTaskAttempt);
  const doComplete = useServerFn(completeTask);
  const doCompleteMany = useServerFn(completeTasks);
  const doEscalate = useServerFn(escalateToClinician);
  const doSnooze = useServerFn(snoozeTask);
  const doUndo = useServerFn(undoTaskEvent);
  const busy = useRef(false);

  /** Optimistically patch tasks in every cached list; returns a rollback. */
  const patchLists = useCallback(
    (ids: readonly string[], patch: (t: TaskView_) => TaskView_ | null) => {
      const snapshots = queryClient.getQueriesData<ListData>({ queryKey: ["tasks"] });
      for (const [key, data] of snapshots) {
        if (!data?.tasks) continue;
        const tasks = data.tasks
          .map((t) => (ids.includes(t.id) ? patch(t) : t))
          .filter((t): t is TaskView_ => t !== null);
        queryClient.setQueryData<ListData>(key, { ...data, tasks });
      }
      return () => {
        for (const [key, data] of snapshots) queryClient.setQueryData(key, data);
      };
    },
    [queryClient],
  );

  const run = useCallback(
    async <T extends { eventId?: number; eventIds?: number[] }>(opts: {
      ids: readonly string[];
      patch: (t: TaskView_) => TaskView_ | null;
      call: () => Promise<T>;
      message: (result: T) => string;
    }): Promise<T | null> => {
      if (busy.current) return null;
      busy.current = true;
      const rollback = patchLists(opts.ids, opts.patch);
      try {
        const result = await opts.call();
        const eventIds = result.eventIds ?? (result.eventId !== undefined ? [result.eventId] : []);
        toast.success(opts.message(result), {
          duration: 5_000,
          ...(eventIds.length
            ? {
                action: {
                  label: "Undo",
                  onClick: async () => {
                    try {
                      for (const id of [...eventIds].reverse())
                        await doUndo({ data: { eventId: id } });
                      toast.success("Undone.");
                    } catch (e) {
                      toast.error((e as Error).message);
                    } finally {
                      void invalidateTaskQueries(queryClient);
                    }
                  },
                },
              }
            : {}),
        });
        void invalidateTaskQueries(queryClient);
        return result;
      } catch (e) {
        rollback();
        toast.error((e as Error).message);
        return null;
      } finally {
        busy.current = false;
      }
    },
    [doUndo, patchLists, queryClient],
  );

  return {
    assign: (
      ids: string[],
      assigneeId: string,
      assigneeName: string,
      opts: { dueAt?: string; note?: string; patients?: string } = {},
    ) =>
      run({
        ids,
        patch: (t) => ({ ...t, assigneeId, assigneeName, assigneeRole: null }),
        call: () =>
          doAssign({
            data: {
              taskIds: ids,
              assigneeId,
              ...(opts.dueAt ? { dueAt: opts.dueAt } : {}),
              ...(opts.note ? { note: opts.note } : {}),
            },
          }),
        message: () =>
          `${ids.length === 1 ? (opts.patients ?? "Task") : `${ids.length} tasks`} assigned to ${sentence(assigneeName)} Added to their Tasks and dashboard.`,
      }),
    handOff: (t: TaskView_) =>
      run({
        ids: [t.id],
        patch: (x) => ({ ...x, assigneeId: null, assigneeName: null, assigneeRole: "front_desk" }),
        call: () => doHandOff({ data: { taskId: t.id } }),
        message: () => "Sent to the front desk pool. The first free receptionist will claim it.",
      }),
    claim: (t: TaskView_, viewer: { userId: string; name: string }) =>
      run({
        ids: [t.id],
        patch: (x) => ({
          ...x,
          assigneeId: viewer.userId,
          assigneeName: viewer.name,
          assigneeRole: null,
        }),
        call: () => doClaim({ data: { taskId: t.id } }),
        message: () => `${t.patient.firstName} claimed. It's in your queue.`,
      }),
    attempt: (t: TaskView_, outcome: AttemptOutcome) =>
      run({
        ids: [t.id],
        patch: (x) => ({ ...x, attempts: x.attempts + 1 }),
        call: () => doAttempt({ data: { taskId: t.id, outcome } }),
        message: (r) =>
          r.escalated
            ? `Third attempt logged. ${t.patient.firstName} escalated to the clinic owner.`
            : `${outcome === "no_answer" ? "No answer" : outcome === "voicemail" ? "Voicemail" : "Booking link sent"} logged (attempt ${r.attempts} of 3). Retry scheduled.`,
      }),
    complete: (t: TaskView_, resolution: string, label: string) =>
      run({
        ids: [t.id],
        patch: (x) => ({ ...x, status: "done", resolution, dueLabel: label }),
        call: () => doComplete({ data: { taskId: t.id, resolution } }),
        message: () =>
          `${t.patient.firstName}: ${label.toLowerCase()}. Removed from the dashboard's Attention needed.`,
      }),
    completeMany: (ids: string[]) =>
      run({
        ids,
        patch: (x) => ({ ...x, status: "done", resolution: "handled", dueLabel: "Handled" }),
        call: () => doCompleteMany({ data: { taskIds: ids, resolution: "handled" } }),
        message: () => `${ids.length} task${ids.length === 1 ? "" : "s"} marked as handled.`,
      }),
    escalate: (t: TaskView_) =>
      run({
        ids: [t.id],
        patch: (x) => ({ ...x, assigneeId: t.patient.practitionerId, assigneeName: null }),
        call: () => doEscalate({ data: { taskId: t.id } }),
        message: (r) => `Escalated to ${r.toName ?? "the practitioner"}. It's left your queue.`,
      }),
    snooze: (t: TaskView_, hours = 2) =>
      run({
        ids: [t.id],
        patch: (x) => ({ ...x, status: "snoozed" }),
        call: () => doSnooze({ data: { taskId: t.id, hours } }),
        message: () => `Snoozed for ${hours} hours.`,
      }),
  };
}

export type TaskActions = ReturnType<typeof useTaskActions>;
