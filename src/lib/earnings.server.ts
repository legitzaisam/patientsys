/**
 * Earnings + performance maths. Server-only: never import from a component.
 *
 * Money follows the shared model in `metrics/money`: earned is the value of
 * treatments performed in the period, collected the part of that value already
 * paid (a deposit counts the clinic's deposit share), outstanding the rest, so
 * the three always reconcile. Future bookings are "booked ahead", never
 * collected.
 */
import {
  bookedAhead as bookedAheadValue,
  collectedFor,
  share,
  type MoneyOptions,
} from "./metrics/money";

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

function round(n: number) {
  return Math.round(n * 100) / 100;
}

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
  const t = rows.reduce(
    (acc, r) => ({
      earned: acc.earned + r.earned,
      collected: acc.collected + r.collected,
      outstanding: acc.outstanding + r.outstanding,
      bookedAhead: acc.bookedAhead + r.bookedAhead,
      toPractitioners: acc.toPractitioners + r.earnedShare,
      toClinic: acc.toClinic + r.clinicEarnedShare,
    }),
    { earned: 0, collected: 0, outstanding: 0, bookedAhead: 0, toPractitioners: 0, toClinic: 0 },
  );
  return {
    earned: round(t.earned),
    collected: round(t.collected),
    outstanding: round(t.outstanding),
    bookedAhead: round(t.bookedAhead),
    toPractitioners: round(t.toPractitioners),
    toClinic: round(t.toClinic),
  };
}

export function moneyChanges(current: MoneyTotals, previous: MoneyTotals): MoneyTotals {
  return {
    earned: round(current.earned - previous.earned),
    collected: round(current.collected - previous.collected),
    outstanding: round(current.outstanding - previous.outstanding),
    bookedAhead: round(current.bookedAhead - previous.bookedAhead),
    toPractitioners: round(current.toPractitioners - previous.toPractitioners),
    toClinic: round(current.toClinic - previous.toClinic),
  };
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
  const apptById = new Map<string, AppointmentRow & { id: string }>();
  for (const a of appointments) if (a.id) apptById.set(a.id, a as AppointmentRow & { id: string });
  const nowMs = options.nowMs ?? Date.now();
  return staff.map((s) => {
    const mine = treatments.filter((t) => t.practitioner_id === s.userId);
    // Earned: treatment value. Collected: the paid part of that same value, so
    // outstanding is what those treatments still owe. Shares apply each
    // treatment's stamped rate.
    let earned = 0;
    let collected = 0;
    let earnedShare = 0;
    let collectedShare = 0;
    for (const t of mine) {
      const price = Number(t.price ?? 0);
      const rate = Number(t.commission_rate_snapshot ?? s.commissionRate);
      const paidPart = collectedFor(
        t,
        t.appointment_id ? apptById.get(t.appointment_id) : undefined,
        options,
      );
      earned += price;
      collected += paidPart;
      earnedShare += share(price, rate);
      collectedShare += share(paidPart, rate);
    }
    const outstanding = earned - collected;

    const booked = appointments.filter((a) => a.practitioner_id === s.userId);
    const attended = booked.filter((a) => a.status === "attended").length;
    const noShows = booked.filter((a) => a.status === "no_show").length;
    const cancelled = booked.filter((a) => a.status === "cancelled").length;
    const settled = attended + noShows;
    const aheadValue = bookedAheadValue(
      booked.map((a) => ({
        id: a.id ?? "",
        starts_at: a.starts_at,
        status: a.status ?? null,
        price: a.price,
      })),
      nowMs,
    );

    const patientIds = new Set(mine.map((t) => t.patient_id));
    const newPatients = [...patientIds].filter((id) => {
      const first = patientFirstSeen.get(id);
      return first !== undefined && first >= period.from && first <= period.to;
    }).length;

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
      earned: round(earned),
      collected: round(collected),
      earnedShare: round(earnedShare),
      collectedShare: round(collectedShare),
      clinicEarnedShare: round(earned - earnedShare),
      clinicCollectedShare: round(collected - collectedShare),
      treatments: mine.length,
      patients: patientIds.size,
      newPatients,
      retention,
      averageValue: mine.length ? round(earned / mine.length) : 0,
      appointments: booked.length,
      attended,
      noShows,
      cancelled,
      attendance: settled ? Math.round((attended / settled) * 100) : 0,
      outstanding: round(outstanding),
      bookedAhead: aheadValue,
    };
  });
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

function bucketKey(iso: string, monthly: boolean) {
  const d = new Date(iso);
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return monthly ? `${d.getUTCFullYear()}-${m}` : `${d.getUTCFullYear()}-${m}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function bucketLabel(key: string, monthly: boolean) {
  const d = new Date(monthly ? `${key}-01T00:00:00Z` : `${key}T00:00:00Z`);
  return monthly
    ? d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Time-bucketed series for the period, per practitioner plus the clinic total. */
/** What sold in the period: treatments and retail products ranked by revenue, plus retail's share. */
export function whatSold(
  treatments: { name: string; price?: number | null; performed_at: string }[],
  sales: {
    product_id?: string | null;
    qty?: number | null;
    amount?: number | null;
    occurred_at: string;
  }[],
  products: { id: string; name: string; sku?: string | null }[],
  period: Period,
) {
  const inPeriod = (iso: string) => iso >= period.from && iso <= period.to;
  const byTreatment = new Map<string, { name: string; count: number; revenue: number }>();
  let treatmentRevenue = 0;
  for (const t of treatments) {
    if (!inPeriod(t.performed_at)) continue;
    const cur = byTreatment.get(t.name) ?? { name: t.name, count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += Number(t.price ?? 0);
    treatmentRevenue += Number(t.price ?? 0);
    byTreatment.set(t.name, cur);
  }
  const productById = new Map(products.map((p) => [p.id, p]));
  const byProduct = new Map<
    string,
    { name: string; sku: string | null; units: number; revenue: number }
  >();
  let retailRevenue = 0;
  let units = 0;
  for (const s of sales) {
    if (!inPeriod(s.occurred_at)) continue;
    const product = s.product_id ? productById.get(s.product_id) : undefined;
    const key = product?.id ?? "unknown";
    const cur = byProduct.get(key) ?? {
      name: product?.name ?? "Product",
      sku: product?.sku ?? null,
      units: 0,
      revenue: 0,
    };
    cur.units += Number(s.qty ?? 1);
    cur.revenue += Number(s.amount ?? 0);
    units += Number(s.qty ?? 1);
    retailRevenue += Number(s.amount ?? 0);
    byProduct.set(key, cur);
  }
  const total = treatmentRevenue + retailRevenue;
  return {
    treatments: [...byTreatment.values()]
      .sort((a, b) => b.revenue - a.revenue || b.count - a.count)
      .slice(0, 8),
    products: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue || b.units - a.units),
    retail: {
      revenue: round(retailRevenue),
      units,
      treatmentRevenue: round(treatmentRevenue),
      /** Retail as a share of treatment + retail revenue in the period (0–100). */
      share: total ? Math.round((retailRevenue / total) * 1000) / 10 : 0,
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

export function buildTrend(
  staff: { userId: string }[],
  treatments: TreatmentRow[],
  appointments: AppointmentRow[],
  period: Period,
  options: MoneyOptions = { depositPercent: 30 },
): { monthly: boolean; clinic: TrendPoint[]; byPractitioner: Record<string, TrendPoint[]> } {
  const apptById = new Map<string, AppointmentRow & { id: string }>();
  for (const a of appointments) if (a.id) apptById.set(a.id, a as AppointmentRow & { id: string });
  const start = new Date(period.from);
  const end = new Date(period.to);
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  const monthly = days > 62;

  const keys: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), monthly ? 1 : start.getUTCDate()));
  while (cursor.getTime() <= end.getTime()) {
    keys.push(bucketKey(cursor.toISOString(), monthly));
    if (monthly) cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const series = (owner: string | null): TrendPoint[] => {
    const map = new Map<string, TrendPoint>(
      keys.map((k) => [
        k,
        {
          key: k,
          label: bucketLabel(k, monthly),
          earned: 0,
          collected: 0,
          appointments: 0,
          attended: 0,
          noShows: 0,
          attendance: 0,
        },
      ]),
    );
    for (const t of treatments) {
      if (owner && t.practitioner_id !== owner) continue;
      const p = map.get(bucketKey(t.performed_at, monthly));
      if (!p) continue;
      p.earned = round(p.earned + Number(t.price ?? 0));
      p.collected = round(
        p.collected +
          collectedFor(t, t.appointment_id ? apptById.get(t.appointment_id) : undefined, options),
      );
    }
    for (const a of appointments) {
      if (owner && a.practitioner_id !== owner) continue;
      const p = map.get(bucketKey(a.starts_at, monthly));
      if (!p) continue;
      p.appointments += 1;
      if (a.status === "attended") p.attended += 1;
      if (a.status === "no_show") p.noShows += 1;
    }
    for (const p of map.values()) {
      const settled = p.attended + p.noShows;
      p.attendance = settled ? Math.round((p.attended / settled) * 100) : 0;
    }
    return keys.map((k) => map.get(k)!);
  };

  const byPractitioner: Record<string, TrendPoint[]> = {};
  for (const s of staff) byPractitioner[s.userId] = series(s.userId);
  return { monthly, clinic: series(null), byPractitioner };
}
