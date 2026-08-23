import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { TrendingDown, TrendingUp } from "lucide-react";
import { getRetention, logRetentionOutreach } from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { RetentionTrend } from "@/components/retention/retention-trend";
import { AtRiskTable } from "@/components/retention/at-risk-table";
import { SuggestedActions } from "@/components/retention/suggested-actions";
import { RetentionBreakdown } from "@/components/retention/retention-breakdown";
import type { RiskLevel } from "@/components/retention/risk-badge";
import { RouteErrorBoundary } from "@/components/route-error-boundary";
import { money } from "@/components/period-picker";

export const Route = createFileRoute("/_authenticated/retention")({
  head: () => ({
    meta: [
      { title: "Retention — Aetheria" },
      {
        name: "description",
        content: "See which patients are lapsing, how retention is trending and what to do about it.",
      },
      { property: "og:title", content: "Retention — Aetheria" },
      { property: "og:description", content: "Retention trends, at-risk patients and recall actions." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RetentionPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary error={error} reset={reset} area="retention" />,
});

function Stat({
  label,
  value,
  hint,
  change,
}: {
  label: string;
  value: string;
  hint?: string;
  change?: number;
}) {
  const trending = typeof change === "number" && change !== 0;
  const TrendIcon = change && change < 0 ? TrendingDown : TrendingUp;
  return (
    <Card className="p-5">
      <p className="text-xs tracking-[0.02em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-[22px] font-semibold tracking-[-0.016em] text-foreground">{value}</p>
      <p className="mt-1 flex items-center gap-1 overflow-hidden text-xs text-muted-foreground">
        {trending && <TrendIcon className="h-3 w-3 shrink-0" />}
        <span className="min-w-0 truncate">{hint}</span>
        {trending && <span className="shrink-0 tabular-nums">{Math.abs(change)}%</span>}
      </p>
    </Card>
  );
}

function RetentionPage() {
  const { data: identity } = useIdentity();
  const queryClient = useQueryClient();
  const fetchRetention = useServerFn(getRetention);
  const [filter, setFilter] = useState<RiskLevel | "all">("all");

  const { data } = useQuery({
    queryKey: ["retention"],
    queryFn: () => fetchRetention(),
    enabled: !!identity?.isStaff,
  });

  const contact = useMutation({
    mutationFn: useServerFn(logRetentionOutreach),
    onSuccess: () => {
      toast.success("Marked as contacted");
      queryClient.invalidateQueries({ queryKey: ["retention"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;

  /** Matches the server: only practitioners see a book scoped to themselves. */
  const ownBookOnly = !identity.isManager && identity.roles.includes("practitioner");
  const s = data?.summary;

  return (
    <AppShell identity={identity}>
      <div className="mb-6">
        <h1 className="page-title">Retention</h1>
        <p className="page-subtitle">
          {ownBookOnly
            ? "How well you keep your own patients, and who needs a nudge."
            : "How well the clinic keeps patients, who is slipping away and what to do next."}
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Retention rate"
          value={`${s?.rate ?? 0}%`}
          hint={`${s?.returningInWindow ?? 0} of ${s?.activeInWindow ?? 0} seen in 12 months`}
          change={s?.change ?? 0}
        />
        <Stat
          label="One visit only"
          value={`${s?.oneVisitPatients ?? 0}`}
          hint={`${s?.repeatPatients ?? 0} repeat patients`}
        />
        <Stat label="Average visits" value={`${s?.averageVisits ?? 0}`} hint="Per patient, all time" />
        <Stat label="Revenue at risk" value={money(s?.revenueAtRisk ?? 0)} hint="From at-risk or lost patients" />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_380px]">
        <RetentionTrend monthly={data?.monthly ?? []} />
        <SuggestedActions suggestions={data?.suggestions ?? []} onPick={setFilter} />
      </div>

      <div className="mb-6">
        <AtRiskTable
          rows={data?.atRisk ?? []}
          filter={filter}
          onFilterChange={setFilter}
          canAssign={!!identity.isManager}
          pendingId={contact.isPending ? (contact.variables as any)?.data?.patient_id : null}
          onContacted={(patientId) => contact.mutate({ data: { patient_id: patientId, channel: "manual" } })}
        />
      </div>

      <div className="mb-6">
        <RetentionBreakdown cohorts={data?.cohorts ?? []} byTreatment={data?.byTreatment ?? []} />
      </div>
    </AppShell>
  );
}
