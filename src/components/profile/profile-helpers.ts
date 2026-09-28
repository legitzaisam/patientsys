import { useQuery, type useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getStaffSchedule } from "@/lib/clinic.functions";
import { ESSENTIAL_DOC_CATEGORIES } from "@/lib/staff-doc-compliance";
import { parseDayKey } from "@/lib/staff-schedule";
import type { ProfileMode, ProfileSubject, ProfileTabKey } from "./profile-types";

const DAY_MS = 86_400_000;

const TAB_KEYS: ProfileTabKey[] = [
  "overview",
  "earnings",
  "schedule",
  "documents",
  "security",
  "access",
];

/** Narrows a `?tab=` search value to a known tab key. */
export function asProfileTab(value: unknown): ProfileTabKey | undefined {
  return TAB_KEYS.includes(value as ProfileTabKey) ? (value as ProfileTabKey) : undefined;
}

/** Whole days from today (clinic-local) to a YYYY-MM-DD date; negative once past. */
export function daysUntil(dateKey: string, todayKey: string): number {
  return Math.round((Date.parse(dateKey) - Date.parse(todayKey)) / DAY_MS);
}

/** "Apr 2027" for a YYYY-MM-DD date. */
export function monthYear(dateKey: string): string {
  const [y, m] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, 1)).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type HeroChip = {
  id: string;
  label: string;
  tone: "warning" | "success" | "destructive";
  tab?: ProfileTabKey;
};

/** The chips under the name: registration renewal, insurance, documents to upload. */
export function heroChips(subject: ProfileSubject, todayKey: string): HeroChip[] {
  const chips: HeroChip[] = [];
  const body =
    subject.registrationBody && subject.registrationBody !== "None"
      ? subject.registrationBody
      : null;
  if (body && subject.registrationExpiry) {
    const days = daysUntil(subject.registrationExpiry, todayKey);
    if (days < 0)
      chips.push({
        id: "registration",
        label: `${body} registration lapsed`,
        tone: "destructive",
        tab: "overview",
      });
    else if (days <= 90)
      chips.push({
        id: "registration",
        label: `${body} renewal in ${days} day${days === 1 ? "" : "s"}`,
        tone: "warning",
        tab: "overview",
      });
    else
      chips.push({
        id: "registration",
        label: `${body} registered`,
        tone: "success",
        tab: "overview",
      });
  }
  if (subject.insuranceExpiry) {
    const days = daysUntil(subject.insuranceExpiry, todayKey);
    if (days < 0)
      chips.push({
        id: "insurance",
        label: "Insurance lapsed",
        tone: "destructive",
        tab: "overview",
      });
    else if (days <= 60)
      chips.push({
        id: "insurance",
        label: `Insurance renews in ${days} day${days === 1 ? "" : "s"}`,
        tone: "warning",
        tab: "overview",
      });
    else
      chips.push({
        id: "insurance",
        label: `Insured to ${monthYear(subject.insuranceExpiry)}`,
        tone: "success",
        tab: "overview",
      });
  }
  const missing = ESSENTIAL_DOC_CATEGORIES.filter(
    (c) => !subject.presentCategories.includes(c.value),
  ).length;
  if (missing > 0) {
    chips.push({
      id: "documents",
      label: `${missing} document${missing === 1 ? "" : "s"} to upload`,
      tone: "destructive",
      tab: "documents",
    });
  }
  return chips;
}

/** First and last instant of the calendar month `todayKey` falls in, as ISO. */
export function monthRangeOf(todayKey: string): {
  from: string;
  to: string;
  year: number;
  month: number;
} {
  const { year, month } = parseDayKey(todayKey);
  const from = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const to = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)).toISOString();
  return { from, to, year, month };
}

/** The qualifications text is a comma-separated list; the card shows it as chips. */
export function splitQualifications(text: string): string[] {
  return text
    .split(/,|\n/)
    .map((q) => q.trim())
    .filter(Boolean);
}

export function joinQualifications(items: readonly string[]): string {
  return items.join(", ");
}

/** Every query that shows profile fields, so a save is reflected wherever the person appears. */
export function invalidateProfileQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  userId: string,
) {
  queryClient.invalidateQueries({ queryKey: ["my-profile"] });
  queryClient.invalidateQueries({ queryKey: ["staff-profile", userId] });
  queryClient.invalidateQueries({ queryKey: ["me"] });
  queryClient.invalidateQueries({ queryKey: ["team"] });
}

/** Loads the subject's schedule for the cards that need it (week, chips). */
export function useStaffSchedule(userId: string, mode: ProfileMode) {
  const fetchSchedule = useServerFn(getStaffSchedule);
  return useQuery({
    queryKey: ["staff-schedule", mode === "self" ? "self" : userId],
    queryFn: () => fetchSchedule({ data: mode === "self" ? {} : { userId } }),
  });
}
