import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DATE_AXIS_PADDING,
  DateAxisTick,
  evenTickIndexes,
  labelAt,
} from "@/components/charts/axis-tick";
import { Card } from "@/components/ui/card";
import { money } from "@/components/period-picker";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type TrendPoint = {
  key: string;
  label: string;
  earned: number;
  collected: number;
  appointments: number;
  attended: number;
  noShows: number;
  attendance: number;
};

export type TrendViewKey = "month" | "six" | "year";

type TrendBundle = {
  monthly: boolean;
  clinic: TrendPoint[];
  byPractitioner: Record<string, TrendPoint[]>;
};

type Props = {
  trend: TrendBundle | undefined;
  trendViews?: Partial<Record<TrendViewKey, TrendBundle>>;
  practitioners: { userId: string; fullName: string }[];
};

const TREND_VIEWS: { key: TrendViewKey; label: string }[] = [
  { key: "month", label: "1 month" },
  { key: "six", label: "6 months" },
  { key: "year", label: "1 year" },
];

const TREND_HINT: Record<TrendViewKey, string> = {
  month: "By day over the last month",
  six: "By month over the last 6 months",
  year: "By month over the last year",
};

const axis = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
};

/** Room for angled dates below the axis; extra right inset shifts the plot left. */
const PERF_CHART_MARGIN = { top: 4, right: 22, left: 0, bottom: 30 };

function ChartCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <p className="section-title">{title}</p>
      <p className="mb-4 text-xs text-muted-foreground">{hint}</p>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function tooltipStyle() {
  return {
    contentStyle: {
      borderRadius: "0.875rem",
      border: "1px solid var(--edge-2)",
      background: "var(--popover)",
      color: "var(--foreground)",
      fontSize: "12px",
    },
    labelStyle: { color: "var(--muted-foreground)" },
  };
}

export function PerformanceTrends({ trend, trendViews, practitioners }: Props) {
  const [who, setWho] = useState<string>("clinic");
  const [view, setView] = useState<TrendViewKey>("month");

  const active = trendViews?.[view] ?? trend;

  const data = useMemo(() => {
    if (!active) return [];
    return who === "clinic" ? active.clinic : (active.byPractitioner[who] ?? []);
  }, [active, who]);

  const empty = data.length === 0;
  const plotted = useMemo(() => data.map((p, i) => ({ ...p, i })), [data]);
  const labels = useMemo(() => data.map((p) => p.label), [data]);
  const tickIndexes = useMemo(
    () => evenTickIndexes(plotted.length, plotted.length > 12 ? 10 : plotted.length),
    [plotted.length],
  );

  const dateAxis = {
    type: "number" as const,
    dataKey: "i",
    domain: [0, Math.max(0, plotted.length - 1)] as [number, number],
    ticks: tickIndexes,
    tickLine: false,
    axisLine: false,
    tickMargin: 16,
    interval: 0,
    padding: DATE_AXIS_PADDING,
    ...axis,
    stroke: "var(--muted-foreground)",
    tick: (props: { x?: number; y?: number; payload?: { value?: string | number } }) => (
      <DateAxisTick {...props} offset={18} label={labelAt(labels, props.payload?.value)} />
    ),
  };

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="section-title">Trends</h2>
        </div>
        <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">
          <div
            role="tablist"
            aria-label="Trend period"
            className="flex h-[34px] items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi"
          >
            {TREND_VIEWS.map((o) => (
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
          <Select value={who} onValueChange={setWho}>
            <SelectTrigger className="h-9 w-[240px]" aria-label="Choose whose trends to show">
              <SelectValue placeholder="Clinic total" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="clinic">Clinic total</SelectItem>
              {practitioners.length > 0 && (
                <SelectGroup>
                  <SelectLabel>Practitioners</SelectLabel>
                  {practitioners.map((p) => (
                    <SelectItem key={p.userId} value={p.userId}>
                      {p.fullName}
                    </SelectItem>
                  ))}
                </SelectGroup>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">
        {TREND_HINT[view]} — clinic total or a single practitioner.
      </p>

      {empty ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No activity in this period yet.
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <ChartCard title="Earnings" hint="Treatment value earned and booking revenue collected">
            <AreaChart data={plotted} margin={PERF_CHART_MARGIN}>
              <defs>
                <linearGradient id="earnedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--edge-2)" vertical={false} />
              <XAxis {...dateAxis} />
              <YAxis tickLine={false} axisLine={false} width={48} {...axis} stroke="var(--muted-foreground)" />
              <Tooltip
                {...tooltipStyle()}
                labelFormatter={(v) => labelAt(labels, v)}
                formatter={(v: number, n: string) => [money(v), n === "earned" ? "Earned" : "Collected"]}
              />
              <Area
                type="monotone"
                dataKey="earned"
                stroke="var(--accent-deep)"
                strokeWidth={2}
                fill="url(#earnedFill)"
              />
              <Line type="monotone" dataKey="collected" stroke="var(--success-ink)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ChartCard>

          <ChartCard title="Appointments" hint="Bookings in the diary for each period">
            <BarChart data={plotted} margin={PERF_CHART_MARGIN} maxBarSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--edge-2)" vertical={false} />
              <XAxis {...dateAxis} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={48} {...axis} stroke="var(--muted-foreground)" />
              <Tooltip
                {...tooltipStyle()}
                labelFormatter={(v) => labelAt(labels, v)}
                formatter={(v: number) => [v, "Appointments"]}
              />
              <Bar dataKey="appointments" fill="var(--arrived)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Attendance rate" hint="Attended as a share of settled bookings">
            <LineChart data={plotted} margin={PERF_CHART_MARGIN}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--edge-2)" vertical={false} />
              <XAxis {...dateAxis} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={48} {...axis} stroke="var(--muted-foreground)" />
              <Tooltip
                {...tooltipStyle()}
                labelFormatter={(v) => labelAt(labels, v)}
                formatter={(v: number) => [`${v}%`, "Attendance"]}
              />
              <Line
                type="monotone"
                dataKey="attendance"
                stroke="var(--success-ink)"
                strokeWidth={2}
                dot={{ r: 2 }}
              />
            </LineChart>
          </ChartCard>

          <ChartCard title="No shows" hint="Bookings marked as no show">
            <BarChart data={plotted} margin={PERF_CHART_MARGIN} maxBarSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--edge-2)" vertical={false} />
              <XAxis {...dateAxis} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={48} {...axis} stroke="var(--muted-foreground)" />
              <Tooltip
                {...tooltipStyle()}
                labelFormatter={(v) => labelAt(labels, v)}
                formatter={(v: number) => [v, "No shows"]}
              />
              <Bar dataKey="noShows" fill="var(--destructive)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>
        </div>
      )}
    </section>
  );
}
