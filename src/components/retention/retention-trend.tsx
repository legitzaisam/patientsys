import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DATE_AXIS_PADDING,
  DATE_CHART_MARGIN,
  DATE_CHART_MARGIN_FLAT,
  DateAxisTick,
  evenTickIndexes,
  labelAt,
} from "@/components/charts/axis-tick";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MonthPoint = { key: string; label: string; rate: number; active: number; returning: number };

export type TrendView = "1m" | "6m" | "1y" | "5y";

const VIEWS: { key: TrendView; label: string }[] = [
  { key: "1m", label: "1 month" },
  { key: "6m", label: "6 months" },
  { key: "1y", label: "1 year" },
  { key: "5y", label: "5 years" },
];

const SUBTITLE: Record<TrendView, string> = {
  "1m": "Weekly return rate over the last month.",
  "6m": "Monthly return rate over the last 6 months.",
  "1y": "Monthly return rate over the last year.",
  "5y": "Monthly return rate over the last 5 years.",
};

export function RetentionTrend({
  monthly,
  weekly = [],
}: {
  monthly: MonthPoint[];
  weekly?: MonthPoint[];
}) {
  const [view, setView] = useState<TrendView>("1y");

  const series = useMemo(() => {
    if (view === "1m") return weekly;
    if (view === "6m") return monthly.slice(-6);
    if (view === "1y") return monthly.slice(-12);
    return monthly.slice(-60);
  }, [monthly, weekly, view]);

  const plotted = useMemo(() => series.map((p, i) => ({ ...p, i })), [series]);
  const labels = useMemo(() => series.map((p) => p.label), [series]);
  const angled = view === "1y" || view === "5y";
  const tickIndexes = useMemo(
    () => evenTickIndexes(plotted.length, view === "5y" ? 12 : plotted.length),
    [plotted.length, view],
  );

  if (!monthly.length && !weekly.length) {
    return (
      <Card id="retention-trend" className="scroll-mt-20 p-5 text-center text-sm text-muted-foreground">
        Not enough history yet.
      </Card>
    );
  }

  return (
    <Card id="retention-trend" className="flex h-full min-h-0 scroll-mt-20 flex-col p-5">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="section-title">Retention over time</p>
          <p className="mt-1 text-xs text-muted-foreground">{SUBTITLE[view]}</p>
        </div>
        <div
          role="tablist"
          aria-label="Retention period"
          className="flex h-[34px] shrink-0 items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi"
        >
          {VIEWS.map((o) => (
            <button
              key={o.key}
              type="button"
              role="tab"
              aria-selected={view === o.key}
              onClick={() => setView(o.key)}
              className={cn(
                "h-7 cursor-pointer whitespace-nowrap rounded-full px-3.5 text-xs tracking-[0.02em] transition-colors",
                view === o.key
                  ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                  : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-[18rem] flex-1">
        {series.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Not enough history for this view.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={plotted}
              margin={angled ? DATE_CHART_MARGIN : DATE_CHART_MARGIN_FLAT}
            >
              <defs>
                <linearGradient id="retentionFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--edge-2)" vertical={false} />
              <XAxis
                type="number"
                dataKey="i"
                domain={[0, Math.max(0, plotted.length - 1)]}
                ticks={tickIndexes}
                tickLine={false}
                axisLine={false}
                tickMargin={10}
                fontSize={11}
                interval={0}
                padding={DATE_AXIS_PADDING}
                stroke="var(--muted-foreground)"
                tick={(props) => (
                  <DateAxisTick
                    {...props}
                    angled={angled}
                    label={labelAt(labels, props.payload?.value)}
                  />
                )}
              />
              <YAxis
                domain={[0, 100]}
                tickLine={false}
                axisLine={false}
                width={48}
                fontSize={11}
                stroke="var(--muted-foreground)"
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "0.875rem",
                  border: "1px solid var(--edge-2)",
                  background: "var(--popover)",
                  color: "var(--foreground)",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "var(--muted-foreground)" }}
                labelFormatter={(v) => labelAt(labels, v)}
                formatter={(v: number, _n, item: any) => [
                  `${v}% · ${item?.payload?.returning ?? 0} of ${item?.payload?.active ?? 0} patients`,
                  "Retention",
                ]}
              />
              <Area type="monotone" dataKey="rate" stroke="var(--accent-deep)" strokeWidth={2} fill="url(#retentionFill)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
