import { useMemo } from "react";
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

export type MonthPoint = { key: string; label: string; rate: number; active: number; returning: number };

/**
 * Rolling return rate across the page's selected period. The period itself is
 * chosen by the page-level picker, so this card carries no control of its own.
 */
export function RetentionTrend({ points, subtitle }: { points: MonthPoint[]; subtitle: string }) {
  const plotted = useMemo(() => points.map((p, i) => ({ ...p, i })), [points]);
  const labels = useMemo(() => points.map((p) => p.label), [points]);
  const angled = points.length > 6;
  const tickIndexes = useMemo(
    () => evenTickIndexes(plotted.length, Math.min(12, plotted.length)),
    [plotted.length],
  );

  if (!points.length) {
    return (
      <Card id="retention-trend" className="scroll-mt-20 p-5 text-center text-sm text-muted-foreground">
        Not enough history yet.
      </Card>
    );
  }

  return (
    <Card id="retention-trend" className="flex h-full min-h-0 scroll-mt-20 flex-col p-5">
      <div className="mb-4">
        <p className="section-title">Retention over time</p>
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <div className="min-h-[18rem] flex-1">
        {plotted.length === 0 ? (
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
