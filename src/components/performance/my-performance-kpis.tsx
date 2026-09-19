import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyEarnings } from "@/lib/clinic.functions";
import { PeriodPicker, periodRange, money, type PeriodKey } from "@/components/period-picker";
import { Card } from "@/components/ui/card";

function Cell({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "danger" | undefined;
}) {
  return (
    <div className="px-4 py-3.5 sm:px-5">
      <p className="text-2xs font-medium tracking-[0.02em] text-ink-3">{label}</p>
      <p
        className={`mt-1 text-[17px] font-semibold tabular-nums tracking-[-0.02em] ${
          tone === "danger" ? "text-destructive-ink" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-2xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-2xs text-ink-3">{hint}</p>
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function MyPerformanceKpis() {
  const fetchEarnings = useServerFn(getMyEarnings);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const range = useMemo(() => periodRange(period), [period]);

  const { data } = useQuery({
    queryKey: ["my-earnings", period],
    queryFn: () => fetchEarnings({ data: range }),
  });

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="section-title">Your performance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your own figures for this period — not the clinic total.
          </p>
        </div>
        <div className="shrink-0">
          <PeriodPicker value={period} onChange={setPeriod} />
        </div>
      </div>

      {!data ? (
        <Card className="p-5 text-sm text-muted-foreground">Loading your figures…</Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="px-5 py-5 sm:px-6">
            <p className="text-2xs font-medium tracking-[0.02em] text-ink-3">Your earnings</p>
            <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-[-0.03em] text-foreground">
              {money(data.earnedShare)}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">Your share of treatments you delivered</p>
          </div>

          <div className="grid border-t border-edge sm:grid-cols-3">
            <Cell label="Collected" value={money(data.collectedShare)} hint="Bookings marked paid" />
            <Cell
              label="Outstanding"
              value={data.outstanding > 0 ? money(data.outstanding) : "—"}
              hint={data.outstanding > 0 ? "Unpaid or deposit only" : "All settled"}
              tone={data.outstanding > 0 ? "danger" : undefined}
            />
            <Cell label="Average value" value={money(data.averageValue)} hint="Per treatment you delivered" />
          </div>

          <div className="grid gap-x-8 border-t border-edge px-5 py-4 sm:grid-cols-2 sm:px-6">
            <div>
              <p className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-3">Activity</p>
              <div className="mt-1 divide-y divide-edge">
                <Row label="Treatments" value={String(data.treatments)} hint="You delivered this period" />
                <Row label="Appointments" value={String(data.appointments)} hint="In your diary" />
                <Row label="New patients" value={String(data.newPatients)} hint="First seen this period" />
                <Row label="Patients seen" value={String(data.patients)} hint="Unique patients" />
              </div>
            </div>
            <div>
              <p className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-3">Reliability</p>
              <div className="mt-1 divide-y divide-edge">
                <Row
                  label="Attendance"
                  value={`${data.attendance}%`}
                  hint={data.noShows ? `${data.noShows} no shows` : "Settled bookings you attended"}
                />
                <Row label="Retention" value={`${data.retention}%`} hint="Returned within 12 months" />
                <Row label="No shows" value={String(data.noShows)} hint="Settled bookings marked no show" />
                <Row label="Cancellations" value={String(data.cancelled)} hint="Cancelled diary bookings" />
              </div>
            </div>
          </div>
        </Card>
      )}
    </section>
  );
}
