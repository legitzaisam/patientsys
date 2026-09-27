/**
 * Chart colours from the brand's pastel tokens, ordered so that neighbouring
 * series stay apart on a projector: butter, sky, pink, green, lilac. Charts
 * on Insights, Retention and Performance read from here, so a series has the
 * same colour on every page.
 */
export const CHART_SERIES = [
  "var(--accent)", // butter
  "var(--sky)", // sky blue
  "var(--destructive)", // pink
  "var(--success)", // green
  "var(--warning)", // lilac
] as const;

/** The two-tone pair for a donut or a paired bar: primary butter, secondary sky. */
export const CHART_PAIR = [CHART_SERIES[0], CHART_SERIES[1]] as const;

/** A quiet fill for the "rest" of a whole (e.g. inactive). */
export const CHART_MUTED = "rgba(47, 63, 102, 0.28)";

/** Deeper stroke for a line over a butter fill. */
export const CHART_LINE = "var(--accent-deep)";

export function seriesColour(index: number): string {
  return CHART_SERIES[index % CHART_SERIES.length]!;
}
