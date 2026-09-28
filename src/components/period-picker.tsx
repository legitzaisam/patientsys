import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PERIOD,
  londonDayKey,
  londonParts,
  previousPeriod,
  resolvePeriod,
  type PeriodKey,
  type PeriodPreset,
  type PeriodSelection,
} from "@/lib/metrics/period";

export type { PeriodKey, PeriodPreset, PeriodSelection };

/** The current calendar month. */
export const CURRENT_MONTH: PeriodSelection = { key: "month", offset: 0, preset: "1m" };
/**
 * The default for every metrics page: the 12 whole calendar months ending
 * with the current month, in London time (metrics/period).
 */
export const CURRENT_YEAR: PeriodSelection = DEFAULT_PERIOD;

const MAX_OFFSET: Record<PeriodKey, number> = {
  day: 365,
  week: 104,
  month: 36,
  year: 8,
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

/** Calendar parts of the London day holding `ms`, as a local Date for display only. */
function displayDate(ms: number) {
  const p = londonParts(ms);
  return new Date(p.year, p.month - 1, p.day);
}

function boundsOf(period: PeriodSelection, now: Date) {
  const w = resolvePeriod(period, now.getTime());
  return { start: displayDate(w.fromMs), end: displayDate(w.toMs), window: w };
}

function shift(period: PeriodSelection, now: Date) {
  return boundsOf({ key: period.key, offset: period.offset }, now);
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
  return { start: parseDateKey(startKey), end: parseDateKey(endKey) };
}

/** Inclusive ISO range for the selected period: London midnights (metrics/period). */
export function periodRange(period: PeriodKey | PeriodSelection, now: Date = new Date()): { from: string; to: string } {
  const w = resolvePeriod(asPeriod(period), now.getTime());
  return { from: new Date(w.fromMs).toISOString(), to: new Date(w.toMs).toISOString() };
}

/** Same span, immediately before `periodRange`. */
export function previousPeriodRange(period: PeriodKey | PeriodSelection, now: Date = new Date()) {
  const w = previousPeriod(asPeriod(period), now.getTime());
  return { from: new Date(w.fromMs).toISOString(), to: new Date(w.toMs).toISOString() };
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

function dayMonthYear(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Short label for the resolved window (stepper and section copy). */
export function periodWindowLabel(period: PeriodKey | PeriodSelection, now: Date = new Date()) {
  const selection = asPeriod(period);
  // Presets and custom ranges read as their dates, not a calendar unit.
  if (selection.preset) {
    const { start, end } = boundsOf(selection, now);
    return `${dayMonthYear(start)} – ${dayMonthYear(end)}`;
  }
  const { start, end } = shift(selection, now);
  const { key } = selection;
  if (key === "day") return dayMonth(start);
  if (key === "week") {
    if (start.getMonth() === end.getMonth()) return `${start.getDate()}–${dayMonth(end)}`;
    return `${dayMonth(start)} – ${dayMonth(end)}`;
  }
  if (key === "year") return String(start.getFullYear());
  return start.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

/** What each preset covers, in words. */
const PRESET_HEADING: Record<PeriodPreset, string> = {
  "1w": "Last 7 days",
  "1m": "This month",
  "6m": "Last 6 months",
  "1y": "Last 12 months",
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

/**
 * Sentence fragment naming the window, for card hints and subtitles:
 * "in the last 12 months", "this month", "in Aug 2026", "on 5 Sep".
 */
export function periodPhrase(period: PeriodKey | PeriodSelection, now: Date = new Date()) {
  const selection = asPeriod(period);
  const heading = periodHeading(selection, now);
  if (selection.preset && selection.preset !== "custom") return `in the ${heading.toLowerCase()}`;
  if (selection.preset === "custom" && selection.from && selection.to) {
    return selection.from === selection.to ? `on ${heading}` : `over ${heading}`;
  }
  if (selection.offset <= 1) return heading.toLowerCase();
  return selection.key === "day" ? `on ${heading}` : `in ${heading}`;
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
  { id: "1w", label: "7 days", key: "week" },
  { id: "1m", label: "1 month", key: "month" },
  { id: "6m", label: "6 months", key: "month" },
  { id: "1y", label: "12 months", key: "year" },
];

/** The pill to highlight. A selection without a preset maps to the nearest one, so something is always active. */
function activePreset(period: PeriodSelection): PeriodPreset | undefined {
  if (period.preset) return period.preset;
  if (period.offset !== 0) return undefined;
  if (period.key === "year") return "1y";
  if (period.key === "month") return "1m";
  if (period.key === "week") return "1w";
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
  const [from, setFrom] = useState(() => londonDayKey(new Date(current.from).getTime()));
  const [to, setTo] = useState(() => londonDayKey(new Date(current.to).getTime()));

  function openDates(next: boolean) {
    if (next) {
      const range = periodRange(period);
      setFrom(londonDayKey(new Date(range.from).getTime()));
      setTo(londonDayKey(new Date(range.to).getTime()));
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
    <div role="tablist" aria-label="Reporting period" className={cn(track, "scroll-x-plain max-w-full shrink-0 flex-nowrap")}>
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
