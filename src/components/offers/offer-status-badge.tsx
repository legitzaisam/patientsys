import { OFFER_STATUS_LABEL } from "@/lib/offers/shape";
import type { OfferStatus } from "@/lib/offers/stages";
import { cn } from "@/lib/utils";

const TONE: Record<OfferStatus, string> = {
  sent: "bg-glass-2 text-ink-2 border-edge",
  viewed: "bg-glass-2 text-foreground border-edge",
  claimed: "bg-accent-soft text-accent-ink border-transparent",
  expired: "bg-glass-2 text-muted-foreground border-edge",
  cancelled: "bg-glass-2 text-muted-foreground border-edge line-through",
};

export function OfferStatusBadge({ status, className }: { status: OfferStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium shadow-inset-hi",
        TONE[status],
        className,
      )}
      data-qc="offer-status"
    >
      {OFFER_STATUS_LABEL[status]}
    </span>
  );
}
