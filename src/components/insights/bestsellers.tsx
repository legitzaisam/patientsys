import { Card } from "@/components/ui/card";
import { money } from "@/components/period-picker";
import type { InsightsResult } from "@/lib/insights.server";

function RankedList({
  title,
  subtitle,
  rows,
  empty,
  unit,
}: {
  title: string;
  subtitle: string;
  rows: { name: string; count: number; revenue: number; detail?: string }[];
  empty: string;
  unit: string;
}) {
  const max = rows[0]?.revenue || rows[0]?.count || 1;
  return (
    <Card className="p-5">
      <h2 className="section-title">{title}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      <ul className="mt-4 space-y-2.5">
        {rows.map((row, index) => (
          <li key={row.name} className="glass-item flex items-center gap-3 p-3">
            <span className="w-4 shrink-0 text-2xs font-semibold text-muted-foreground">{index + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
              {row.detail && <p className="text-2xs text-muted-foreground">{row.detail}</p>}
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-glass-2 shadow-inset-hi">
                <div
                  className="h-full rounded-full bg-accent-line"
                  style={{ width: `${Math.round(((row.revenue || row.count) / max) * 100)}%` }}
                />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums text-foreground">{money(row.revenue)}</p>
              <p className="text-2xs tabular-nums text-muted-foreground">
                {row.count} {row.count === 1 ? unit : `${unit}s`}
              </p>
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="py-8 text-center text-sm text-muted-foreground">{empty}</li>}
      </ul>
    </Card>
  );
}

export function Bestsellers({ data }: { data: InsightsResult["bestsellers"] | undefined }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <RankedList
        title="Best-selling treatments"
        subtitle="Volume and revenue in this window."
        unit="visit"
        rows={(data?.treatments ?? []).map((t) => ({ name: t.name, count: t.count, revenue: t.revenue }))}
        empty="No treatments in this window."
      />
      <RankedList
        title="Best-selling products"
        subtitle="Retail units and revenue from the product catalogue."
        unit="unit"
        rows={(data?.products ?? []).map((p) => ({
          name: p.name,
          count: p.units,
          revenue: p.revenue,
          detail: p.sku ?? undefined,
        }))}
        empty="No product sales in this window."
      />
    </div>
  );
}
