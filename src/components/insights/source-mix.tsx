import { Card } from "@/components/ui/card";
import type { InsightsResult } from "@/lib/insights.server";

export function SourceMix({ sources }: { sources: InsightsResult["sources"] | undefined }) {
  const rows = sources ?? [];
  const total = rows.reduce((sum, row) => sum + row.count, 0) || 1;
  const max = rows[0]?.count ?? 1;
  return (
    <Card className="p-5">
      <h2 className="section-title">Source mix</h2>
      <p className="mt-1 text-xs text-muted-foreground">Where people who signed up in this window came from.</p>
      <ul className="mt-4 space-y-2.5">
        {rows.map((row) => (
          <li key={row.source} className="glass-item flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{row.label}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-glass-2 shadow-inset-hi">
                <div
                  className="h-full rounded-full bg-accent-line"
                  style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums text-foreground">{row.count}</p>
              <p className="text-2xs tabular-nums text-muted-foreground">{Math.round((row.count / total) * 100)}%</p>
            </div>
          </li>
        ))}
        {sources != null && sources.length === 0 && (
          <li className="py-8 text-center text-sm text-muted-foreground">No sign-ups in this window.</li>
        )}
      </ul>
    </Card>
  );
}
