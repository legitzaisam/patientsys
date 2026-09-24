import { Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RenderedOffer } from "@/lib/offers/stages";
import { shortDate } from "@/lib/offers/shape";

/** The email as the patient's client would show it. Sandboxed: no scripts, no navigation. */
export function OfferEmailPreview({ html, subject, className }: { html: string; subject: string; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-edge bg-glass-2 shadow-inset-hi", className)}>
      <div className="border-b border-edge px-4 py-2.5">
        <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Email</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{subject || "(no subject)"}</p>
      </div>
      <iframe
        title="Email preview"
        sandbox=""
        srcDoc={html}
        className="h-[460px] w-full bg-[#f4f1ea]"
        data-qc="offer-email-preview"
      />
    </div>
  );
}

/**
 * The card the patient sees on their portal home. Kept in step with the
 * real card in my-record.index.tsx by sharing the same field set.
 */
export function OfferCardPreview({
  card,
  expiresAt,
  clinicName,
  status,
  className,
}: {
  card: RenderedOffer["card"];
  expiresAt?: string | null;
  clinicName: string;
  status?: "new" | "claimed" | undefined;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-edge bg-glass-2 p-4 shadow-inset-hi", className)}>
      <p className="mb-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Portal card</p>
      <div className="glass-card rounded-2xl p-5" data-qc="offer-card-preview">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
              <Gift className="h-4 w-4" />
            </span>
            <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">Special offer</p>
          </div>
          {status === "new" ? (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-ink">New</span>
          ) : status === "claimed" ? (
            <span className="rounded-full bg-glass-2 px-2 py-0.5 text-[11px] font-semibold text-foreground shadow-inset-hi">Claimed</span>
          ) : null}
        </div>
        <h3 className="mt-3 text-lg font-semibold tracking-[-0.012em] text-foreground">{card.headline || "Headline"}</h3>
        {card.value_text ? (
          <p className="mt-1 text-sm font-semibold text-accent-ink">{card.value_text}</p>
        ) : null}
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-2">{card.body || "Body copy."}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {card.code ? (
            <span>
              Code <span className="font-semibold text-foreground">{card.code}</span>
            </span>
          ) : null}
          {expiresAt ? <span>Valid until {shortDate(expiresAt)}</span> : null}
          <span>{clinicName}</span>
        </div>
        <button
          type="button"
          tabIndex={-1}
          className="mt-4 h-9 w-full cursor-default rounded-full bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-bloom"
        >
          {card.cta_label || "Claim this offer"}
        </button>
      </div>
    </div>
  );
}
