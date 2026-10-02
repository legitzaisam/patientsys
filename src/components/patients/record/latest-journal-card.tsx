import { PenLine } from "lucide-react";
import { ToneChip } from "@/components/patients/record/chips";
import { RecordCard, recordLinkClass } from "@/components/patients/record/record-card";
import {
  clockTime,
  journalDayLabel,
  shortDay,
  type JournalEntryLike,
} from "@/lib/patients/record-overview";

export type JournalEntryRow = JournalEntryLike & {
  id: string;
  created_at: string;
  attachments?: { id: string; kind: string; url: string | null }[];
};

/**
 * The newest journal entry the patient chose to share, in full with its
 * photos, and the one before it in a line. Everything else is on From the patient.
 */
export function LatestJournalCard({
  journal,
  treatments,
  onReply,
  onAllEntries,
}: {
  journal: JournalEntryRow[];
  treatments: { name: string; performed_at: string }[];
  onReply: () => void;
  onAllEntries: () => void;
}) {
  const [latest, previous] = journal;
  return (
    <RecordCard
      icon={<PenLine />}
      tone="journal"
      title="Latest journal"
      meta={latest ? "Shared by patient" : undefined}
      data-qc="latest-journal-card"
      footer={
        <>
          <button
            type="button"
            className={recordLinkClass}
            onClick={onReply}
            data-qc="journal-reply"
          >
            Reply in chat
          </button>
          <button
            type="button"
            className={recordLinkClass}
            onClick={onAllEntries}
            data-qc="journal-all"
          >
            All entries →
          </button>
        </>
      }
    >
      {!latest ? (
        <p className="rounded-2xl border border-dashed border-edge-2 bg-glass-2 px-4 py-6 text-center text-sm text-ink-2">
          Nothing shared yet. Entries the patient shares from their portal show here.
        </p>
      ) : (
        <>
          <div
            className="flex flex-col gap-2.5 rounded-2xl border border-[rgba(239,155,196,0.22)] bg-[rgba(239,155,196,0.1)] px-4 py-3.5"
            data-qc="journal-latest"
          >
            <div className="flex items-center gap-2">
              <ToneChip tone="journal">{journalDayLabel(latest, treatments)}</ToneChip>
              <span className="text-xs text-ink-2">
                {shortDay(latest.entry_date)} · {clockTime(latest.created_at)}
              </span>
            </div>
            <p className="text-sm leading-[1.5] text-foreground [text-wrap:pretty]">
              {latest.body ? `“${latest.body}”` : latest.title}
            </p>
            {latest.attachments?.some((a) => a.kind === "photo") ? (
              <div className="flex gap-1.5">
                {latest.attachments
                  .filter((a) => a.kind === "photo")
                  .slice(0, 4)
                  .map((a) => (
                    <span
                      key={a.id}
                      className="h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[14px] border border-edge-2 bg-[repeating-linear-gradient(45deg,rgba(47,63,102,0.06)_0_6px,rgba(47,63,102,0.02)_6px_12px)]"
                    >
                      {a.url ? (
                        <img src={a.url} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </span>
                  ))}
              </div>
            ) : null}
          </div>
          {previous ? (
            <div
              className="flex items-baseline gap-2.5 text-[12.5px] text-ink-2"
              data-qc="journal-previous"
            >
              <span className="shrink-0 font-semibold text-foreground">
                {journalDayLabel(previous, treatments)}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {previous.body ? `“${previous.body}”` : previous.title}
              </span>
            </div>
          ) : null}
        </>
      )}
    </RecordCard>
  );
}
