import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { getMyEarnings, listPractitionerInvoices } from "@/lib/clinic.functions";
import { money } from "@/components/period-picker";
import {
  MONTHS_LONG,
  dailyEarnings,
  daysInMonth,
  groupLinesByDay,
  groupLinesByMonth,
  groupLinesByTreatment,
  invoicePeriod,
  previousMonth,
  shortDay,
  yearMonthOf,
  type EarningsGroup,
} from "@/lib/staff-schedule";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { downloadText, earningsCsv, monthNote } from "./profile-helpers";
import type { EarningsLine, InvoiceRowLike, ProfileMode, ProfileSubject } from "./profile-types";

type Grouping = "day" | "month" | "treatment";

const GROUPINGS: { key: Grouping; label: string }[] = [
  { key: "day", label: "By day" },
  { key: "month", label: "By month" },
  { key: "treatment", label: "By treatment" },
];

const MONTHS_BACK = 11;

/** ISO range for a calendar month in clinic time (the same bounds getMyEarnings expects). */
function monthIsoRange(year: number, month: number): { from: string; to: string } {
  return {
    from: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
    to: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString(),
  };
}

function monthsBetween(a: { year: number; month: number }, b: { year: number; month: number }) {
  return (b.year - a.year) * 12 + (b.month - a.month);
}

function Kpi({
  label,
  value,
  hint,
  tone,
  qc,
  big,
}: {
  label: string;
  value: string;
  hint: React.ReactNode;
  tone?: "destructive";
  qc: string;
  big?: boolean;
}) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-semibold tracking-[-0.01em]",
          big ? "text-[30px]" : "text-[26px]",
          tone === "destructive" ? "text-destructive-ink" : "text-foreground",
        )}
        data-qc={qc}
      >
        {value}
      </p>
      <p className="mt-1 text-[13px] text-muted-foreground">{hint}</p>
    </Card>
  );
}

function SmallTile({ label, value, qc }: { label: string; value: string; qc: string }) {
  return (
    <Card className="px-5 py-4">
      <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1.5 text-[22px] font-semibold text-foreground" data-qc={qc}>
        {value}
      </p>
    </Card>
  );
}

/**
 * Performance & earnings: one calendar month at a time. Everything on the tab
 * is the person's share, per treatment, so the cards, the bars, the table and
 * the CSV reconcile to the penny.
 */
export function EarningsTab({
  mode,
  subject,
  todayKey,
  onInvoice,
}: {
  mode: ProfileMode;
  subject: ProfileSubject;
  todayKey: string;
  onInvoice: (period: { year: number; month: number }) => void;
}) {
  const self = mode === "self";
  const current = useMemo(() => yearMonthOf(todayKey), [todayKey]);
  const [period, setPeriod] = useState(current);
  const [group, setGroup] = useState<Grouping>("day");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const fetchEarnings = useServerFn(getMyEarnings);
  const fetchInvoices = useServerFn(listPractitionerInvoices);
  const target = self ? {} : { userId: subject.userId };

  const range = useMemo(() => monthIsoRange(period.year, period.month), [period]);
  const earnings = useQuery({
    queryKey: ["my-earnings", self ? "self" : subject.userId, range.from, range.to],
    queryFn: () => fetchEarnings({ data: { ...range, ...target } }),
  });

  // By month looks back six months from the selected one.
  const sixMonths = useMemo(() => {
    let start = period;
    for (let i = 0; i < 5; i++) start = previousMonth(start.year, start.month);
    return {
      from: monthIsoRange(start.year, start.month).from,
      to: range.to,
    };
  }, [period, range.to]);
  const history = useQuery({
    queryKey: ["my-earnings", self ? "self" : subject.userId, sixMonths.from, sixMonths.to],
    queryFn: () => fetchEarnings({ data: { ...sixMonths, ...target } }),
    enabled: group === "month",
  });

  const invoices = useQuery({
    queryKey: ["practitioner-invoices", self ? "self" : subject.userId],
    queryFn: () => fetchInvoices({ data: target }),
  });
  const invoiceRows = (invoices.data ?? []) as InvoiceRowLike[];
  const invoiceFor = (year: number, month: number) =>
    invoiceRows.find((r) => r.period_start === invoicePeriod(year, month).start);

  const data = earnings.data;
  const lines = useMemo(() => (data?.lines ?? []) as EarningsLine[], [data]);
  const rate = data?.commissionRate;

  const days = useMemo(
    () => dailyEarnings(lines, period.year, period.month),
    [lines, period.year, period.month],
  );
  const maxEarned = Math.max(1, ...days.map((d) => d.earned));
  const lastWorked = [...days].reverse().find((d) => d.earned > 0 && d.key <= todayKey);
  const picked = days.find((d) => d.key === selectedDay && d.earned > 0) ?? lastWorked ?? null;

  useEffect(() => {
    setSelectedDay(null);
  }, [period.year, period.month]);

  const groups: EarningsGroup[] = useMemo(() => {
    if (group === "day") return groupLinesByDay(lines);
    if (group === "treatment") return groupLinesByTreatment(lines);
    return groupLinesByMonth((history.data?.lines ?? []) as EarningsLine[]);
  }, [group, lines, history.data]);

  const monthName = `${MONTHS_LONG[period.month - 1]} ${period.year}`;
  const isCurrent = period.year === current.year && period.month === current.month;
  const back = monthsBetween(period, current);
  const possessive = self ? "Your" : "Their";
  const earnedTotal = groups.reduce((s, g) => s + g.earned, 0);
  const treatmentsTotal = groups.reduce((s, g) => s + g.treatments, 0);
  const outstandingTotal = groups.reduce((s, g) => s + g.outstanding, 0);

  const colA = group === "day" ? "Date" : group === "month" ? "Month" : "Treatment";
  const colD =
    group === "day" ? "Outstanding" : group === "month" ? "Invoice" : "Share of earnings";

  function cellD(g: EarningsGroup): { text: string; tone: string } {
    if (group === "day") {
      return g.outstanding > 0
        ? { text: money(g.outstanding), tone: "text-destructive-ink" }
        : { text: "—", tone: "text-muted-foreground" };
    }
    if (group === "month") {
      const { year, month } = yearMonthOf(`${g.key}-01`);
      const inv = invoiceFor(year, month);
      if (!inv) return { text: "Not sent", tone: "text-warning-ink" };
      if (inv.status === "paid") return { text: "Paid", tone: "text-success-ink" };
      if (inv.status === "sent") return { text: "Sent", tone: "text-warning-ink" };
      return { text: "Scheduled", tone: "text-muted-foreground" };
    }
    const pct = earnedTotal > 0 ? Math.round((g.earned / earnedTotal) * 100) : 0;
    return { text: `${pct}%`, tone: "text-foreground" };
  }

  const footD =
    group === "day"
      ? money(outstandingTotal)
      : group === "month"
        ? ""
        : earnedTotal > 0
          ? "100%"
          : "—";
  const footA = group === "month" ? "Last 6 months" : `${MONTHS_LONG[period.month - 1]} total`;

  const lastDay = daysInMonth(period.year, period.month);

  return (
    <div className="flex flex-col gap-5" data-qc="profile-earnings-tab">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            aria-label="Previous month"
            disabled={back >= MONTHS_BACK}
            onClick={() => setPeriod(previousMonth(period.year, period.month))}
            data-qc="earnings-prev-month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2
            className="min-w-[170px] text-center text-[19px] font-semibold text-foreground"
            data-qc="earnings-month"
          >
            {monthName}
          </h2>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-10 w-10 rounded-full"
            aria-label="Next month"
            disabled={isCurrent}
            onClick={() => {
              const next =
                period.month === 12
                  ? { year: period.year + 1, month: 1 }
                  : { year: period.year, month: period.month + 1 };
              setPeriod(next);
            }}
            data-qc="earnings-next-month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-1.5 text-sm text-muted-foreground" data-qc="earnings-month-note">
            {monthNote(period.year, period.month, todayKey, invoiceFor(period.year, period.month))}
          </span>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              downloadText(
                `earnings-${period.year}-${String(period.month).padStart(2, "0")}.csv`,
                earningsCsv(lines),
              )
            }
            disabled={lines.length === 0}
            data-qc="earnings-export-csv"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export CSV
          </Button>
          {self ? (
            <Button type="button" onClick={() => onInvoice(period)} data-qc="earnings-invoice">
              Create &amp; send invoice
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label={`${possessive} earnings`}
          value={money(data?.earnedShare ?? 0)}
          hint={
            <>
              <span data-qc="earnings-rate">
                {possessive} share{typeof rate === "number" ? ` at ${rate}%` : ""}
              </span>{" "}
              of treatments delivered
            </>
          }
          qc="metric:earnings.share"
          big
        />
        <Kpi
          label="Collected"
          value={money(data?.collectedShare ?? 0)}
          hint="Bookings marked paid"
          qc="metric:earnings.collected"
        />
        <Kpi
          label="Outstanding"
          value={money(data?.outstandingShare ?? 0)}
          hint="Unpaid or deposit only"
          {...(data?.outstandingShare ? { tone: "destructive" as const } : {})}
          qc="metric:earnings.outstanding"
        />
        <Kpi
          label="Treatments"
          value={String(data?.treatments ?? 0)}
          hint={`${money(data?.averageShareValue ?? 0)} average value`}
          qc="metric:earnings.treatments"
        />
      </div>

      <Card className="flex flex-col gap-4 p-6" data-qc="earnings-daily">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="section-title">Daily earnings</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">Tap a day to see the detail</p>
          </div>
          <div
            className="min-w-[200px] rounded-2xl bg-accent-soft px-3.5 py-2.5 text-right"
            data-qc="earnings-day-detail"
          >
            {picked ? (
              <>
                <p className="text-[13px] text-muted-foreground">{shortDay(picked.key, true)}</p>
                <p className="text-xl font-semibold text-foreground" data-qc="metric:earnings.day">
                  {money(picked.earned)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {picked.treatments} treatment{picked.treatments === 1 ? "" : "s"} ·{" "}
                  {picked.outstanding > 0
                    ? `${money(picked.outstanding)} outstanding`
                    : "all collected"}
                </p>
              </>
            ) : (
              <p className="text-[13px] text-muted-foreground">Nothing earned yet this month</p>
            )}
          </div>
        </div>
        <div
          className="flex h-[190px] items-end gap-1.5 border-b border-edge-2 pb-1"
          role="img"
          aria-label={`Daily earnings for ${monthName}`}
        >
          {days.map((d) => {
            if (d.key > todayKey) {
              return (
                <div
                  key={d.key}
                  className="h-[70px] min-w-0 flex-1 rounded-t-lg rounded-b border-2 border-dashed border-edge-2"
                  aria-hidden
                />
              );
            }
            if (d.earned <= 0) {
              return (
                <div key={d.key} className="h-1 min-w-0 flex-1 rounded bg-glass-2" aria-hidden />
              );
            }
            const on = picked?.key === d.key;
            return (
              <button
                key={d.key}
                type="button"
                aria-label={`${shortDay(d.key, true)}, ${money(d.earned)}`}
                aria-pressed={on}
                onClick={() => setSelectedDay(d.key)}
                className={cn(
                  "min-w-0 flex-1 cursor-pointer rounded-t-lg rounded-b transition-colors",
                  on ? "bg-accent" : "bg-foreground hover:bg-foreground/85",
                )}
                style={{ height: `${Math.max(6, Math.round((d.earned / maxEarned) * 170))}px` }}
                data-qc="earnings-bar"
              />
            );
          })}
        </div>
        <div className="flex justify-between text-xs text-muted-foreground" aria-hidden>
          <span>1</span>
          <span>8</span>
          <span>15</span>
          <span>22</span>
          <span>{lastDay}</span>
        </div>
      </Card>

      <Card className="overflow-hidden p-0" data-qc="earnings-table">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
          <h3 className="section-title">Earnings table</h3>
          <div
            role="group"
            aria-label="Group by"
            className="flex h-[34px] items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi"
          >
            {GROUPINGS.map((g) => (
              <button
                key={g.key}
                type="button"
                aria-pressed={group === g.key}
                onClick={() => setGroup(g.key)}
                className={cn(
                  "h-7 cursor-pointer rounded-full px-3.5 text-xs tracking-[0.02em] transition-colors",
                  group === g.key
                    ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                    : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]",
                )}
                data-qc={`earnings-group-${g.key}`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        <div className="scroll-x-plain">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-glass-2 text-left">
                <th
                  scope="col"
                  className="px-6 py-3 text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  {colA}
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-right text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Treatments
                </th>
                <th
                  scope="col"
                  className="px-3 py-3 text-right text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  Earned
                </th>
                <th
                  scope="col"
                  className="py-3 pl-3 pr-6 text-right text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                >
                  {colD}
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-muted-foreground">
                    {group === "month" && history.isLoading
                      ? "Loading…"
                      : `No treatments in ${group === "month" ? "the last six months" : monthName}.`}
                  </td>
                </tr>
              ) : (
                groups.map((g) => {
                  const d = cellD(g);
                  return (
                    <tr key={g.key} className="border-t border-edge-2" data-qc="earnings-row">
                      <td className="px-6 py-3 font-semibold text-foreground">{g.label}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{g.treatments}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-foreground">
                        {money(g.earned)}
                      </td>
                      <td
                        className={cn(
                          "py-3 pl-3 pr-6 text-right font-semibold tabular-nums",
                          d.tone,
                        )}
                      >
                        {d.text}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-edge-2 bg-glass-2">
                <th scope="row" className="px-6 py-3 text-left font-bold text-foreground">
                  {footA}
                </th>
                <td className="px-3 py-3 text-right font-bold tabular-nums">{treatmentsTotal}</td>
                <td
                  className="px-3 py-3 text-right font-bold tabular-nums"
                  data-qc="metric:earnings.table.total"
                >
                  {money(earnedTotal)}
                </td>
                <td className="py-3 pl-3 pr-6 text-right font-bold tabular-nums">{footD}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <SmallTile
          label="Patients seen"
          value={String(data?.patients ?? 0)}
          qc="metric:earnings.patients"
        />
        <SmallTile
          label="New patients"
          value={String(data?.newPatients ?? 0)}
          qc="metric:earnings.newPatients"
        />
        <SmallTile
          label="Attendance"
          value={`${data?.attendance ?? 0}%`}
          qc="metric:earnings.attendance"
        />
        <SmallTile
          label="Retention"
          value={`${data?.retention ?? 0}%`}
          qc="metric:earnings.retention"
        />
      </div>
    </div>
  );
}
