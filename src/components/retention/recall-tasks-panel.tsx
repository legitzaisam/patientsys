import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, PhoneCall, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listRecallTasks, setRecallTaskStatus } from "@/lib/clinic.functions";
import { cn } from "@/lib/utils";

type Status = "sent" | "contacted" | "completed";

const STATUS: Record<Status, { label: string; className: string }> = {
  sent: { label: "Sent", className: "bg-glass-2 text-foreground" },
  contacted: { label: "Contacted", className: "bg-sky-bg text-arrived-ink" },
  completed: { label: "Completed", className: "bg-success-bg text-success" },
};

const STEPS: { key: Status; label: string; icon: typeof Send }[] = [
  { key: "sent", label: "Sent", icon: Send },
  { key: "contacted", label: "Contacted", icon: PhoneCall },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
];

function when(value: string | null) {
  return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }) : null;
}

/** Recall tasks for a patient, with a sent → contacted → completed tracker. */
export function RecallTasksPanel({ patientId }: { patientId: string }) {
  const queryClient = useQueryClient();
  const fetchTasks = useServerFn(listRecallTasks);
  const setStatus = useServerFn(setRecallTaskStatus);

  const { data: tasks } = useQuery({
    queryKey: ["recall-tasks", patientId],
    queryFn: () => fetchTasks({ data: { patient_id: patientId } }),
  });

  const update = useMutation({
    mutationFn: (vars: { task_id: string; status: Status }) => setStatus({ data: vars }),
    onSuccess: (_r, vars) => {
      toast.success(`Recall task marked ${STATUS[vars.status].label.toLowerCase()}`);
      queryClient.invalidateQueries({ queryKey: ["recall-tasks", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = (tasks as any[]) ?? [];
  // Tasks sent to several people share a group: show them as one chase-up.
  const groups = Object.values(
    rows.reduce<Record<string, any[]>>((acc, t) => {
      const key = (t.group_id as string) ?? (t.id as string);
      (acc[key] ??= []).push(t);
      return acc;
    }, {}),
  );

  if (groups.length === 0) {
    return (
      <Card className="mt-4 p-5">
        <h3 className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">Recall tasks</h3>
        <p className="text-xs text-muted-foreground">
          No recall tasks yet. Assign one from the Retention page by hovering a patient's
          practitioner.
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-4 p-5">
      <h3 className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">Recall tasks</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Chase-ups assigned to the team, tracked from sent through to completed.
      </p>
      <ul className="divide-y divide-glass-line">
        {groups.map((group) => {
          const t = group[0];
          const status = t.status as Status;
          const assignees = group
            .map((g: any) => g.assigned_label)
            .filter(Boolean)
            .join(" · ");
          return (
            <li key={t.group_id ?? t.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm text-foreground">
                    {assignees ? `Assigned to ${assignees}` : "Assigned to the team"}
                  </p>
                  <p className="text-2xs text-muted-foreground">
                    Created {when(t.created_at)}
                    {t.contacted_at ? ` · contacted ${when(t.contacted_at)}` : ""}
                    {t.completed_at ? ` · completed ${when(t.completed_at)}` : ""}
                    {t.status_by_label && status !== "sent"
                      ? ` · marked by ${t.status_by_label}`
                      : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-2xs font-medium",
                    STATUS[status]?.className,
                  )}
                >
                  {STATUS[status]?.label ?? status}
                </span>
              </div>
              {t.note && <p className="mt-1 text-xs text-foreground/80">{t.note}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
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
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
