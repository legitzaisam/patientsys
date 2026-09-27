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
import { SuggestedActions, type Suggestion } from "@/components/retention/suggested-actions";
import { RetentionBreakdown, type BreakdownTab } from "@/components/retention/retention-breakdown";
import type { RiskLevel } from "@/components/retention/risk-badge";
import { RouteErrorBoundary } from "@/components/route-error-boundary";
import {
  CURRENT_YEAR,
  PeriodPicker,
  periodPhrase,
  periodRange,
  type PeriodSelection,
} from "@/components/period-picker";
import { moneyWhole } from "@/lib/format";

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
    // min-w-0: a long hint must not widen the grid column on phones; the hint
    // wraps rather than truncating, so the window it names is always readable.
    <Card className="min-w-0 p-5">
      <p className="text-xs tracking-[0.02em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-[22px] font-semibold tracking-[-0.016em] text-foreground">{value}</p>
      <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
        {trending && <TrendIcon className="mt-0.5 h-3 w-3 shrink-0" />}
        <span className="min-w-0 break-words">
          {hint}
          {trending && (
            <span className="ml-1 whitespace-nowrap tabular-nums">
              · {change > 0 ? "up" : "down"} {Math.abs(change)} pts since the period began
            </span>
          )}
        </span>
      </p>
    </Card>
  );
}

function RetentionPage() {
  const { data: identity } = useIdentity();
  const queryClient = useQueryClient();
  const fetchRetention = useServerFn(getRetention);
  const [filter, setFilter] = useState<RiskLevel | "all">("all");
  const [breakdownTab, setBreakdownTab] = useState<BreakdownTab>("cohorts");
  const [period, setPeriod] = useState<PeriodSelection>(CURRENT_YEAR);
  const range = periodRange(period);

  function onInsight(suggestion: Suggestion) {
    setFilter(suggestion.filter);
    if (suggestion.target?.tab) setBreakdownTab(suggestion.target.tab);
    const section = suggestion.target?.section ?? "at-risk";
    const id =
      section === "trend"
        ? "retention-trend"
        : section === "breakdown"
          ? "retention-breakdown"
          : "retention-at-risk";
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const { data } = useQuery({
    queryKey: ["retention", range.from, range.to, period.key],
    queryFn: () => fetchRetention({ data: { from: range.from, to: range.to, key: period.key } }),
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
  // Every card names its window, so "last 12 months" and "this month" are never mixed up.
  const phrase = periodPhrase(period);
  const trendSubtitle =
    period.key === "year" ? `Monthly return rate ${phrase}.` : `Weekly return rate ${phrase}.`;

  return (
    <AppShell identity={identity}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Retention</h1>
          <p className="page-subtitle">
            {ownBookOnly
              ? "How well you keep your own patients, and who needs a nudge."
              : "How well the clinic keeps patients, who is slipping away and what to do next."}
          </p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Retention rate"
          value={`${s?.rate ?? 0}%`}
          hint={`${s?.returningInWindow ?? 0} of ${s?.activeInWindow ?? 0} seen in the last 12 months`}
          change={s?.change ?? 0}
        />
        <Stat
          label="One visit only"
          value={`${s?.oneVisitPatients ?? 0}`}
          hint={`${s?.repeatPatients ?? 0} repeat patients seen ${phrase}`}
        />
        <Stat
          label="Average visits"
          value={`${s?.averageVisits ?? 0}`}
          hint={`Per patient seen ${phrase}`}
        />
        <Stat
          label="Revenue at risk"
          value={moneyWhole(s?.revenueAtRisk ?? 0)}
          hint={`Lifetime spend of the at-risk patients whose last visit was ${phrase}`}
        />
      </div>

      <div className="mb-6 grid items-stretch gap-4 lg:grid-cols-[1fr_380px]">
        <RetentionTrend points={data?.trend ?? []} subtitle={trendSubtitle} />
        <SuggestedActions suggestions={data?.suggestions ?? []} onPick={onInsight} />
      </div>

      <div className="mb-6">
        <AtRiskTable
          rows={data?.atRisk ?? []}
          filter={filter}
          onFilterChange={setFilter}
          canAssign={!!identity.isManager}
          pendingId={contact.isPending ? (contact.variables as any)?.data?.patient_id : null}
          onContacted={(patientId) =>
            contact.mutate({ data: { patient_id: patientId, channel: "manual" } })
          }
        />
      </div>

      <div className="mb-6">
        <RetentionBreakdown
          cohorts={data?.cohorts ?? []}
          byTreatment={data?.byTreatment ?? []}
          byPractitioner={data?.byPractitioner ?? []}
          tab={breakdownTab}
          onTabChange={setBreakdownTab}
        />
      </div>
    </AppShell>
  );
}
