import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { getInsights } from "@/lib/clinic.functions";
import { can } from "@/lib/permissions";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { CURRENT_YEAR, PeriodPicker, periodHeading, periodRange, type PeriodSelection } from "@/components/period-picker";
import { PatientMetrics } from "@/components/patients/patient-metrics";
import { ActionList } from "@/components/insights/action-list";
import { Bestsellers } from "@/components/insights/bestsellers";
import { FunnelChart } from "@/components/insights/funnel-chart";
import { FunnelTiles } from "@/components/insights/funnel-tiles";
import { SourceMix } from "@/components/insights/source-mix";
import { RouteErrorBoundary } from "@/components/route-error-boundary";

type InsightsTab = "pipeline" | "book";

export const Route = createFileRoute("/_authenticated/insights")({
  validateSearch: (search: Record<string, unknown>): { tab?: InsightsTab } => {
    return String(search?.["tab"] ?? "") === "book" ? { tab: "book" } : {};
  },
  head: () => ({
    meta: [
      { title: "Insights — Aetheria" },
      {
        name: "description",
        content: "Website funnel, consultations, bestsellers and the clinic book.",
      },
      { property: "og:title", content: "Insights — Aetheria" },
      { property: "og:description", content: "Marketing and sales insights for the clinic." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InsightsPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary error={error} reset={reset} area="insights" />,
});

function InsightsPage() {
  const { data: identity } = useIdentity();
  const navigate = useNavigate();
  const { tab = "pipeline" } = Route.useSearch();
  const [period, setPeriod] = useState<PeriodSelection>(CURRENT_YEAR);
  const range = useMemo(() => periodRange(period), [period]);
  const fetchInsights = useServerFn(getInsights);
  const allowed = Boolean(identity && can(identity, "reports.insights"));

  const { data } = useQuery({
    queryKey: ["insights", range.from, range.to],
    queryFn: () => fetchInsights({ data: range }),
    enabled: allowed && tab === "pipeline",
  });

  useEffect(() => {
    if (identity && !can(identity, "reports.insights")) navigate({ to: "/dashboard", replace: true });
  }, [identity, navigate]);

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!can(identity, "reports.insights")) return null;
  const canSendOffers = can(identity, "comms.send");

  return (
    <AppShell identity={identity}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Insights</h1>
          <p className="page-subtitle">
            {tab === "book"
              ? "List size, mix and quality — not a recall list."
              : "New enquiries, who still needs a booking, and what sold."}
          </p>
        </div>
        <div className="flex h-[34px] items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi">
          {(
            [
              { key: "pipeline", label: "Pipeline" },
              { key: "book", label: "Book" },
            ] as { key: InsightsTab; label: string }[]
          ).map((item) => (
            <Link
              key={item.key}
              to="/insights"
              search={item.key === "book" ? { tab: "book" } : {}}
              className={`flex h-7 cursor-pointer items-center rounded-full px-3.5 text-xs tracking-[0.02em] transition-colors ${
                tab === item.key
                  ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                  : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {tab === "book" ? (
        <PatientMetrics />
      ) : (
        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="section-title">{periodHeading(period)}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sign-ups, bookings, consultations and first treatments.
                </p>
              </div>
              <div className="shrink-0">
                <PeriodPicker value={period} onChange={setPeriod} />
              </div>
            </div>
            <FunnelTiles funnel={data?.funnel} />
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <FunnelChart monthly={data?.monthly} />
              <SourceMix sources={data?.sources} />
            </div>
          </section>

          <section>
            <div className="mb-3">
              <h2 className="section-title">Needs a next step</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                People who signed up in this window and still need a first booking or a first treatment.
                {canSendOffers
                  ? " Send offer uses the Pre-consultation and Post-consultation templates from Offers, or any one-off template."
                  : ""}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ActionList
                title="Waiting for a first booking"
                subtitle="Signed up in this window and have no appointment yet. Maps to the Pre-consultation offer."
                rows={data?.waiting ?? []}
                empty="Everyone who signed up in this window has a booking."
                kind="waiting"
                canSendOffers={canSendOffers}
              />
              <ActionList
                title="Consulted, no treatment yet"
                subtitle="Had a consultation but no treatment on file. Maps to the Post-consultation offer."
                rows={data?.consultedNoTreatment ?? []}
                empty="No consulted patients are waiting on a first treatment."
                kind="consulted"
                canSendOffers={canSendOffers}
              />
            </div>
          </section>

          <section>
            <div className="mb-3">
              <h2 className="section-title">What sold</h2>
              <p className="mt-1 text-sm text-muted-foreground">Treatments and retail products in this window.</p>
            </div>
            <Bestsellers data={data?.bestsellers} />
          </section>
        </div>
      )}
    </AppShell>
  );
}
