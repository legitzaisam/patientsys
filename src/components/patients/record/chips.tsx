import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The record's small status chips, one tone per meaning so the Overview,
 * Treatments and From the patient tabs read the same: alert (money, flagged
 * check-ins, Not booked), review (consent, patient updates), done, sky
 * (dates, recalls, photos), current (the step in progress), upcoming, the
 * dashed neutral "Not on skin plan", journal and moderate severity.
 */
export type ChipTone =
  "alert" | "review" | "done" | "sky" | "current" | "upcoming" | "neutral" | "journal" | "moderate";

const CHIP_TONE: Record<ChipTone, string> = {
  alert: "bg-destructive-bg text-destructive-ink",
  review: "bg-warning-bg text-warning-ink",
  done: "bg-success-bg text-success-ink",
  sky: "bg-sky-bg text-sky-ink",
  current: "bg-[rgba(238,212,136,0.5)] text-accent-ink",
  upcoming: "border border-edge-2 bg-[rgba(255,255,255,0.8)] text-ink-2",
  neutral: "border border-dashed border-[rgba(70,85,122,0.35)] bg-transparent text-ink-2",
  journal: "bg-[rgba(239,155,196,0.3)] text-aftercare-ink",
  moderate: "bg-noshow-bg text-noshow-ink",
};

export function ToneChip({
  tone,
  children,
  className,
  ...rest
}: {
  tone: ChipTone;
  children: ReactNode;
  className?: string;
} & Record<`data-${string}`, string | undefined>) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-[9px] py-px text-[11px] font-medium leading-[1.5]",
        CHIP_TONE[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}

/**
 * The count beside a tab label: pink circle for things waiting on a clinician
 * (Medical history, From the patient), gold figure for Treatments. Renders
 * nothing at zero.
 */
export function TabBadge({
  count,
  tone,
  title,
  ...rest
}: {
  count: number;
  tone: "pink" | "gold";
  title?: string;
} & Record<`data-${string}`, string | undefined>) {
  if (!count) return null;
  if (tone === "gold") {
    return (
      <span className="text-[10.5px] font-semibold text-accent-ink" title={title} {...rest}>
        {count}
      </span>
    );
  }
  return (
    <span
      className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[rgba(250,204,226,0.7)] px-[5px] text-[10.5px] font-semibold text-destructive-ink"
      title={title}
      {...rest}
    >
      {count}
    </span>
  );
}
