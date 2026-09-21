import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { decidePlanPause, listPlanPauseRequests } from "@/lib/clinic.functions";
import { PatientAvatar } from "@/components/patient-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * Pause requests raised from the patient portal.
 *
 * The card hides itself when there is nothing waiting, so the dashboard only
 * grows a section when a patient actually needs an answer.
 */
export function PauseRequests() {
  const queryClient = useQueryClient();
  const fetchRequests = useServerFn(listPlanPauseRequests);
  const { data } = useQuery({
    queryKey: ["plan-pause-requests"],
    queryFn: () => fetchRequests(),
    refetchInterval: 60_000,
  });

  const decide = useMutation({
    mutationFn: useServerFn(decidePlanPause),
    onSuccess: (_res, vars: any) => {
      toast.success(vars?.data?.approve ? "Plan paused" : "Request declined");
      void queryClient.invalidateQueries({ queryKey: ["plan-pause-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["treatment-plans"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requests = data ?? [];
  if (requests.length === 0) return null;

  return (
    <Card className="rounded-2xl p-4" data-qc="pause-requests">
      <div className="mb-2.5 flex items-center gap-2">
        <PauseCircle className="h-4 w-4 text-accent-ink" aria-hidden />
        <h2 className="section-title">Pause requests</h2>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{requests.length} waiting</span>
      </div>

      <div className="space-y-2">
        {requests.map((r: any) => (
          <div key={r.id} className="rounded-xl border border-edge-2 bg-glass-2 p-3">
            <div className="flex items-center gap-2.5">
              <PatientAvatar patientId={r.patientId} name={r.patientName} photoUrl={r.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <Link
                  to="/patients/$id"
                  params={{ id: r.patientId }}
                  className="block truncate text-[13px] font-semibold hover:text-accent-ink"
                >
                  {r.patientName}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {r.planName} · {r.reason}
                </p>
              </div>
            </div>
            {r.notes && <p className="mt-2 text-xs leading-relaxed text-ink-2">{r.notes}</p>}
            <div className="mt-2.5 flex gap-2">
              <Button
                size="sm"
                className="h-7 flex-1 text-xs"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ data: { id: r.id, approve: true } })}
              >
                Approve pause
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 flex-1 text-xs"
                disabled={decide.isPending}
                onClick={() => decide.mutate({ data: { id: r.id, approve: false } })}
              >
                Decline
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
