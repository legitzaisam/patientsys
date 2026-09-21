/**
 * Pure shaping helpers for the patient portal.
 *
 * Kept out of the server-function file (and free of Supabase types) so the
 * production handlers and the demo twins can derive identical view models
 * from their own row sources, and so the arithmetic is unit-testable.
 */

export type MilestoneLike = {
  id: string;
  title: string;
  status: string;
  due_date?: string | null;
  idx?: number | null;
  detail?: string | null;
  guidance?: string | null;
  icon?: string | null;
  month_group?: number | null;
  month_title?: string | null;
  month_blurb?: string | null;
};

export type ChecklistLike = {
  id: string;
  milestone_id: string;
  label: string;
  done: boolean;
  clinic_owned: boolean;
  position?: number | null;
};

const DONE_STATUSES = new Set(["done", "skipped"]);

/** Milestones the patient has finished, over the total in the plan. */
export function planProgress(milestones: MilestoneLike[]) {
  const total = milestones.length;
  const done = milestones.filter((m) => DONE_STATUSES.has(m.status)).length;
  return { done, total, pct: total === 0 ? 0 : Math.round((done / total) * 100) };
}

/** The step the patient is on: the current one, else the next unfinished one. */
export function currentMilestone(milestones: MilestoneLike[]): MilestoneLike | null {
  const ordered = sortMilestones(milestones);
  return ordered.find((m) => m.status === "current") ?? ordered.find((m) => !DONE_STATUSES.has(m.status)) ?? null;
}

export function sortMilestones(milestones: MilestoneLike[]): MilestoneLike[] {
  return [...milestones].sort((a, b) => {
    const ga = a.month_group ?? 0;
    const gb = b.month_group ?? 0;
    if (ga !== gb) return ga - gb;
    const ia = a.idx ?? 0;
    const ib = b.idx ?? 0;
    if (ia !== ib) return ia - ib;
    return String(a.due_date ?? "").localeCompare(String(b.due_date ?? ""));
  });
}

/** Group milestones into the portal's month sections, checklists attached. */
export function roadmapFor(milestones: MilestoneLike[], checklist: ChecklistLike[]) {
  const byMilestone = new Map<string, ChecklistLike[]>();
  for (const item of checklist) {
    const list = byMilestone.get(item.milestone_id) ?? [];
    list.push(item);
    byMilestone.set(item.milestone_id, list);
  }

  const groups = new Map<number, { n: number; month: string; title: string; blurb: string; steps: any[] }>();
  for (const m of sortMilestones(milestones)) {
    const n = m.month_group ?? 1;
    let group = groups.get(n);
    if (!group) {
      group = {
        n,
        month: `Month ${n}`,
        title: m.month_title ?? "",
        blurb: m.month_blurb ?? "",
        steps: [],
      };
      groups.set(n, group);
    }
    group.steps.push({
      id: m.id,
      title: m.title,
      date: m.due_date ?? null,
      status: m.status,
      statusLabel: statusLabel(m.status),
      icon: m.icon ?? "cal",
      detail: m.detail ?? "",
      guidance: m.guidance ?? "",
      checklist: (byMilestone.get(m.id) ?? [])
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((c) => ({ id: c.id, label: c.label, done: c.done, byClinic: c.clinic_owned })),
    });
  }
  return [...groups.values()].sort((a, b) => a.n - b.n);
}

export function statusLabel(status: string) {
  if (status === "done") return "Completed";
  if (status === "current") return "In progress";
  if (status === "skipped") return "Skipped";
  return "Upcoming";
}

/** The compact six-dot track on the portal home. */
export function progressTrack(milestones: MilestoneLike[]) {
  const ordered = sortMilestones(milestones);
  const current = currentMilestone(ordered);
  return ordered.slice(0, 6).map((m) => ({
    label: m.title,
    state: DONE_STATUSES.has(m.status) ? "done" : m.id === current?.id ? "current" : "upcoming",
    note: DONE_STATUSES.has(m.status) ? undefined : m.id === current?.id ? "Current" : "Upcoming",
  }));
}

/** Day N of a plan, clamped so a long-running plan never reads "Day 128 of 90". */
export function planDay(startedAt: string | null | undefined, durationDays: number | null | undefined, now = new Date()) {
  if (!startedAt || !durationDays) return null;
  const elapsed = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 86_400_000) + 1;
  return { day: Math.min(Math.max(1, elapsed), durationDays), days: durationDays };
}

/** 0-100 slider reading to the portal's wording. */
export function severityLabel(value: number) {
  if (value >= 67) return "Severe";
  if (value >= 34) return "Moderate";
  return "Mild";
}

/** A check-in is worth flagging when anything reads moderate or worse. */
export function checkinNeedsAttention(c: { redness: number; sensitivity: number; dryness: number }) {
  return Math.max(c.redness, c.sensitivity, c.dryness) >= 34;
}

/**
 * Adherence over the trailing seven days, counted from completion rows so the
 * number can never drift from the evidence behind it.
 */
export function adherenceFor(
  completions: { period: string; completed_on: string }[],
  now = new Date(),
) {
  const since = new Date(now);
  since.setDate(since.getDate() - 6);
  const sinceKey = since.toISOString().slice(0, 10);
  const recent = completions.filter((c) => c.completed_on >= sinceKey);
  const morning = new Set(recent.filter((c) => c.period === "morning").map((c) => c.completed_on)).size;
  const evening = new Set(recent.filter((c) => c.period === "evening").map((c) => c.completed_on)).size;
  const pct = Math.round(((morning + evening) / 14) * 100);
  return { pct, morning: { done: morning, of: 7 }, evening: { done: evening, of: 7 } };
}

/** Which routine the patient should be reminded about right now. */
export function nextRoutineReminder(now = new Date()) {
  const hour = now.getHours();
  return hour < 12
    ? { period: "morning" as const, title: "Time for your morning routine", when: "Today at 8:00 AM" }
    : { period: "evening" as const, title: "Time for your evening routine", when: "Today at 8:00 PM" };
}
