import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyEarnings, listAppointments } from "@/lib/clinic.functions";
import { money } from "@/components/period-picker";
import { moneyWhole } from "@/lib/format";
import { ESSENTIAL_DOC_CATEGORIES } from "@/lib/staff-doc-compliance";
import {
  MONTHS_LONG,
  addDays,
  dayKeyOf,
  nextDays,
  parseDayKey,
  rowLabel,
  shortDay,
  type PatternRow,
  type TimeOffLike,
} from "@/lib/staff-schedule";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { monthRangeOf } from "./profile-helpers";
import type { ProfileMode, ProfileSubject, ProfileTabKey } from "./profile-types";

/** "<Month> so far": the month-to-date share, treatments and outstanding, with the invoice shortcut. */
export function MonthSoFarCard({
  mode,
  subject,
  todayKey,
  onTab,
  onInvoice,
}: {
  mode: ProfileMode;
  subject: ProfileSubject;
  todayKey: string;
  onTab: (tab: ProfileTabKey) => void;
  onInvoice: () => void;
}) {
  const range = useMemo(() => monthRangeOf(todayKey), [todayKey]);
  const fetchEarnings = useServerFn(getMyEarnings);
  const { data } = useQuery({
    queryKey: ["my-earnings", mode === "self" ? "self" : subject.userId, range.from, range.to],
    queryFn: () =>
      fetchEarnings({
        data:
          mode === "self"
            ? { from: range.from, to: range.to }
            : { from: range.from, to: range.to, userId: subject.userId },
      }),
  });
  const monthName = MONTHS_LONG[range.month - 1];
  return (
    <Card
      className="flex flex-col gap-3 border-transparent bg-foreground p-6 text-background shadow-lift"
      data-qc="month-so-far"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-background/80">{monthName} so far</span>
        <button
          type="button"
          onClick={() => onTab("earnings")}
          className="cursor-pointer rounded-full px-2 py-1 text-xs font-semibold text-accent hover:bg-white/10"
          data-qc="see-earnings"
        >
          See earnings
        </button>
      </div>
      <p
        className="text-[34px] font-bold leading-none tracking-[-0.01em]"
        data-qc="metric:earnings.month.share"
      >
        {money(data?.earnedShare ?? 0)}
      </p>
      <p className="flex flex-wrap gap-x-4 text-xs text-background/80">
        <span data-qc="metric:earnings.month.treatments">{data?.treatments ?? 0} treatments</span>
        <span>{moneyWhole(data?.outstandingShare ?? 0)} outstanding</span>
      </p>
      {mode === "self" ? (
        <Button className="mt-1 w-full font-semibold" onClick={onInvoice} data-qc="month-invoice">
          Create {monthName} invoice
        </Button>
      ) : null}
    </Card>
  );
}

/** The next four days from the pattern, with booking counts from the diary. */
export function YourWeekCard({
  mode,
  subject,
  todayKey,
  pattern,
  timeOff,
  onTab,
  onTimeOff,
}: {
  mode: ProfileMode;
  subject: ProfileSubject;
  todayKey: string;
  pattern: PatternRow[];
  timeOff: TimeOffLike[];
  onTab: (tab: ProfileTabKey) => void;
  onTimeOff: () => void;
}) {
  const days = useMemo(() => nextDays(todayKey, 4, pattern, timeOff), [todayKey, pattern, timeOff]);
  const fetchAppointments = useServerFn(listAppointments);
  const from = `${todayKey}T00:00:00.000Z`;
  const to = `${addDays(todayKey, 4)}T00:00:00.000Z`;
  const { data: appts } = useQuery({
    queryKey: ["profile-week", subject.userId, from, to],
    queryFn: () => fetchAppointments({ data: { from, to, practitioner_id: subject.userId } }),
  });
  const countByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of (appts ?? []) as { starts_at: string; status: string | null }[]) {
      if (a.status === "cancelled") continue;
      const key = dayKeyOf(a.starts_at);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [appts]);

  return (
    <Card className="flex flex-col gap-1 p-6" data-qc="your-week">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="section-title">{mode === "self" ? "Your week" : "Their week"}</h2>
        <button
          type="button"
          onClick={() => onTab("schedule")}
          className="cursor-pointer rounded-full px-2 py-1 text-xs font-semibold text-accent-ink hover:bg-accent-wash"
          data-qc="see-schedule"
        >
          Schedule
        </button>
      </div>
      {days.map((d) => {
        const off = d.state !== "work";
        const n = countByDay.get(d.key) ?? 0;
        return (
          <div
            key={d.key}
            className="flex items-center justify-between gap-3 border-t border-edge-2 py-2.5 text-sm"
            data-qc="week-day"
          >
            <span className={cn("font-semibold", off ? "text-ink-3" : "text-foreground")}>
              {shortDay(d.key)}
            </span>
            <span className={cn("text-right", off ? "text-ink-3" : "text-muted-foreground")}>
              {d.state === "work"
                ? `${rowLabel(d.row)} · ${n} booking${n === 1 ? "" : "s"}`
                : d.state === "off"
                  ? "Day off"
                  : d.state === "pending"
                    ? "Time off pending"
                    : d.state === "holiday"
                      ? "Holiday"
                      : d.state === "training"
                        ? "Training"
                        : d.state === "sickness"
                          ? "Off sick"
                          : "Unavailable"}
            </span>
          </div>
        );
      })}
      <Button
        variant="outline"
        className="mt-3 w-full bg-accent-wash hover:bg-accent-soft"
        onClick={onTimeOff}
        data-qc="week-time-off"
      >
        {mode === "self" ? "Request time off" : "Add time off"}
      </Button>
    </Card>
  );
}

/** Essential documents on file, out of ten, with what is missing. */
export function DocumentsSummaryCard({
  mode,
  subject,
  onTab,
}: {
  mode: ProfileMode;
  subject: ProfileSubject;
  onTab: (tab: ProfileTabKey) => void;
}) {
  const total = ESSENTIAL_DOC_CATEGORIES.length;
  const missing = ESSENTIAL_DOC_CATEGORIES.filter(
    (c) => !subject.presentCategories.includes(c.value),
  );
  const done = total - missing.length;
  const pct = Math.round((done / total) * 100);
  return (
    <Card className="flex flex-col gap-2.5 p-6" data-qc="documents-summary">
      <div className="flex items-center justify-between gap-2">
        <h2 className="section-title">Documents</h2>
        <span className="text-sm font-semibold text-foreground" data-qc="metric:documents.onFile">
          {done} of {total}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-glass-2 shadow-inset-hi">
        <div className="h-full rounded-full bg-accent-deep" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm text-muted-foreground">
        {missing.length === 0
          ? "All essential documents are on file."
          : `${missing
              .slice(0, 2)
              .map((m) => m.label)
              .join(
                " and ",
              )}${missing.length > 2 ? ` and ${missing.length - 2} more` : ""} ${missing.length === 1 ? "is" : "are"} missing.`}
      </p>
      <Button
        variant="outline"
        className={cn(
          "mt-1 w-full",
          missing.length > 0 && "bg-destructive-bg/60 text-destructive-ink hover:bg-destructive-bg",
        )}
        onClick={() => onTab("documents")}
        data-qc="documents-open"
      >
        {missing.length > 0 && mode === "self" ? "Upload now" : "Open documents"}
      </Button>
    </Card>
  );
}
