/** Retention maths. Server-only: never import from a component. */

import { deriveRetentionInsights } from "./retention-insights.server";
import {
  DEFAULT_PERIOD,
  SECOND_VISIT_HORIZON_DAYS,
  buildVisits,
  composition,
  dueState,
  firstToSecond,
  isOnList,
  lineMoney,
  londonMidnight,
  londonParts,
  nextDueFor,
  resolvePeriod,
  rollingRetention,
  rollingRetentionDays,
  upcomingBookingSet,
  type DueState,
} from "./metrics";

export type RetentionPatient = {
  id: string;
  title: string | null;
  first_name: string;
  last_name: string;
  status: string;
  email: string | null;
  phone: string | null;
  created_at: string;
  deleted_at?: string | null;
};

export type RetentionTreatment = {
  id?: string;
  appointment_id?: string | null;
  patient_id: string;
  practitioner_id: string | null;
  name: string;
  price: number | null;
  performed_at: string;
  next_due_at: string | null;
};

export type RetentionAppointment = {
  id: string;
  payment_status?: string | null;
  patient_id: string;
  practitioner_id: string | null;
  starts_at: string;
  status: string;
};

/**
 * The chase bands, from the shared due-state definitions: overdue (next due
 * date passed), due soon (within 30 days), lapsing (no due date, 90–180 days
 * since last visit), lost (no due date, over 180 days). Booked patients are
 * never at risk.
 */
export type RiskLevel = "overdue" | "due_soon" | "lapsing" | "lost";

const RISK_OF: Partial<Record<DueState, RiskLevel>> = {
  overdue: "overdue",
  due_soon: "due_soon",
  lapsing: "lapsing",
  lost: "lost",
};

export type AtRiskRow = {
  patientId: string;
  name: string;
  risk: RiskLevel;
  lastTreatment: string | null;
  lastVisit: string | null;
  daysSince: number | null;
  nextDue: string | null;
  practitioner: string | null;
  practitionerId: string | null;
  visits: number;
  contactedAt: string | null;
  lifetimeValue: number;
  email: string | null;
  phone: string | null;
};

export type MonthPoint = { key: string; label: string; rate: number; active: number; returning: number };

export type CohortRow = {
  key: string;
  label: string;
  patients: number;
  second: number;
  third: number;
  secondRate: number;
  thirdRate: number;
  /** The cohort is younger than the 180-day horizon: its rate is "so far", not final. */
  tooEarly: boolean;
};

export type TreatmentRetentionRow = {
  name: string;
  patients: number;
  repeatPatients: number;
  repeatRate: number;
  averageGapDays: number | null;
};

export type PractitionerRetentionRow = TreatmentRetentionRow;

export type RetentionWindow = { from: number; to: number; key: "day" | "week" | "month" | "year" };

const DAY = 86400000;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(d: Date) {
  const p = londonParts(d.getTime());
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

function monthLabel(d: Date) {
  const p = londonParts(d.getTime());
  return `${MONTHS[p.month - 1]} ${String(p.year).slice(-2)}`;
}

/** The last instant of the London month `i` months after the one holding `ms`. */
function monthEndMs(ms: number, i = 0) {
  const p = londonParts(ms);
  return londonMidnight(p.year, p.month + i + 1, 1) - 1;
}

function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0;
}

function weekKey(d: Date) {
  const p = londonParts(d.getTime());
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function weekLabel(d: Date) {
  const p = londonParts(d.getTime());
  return `${p.day} ${MONTHS[p.month - 1]}`;
}

/** One row per visit (metrics/visits), shaped like a treatment so the report reads visits throughout. */
type VisitRow = RetentionTreatment & { names: string[] };

function groupRetention(
  groups: Map<string, Map<string, string[]>>,
  labelFor: (key: string) => string,
): TreatmentRetentionRow[] {
  return [...groups.entries()]
    .map(([key, perPatient]) => {
      const all = [...perPatient.values()];
      const repeats = all.filter((d) => d.length > 1);
      const localGaps: number[] = [];
      for (const dates of repeats) {
        for (let i = 1; i < dates.length; i++) {
          localGaps.push((new Date(dates[i]!).getTime() - new Date(dates[i - 1]!).getTime()) / DAY);
        }
      }
      return {
        name: labelFor(key),
        patients: all.length,
        repeatPatients: repeats.length,
        repeatRate: pct(repeats.length, all.length),
        averageGapDays: localGaps.length
          ? Math.round(localGaps.reduce((a, b) => a + b, 0) / localGaps.length)
          : null,
      };
    })
    .sort((a, b) => b.patients - a.patients);
}

export function buildRetention(input: {
  patients: RetentionPatient[];
  treatments: RetentionTreatment[];
  appointments: RetentionAppointment[];
  outreach: { patient_id: string; created_at: string }[];
  practitionerNames: Map<string, string>;
  /** When set, only this practitioner's patients are considered. */
  practitionerId?: string | null;
  now?: number;
  /**
   * Reporting window from the page's period picker. The headline, trend,
   * cohorts and breakdowns are read "as of" the window's end and cover the
   * patients seen inside it; the at-risk list is an action list and always
   * reflects today. Defaults to the page's default (the last 12 calendar months).
   */
  window?: RetentionWindow | undefined;
}) {
  const realNow = input.now ?? Date.now();
  const fallback = resolvePeriod(DEFAULT_PERIOD, realNow);
  const win: RetentionWindow = input.window ?? { from: fallback.fromMs, to: fallback.toMs, key: "year" };
  // Nothing is known about the future, so a window that runs past today is
  // read as of today.
  const now = Math.min(win.to, realNow);
  const deleted = new Set(input.patients.filter((p) => !isOnList(p)).map((p) => p.id));
  const apptById = new Map(input.appointments.map((a) => [a.id, a]));
  // Visits, not treatment rows: one per attended appointment (metrics/visits).
  let treatments: VisitRow[] = buildVisits({
    treatments: input.treatments,
    appointments: input.appointments,
    nowMs: realNow,
    excluded: deleted,
  }).map((v) => ({
    patient_id: v.patient_id,
    practitioner_id: v.practitioner_id ?? v.treatments[0]?.practitioner_id ?? null,
    name: v.treatments[0]?.name ?? "Visit",
    names: [...new Set(v.treatments.map((t) => t.name))],
    price:
      v.treatments.reduce(
        (sum, t) => sum + lineMoney(t, t.appointment_id ? (apptById.get(t.appointment_id) as never) : undefined, { depositPercent: 30 }).earned,
        0,
      ) / 100,
    performed_at: v.performed_at,
    next_due_at: v.next_due_at,
  }));

  if (input.practitionerId) {
    const mine = new Set(
      input.treatments.filter((t) => t.practitioner_id === input.practitionerId).map((t) => t.patient_id),
    );
    treatments = treatments.filter((t) => mine.has(t.patient_id));
  }

  const patientIds = new Set(treatments.map((t) => t.patient_id));
  const patients = input.practitionerId
    ? input.patients.filter((p) => patientIds.has(p.id))
    : input.patients.filter(isOnList);

  const byPatient = new Map<string, VisitRow[]>();
  for (const t of treatments) {
    const list = byPatient.get(t.patient_id) ?? [];
    list.push(t);
    byPatient.set(t.patient_id, list);
  }

  const lifetimeValueByPatient = new Map<string, number>();
  for (const t of treatments) {
    lifetimeValueByPatient.set(
      t.patient_id,
      Math.round(((lifetimeValueByPatient.get(t.patient_id) ?? 0) + Number(t.price ?? 0)) * 100) / 100,
    );
  }

  // ---- headline: rolling 12-month rate at the end of the window, and how
  // far it moved since the start of the window.
  const current = rollingRetention(byPatient, now);
  const previous = rollingRetention(byPatient, win.from);

  // Patients seen inside the window, with their visit history up to its end.
  const seenInWindow = new Set<string>();
  for (const t of treatments) {
    const ms = new Date(t.performed_at).getTime();
    if (ms >= win.from && ms <= now) seenInWindow.add(t.patient_id);
  }
  const windowHistory = new Map<string, VisitRow[]>();
  for (const [id, list] of byPatient) {
    if (!seenInWindow.has(id)) continue;
    windowHistory.set(id, list.filter((t) => new Date(t.performed_at).getTime() <= now));
  }

  // One visit only / repeat: the shared composition (exactly one visit, any
  // treatment) over the patients seen in the window, up to its end.
  const mix = composition(seenInWindow, byPatient, now);
  const everSeen = mix.total;
  const repeat = mix.twoPlus;
  const oneVisit = mix.once;
  const visitCounts = [...windowHistory.values()].map((l) => l.length);
  const avgVisits = everSeen ? Math.round((visitCounts.reduce((a, b) => a + b, 0) / everSeen) * 10) / 10 : 0;
  // First-to-second on the shared 180-day horizon, for the headline and Insights alike.
  const secondVisit = firstToSecond(byPatient, { fromMs: win.from, toMs: now }, realNow);

  const gaps: number[] = [];
  for (const list of windowHistory.values()) {
    for (let i = 1; i < list.length; i++) {
      gaps.push(
        (new Date(list[i]!.performed_at).getTime() - new Date(list[i - 1]!.performed_at).getTime()) / DAY,
      );
    }
  }
  const avgGap = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;

  // ---- monthly trend (last 60 months) + weekly (last 5 weeks, 30-day window)
  const monthly: MonthPoint[] = [];
  for (let i = 59; i >= 0; i--) {
    const end = new Date(monthEndMs(now, -i));
    const r = rollingRetention(byPatient, Math.min(end.getTime(), now));
    monthly.push({ key: monthKey(end), label: monthLabel(end), ...r });
  }

  const weekly: MonthPoint[] = [];
  for (let i = 4; i >= 0; i--) {
    const end = new Date(now - i * 7 * DAY);
    const r = rollingRetentionDays(byPatient, Math.min(end.getTime(), now), 30);
    weekly.push({ key: weekKey(end), label: weekLabel(end), ...r });
  }

  // ---- trend for the selected window. A year reads month by month; anything
  // shorter reads week by week on a 30-day return window, back to the start of
  // the period (and never fewer than five points, so there is a line to read).
  const trend: MonthPoint[] = [];
  if (win.key === "year") {
    const start = londonParts(win.from);
    for (let i = 0; londonMidnight(start.year, start.month + i, 1) <= now; i++) {
      const end = new Date(monthEndMs(win.from, i));
      const r = rollingRetention(byPatient, Math.min(end.getTime(), now));
      trend.push({ key: monthKey(end), label: monthLabel(end), ...r });
    }
  } else {
    const points = Math.max(5, Math.ceil((now - win.from) / (7 * DAY)) + 1);
    for (let i = points - 1; i >= 0; i--) {
      const end = new Date(now - i * 7 * DAY);
      const r = rollingRetentionDays(byPatient, end.getTime(), 30);
      trend.push({ key: weekKey(end), label: weekLabel(end), ...r });
    }
  }

  // ---- at risk: who needs chasing today, regardless of the period shown.
  // Booked patients are never at risk; the bands come from the shared dueState.
  const upcoming = upcomingBookingSet(
    input.practitionerId
      ? input.appointments.filter((a) => a.practitioner_id === input.practitionerId)
      : input.appointments,
    realNow,
  );

  const contacted = new Map<string, string>();
  for (const o of input.outreach) {
    const existing = contacted.get(o.patient_id);
    if (!existing || new Date(o.created_at) > new Date(existing)) contacted.set(o.patient_id, o.created_at);
  }

  const atRisk: AtRiskRow[] = [];
  for (const p of patients) {
    const list = byPatient.get(p.id) ?? [];
    const last = list[list.length - 1];
    if (!last) continue;
    const state = dueState({
      patient: { id: p.id, status: p.status },
      visits: list,
      hasUpcoming: upcoming.has(p.id),
      nowMs: realNow,
    });
    const risk = RISK_OF[state];
    if (!risk) continue;

    const lastMs = new Date(last.performed_at).getTime();
    const daysSince = Math.floor((realNow - lastMs) / DAY);
    const nextDue = nextDueFor(list)?.next_due_at ?? null;

    atRisk.push({
      patientId: p.id,
      name: `${p.title ? `${p.title} ` : ""}${p.first_name} ${p.last_name}`.trim(),
      risk,
      lastTreatment: last.name,
      lastVisit: last.performed_at,
      daysSince,
      nextDue,
      practitioner: last.practitioner_id ? (input.practitionerNames.get(last.practitioner_id) ?? null) : null,
      practitionerId: last.practitioner_id ?? null,
      visits: list.length,
      contactedAt: contacted.get(p.id) ?? null,
      lifetimeValue: lifetimeValueByPatient.get(p.id) ?? 0,
      email: p.email ?? null,
      phone: p.phone ?? null,
    });
  }

  // Revenue at risk from the patients who lapsed in this period: at-risk rows
  // whose last visit falls inside the window.
  const revenueAtRisk = atRisk
    .filter((r) => {
      const ms = r.lastVisit ? new Date(r.lastVisit).getTime() : null;
      return ms !== null && ms >= win.from && ms <= win.to;
    })
    .reduce((sum, r) => sum + r.lifetimeValue, 0);

  const order: Record<RiskLevel, number> = { overdue: 0, due_soon: 1, lapsing: 2, lost: 3 };
  atRisk.sort((a, b) => order[a.risk] - order[b.risk] || (b.daysSince ?? 0) - (a.daysSince ?? 0));

  const counts = {
    overdue: atRisk.filter((r) => r.risk === "overdue").length,
    dueSoon: atRisk.filter((r) => r.risk === "due_soon").length,
    lapsing: atRisk.filter((r) => r.risk === "lapsing").length,
    lost: atRisk.filter((r) => r.risk === "lost").length,
  };

  // ---- cohorts by first visit month, for patients whose first visit fell in
  // the window (a year gives up to 12 cohorts; a month gives one).
  // A second visit counts when it falls within the shared 180-day horizon of
  // the first; a cohort younger than that horizon is "too early" to judge.
  const horizonMs = SECOND_VISIT_HORIZON_DAYS * DAY;
  const cohortMap = new Map<
    string,
    { label: string; total: number; second: number; third: number; monthEnd: number }
  >();
  for (const list of windowHistory.values()) {
    const first = list[0]!;
    const d = new Date(first.performed_at);
    if (d.getTime() < win.from) continue;
    const key = monthKey(d);
    const row = cohortMap.get(key) ?? {
      label: monthLabel(d),
      total: 0,
      second: 0,
      third: 0,
      monthEnd: monthEndMs(d.getTime()),
    };
    const firstMs = d.getTime();
    row.total += 1;
    const second = list[1];
    if (second && new Date(second.performed_at).getTime() - firstMs <= horizonMs) row.second += 1;
    if (list.length > 2) row.third += 1;
    cohortMap.set(key, row);
  }
  const cohorts: CohortRow[] = [...cohortMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([key, r]) => ({
      key,
      label: r.label,
      patients: r.total,
      second: r.second,
      third: r.third,
      secondRate: pct(r.second, r.total),
      thirdRate: pct(r.third, r.total),
      tooEarly: realNow - r.monthEnd < horizonMs,
    }));

  // ---- per treatment / per practitioner repeat rate, for patients seen in
  // the window, over their history up to its end.
  const treatMap = new Map<string, Map<string, string[]>>();
  const pracMap = new Map<string, Map<string, string[]>>();
  for (const t of [...windowHistory.values()].flat()) {
    for (const name of t.names) {
      const perName = treatMap.get(name) ?? new Map<string, string[]>();
      const dates = perName.get(t.patient_id) ?? [];
      dates.push(t.performed_at);
      perName.set(t.patient_id, dates);
      treatMap.set(name, perName);
    }

    const pracKey = t.practitioner_id ?? "unassigned";
    const perPrac = pracMap.get(pracKey) ?? new Map<string, string[]>();
    const pracDates = perPrac.get(t.patient_id) ?? [];
    pracDates.push(t.performed_at);
    perPrac.set(t.patient_id, pracDates);
    pracMap.set(pracKey, perPrac);
  }
  const byTreatment = groupRetention(treatMap, (name) => name);
  const byPractitioner = groupRetention(pracMap, (id) =>
    id === "unassigned" ? "Unassigned" : (input.practitionerNames.get(id) ?? "Unassigned"),
  );

  // ---- suggested actions: delegated to the insights engine so a smarter
  // (API/model-driven) recommender can slot in without touching this report.
  // Last 12 months only — "dipped this month" compares the current month to the last.
  const suggestions = deriveRetentionInsights({
    counts,
    monthly: monthly.slice(-12),
    cohorts,
    firstToSecondRate: secondVisit.rate,
  });

  return {
    summary: {
      rate: current.rate,
      previousRate: previous.rate,
      change: current.rate - previous.rate,
      activeInWindow: current.active,
      returningInWindow: current.returning,
      repeatPatients: repeat,
      oneVisitPatients: oneVisit,
      averageVisits: avgVisits,
      averageGapDays: avgGap,
      /** Shared first-to-second: cohort, returned, rate (null when empty), pending ("too early"). */
      firstToSecond: secondVisit,
      counts,
      /** At-risk total: everyone to chase. */
      atRiskCount: atRisk.length,
      revenueAtRisk,
    },
    monthly,
    weekly,
    trend,
    atRisk,
    cohorts,
    byTreatment,
    byPractitioner,
    suggestions,
  };
}

/** Compact retention state for a single patient, used on the patient record header. */
export function patientRetention(
  treatments: { performed_at: string; next_due_at: string | null }[],
  hasFutureAppointment: boolean,
  now = Date.now(),
) {
  if (!treatments.length) return { visits: 0, daysSince: null, risk: null as RiskLevel | null };
  const sorted = [...treatments].sort(
    (a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime(),
  );
  const last = sorted[sorted.length - 1]!;
  const daysSince = Math.floor((now - new Date(last.performed_at).getTime()) / DAY);
  const state = dueState({
    patient: { id: "self", status: "active" },
    visits: sorted.map((t) => ({
      patient_id: "self",
      performed_at: t.performed_at,
      next_due_at: t.next_due_at,
    })),
    hasUpcoming: hasFutureAppointment,
    nowMs: now,
  });
  return { visits: sorted.length, daysSince, risk: RISK_OF[state] ?? null };
}
