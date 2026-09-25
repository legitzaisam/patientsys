import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { TrendingDown, TrendingUp } from "lucide-react";
import { getPractitionerPerformance } from "@/lib/clinic.functions";
import { can } from "@/lib/permissions";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { CURRENT_YEAR, PeriodPicker, periodRange, previousPeriodRange, money, type PeriodSelection } from "@/components/period-picker";
import { PerformanceTrends } from "@/components/performance-trends";
import { PerformanceTable } from "@/components/performance/performance-table";
import { RouteErrorBoundary } from "@/components/route-error-boundary";

export const Route = createFileRoute("/_authenticated/performance")({
  head: () => ({
    meta: [
      { title: "Performance — Aetheria" },
      {
        name: "description",
        content: "Earnings, retention and commission split for every practitioner in the clinic.",
      },
      { property: "og:title", content: "Performance — Aetheria" },
      { property: "og:description", content: "Earnings, KPIs and commission split per practitioner." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PerformancePage,
  errorComponent: ({ error, reset }) => (
    <RouteErrorBoundary error={error} reset={reset} area="performance" />
  ),
});

function PerformancePage() {
  const { data: identity } = useIdentity();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodSelection>(CURRENT_YEAR);
  const range = useMemo(() => periodRange(period), [period]);
  const previous = useMemo(() => previousPeriodRange(period), [period]);
  const fetchPerformance = useServerFn(getPractitionerPerformance);

  const { data } = useQuery({
    queryKey: ["performance", range.from, range.to],
    queryFn: () =>
      fetchPerformance({
        data: { ...range, previousFrom: previous.from, previousTo: previous.to },
      }),
    enabled: Boolean(identity && can(identity, "reports.performance")),
  });

  useEffect(() => {
    if (identity && !can(identity, "reports.performance")) navigate({ to: "/dashboard", replace: true });
  }, [identity, navigate]);

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!can(identity, "reports.performance")) return null;

  const totals = data?.totals;

  return (
    <AppShell identity={identity}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Performance</h1>
          <p className="page-subtitle">
            Earnings and collections for the clinic, then a breakdown by practitioner.
          </p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Total label="Earned" value={totals?.earned} hint="Treatments performed" change={data?.changes?.earned} />
          <Total label="Collected" value={totals?.collected} hint="Bookings marked paid" change={data?.changes?.collected} />
          <Total label="To practitioners" value={totals?.toPractitioners} hint="Commission payable" change={data?.changes?.toPractitioners} />
          <Total label="Retained by clinic" value={totals?.toClinic} hint="After commission" change={data?.changes?.toClinic} />
      </div>

      <PerformanceTrends
        trend={data?.trend}
        {...(data?.trendViews ? { trendViews: data.trendViews } : {})}
        practitioners={(data?.rows ?? []).map((r) => ({ userId: r.userId, fullName: r.fullName }))}
      />

      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="section-title">Practitioner KPIs</h2>
          <p className="text-sm text-muted-foreground">
            Expand a row for cash collected, outstanding balances, and activity. Edit commission under Team.
          </p>
        </div>
      </div>

      <PerformanceTable
        rows={data?.rows ?? []}
        {...(data?.clinic ? { clinic: data.clinic } : {})}
        trend={data?.trend}
      />

      <p className="mt-3 rounded-2xl border border-edge bg-glass-2 px-4 py-3 text-xs leading-relaxed text-muted-foreground shadow-inset-hi">
        <span className="font-medium text-foreground">How to read this.</span> Earned is treatment
        value delivered; collected is booking revenue marked paid. Outstanding covers unpaid and
        deposit-only bookings. Retention is repeat patients over the last 12 months.
      </p>
    </AppShell>
  );
}

function Total({
  label,
  value,
  hint,
  change,
}: {
  label: string;
  value: number | undefined;
  hint: string;
  change: number | undefined;
}) {
  const delta = change ?? 0;
  const TrendIcon = delta < 0 ? TrendingDown : TrendingUp;
  const trendClass =
    delta > 0 ? "text-success-ink" : delta < 0 ? "text-destructive-ink" : "text-ink-3";

  return (
    <Card className="p-5">
      <p className="text-xs tracking-[0.02em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-[22px] font-semibold tracking-[-0.016em] text-foreground">{money(value ?? 0)}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        {delta !== 0 ? <TrendIcon className={`h-3 w-3 ${trendClass}`} /> : null}
        {hint}
      </p>
    </Card>
  );
}
