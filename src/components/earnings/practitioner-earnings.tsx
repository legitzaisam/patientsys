import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock,
  Coins,
  Download,
  Hourglass,
  Printer,
  Receipt,
  Repeat,
  Stethoscope,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { getMyEarnings } from "@/lib/clinic.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EarningsLinesTable, type EarningsLine } from "@/components/earnings/earnings-lines-table";
import {
  periodGroupsByMonth,
  periodHeading,
  periodPhrase,
  periodRange,
  money,
  type PeriodSelection,
} from "@/components/period-picker";
import { moneyWhole } from "@/lib/format";

function toCsv(lines: EarningsLine[]) {
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const header = ["Date", "Time", "Patient", "Treatment", "Your share (£)", "Payout"];
  const rows = lines.map((l) => {
    const d = new Date(l.performedAt);
    return [
      d.toLocaleDateString("en-GB"),
      d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
      l.patient,
      l.name,
      l.share.toFixed(2),
      l.payout === "paid" ? "Paid" : l.payout === "pending" ? "Pending" : "",
    ]
      .map(escape)
      .join(",");
  });
  return [header.map(escape).join(","), ...rows].join("\n");
}

function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  qc,
}: {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone?: "danger" | undefined;
  qc?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs tracking-[0.02em] text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
      </div>
      <p
        className={`mt-2 text-[22px] font-semibold tracking-[-0.016em] ${
          tone === "danger" ? "text-destructive" : "text-foreground"
        }`}
        {...(qc ? { "data-qc": qc } : {})}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

export function PractitionerEarnings({
  userId,
  period,
  possessive = "your",
}: {
  userId?: string;
  period: PeriodSelection;
  possessive?: "your" | "their";
}) {
  const range = useMemo(() => periodRange(period), [period]);
  const phrase = periodPhrase(period);
  const fetchEarnings = useServerFn(getMyEarnings);
  const your = possessive === "your";

  const { data } = useQuery({
    queryKey: ["my-earnings", userId ?? "self", range.from, range.to],
    queryFn: () =>
      fetchEarnings({
        data: userId ? { ...range, userId } : range,
      }),
  });

  const lines = (data?.lines ?? []) as EarningsLine[];
  const paidCount = lines.filter((l) => l.payout === "paid").length;
  const pendingCount = lines.filter((l) => l.payout === "pending").length;
  const rate = data?.commissionRate;

  function exportCsv() {
    const blob = new Blob([toCsv(lines)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `earnings-${periodHeading(period).toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div data-qc="profile-earnings-summary">
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={your ? "Your share" : "Their share"}
          value={moneyWhole(data?.earnedShare ?? 0)}
          hint={`Of treatments performed ${phrase}`}
          icon={Wallet}
          qc="metric:earnings.share"
        />
        <Stat
          label="Collected"
          value={moneyWhole(data?.collectedShare ?? 0)}
          hint={your ? "Your share of what patients have paid" : "Their share of what patients have paid"}
          icon={Coins}
          qc="metric:earnings.collected"
        />
        <Stat
          label="Outstanding"
          value={data?.outstandingShare ? moneyWhole(data.outstandingShare) : "—"}
          hint={your ? "Your share still to be paid by patients" : "Their share still to be paid by patients"}
          icon={Hourglass}
          tone={data?.outstandingShare ? "danger" : undefined}
        />
        <Stat
          label="Average per treatment"
          value={money(data?.averageShareValue ?? 0)}
          hint={your ? "Your share, per treatment" : "Their share, per treatment"}
          icon={Receipt}
        />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Treatments"
          value={String(data?.treatments ?? 0)}
          hint={`Performed ${phrase}`}
          icon={Stethoscope}
          qc="metric:earnings.treatments"
        />
        <Stat
          label="Patients seen"
          value={String(data?.patients ?? 0)}
          hint="Unique patients"
          icon={Users}
        />
        <Stat
          label="New patients"
          value={String(data?.newPatients ?? 0)}
          hint="First visit in this period"
          icon={UserPlus}
        />
        <Stat
          label="Retention"
          value={`${data?.retention ?? 0}%`}
          hint="Returned within 12 months"
          icon={Repeat}
        />
      </div>

      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="section-title">Treatments and payouts</h3>
          <p className="mt-1 text-sm text-muted-foreground" data-qc="payout-summary">
            <CalendarClock className="mr-1 inline h-3.5 w-3.5 text-ink-3" aria-hidden />
            {paidCount} paid · {pendingCount} pending
            {typeof rate === "number" ? (
              <span data-qc="earnings-rate">
                {" · "}
                {your ? "your" : "their"} rate is{" "}
                <span className="font-semibold text-foreground">{rate}%</span>
              </span>
            ) : null}
            {data?.bookedAheadShare ? (
              <>
                {" · "}
                {moneyWhole(data.bookedAheadShare)} booked ahead
              </>
            ) : null}
          </p>
        </div>
        <div className="flex shrink-0 gap-2 print:hidden">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportCsv}
            disabled={lines.length === 0}
            data-qc="earnings-export-csv"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export CSV
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            data-qc="earnings-print"
          >
            <Printer className="h-3.5 w-3.5" aria-hidden />
            Print / PDF
          </Button>
        </div>
      </div>

      <EarningsLinesTable
        lines={data?.lines}
        period={periodGroupsByMonth(period) ? "year" : "month"}
      />
    </div>
  );
}
