/**
 * Colour key under the timetable: one swatch per treatment in view, in the
 * same tone the diary cards use (manager overrides included), so nobody has
 * to guess what a pastel means.
 */
import { toneForTreatment } from "@/lib/practitioner-colours";

export function ColourKey({
  appointments,
  colours,
}: {
  appointments: { treatment_name?: string | null }[];
  colours: Record<string, number | string>;
}) {
  const names = [
    ...new Set(appointments.map((a) => a.treatment_name?.trim()).filter(Boolean)),
  ] as string[];
  names.sort((a, b) => a.localeCompare(b));
  if (names.length === 0) return null;
  return (
    <div
      data-qc="colour-key"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-glass-line bg-glass-2 px-5 py-2 text-2xs text-muted-foreground"
    >
      <span className="font-semibold tracking-[0.02em] text-ink-3">Colours</span>
      {names.map((name) => {
        const tone = toneForTreatment(name, colours);
        return (
          <span key={name} className="inline-flex items-center gap-1.5" style={tone.style}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.edge}`} aria-hidden />
            <span className="text-foreground">{name}</span>
          </span>
        );
      })}
    </div>
  );
}
