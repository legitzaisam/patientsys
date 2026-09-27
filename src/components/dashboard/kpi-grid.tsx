import { Link } from "@tanstack/react-router";
import { LoadError, LoadingCard, type LoadStatus } from "@/components/dashboard/load-state";
import { ArrowDown, ArrowRight, ArrowUp, Calendar, Layers, PoundSterling, Repeat, Users } from "lucide-react";
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
  /** Where the chip's number lives; the chip becomes a link. */
  to?: string;
  search?: Record<string, unknown>;
  /** Snapshot id for the rendered-number check (the chip's first number). */
  metric?: string;
};

function percentChip(id: string, change: number, suffix = ""): KpiChip {
  const rounded = Math.round(change);
  return {
    id,
    label: `${Math.abs(rounded)}%${suffix}`,
    tone: rounded > 0 ? "mint" : rounded < 0 ? "rose" : "sky",
    icon: rounded > 0 ? "up" : rounded < 0 ? "down" : undefined,
  };
}

function ChipRow({ chips }: { chips: KpiChip[] }) {
  if (!chips.length) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {chips.map((chip) => {
        const className = cn(
          "inline-flex min-h-6 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-inset-hi",
          CHIP_TONE[chip.tone],
          chip.to && "transition-[filter] hover:brightness-[0.96]",
        );
        const inner = (
          <>
            {chip.icon === "up" && <ArrowUp className="h-3 w-3" aria-hidden />}
            {chip.icon === "down" && <ArrowDown className="h-3 w-3" aria-hidden />}
            {chip.label}
          </>
        );
        return chip.to ? (
          <Link
            key={chip.id}
            to={chip.to}
            search={chip.search ?? {}}
            className={className}
            data-qc={`kpi-chip-${chip.id}`}
            data-metric={chip.metric}
          >
            {inner}
          </Link>
        ) : (
          <span
            key={chip.id}
            className={className}
            data-qc={`kpi-chip-${chip.id}`}
            data-metric={chip.metric}
          >
            {inner}
          </span>
        );
      })}
    </div>
  );
}

export function KpiGrid({
  kpis,
  canRetention = true,
  canRevenue = true,
  status = "ready",
  onRetry,
}: {
  kpis: any;
  canRetention?: boolean;
  canRevenue?: boolean;
  /** Loading shows placeholders (never a "0"); error shows a retry line. */
  status?: LoadStatus;
  onRetry?: () => void;
}) {
  // A practitioner's dashboard is scoped to their own book, so the client and
  // treatments-due cards say whose numbers they are; a manager sees the clinic.
  const ownBook = kpis?.scope === "own";
  const items = [
    ...(canRetention
      ? [
          {
            label: "Retention rate",
            value: `${kpis?.retention ?? 0}%`,
            hint: `${kpis?.returningInWindow ?? 0} of ${kpis?.activeInWindow ?? 0} seen in the last 12 months`,
            icon: Repeat,
            accent: true,
            to: "/retention",
            // No change chip: a rolling 12-month rate has no "last month" to
            // compare with, so the chip read as a swing that was not there.
            chips: [
              {
                id: "revenue-at-risk",
                label: `£${Number(kpis?.revenueAtRisk ?? 0).toLocaleString()} at risk`,
                tone: "lilac" as const,
                to: "/retention",
              },
              {
                id: "patients-to-chase",
                label: `${kpis?.patientsToChase ?? 0} to chase`,
                tone: "peach" as const,
                to: "/retention",
                metric: "dashboard.toChase",
              },
            ],
          },
        ]
      : []),
    {
      label: ownBook ? "Your clients" : "Total clients",
      value: (ownBook ? kpis?.ownClients : kpis?.totalClients) ?? "—",
      metric: ownBook ? undefined : "dashboard.totalClients",
      hint: ownBook
        ? `Clinic total ${kpis?.totalClients ?? 0} · ${kpis?.activeClients ?? 0} active · ${kpis?.inactiveClients ?? 0} inactive`
        : `${kpis?.activeClients ?? 0} active · ${kpis?.inactiveClients ?? 0} inactive`,
      icon: Users,
      to: "/patients",
      search: { view: "all" },
      chips: [percentChip("clients-change", kpis?.clientsChange ?? 0, " vs last month")],
    },
    {
      label: "Active skin plans",
      value: kpis?.activePlans ?? 0,
      metric: "dashboard.activePlans",
      hint: "Patients on a treatment journey",
      icon: Layers,
      to: "/patients",
      search: { tab: "board" },
      chips: [
        {
          id: "plans-overdue",
          label: `${kpis?.plansOverdue ?? 0} overdue step${(kpis?.plansOverdue ?? 0) === 1 ? "" : "s"}`,
          tone: (kpis?.plansOverdue ?? 0) > 0 ? ("rose" as const) : ("mint" as const),
          // The board opened on its at-risk cards.
          to: "/patients",
          search: { tab: "board", risk: true },
        },
      ],
    },
    {
      label: "Treatments due",
      value: kpis?.treatmentsDue ?? "—",
      metric: "dashboard.treatmentsDue",
      hint: ownBook
        ? "Your patients · overdue or due in 30 days, nothing booked"
        : "Whole clinic · overdue or due in 30 days, nothing booked",
      icon: Calendar,
      to: "/patients",
      search: { view: "due" },
      chips: [
        {
          id: "treatments-due",
          label: `${kpis?.treatmentsDueSoon ?? 0} due`,
          tone: "gold" as const,
          to: "/patients",
          search: { view: "due" },
          metric: "dashboard.treatmentsDueSoon",
        },
        {
          id: "treatments-overdue",
          label: `${kpis?.treatmentsOverdue ?? 0} overdue`,
          tone: "rose" as const,
          to: "/patients",
          search: { view: "due" },
          metric: "dashboard.treatmentsOverdue",
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
            chips: [percentChip("revenue-change", kpis?.revenueChange ?? 0, " vs last month")],
          },
        ]
      : []),
  ] as any[];

  const cols =
    items.length >= 5
      ? "lg:grid-cols-3 xl:grid-cols-5"
      : items.length === 4
        ? "lg:grid-cols-4"
        : items.length === 3
          ? "lg:grid-cols-3"
          : "lg:grid-cols-2";

  if (status === "error") return <LoadError what="the clinic figures" onRetry={onRetry} />;
  if (status === "loading") {
    return (
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${cols}`} data-qc="kpi-grid-loading">
        {items.map((item) => (
          <LoadingCard key={item.label} lines={2} />
        ))}
      </div>
    );
  }

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
              data-qc={item.metric ? `metric:${item.metric}` : undefined}
            >
              {item.value}
            </p>
            {item.hint && <p className="mt-2 text-2xs text-muted-foreground">{item.hint}</p>}
          </>
        );
        // The number and its label link to the list; the chips underneath link
        // to their own narrower lists, so links never nest.
        const className = "glass-card block p-[18px] text-left transition-shadow hover:shadow-lift";
        return (
          <div
            key={item.label}
            className={className}
            data-qc={`kpi-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {"to" in item && item.to ? (
              <Link
                to={item.to}
                search={item.search ?? {}}
                className="-mx-[18px] -mt-[18px] block rounded-[inherit] px-[18px] pt-[18px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {body}
              </Link>
            ) : (
              body
            )}
            <ChipRow chips={item.chips ?? []} />
          </div>
        );
      })}
    </div>
  );
}
