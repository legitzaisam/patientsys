import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getInsightsIngestKeyStatus, rotateInsightsIngestKey } from "@/lib/clinic.functions";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { DEMO_INSIGHTS_INGEST_KEY } from "@/lib/insights-constants";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function InsightsIntegrationsSettings() {
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getInsightsIngestKeyStatus);
  const { data } = useQuery({ queryKey: ["insights-ingest-key"], queryFn: () => fetchStatus() });
  const [revealed, setRevealed] = useState<string | null>(DEMO_MODE ? DEMO_INSIGHTS_INGEST_KEY : null);

  const rotate = useMutation({
    mutationFn: useServerFn(rotateInsightsIngestKey),
    onSuccess: (result) => {
      setRevealed(result.raw);
      queryClient.invalidateQueries({ queryKey: ["insights-ingest-key"] });
      toast.success("Ingest key generated. Copy it now — it will not be shown again.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="p-5">
      <h2 className="section-title">Integrations</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Website providers post leads and product sales to{" "}
        <code className="text-xs">POST /api/insights/events</code> with this clinic key.
      </p>
      <div className="mt-4 rounded-xl border border-edge bg-glass-2 p-4 shadow-inset-hi">
        <p className="text-xs text-muted-foreground">Ingest key</p>
        {revealed ? (
          <p className="mt-1 break-all font-mono text-sm text-foreground">{revealed}</p>
        ) : (
          <p className="mt-1 text-sm text-foreground">
            {data?.configured ? `Configured · ending ${data.last4}` : "Not configured yet"}
          </p>
        )}
        {DEMO_MODE && (
          <p className="mt-2 text-2xs text-muted-foreground">
            Demo fixture key is visible so the funnel can be populated without a live website.
          </p>
        )}
      </div>
      <div className="mt-4">
        <Button type="button" onClick={() => rotate.mutate(undefined as never)} disabled={rotate.isPending}>
          {data?.configured ? "Rotate key" : "Generate key"}
        </Button>
      </div>
    </Card>
  );
}
