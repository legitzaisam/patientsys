import { useState } from "react";
import { ToneChip } from "@/components/patients/record/chips";
import {
  historyFilter,
  longDate,
  treatmentDetailLine,
  treatmentFormChips,
  type DocumentLike,
  type HistoryFilter,
  type HistoryTreatmentLike,
  type PhotoLike,
} from "@/lib/patients/record-overview";
import { cn } from "@/lib/utils";

export type HistoryRow = HistoryTreatmentLike & {
  profiles?: { full_name?: string | null } | null;
};

const FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "prp", label: "With PRP" },
  { value: "missing", label: "Forms missing" },
];

/**
 * Every recorded treatment with its note and the forms attached to it: date
 * and clinician, what was done, and chips for the record, consent, aftercare
 * and photos, pink where something is missing.
 */
export function TreatmentHistory({
  rows,
  documents,
  photos,
  canViewRecord,
  onViewRecord,
}: {
  rows: HistoryRow[];
  documents: DocumentLike[];
  photos: PhotoLike[];
  canViewRecord: boolean;
  onViewRecord: (treatmentId: string) => void;
}) {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const chipsFor = (t: HistoryRow) => treatmentFormChips(t, documents, photos);
  const shown = historyFilter(rows, filter, chipsFor);

  return (
    <section className="glass-card flex flex-col px-6 py-5" data-qc="treatment-history">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-medium text-foreground">Treatment history</h2>
          <p className="mt-0.5 text-xs text-ink-2">
            {rows.length === 0
              ? "Nothing recorded yet"
              : `${rows.length} recorded ${rows.length === 1 ? "treatment" : "treatments"} · notes and forms attached to each`}
          </p>
        </div>
        <div
          className="flex h-[34px] shrink-0 items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi"
          role="tablist"
          aria-label="Filter treatments"
        >
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "h-7 cursor-pointer rounded-full px-3.5 text-xs tracking-[0.02em] transition-colors",
                filter === f.value
                  ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                  : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]",
              )}
              data-qc="history-filter"
              data-value={f.value}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ul>
        {shown.map((t) => {
          const chips = chipsFor(t);
          const note = t.notes?.trim();
          return (
            <li
              key={t.id}
              className="grid grid-cols-1 gap-x-4 gap-y-2 border-t border-edge-2 py-3.5 sm:grid-cols-[96px_minmax(0,1fr)] lg:grid-cols-[96px_minmax(0,1fr)_260px]"
              data-qc="history-row"
              data-id={t.id}
            >
              <div className="flex flex-col">
                <b className="text-[13px] font-semibold text-foreground">
                  {longDate(t.performed_at)}
                </b>
                <span className="text-[11.5px] text-ink-2">{t.profiles?.full_name ?? ""}</span>
              </div>
              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="text-sm font-medium text-foreground">{t.name}</span>
                  {t.hasRecord && canViewRecord ? (
                    <button
                      type="button"
                      data-qc="view-treatment-record"
                      onClick={() => onViewRecord(t.id)}
                      className="cursor-pointer text-xs font-semibold text-accent-ink hover:underline"
                    >
                      View record
                    </button>
                  ) : null}
                </div>
                {treatmentDetailLine(t) ? (
                  <span className="text-xs text-ink-2">{treatmentDetailLine(t)}</span>
                ) : null}
                {note ? (
                  <span className="whitespace-pre-wrap rounded-xl bg-[rgba(238,212,136,0.12)] px-3 py-2 text-[12.5px] leading-relaxed text-foreground">
                    {note}
                  </span>
                ) : (
                  <span className="text-xs italic text-ink-3">No notes</span>
                )}
              </div>
              <div className="flex flex-wrap content-start gap-[5px] sm:col-start-2 lg:col-start-3">
                {chips.map((c) => (
                  <ToneChip key={c.label} tone={c.tone}>
                    {c.label}
                  </ToneChip>
                ))}
              </div>
            </li>
          );
        })}
        {shown.length === 0 ? (
          <li className="border-t border-edge-2 py-6 text-sm text-ink-2">
            {rows.length === 0 ? "No treatments recorded." : "No treatments match this filter."}
          </li>
        ) : null}
      </ul>
    </section>
  );
}
