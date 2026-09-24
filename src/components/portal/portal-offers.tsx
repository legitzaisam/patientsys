import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Gift } from "lucide-react";
import { claimOffer, markOfferViewed } from "@/lib/clinic.functions";
import { openPortalChat } from "@/components/portal/portal-dock";
import type { PatientOfferView } from "@/lib/offers/shape";
import { shortDate } from "@/lib/offers/shape";
import { cn } from "@/lib/utils";

/** The draft the dock chat opens with after a claim, so booking is one tap. */
export function bookWithOfferDraft(offer: Pick<PatientOfferView, "headline" | "code">) {
  return offer.code
    ? `Hi, I'd like to book using my offer "${offer.headline}" (code ${offer.code}). When do you have availability?`
    : `Hi, I'd like to book using my offer "${offer.headline}". When do you have availability?`;
}

/**
 * One offer as the patient sees it: New until opened, Claim to take it,
 * then Book with this offer. A deep link (`?offer=<id>`) marks it viewed
 * and scrolls it into view.
 */
export function PortalOffer({
  offer,
  highlighted = false,
  compact = false,
}: {
  offer: PatientOfferView;
  highlighted?: boolean;
  compact?: boolean;
}) {
  const queryClient = useQueryClient();
  const ref = useRef<HTMLDivElement | null>(null);
  const [justClaimed, setJustClaimed] = useState(false);

  const view = useMutation({
    mutationFn: useServerFn(markOfferViewed),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["portal-home"] }),
  });
  const claim = useMutation({
    mutationFn: useServerFn(claimOffer),
    onSuccess: () => {
      setJustClaimed(true);
      toast.success("Offer claimed — quote it when you book");
      void queryClient.invalidateQueries({ queryKey: ["portal-home"] });
      void queryClient.invalidateQueries({ queryKey: ["portal-resources"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!highlighted) return;
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    ref.current?.classList.add("focus-flash");
    if (offer.status === "sent") view.mutate({ data: { id: offer.id } });
    // Runs once per deep link; the mutation object changes identity each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlighted, offer.id]);

  const claimed = offer.status === "claimed" || justClaimed;
  const isNew = offer.status === "sent" && !justClaimed;

  return (
    <div
      ref={ref}
      id={`offer-${offer.id}`}
      className={cn(
        "rounded-[14px] bg-accent-wash px-3.5 py-3 shadow-[inset_0_0_0_1px_var(--accent-line)]",
        highlighted && "shadow-[inset_0_0_0_2px_var(--accent-line)]",
      )}
      data-qc="portal-offer"
      data-status={claimed ? "claimed" : offer.status}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-accent-ink shadow-inset-hi">
          <Gift className="h-3 w-3" aria-hidden />
          {claimed ? "Claimed" : isNew ? "New offer" : "Offer for you"}
        </span>
        {offer.expires_at ? (
          <span className="text-[10.5px] text-muted-foreground">Valid until {shortDate(offer.expires_at)}</span>
        ) : null}
      </div>
      <p className="mt-1.5 text-[13.5px] font-semibold text-foreground">{offer.headline}</p>
      {offer.value_text ? <p className="mt-0.5 text-xs font-semibold text-accent-ink">{offer.value_text}</p> : null}
      {!compact ? <p className="mt-1 whitespace-pre-line text-xs text-muted-foreground">{offer.body}</p> : null}
      {offer.code ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          Quote code <span className="rounded bg-white/80 px-1.5 py-0.5 font-semibold text-foreground shadow-inset-hi">{offer.code}</span>{" "}
          when you book.
        </p>
      ) : null}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {claimed ? (
          <>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink" data-qc="portal-offer-claimed">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              Claimed{offer.claimed_at ? ` ${shortDate(offer.claimed_at)}` : ""}
            </span>
            <button
              type="button"
              onClick={() => openPortalChat(bookWithOfferDraft(offer))}
              className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold shadow-glass"
              data-qc="portal-offer-book"
            >
              Book with this offer
              <ArrowRight className="h-3 w-3" aria-hidden />
            </button>
          </>
        ) : offer.live ? (
          <button
            type="button"
            disabled={claim.isPending}
            onClick={() => claim.mutate({ data: { id: offer.id } })}
            className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold shadow-glass disabled:opacity-60"
            data-qc="portal-offer-claim"
          >
            {claim.isPending ? "Claiming…" : offer.cta_label || "Claim this offer"}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">This offer has ended.</span>
        )}
      </div>
    </div>
  );
}
