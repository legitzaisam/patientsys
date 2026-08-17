import { Link } from "@tanstack/react-router";
import { TrendingDown, TrendingUp, Users, Calendar, PoundSterling, Repeat, ArrowRight } from "lucide-react";

export function KpiGrid({
  kpis,
  canRetention = true,
  canRevenue = true,
}: {
  kpis: any;
  canRetention?: boolean;
  canRevenue?: boolean;
}) {
  const items = [
    ...(canRetention
      ? [
    {
      label: "Retention rate",
      value: `${kpis?.retention ?? 0}%`,
      hint: `${kpis?.repeatClients ?? 0} returning · ${kpis?.oneVisitClients ?? 0} one visit only`,
      icon: Repeat,
      change: kpis?.retentionChange ?? 0,
      accent: true,
      to: "/retention",
    },
        ]
      : []),
    {
      label: "Total clients",
      value: kpis?.totalClients ?? "—",
      hint: `${kpis?.activeClients ?? 0} active · ${kpis?.inactiveClients ?? 0} inactive`,
      icon: Users,
      change: kpis?.patientChange ?? 0,
      to: "/patients",
      search: { view: "all" },
    },
    {
      label: "Treatments due",
      value: kpis?.treatmentsDue ?? "—",
      hint: "Next 30 days",
      icon: Calendar,
      change: null,
      to: "/patients",
      search: { view: "due" },
    },
    ...(canRevenue
      ? [
    {
      label: "Revenue this month",
      value: `£${(kpis?.revenueMonth ?? 0).toLocaleString()}`,
      hint: `${kpis?.treatmentsMonth ?? 0} treatment${(kpis?.treatmentsMonth ?? 0) === 1 ? "" : "s"} delivered`,
      icon: PoundSterling,
      change: kpis?.revenueChange ?? 0,
      to: "/performance",
    },
        ]
      : []),
  ] as any[];

  const cols =
    items.length >= 4 ? "lg:grid-cols-4" : items.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";

  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${cols}`}>
      {items.map((item) => {
        const body = (
          <>
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
            {"to" in item && item.to ? (
              <ArrowRight className="h-4 w-4 text-accent-ink" aria-hidden />
            ) : (
              <item.icon className={`h-4 w-4 ${item.accent ? "text-accent-ink" : "text-ink-3"}`} />
            )}
          </div>
          <p
            className={`mt-2.5 text-[27px] font-semibold leading-none tracking-[-0.02em] tabular-nums ${
              item.accent ? "text-accent-ink" : "text-foreground"
            }`}
          >
            {item.value}
          </p>
          {item.hint && <p className="mt-2 text-2xs text-muted-foreground">{item.hint}</p>}
          {item.change !== null && item.change !== 0 && (
            <div className="mt-2.5">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold shadow-inset-hi ${
                  item.change > 0 ? "bg-success-bg text-success" : "bg-destructive-bg text-destructive"
                }`}
              >
                {item.change > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {item.change > 0 ? "+" : "−"}
                {Math.abs(item.change)}%
              </span>
            </div>
          )}
          </>
        );
        const className =
          "glass-card block p-[18px] text-left transition-shadow hover:shadow-lift";
        return "to" in item && item.to ? (
          <Link key={item.label} to={item.to} search={item.search ?? {}} className={className}>
            {body}
          </Link>
        ) : (
          <div key={item.label} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
