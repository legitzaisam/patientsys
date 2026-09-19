import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { PatientAvatar } from "@/components/patient-avatar";
import { Card } from "@/components/ui/card";
import { money, type PeriodKey } from "@/components/period-picker";
import { cn } from "@/lib/utils";

export type EarningsLine = {
  id: string;
  performedAt: string;
  name: string;
  patient: string;
  patientId?: string | undefined;
  share: number;
};

type LineGroup = {
  key: string;
  label: string;
  lines: EarningsLine[];
  total: number;
  patients: number;
};

const LIST_MAX_H = "max-h-[min(28rem,calc(100dvh-18rem))]";

function monthKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7)) - 1;
  return new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function dayLabel(key: string) {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7)) - 1;
  const day = Number(key.slice(8, 10));
  return new Date(year, month, day).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function summarise(lines: EarningsLine[]): Omit<LineGroup, "key" | "label" | "lines"> {
  return {
    total: lines.reduce((sum, line) => sum + line.share, 0),
    patients: new Set(lines.map((line) => line.patientId ?? line.patient)).size,
  };
}

function groupLines(lines: EarningsLine[], kind: "month" | "day"): LineGroup[] {
  const map = new Map<string, EarningsLine[]>();
  for (const line of lines) {
    const key = kind === "month" ? monthKey(line.performedAt) : dayKey(line.performedAt);
    const list = map.get(key);
    if (list) list.push(line);
    else map.set(key, [line]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([key, grouped]) => ({
      key,
      label: kind === "month" ? monthLabel(key) : dayLabel(key),
      lines: grouped,
      ...summarise(grouped),
    }));
}

function PatientCell({ line }: { line: EarningsLine }) {
  const name = (
    <span className="truncate font-medium text-foreground">
      {line.patientId && line.patient !== "—" ? (
        <Link to="/patients/$id" params={{ id: line.patientId }} className="hover:text-accent-ink">
          {line.patient}
        </Link>
      ) : (
        line.patient
      )}
    </span>
  );
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <PatientAvatar patientId={line.patientId} name={line.patient} size="xs" />
      {name}
    </div>
  );
}

function LineRow({ line }: { line: EarningsLine }) {
  return (
    <tr>
      <td className="px-5 py-2.5 pl-12 text-xs tabular-nums text-muted-foreground">{timeLabel(line.performedAt)}</td>
      <td className="px-5 py-2.5">
        <PatientCell line={line} />
      </td>
      <td className="px-5 py-2.5">
        <span
          title={line.name}
          className="inline-flex max-w-full truncate rounded-full bg-glass-2 px-2.5 py-0.5 text-xs text-foreground shadow-inset-hi"
        >
          {line.name}
        </span>
      </td>
      <td className="px-5 py-2.5 text-right text-sm font-semibold tabular-nums text-foreground">
        {money(line.share)}
      </td>
    </tr>
  );
}

function GroupRow({
  label,
  patients,
  treatments,
  total,
  open,
  onToggle,
  inset,
  ariaLabel,
}: {
  label: string;
  patients: number;
  treatments: number;
  total: number;
  open: boolean;
  onToggle: () => void;
  inset?: boolean | undefined;
  ariaLabel: string;
}) {
  return (
    <tr
      className={cn("cursor-pointer", open && "bg-[rgba(47,63,102,0.08)]")}
      onClick={onToggle}
    >
      <td className={cn("px-5 py-3", inset && "pl-10")}>
        <button
          type="button"
          aria-expanded={open}
          aria-label={ariaLabel}
          className="flex w-full items-center gap-2 text-left font-semibold text-foreground"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
        >
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-ink-3 transition-transform", open && "rotate-180")}
          />
          <span className="truncate">{label}</span>
        </button>
      </td>
      <td className="px-5 py-3 text-xs tabular-nums text-muted-foreground">
        {patients} patient{patients === 1 ? "" : "s"}
      </td>
      <td className="px-5 py-3 text-xs tabular-nums text-muted-foreground">
        {treatments} treatment{treatments === 1 ? "" : "s"}
      </td>
      <td className="px-5 py-3 text-right text-sm font-semibold tabular-nums text-foreground">
        {money(total)}
      </td>
    </tr>
  );
}

function DayBlocks({
  days,
  openDays,
  onToggleDay,
  inset,
}: {
  days: LineGroup[];
  openDays: Set<string>;
  onToggleDay: (key: string) => void;
  inset?: boolean | undefined;
}) {
  return (
    <>
      {days.map((day) => {
        const open = openDays.has(day.key);
        return (
          <Fragment key={day.key}>
            <GroupRow
              label={day.label}
              patients={day.patients}
              treatments={day.lines.length}
              total={day.total}
              open={open}
              inset={inset}
              onToggle={() => onToggleDay(day.key)}
              ariaLabel={`${open ? "Hide" : "Show"} treatments for ${day.label}`}
            />
            {open && day.lines.map((line) => <LineRow key={line.id} line={line} />)}
          </Fragment>
        );
      })}
    </>
  );
}

export function EarningsLinesTable({
  lines,
  period,
}: {
  lines: EarningsLine[] | undefined;
  period: PeriodKey;
}) {
  const months = useMemo(() => groupLines(lines ?? [], "month"), [lines]);
  const daysByMonth = useMemo(() => {
    const map = new Map<string, LineGroup[]>();
    for (const month of months) map.set(month.key, groupLines(month.lines, "day"));
    return map;
  }, [months]);
  const allDays = useMemo(() => groupLines(lines ?? [], "day"), [lines]);
  const byMonth = period === "year";
  const seedKey = `${period}:${months.map((month) => month.key).join(",")}:${allDays.map((day) => day.key).join(",")}`;

  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set());
  const [openDays, setOpenDays] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const today = dayKey(new Date().toISOString());
    const currentMonth = monthKey(new Date().toISOString());

    if (period !== "year") {
      setOpenMonths(new Set());
      setOpenDays((prev) => {
        if (prev.size > 0) return prev;
        const pick = allDays.some((day) => day.key === today) ? today : allDays[0]?.key;
        return pick ? new Set([pick]) : new Set();
      });
      return;
    }

    setOpenMonths((prev) => {
      if (prev.size > 0) return prev;
      const pick = months.some((month) => month.key === currentMonth) ? currentMonth : months[0]?.key;
      return pick ? new Set([pick]) : new Set();
    });
    setOpenDays((prev) => {
      if (prev.size > 0) return prev;
      const monthDays = daysByMonth.get(
        months.some((month) => month.key === currentMonth) ? currentMonth : months[0]?.key ?? "",
      ) ?? [];
      const pick = monthDays.some((day) => day.key === today) ? today : monthDays[0]?.key;
      return pick ? new Set([pick]) : new Set();
    });
  }, [period, seedKey, allDays, daysByMonth, months]);

  function toggleMonth(key: string) {
    setOpenMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleDay(key: string) {
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const total = (lines ?? []).reduce((sum, line) => sum + line.share, 0);
  const count = lines?.length ?? 0;

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-edge px-5 py-3.5 sm:px-6">
        <p className="text-sm font-semibold text-foreground">{byMonth ? "Earnings by month" : "Treatments"}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {byMonth ? "Open a month, then a day, for each treatment." : "Open a day for each treatment."}
        </p>
      </div>

      {!lines ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">Loading treatments…</p>
      ) : count === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted-foreground">
          No treatments recorded in this period.
        </p>
      ) : (
        <>
          <div className={cn(LIST_MAX_H, "overflow-auto overscroll-contain")}>
            <table className="glass-table w-full min-w-[640px] table-fixed text-sm">
              <colgroup>
                <col className="w-1/4" />
                <col className="w-1/4" />
                <col className="w-1/4" />
                <col className="w-1/4" />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="bg-card px-5 py-3">Date</th>
                  <th className="bg-card px-5 py-3">Patient</th>
                  <th className="bg-card px-5 py-3">Treatment</th>
                  <th className="bg-card px-5 py-3">Your earnings</th>
                </tr>
              </thead>
              <tbody>
                {byMonth
                  ? months.map((month) => {
                      const open = openMonths.has(month.key);
                      return (
                        <Fragment key={month.key}>
                          <GroupRow
                            label={month.label}
                            patients={month.patients}
                            treatments={month.lines.length}
                            total={month.total}
                            open={open}
                            onToggle={() => toggleMonth(month.key)}
                            ariaLabel={`${open ? "Hide" : "Show"} ${month.label}`}
                          />
                          {open && (
                            <DayBlocks
                              days={daysByMonth.get(month.key) ?? []}
                              openDays={openDays}
                              onToggleDay={toggleDay}
                              inset
                            />
                          )}
                        </Fragment>
                      );
                    })
                  : (
                    <DayBlocks days={allDays} openDays={openDays} onToggleDay={toggleDay} />
                  )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-edge px-5 py-3 sm:px-6">
            <p className="text-sm font-semibold text-foreground">
              {byMonth ? "Year total" : "Period total"}
              <span className="ml-2 font-normal tabular-nums text-muted-foreground">
                · {count} treatment{count === 1 ? "" : "s"}
              </span>
            </p>
            <p className="text-sm font-semibold tabular-nums text-foreground">{money(total)}</p>
          </div>
        </>
      )}
    </Card>
  );
}
