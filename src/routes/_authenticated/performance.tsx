import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";

import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { getPractitionerPerformance, setCommissionRate } from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { can } from "@/lib/permissions";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PeriodPicker, periodRange, money, type PeriodKey } from "@/components/period-picker";
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
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<PeriodKey>("month");
  const range = useMemo(() => periodRange(period), [period]);
  const fetchPerformance = useServerFn(getPractitionerPerformance);

  const { data } = useQuery({
    queryKey: ["performance", period],
    queryFn: () => fetchPerformance({ data: range }),
    enabled: can(identity, "reports.performance"),
  });

  const saveRate = useMutation({
    mutationFn: useServerFn(setCommissionRate),
    onSuccess: () => {
      toast.success("Commission updated");
      queryClient.invalidateQueries({ queryKey: ["performance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (identity && !can(identity, "reports.performance")) navigate({ to: "/dashboard", replace: true });
  }, [identity, navigate]);

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!can(identity, "reports.performance")) return null;

  const totals = data?.totals;

  return (
    <AppShell identity={identity}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.016em] text-foreground">Performance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Earnings, retention and the clinic split. Practitioners only ever see their own share.
          </p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Total label="Earned" value={totals?.earned} hint="Treatments performed" />
        <Total label="Collected" value={totals?.collected} hint="Bookings marked paid" />
        <Total label="To practitioners" value={totals?.toPractitioners} hint="Commission payable" />
        <Total label="Retained by clinic" value={totals?.toClinic} hint="After commission" />
      </div>

      <PerformanceTrends
        trend={data?.trend}
        practitioners={(data?.rows ?? []).map((r) => ({ userId: r.userId, fullName: r.fullName }))}
      />

      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">Practitioner KPIs</h2>
          <p className="text-sm text-muted-foreground">
            Expand any row to see full figures, edit commission and view the earnings trend.
          </p>
        </div>
      </div>

      <PerformanceTable
        rows={data?.rows ?? []}
        {...(data?.clinic ? { clinic: data.clinic } : {})}
        trend={data?.trend}
        onSaveRate={(userId, rate) => saveRate.mutate({ data: { userId, rate } })}
      />

      <p className="mt-3 text-xs text-muted-foreground">
        Earned is treatment value delivered in the period; collected is booking revenue marked paid.
        Outstanding covers unpaid and deposit-only bookings. Retention is repeat patients over the last 12 months.
      </p>
    </AppShell>
  );
}

function Total({ label, value, hint }: { label: string; value: number | undefined; hint: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs tracking-[0.02em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-[22px] font-semibold tracking-[-0.016em] text-foreground">{money(value ?? 0)}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <TrendingUp className="h-3 w-3" /> {hint}
      </p>
    </Card>
  );
}
