import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { TrendingDown, TrendingUp, PoundSterling } from "lucide-react";
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
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  change?: number;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium tracking-[0.02em] text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className="mt-3 text-[22px] font-semibold tracking-[-0.016em] text-foreground">{value}</p>
      <div className="mt-2 flex items-center gap-2">
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {!!change && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-2xs font-medium ${
              change > 0 ? "bg-success-bg text-success" : "bg-destructive-bg text-destructive"
            }`}
          >
            {change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(change)}%
          </span>
        )}
      </div>
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
        <h1 className="text-[22px] font-semibold tracking-[-0.016em] text-foreground">Retention</h1>
        <p className="mt-1 text-sm text-muted-foreground">
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
        <Stat
          label="Revenue at risk"
          value={money(s?.revenueAtRisk ?? 0)}
          hint="From at-risk or lost patients"
          icon={<PoundSterling className="h-4 w-4" />}
        />
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
