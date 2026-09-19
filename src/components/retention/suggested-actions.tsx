import { ChevronRight, Clock3, Lightbulb, Repeat2, TrendingDown, UserRoundSearch, Waves } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { RiskLevel } from "./risk-badge";

export type SuggestionTarget = {
  section: "at-risk" | "trend" | "breakdown";
  tab?: "cohorts";
};

export type Suggestion = {
  id: string;
  title: string;
  detail: string;
  filter: RiskLevel | "all";
  severity?: "urgent" | "attention" | "opportunity";
  icon?: "clock" | "wave" | "trend" | "repeat" | "winback";
  target?: SuggestionTarget;
};

const ICONS = {
  clock: Clock3,
  wave: Waves,
  trend: TrendingDown,
  repeat: Repeat2,
  winback: UserRoundSearch,
} as const;

const SEVERITY_TILE: Record<NonNullable<Suggestion["severity"]>, string> = {
  urgent: "bg-destructive-bg text-destructive-ink",
  attention: "bg-warning-bg text-warning-ink",
  opportunity: "bg-success-bg text-success-ink",
};

/**
 * "Where to focus" — insight rows from the retention recommendation engine,
 * in the v3 style: severity-toned icon tile, title, detail and a chevron.
 * Clicking a row takes you to the section where the task is actionable.
 */
export function SuggestedActions({
  suggestions,
  onPick,
}: {
  suggestions: Suggestion[];
  onPick: (suggestion: Suggestion) => void;
}) {
  return (
    <Card className="h-full p-5">
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-ink-3" aria-hidden />
          <h2 className="section-title">Where to focus</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Insights from your clinic's own patterns — the engine sharpens as more data accrues.
        </p>
      </div>
      <ul className="space-y-2">
        {suggestions.map((s) => {
          const Icon = ICONS[s.icon ?? "clock"];
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onPick(s)}
                className="glass-item flex w-full cursor-pointer items-start gap-3 p-3.5 text-left"
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-inset-hi ${
                    SEVERITY_TILE[s.severity ?? "attention"]
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{s.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.detail}</p>
                </span>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              </button>
            </li>
          );
        })}
        {suggestions.length === 0 && (
          <li className="rounded-xl border border-dashed border-edge-2 p-6 text-center text-sm text-muted-foreground">
            Retention is healthy — nothing needs chasing right now.
          </li>
        )}
      </ul>
    </Card>
  );
}
