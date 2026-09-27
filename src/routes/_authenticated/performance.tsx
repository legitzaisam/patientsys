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
import {
  CURRENT_YEAR,
  PeriodPicker,
  periodPhrase,
  periodRange,
  previousPeriodRange,
  type PeriodSelection,
} from "@/components/period-picker";
import { PerformanceTrends } from "@/components/performance-trends";
import { PerformanceTable } from "@/components/performance/performance-table";
import { Bestsellers } from "@/components/insights/bestsellers";
import { RouteErrorBoundary } from "@/components/route-error-boundary";
import { InfoHint } from "@/components/info-hint";
import { moneyWhole } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/performance")({
  head: () => ({
    meta: [
      { title: "Performance — Aetheria" },
      {
        name: "description",
        content: "Earnings, retention and commission split for every practitioner in the clinic.",
      },
      { property: "og:title", content: "Performance — Aetheria" },
      {
        property: "og:description",
        content: "Earnings, KPIs and commission split per practitioner.",
      },
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
    if (identity && !can(identity, "reports.performance"))
      navigate({ to: "/dashboard", replace: true });
  }, [identity, navigate]);

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!can(identity, "reports.performance")) return null;

  const totals = data?.totals;
  const phrase = periodPhrase(period);
  // Money and commission need reports.commission (owners always have it); the
  // server strips the figures for anyone else, so this only decides the layout.
  const showMoney = can(identity, "reports.commission");
  const sold = data?.sold ?? null;

  return (
    <AppShell identity={identity}>
      <div className="page-header">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="page-title">Performance</h1>
            <InfoHint label="How to read these figures">
              <span className="font-medium text-foreground">Earned</span> is the value of treatments
              performed in the period.{" "}
              <span className="font-medium text-foreground">Collected</span> is the part of that
              already paid; a deposit counts as its share.{" "}
              <span className="font-medium text-foreground">Outstanding</span> is Earned minus
              Collected. <span className="font-medium text-foreground">Booked ahead</span> is the
              value of future bookings and is not counted in any of these.{" "}
              <span className="font-medium text-foreground">Retention</span> is repeat patients over
              the last 12 months. Changes compare with the period before this one.
            </InfoHint>
          </div>
          <p className="page-subtitle">
            {showMoney
              ? "Earnings and collections for the clinic, then a breakdown by practitioner."
              : "Activity, attendance and retention by practitioner. Money figures need the commission permission."}
          </p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      {showMoney ? (
        <>
          <div className="mb-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Total
              label="Earned"
              value={totals?.earned}
              hint={`Treatments performed ${phrase}`}
              change={data?.changes?.earned}
              metric="performance.earned"
            />
            <Total
              label="Collected"
              value={totals?.collected}
              hint="Paid so far"
              change={data?.changes?.collected}
              metric="performance.collected"
            />
            <Total
              label="To practitioners"
              value={totals?.toPractitioners}
              hint="Their share of Earned"
              change={data?.changes?.toPractitioners}
            />
            <Total
              label="Retained by clinic"
              value={totals?.toClinic}
              hint="Earned after their share"
              change={data?.changes?.toClinic}
            />
          </div>
          <p className="mb-8 text-xs text-muted-foreground" data-qc="performance-booked-ahead">
            <span className="font-medium text-foreground">Outstanding</span>{" "}
            <span data-qc="metric:performance.outstanding">
              {moneyWhole(totals?.outstanding ?? 0)}
            </span>{" "}
            still to collect on treatments performed ·{" "}
            <span className="font-medium text-foreground">Booked ahead</span>{" "}
            <span data-qc="metric:performance.bookedAhead">
              {moneyWhole(totals?.bookedAhead ?? 0)}
            </span>{" "}
            in future bookings, not counted above
            {sold ? (
              <span data-qc="performance-retail-share">
                {" · "}
                <span className="font-medium text-foreground">Retail</span>{" "}
                {moneyWhole(sold.retail.revenue)} ({sold.retail.share}% of treatment and retail
                revenue {phrase})
              </span>
            ) : null}
            .
          </p>
        </>
      ) : null}

      <PerformanceTrends
        trend={data?.trend}
        periodPhrase={phrase}
        practitioners={(data?.rows ?? []).map((r) => ({ userId: r.userId, fullName: r.fullName }))}
        showMoney={showMoney}
      />

      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="section-title">Practitioner KPIs</h2>
            <InfoHint label="How to read the practitioner rows">
              Each row is one practitioner over the selected period. Expand it for cash collected,
              outstanding balances and activity. Retention is repeat patients over the last 12
              months. Commission rates are edited under Team.
            </InfoHint>
          </div>
          <p className="text-sm text-muted-foreground">
            Expand a row for cash collected, outstanding balances, and activity.
          </p>
        </div>
      </div>

      <PerformanceTable
        rows={data?.rows ?? []}
        {...(data?.clinic ? { clinic: data.clinic } : {})}
        trend={data?.trend}
        showMoney={showMoney}
      />

      {showMoney && sold ? (
        <section className="mt-8" data-qc="performance-what-sold">
          <div className="mb-3">
            <h2 className="section-title">What sold</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Treatments and retail products {phrase}, ranked by revenue.
            </p>
          </div>
          <Bestsellers data={{ treatments: sold.treatments, products: sold.products }} />
        </section>
      ) : null}
    </AppShell>
  );
}

function Total({
  label,
  value,
  hint,
  change,
  metric,
}: {
  label: string;
  value: number | undefined;
  hint: string;
  change: number | undefined;
  /** Snapshot id for the rendered-number check. */
  metric?: string;
}) {
  const delta = change ?? 0;
  const TrendIcon = delta < 0 ? TrendingDown : TrendingUp;
  const trendClass =
    delta > 0 ? "text-success-ink" : delta < 0 ? "text-destructive-ink" : "text-ink-3";

  return (
    <Card className="p-5">
      <p className="text-xs tracking-[0.02em] text-muted-foreground">{label}</p>
      <p
        className="mt-2 text-[22px] font-semibold tracking-[-0.016em] text-foreground"
        data-qc={metric ? `metric:${metric}` : undefined}
      >
        {moneyWhole(value ?? 0)}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      {/* `change` is a £ difference against the period before this one, so it is shown as money. */}
      {delta !== 0 ? (
        <p className={`mt-1 flex items-center gap-1 text-xs tabular-nums ${trendClass}`}>
          <TrendIcon className="h-3 w-3 shrink-0" />
          {moneyWhole(Math.abs(delta))} {delta > 0 ? "more" : "less"} than the previous period
        </p>
      ) : null}
    </Card>
  );
}
