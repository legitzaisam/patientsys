import { Link } from "@tanstack/react-router";
import { Clock3 } from "lucide-react";
import { ToneChip } from "@/components/patients/record/chips";
import {
  RecordCard,
  recordLinkClass,
  recordRowClass,
} from "@/components/patients/record/record-card";
import {
  clockTime,
  dateBlock,
  upcomingIssueChips,
  upcomingMeta,
  type UpcomingLike,
} from "@/lib/patients/record-overview";
import { cn } from "@/lib/utils";

export type UpcomingBooking = UpcomingLike & {
  treatmentName: string;
  practitionerName: string | null;
  issues: string[];
  bookingNote: string;
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Every future booking with its date block, who and when, what still needs
 * chasing, and whether a plan step claims it. Rows with something to sort
 * out keep the `booking-chase-item` hook the Treatments badge is counted by.
 */
export function UpcomingCard({
  upcoming,
  onPlanIds,
  chaseFocus,
  canSendForms,
  onSendConsent,
}: {
  upcoming: UpcomingBooking[];
  onPlanIds: Set<string>;
  chaseFocus?: boolean;
  canSendForms: boolean;
  onSendConsent: () => void;
}) {
  return (
    <RecordCard
      icon={<Clock3 />}
      tone="sky"
      title="Upcoming"
      meta={upcomingMeta(upcoming, onPlanIds)}
      data-qc="upcoming-card"
      className="scroll-mt-24"
      footer={
        <div className="ml-auto flex flex-wrap gap-3.5">
          {canSendForms ? (
            <button
              type="button"
              className={recordLinkClass}
              onClick={onSendConsent}
              data-qc="upcoming-send-consent"
            >
              Send consent forms
            </button>
          ) : null}
          <Link to="/schedule" className={recordLinkClass} data-qc="upcoming-open-diary">
            Open diary →
          </Link>
        </div>
      }
    >
      {chaseFocus && upcoming.some((b) => b.issues.length) ? (
        <p className="-mt-1 text-xs text-ink-2">
          These visits still need chasing — deposits, balances or consent.
        </p>
      ) : null}
      {upcoming.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-edge-2 bg-glass-2 px-4 py-6 text-center text-sm text-ink-2">
          Nothing booked. Open the diary to find a slot.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {upcoming.map((b) => {
            const chips = upcomingIssueChips(b);
            const block = dateBlock(b.startsAt);
            const day = WEEKDAY[new Date(b.startsAt).getDay()];
            return (
              <li
                key={b.id}
                className={cn(recordRowClass, "flex items-center gap-3")}
                data-qc={b.issues.length ? "booking-chase-item" : "upcoming-row"}
                data-on-plan={onPlanIds.has(b.id) ? "true" : "false"}
              >
                <div className="flex w-[46px] shrink-0 flex-col items-center rounded-xl bg-[rgba(190,224,244,0.45)] py-[5px]">
                  <span className="text-[10px] font-semibold tracking-[0.06em] text-sky-ink">
                    {block.month}
                  </span>
                  <span className="text-[19px] font-semibold leading-[1.05] text-foreground">
                    {block.day}
                  </span>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
                  <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="text-[13.5px] font-semibold text-foreground">
                      {b.treatmentName}
                    </span>
                    <span className="text-xs text-ink-2">
                      {[day, clockTime(b.startsAt), b.practitionerName].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  {chips.length || !onPlanIds.has(b.id) ? (
                    <div className="flex flex-wrap gap-1">
                      {chips.map((c) => (
                        <ToneChip key={c.label} tone={c.tone}>
                          {c.label}
                        </ToneChip>
                      ))}
                      {!onPlanIds.has(b.id) ? (
                        <ToneChip tone="neutral">Not on skin plan</ToneChip>
                      ) : null}
                    </div>
                  ) : null}
                  {b.bookingNote ? (
                    <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-2">
                      {b.bookingNote}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </RecordCard>
  );
}
