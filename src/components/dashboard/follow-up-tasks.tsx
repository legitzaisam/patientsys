import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ClipboardList, Mail, MessageSquare, Phone, X } from "lucide-react";
import { deleteRecallTask, listOpenRecallTasks, setRecallTaskStatus } from "@/lib/clinic.functions";
import { can } from "@/lib/permissions";
import { invalidateRecallTasks, useRecallTasksLiveSync } from "@/lib/use-recall-tasks-sync";
import { useIdentity } from "@/lib/use-identity";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Channel = "phone" | "email" | "message";

const STORE_KEY = "recall-task-channels";

function readChannels(): Record<string, Channel> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/** Outstanding patient follow-ups (e.g. after a no show) for the signed-in user. */
export function FollowUpTasks() {
  const queryClient = useQueryClient();
  const fetchTasks = useServerFn(listOpenRecallTasks);
  const { data: identity } = useIdentity();
  useRecallTasksLiveSync();
  const { data: tasks } = useQuery({
    queryKey: ["recall-tasks", "open"],
    queryFn: () => fetchTasks(),
    refetchInterval: 30_000,
  });
  const [channels, setChannels] = useState<Record<string, Channel>>(() => readChannels());

  const markChannel = (taskId: string, channel: Channel) => {
    setChannels((prev) => {
      const next = { ...prev, [taskId]: channel };
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const clearChannel = (taskId: string) => {
    setChannels((prev) => {
      const { [taskId]: _, ...next } = prev;
      try {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const update = useMutation({
    mutationFn: useServerFn(setRecallTaskStatus),
    onSuccess: () => {
      toast.success("Task updated");
      void invalidateRecallTasks(queryClient);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: useServerFn(deleteRecallTask),
    onSuccess: () => {
      void invalidateRecallTasks(queryClient);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      void invalidateRecallTasks(queryClient);
    },
  });

  /** Deletes are held for a few seconds so they can be undone. */
  const [pending, setPending] = useState<string[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const store = timers.current;
    return () => {
      Object.values(store).forEach(clearTimeout);
    };
  }, []);

  const requestDelete = (taskId: string, name: string) => {
    setPending((prev) => [...prev, taskId]);
    timers.current[taskId] = setTimeout(() => {
      delete timers.current[taskId];
      remove.mutate({ data: { task_id: taskId } });
    }, 6000);
    toast.success(`Task deleted — ${name}`, {
      action: {
        label: "Undo",
        onClick: () => {
          const timer = timers.current[taskId];
          if (timer) clearTimeout(timer);
          delete timers.current[taskId];
          setPending((prev) => prev.filter((id) => id !== taskId));
          toast.success("Task restored");
        },
      },
      duration: 6000,
    });
  };

  const visible = (tasks ?? []).filter((t: any) => !pending.includes(t.id));

  const contactVia = (taskId: string, channel: Channel, status: string) => {
    markChannel(taskId, channel);
    if (status === "sent") {
      update.mutate({ data: { task_id: taskId, status: "contacted" } });
    }
  };

  return (
    <section>
      <div className="mb-4">
        <h2 className="section-title">My tasks</h2>
        <p className="text-xs text-muted-foreground">Patients to contact and rebook by chat, phone or email.</p>
      </div>
      {!visible.length ? (
        <div className="rounded-2xl border border-dashed border-edge-2 bg-glass-2 p-8 text-center">
          <ClipboardList className="mx-auto h-5 w-5 text-ink-3" />
          <p className="mt-2 text-sm text-muted-foreground">Nothing on your list right now.</p>
        </div>
      ) : (
        <Card className="max-h-[22rem] divide-y divide-glass-line overflow-y-auto p-0">
        {visible.map((t: any) => {
          const name = `${t.patients?.first_name ?? ""} ${t.patients?.last_name ?? ""}`.trim() || "Patient";
          const contacted = t.status === "contacted" || t.status === "completed";
          const used = channels[t.id];
          const channelClass = (c: Channel) =>
            cn(
              "h-7 w-7 rounded-full",
              contacted && used === c && "bg-success-bg text-success hover:brightness-105",
            );
          return (
            <div key={t.id} className="flex flex-wrap items-center gap-2.5 p-4">
              <div className="min-w-0 flex-1">
                <Link
                  to="/patients/$id"
                  params={{ id: t.patient_id }}
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  {name}
                </Link>
                <p className="mt-0.5 line-clamp-2 break-words text-xs text-muted-foreground">
                  {t.note ?? "Follow-up required"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {t.patients?.phone && (
                  <Button asChild size="icon" variant="ghost" className={channelClass("phone")} title="Call">
                    <a href={`tel:${t.patients.phone}`} onClick={() => contactVia(t.id, "phone", t.status)}>
                      <Phone className="h-3 w-3" />
                    </a>
                  </Button>
                )}
                {t.patients?.email && (
                  <Button asChild size="icon" variant="ghost" className={channelClass("email")} title="Email">
                    <a href={`mailto:${t.patients.email}`} onClick={() => contactVia(t.id, "email", t.status)}>
                      <Mail className="h-3 w-3" />
                    </a>
                  </Button>
                )}
                <Button asChild size="icon" variant="ghost" className={channelClass("message")} title="Message">
                  <Link
                    to="/patients/$id"
                    params={{ id: t.patient_id }}
                    onClick={() => contactVia(t.id, "message", t.status)}
                  >
                    <MessageSquare className="h-3 w-3" />
                  </Link>
                </Button>
                {t.status === "sent" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2 text-2xs"
                    disabled={update.isPending}
                    onClick={() => update.mutate({ data: { task_id: t.id, status: "contacted" } })}
                  >
                    Mark contacted
                  </Button>
                ) : t.status === "contacted" ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="inline-flex h-7 items-center gap-1 bg-success-bg px-2 text-2xs font-semibold text-success hover:brightness-105 hover:text-success"
                    disabled={update.isPending}
                    onClick={() => {
                      clearChannel(t.id);
                      update.mutate({ data: { task_id: t.id, status: "sent" } });
                    }}
                  >
                    <Check className="h-3 w-3" /> Contacted
                  </Button>
                ) : (
                  <span className="inline-flex h-7 items-center gap-1 rounded-full bg-success-bg px-2 text-2xs font-semibold text-success shadow-inset-hi">
                    <Check className="h-3 w-3" /> Contacted
                  </span>
                )}
                <Button
                  size="sm"
                  className="h-7 px-2 text-2xs"
                  disabled={update.isPending}
                  onClick={() => update.mutate({ data: { task_id: t.id, status: "completed" } })}
                >
                  Complete
                </Button>
                {can(identity, "tasks.delete") && (
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Delete task"
                    aria-label="Delete task"
                    className="h-7 w-7 text-muted-foreground hover:bg-destructive-bg hover:text-destructive"
                    onClick={() => requestDelete(t.id, name)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </Card>
      )}
    </section>
  );
}