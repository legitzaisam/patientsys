import { Fragment, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, TrendingUp, Users, Calendar, PoundSterling } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money } from "@/components/period-picker";
import { cn } from "@/lib/utils";
import type { TrendPoint } from "@/components/performance-trends";

export type PerformanceRow = {
  userId: string;
  fullName: string;
  jobTitle: string;
  commissionRate: number;
  earned: number;
  collected: number;
  earnedShare: number;
  clinicEarnedShare: number;
  treatments: number;
  appointments: number;
  attendance: number;
  noShows: number;
  outstanding: number;
  patients: number;
  newPatients: number;
  retention: number;
  averageValue: number;
};

function Sparkline({ data, dataKey, color }: { data: TrendPoint[]; dataKey: keyof TrendPoint; color: string }) {
  if (!data.length) return <span className="text-2xs text-muted-foreground">—</span>;
  const values = data.map((d) => Number(d[dataKey] ?? 0));
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = Math.max(max - min, 1);
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1 || 1)) * 100;
    const y = 100 - ((v - min) / range) * 100;
    return { x, y };
  });
  const last = points[points.length - 1];
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-8 w-24 overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        points={points.map((p) => `${p.x},${p.y}`).join(" ")}
        vectorEffect="non-scaling-stroke"
      />
      {last && <circle cx={last.x} cy={last.y} r={2} fill={color} />}
    </svg>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-glass-2 p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-background">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">{value}</p>
        {sub && <p className="text-2xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

function ExpandRow({
  row,
  trend,
  onSaveRate,
}: {
  row: PerformanceRow;
  trend: TrendPoint[] | undefined;
  onSaveRate: (rate: number) => void;
}) {
  const [rate, setRate] = useState(String(row.commissionRate));
  const dirty = Number(rate) !== row.commissionRate;

  return (
    <tr>
      <td colSpan={7} className="bg-glass-2 px-4 py-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniStat
              icon={PoundSterling}
              label="Earned"
              value={money(row.earned)}
              sub={`Their share ${money(row.earnedShare)}`}
            />
            <MiniStat
              icon={PoundSterling}
              label="Collected"
              value={money(row.collected)}
              sub={`Clinic share ${money(row.clinicEarnedShare)}`}
            />
            <MiniStat icon={Calendar} label="Appointments" value={String(row.appointments)} sub={`${row.attendance}% attended`} />
            <MiniStat icon={Users} label="Patients" value={String(row.patients)} sub={`${row.newPatients} new`} />
          </div>
          <div className="flex items-center gap-4 rounded-xl bg-glass-2 p-3">
            <div>
              <p className="text-xs text-muted-foreground">Earnings trend</p>
              <div className="mt-1">
                <Sparkline data={trend ?? []} dataKey="earned" color="var(--accent-deep)" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Commission rate</p>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="h-8 w-20 rounded-lg"
                  aria-label={`Commission percentage for ${row.fullName}`}
                />
                <span className="text-sm text-muted-foreground">%</span>
                {dirty && (
                  <Button size="sm" variant="outline" className="" onClick={() => onSaveRate(Number(rate))}>
                    Save
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}

export function PerformanceTable({
  rows,
  clinic,
  trend,
  onSaveRate,
}: {
  rows: PerformanceRow[];
  clinic?: {
    earned: number;
    collected: number;
    toPractitioners: number;
    toClinic: number;
    treatments: number;
    appointments: number;
    attendance: number;
    noShows: number;
    patients: number;
    newPatients: number;
    retention: number;
    averageValue: number;
    outstanding: number;
    averageCommission: number;
  };
  trend: { monthly: boolean; clinic: TrendPoint[]; byPractitioner: Record<string, TrendPoint[]> } | undefined;
  onSaveRate: (userId: string, rate: number) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  const top = useMemo(() => {
    if (!rows.length) return null;
    let best = rows[0]!;
    for (const r of rows) {
      if (r.earned > best.earned) best = r;
    }
    return best;
  }, [rows]);

  function toggle(userId: string) {
    const next = new Set(open);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    setOpen(next);
  }

  return (
    <div className="space-y-4">
      {top && (
        <Card className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-bg text-success">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium tracking-[0.02em] text-muted-foreground">Top performer</p>
              <p className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">
                {top.fullName}{" "}
                <span className="text-sm font-normal text-muted-foreground">{top.jobTitle || "Practitioner"}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {money(top.earned)} earned · {top.treatments} treatments · {top.retention}% retention
              </p>
            </div>
          </div>
          <Button asChild variant="outline" className="">
            <Link to="/team/$id" params={{ id: top.userId }}>
              View profile
            </Link>
          </Button>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="glass-table w-full min-w-[900px] text-sm">
            <thead>
              <tr>
                <th className="px-4 py-3">Practitioner</th>
                <th className="px-4 py-3">Earned</th>
                <th className="px-4 py-3">Treatments</th>
                <th className="px-4 py-3">Attendance</th>
                <th className="px-4 py-3">Retention</th>
                <th className="px-4 py-3">Outstanding</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const expanded = open.has(r.userId);
                return (
                  <Fragment key={r.userId}>
                    <tr
                      className={cn(
                        "cursor-pointer border-b border-glass-line transition-colors hover:bg-glass-2",
                        expanded && "bg-glass-2",
                      )}
                      onClick={() => toggle(r.userId)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-wash text-xs font-medium text-accent-ink">
                            {r.fullName
                              .split(" ")
                              .map((p) => p[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>
                          <div>
                            <p className="text-foreground">{r.fullName}</p>
                            <p className="text-2xs text-muted-foreground">{r.jobTitle || "Practitioner"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-foreground">{money(r.earned)}</p>
                        <p className="text-2xs text-muted-foreground">{money(r.earnedShare)} to them</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-foreground">{r.treatments}</p>
                        <p className="text-2xs text-muted-foreground">{money(r.averageValue)} avg</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-foreground">{r.attendance}%</p>
                        <p className="text-2xs text-muted-foreground">{r.noShows} no shows</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-foreground">{r.retention}%</p>
                        <p className="text-2xs text-muted-foreground">{r.patients} patients</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className={r.outstanding > 0 ? "text-destructive" : "text-foreground"}>
                          {r.outstanding > 0 ? money(r.outstanding) : "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className=""
                          onClick={(e) => {
                            e.stopPropagation();
                            toggle(r.userId);
                          }}
                        >
                          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </td>
                    </tr>
                    {expanded && (
                      <ExpandRow
                        row={r}
                        trend={trend?.byPractitioner[r.userId]}
                        onSaveRate={(rate) => onSaveRate(r.userId, rate)}
                      />
                    )}
                  </Fragment>
                );
              })}
            {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No practitioners yet — add them under Team.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && clinic && (
              <tfoot>
                <tr className="border-t-2 border-edge bg-glass-2 font-medium text-foreground">
                  <td className="px-4 py-3">
                    <p>Clinic total</p>
                    <p className="text-xs font-normal text-muted-foreground">
                      {rows.length} practitioner{rows.length === 1 ? "" : "s"} · {clinic.averageCommission}% avg commission
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{money(clinic.earned)}</p>
                    <p className="text-2xs font-normal text-muted-foreground">{money(clinic.toPractitioners)} paid out</p>
                  </td>
                  <td className="px-4 py-3">{clinic.treatments}</td>
                  <td className="px-4 py-3">{clinic.attendance}%</td>
                  <td className="px-4 py-3">{clinic.retention}%</td>
                  <td className="px-4 py-3">{clinic.outstanding > 0 ? money(clinic.outstanding) : "—"}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
