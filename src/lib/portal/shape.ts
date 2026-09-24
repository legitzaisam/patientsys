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
  kind?: string | null;
  due_date?: string | null;
  appointment_id?: string | null;
  completed_at?: string | null;
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

export type StepAppointment = { id: string; starts_at: string; treatment_name: string; consentSigned: boolean | null };
export type StepTreatment = { name: string; performed_at: string; notes?: string | null };
export type StepPhoto = { id: string; kind: string; taken_at: string; url: string | null; caption?: string | null };

/** Everything the timeline's step card can show beyond the milestone row itself. */
export type StepExtras = {
  /** When the step was finished (the linked appointment's date, else the completion stamp). */
  completedAt: string | null;
  /** For steps still to come: the diary slot they are booked into, if any. */
  bookedAt: string | null;
  appointment: { date: string; time: string; treatment: string } | null;
  consentSigned: boolean | null;
  consultationDone: boolean;
  photos: StepPhoto[];
  visitNote: string | null;
};

const DAY_MS = 86_400_000;

/**
 * What the record already holds for each step: the appointment it was booked
 * into, whether consent was signed for it, whether a consultation came before
 * it, the photos taken at and after it, and the treatment note. Pure — the
 * callers fetch rows (prod through RLS, demo from fixtures) and pass them in.
 */
export function stepExtrasFor(input: {
  milestones: MilestoneLike[];
  appointments: StepAppointment[];
  treatments: StepTreatment[];
  photos: StepPhoto[];
}): Record<string, StepExtras> {
  const ordered = sortMilestones(input.milestones);
  const apptById = new Map(input.appointments.map((a) => [a.id, a]));
  const out: Record<string, StepExtras> = {};
  ordered.forEach((m, i) => {
    const appt = m.appointment_id ? (apptById.get(m.appointment_id) ?? null) : null;
    const done = DONE_STATUSES.has(m.status);
    const anchor = appt?.starts_at ?? (done ? (m.completed_at ?? null) : null);
    const anchorMs = anchor ? new Date(anchor).getTime() : null;
    const near = (iso: string, before: number, after: number) => {
      if (anchorMs === null) return false;
      const ms = new Date(iso).getTime();
      return ms >= anchorMs - before * DAY_MS && ms <= anchorMs + after * DAY_MS;
    };
    const treatment = anchorMs === null ? null : (input.treatments.find((t) => near(t.performed_at, 1, 1)) ?? null);
    const photos =
      anchorMs === null
        ? []
        : [
            ...input.photos.filter((p) => p.kind === "before" && near(p.taken_at, 2, 1)).slice(0, 1),
            ...input.photos.filter((p) => p.kind === "after" && near(p.taken_at, 0, 45)).slice(-1),
          ];
    const starts = appt ? new Date(appt.starts_at) : null;
    out[m.id] = {
      completedAt: done ? anchor : null,
      bookedAt: !done && appt ? appt.starts_at : null,
      appointment:
        appt && starts
          ? {
              date: starts.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
              time: starts.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
              treatment: appt.treatment_name,
            }
          : null,
      consentSigned: appt ? appt.consentSigned : null,
      consultationDone: ordered.slice(0, i).some((prev) => DONE_STATUSES.has(prev.status) && /consult/i.test(prev.title)),
      photos,
      visitNote: treatment?.notes?.trim() || null,
    };
  });
  return out;
}

/** Group milestones into the portal's month sections, checklists attached. */
export function roadmapFor(
  milestones: MilestoneLike[],
  checklist: ChecklistLike[],
  extras: Record<string, StepExtras> = {},
) {
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
      kind: m.kind ?? "task",
      date: m.due_date ?? null,
      status: m.status,
      statusLabel: statusLabel(m.status),
      icon: m.icon ?? "cal",
      detail: m.detail ?? "",
      guidance: m.guidance ?? "",
      checklist: (byMilestone.get(m.id) ?? [])
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((c) => ({ id: c.id, label: c.label, done: c.done, byClinic: c.clinic_owned })),
      ...(extras[m.id] ?? {}),
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

/**
 * What the dashboard journey card says about one plan: steps done of total
 * and the step that is up next (and whether it is late). The plan's kind
 * (treatment course, review track, re-engagement track) is a column on the
 * plan itself and travels alongside.
 */
export function journeyPlanSummary(
  milestones: { status: string; title?: string | null; due_date?: string | null }[],
  todayKey: string,
) {
  const done = milestones.filter((m) => m.status === "done" || m.status === "skipped").length;
  const next = milestones.find((m) => m.status === "current") ?? milestones.find((m) => m.status === "upcoming") ?? null;
  return {
    done,
    total: milestones.length,
    nextStep: next?.title ?? null,
    nextDue: next?.due_date ?? null,
    overdue: !!next?.due_date && next.due_date < todayKey,
  };
}
