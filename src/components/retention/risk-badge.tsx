import { cn } from "@/lib/utils";

export type RiskLevel = "overdue" | "due_soon" | "lapsing" | "lost";

const LABEL: Record<RiskLevel, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  lapsing: "Lapsing",
  lost: "Lost",
};

const STYLE: Record<RiskLevel, string> = {
  overdue: "bg-destructive-bg text-destructive-ink",
  due_soon: "bg-accent-soft text-accent-ink",
  lapsing: "bg-warning-bg text-warning-ink",
  lost: "border border-edge-2 bg-glass-2 text-muted-foreground",
};

export function RiskBadge({ risk, className }: { risk: RiskLevel; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-medium tracking-[0.02em]",
        STYLE[risk],
        className,
      )}
    >
      {LABEL[risk]}
    </span>
  );
}
