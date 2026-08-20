import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowRight, ArrowUp, Calendar, PoundSterling, Repeat, Users } from "lucide-react";
import { cn } from "@/lib/utils";

type ChipTone = "mint" | "rose" | "gold" | "lilac" | "sky" | "peach";

const CHIP_TONE: Record<ChipTone, string> = {
  mint: "bg-success-bg text-success-ink",
  rose: "bg-destructive-bg text-destructive-ink",
  gold: "bg-accent-soft text-accent-ink",
  lilac: "bg-warning-bg text-warning-ink",
  sky: "bg-sky-bg text-sky-ink",
  peach: "bg-[rgba(250,204,226,0.48)] text-aftercare-ink",
};

type KpiChip = {
  id: string;
  label: string;
  tone: ChipTone;
  icon?: "up" | "down";
};

function percentChip(id: string, change: number): KpiChip {
  const rounded = Math.round(change);
  return {
    id,
    label: `${Math.abs(rounded)}%`,
    tone: rounded > 0 ? "mint" : rounded < 0 ? "rose" : "sky",
    icon: rounded > 0 ? "up" : rounded < 0 ? "down" : undefined,
  };
}

function ChipRow({ chips }: { chips: KpiChip[] }) {
  if (!chips.length) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-inset-hi",
            CHIP_TONE[chip.tone],
          )}
        >
          {chip.icon === "up" && <ArrowUp className="h-3 w-3" aria-hidden />}
          {chip.icon === "down" && <ArrowDown className="h-3 w-3" aria-hidden />}
          {chip.label}
        </span>
      ))}
    </div>
  );
}

export function KpiGrid({
  kpis,
  canRetention = true,
  canRevenue = true,
}: {
  kpis: any;
  canRetention?: boolean;
  canRevenue?: boolean;
}) {
  const items = [
    ...(canRetention
      ? [
          {
            label: "Retention rate",
            value: `${kpis?.retention ?? 0}%`,
            hint: `${kpis?.repeatClients ?? 0} returning · ${kpis?.oneVisitClients ?? 0} one visit only`,
            icon: Repeat,
            accent: true,
            to: "/retention",
            chips: [
              percentChip("retention-change", kpis?.retentionChange ?? 0),
              {
                id: "revenue-at-risk",
                label: `£${Number(kpis?.revenueAtRisk ?? 0).toLocaleString()} at risk`,
                tone: "lilac" as const,
              },
              {
                id: "patients-to-chase",
                label: `${kpis?.patientsToChase ?? 0} to chase`,
                tone: "peach" as const,
              },
            ],
          },
        ]
      : []),
    {
      label: "Total clients",
      value: kpis?.totalClients ?? "—",
      hint: `${kpis?.activeClients ?? 0} active · ${kpis?.inactiveClients ?? 0} inactive`,
      icon: Users,
      to: "/patients",
      search: { view: "all" },
      chips: [percentChip("patients-change", kpis?.patientChange ?? 0)],
    },
    {
      label: "Treatments due",
      value: kpis?.treatmentsDue ?? "—",
      hint: "Next 30 days",
      icon: Calendar,
      to: "/patients",
      search: { view: "due" },
      chips: [
        {
          id: "treatments-due",
          label: `${kpis?.treatmentsDueSoon ?? 0} due`,
          tone: "gold" as const,
        },
        {
          id: "treatments-overdue",
          label: `${kpis?.treatmentsOverdue ?? 0} overdue`,
          tone: "rose" as const,
        },
      ],
    },
    ...(canRevenue
      ? [
          {
            label: "Revenue this month",
            value: `£${(kpis?.revenueMonth ?? 0).toLocaleString()}`,
            hint: `${kpis?.treatmentsMonth ?? 0} treatment${(kpis?.treatmentsMonth ?? 0) === 1 ? "" : "s"} delivered`,
            icon: PoundSterling,
            to: "/performance",
            chips: [percentChip("revenue-change", kpis?.revenueChange ?? 0)],
          },
        ]
      : []),
  ] as any[];

  const cols =
    items.length >= 4 ? "lg:grid-cols-4" : items.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2";

  return (
    <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${cols}`}>
      {items.map((item) => {
        const body = (
          <>
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              {"to" in item && item.to ? (
                <ArrowRight className="h-4 w-4 text-ink-3" aria-hidden />
              ) : (
                <item.icon className="h-4 w-4 text-ink-3" />
              )}
            </div>
            <p
              className={`mt-2.5 text-[27px] font-semibold leading-none tracking-[-0.02em] tabular-nums ${
                item.accent ? "text-accent-ink" : "text-foreground"
              }`}
            >
              {item.value}
            </p>
            {item.hint && <p className="mt-2 text-2xs text-muted-foreground">{item.hint}</p>}
            <ChipRow chips={item.chips ?? []} />
          </>
        );
        const className = "glass-card block p-[18px] text-left transition-shadow hover:shadow-lift";
        return "to" in item && item.to ? (
          <Link key={item.label} to={item.to} search={item.search ?? {}} className={className}>
            {body}
          </Link>
        ) : (
          <div key={item.label} className={className}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
