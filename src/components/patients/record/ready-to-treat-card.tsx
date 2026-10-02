import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  PaymentStatusChip,
  type PaymentChipAppointment,
} from "@/components/payments/payment-status-chip";
import {
  clockTime,
  shortDay,
  type ReadinessItem,
  type ReadinessLink,
  type ReadinessTone,
} from "@/lib/patients/record-overview";
import { cn } from "@/lib/utils";

/**
 * The Overview's hero: today's visit on a gold wash, and the readiness
 * checklist beside it — items synced from the patient portal are marked.
 * Actionable rows are links in text only; the whole row is the target.
 */
export type ReadyToTreatVisit = {
  id: string;
  startsAt: string;
  endsAt: string | null;
  treatment: string;
  practitionerName: string | null;
  stage: string;
  consentState: "not_required" | "outstanding" | "signed";
  paymentStatus: string | null;
  price: number | null;
};

const ROW_TONE: Record<ReadinessTone, string> = {
  alert: "bg-[rgba(250,204,226,0.3)]",
  review: "bg-[rgba(224,213,248,0.35)]",
  todo: "border border-edge-2 bg-[rgba(255,255,255,0.6)]",
  done: "bg-[rgba(179,232,196,0.3)]",
};

function Mark({ tone }: { tone: ReadinessTone }) {
  if (tone === "todo")
    return (
      <span className="h-5 w-5 shrink-0 rounded-full border-2 border-destructive" aria-hidden />
    );
  return (
    <span
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] text-white",
        tone === "alert" && "bg-destructive",
        tone === "review" && "bg-warning",
        tone === "done" && "bg-success",
      )}
      aria-hidden
    >
      {tone === "done" ? "✓" : "!"}
    </span>
  );
}

const LINK_LABEL: Record<Exclude<ReadinessLink, null>, string> = {
  portal: "Review",
  history: "Review",
  payment: "Take payment",
  consent: "Send form",
};

export function ReadyToTreatCard({
  visit,
  nextAppointmentAt,
  items,
  clear,
  total,
  payment,
  canTreat,
  onReview,
  onSendConsent,
  onContinue,
}: {
  visit: ReadyToTreatVisit | null;
  nextAppointmentAt: string | null;
  items: ReadinessItem[];
  clear: number;
  total: number;
  /** Today's appointment shaped for the payment chip, with the patient's contact details. */
  payment: PaymentChipAppointment | null;
  canTreat: boolean;
  onReview: (tab: "portal" | "history") => void;
  onSendConsent: () => void;
  onContinue: () => void;
}) {
  const minutes =
    visit?.endsAt && visit.startsAt
      ? Math.round((new Date(visit.endsAt).getTime() - new Date(visit.startsAt).getTime()) / 60000)
      : null;
  const pct = total === 0 ? 0 : Math.round((clear / total) * 100);
  const treating = visit?.stage === "in_treatment" || visit?.stage === "aftercare";
  const consentHold = visit?.consentState === "outstanding";

  const linkFor = (item: ReadinessItem): ReactNode => {
    if (!item.link) return null;
    const label = LINK_LABEL[item.link];
    const text = (
      <span className="whitespace-nowrap text-xs font-medium text-accent-ink group-hover:underline">
        {label}
      </span>
    );
    if (item.link === "payment" && payment)
      return (
        <PaymentStatusChip
          a={payment}
          align="end"
          trigger={<button type="button">{text}</button>}
        />
      );
    return text;
  };
  const activate = (item: ReadinessItem) => {
    if (item.link === "portal" || item.link === "history") onReview(item.link);
    if (item.link === "consent") onSendConsent();
  };

  return (
    <section
      className="glass-card grid overflow-hidden p-0 sm:grid-cols-[minmax(200px,240px)_minmax(0,1fr)]"
      data-qc="ready-to-treat"
      data-clear={clear}
      data-total={total}
    >
      <div
        className="flex flex-col gap-1.5 p-6"
        style={{
          background: "linear-gradient(160deg, rgba(250,237,194,0.95), rgba(238,212,136,0.35))",
        }}
        data-qc="today-visit"
      >
        <span className="text-[11px] font-semibold tracking-[0.06em] text-accent-ink">
          {visit ? "TODAY'S VISIT" : nextAppointmentAt ? "NEXT VISIT" : "NO VISIT TODAY"}
        </span>
        <span className="text-[44px] font-medium leading-none tracking-[-0.03em] text-foreground">
          {visit
            ? clockTime(visit.startsAt)
            : nextAppointmentAt
              ? shortDay(nextAppointmentAt)
              : "—"}
        </span>
        <span className="mt-1.5 text-[15px] font-semibold text-foreground">
          {visit
            ? visit.treatment
            : nextAppointmentAt
              ? clockTime(nextAppointmentAt)
              : "Nothing in the diary"}
        </span>
        <span className="text-[12.5px] text-ink-2">
          {visit
            ? [visit.practitionerName, minutes ? `${minutes} min` : null]
                .filter(Boolean)
                .join(" · ")
            : "Book a visit from the Upcoming card"}
        </span>
      </div>

      <div className="flex flex-col gap-3 px-6 py-[22px]">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-[17px] font-medium text-foreground">Ready to treat?</h2>
            <p className="mt-0.5 text-xs text-ink-2">
              {total === 0
                ? "Nothing to check yet"
                : `${clear} of ${total} clear · items synced from the patient portal are marked`}
            </p>
          </div>
          <div className="h-1.5 w-[140px] rounded-full bg-[rgba(192,200,210,0.42)]" aria-hidden>
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <ul className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,400px),1fr))]">
          {items.map((item) => {
            const clickable =
              item.link === "portal" || item.link === "history" || item.link === "consent";
            return (
              <li
                key={`${item.kind}-${item.title}`}
                className={cn(
                  "group flex items-center gap-2.5 rounded-[14px] px-3 py-2.5",
                  ROW_TONE[item.tone],
                  clickable && "cursor-pointer",
                )}
                data-qc="readiness-item"
                data-kind={item.kind}
                data-tone={item.tone}
                onClick={clickable ? () => activate(item) : undefined}
                onKeyDown={
                  clickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          activate(item);
                        }
                      }
                    : undefined
                }
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
              >
                <Mark tone={item.tone} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground">{item.title}</p>
                  <p className="text-[11.5px] text-ink-2">{item.detail}</p>
                </div>
                {linkFor(item)}
              </li>
            );
          })}
        </ul>

        {visit && canTreat ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="text-xs text-ink-2">
              {consentHold
                ? "Consent is outstanding; the form opens once it is signed."
                : "You can still start the form. Open items carry into it."}
            </span>
            <Button
              type="button"
              data-qc="open-treatment-form"
              className="h-auto rounded-full px-[18px] py-[9px] text-[13px]"
              disabled={consentHold || visit.stage === "no_show"}
              title={consentHold ? "Consent is outstanding" : undefined}
              onClick={onContinue}
            >
              {treating ? "Continue treatment form" : "Start treatment"}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
