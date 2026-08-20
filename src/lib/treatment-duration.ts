/** Fallback length when a catalogue item has no stored duration. */
export function defaultDurationMinutes(name: string | undefined | null) {
  const n = (name ?? "").toLowerCase();
  if (/(botox|botulinum|anti-?\s?wrinkle)/.test(n)) return 20;
  if (n.includes("consult")) return 30;
  return 60;
}

export function durationForCatalogueItem(
  item: { duration_minutes?: number | null; name?: string } | undefined | null,
) {
  const stored = Number(item?.duration_minutes);
  if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
  return defaultDurationMinutes(item?.name);
}

export function clampDurationMinutes(value: unknown) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 60;
  return Math.min(480, Math.max(5, n));
}
