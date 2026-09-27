import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
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
import { can } from "@/lib/permissions";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EarningsLinesTable, type EarningsLine } from "@/components/earnings/earnings-lines-table";
import {
  CURRENT_YEAR,
  PeriodPicker,
  periodGroupsByMonth,
  periodHeading,
  periodPhrase,
  periodRange,
  money,
  type PeriodSelection,
} from "@/components/period-picker";
import { moneyWhole } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/earnings")({
  head: () => ({
    meta: [
      { title: "My earnings — Aetheria" },
      {
        name: "description",
        content: "Your own earnings, treatments delivered, new patients and retention rate.",
      },
      { property: "og:title", content: "My earnings — Aetheria" },
      { property: "og:description", content: "Your earnings and personal performance figures." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EarningsPage,
});

/** Rows for the accountant: one line per treatment, in the practitioner's share. */
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

function EarningsPage() {
  const { data: identity } = useIdentity();
  const [period, setPeriod] = useState<PeriodSelection>(CURRENT_YEAR);
  const range = useMemo(() => periodRange(period), [period]);
  const phrase = periodPhrase(period);
  const fetchEarnings = useServerFn(getMyEarnings);
  // My earnings is for people who treat: an owner with no treatments in the
  // last 12 months does not see it (the nav link is hidden by the same rule).
  const treats = Boolean(identity && (!identity.isOwner || identity.treatsPatients));

  const { data } = useQuery({
    queryKey: ["my-earnings", range.from, range.to],
    queryFn: () => fetchEarnings({ data: range }),
    enabled: Boolean(identity && treats && can(identity, "view.earnings")),
  });

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;

  if (!treats) {
    return (
      <AppShell identity={identity}>
        <div className="page-header">
          <div>
            <h1 className="page-title">My earnings</h1>
            <p className="page-subtitle">Your share of the treatments you deliver.</p>
          </div>
        </div>
        <Card className="p-8 text-center text-sm text-muted-foreground" data-qc="earnings-hidden">
          This page is for practitioners who treat patients. You have not recorded a treatment in
          the last 12 months, so there is nothing to show here; the clinic's figures live on
          Performance.
        </Card>
      </AppShell>
    );
  }

  const lines = (data?.lines ?? []) as EarningsLine[];
  const paidCount = lines.filter((l) => l.payout === "paid").length;
  const pendingCount = lines.filter((l) => l.payout === "pending").length;
  const rate = data?.commissionRate;

  function exportCsv() {
    const blob = new Blob([toCsv(lines)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-earnings-${periodHeading(period).toLowerCase().replace(/\s+/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <AppShell identity={identity}>
      <div className="page-header print:mb-4">
        <div>
          <h1 className="page-title">My earnings</h1>
          <p className="page-subtitle">
            Your share of the treatments you delivered {phrase}
            {typeof rate === "number" ? (
              <span data-qc="earnings-rate">
                {" · "}
                your rate is <span className="font-semibold text-foreground">{rate}%</span>
              </span>
            ) : null}
            .
          </p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Your share"
          value={moneyWhole(data?.earnedShare ?? 0)}
          hint={`Of treatments performed ${phrase}`}
          icon={Wallet}
          qc="metric:earnings.share"
        />
        <Stat
          label="Collected"
          value={moneyWhole(data?.collectedShare ?? 0)}
          hint="Your share of what patients have paid"
          icon={Coins}
          qc="metric:earnings.collected"
        />
        <Stat
          label="Outstanding"
          value={data?.outstandingShare ? moneyWhole(data.outstandingShare) : "—"}
          hint="Your share still to be paid by patients"
          icon={Hourglass}
          tone={data?.outstandingShare ? "danger" : undefined}
        />
        <Stat
          label="Average per treatment"
          value={money(data?.averageShareValue ?? 0)}
          hint="Your share, per treatment"
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

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="section-title">Treatments and payouts</h2>
          <p className="mt-1 text-sm text-muted-foreground" data-qc="payout-summary">
            <CalendarClock className="mr-1 inline h-3.5 w-3.5 text-ink-3" aria-hidden />
            {paidCount} paid · {pendingCount} pending
            {data?.bookedAheadShare ? (
              <>
                {" · "}
                {moneyWhole(data.bookedAheadShare)} booked ahead (your share)
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
      {/* Keep the period total clear of the floating dock on tablets. */}
      <div aria-hidden className="h-[calc(var(--dock-h,0px)+0.5rem)] print:hidden" />
    </AppShell>
  );
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
