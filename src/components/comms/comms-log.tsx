import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { drainCommunications, listCommunications } from "@/lib/clinic.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  channel: string;
  purpose: string;
  to_address: string;
  subject: string | null;
  body: string;
  status: string;
  error: string | null;
  attempts: number;
  provider: string | null;
  scheduled_for: string;
  sent_at: string | null;
  created_at: string;
};

export function CommsLogCard({
  patientId,
  enabled,
  canDrain = false,
}: {
  patientId: string;
  enabled: boolean;
  canDrain?: boolean;
}) {
  const queryClient = useQueryClient();
  const fetchRows = useServerFn(listCommunications);
  const { data } = useQuery({
    queryKey: ["communications", patientId],
    queryFn: () => fetchRows({ data: { patient_id: patientId } }),
    enabled: enabled && !!patientId,
  });
  const rows = (data ?? []) as Row[];
  const drain = useMutation({
    mutationFn: useServerFn(drainCommunications),
    onSuccess: (summary: { claimed: number; sent: number; retried: number; failed: number }) => {
      toast.success(
        summary.claimed
          ? `Processed ${summary.sent} · ${summary.retried} retrying · ${summary.failed} failed`
          : "Nothing due in the outbox",
      );
      void queryClient.invalidateQueries({ queryKey: ["communications", patientId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="section-title">Email and text</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Queued until the outbox runs. Demo and sandbox mark them sent without leaving the clinic.
          </p>
        </div>
        {canDrain ? (
          <Button
            size="sm"
            variant="outline"
            disabled={drain.isPending}
            onClick={() => drain.mutate({} as never)}
          >
            {drain.isPending ? "Processing…" : "Process queue"}
          </Button>
        ) : null}
      </div>
      <ul className="mt-3 divide-y divide-glass-line">
        {rows.map((row) => (
          <li key={row.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-foreground">
                  {row.subject || (row.channel === "sms" ? "Text message" : "Email")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {row.channel.toUpperCase()} · {row.purpose} · {row.to_address}
                  {row.provider ? ` · ${row.provider}` : ""}
                  {row.attempts > 0 ? ` · ${row.attempts} attempt${row.attempts === 1 ? "" : "s"}` : ""}
                </p>
              </div>
              <Badge variant="outline" className="rounded-xl text-2xs uppercase">
                {row.status}
              </Badge>
            </div>
            {row.error ? <p className="mt-1 text-xs text-destructive">{row.error}</p> : null}
            <p className="mt-1 text-2xs text-muted-foreground">
              {row.sent_at
                ? `Sent ${new Date(row.sent_at).toLocaleString("en-GB")}`
                : `Queued ${new Date(row.created_at).toLocaleString("en-GB")}`}
            </p>
          </li>
        ))}
        {rows.length === 0 && (
          <li className="py-6 text-sm text-muted-foreground">
            Nothing queued. Emails and texts will appear here once the clinic starts sending them.
          </li>
        )}
      </ul>
    </Card>
  );
}
