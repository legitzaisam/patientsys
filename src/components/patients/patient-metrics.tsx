import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarCheck, Moon, Receipt, Repeat2, UserPlus, UserRound, Users, Wallet } from "lucide-react";
import { getPatientMetrics } from "@/lib/clinic.functions";
import { money, periodPhrase, periodRange, type PeriodSelection } from "@/components/period-picker";
import { Card } from "@/components/ui/card";
import { CHART_MUTED, CHART_PAIR, CHART_SERIES } from "@/lib/chart-palette";
import { focusSection } from "@/lib/focus-section";

const [ACCENT, SECOND] = CHART_PAIR;
const MUTED = CHART_MUTED;

function tooltipStyle() {
  return {
    borderRadius: 12,
    border: "1px solid var(--edge-2)",
    background: "var(--glass)",
    backdropFilter: "blur(8px)",
    fontSize: 12,
  } as React.CSSProperties;
}

function pct(value: number | null | undefined) {
  if (value == null) return "—";
  return `${Math.round(value * 100)}%`;
}

/** Insights → Patient base: list size, mix and quality, over the page's period. */
export function PatientMetrics({ period }: { period: PeriodSelection }) {
  const fetchMetrics = useServerFn(getPatientMetrics);
  const range = periodRange(period);
  const phrase = periodPhrase(period);
  const { data } = useQuery({
    queryKey: ["patient-metrics", range.from, range.to],
    queryFn: () => fetchMetrics({ data: range }),
  });

  const rowOne = [
    // Each tile points at the card below that explains it.
    {
      label: "Total patients",
      value: data?.totals.total ?? "—",
      hint: "Everyone on the clinic list",
      icon: Users,
      target: "book-composition",
      metric: "insights.book.total",
    },
    {
      label: "Active",
      value: data?.totals.active ?? "—",
      hint: `${data?.totals.inactive ?? 0} inactive`,
      icon: UserRound,
      target: "book-status",
      metric: "insights.book.active",
    },
    {
      label: "New patients",
      value: data?.totals.newPatients ?? "—",
      hint: `Records created ${phrase}`,
      icon: UserPlus,
      target: "book-new-patients",
      metric: "insights.book.newPatients",
    },
    {
      label: "Dormant",
      value: data?.totals.dormant ?? "—",
      hint: data
        ? `${pct(data.totals.dormantShare)} of the book · no visit in 12 months`
        : "Treated before, no visit in 12 months",
      icon: Moon,
      target: "book-status",
      metric: "insights.book.dormant",
    },
  ];

  const rowTwo = [
    {
      label: "First-to-second",
      value: pct(data?.quality.firstToSecond),
      // Shared definition: first visits in the window that are at least six
      // months old, and whether a second visit followed within six months.
      hint: data?.secondVisit
        ? `${data.secondVisit.returned} of ${data.secondVisit.cohort} first visits ${phrase} · second within 6 months`
        : `Second visit within 6 months of the first, ${phrase}`,
      icon: Repeat2,
      target: "book-mix",
    },
    {
      label: "Rebooked",
      value: pct(data?.quality.rebooked),
      hint: `Booked again after a visit ${phrase}`,
      icon: CalendarCheck,
      target: "book-mix",
    },
    {
      label: "Spend per patient",
      value: data?.quality.spendPerPatient != null ? money(data.quality.spendPerPatient) : "—",
      hint: `Per patient seen ${phrase}`,
      icon: Wallet,
      target: "book-mix",
    },
    {
      label: "Visit value",
      value: data?.quality.visitValue != null ? money(data.quality.visitValue) : "—",
      hint: `Per visit ${phrase}`,
      icon: Receipt,
      target: "book-mix",
    },
  ];

  // Patients by months since their last visit (replaces the active / inactive donut).
  const lastVisitData = [
    { name: "Under 3 months", value: data?.lastVisit.under3 ?? 0 },
    { name: "3–6 months", value: data?.lastVisit.from3to6 ?? 0 },
    { name: "6–12 months", value: data?.lastVisit.from6to12 ?? 0 },
    { name: "12+ months", value: data?.lastVisit.over12 ?? 0 },
    { name: "Never treated", value: data?.lastVisit.never ?? 0 },
  ];
  const lastVisitColours = [...CHART_SERIES.slice(0, 4), MUTED];

  const mixData = [
    { name: "New", value: data?.treatedMix.firstTimers ?? 0 },
    { name: "Returning", value: data?.treatedMix.returning ?? 0 },
  ];
  const mixTotal = mixData[0]!.value + mixData[1]!.value;
  const sourceMax = data?.sources[0]?.count ?? 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rowOne.map((stat) => (
          <Tile key={stat.label} {...stat} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {rowTwo.map((stat) => (
          <Tile key={stat.label} {...stat} />
        ))}
      </div>

      <Card id="book-composition" className="scroll-mt-20 p-5">
        <h2 className="section-title">Composition</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Of the {data?.composition.seen ?? 0} patients seen {phrase}, how many have had one visit
          and how many two or more, any treatment. Never treated counts the whole list.
        </p>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CompositionItem
            label="Never treated"
            value={data?.composition.neverTreated ?? 0}
            metric="insights.composition.never"
          />
          <CompositionItem
            label="Treated once"
            value={data?.composition.treatedOnce ?? 0}
            metric="insights.composition.once"
          />
          <CompositionItem
            label="Two or more visits"
            value={data?.composition.multiTreatment ?? 0}
            metric="insights.composition.twoPlus"
          />
        </ul>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card id="book-new-patients" className="scroll-mt-20 p-5">
          <h2 className="section-title">New patients</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Records created {phrase}.
          </p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data?.newSeries ?? []}
                margin={{ top: 4, right: 4, bottom: 0, left: -22 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--edge-2)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle()} cursor={{ fill: "rgba(47,63,102,0.05)" }} />
                <Bar dataKey="count" name="New patients" fill={ACCENT} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card id="book-status" className="scroll-mt-20 p-5" data-qc="last-visit-card">
          <h2 className="section-title">Patients by last visit</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Everyone on the list, by how long since they were last seen.
          </p>
          <div className="mt-4 flex h-56 items-center gap-6">
            <div className="h-full flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={lastVisitData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="88%"
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    {lastVisitData.map((entry, i) => (
                      <Cell key={entry.name} fill={lastVisitColours[i]!} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle()} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="shrink-0 space-y-1.5 pr-2 text-sm">
              {lastVisitData.map((entry, i) => (
                <li
                  key={entry.name}
                  className="flex items-center gap-2"
                  data-qc="last-visit-bucket"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: lastVisitColours[i] }}
                  />
                  {entry.name} · <span className="font-semibold tabular-nums">{entry.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </Card>

        <Card id="book-mix" className="scroll-mt-20 p-5">
          <h2 className="section-title">New vs returning</h2>
          <p className="mt-1 text-xs text-muted-foreground">Of people treated {phrase}.</p>
          <div className="mt-4 flex h-56 items-center gap-6">
            <div className="h-full flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={mixData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="88%"
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    <Cell fill={ACCENT} />
                    <Cell fill={SECOND} />
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle()} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="shrink-0 space-y-2 pr-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} />
                New · <span className="font-semibold tabular-nums">{mixData[0]!.value}</span>
                {mixTotal > 0 && (
                  <span className="text-muted-foreground">
                    ({Math.round((mixData[0]!.value / mixTotal) * 100)}%)
                  </span>
                )}
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: SECOND }} />
                Returning · <span className="font-semibold tabular-nums">{mixData[1]!.value}</span>
                {mixTotal > 0 && (
                  <span className="text-muted-foreground">
                    ({Math.round((mixData[1]!.value / mixTotal) * 100)}%)
                  </span>
                )}
              </li>
            </ul>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="section-title">How the list was built</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Lifetime source on each record — not just this period’s sign-ups.
          </p>
          <ul className="mt-4 space-y-2.5">
            {(data?.sources ?? []).map((row) => (
              <li key={row.source} className="glass-item flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{row.label}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-glass-2 shadow-inset-hi">
                    <div
                      className="h-full rounded-full bg-accent-line"
                      style={{ width: `${Math.round((row.count / sourceMax) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {row.count}
                </span>
              </li>
            ))}
            {(!data || data.sources.length === 0) && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                No source recorded on the list yet.
              </li>
            )}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  icon: Icon,
  target,
  metric,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof Users;
  /** id of the detail card this tile summarises. */
  target: string;
  /** Snapshot id for the rendered-number check. */
  metric?: string;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={`${label}: show details`}
      onClick={() => focusSection(target)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          focusSection(target);
        }
      }}
      className="group cursor-pointer p-[18px] transition-[transform,box-shadow] hover:-translate-y-px hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-ink-3 transition-colors group-hover:text-foreground" aria-hidden />
      </div>
      <p
        className="mt-2.5 text-[27px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-foreground"
        data-qc={metric ? `metric:${metric}` : undefined}
      >
        {value}
      </p>
      <p className="mt-2 text-2xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

function CompositionItem({
  label,
  value,
  metric,
}: {
  label: string;
  value: number;
  /** Snapshot id for the rendered-number check. */
  metric?: string;
}) {
  return (
    <li className="glass-item px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className="mt-1 text-xl font-semibold tabular-nums text-foreground"
        data-qc={metric ? `metric:${metric}` : undefined}
      >
        {value}
      </p>
    </li>
  );
}
