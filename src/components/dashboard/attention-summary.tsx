/**
 * The short Attention summary that sits under the numbers on the owner's
 * dashboard: how many items are urgent and how many are due this week, with
 * the biggest kinds as chips. Clicking anything scrolls to the full list.
 */
import { AlertTriangle, ArrowDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { LoadingCard, type LoadStatus } from "@/components/dashboard/load-state";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  no_show: "No show",
  deposit_due: "Deposit due",
  consent_due: "Consent due",
  payment_due: "Unpaid",
  balance_due: "Balance due",
  treatment_due: "Treatment due",
  message: "Message",
  incomplete_profile: "Incomplete profile",
};

export function AttentionSummary({
  items,
  status = "ready",
  targetId = "attention",
}: {
  items: { kind: string; urgency: string }[];
  status?: LoadStatus;
  /** The id of the full Attention needed section to scroll to. */
  targetId?: string;
}) {
  if (status === "loading") return <LoadingCard lines={1} />;
  if (status === "error") return null;
  const urgent = items.filter((i) => i.urgency === "urgent").length;
  const thisWeek = items.filter((i) => i.urgency === "this_week").length;
  const byKind = new Map<string, number>();
  for (const i of items) byKind.set(i.kind, (byKind.get(i.kind) ?? 0) + 1);
  const kinds = [...byKind.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const scroll = () =>
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <Card
      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3"
      data-qc="attention-summary"
    >
      <AlertTriangle
        className={cn("h-4 w-4 shrink-0", urgent > 0 ? "text-destructive-ink" : "text-ink-3")}
        aria-hidden
      />
      <p className="text-sm text-foreground">
        {items.length === 0 ? (
          "Nothing needs attention right now."
        ) : (
          <>
            <span className="font-semibold tabular-nums" data-qc="attention-urgent">
              {urgent} urgent
            </span>
            <span className="text-muted-foreground"> · </span>
            <span className="tabular-nums" data-qc="attention-this-week">
              {thisWeek} this week
            </span>
          </>
        )}
      </p>
      {kinds.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {kinds.map(([kind, count]) => (
            <button
              key={kind}
              type="button"
              onClick={scroll}
              className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-full bg-glass-2 px-2.5 text-2xs font-semibold text-ink-2 shadow-inset-hi transition-colors hover:bg-accent-wash hover:text-foreground"
            >
              {KIND_LABEL[kind] ?? kind.replace(/_/g, " ")}
              <span className="tabular-nums text-muted-foreground">{count}</span>
            </button>
          ))}
        </div>
      ) : null}
      {items.length > 0 ? (
        <button
          type="button"
          onClick={scroll}
          className="ml-auto inline-flex min-h-6 cursor-pointer items-center gap-1 text-xs font-semibold text-accent-ink hover:underline"
          data-qc="attention-summary-open"
        >
          See everything
          <ArrowDown className="h-3 w-3" aria-hidden />
        </button>
      ) : null}
    </Card>
  );
}
