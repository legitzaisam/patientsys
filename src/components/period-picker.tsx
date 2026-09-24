import { ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PeriodKey = "day" | "week" | "month" | "year";

export type PeriodSelection = {
  key: PeriodKey;
  offset: number;
};

export const CURRENT_MONTH: PeriodSelection = { key: "month", offset: 0 };
/** The default for every metrics page: the feedback asked for one consistent picker defaulting to the year. */
export const CURRENT_YEAR: PeriodSelection = { key: "year", offset: 0 };

const OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "day", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
];

const MAX_OFFSET: Record<PeriodKey, number> = {
  day: 365,
  week: 104,
  month: 36,
  year: 8,
};

export function asPeriod(period: PeriodKey | PeriodSelection): PeriodSelection {
  if (typeof period === "string") return { key: period, offset: 0 };
  return {
    key: period.key,
    offset: Math.min(MAX_OFFSET[period.key], Math.max(0, Math.trunc(period.offset) || 0)),
  };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/** Monday of the week containing `date` (local). */
export function startOfWeek(date: Date) {
  const start = startOfDay(date);
  const weekday = start.getDay();
  start.setDate(start.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return start;
}

function shift(period: PeriodSelection, now: Date) {
  const { key, offset } = asPeriod(period);
  if (key === "day") {
    const start = startOfDay(now);
    start.setDate(start.getDate() - offset);
    return { start, end: endOfDay(start) };
  }
  if (key === "week") {
    const start = startOfWeek(now);
    start.setDate(start.getDate() - offset * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return { start, end: endOfDay(end) };
  }
  if (key === "year") {
    const year = now.getFullYear() - offset;
    return { start: new Date(year, 0, 1), end: endOfDay(new Date(year, 11, 31)) };
  }
  const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/** Inclusive ISO range for the selected period. */
export function periodRange(period: PeriodKey | PeriodSelection, now: Date = new Date()): { from: string; to: string } {
  const { start, end } = shift(asPeriod(period), now);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** Same length as `periodRange`, immediately before it. */
export function previousPeriodRange(period: PeriodKey | PeriodSelection, now: Date = new Date()) {
  const current = asPeriod(period);
  return periodRange({ key: current.key, offset: current.offset + 1 }, now);
}

function dayMonth(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const CURRENT_LABEL: Record<PeriodKey, string> = {
  day: "Today",
  week: "This week",
  month: "This month",
  year: "This year",
};

const PREVIOUS_LABEL: Record<PeriodKey, string> = {
  day: "Yesterday",
  week: "Last week",
  month: "Last month",
  year: "Last year",
};

/** Short label for the resolved window (stepper and section copy). */
export function periodWindowLabel(period: PeriodKey | PeriodSelection, now: Date = new Date()) {
  const { start, end } = shift(asPeriod(period), now);
  const { key } = asPeriod(period);
  if (key === "day") return dayMonth(start);
  if (key === "week") {
    if (start.getMonth() === end.getMonth()) return `${start.getDate()}–${dayMonth(end)}`;
    return `${dayMonth(start)} – ${dayMonth(end)}`;
  }
  if (key === "year") return String(start.getFullYear());
  return start.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** Friendly heading: Today / Last week / Aug 2026. */
export function periodHeading(period: PeriodKey | PeriodSelection, now: Date = new Date()) {
  const current = asPeriod(period);
  if (current.offset === 0) return CURRENT_LABEL[current.key];
  if (current.offset === 1) return PREVIOUS_LABEL[current.key];
  return periodWindowLabel(current, now);
}

export function money(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

const pill =
  "h-7 cursor-pointer whitespace-nowrap rounded-full px-3.5 text-xs tracking-[0.02em] transition-colors";
const pillActive = "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]";
const pillIdle = "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]";
const track = "flex h-[34px] items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi";

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
        disabled
          ? "cursor-default text-ink-3"
          : "cursor-pointer text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]",
      )}
    >
      {children}
    </button>
  );
}

export function PeriodPicker({
  value,
  onChange,
}: {
  value: PeriodSelection;
  onChange: (v: PeriodSelection) => void;
}) {
  const period = asPeriod(value);
  const atStart = period.offset <= 0;
  const atEnd = period.offset >= MAX_OFFSET[period.key];
  const selectedLabel = periodHeading(period);

  return (
    <div className={cn(track, "shrink-0")}>
      <StepButton
        label="Previous period"
        disabled={atEnd}
        onClick={() => onChange({ key: period.key, offset: period.offset + 1 })}
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
      </StepButton>
      <div role="tablist" aria-label="Reporting period" className="flex items-center gap-0.5">
        {OPTIONS.map((option) => {
          const selected = period.key === option.key;
          return (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={option.label}
              title={selected && period.offset > 0 ? selectedLabel : option.label}
              onClick={() => {
                if (selected && period.offset === 0) return;
                onChange({ key: option.key, offset: 0 });
              }}
              className={cn(pill, selected ? pillActive : pillIdle)}
            >
              {selected ? selectedLabel : option.label}
            </button>
          );
        })}
      </div>
      <StepButton
        label="Next period"
        disabled={atStart}
        onClick={() => onChange({ key: period.key, offset: period.offset - 1 })}
      >
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </StepButton>
    </div>
  );
}
