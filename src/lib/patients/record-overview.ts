/**
 * Pure shaping for the clinic patient record's Overview, Treatments and
 * From the patient tabs. No Supabase types: the production handlers, the demo
 * twins and the components all derive the same view models from plain rows,
 * and every rule here is unit-tested.
 */
import { clinicDayDiff, clinicDayKey } from "@/lib/clinic-time";
import { checkinNeedsAttention, severityLabel } from "@/lib/portal/shape";

/* ---------------------------------------------------------------- */
/* Ready to treat?                                                    */
/* ---------------------------------------------------------------- */

export type ReadinessTone = "alert" | "review" | "todo" | "done";
/** Where the row takes you: a record tab, the payment control, or the consent form sender. */
export type ReadinessLink = "portal" | "history" | "payment" | "consent" | null;

export type ReadinessItem = {
  kind: "checkin" | "history" | "payment" | "consent" | "checklist" | "photos";
  tone: ReadinessTone;
  title: string;
  detail: string;
  link: ReadinessLink;
  /** For checklist rows: the item they stand for. */
  checklistId?: string;
};

export type ReadinessVisit = {
  treatment: string;
  startsAt: string;
  consentState: "not_required" | "outstanding" | "signed";
  paymentStatus: string | null;
  price: number | null;
};

export type CheckinLike = {
  checkin_date: string;
  redness: number;
  sensitivity: number;
  dryness: number;
  note?: string | null;
  reviewed_at?: string | null;
};

export type HistoryVersionLike = {
  id: string;
  summary?: string | null;
  source?: string | null;
  reviewed_at?: string | null;
  created_at: string;
  data?: Record<string, unknown> | null;
};

export type StepChecklistLike = {
  id: string;
  label: string;
  done: boolean;
  byClinic: boolean;
  doneAt?: string | null;
  doneByKind?: "patient" | "clinic" | null;
};

const TONE_ORDER: Record<ReadinessTone, number> = { alert: 0, review: 1, todo: 2, done: 3 };

// Three-letter months by hand: newer ICU data spells en-GB September "Sept",
// and the record should read the same in every browser and in tests.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TIME = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });

function parseDate(iso: string) {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
}

/** "30 Sep". */
export function shortDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = parseDate(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Sun 4 Oct". */
export function shortDay(iso: string | null | undefined) {
  if (!iso) return "";
  const d = parseDate(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "4 Oct 2026". */
export function longDate(iso: string | null | undefined) {
  if (!iso) return "";
  const d = parseDate(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** { month: "OCT", day: "20" } for the Upcoming card's date block. */
export function dateBlock(iso: string) {
  const d = parseDate(iso);
  return { month: MONTHS[d.getMonth()]!.toUpperCase(), day: String(d.getDate()) };
}

export function clockTime(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : TIME.format(d);
}

export function money(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return Number.isInteger(n) ? `£${n}` : `£${n.toFixed(2)}`;
}

/** "today", "tomorrow", "in 3 days", "yesterday", "4 days ago", for a yyyy-mm-dd key. */
export function relativeDays(dateKey: string | null | undefined, now: Date) {
  if (!dateKey) return "";
  const days = clinicDayDiff(clinicDayKey(now), dateKey.slice(0, 10));
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/** The patient's pending medical change, in a few words: "Lidocaine allergy, Tretinoin". */
export function historyChangeSummary(version: HistoryVersionLike) {
  const data = (version.data ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  if (text(data["allergies"])) parts.push(`${firstClause(text(data["allergies"]))} allergy`);
  if (text(data["medications"])) parts.push(firstClause(text(data["medications"])));
  if (text(data["conditions"])) parts.push(firstClause(text(data["conditions"])));
  if (parts.length === 0 && version.summary) parts.push(version.summary);
  return parts.join(", ");
}

function firstClause(value: string) {
  return value
    .split(/[,;(·]/)[0]!
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join(" ");
}

/**
 * The hero card's checklist, most urgent first: unreviewed check-ins and
 * pending medical updates, the visit's money and consent, the step's patient
 * checklist, and whether before photos exist. `clear` counts the done rows.
 */
export function readinessItems(input: {
  visit: ReadinessVisit | null;
  checkins: CheckinLike[];
  history: HistoryVersionLike[];
  checklist: StepChecklistLike[];
  beforePhotos: { taken_at: string }[];
  now: Date;
}): { items: ReadinessItem[]; clear: number; total: number } {
  const items: ReadinessItem[] = [];

  const urgent = input.checkins.filter(isUrgentCheckin);
  if (urgent.length > 0) {
    const c = urgent[0]!;
    items.push({
      kind: "checkin",
      tone: "alert",
      title:
        urgent.length === 1
          ? "Recovery check-in flagged"
          : `${urgent.length} recovery check-ins flagged`,
      detail: `${worstReading(c)}, ${shortDate(c.checkin_date)} · portal`,
      link: "portal",
    });
  } else if (input.checkins.length > 0) {
    const latest = input.checkins[0]!;
    items.push({
      kind: "checkin",
      tone: "done",
      title: "Recovery check-ins clear",
      detail: `Last ${shortDate(latest.checkin_date)} · portal`,
      link: null,
    });
  }

  const pending = input.history.filter(isPendingHistory);
  if (pending.length > 0) {
    items.push({
      kind: "history",
      tone: "review",
      title: "Medical history changed",
      detail: `${historyChangeSummary(pending[0]!) || "Patient update"} · portal`,
      link: "history",
    });
  } else if (input.history.length > 0) {
    items.push({
      kind: "history",
      tone: "done",
      title: "Medical history reviewed",
      detail: "No updates waiting",
      link: null,
    });
  }

  if (input.visit) {
    const v = input.visit;
    const price = Number(v.price ?? 0);
    if (price > 0) {
      if (v.paymentStatus === "paid") {
        items.push({
          kind: "payment",
          tone: "done",
          title: `Paid ${money(price)}`,
          detail: "Paid in full",
          link: null,
        });
      } else if (v.paymentStatus === "deposit_paid") {
        const deposit = Math.round(price * 0.3 * 100) / 100;
        items.push({
          kind: "payment",
          tone: "todo",
          title: `Balance ${money(Math.round((price - deposit) * 100) / 100)}`,
          detail: "Deposit paid",
          link: "payment",
        });
      } else if (v.paymentStatus !== "refunded") {
        items.push({
          kind: "payment",
          tone: "todo",
          title: `Balance ${money(price)}`,
          detail: "Not paid",
          link: "payment",
        });
      }
    }
    if (v.consentState === "signed") {
      items.push({
        kind: "consent",
        tone: "done",
        title: "Consent signed",
        detail: `${v.treatment} · ${shortDate(v.startsAt)}`,
        link: null,
      });
    } else if (v.consentState === "outstanding") {
      items.push({
        kind: "consent",
        tone: "review",
        title: "Consent due",
        detail: `${v.treatment} · not signed`,
        link: "consent",
      });
    }
  }

  for (const item of input.checklist) {
    if (item.byClinic) continue;
    items.push({
      kind: "checklist",
      tone: item.done ? "done" : "todo",
      title: item.label,
      detail: item.done ? "Ticked by patient · portal" : "Not ticked yet · portal",
      link: null,
      checklistId: item.id,
    });
  }

  if (input.beforePhotos.length > 0) {
    const latest = [...input.beforePhotos].sort((a, b) => b.taken_at.localeCompare(a.taken_at))[0]!;
    items.push({
      kind: "photos",
      tone: "done",
      title: "Before photos on file",
      detail: `${input.beforePhotos.length} ${input.beforePhotos.length === 1 ? "photo" : "photos"} · ${shortDate(latest.taken_at)}`,
      link: null,
    });
  } else if (input.visit) {
    items.push({
      kind: "photos",
      tone: "todo",
      title: "No before photos",
      detail: "Take them before treating",
      link: null,
    });
  }

  items.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
  const clear = items.filter((i) => i.tone === "done").length;
  return { items, clear, total: items.length };
}

/** "Redness severe" — the reading that earned the flag. */
export function worstReading(c: { redness: number; sensitivity: number; dryness: number }) {
  const readings: [string, number][] = [
    ["Redness", c.redness],
    ["Sensitivity", c.sensitivity],
    ["Dryness", c.dryness],
  ];
  const [label, value] = readings.sort((a, b) => b[1] - a[1])[0]!;
  return `${label} ${severityLabel(value).toLowerCase()}`;
}

/* ---------------------------------------------------------------- */
/* Skin plan                                                          */
/* ---------------------------------------------------------------- */

export type RoadmapStepLike = {
  id: string;
  title: string;
  kind?: string | null;
  date?: string | null;
  status: string;
  bookedAt?: string | null;
  appointment?: { date: string; time: string; treatment: string } | null;
  completedAt?: string | null;
  checklist?: { id: string; label: string; done: boolean; byClinic: boolean }[];
};

export type RoadmapMonthLike = {
  n: number;
  month: string;
  title: string;
  steps: RoadmapStepLike[];
};

export type StepTone = "done" | "current" | "upcoming";

export function stepTone(status: string): StepTone {
  if (status === "done" || status === "skipped") return "done";
  if (status === "current") return "current";
  return "upcoming";
}

/** Per-month segments for the split progress bar, plus "Month 2 of 3". */
export function planMonths(roadmap: RoadmapMonthLike[]) {
  const months = roadmap.map((m) => ({
    n: m.n,
    title: m.title,
    steps: m.steps.map((s) => stepTone(s.status)),
  }));
  const currentIndex = months.findIndex((m) => m.steps.some((t) => t === "current"));
  const firstOpen = months.findIndex((m) => m.steps.some((t) => t !== "done"));
  const current =
    currentIndex >= 0 ? currentIndex + 1 : firstOpen >= 0 ? firstOpen + 1 : months.length;
  return { months, current, total: months.length };
}

/**
 * A session step with no diary slot is "Not booked"; that is a derived state,
 * not a milestone status, matching the patient's Timeline.
 */
export function stepChip(step: RoadmapStepLike): {
  label: string;
  tone: "done" | "current" | "upcoming" | "alert";
} {
  const tone = stepTone(step.status);
  if (tone === "done")
    return { label: step.status === "skipped" ? "Skipped" : "Completed", tone: "done" };
  if (tone === "current") return { label: "In progress", tone: "current" };
  return { label: "Upcoming", tone: "upcoming" };
}

export function stepNeedsBooking(step: RoadmapStepLike) {
  return (
    stepTone(step.status) !== "done" &&
    step.kind === "session" &&
    !step.bookedAt &&
    !step.appointment
  );
}

/** The step the plan is on, numbered across every month: "STEP 6 OF 8". */
export function upNextStep(roadmap: RoadmapMonthLike[]) {
  const all = roadmap.flatMap((m) => m.steps);
  const index = (() => {
    const current = all.findIndex((s) => s.status === "current");
    if (current >= 0) return current;
    return all.findIndex((s) => stepTone(s.status) !== "done");
  })();
  if (index < 0) return null;
  const step = all[index]!;
  const checklist = step.checklist ?? [];
  return {
    id: step.id,
    index: index + 1,
    total: all.length,
    title: step.title,
    dueDate: step.date ?? null,
    booked: Boolean(step.bookedAt || step.appointment),
    bookedAt: step.bookedAt ?? null,
    needsBooking: stepNeedsBooking(step),
    checklistDone: checklist.filter((c) => c.done).length,
    checklistTotal: checklist.length,
  };
}

/** Appointments a plan step points at; anything else booked is "Not on skin plan". */
export function onPlanAppointmentIds(milestones: { appointment_id?: string | null }[]) {
  return new Set(milestones.map((m) => m.appointment_id).filter((id): id is string => Boolean(id)));
}

/* ---------------------------------------------------------------- */
/* Recovery check-ins                                                 */
/* ---------------------------------------------------------------- */

export function isUrgentCheckin(c: CheckinLike) {
  return checkinNeedsAttention(c) && !c.reviewed_at;
}

export function isPendingHistory(v: HistoryVersionLike) {
  return v.source === "patient" && !v.reviewed_at;
}

/** The portal's wording as a tone key for bars and chips. */
export function severityTone(value: number): "severe" | "moderate" | "mild" {
  const label = severityLabel(value);
  return label === "Severe" ? "severe" : label === "Moderate" ? "moderate" : "mild";
}

export type CheckinStatus = "open" | "reviewed" | "none";

export function checkinStatus(c: CheckinLike): CheckinStatus {
  if (!checkinNeedsAttention(c)) return "none";
  return c.reviewed_at ? "reviewed" : "open";
}

export const CHECKIN_STATUS_LABEL: Record<CheckinStatus, string> = {
  open: "Open",
  reviewed: "Reviewed",
  none: "No flag",
};

/** "day 4 after Microneedling with PRP": the latest treatment on or before the check-in. */
export function dayAfterTreatment(
  checkinDate: string,
  treatments: { name: string; performed_at: string }[],
) {
  const key = checkinDate.slice(0, 10);
  const before = treatments
    .filter((t) => t.performed_at.slice(0, 10) <= key)
    .sort((a, b) => b.performed_at.localeCompare(a.performed_at));
  const t = before[0];
  if (!t) return null;
  const days = clinicDayDiff(t.performed_at.slice(0, 10), key);
  return { days, treatment: t.name, label: `day ${days} after ${t.name}` };
}

/* ---------------------------------------------------------------- */
/* Treatment history                                                  */
/* ---------------------------------------------------------------- */

export type HistoryTreatmentLike = {
  id: string;
  name: string;
  product?: string | null;
  dose?: string | null;
  area?: string | null;
  notes?: string | null;
  price?: number | null;
  performed_at: string;
  next_due_at?: string | null;
  consent_document_id?: string | null;
  hasRecord?: boolean;
};

export type DocumentLike = {
  id: string;
  treatment_id?: string | null;
  kind: string;
  status: string;
  sent_at?: string | null;
};

export type PhotoLike = { treatment_id?: string | null; taken_at: string };

export type FormChip = { label: string; tone: "done" | "sky" | "alert" };

const NEEDS_DEPTH = /microneedl|dermapen|skinpen/i;
const HAS_DEPTH = /\d(?:\.\d+)?\s?mm/i;

/** Which forms a treatment has attached, and what the record is missing. */
export function treatmentFormChips(
  t: HistoryTreatmentLike,
  documents: DocumentLike[],
  photos: PhotoLike[],
): FormChip[] {
  const chips: FormChip[] = [];
  const linked = documents.filter((d) => d.treatment_id === t.id || d.id === t.consent_document_id);
  if (t.hasRecord) chips.push({ label: "✓ Treatment record", tone: "done" });
  if (linked.some((d) => d.kind === "consent" && d.status === "signed"))
    chips.push({ label: "✓ Consent", tone: "done" });
  if (linked.some((d) => d.kind === "aftercare" && (d.sent_at || d.status !== "draft")))
    chips.push({ label: "✓ Aftercare sent", tone: "done" });
  const photoCount = photos.filter(
    (p) => p.treatment_id === t.id || sameDay(p.taken_at, t.performed_at),
  ).length;
  if (photoCount > 0)
    chips.push({ label: `${photoCount} ${photoCount === 1 ? "photo" : "photos"}`, tone: "sky" });
  if (NEEDS_DEPTH.test(t.name) && !HAS_DEPTH.test(t.dose ?? ""))
    chips.push({ label: "Depth not recorded", tone: "alert" });
  return chips;
}

function sameDay(a: string, b: string) {
  return a.slice(0, 10) === b.slice(0, 10);
}

/** "Full face · Autologous PRP · 1.5mm depth · £295 · recall 25/12/2026". */
export function treatmentDetailLine(t: HistoryTreatmentLike) {
  const depth =
    t.dose && HAS_DEPTH.test(t.dose)
      ? `${t.dose.match(HAS_DEPTH)![0].replace(/\s/g, "")} depth`
      : t.dose;
  return [
    t.area,
    t.product,
    depth,
    t.price ? money(Number(t.price)) : null,
    t.next_due_at
      ? `recall ${new Date(`${t.next_due_at.slice(0, 10)}T12:00:00`).toLocaleDateString("en-GB")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export type HistoryFilter = "all" | "prp" | "missing";

export function historyFilter<T extends HistoryTreatmentLike>(
  rows: T[],
  filter: HistoryFilter,
  chipsFor: (t: T) => FormChip[],
): T[] {
  if (filter === "prp") return rows.filter((t) => /prp/i.test(`${t.name} ${t.product ?? ""}`));
  if (filter === "missing")
    return rows.filter((t) => {
      const chips = chipsFor(t);
      return chips.some((c) => c.tone === "alert") || !chips.some((c) => c.label === "✓ Consent");
    });
  return rows;
}

/* ---------------------------------------------------------------- */
/* Tab badges                                                         */
/* ---------------------------------------------------------------- */

/** Numbers only; the tab hides a badge at 0. */
export function recordTabBadges(input: {
  bookingChase: unknown[];
  checkins: CheckinLike[];
  history: HistoryVersionLike[];
}) {
  return {
    treatments: input.bookingChase.length,
    portal: input.checkins.filter(isUrgentCheckin).length,
    history: input.history.filter(isPendingHistory).length,
  };
}

/* ---------------------------------------------------------------- */
/* Upcoming                                                           */
/* ---------------------------------------------------------------- */

export type UpcomingLike = {
  id: string;
  startsAt: string;
  paymentStatus: string | null;
  consentSigned: boolean;
};

export function upcomingIssueChips(a: UpcomingLike): { label: string; tone: "alert" | "review" }[] {
  const chips: { label: string; tone: "alert" | "review" }[] = [];
  if (a.paymentStatus === "unpaid") chips.push({ label: "Deposit unpaid", tone: "alert" });
  if (a.paymentStatus === "deposit_paid") chips.push({ label: "Balance due", tone: "alert" });
  if (!a.consentSigned) chips.push({ label: "Consent due", tone: "review" });
  return chips;
}

/** "2 booked · 1 on plan". */
export function upcomingMeta(upcoming: UpcomingLike[], onPlan: Set<string>) {
  const on = upcoming.filter((a) => onPlan.has(a.id)).length;
  return `${upcoming.length} booked · ${on} on plan`;
}
