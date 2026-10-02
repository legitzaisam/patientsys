import type { JournalEntryRow } from "@/components/patients/record/latest-journal-card";
import { journalDayLabel, shortDate } from "@/lib/patients/record-overview";

/** Every journal entry the patient chose to share, newest first, with a photo where there is one. */
export function JournalList({
  journal,
  treatments,
}: {
  journal: JournalEntryRow[];
  treatments: { name: string; performed_at: string }[];
}) {
  const entries = [...journal].sort((a, b) => b.entry_date.localeCompare(a.entry_date));
  return (
    <section className="glass-card flex flex-col gap-3 px-[22px] py-5" data-qc="journal-list">
      <div>
        <h2 className="text-base font-medium text-foreground">Journal</h2>
        <p className="mt-0.5 text-xs text-ink-2">
          Only entries the patient chose to share with the clinic.
        </p>
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-ink-2">No journal entries shared yet.</p>
      ) : (
        entries.map((entry) => {
          const photo = entry.attachments?.find((a) => a.kind === "photo") ?? null;
          const photos = entry.attachments?.filter((a) => a.kind === "photo").length ?? 0;
          const day = journalDayLabel(entry, treatments);
          // A title of the patient's own ("Sync journal", "First week") shows above the body;
          // a "Day 4" title is already the day label.
          const title =
            entry.title?.trim() && entry.title.trim() !== day ? entry.title.trim() : null;
          return (
            <article
              key={entry.id}
              className="flex gap-3 rounded-[14px] border border-edge-2 bg-[rgba(255,255,255,0.6)] p-3"
              data-qc="journal-entry"
            >
              {photo ? (
                <span
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[repeating-linear-gradient(45deg,rgba(47,63,102,0.06)_0_6px,rgba(47,63,102,0.02)_6px_12px)]"
                  aria-label={`${photos} ${photos === 1 ? "photo" : "photos"}`}
                >
                  {photo.url ? (
                    <img src={photo.url} alt="" className="h-full w-full object-cover" />
                  ) : null}
                  {photos > 1 ? (
                    <span className="absolute bottom-1 right-1 rounded-full bg-[rgba(47,63,102,0.7)] px-1.5 text-[10px] font-semibold text-white">
                      +{photos - 1}
                    </span>
                  ) : null}
                </span>
              ) : null}
              <div className="flex min-w-0 flex-col gap-[3px]">
                <span className="text-[11.5px] text-ink-2">
                  {day} · {shortDate(entry.entry_date)}
                </span>
                {title && entry.body?.trim() ? (
                  <span className="text-[13px] font-semibold text-foreground">{title}</span>
                ) : null}
                <span className="text-[13px] leading-[1.5] text-foreground [text-wrap:pretty]">
                  {entry.body?.trim() || title}
                </span>
              </div>
            </article>
          );
        })
      )}
    </section>
  );
}
