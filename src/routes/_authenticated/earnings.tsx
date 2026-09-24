import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { getMyEarnings } from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { EarningsLinesTable } from "@/components/earnings/earnings-lines-table";
import { CURRENT_YEAR, PeriodPicker, periodGroupsByMonth, periodRange, money, type PeriodSelection } from "@/components/period-picker";

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

function EarningsPage() {
  const { data: identity } = useIdentity();
  const [period, setPeriod] = useState<PeriodSelection>(CURRENT_YEAR);
  const range = useMemo(() => periodRange(period), [period]);
  const fetchEarnings = useServerFn(getMyEarnings);

  const { data } = useQuery({
    queryKey: ["my-earnings", range.from, range.to],
    queryFn: () => fetchEarnings({ data: range }),
    enabled: !!identity?.isStaff,
  });

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;

  return (
    <AppShell identity={identity}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My earnings</h1>
          <p className="page-subtitle">
            Your share of the treatments you have delivered, with your own performance figures.
          </p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Earned" value={money(data?.earnedShare ?? 0)} hint="Treatments performed" />
        <Stat label="Collected" value={money(data?.collectedShare ?? 0)} hint="Payments received" />
        <Stat
          label="Outstanding"
          value={data?.outstanding ? money(data.outstanding) : "—"}
          hint="Unpaid or deposit only"
          tone={data?.outstanding ? "danger" : undefined}
        />
        <Stat label="Average value" value={money(data?.averageValue ?? 0)} hint="Per treatment" />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Treatments" value={String(data?.treatments ?? 0)} hint="In this period" />
        <Stat label="Patients seen" value={String(data?.patients ?? 0)} hint="Unique patients" />
        <Stat label="New patients" value={String(data?.newPatients ?? 0)} hint="First visit in period" />
        <Stat label="Retention" value={`${data?.retention ?? 0}%`} hint="Returned within 12 months" />
      </div>

      <EarningsLinesTable lines={data?.lines} period={periodGroupsByMonth(period) ? "year" : "month"} />
    </AppShell>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "danger";
}) {
  return (
    <Card className="p-5">
      <p className="text-xs tracking-[0.02em] text-muted-foreground">{label}</p>
      <p
        className={`mt-2 text-[22px] font-semibold tracking-[-0.016em] ${
          tone === "danger" ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Wallet className="h-3 w-3 text-ink-3" /> {hint}
      </p>
    </Card>
  );
}