import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";

export type CohortRow = {
  key: string;
  label: string;
  patients: number;
  second: number;
  third: number;
  secondRate: number;
  thirdRate: number;
};

export type TreatmentRetentionRow = {
  name: string;
  patients: number;
  repeatPatients: number;
  repeatRate: number;
  averageGapDays: number | null;
};

function Bar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-glass-2">
      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function CohortTable({ cohorts }: { cohorts: CohortRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="glass-table w-full text-sm">
        <thead>
          <tr>
            <th className="px-4 py-3">First seen</th>
            <th className="px-4 py-3">New patients</th>
            <th className="px-4 py-3">Returned 2nd</th>
            <th className="px-4 py-3">Returned 3rd</th>
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.key} className="border-b border-glass-line last:border-0">
              <td className="px-4 py-3 text-foreground">{c.label}</td>
              <td className="px-4 py-3 text-muted-foreground">{c.patients}</td>
              <td className="px-4 py-3">
                <p className="text-muted-foreground">
                  {c.second} · {c.secondRate}%
                </p>
                <Bar value={c.secondRate} />
              </td>
              <td className="px-4 py-3">
                <p className="text-muted-foreground">
                  {c.third} · {c.thirdRate}%
                </p>
                <Bar value={c.thirdRate} />
              </td>
            </tr>
          ))}
          {cohorts.length === 0 && (
            <tr className="hover:bg-transparent">
              <td colSpan={4} className="p-2">
                <div className="rounded-2xl p-8 text-center text-sm text-muted-foreground transition-colors hover:bg-accent-wash hover:text-foreground">
                  No new patients in the last 12 months yet.
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TreatmentRetentionTable({ rows }: { rows: TreatmentRetentionRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="glass-table w-full text-sm">
        <thead>
          <tr>
            <th className="px-4 py-3">Treatment</th>
            <th className="px-4 py-3">Patients</th>
            <th className="px-4 py-3">Repeat rate</th>
            <th className="px-4 py-3">Average gap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-glass-line last:border-0">
              <td className="px-4 py-3 text-foreground">{r.name}</td>
              <td className="px-4 py-3 text-muted-foreground">{r.patients}</td>
              <td className="px-4 py-3">
                <p className="text-muted-foreground">
                  {r.repeatPatients} · {r.repeatRate}%
                </p>
                <Bar value={r.repeatRate} />
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {r.averageGapDays ? `${r.averageGapDays} days` : "—"}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr className="hover:bg-transparent">
              <td colSpan={4} className="p-2">
                <div className="rounded-2xl p-8 text-center text-sm text-muted-foreground transition-colors hover:bg-accent-wash hover:text-foreground">
                  No treatments recorded yet.
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const PANELS = {
  cohorts: {
    title: "New patient cohorts",
    hint: "Grouped by the month of their first treatment — how many came back for a second and third.",
  },
  treatments: {
    title: "Retention by treatment",
    hint: "Which treatments bring patients back, and how long they typically leave between visits.",
  },
} as const;

export function RetentionBreakdown({
  cohorts,
  byTreatment,
}: {
  cohorts: CohortRow[];
  byTreatment: TreatmentRetentionRow[];
}) {
  const [tab, setTab] = useState<keyof typeof PANELS>("cohorts");
  const panel = PANELS[tab];

  return (
    <Card className="p-5">
      <Tabs value={tab} onValueChange={(value) => setTab(value as keyof typeof PANELS)}>
        <div className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="min-w-0 text-[17px] font-semibold tracking-[-0.016em] text-foreground">
              {panel.title}
            </h2>
            <TabsList className="ml-auto shrink-0">
              <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
              <TabsTrigger value="treatments">By treatment</TabsTrigger>
            </TabsList>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{panel.hint}</p>
        </div>
        <TabsContent value="cohorts" className="mt-0">
          <CohortTable cohorts={cohorts} />
        </TabsContent>
        <TabsContent value="treatments" className="mt-0">
          <TreatmentRetentionTable rows={byTreatment} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
