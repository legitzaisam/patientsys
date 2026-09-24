import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import type { InsightsResult } from "@/lib/insights.server";

const SIGNUPS = "var(--accent-line)";
const BOOKINGS = "rgba(47, 63, 102, 0.45)";
const CONSULTS = "rgba(214, 105, 137, 0.75)";

function tooltipStyle() {
  return {
    borderRadius: 12,
    border: "1px solid var(--edge-2)",
    background: "var(--glass)",
    backdropFilter: "blur(8px)",
    fontSize: 12,
  } as React.CSSProperties;
}

function seriesTitle(monthly: InsightsResult["monthly"]) {
  const key = monthly[0]?.key ?? "";
  if (!key) return "Trend";
  if (key.endsWith("w")) return "By week";
  if (key.includes("T")) return "By hour";
  if (/^\d{4}-\d{2}-\d{2}$/.test(key)) return "By day";
  return "By month";
}

function Legend() {
  return (
    <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs text-muted-foreground">
      <li className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: SIGNUPS }} />
        Sign-ups
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: BOOKINGS }} />
        First bookings
      </li>
      <li className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: CONSULTS }} />
        First consults
      </li>
    </ul>
  );
}

export function FunnelChart({ monthly }: { monthly: InsightsResult["monthly"] | undefined }) {
  const empty = monthly != null && monthly.every((row) => !row.signUps && !row.firstBookings && !row.firstConsults);

  return (
    <Card id="insights-by-month" className="scroll-mt-20 p-5">
      <h2 className="section-title">{seriesTitle(monthly ?? [])}</h2>
      <p className="mt-1 text-xs text-muted-foreground">For people who signed up in this window.</p>
      {monthly == null ? (
        <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">Loading…</p>
      ) : empty ? (
        <p className="flex h-56 items-center justify-center text-sm text-muted-foreground">
          No sign-ups in this window yet.
        </p>
      ) : (
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--edge-2)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                interval={monthly.length > 16 ? 2 : 0}
              />
              <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle()} cursor={{ fill: "rgba(47,63,102,0.05)" }} />
              <Bar dataKey="signUps" name="Sign-ups" fill={SIGNUPS} radius={[6, 6, 0, 0]} />
              <Bar dataKey="firstBookings" name="First bookings" fill={BOOKINGS} radius={[6, 6, 0, 0]} />
              <Bar dataKey="firstConsults" name="First consults" fill={CONSULTS} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {!empty && monthly != null && <Legend />}
    </Card>
  );
}
