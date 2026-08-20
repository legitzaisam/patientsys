import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { getMyEarnings } from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { PeriodPicker, periodRange, money, type PeriodKey } from "@/components/period-picker";

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
  const [period, setPeriod] = useState<PeriodKey>("month");
  const range = useMemo(() => periodRange(period), [period]);
  const fetchEarnings = useServerFn(getMyEarnings);

  const { data } = useQuery({
    queryKey: ["my-earnings", period],
    queryFn: () => fetchEarnings({ data: range }),
    enabled: !!identity?.isStaff,
  });

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;

  return (
    <AppShell identity={identity}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My earnings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your share of the treatments you have delivered, with your own performance figures.
          </p>
        </div>
        <PeriodPicker value={period} onChange={setPeriod} />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Earned" value={money(data?.earnedShare ?? 0)} hint="Treatments performed" />
        <Stat label="Collected" value={money(data?.collectedShare ?? 0)} hint="Payments received" />
        <Stat label="Treatments" value={String(data?.treatments ?? 0)} hint="In this period" />
        <Stat label="Average value" value={money(data?.averageValue ?? 0)} hint="Per treatment" />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Patients seen" value={String(data?.patients ?? 0)} hint="Unique patients" />
        <Stat label="New patients" value={String(data?.newPatients ?? 0)} hint="First visit in period" />
        <Stat label="Retention" value={`${data?.retention ?? 0}%`} hint="Returned within 12 months" />
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="glass-table w-full min-w-[560px] text-sm">
          <thead>
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Treatment</th>
              <th className="px-4 py-3 text-right">Your earnings</th>
            </tr>
          </thead>
          <tbody>
            {(data?.lines ?? []).map((l) => (
              <tr key={l.id} className="border-b border-glass-line last:border-0">
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(l.performedAt).toLocaleDateString("en-GB")}
                </td>
                <td className="px-4 py-3 text-foreground">{l.patient}</td>
                <td className="px-4 py-3">{l.name}</td>
                <td className="px-4 py-3 text-right text-foreground">{money(l.share)}</td>
              </tr>
            ))}
            {data && data.lines.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-muted-foreground">
                  No treatments recorded in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </AppShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Card className="p-5">
      <p className="text-xs tracking-[0.02em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-[22px] font-semibold tracking-[-0.016em] text-foreground">{value}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        <Wallet className="h-3 w-3 text-ink-3" /> {hint}
      </p>
    </Card>
  );
}