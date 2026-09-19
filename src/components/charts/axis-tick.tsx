/** Evenly spaced tick positions, always including first and last. */
export function evenTickIndexes(length: number, maxTicks = 12): number[] {
  if (length <= 0) return [];
  const count = Math.min(length, maxTicks);
  if (count === 1) return [0];
  const last = length - 1;
  return Array.from({ length: count }, (_, i) => (i * last) / (count - 1));
}

/** Equal-index labels, always including first and last. */
export function evenIndexTicks(labels: string[], count = 12): string[] {
  const idxs = evenTickIndexes(labels.length, count);
  return [...new Set(idxs.map((i) => labels[Math.round(i)]!))];
}

export function labelAt(labels: string[], index: unknown) {
  const i = Math.round(Number(index));
  if (!Number.isFinite(i) || i < 0 || i >= labels.length) return "";
  return labels[i] ?? "";
}

export const DATE_AXIS_PADDING = { left: 20, right: 20 };

export const DATE_CHART_MARGIN = { top: 8, right: 16, left: 4, bottom: 48 };

export const DATE_CHART_MARGIN_FLAT = { top: 4, right: 16, left: 4, bottom: 16 };

type TickProps = {
  x?: number;
  y?: number;
  payload?: { value?: string | number };
  angled?: boolean;
  label?: string;
  /** Extra pixels between the axis and the label. */
  offset?: number;
};

/** Shared −32° date tick so Retention and Performance stay aligned. */
export function DateAxisTick({
  x = 0,
  y = 0,
  payload,
  angled = true,
  label,
  offset,
}: TickProps) {
  const text = label ?? payload?.value;
  const dy = offset ?? (angled ? 10 : 12);

  return (
    <g transform={`translate(${x},${y})`}>
      <text
        dy={dy}
        textAnchor="middle"
        transform={angled ? "rotate(-32)" : undefined}
        fontSize={11}
        fill="var(--muted-foreground)"
      >
        {text}
      </text>
    </g>
  );
}
