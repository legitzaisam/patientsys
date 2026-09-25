export const OFFER_IMAGE_PLACEMENTS = ["background", "top", "left", "right", "bottom"] as const;
export type OfferImagePlacement = (typeof OFFER_IMAGE_PLACEMENTS)[number];

export const OFFER_IMAGE_PLACEMENT_LABEL: Record<OfferImagePlacement, string> = {
  background: "Background",
  top: "Top",
  left: "Left",
  right: "Right",
  bottom: "Bottom",
};

export function asOfferImagePlacement(value: string | null | undefined): OfferImagePlacement | null {
  if (value && (OFFER_IMAGE_PLACEMENTS as readonly string[]).includes(value)) {
    return value as OfferImagePlacement;
  }
  return null;
}

export function escapeOfferImageUrl(url: string) {
  return url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

/** Email-safe picture. Tables keep left/right readable in older clients. */
export function offerEmailPictureHtml(imageUrl: string, placement: OfferImagePlacement) {
  const src = escapeOfferImageUrl(imageUrl);
  if (placement === "top" || placement === "background") {
    return `<img src="${src}" alt="" width="560" style="display:block;width:100%;max-height:${
      placement === "background" ? "280" : "200"
    }px;object-fit:cover;border:0" />`;
  }
  if (placement === "bottom") {
    return `<img src="${src}" alt="" width="560" style="display:block;width:100%;max-height:180px;object-fit:cover;border:0;margin:18px 0 0" />`;
  }
  return `<img src="${src}" alt="" width="180" style="display:block;width:180px;max-width:100%;height:220px;object-fit:cover;border:0" />`;
}

export function wrapOfferEmailCard(inner: string, imageUrl: string | null | undefined, placement: OfferImagePlacement | null) {
  const art = imageUrl && placement ? offerEmailPictureHtml(imageUrl, placement) : "";
  const cardOpen =
    '<div style="max-width:560px;margin:0 auto;background:#fffdf8;border:1px solid #e6dfd0;border-radius:18px;overflow:hidden">';
  if (!art || !placement) {
    return `${cardOpen}<div style="padding:32px">${inner}</div></div>`;
  }
  if (placement === "background" || placement === "top") {
    const wash = placement === "background" ? "background:rgba(255,253,248,0.88)" : "";
    return `${cardOpen}${art}<div style="padding:32px;${wash}">${inner}</div></div>`;
  }
  if (placement === "bottom") {
    return `${cardOpen}<div style="padding:32px 32px 0">${inner}</div>${art}</div>`;
  }
  const imageCell = `<td style="width:180px;vertical-align:top">${art}</td>`;
  const copyCell = `<td style="padding:28px 24px;vertical-align:top">${inner}</td>`;
  const row = placement === "left" ? `${imageCell}${copyCell}` : `${copyCell}${imageCell}`;
  return `${cardOpen}<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${row}</tr></table></div>`;
}

const MAX_SIDE = 1400;
const JPEG_QUALITY = 0.82;

/** Shrink a photo so the template stays light enough for email. */
export async function compressOfferImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Choose a JPEG or PNG picture.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Pictures need to be under 8 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that picture.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}
