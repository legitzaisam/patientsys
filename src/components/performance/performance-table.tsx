import { Fragment, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  if (!data.length) return <span className="text-2xs text-muted-foreground">No trend yet</span>;
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
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" className="h-10 w-full overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.map((p) => `${p.x},${(p.y / 100) * 36}`).join(" ")}
        vectorEffect="non-scaling-stroke"
      />
      {last && <circle cx={last.x} cy={(last.y / 100) * 36} r={2.4} fill={color} />}
    </svg>
  );
}

function MetricTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "danger" | "accent" | "default";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-3.5 py-3 shadow-inset-hi",
        tone === "danger" && "border-destructive/25 bg-destructive-bg",
        tone === "accent" && "border-accent-line bg-accent-wash",
        tone === "default" && "border-edge bg-glass-2",
      )}
    >
      <p className="text-2xs font-medium tracking-[0.02em] text-ink-3">{label}</p>
      <p
        className={cn(
          "mt-1 text-[17px] font-semibold tabular-nums tracking-[-0.02em]",
          tone === "danger" && "text-destructive-ink",
          tone === "accent" && "text-accent-ink",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p
          className={cn(
            "mt-0.5 text-2xs",
            tone === "danger" ? "text-destructive-ink/70" : "text-muted-foreground",
          )}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function shortStaffName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Staff";
  if (parts.length === 1) return parts[0]!;

  const PREFIXES = new Set([
    "dr",
    "dr.",
    "mr",
    "mr.",
    "mrs",
    "mrs.",
    "ms",
    "ms.",
    "miss",
    "mx",
    "mx.",
    "prof",
    "prof.",
    "professor",
  ]);
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  if (PREFIXES.has(first.toLowerCase())) return `${first} ${last}`;
  return first;
}

function ExpandRow({
  row,
  trend,
}: {
  row: PerformanceRow;
  trend: TrendPoint[] | undefined;
}) {
  const hasOutstanding = row.outstanding > 0;
  const label = shortStaffName(row.fullName);

  return (
    <tr>
      <td colSpan={7} className="border-b border-glass-line bg-[rgba(47,63,102,0.03)] px-4 py-4">
        <div className="glass-panel relative overflow-hidden rounded-[22px] px-4 py-4 sm:px-5">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--sheen)] via-transparent to-transparent" />

          <div className="relative z-[1] flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-semibold tracking-[-0.01em] text-foreground">
                {label}’s extras
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Cash, activity and trend beyond the row above.
              </p>
            </div>
            <Link
              to="/team/$id"
              params={{ id: row.userId }}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-3 py-1.5 text-2xs font-semibold text-accent-ink shadow-inset-hi transition-[filter] hover:brightness-[0.97]"
            >
              Commission {row.commissionRate}%
              <span className="font-medium opacity-80">· Edit on Team</span>
            </Link>
          </div>

          <div className="relative z-[1] mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricTile label="Collected" value={money(row.collected)} hint="Marked paid" />
            <MetricTile label="Clinic keeps" value={money(row.clinicEarnedShare)} hint="After their share" />
            <MetricTile
              label="Outstanding"
              value={hasOutstanding ? money(row.outstanding) : "—"}
              hint={hasOutstanding ? "Unpaid or deposit only" : "All settled"}
              tone={hasOutstanding ? "danger" : "default"}
            />
            <MetricTile label="Appointments" value={String(row.appointments)} />
            <MetricTile label="New patients" value={String(row.newPatients)} />
          </div>

          <div className="relative z-[1] mt-3 rounded-2xl border border-edge bg-glass-2/80 px-3.5 py-3 shadow-inset-hi">
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xs font-medium tracking-[0.02em] text-ink-3">Earnings trend</p>
              <span className="text-2xs text-muted-foreground">This period</span>
            </div>
            <div className="mt-2">
              <Sparkline data={trend ?? []} dataKey="earned" color="var(--accent-deep)" />
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
                    {expanded && <ExpandRow row={r} trend={trend?.byPractitioner[r.userId]} />}
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
                <tr className="border-t border-edge bg-glass-2 font-medium text-foreground">
                  <td className="px-4 py-3.5">
                    <p className="tracking-tight">Clinic total</p>
                    <p className="text-xs font-normal text-muted-foreground">
                      {rows.length} practitioner{rows.length === 1 ? "" : "s"}
                      <span className="text-ink-3"> · </span>
                      <span className="tabular-nums">{clinic.averageCommission}% avg commission</span>
                    </p>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="tabular-nums">{money(clinic.earned)}</p>
                    <p className="text-2xs font-normal text-muted-foreground">
                      {money(clinic.toPractitioners)} paid out
                    </p>
                  </td>
                  <td className="px-4 py-3.5 tabular-nums">{clinic.treatments}</td>
                  <td className="px-4 py-3.5 tabular-nums">{clinic.attendance}%</td>
                  <td className="px-4 py-3.5 tabular-nums">{clinic.retention}%</td>
                  <td
                    className={cn(
                      "px-4 py-3.5 tabular-nums",
                      clinic.outstanding > 0 ? "text-destructive-ink" : undefined,
                    )}
                  >
                    {clinic.outstanding > 0 ? money(clinic.outstanding) : "—"}
                  </td>
                  <td className="px-4 py-3.5" />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
