/** Retention maths. Server-only: never import from a component. */

export type RetentionPatient = {
  id: string;
  title: string | null;
  first_name: string;
  last_name: string;
  status: string;
  email: string | null;
  phone: string | null;
  created_at: string;
};

export type RetentionTreatment = {
  patient_id: string;
  practitioner_id: string | null;
  name: string;
  price: number | null;
  performed_at: string;
  next_due_at: string | null;
};

export type RetentionAppointment = {
  patient_id: string;
  practitioner_id: string | null;
  starts_at: string;
  status: string;
};

export type RiskLevel = "overdue" | "lapsing" | "lost";

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
};

export type TreatmentRetentionRow = {
  name: string;
  patients: number;
  repeatPatients: number;
  repeatRate: number;
  averageGapDays: number | null;
};

const DAY = 86400000;

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(d: Date) {
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

function pct(n: number, d: number) {
  return d ? Math.round((n / d) * 100) : 0;
}

/** Rolling 12-month retention rate: of patients seen in the window, how many came more than once. */
function rollingRate(treatments: RetentionTreatment[], endMs: number) {
  const startMs = endMs - 365 * DAY;
  const seen = new Map<string, number>();
  for (const t of treatments) {
    const ms = new Date(t.performed_at).getTime();
    if (ms > startMs && ms <= endMs) seen.set(t.patient_id, (seen.get(t.patient_id) ?? 0) + 1);
  }
  const returning = [...seen.values()].filter((n) => n > 1).length;
  return { rate: pct(returning, seen.size), active: seen.size, returning };
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
}) {
  const now = input.now ?? Date.now();
  let treatments = [...input.treatments].sort(
    (a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime(),
  );

  if (input.practitionerId) {
    const mine = new Set(
      treatments.filter((t) => t.practitioner_id === input.practitionerId).map((t) => t.patient_id),
    );
    treatments = treatments.filter((t) => mine.has(t.patient_id));
  }

  const patientIds = new Set(treatments.map((t) => t.patient_id));
  const patients = input.practitionerId
    ? input.patients.filter((p) => patientIds.has(p.id))
    : input.patients;

  const byPatient = new Map<string, RetentionTreatment[]>();
  for (const t of treatments) {
    const list = byPatient.get(t.patient_id) ?? [];
    list.push(t);
    byPatient.set(t.patient_id, list);
  }

  const lifetimeValueByPatient = new Map<string, number>();
  for (const t of treatments) {
    lifetimeValueByPatient.set(
      t.patient_id,
      (lifetimeValueByPatient.get(t.patient_id) ?? 0) + Number(t.price ?? 0),
    );
  }

  // ---- headline
  const current = rollingRate(treatments, now);
  const previous = rollingRate(treatments, now - 365 * DAY);

  const visitCounts = [...byPatient.values()].map((l) => l.length);
  const everSeen = visitCounts.length;
  const repeat = visitCounts.filter((n) => n > 1).length;
  const oneVisit = everSeen - repeat;
  const avgVisits = everSeen ? Math.round((visitCounts.reduce((a, b) => a + b, 0) / everSeen) * 10) / 10 : 0;

  const gaps: number[] = [];
  for (const list of byPatient.values()) {
    for (let i = 1; i < list.length; i++) {
      gaps.push(
        (new Date(list[i]!.performed_at).getTime() - new Date(list[i - 1]!.performed_at).getTime()) / DAY,
      );
    }
  }
  const avgGap = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;

  // ---- monthly trend (last 12 months)
  const monthly: MonthPoint[] = [];
  const anchor = new Date(now);
  for (let i = 11; i >= 0; i--) {
    const end = new Date(anchor.getFullYear(), anchor.getMonth() - i + 1, 0, 23, 59, 59);
    const r = rollingRate(treatments, Math.min(end.getTime(), now));
    monthly.push({ key: monthKey(end), label: monthLabel(end), ...r });
  }

  // ---- at risk
  const futureByPatient = new Map<string, string>();
  for (const a of input.appointments) {
    if (a.status === "cancelled" || a.status === "no_show") continue;
    if (new Date(a.starts_at).getTime() < now) continue;
    if (input.practitionerId && a.practitioner_id !== input.practitionerId) continue;
    const existing = futureByPatient.get(a.patient_id);
    if (!existing || new Date(a.starts_at) < new Date(existing)) futureByPatient.set(a.patient_id, a.starts_at);
  }

  const contacted = new Map<string, string>();
  for (const o of input.outreach) {
    const existing = contacted.get(o.patient_id);
    if (!existing || new Date(o.created_at) > new Date(existing)) contacted.set(o.patient_id, o.created_at);
  }

  const atRisk: AtRiskRow[] = [];
  for (const p of patients) {
    if (p.status === "archived") continue;
    const list = byPatient.get(p.id) ?? [];
    const last = list[list.length - 1];
    if (!last) continue;
    if (futureByPatient.has(p.id)) continue;

    const lastMs = new Date(last.performed_at).getTime();
    const daysSince = Math.floor((now - lastMs) / DAY);
    const dueRow = [...list].reverse().find((t) => t.next_due_at);
    const nextDue = dueRow?.next_due_at ?? null;
    const overdue = !!nextDue && new Date(nextDue).getTime() < now;

    let risk: RiskLevel | null = null;
    if (daysSince > 180) risk = "lost";
    else if (overdue) risk = "overdue";
    else if (daysSince >= 90) risk = "lapsing";
    if (!risk) continue;

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

  const revenueAtRisk = atRisk.reduce((sum, r) => sum + r.lifetimeValue, 0);

  const order: Record<RiskLevel, number> = { overdue: 0, lapsing: 1, lost: 2 };
  atRisk.sort((a, b) => order[a.risk] - order[b.risk] || (b.daysSince ?? 0) - (a.daysSince ?? 0));

  const counts = {
    overdue: atRisk.filter((r) => r.risk === "overdue").length,
    lapsing: atRisk.filter((r) => r.risk === "lapsing").length,
    lost: atRisk.filter((r) => r.risk === "lost").length,
  };

  // ---- cohorts by first visit month (last 12 cohorts)
  const cohortMap = new Map<string, { label: string; total: number; second: number; third: number }>();
  const cutoff = new Date(anchor.getFullYear(), anchor.getMonth() - 11, 1).getTime();
  for (const list of byPatient.values()) {
    const first = list[0]!;
    const d = new Date(first.performed_at);
    if (d.getTime() < cutoff) continue;
    const key = monthKey(d);
    const row = cohortMap.get(key) ?? { label: monthLabel(d), total: 0, second: 0, third: 0 };
    row.total += 1;
    if (list.length > 1) row.second += 1;
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
    }));

  // ---- per treatment repeat rate
  const treatMap = new Map<string, Map<string, string[]>>();
  for (const t of treatments) {
    const perName = treatMap.get(t.name) ?? new Map<string, string[]>();
    const dates = perName.get(t.patient_id) ?? [];
    dates.push(t.performed_at);
    perName.set(t.patient_id, dates);
    treatMap.set(t.name, perName);
  }
  const byTreatment: TreatmentRetentionRow[] = [...treatMap.entries()]
    .map(([name, perPatient]) => {
      const all = [...perPatient.values()];
      const repeats = all.filter((d) => d.length > 1);
      const localGaps: number[] = [];
      for (const dates of repeats) {
        for (let i = 1; i < dates.length; i++) {
          localGaps.push((new Date(dates[i]!).getTime() - new Date(dates[i - 1]!).getTime()) / DAY);
        }
      }
      return {
        name,
        patients: all.length,
        repeatPatients: repeats.length,
        repeatRate: pct(repeats.length, all.length),
        averageGapDays: localGaps.length
          ? Math.round(localGaps.reduce((a, b) => a + b, 0) / localGaps.length)
          : null,
      };
    })
    .sort((a, b) => b.patients - a.patients);

  // ---- suggested actions
  const suggestions: { id: string; title: string; detail: string; filter: RiskLevel | "all" }[] = [];
  if (counts.overdue) {
    suggestions.push({
      id: "overdue",
      title: `${counts.overdue} patient${counts.overdue === 1 ? " is" : "s are"} overdue for a treatment`,
      detail: "Send a recall message so they rebook before the effect wears off.",
      filter: "overdue",
    });
  }
  if (counts.lapsing) {
    suggestions.push({
      id: "lapsing",
      title: `${counts.lapsing} patient${counts.lapsing === 1 ? "" : "s"} last seen 3-6 months ago`,
      detail: "A short check-in now is the cheapest way to keep them on the books.",
      filter: "lapsing",
    });
  }
  const latest = monthly[monthly.length - 1];
  const monthBefore = monthly[monthly.length - 2];
  if (latest && monthBefore && latest.rate < monthBefore.rate) {
    suggestions.push({
      id: "dip",
      title: `Retention dipped ${monthBefore.rate - latest.rate}% this month`,
      detail: `Now ${latest.rate}%, down from ${monthBefore.rate}%. Check no-shows and follow-up bookings at discharge.`,
      filter: "all",
    });
  }
  const lastCohort = cohorts[cohorts.length - 1];
  const secondCohort = cohorts.filter((c) => c.patients >= 3).slice(-3);
  const avgSecond = secondCohort.length
    ? Math.round(secondCohort.reduce((s, c) => s + c.secondRate, 0) / secondCohort.length)
    : lastCohort?.secondRate ?? 0;
  if (secondCohort.length && avgSecond < 60) {
    suggestions.push({
      id: "second-visit",
      title: `Only ${avgSecond}% of new patients return for a second treatment`,
      detail: "Book the follow-up before they leave the clinic, and send an aftercare message at two weeks.",
      filter: "all",
    });
  }
  if (counts.lost) {
    suggestions.push({
      id: "lost",
      title: `${counts.lost} patient${counts.lost === 1 ? " has" : "s have"} not been seen for 6 months`,
      detail: "Worth one win-back message before marking them inactive.",
      filter: "lost",
    });
  }

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
      counts,
      revenueAtRisk,
    },
    monthly,
    atRisk,
    cohorts,
    byTreatment,
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
  const dueRow = [...sorted].reverse().find((t) => t.next_due_at);
  const overdue = !!dueRow?.next_due_at && new Date(dueRow.next_due_at).getTime() < now;
  let risk: RiskLevel | null = null;
  if (!hasFutureAppointment) {
    if (daysSince > 180) risk = "lost";
    else if (overdue) risk = "overdue";
    else if (daysSince >= 90) risk = "lapsing";
  }
  return { visits: sorted.length, daysSince, risk };
}
