import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  OFFER_IMAGE_PLACEMENT_LABEL,
  OFFER_IMAGE_PLACEMENTS,
  compressOfferImage,
  type OfferImagePlacement,
} from "@/lib/offers/picture";

/** Upload a picture and choose where it sits on the email and the portal card. */
export function OfferImageField({
  imageUrl,
  placement,
  onChange,
}: {
  imageUrl: string | null;
  placement: OfferImagePlacement;
  onChange: (next: { imageUrl: string | null; placement: OfferImagePlacement }) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function takeFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await compressOfferImage(file);
      onChange({ imageUrl: dataUrl, placement: imageUrl ? placement : "top" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that picture.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="rounded-2xl border border-edge bg-glass-2 p-4 shadow-inset-hi">
      <p className="text-sm font-semibold text-foreground">Picture</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Used on the email and the portal card. Choose the slot on the template, then drop a photo in.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => void takeFile(e.target.files?.[0])}
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void takeFile(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "relative flex h-28 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-dashed border-edge bg-glass-2 text-ink-3 shadow-inset-hi transition-colors hover:border-accent-line hover:bg-accent-wash hover:text-foreground",
            imageUrl && "border-solid",
          )}
          aria-label={imageUrl ? "Replace offer picture" : "Upload offer picture"}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs">
              <ImagePlus className="h-4 w-4" />
              {busy ? "Reading…" : "Add picture"}
            </span>
          )}
        </button>

        <div className="min-w-0">
          <Label className="text-xs text-muted-foreground">Where it sits</Label>
          <div className="mt-2 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Picture placement">
            {OFFER_IMAGE_PLACEMENTS.map((slot) => {
              const on = placement === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!imageUrl}
                  onClick={() => onChange({ imageUrl, placement: slot })}
                  className={cn(
                    "flex h-[4.5rem] flex-col items-center justify-end rounded-xl border px-1 pb-1.5 pt-1 text-[10px] tracking-[0.02em] transition-colors",
                    on
                      ? "border-edge bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                      : "border-edge bg-glass-2 text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground",
                    !imageUrl && "opacity-50",
                  )}
                >
                  <PlacementGlyph slot={slot} />
                  {OFFER_IMAGE_PLACEMENT_LABEL[slot]}
                </button>
              );
            })}
          </div>
          {imageUrl ? (
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => onChange({ imageUrl: null, placement: "top" })}
            >
              <Trash2 className="h-3 w-3" />
              Remove picture
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PlacementGlyph({ slot }: { slot: OfferImagePlacement }) {
  const fill = "bg-accent-ink/35";
  return (
    <span aria-hidden className="mb-1 grid h-8 w-10 grid-cols-3 grid-rows-3 overflow-hidden rounded-sm border border-edge bg-glass">
      {slot === "background" ? <span className={cn("col-span-3 row-span-3", fill)} /> : null}
      {slot === "top" ? <span className={cn("col-span-3 row-span-1", fill)} /> : null}
      {slot === "bottom" ? <span className={cn("col-span-3 row-start-3", fill)} /> : null}
      {slot === "left" ? <span className={cn("col-start-1 row-span-3", fill)} /> : null}
      {slot === "right" ? <span className={cn("col-start-3 row-span-3", fill)} /> : null}
    </span>
  );
}
