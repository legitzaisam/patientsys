import { useMemo, useState } from "react";
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

type Props = {
  trend:
    | {
        monthly: boolean;
        clinic: TrendPoint[];
        byPractitioner: Record<string, TrendPoint[]>;
      }
    | undefined;
  practitioners: { userId: string; fullName: string }[];
};

const axis = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
};

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
      <div className="h-52">
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

export function PerformanceTrends({ trend, practitioners }: Props) {
  const [who, setWho] = useState<string>("clinic");

  const data = useMemo(() => {
    if (!trend) return [];
    return who === "clinic" ? trend.clinic : (trend.byPractitioner[who] ?? []);
  }, [trend, who]);

  const empty = data.length === 0;

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="section-title">Trends</h2>
          <p className="text-sm text-muted-foreground">
            {trend?.monthly ? "By month" : "By day"} over the selected period — clinic total or a single practitioner.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs tracking-[0.02em] text-muted-foreground">Showing</span>
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

      {empty ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No activity in this period yet.
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Earnings" hint="Treatment value earned and booking revenue collected">
            <AreaChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="earnedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--edge-2)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} {...axis} stroke="var(--muted-foreground)" />
              <YAxis tickLine={false} axisLine={false} width={48} {...axis} stroke="var(--muted-foreground)" />
              <Tooltip
                {...tooltipStyle()}
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
            <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--edge-2)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} {...axis} stroke="var(--muted-foreground)" />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={48} {...axis} stroke="var(--muted-foreground)" />
              <Tooltip {...tooltipStyle()} formatter={(v: number) => [v, "Appointments"]} />
              <Bar dataKey="appointments" fill="var(--arrived)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>

          <ChartCard title="Attendance rate" hint="Attended as a share of settled bookings">
            <LineChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--edge-2)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} {...axis} stroke="var(--muted-foreground)" />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} width={48} {...axis} stroke="var(--muted-foreground)" />
              <Tooltip {...tooltipStyle()} formatter={(v: number) => [`${v}%`, "Attendance"]} />
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
            <BarChart data={data} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--edge-2)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} {...axis} stroke="var(--muted-foreground)" />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={48} {...axis} stroke="var(--muted-foreground)" />
              <Tooltip {...tooltipStyle()} formatter={(v: number) => [v, "No shows"]} />
              <Bar dataKey="noShows" fill="var(--destructive)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartCard>
        </div>
      )}
    </section>
  );
}
