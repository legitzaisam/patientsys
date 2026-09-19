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
    <div className="-mx-5 overflow-x-auto">
      <table className="glass-table w-full text-sm">
        <thead>
          <tr>
            <th className="px-5 py-3">First seen</th>
            <th className="px-5 py-3">New patients</th>
            <th className="px-5 py-3">Returned 2nd</th>
            <th className="px-5 py-3">Returned 3rd</th>
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.key} className="border-b border-glass-line last:border-0">
              <td className="px-5 py-3 text-foreground">{c.label}</td>
              <td className="px-5 py-3 text-muted-foreground">{c.patients}</td>
              <td className="px-5 py-3">
                <p className="text-muted-foreground">
                  {c.second} · {c.secondRate}%
                </p>
                <Bar value={c.secondRate} />
              </td>
              <td className="px-5 py-3">
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
                <div className="rounded-2xl p-8 text-center text-sm text-muted-foreground transition-colors hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground">
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

export function TreatmentRetentionTable({
  rows,
  nameHeader = "Treatment",
  empty = "No treatments recorded yet.",
}: {
  rows: TreatmentRetentionRow[];
  nameHeader?: string;
  empty?: string;
}) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="glass-table w-full text-sm">
        <thead>
          <tr>
            <th className="px-5 py-3">{nameHeader}</th>
            <th className="px-5 py-3">Patients</th>
            <th className="px-5 py-3">Repeat rate</th>
            <th className="px-5 py-3">Average gap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-glass-line last:border-0">
              <td className="px-5 py-3 text-foreground">{r.name}</td>
              <td className="px-5 py-3 text-muted-foreground">{r.patients}</td>
              <td className="px-5 py-3">
                <p className="text-muted-foreground">
                  {r.repeatPatients} · {r.repeatRate}%
                </p>
                <Bar value={r.repeatRate} />
              </td>
              <td className="px-5 py-3 text-muted-foreground">
                {r.averageGapDays ? `${r.averageGapDays} days` : "—"}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr className="hover:bg-transparent">
              <td colSpan={4} className="p-2">
                <div className="rounded-2xl p-8 text-center text-sm text-muted-foreground transition-colors hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground">
                  {empty}
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export type BreakdownTab = "cohorts" | "treatments" | "practitioners";

const PANELS: Record<BreakdownTab, { title: string; hint: string }> = {
  cohorts: {
    title: "New patient cohorts",
    hint: "Grouped by the month of their first treatment — how many came back for a second and third.",
  },
  treatments: {
    title: "Retention by treatment",
    hint: "Which treatments bring patients back, and how long they typically leave between visits.",
  },
  practitioners: {
    title: "Retention by practitioner",
    hint: "Which books keep patients coming back, and how long they typically leave between visits.",
  },
};

export function RetentionBreakdown({
  cohorts,
  byTreatment,
  byPractitioner,
  tab,
  onTabChange,
}: {
  cohorts: CohortRow[];
  byTreatment: TreatmentRetentionRow[];
  byPractitioner: TreatmentRetentionRow[];
  tab: BreakdownTab;
  onTabChange: (tab: BreakdownTab) => void;
}) {
  const panel = PANELS[tab];

  return (
    <Card id="retention-breakdown" className="scroll-mt-20 p-5">
      <Tabs value={tab} onValueChange={(value) => onTabChange(value as BreakdownTab)}>
        <div className="mb-4">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="section-title">{panel.title}</h2>
            </div>
            <TabsList className="ml-auto shrink-0">
              <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
              <TabsTrigger value="treatments">By treatment</TabsTrigger>
              <TabsTrigger value="practitioners">By practitioner</TabsTrigger>
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
        <TabsContent value="practitioners" className="mt-0">
          <TreatmentRetentionTable
            rows={byPractitioner}
            nameHeader="Practitioner"
            empty="No practitioner activity recorded yet."
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
