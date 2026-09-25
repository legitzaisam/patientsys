import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type PeriodKey = "day" | "week" | "month" | "year";

/** Lookback shortcuts, plus a from/to range the clinic chooses. */
export type PeriodPreset = "1w" | "1m" | "6m" | "1y" | "custom";

export type PeriodSelection = {
  key: PeriodKey;
  offset: number;
  preset?: PeriodPreset;
  /** yyyy-mm-dd inclusive. Used when `preset` is `custom`. */
  from?: string;
  to?: string;
};

export const CURRENT_MONTH: PeriodSelection = { key: "month", offset: 0 };
/** The default for every metrics page: the feedback asked for one consistent picker defaulting to the year. */
export const CURRENT_YEAR: PeriodSelection = { key: "year", offset: 0 };

const MAX_OFFSET: Record<PeriodKey, number> = {
  day: 365,
  week: 104,
  month: 36,
  year: 8,
};

const PRESET_MONTHS: Partial<Record<PeriodPreset, number>> = {
  "1m": 1,
  "6m": 6,
};

export function asPeriod(period: PeriodKey | PeriodSelection): PeriodSelection {
  if (typeof period === "string") return { key: period, offset: 0 };
  const key = (["day", "week", "month", "year"] as const).includes(period.key) ? period.key : "year";
  const next: PeriodSelection = {
    key,
    offset: Math.min(MAX_OFFSET[key], Math.max(0, Math.trunc(period.offset) || 0)),
  };
  if (period.preset) next.preset = period.preset;
  if (period.from) next.from = period.from;
  if (period.to) next.to = period.to;
  return next;
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

function trailingMonths(now: Date, months: number) {
  const end = endOfDay(now);
  const start = startOfDay(now);
  start.setMonth(start.getMonth() - months);
  return { start, end };
}

function dateKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDateKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

function customBounds(from: string, to: string) {
  const startKey = from <= to ? from : to;
  const endKey = from <= to ? to : from;
  return { start: startOfDay(parseDateKey(startKey)), end: endOfDay(parseDateKey(endKey)) };
}

function trailingDays(now: Date, days: number) {
  const end = endOfDay(now);
  const start = startOfDay(now);
  start.setDate(start.getDate() - (days - 1));
  return { start, end };
}

function boundsOf(period: PeriodSelection, now: Date) {
  if (period.preset === "custom" && period.from && period.to) return customBounds(period.from, period.to);
  if (period.preset === "1w") return trailingDays(now, 7);
  const months = period.preset ? PRESET_MONTHS[period.preset] : undefined;
  if (months) return trailingMonths(now, months);
  return shift(period, now);
}

/** Inclusive ISO range for the selected period. */
export function periodRange(period: PeriodKey | PeriodSelection, now: Date = new Date()): { from: string; to: string } {
  const { start, end } = boundsOf(asPeriod(period), now);
  return { from: start.toISOString(), to: end.toISOString() };
}

/** Same length as `periodRange`, immediately before it. */
export function previousPeriodRange(period: PeriodKey | PeriodSelection, now: Date = new Date()) {
  const current = asPeriod(period);
  if (current.preset === "custom" || current.preset === "1w" || (current.preset && PRESET_MONTHS[current.preset])) {
    const { start, end } = boundsOf(current, now);
    const span = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - span);
    return { from: prevStart.toISOString(), to: prevEnd.toISOString() };
  }
  return periodRange({ key: current.key, offset: current.offset + 1 }, now);
}

/** Long windows group earnings by month; short ones by day. */
export function periodGroupsByMonth(period: PeriodKey | PeriodSelection, now: Date = new Date()) {
  const { from, to } = periodRange(period, now);
  return new Date(to).getTime() - new Date(from).getTime() > 45 * 86_400_000;
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

const PRESET_HEADING: Record<PeriodPreset, string> = {
  "1w": "This week",
  "1m": "This month",
  "6m": "Last 6 months",
  "1y": "This year",
  custom: "Select dates",
};

function rangeHeading(from: string, to: string) {
  const { start, end } = customBounds(from, to);
  if (dateKey(start) === dateKey(end)) return dayMonth(start);
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${dayMonth(end)}`;
  }
  return `${dayMonth(start)} – ${dayMonth(end)}`;
}

/** Friendly heading: This week / This month / Last 6 months / This year. */
export function periodHeading(period: PeriodKey | PeriodSelection, now: Date = new Date()) {
  const current = asPeriod(period);
  if (current.preset === "custom" && current.from && current.to) return rangeHeading(current.from, current.to);
  if (current.preset && current.preset !== "custom") return PRESET_HEADING[current.preset];
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

const PRESETS: { id: Exclude<PeriodPreset, "custom">; label: string; key: PeriodKey }[] = [
  { id: "1w", label: "1 week", key: "week" },
  { id: "1m", label: "1 month", key: "month" },
  { id: "6m", label: "6 months", key: "month" },
  { id: "1y", label: "1 year", key: "year" },
];

function activePreset(period: PeriodSelection): PeriodPreset | undefined {
  if (period.preset) return period.preset;
  if (period.offset === 0 && period.key === "year") return "1y";
  return undefined;
}

export function PeriodPicker({
  value,
  onChange,
}: {
  value: PeriodSelection;
  onChange: (v: PeriodSelection) => void;
}) {
  const period = asPeriod(value);
  const selected = activePreset(period);
  const [open, setOpen] = useState(false);
  const current = periodRange(period);
  const [from, setFrom] = useState(() => dateKey(new Date(current.from)));
  const [to, setTo] = useState(() => dateKey(new Date(current.to)));

  function openDates(next: boolean) {
    if (next) {
      const range = periodRange(period);
      setFrom(dateKey(new Date(range.from)));
      setTo(dateKey(new Date(range.to)));
    }
    setOpen(next);
  }

  function applyDates() {
    if (!from || !to) return;
    const bounds = customBounds(from, to);
    const days = (bounds.end.getTime() - bounds.start.getTime()) / 86_400_000;
    onChange({
      key: days > 300 ? "year" : days > 45 ? "month" : days > 10 ? "week" : "day",
      offset: 0,
      preset: "custom",
      from: dateKey(bounds.start),
      to: dateKey(bounds.end),
    });
    setOpen(false);
  }

  return (
    <div role="tablist" aria-label="Reporting period" className={cn(track, "shrink-0")}>
      {PRESETS.map((option) => {
        const on = selected === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange({ key: option.key, offset: 0, preset: option.id })}
            className={cn(pill, "px-3", on ? pillActive : pillIdle)}
          >
            {option.label}
          </button>
        );
      })}
      <Popover open={open} onOpenChange={openDates}>
        <PopoverTrigger asChild>
          <button
            type="button"
            role="tab"
            aria-selected={selected === "custom"}
            aria-expanded={open}
            className={cn(pill, "px-3", selected === "custom" ? pillActive : pillIdle)}
          >
            Select dates
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[22rem] rounded-2xl p-4">
          <p className="text-sm font-semibold text-foreground">Specific dates</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-2xs font-medium tracking-[0.04em] text-ink-3">
              From
              <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="mt-1.5" />
            </label>
            <label className="block text-2xs font-medium tracking-[0.04em] text-ink-3">
              To
              <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="mt-1.5" />
            </label>
          </div>
          <Button type="button" className="mt-3 w-full" disabled={!from || !to} onClick={applyDates}>
            Update
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
