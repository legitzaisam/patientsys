import { Lightbulb } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { RiskLevel } from "./risk-badge";

export type Suggestion = {
  id: string;
  title: string;
  detail: string;
  filter: RiskLevel | "all";
};

export function SuggestedActions({
  suggestions,
  onPick,
}: {
  suggestions: Suggestion[];
  onPick: (filter: RiskLevel | "all") => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-ink-3" aria-hidden />
        <h2 className="section-title">Where to focus</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Small actions that keep patients coming back.</p>
      <ul className="mt-4 space-y-2">
        {suggestions.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onPick(s.filter)}
              className="glass-item w-full cursor-pointer p-4 text-left transition-colors hover:bg-glass"
            >
              <p className="text-sm font-medium text-foreground">{s.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.detail}</p>
            </button>
          </li>
        ))}
        {suggestions.length === 0 && (
          <li className="rounded-xl border border-dashed border-edge-2 p-6 text-center text-sm text-muted-foreground">
            Retention is healthy — nothing needs chasing right now.
          </li>
        )}
      </ul>
    </Card>
  );
}
