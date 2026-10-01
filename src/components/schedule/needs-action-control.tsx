/**
 * The diary's single "Needs action" control (from the status-filter mockup).
 *
 * One pill beside "View by": the main button highlights everything
 * outstanding, the caret opens a menu to narrow it to one type. Matching
 * cards keep their place and gain a ring and tag chips; the rest fade. At
 * zero the pill reads "All clear" and does nothing. The diary shows; the
 * chasing happens from Attention needed on the dashboard.
 */
import { Link } from "@tanstack/react-router";
import { Check, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  FLAG_LABEL,
  NEEDS_ACTION_TYPES,
  type NeedsActionType,
} from "@/lib/metrics/appointment-flags";
import { cn } from "@/lib/utils";
import type { NeedsActionSelection, NeedsActionSummary } from "./needs-action";

const TONE: Record<NeedsActionType, { swatch: string; chip: string }> = {
  unpaid: { swatch: "bg-destructive-ink", chip: "bg-destructive-bg text-destructive-ink" },
  deposit_due: { swatch: "bg-warning-ink", chip: "bg-warning-bg text-warning-ink" },
  consent_due: { swatch: "bg-sky-ink", chip: "bg-sky-bg text-sky-ink" },
  running_late: { swatch: "bg-destructive-ink", chip: "bg-destructive-bg text-destructive-ink" },
  details_incomplete: { swatch: "bg-accent-ink", chip: "bg-accent-soft text-accent-ink" },
};

export function NeedsActionControl({
  counts,
  value,
  onChange,
}: {
  counts: NeedsActionSummary["counts"];
  value: NeedsActionSelection;
  onChange: (next: NeedsActionSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const on = value !== null;
  const label = value && value !== "any" ? FLAG_LABEL[value] : "Needs action";
  const shown = value && value !== "any" ? counts[value] : counts.any;

  if (counts.any === 0 && !on) {
    return (
      <span
        data-qc="needs-action-all-clear"
        className="inline-flex h-[30px] items-center gap-2 rounded-full bg-success-bg px-3 text-[12.5px] font-medium text-success-ink"
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
        All clear
      </span>
    );
  }

  return (
    <div className="flex items-center" data-qc="needs-action" data-state={on ? "on" : "off"}>
      <div
        className={cn(
          "inline-flex items-stretch overflow-hidden rounded-full transition-colors",
          on
            ? "bg-destructive-bg shadow-[inset_0_0_0_1.5px_rgba(163,69,110,0.55)]"
            : "bg-[rgba(47,63,102,0.05)] hover:bg-[rgba(47,63,102,0.09)]",
        )}
      >
        <button
          type="button"
          data-qc="needs-action-main"
          aria-pressed={on}
          onClick={() => {
            setOpen(false);
            onChange(on ? null : "any");
          }}
          className={cn(
            "inline-flex cursor-pointer items-center gap-2 py-[7px] pr-1.5 pl-3 text-[12.5px] font-medium",
            on ? "text-destructive-ink" : "text-ink-2",
          )}
        >
          <span className="h-[7px] w-[7px] rounded-full bg-destructive-ink" aria-hidden />
          <span>{label}</span>
          <span
            data-qc="needs-action-count"
            className="inline-grid h-5 min-w-5 place-items-center rounded-full bg-background px-1.5 text-[11px] font-semibold tabular-nums"
          >
            {shown}
          </span>
        </button>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              data-qc="needs-action-caret"
              aria-label="Choose type"
              aria-expanded={open}
              className={cn(
                "inline-flex cursor-pointer items-center border-l border-[rgba(47,63,102,0.08)] pr-2.5 pl-1.5",
                on ? "text-destructive-ink" : "text-ink-2",
              )}
            >
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            data-qc="needs-action-menu"
            // Full width on a phone, a compact menu everywhere else.
            className="w-[calc(calc(100*var(--app-vw))-2rem)] rounded-2xl p-1.5 sm:w-[250px]"
          >
            <MenuItem
              swatch="bg-destructive-ink"
              label="Everything outstanding"
              count={counts.any}
              selected={value === "any"}
              qc="needs-action-item-any"
              onPick={() => {
                onChange("any");
                setOpen(false);
              }}
            />
            <div className="mx-1.5 my-1 h-px bg-edge" aria-hidden />
            {NEEDS_ACTION_TYPES.map((key) => (
              <MenuItem
                key={key}
                swatch={TONE[key].swatch}
                label={FLAG_LABEL[key]}
                count={counts[key]}
                selected={value === key}
                qc={`needs-action-item-${key}`}
                onPick={() => {
                  onChange(key);
                  setOpen(false);
                }}
              />
            ))}
            <div className="mx-1.5 my-1 h-px bg-edge" aria-hidden />
            <p className="px-2.5 pt-2 pb-1.5 text-[11.5px] leading-snug text-ink-3">
              To chase these, open{" "}
              <Link
                to="/dashboard"
                className="font-semibold text-foreground underline underline-offset-2"
              >
                Attention needed
              </Link>{" "}
              on the dashboard.
            </p>
          </PopoverContent>
        </Popover>
      </div>
      {on ? (
        <button
          type="button"
          data-qc="needs-action-clear"
          onClick={() => onChange(null)}
          className="ml-1 inline-flex min-h-7 cursor-pointer items-center px-1.5 text-xs text-ink-3 underline underline-offset-[3px] hover:text-foreground"
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}

function MenuItem({
  swatch,
  label,
  count,
  selected,
  qc,
  onPick,
}: {
  swatch: string;
  label: string;
  count: number;
  selected: boolean;
  qc: string;
  onPick: () => void;
}) {
  const zero = count === 0;
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      data-qc={qc}
      disabled={zero}
      onClick={onPick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] transition-colors",
        zero
          ? "cursor-default text-ink-3"
          : "cursor-pointer text-foreground hover:bg-[rgba(47,63,102,0.05)]",
        selected && "bg-[rgba(47,63,102,0.06)] font-semibold",
      )}
    >
      <span className={cn("h-[9px] w-[9px] shrink-0 rounded-full", swatch)} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="text-xs tabular-nums text-ink-3">{count}</span>
      {selected ? <Check className="h-3 w-3 text-ink-2" aria-hidden /> : null}
    </button>
  );
}

/** Tag chips shown on a matching card while filtering. */
export function NeedsActionTags({ types }: { types: NeedsActionType[] }) {
  if (types.length === 0) return null;
  return (
    <div className="relative mt-1.5 flex flex-wrap gap-1" data-qc="needs-action-tags">
      {types.map((t) => (
        <span
          key={t}
          className={cn(
            "rounded-full px-2 py-[3px] text-[10.5px] font-semibold leading-none",
            TONE[t].chip,
          )}
        >
          {FLAG_LABEL[t]}
        </span>
      ))}
    </div>
  );
}
