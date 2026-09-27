/**
 * Owner / manager strip above the week's diary cards: bookings per day, the
 * value booked this week, and how full each practitioner's week is. Fullness
 * assumes 09:00–18:00 on the clinic's working days until real working hours
 * exist (follow-on phase).
 */
import { moneyWhole } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** 09:00–18:00, Monday to Saturday, until working hours are configurable. */
const WORKING_MINUTES_PER_WEEK = 9 * 60 * 6;

type Row = {
  id: string;
  starts_at: string;
  ends_at?: string | null;
  status?: string | null;
  price?: number | null;
  practitioner_id?: string | null;
  profiles?: { full_name?: string | null } | null;
};

function weekSummary(rows: Row[], weekStartISO: string) {
  const live = rows.filter((a) => a.status !== "cancelled");
  const start = new Date(weekStartISO).getTime();
  const perDay = Array.from({ length: 7 }, () => 0);
  let booked = 0;
  const minutesBy = new Map<string, { name: string; minutes: number }>();
  for (const a of live) {
    const day = Math.floor((new Date(a.starts_at).getTime() - start) / 86_400_000);
    if (day >= 0 && day < 7) perDay[day]! += 1;
    booked += Number(a.price ?? 0);
    const minutes = a.ends_at
      ? Math.max(0, (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60_000)
      : 30;
    const key = a.practitioner_id ?? "unassigned";
    const cur = minutesBy.get(key) ?? { name: a.profiles?.full_name ?? "Unassigned", minutes: 0 };
    cur.minutes += minutes;
    minutesBy.set(key, cur);
  }
  const fullness = [...minutesBy.entries()]
    .filter(([id]) => id !== "unassigned")
    .map(([id, v]) => ({
      id,
      name: v.name,
      pct: Math.min(100, Math.round((v.minutes / WORKING_MINUTES_PER_WEEK) * 100)),
    }))
    .sort((a, b) => b.pct - a.pct);
  return { perDay, booked, total: live.length, fullness };
}

export function WeekSummaryStrip({ rows, weekStartISO }: { rows: Row[]; weekStartISO: string }) {
  const s = weekSummary(rows, weekStartISO);
  return (
    <Card
      className="mb-3 grid gap-4 px-5 py-3 md:grid-cols-[auto_auto_minmax(0,1fr)]"
      data-qc="week-summary"
    >
      <div>
        <p className="text-2xs font-medium tracking-[0.02em] text-ink-3">Bookings this week</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-foreground" data-qc="week-total">
          {s.total}
        </p>
        <ul
          className="mt-1 flex gap-2 text-2xs text-muted-foreground"
          aria-label="Bookings per day"
        >
          {s.perDay.map((n, i) => (
            <li key={DAY_LABELS[i]} className="flex flex-col items-center">
              <span className="tabular-nums text-foreground">{n}</span>
              <span>{DAY_LABELS[i]}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="md:border-l md:border-glass-line md:pl-4">
        <p className="text-2xs font-medium tracking-[0.02em] text-ink-3">Booked value</p>
        <p
          className="mt-1 text-lg font-semibold tabular-nums text-foreground"
          data-qc="week-booked"
        >
          {moneyWhole(s.booked)}
        </p>
        <p className="mt-1 text-2xs text-muted-foreground">Live bookings, whatever is paid</p>
      </div>
      <div className="md:border-l md:border-glass-line md:pl-4">
        <p className="text-2xs font-medium tracking-[0.02em] text-ink-3">
          How full each practitioner is
        </p>
        <ul className="mt-1.5 grid max-w-md gap-1.5">
          {s.fullness.length === 0 ? (
            <li className="text-2xs text-muted-foreground">No bookings yet this week.</li>
          ) : (
            s.fullness.map((f) => (
              <li key={f.id} className="flex items-center gap-2 text-2xs" data-qc="week-fullness">
                <span className="w-28 truncate text-foreground">{f.name}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-glass-2 shadow-inset-hi">
                  <span
                    className={cn(
                      "block h-full rounded-full",
                      f.pct >= 85 ? "bg-destructive-ink/60" : "bg-accent-line",
                    )}
                    style={{ width: `${f.pct}%` }}
                  />
                </span>
                <span className="w-9 text-right tabular-nums text-muted-foreground">{f.pct}%</span>
              </li>
            ))
          )}
        </ul>
        <p className="mt-1 text-2xs text-muted-foreground">Of 09:00–18:00, Monday to Saturday.</p>
      </div>
    </Card>
  );
}
