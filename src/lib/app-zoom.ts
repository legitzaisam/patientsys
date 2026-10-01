/**
 * Effective CSS zoom applied to the whole app (see "Default app zoom" in
 * src/styles.css).
 *
 * Pointer coordinates (clientX/clientY), getBoundingClientRect() and
 * window.innerWidth/innerHeight are in screen pixels, while CSS lengths written
 * by JS (style.left, width, translate, scrollLeft…) are pre-zoom pixels. Divide
 * a screen-pixel distance by this value before using it as a CSS length.
 *
 * Measured rather than read from the stylesheet so it stays correct in browsers
 * that report geometry differently: if rects already come back unscaled the
 * ratio is 1 and nothing is corrected.
 */
export function getAppZoom(): number {
  if (typeof document === "undefined") return 1;
  const root = document.documentElement;
  const layoutWidth = root.offsetWidth;
  if (!layoutWidth) return 1;
  const ratio = root.getBoundingClientRect().width / layoutWidth;
  return Number.isFinite(ratio) && ratio > 0 ? Math.round(ratio * 1000) / 1000 : 1;
}

/** Converts a screen-pixel length (pointer delta, rect size) to CSS pixels. */
export function toCssPx(screenPx: number): number {
  return screenPx / getAppZoom();
}
