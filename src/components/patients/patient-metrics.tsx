import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarClock, UserPlus, UserRound, Users } from "lucide-react";
import { getPatientMetrics } from "@/lib/clinic.functions";
import { Card } from "@/components/ui/card";

const ACCENT = "var(--accent-line)";
const MUTED = "rgba(47, 63, 102, 0.22)";
const ROSE = "rgba(214, 105, 137, 0.75)";

function tooltipStyle() {
  return {
    borderRadius: 12,
    border: "1px solid var(--edge-2)",
    background: "var(--glass)",
    backdropFilter: "blur(8px)",
    fontSize: 12,
  } as React.CSSProperties;
}

/** Patients → Metrics tab: the patient base at a glance. */
export function PatientMetrics() {
  const fetchMetrics = useServerFn(getPatientMetrics);
  const { data } = useQuery({ queryKey: ["patient-metrics"], queryFn: () => fetchMetrics() });

  const stats = [
    { label: "Total patients", value: data?.totals.total ?? "—", hint: "On the clinic book", icon: Users },
    {
      label: "Active",
      value: data?.totals.active ?? "—",
      hint: `${data?.totals.inactive ?? 0} inactive`,
      icon: UserRound,
    },
    { label: "New this month", value: data?.totals.newThisMonth ?? "—", hint: "First record created", icon: UserPlus },
    {
      label: "Treatments overdue",
      value: data?.overdue ?? "—",
      hint: "Past their next-due date",
      icon: CalendarClock,
    },
  ];

  const statusData = [
    { name: "Active", value: data?.totals.active ?? 0 },
    { name: "Inactive", value: data?.totals.inactive ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="p-[18px]">
            <div className="flex items-start justify-between">
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <stat.icon className="h-4 w-4 text-ink-3" aria-hidden />
            </div>
            <p className="mt-2.5 text-[27px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-foreground">
              {stat.value}
            </p>
            <p className="mt-2 text-2xs text-muted-foreground">{stat.hint}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="section-title">New patients</h2>
          <p className="mt-1 text-xs text-muted-foreground">Records created per month, last 12 months.</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.monthlyNew ?? []} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--edge-2)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle()} cursor={{ fill: "rgba(47,63,102,0.05)" }} />
                <Bar dataKey="count" name="New patients" fill={ACCENT} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="section-title">Active vs inactive</h2>
          <p className="mt-1 text-xs text-muted-foreground">Current status split across the whole book.</p>
          <div className="mt-4 flex h-56 items-center gap-6">
            <div className="h-full flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="58%"
                    outerRadius="88%"
                    paddingAngle={3}
                    strokeWidth={0}
                  >
                    <Cell fill={ACCENT} />
                    <Cell fill={MUTED} />
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle()} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="shrink-0 space-y-2 pr-2 text-sm">
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} />
                Active · <span className="font-semibold tabular-nums">{data?.totals.active ?? 0}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: MUTED }} />
                Inactive · <span className="font-semibold tabular-nums">{data?.totals.inactive ?? 0}</span>
              </li>
            </ul>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="section-title">Top treatments</h2>
          <p className="mt-1 text-xs text-muted-foreground">By volume over the last 12 months.</p>
          <ul className="mt-4 space-y-2.5">
            {(data?.topTreatments ?? []).map((t, index) => {
              const max = data?.topTreatments?.[0]?.count ?? 1;
              return (
                <li key={t.name} className="glass-item flex items-center gap-3 p-3">
                  <span className="w-4 shrink-0 text-2xs font-semibold text-muted-foreground">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{t.name}</p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-glass-2 shadow-inset-hi">
                      <div
                        className="h-full rounded-full bg-accent-line"
                        style={{ width: `${Math.round((t.count / max) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{t.count}</span>
                </li>
              );
            })}
            {(data?.topTreatments ?? []).length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">No treatments recorded yet.</li>
            )}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="section-title">Treatments falling due</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Next six months{data?.overdue ? ` · ${data.overdue} already overdue` : ""}.
          </p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  ...(data?.overdue ? [{ key: "overdue", label: "Overdue", due: data.overdue, overdue: true }] : []),
                  ...(data?.dueByMonth ?? []),
                ]}
                margin={{ top: 4, right: 4, bottom: 0, left: -22 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--edge-2)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle()} cursor={{ fill: "rgba(47,63,102,0.05)" }} />
                <Bar dataKey="due" name="Due" radius={[6, 6, 0, 0]}>
                  {[
                    ...(data?.overdue ? [{ overdue: true }] : []),
                    ...(data?.dueByMonth ?? []).map(() => ({ overdue: false })),
                  ].map((entry, index) => (
                    <Cell key={index} fill={entry.overdue ? ROSE : ACCENT} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
