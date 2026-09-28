import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  MONTHS_LONG,
  WEEKDAYS,
  compactTime,
  dayState,
  fullPattern,
  monthGrid,
  previousMonth,
  type DayState,
  type PatternRow,
  type TimeOffLike,
} from "@/lib/staff-schedule";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STATE_LABEL: Partial<Record<DayState, string>> = {
  holiday: "Holiday",
  training: "Training",
  sickness: "Sickness",
  other: "Time off",
  pending: "Pending",
};

const STATE_CLASS: Record<DayState, string> = {
  work: "bg-glass-2 text-foreground shadow-inset-hi",
  off: "text-ink-3",
  holiday: "bg-success-bg text-success-ink",
  training: "bg-warning-bg text-warning-ink",
  sickness: "bg-destructive-bg text-destructive-ink",
  other: "bg-glass-2 text-foreground shadow-inset-hi",
  pending: "border-2 border-dashed border-accent-deep bg-accent-wash text-accent-ink",
};

/** One month of the person's days: working hours, days off, time off, pending requests. */
export function TimeOffCalendar({
  year,
  month,
  onMonth,
  pattern,
  timeOff,
  todayKey,
}: {
  year: number;
  month: number;
  onMonth: (next: { year: number; month: number }) => void;
  pattern: PatternRow[];
  timeOff: TimeOffLike[];
  todayKey: string;
}) {
  const full = useMemo(() => fullPattern(pattern), [pattern]);
  const cells = useMemo(() => monthGrid(year, month), [year, month]);

  return (
    <Card className="p-6" data-qc="time-off-calendar">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            aria-label="Previous month"
            onClick={() => onMonth(previousMonth(year, month))}
            data-qc="calendar-prev"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2
            className="min-w-[150px] text-center text-[19px] font-semibold text-foreground"
            data-qc="calendar-title"
          >
            {MONTHS_LONG[month - 1]} {year}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            aria-label="Next month"
            onClick={() =>
              onMonth(month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 })
            }
            data-qc="calendar-next"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground" aria-hidden>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-foreground" /> Working
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-success" /> Holiday
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-warning" /> Training
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border-2 border-dashed border-accent-deep" />{" "}
            Pending
          </span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-1.5 pb-0.5 text-xs font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map((c, i) => {
          if (!c.key || !c.day) return <div key={`blank-${i}`} className="h-[70px]" aria-hidden />;
          const state = dayState(c.key, full, timeOff);
          const row = full[c.weekday]!;
          const isToday = c.key === todayKey;
          return (
            <div
              key={c.key}
              className={cn(
                "flex h-[70px] flex-col justify-between rounded-2xl p-2",
                STATE_CLASS[state],
                isToday && "ring-2 ring-foreground/60",
              )}
              data-qc="calendar-day"
              data-state={state}
              data-day={c.key}
            >
              <span className="text-sm font-semibold">{c.day}</span>
              {state === "work" && row.start && row.end ? (
                <span className="self-start rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-semibold text-background">
                  {compactTime(row.start)}–{compactTime(row.end)}
                </span>
              ) : STATE_LABEL[state] ? (
                <span className="text-[11px] font-bold">{STATE_LABEL[state]}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
