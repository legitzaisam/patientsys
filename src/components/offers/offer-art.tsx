import { cn } from "@/lib/utils";
import type { OfferImagePlacement } from "@/lib/offers/picture";

/** Lays the offer picture into the chosen slot on the email/portal card. */
export function OfferArtFrame({
  imageUrl,
  placement,
  className,
  children,
}: {
  imageUrl?: string | null;
  placement?: OfferImagePlacement | null;
  className?: string;
  children: React.ReactNode;
}) {
  const src = imageUrl?.trim() || "";
  const slot = src ? placement ?? "top" : null;

  if (!slot) {
    return <div className={className}>{children}</div>;
  }

  if (slot === "background") {
    return (
      <div className={cn("relative overflow-hidden", className)}>
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="relative bg-glass/90 p-5">{children}</div>
      </div>
    );
  }

  if (slot === "top") {
    return (
      <div className={cn("overflow-hidden", className)}>
        <img src={src} alt="" className="h-36 w-full object-cover" />
        <div className="p-5">{children}</div>
      </div>
    );
  }

  if (slot === "bottom") {
    return (
      <div className={cn("overflow-hidden", className)}>
        <div className="p-5 pb-3">{children}</div>
        <img src={src} alt="" className="h-32 w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={cn("flex overflow-hidden", slot === "right" && "flex-row-reverse", className)}>
      <img src={src} alt="" className="w-[7.5rem] shrink-0 object-cover sm:w-36" />
      <div className="min-w-0 flex-1 p-5">{children}</div>
    </div>
  );
}
