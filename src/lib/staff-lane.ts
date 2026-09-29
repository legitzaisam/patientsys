import { initialsOf, laneFor, type LaneTone } from "@/lib/practitioner-colours";

/**
 * How a team member is shown as a chip or a small avatar on the Patients and
 * Tasks pages. The colour is the same deterministic lane the sidebar's Team
 * list uses (`laneFor(id)`), so a practitioner reads the same everywhere.
 */

const HONORIFICS = new Set(["dr", "mr", "mrs", "ms", "miss", "mx", "prof", "professor"]);

/** "Dr Nadia Rahman" → ["Nadia", "Rahman"]. */
export function nameParts(fullName: string | null | undefined): string[] {
  const words = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 1 && HONORIFICS.has(words[0]!.toLowerCase().replace(/\.$/, ""))) {
    return words.slice(1);
  }
  return words;
}

/** "Dr Nadia Rahman" → "Nadia R."; "Maya Chen" → "Maya C."; "Sofia" → "Sofia". */
export function shortName(fullName: string | null | undefined): string {
  const parts = nameParts(fullName);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]![0]!.toUpperCase()}.`;
}

/** First name without the title: "Dr Nadia Rahman" → "Nadia". */
export function firstName(fullName: string | null | undefined): string {
  return nameParts(fullName)[0] ?? "";
}

export type StaffLane = {
  tone: LaneTone;
  initials: string;
  short: string;
  first: string;
};

export function staffLane(
  id: string | null | undefined,
  fullName: string | null | undefined,
): StaffLane {
  const name = fullName ?? "";
  return {
    tone: laneFor(id),
    initials: initialsOf(name) || "?",
    short: shortName(name),
    first: firstName(name),
  };
}
