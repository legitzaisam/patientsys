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
    <>
      <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">New patient cohorts</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Grouped by the month of their first treatment — how many came back for a second and third.
      </p>
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
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No new patients in the last 12 months yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function TreatmentRetentionTable({ rows }: { rows: TreatmentRetentionRow[] }) {
  return (
    <>
      <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">Retention by treatment</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Which treatments bring patients back, and how long they typically leave between visits.
      </p>
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
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No treatments recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function RetentionBreakdown({
  cohorts,
  byTreatment,
}: {
  cohorts: CohortRow[];
  byTreatment: TreatmentRetentionRow[];
}) {
  return (
    <Card className="p-5">
      <Tabs defaultValue="cohorts">
        <TabsList className="mb-4 rounded-xl">
          <TabsTrigger value="cohorts" className="rounded-lg text-xs">
            New patient cohorts
          </TabsTrigger>
          <TabsTrigger value="treatments" className="rounded-lg text-xs">
            Retention by treatment
          </TabsTrigger>
        </TabsList>
        <TabsContent value="cohorts">
          <CohortTable cohorts={cohorts} />
        </TabsContent>
        <TabsContent value="treatments">
          <TreatmentRetentionTable rows={byTreatment} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
