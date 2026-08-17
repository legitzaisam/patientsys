import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";

export type MonthPoint = { key: string; label: string; rate: number; active: number; returning: number };

export function RetentionTrend({ monthly }: { monthly: MonthPoint[] }) {
  if (!monthly.length) {
    return <Card className="p-10 text-center text-sm text-muted-foreground">Not enough history yet.</Card>;
  }
  return (
    <Card className="p-5">
      <p className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">Retention over time</p>
      <p className="mb-4 text-xs text-muted-foreground">
        Rolling 12-month rate — patients who came back more than once, measured at the end of each month.
      </p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={monthly} margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="retentionFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--edge-2)" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={11}
              stroke="var(--muted-foreground)"
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
              formatter={(v: number, _n, item: any) => [
                `${v}% · ${item?.payload?.returning ?? 0} of ${item?.payload?.active ?? 0} patients`,
                "Retention",
              ]}
            />
            <Area type="monotone" dataKey="rate" stroke="var(--accent-deep)" strokeWidth={2} fill="url(#retentionFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
