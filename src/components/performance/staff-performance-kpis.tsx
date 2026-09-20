import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { TrendingDown, TrendingUp } from "lucide-react";
import { getPractitionerPerformance } from "@/lib/clinic.functions";
import { PeriodPicker, periodRange, previousPeriodRange, money, type PeriodSelection } from "@/components/period-picker";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type IdentityLike = { isOwner?: boolean; isManager?: boolean; permissions?: string[] } | null | undefined;

function ordinal(n: number) {
  const rem10 = n % 10;
  const rem100 = n % 100;
  if (rem10 === 1 && rem100 !== 11) return `${n}st`;
  if (rem10 === 2 && rem100 !== 12) return `${n}nd`;
  if (rem10 === 3 && rem100 !== 13) return `${n}rd`;
  return `${n}th`;
}

function Change({
  value,
  invert = false,
  moneyValue = false,
}: {
  value: number;
  invert?: boolean | undefined;
  moneyValue?: boolean | undefined;
}) {
  if (!value) return null;
  const Icon = value < 0 ? TrendingDown : TrendingUp;
  const better = invert ? value < 0 : value > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums",
        better ? "text-success-ink" : "text-destructive-ink",
      )}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {moneyValue ? money(Math.abs(value)) : Math.abs(value)}
    </span>
  );
}

function SplitCell({
  label,
  value,
  hint,
  change,
  invertChange,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  change?: number | undefined;
  invertChange?: boolean | undefined;
  tone?: "danger" | undefined;
}) {
  return (
    <div className="px-4 py-3.5 sm:px-5">
      <p className="text-2xs font-medium tracking-[0.02em] text-ink-3">{label}</p>
      <p
        className={cn(
          "mt-1 text-[17px] font-semibold tabular-nums tracking-[-0.02em]",
          tone === "danger" ? "text-destructive-ink" : "text-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted-foreground">
        {change != null ? <Change value={change} invert={invertChange} moneyValue /> : null}
        <span>{hint}</span>
      </p>
    </div>
  );
}

function StatRow({
  label,
  value,
  hint,
  change,
  invertChange,
  moneyChange,
}: {
  label: string;
  value: string;
  hint: string;
  change?: number | undefined;
  invertChange?: boolean | undefined;
  moneyChange?: boolean | undefined;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xs text-ink-3">{hint}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-foreground">{value}</p>
        {change != null && change !== 0 ? (
          <p className="mt-0.5 text-2xs">
            <Change value={change} invert={invertChange} moneyValue={moneyChange} />
          </p>
        ) : null}
      </div>
    </div>
  );
}

function vsClinic(own: number, clinic: number, unit = "") {
  if (!clinic) return "No clinic figure yet";
  const delta = own - clinic;
  if (delta === 0) return "In line with the clinic";
  const abs = Math.abs(delta);
  const label = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return `${delta > 0 ? "Above" : "Below"} clinic by ${label}${unit}`;
}

export function StaffPerformanceKpis({
  userId,
  identity,
  role,
}: {
  userId: string;
  identity: IdentityLike;
  role: string;
}) {
  const fetchPerformance = useServerFn(getPractitionerPerformance);
  const [period, setPeriod] = useState<PeriodSelection>({ key: "month", offset: 0 });
  const range = useMemo(() => periodRange(period), [period]);
  const previous = useMemo(() => previousPeriodRange(period), [period]);

  const allowed = Boolean(identity?.isOwner || identity?.isManager);
  const clinical = role === "practitioner" || role === "owner";

  const { data } = useQuery({
    queryKey: ["performance", range.from, range.to],
    queryFn: () =>
      fetchPerformance({
        data: { ...range, previousFrom: previous.from, previousTo: previous.to },
      }),
    enabled: allowed && clinical,
  });

  if (!allowed || !clinical) return null;

  const rows = data?.rows ?? [];
  const row = rows.find((r) => r.userId === userId);
  const prev = data?.previousRows?.find((r) => r.userId === userId);
  const clinic = data?.clinic;
  const n = rows.length;
  const clinicAvgEarned = clinic && n ? clinic.earned / n : 0;
  const clinicAvgValue = clinic?.averageValue ?? 0;
  const share = row && clinic?.earned ? Math.round((row.earned / clinic.earned) * 100) : 0;
  const earnedRank = row ? rows.filter((r) => r.earned > row.earned).length + 1 : 0;
  const retentionRank = row
    ? [...rows].sort((a, b) => b.retention - a.retention).findIndex((r) => r.userId === userId) + 1
    : 0;
  const collectionRate = row && row.earned > 0 ? Math.round((row.collected / row.earned) * 100) : 0;
  const settled = row ? row.attended + row.noShows : 0;
  const noShowRate = settled ? Math.round((row!.noShows / settled) * 100) : 0;

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="section-title">Performance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            How they sit against the rest of the clinic.
          </p>
        </div>
        <div className="shrink-0">
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
      </div>

      {!row || !clinic ? (
        <Card className="p-5 text-sm text-muted-foreground">No treatments or bookings in this period.</Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-5 sm:px-6">
            <div className="min-w-0">
              <p className="text-2xs font-medium tracking-[0.02em] text-ink-3">Earned this period</p>
              <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-[-0.03em] text-foreground">
                {money(row.earned)}
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                {prev ? <Change value={row.earned - prev.earned} moneyValue /> : null}
                <span>
                  {share}% of clinic
                  {clinicAvgEarned
                    ? ` · ${row.earned >= clinicAvgEarned ? "at or above" : "below"} average`
                    : ""}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-edge bg-glass-2 px-3 py-1.5 text-2xs font-semibold text-foreground shadow-inset-hi">
                {ordinal(earnedRank)} of {n} by earned
              </span>
              <span className="rounded-full border border-edge bg-glass-2 px-3 py-1.5 text-2xs font-semibold text-foreground shadow-inset-hi">
                {ordinal(retentionRank)} of {n} by retention
              </span>
              <span className="rounded-full border border-edge bg-glass-2 px-3 py-1.5 text-2xs font-semibold text-foreground shadow-inset-hi">
                {row.earned > 0 ? `${collectionRate}% collected` : "Nothing collected"}
              </span>
            </div>
          </div>

          <div className="grid border-t border-edge sm:grid-cols-3">
            <SplitCell
              label="Their share"
              value={money(row.earnedShare)}
              hint={`${row.commissionRate}% commission`}
              change={prev ? row.earnedShare - prev.earnedShare : undefined}
            />
            <SplitCell
              label="Clinic keeps"
              value={money(row.clinicEarnedShare)}
              hint="After their commission"
              change={prev ? row.clinicEarnedShare - prev.clinicEarnedShare : undefined}
            />
            <SplitCell
              label="Outstanding"
              value={row.outstanding > 0 ? money(row.outstanding) : "—"}
              hint={row.outstanding > 0 ? "Unpaid or deposit only" : "All settled"}
              tone={row.outstanding > 0 ? "danger" : undefined}
              invertChange
              change={prev ? row.outstanding - prev.outstanding : undefined}
            />
          </div>

          <div className="grid gap-x-8 border-t border-edge px-5 py-4 sm:grid-cols-2 sm:px-6">
            <div>
              <p className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-3">Activity</p>
              <div className="mt-1 divide-y divide-edge">
                <StatRow
                  label="Treatments"
                  value={String(row.treatments)}
                  hint={`${money(row.averageValue)} avg · clinic ${money(clinicAvgValue)}`}
                  change={prev ? row.treatments - prev.treatments : undefined}
                />
                <StatRow
                  label="Appointments"
                  value={String(row.appointments)}
                  hint="Diary bookings this period"
                  change={prev ? row.appointments - prev.appointments : undefined}
                />
                <StatRow
                  label="New patients"
                  value={String(row.newPatients)}
                  hint="First seen in this period"
                  change={prev ? row.newPatients - prev.newPatients : undefined}
                />
                <StatRow
                  label="Collected"
                  value={money(row.collected)}
                  hint="Bookings marked paid"
                  change={prev ? row.collected - prev.collected : undefined}
                  moneyChange
                />
              </div>
            </div>
            <div>
              <p className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-3">Reliability</p>
              <div className="mt-1 divide-y divide-edge">
                <StatRow
                  label="Attendance"
                  value={`${row.attendance}%`}
                  hint={`${row.noShows} no shows · ${vsClinic(row.attendance, clinic.attendance, " pts")}`}
                  change={prev ? row.attendance - prev.attendance : undefined}
                />
                <StatRow
                  label="Retention"
                  value={`${row.retention}%`}
                  hint={`${row.patients} patients · ${vsClinic(row.retention, clinic.retention, " pts")}`}
                  change={prev ? row.retention - prev.retention : undefined}
                />
                <StatRow
                  label="No-show rate"
                  value={settled ? `${noShowRate}%` : "—"}
                  hint={settled ? `${row.noShows} of ${settled} settled bookings` : "No settled bookings"}
                />
                <StatRow
                  label="Cancellations"
                  value={String(row.cancelled)}
                  hint="Cancelled diary bookings"
                  invertChange
                  change={prev ? row.cancelled - prev.cancelled : undefined}
                />
              </div>
            </div>
          </div>
        </Card>
      )}
    </section>
  );
}
