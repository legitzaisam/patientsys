/**
 * Earnings + performance maths. Server-only: never import from a component.
 *
 * Money follows the shared model in `metrics/money`, in pence until the
 * payload: earned is the value of treatments performed in the period minus
 * refunds, collected what has been received for them (deposits included),
 * outstanding the rest. Shares are worked out per line, so each practitioner's
 * share of outstanding is their share of earned minus their share of
 * collected, and the practitioners add up to the clinic exactly. Future
 * bookings are "booked ahead", never collected.
 */
import {
  bookedAhead as bookedAheadValue,
  buildVisits,
  fromPence,
  isOnList,
  londonDayKey,
  londonMidnight,
  londonMonthKey,
  londonParts,
  monthBuckets,
  monthsBefore,
  moneyLines,
  sumLines,
  toPence,
  whatSold as soldIn,
  type MoneyAppointment,
  type MoneyOptions,
} from "./metrics";

export type Period = { from: string; to: string };

export type PractitionerStats = {
  userId: string;
  fullName: string;
  jobTitle: string;
  commissionRate: number;
  earned: number;
  collected: number;
  earnedShare: number;
  collectedShare: number;
  clinicEarnedShare: number;
  clinicCollectedShare: number;
  treatments: number;
  patients: number;
  newPatients: number;
  retention: number;
  averageValue: number;
  appointments: number;
  attended: number;
  noShows: number;
  cancelled: number;
  attendance: number;
  outstanding: number;
  outstandingShare: number;
  /** Value of this practitioner's live future bookings (not collected). */
  bookedAhead: number;
};

type TreatmentRow = {
  id: string;
  practitioner_id: string | null;
  patient_id: string;
  name: string;
  price: number | null;
  performed_at: string;
  commission_rate_snapshot: number | null;
  /** The booking this treatment was delivered against; its payment state says what is collected. */
  appointment_id?: string | null;
};

type AppointmentRow = {
  id?: string;
  practitioner_id: string | null;
  price: number | null;
  payment_status: string;
  status?: string;
  starts_at: string;
};

export type StatsOptions = MoneyOptions & {
  /** Now, for booked ahead. Defaults to the wall clock. */
  nowMs?: number;
};

const inside = (iso: string, period: Period) => iso >= period.from && iso <= period.to;

export type MoneyTotals = {
  earned: number;
  collected: number;
  /** earned − collected */
  outstanding: number;
  bookedAhead: number;
  toPractitioners: number;
  toClinic: number;
};

export function moneyTotals(rows: PractitionerStats[]): MoneyTotals {
  const sum = (pick: (r: PractitionerStats) => number) => fromPence(rows.reduce((n, r) => n + toPence(pick(r)), 0));
  return {
    earned: sum((r) => r.earned),
    collected: sum((r) => r.collected),
    outstanding: sum((r) => r.outstanding),
    bookedAhead: sum((r) => r.bookedAhead),
    toPractitioners: sum((r) => r.earnedShare),
    toClinic: sum((r) => r.clinicEarnedShare),
  };
}

export function moneyChanges(current: MoneyTotals, previous: MoneyTotals): MoneyTotals {
  const diff = (k: keyof MoneyTotals) => fromPence(toPence(current[k]) - toPence(previous[k]));
  return {
    earned: diff("earned"),
    collected: diff("collected"),
    outstanding: diff("outstanding"),
    bookedAhead: diff("bookedAhead"),
    toPractitioners: diff("toPractitioners"),
    toClinic: diff("toClinic"),
  };
}

type SourcePatient = { id: string; status?: string | null; deleted_at?: string | null };
type SourceTreatment = TreatmentRow & { appointment_id?: string | null };
type SourceAppointment = AppointmentRow & { id: string; patient_id: string; status: string };

/**
 * What `buildStats` reads for one period, from whole-table rows: the period's
 * treatments, the period's bookings plus every live future one (booked ahead)
 * and any booking a period treatment was paid against, one row per visit in
 * the last 12 months (for "returned within 12 months"), and each patient's
 * first visit (for "new"). Deleted patients drop out of all of it.
 */
export function earningsInputs(input: {
  from: string;
  to: string;
  nowMs: number;
  depositPercent: number;
  patients: readonly SourcePatient[];
  treatments: readonly SourceTreatment[];
  appointments: readonly SourceAppointment[];
}) {
  const { from, to, nowMs } = input;
  const nowIso = new Date(nowMs).toISOString();
  const off = new Set(input.patients.filter((p) => !isOnList(p)).map((p) => p.id));
  const visits = buildVisits({ treatments: input.treatments, appointments: input.appointments, nowMs, excluded: off });
  const firstSeen = new Map<string, string>();
  for (const v of visits) if (!firstSeen.has(v.patient_id)) firstSeen.set(v.patient_id, v.performed_at);
  const yearFromMs = monthsBefore(nowMs, 12);
  const periodTreatments = input.treatments.filter((t) => inside(t.performed_at, { from, to }) && !off.has(t.patient_id));
  const paidAgainst = new Set(periodTreatments.map((t) => t.appointment_id).filter((id): id is string => !!id));
  const appointments = input.appointments.filter(
    (a) =>
      (!off.has(a.patient_id) &&
        (inside(a.starts_at, { from, to }) || (a.starts_at >= nowIso && a.status !== "cancelled"))) ||
      (!inside(a.starts_at, { from, to }) && paidAgainst.has(a.id)),
  );
  return {
    money: { depositPercent: input.depositPercent, nowMs },
    treatments: periodTreatments,
    appointments,
    yearTreatments: visits
      .filter((v) => new Date(v.performed_at).getTime() >= yearFromMs)
      .map((v) => ({ practitioner_id: v.practitioner_id, patient_id: v.patient_id })),
    firstSeen,
  };
}

/** The clinic row on Performance: the practitioners' figures added up, money pence-exact. */
export function performanceTotals(rows: PractitionerStats[]) {
  const count = (pick: (r: PractitionerStats) => number) => rows.reduce((n, r) => n + pick(r), 0);
  const money = moneyTotals(rows);
  const totals = {
    earned: money.earned,
    collected: money.collected,
    toPractitioners: money.toPractitioners,
    toClinic: money.toClinic,
    treatments: count((r) => r.treatments),
    patients: count((r) => r.patients),
    newPatients: count((r) => r.newPatients),
    appointments: count((r) => r.appointments),
    attended: count((r) => r.attended),
    noShows: count((r) => r.noShows),
    cancelled: count((r) => r.cancelled),
    outstanding: money.outstanding,
    bookedAhead: money.bookedAhead,
  };
  const settled = totals.attended + totals.noShows;
  const clinic = {
    ...totals,
    attendance: settled ? Math.round((totals.attended / settled) * 100) : 0,
    averageValue: totals.treatments ? Math.round((totals.earned * 100) / totals.treatments) / 100 : 0,
    retention: rows.length ? Math.round(count((r) => r.retention) / rows.length) : 0,
    averageCommission: rows.length ? Math.round((count((r) => r.commissionRate) / rows.length) * 10) / 10 : 0,
  };
  return { totals, clinic };
}

/**
 * Builds per-practitioner figures for a period.
 * `rateFor` is the current rate; each treatment uses the rate stamped on it when recorded.
 */
export function buildStats(
  staff: { userId: string; fullName: string; jobTitle: string; commissionRate: number }[],
  treatments: TreatmentRow[],
  appointments: AppointmentRow[],
  yearTreatments: { practitioner_id: string | null; patient_id: string }[],
  patientFirstSeen: Map<string, string>,
  period: Period,
  options: StatsOptions = { depositPercent: 30 },
): PractitionerStats[] {
  const apptById = new Map<string, MoneyAppointment>();
  for (const a of appointments) if (a.id) apptById.set(a.id, a as MoneyAppointment);
  const nowMs = options.nowMs ?? Date.now();
  return staff.map((s) => {
    const mine = treatments.filter((t) => t.practitioner_id === s.userId);
    const money = sumLines(moneyLines(mine, apptById, options, () => s.commissionRate));

    const mineAll = appointments.filter((a) => a.practitioner_id === s.userId);
    const booked = mineAll.filter((a) => inside(a.starts_at, period));
    const attended = booked.filter((a) => a.status === "attended").length;
    const noShows = booked.filter((a) => a.status === "no_show").length;
    const cancelled = booked.filter((a) => a.status === "cancelled").length;
    const settled = attended + noShows;
    const aheadValue = bookedAheadValue(
      mineAll.map((a) => ({ id: a.id ?? "", starts_at: a.starts_at, status: a.status ?? null, price: a.price })),
      nowMs,
    );

    // New patients: first-ever visit (with anyone) falls in the period.
    const patientIds = new Set(mine.map((t) => t.patient_id));
    const newPatients = [...patientIds].filter((id) => {
      const first = patientFirstSeen.get(id);
      return first !== undefined && inside(first, period);
    }).length;

    // Retention: of the patients this practitioner saw in the last 12 months,
    // the share who came back (two or more visits). One row per visit.
    const seen = new Map<string, number>();
    for (const t of yearTreatments) {
      if (t.practitioner_id !== s.userId) continue;
      seen.set(t.patient_id, (seen.get(t.patient_id) ?? 0) + 1);
    }
    const returning = [...seen.values()].filter((n) => n > 1).length;
    const retention = seen.size ? Math.round((returning / seen.size) * 100) : 0;

    return {
      userId: s.userId,
      fullName: s.fullName,
      jobTitle: s.jobTitle,
      commissionRate: s.commissionRate,
      earned: fromPence(money.earned),
      collected: fromPence(money.collected),
      earnedShare: fromPence(money.earnedShare),
      collectedShare: fromPence(money.collectedShare),
      clinicEarnedShare: fromPence(money.earned - money.earnedShare),
      clinicCollectedShare: fromPence(money.collected - money.collectedShare),
      treatments: mine.length,
      patients: patientIds.size,
      newPatients,
      retention,
      averageValue: mine.length ? fromPence(Math.round(money.earned / mine.length)) : 0,
      appointments: booked.length,
      attended,
      noShows,
      cancelled,
      attendance: settled ? Math.round((attended / settled) * 100) : 0,
      outstanding: fromPence(money.outstanding),
      outstandingShare: fromPence(money.outstandingShare),
      bookedAhead: fromPence(aheadValue),
    };
  });
}

/** Every earnings line for one practitioner, in pence-exact pounds: the page's table and the CSV read these. */
export function earningsLines(
  treatments: TreatmentRow[],
  appointments: AppointmentRow[],
  rate: number,
  options: MoneyOptions,
) {
  const apptById = new Map<string, MoneyAppointment>();
  for (const a of appointments) if (a.id) apptById.set(a.id, a as MoneyAppointment);
  return moneyLines(treatments, apptById, options, () => rate).map((l) => ({
    treatment: l.treatment as TreatmentRow,
    share: fromPence(l.earnedShare),
    /** Paid once the line is fully collected. */
    payout: l.collected >= l.earned ? ("paid" as const) : ("pending" as const),
  }));
}

export type TrendPoint = {
  key: string;
  label: string;
  earned: number;
  collected: number;
  appointments: number;
  attended: number;
  noShows: number;
  attendance: number;
};

/** What sold in the period: treatments and retail products ranked by revenue, plus retail's share. */
export function whatSold(
  treatments: TreatmentRow[],
  appointments: AppointmentRow[],
  sales: { product_id?: string | null; qty?: number | null; amount?: number | null; occurred_at: string }[],
  products: { id: string; name: string; sku?: string | null }[],
  period: Period,
  options: MoneyOptions,
) {
  const apptById = new Map<string, MoneyAppointment>();
  for (const a of appointments) if (a.id) apptById.set(a.id, a as MoneyAppointment);
  const sold = soldIn(
    moneyLines(treatments.filter((t) => inside(t.performed_at, period)), apptById, options),
    sales.filter((x) => inside(x.occurred_at, period)),
    products,
  );
  return {
    treatments: sold.treatments.slice(0, 8).map((t) => ({ ...t, revenue: fromPence(t.revenue) })),
    products: sold.products.map((p) => ({ ...p, revenue: fromPence(p.revenue) })),
    retail: {
      revenue: fromPence(sold.retail.revenue),
      units: sold.retail.units,
      treatmentRevenue: fromPence(sold.retail.treatmentRevenue),
      share: sold.retail.share,
    },
  };
}

/**
 * The money a manager without `reports.commission` must not see: every £
 * figure and the commission rate, zeroed before the payload leaves the
 * server. Counts, attendance and retention stay. Applied to rows, totals,
 * the clinic row and the trend points alike.
 */
export function withoutMoney<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const key of [
    "earned",
    "collected",
    "earnedShare",
    "collectedShare",
    "clinicEarnedShare",
    "clinicCollectedShare",
    "averageValue",
    "outstanding",
    "outstandingShare",
    "bookedAhead",
    "commissionRate",
    "toPractitioners",
    "toClinic",
    "averageCommission",
  ]) {
    if (key in out) out[key] = 0;
  }
  return out as T;
}

/** London day or month buckets for the period (months beyond 62 days), none after now. */
function trendBuckets(period: Period, nowMs: number) {
  const fromMs = new Date(period.from).getTime();
  const toMs = new Date(period.to).getTime();
  const monthly = (toMs - fromMs) / 86_400_000 > 62;
  if (monthly) {
    return {
      monthly,
      buckets: monthBuckets({ fromMs, toMs }, Math.max(nowMs, fromMs)).map((b) => ({ key: b.key, label: b.label })),
      keyOf: (iso: string) => londonMonthKey(new Date(iso).getTime()),
    };
  }
  const start = londonParts(fromMs);
  const buckets: { key: string; label: string }[] = [];
  for (let i = 0; ; i++) {
    const ms = londonMidnight(start.year, start.month, start.day + i);
    if (ms > toMs) break;
    const p = londonParts(ms);
    buckets.push({ key: londonDayKey(ms), label: `${p.day} ${MONTH_SHORT[p.month - 1]}` });
  }
  return { monthly, buckets, keyOf: (iso: string) => londonDayKey(new Date(iso).getTime()) };
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Time-bucketed series for the period, per practitioner plus the clinic total. */
export function buildTrend(
  staff: { userId: string }[],
  treatments: TreatmentRow[],
  appointments: AppointmentRow[],
  period: Period,
  options: StatsOptions = { depositPercent: 30 },
): { monthly: boolean; clinic: TrendPoint[]; byPractitioner: Record<string, TrendPoint[]> } {
  const apptById = new Map<string, MoneyAppointment>();
  for (const a of appointments) if (a.id) apptById.set(a.id, a as MoneyAppointment);
  const { monthly, buckets, keyOf } = trendBuckets(period, options.nowMs ?? Date.now());
  const lines = moneyLines(
    treatments.filter((t) => inside(t.performed_at, period)),
    apptById,
    options,
  );

  const series = (owner: string | null): TrendPoint[] => {
    const pence = new Map(buckets.map((b) => [b.key, { earned: 0, collected: 0 }]));
    const map = new Map<string, TrendPoint>(
      buckets.map((b) => [
        b.key,
        { key: b.key, label: b.label, earned: 0, collected: 0, appointments: 0, attended: 0, noShows: 0, attendance: 0 },
      ]),
    );
    for (const l of lines) {
      if (owner && l.treatment.practitioner_id !== owner) continue;
      const m = pence.get(keyOf(l.treatment.performed_at));
      if (!m) continue;
      m.earned += l.earned;
      m.collected += l.collected;
    }
    for (const a of appointments) {
      if (owner && a.practitioner_id !== owner) continue;
      if (!inside(a.starts_at, period)) continue;
      const p = map.get(keyOf(a.starts_at));
      if (!p) continue;
      p.appointments += 1;
      if (a.status === "attended") p.attended += 1;
      if (a.status === "no_show") p.noShows += 1;
    }
    for (const p of map.values()) {
      const m = pence.get(p.key)!;
      p.earned = fromPence(m.earned);
      p.collected = fromPence(m.collected);
      const settled = p.attended + p.noShows;
      p.attendance = settled ? Math.round((p.attended / settled) * 100) : 0;
    }
    return buckets.map((b) => map.get(b.key)!);
  };

  const byPractitioner: Record<string, TrendPoint[]> = {};
  for (const s of staff) byPractitioner[s.userId] = series(s.userId);
  return { monthly, clinic: series(null), byPractitioner };
}
