/**
 * Pure helpers behind the diary's "Needs action" control: which menu type an
 * appointment falls under, counts for the rows in view, and card classes.
 * Kept apart from the component so fast refresh stays happy.
 */
import { useMemo } from "react";
import {
  appointmentFlags,
  type AppointmentFlagInput,
  type FlagKey,
  type NeedsActionType,
} from "@/lib/metrics/appointment-flags";

export type { NeedsActionType };
/** `null` = off, `"any"` = everything outstanding, else one type. */
export type NeedsActionSelection = null | "any" | NeedsActionType;

/**
 * Which of the menu's types an appointment falls under. "Unpaid" and
 * "Deposit due" are kept apart: a booking still ahead of its day owes a
 * deposit; on or after the day it is simply unpaid.
 */
export function needsActionTypes(flags: ReadonlySet<FlagKey>): NeedsActionType[] {
  const out: NeedsActionType[] = [];
  if (flags.has("unpaid") && !flags.has("deposit_due")) out.push("unpaid");
  if (flags.has("deposit_due")) out.push("deposit_due");
  if (flags.has("consent_due")) out.push("consent_due");
  if (flags.has("running_late")) out.push("running_late");
  if (flags.has("details_incomplete")) out.push("details_incomplete");
  return out;
}

export type NeedsActionSummary = {
  /** Types per appointment id (empty array when nothing is outstanding). */
  byId: Map<string, NeedsActionType[]>;
  counts: Record<"any" | NeedsActionType, number>;
  /** True when the appointment matches the current selection. */
  matches: (id: string, selection: NeedsActionSelection) => boolean;
};

export function summariseNeedsAction(
  rows: (AppointmentFlagInput & { id: string })[],
  opts: { nowMs: number; depositLeadDays: number },
): NeedsActionSummary {
  const byId = new Map<string, NeedsActionType[]>();
  const counts = {
    any: 0,
    unpaid: 0,
    deposit_due: 0,
    consent_due: 0,
    running_late: 0,
    details_incomplete: 0,
  };
  for (const a of rows) {
    const types = needsActionTypes(appointmentFlags(a, opts).flags);
    byId.set(a.id, types);
    if (types.length > 0) counts.any += 1;
    for (const t of types) counts[t] += 1;
  }
  return {
    byId,
    counts,
    matches: (id, selection) => {
      if (!selection) return false;
      const types = byId.get(id) ?? [];
      return selection === "any" ? types.length > 0 : types.includes(selection);
    },
  };
}

/** Hook: flags for the rows in view, recomputed on the caller's minute tick. */
export function useNeedsAction(
  rows: (AppointmentFlagInput & { id: string })[],
  opts: { nowMs: number; depositLeadDays: number },
) {
  return useMemo(
    () => summariseNeedsAction(rows, opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, opts.nowMs, opts.depositLeadDays],
  );
}

/** Card classes while a filter is on: matches ring, the rest fade in place. */
export function needsActionCardClass(active: boolean, match: boolean): string {
  if (!active) return "";
  return match
    ? "shadow-[0_0_0_2px_rgba(163,69,110,0.35),0_8px_20px_rgba(47,63,102,0.12)]"
    : "opacity-[0.28] saturate-[0.3]";
}
