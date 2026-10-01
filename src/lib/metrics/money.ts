/**
 * The money model, in integer pence throughout. Pounds exist only at the
 * edge: `toPence` on the way in, `fromPence` / `formatPounds` on the way out.
 *
 *   Earned      = value of treatments performed in the period, minus refunds
 *   Collected   = money received for those treatments: a paid booking in
 *                 full, a deposit-paid booking its deposit share; a refunded
 *                 booking contributes nothing to either
 *   Outstanding = Earned − Collected
 *
 * A treatment with no booking (a walk-in) was paid at the desk unless the
 * caller says otherwise. Money on live future bookings is "Booked ahead", a
 * separate line that never enters Collected.
 *
 * A practitioner's share is worked out per treatment line at the rate stamped
 * on it, rounded to the penny once per line. The share of outstanding is the
 * share of earned minus the share of collected, so the three reconcile, and
 * the practitioners' figures add up to the clinic's exactly.
 */
import { isLiveFuture } from "./rules";

export type Pence = number;

export type MoneyTreatment = {
  id?: string;
  patient_id?: string;
  practitioner_id?: string | null;
  name?: string | null;
  price?: number | null;
  performed_at: string;
  appointment_id?: string | null;
  commission_rate_snapshot?: number | null;
};

export type MoneyAppointment = {
  id: string;
  practitioner_id?: string | null;
  price?: number | null;
  payment_status?: string | null;
  status?: string | null;
  starts_at: string;
};

export type MoneyOptions = {
  /** Deposit share of the price, from Settings (Rules → Deposits). */
  depositPercent: number;
  /** A treatment with no booking has no payment record; walk-ins pay at the desk. */
  unlinkedCountsAs?: "paid" | "unpaid";
};

export function toPence(pounds: number | string | null | undefined): Pence {
  return Math.round(Number(pounds ?? 0) * 100);
}

export function fromPence(pence: Pence): number {
  return pence / 100;
}

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "£1,234.50": the one pence-exact display format (CSV, line items). */
export function formatPounds(pence: Pence): string {
  return GBP.format(pence / 100);
}

/** A share of an amount at a commission rate (percent), rounded to the penny. */
export function shareOf(pence: Pence, ratePercent: number): Pence {
  return Math.round((pence * ratePercent) / 100);
}

export type LineMoney = { earned: Pence; collected: Pence };

/** Earned and collected for one treatment line, from its booking's payment state. */
export function lineMoney(
  treatment: MoneyTreatment,
  appointment: MoneyAppointment | undefined,
  opts: MoneyOptions,
): LineMoney {
  const price = toPence(treatment.price);
  if (!price) return { earned: 0, collected: 0 };
  if (!appointment) return { earned: price, collected: (opts.unlinkedCountsAs ?? "paid") === "paid" ? price : 0 };
  switch (appointment.payment_status ?? "unpaid") {
    case "refunded":
      return { earned: 0, collected: 0 };
    case "paid":
      return { earned: price, collected: price };
    case "deposit_paid":
      return { earned: price, collected: Math.min(price, shareOf(price, opts.depositPercent)) };
    default:
      return { earned: price, collected: 0 };
  }
}

export type MoneyTotals = { earned: Pence; collected: Pence; outstanding: Pence; treatments: number };

export type ShareTotals = MoneyTotals & {
  /** The practitioner's share of earned / collected / outstanding. */
  earnedShare: Pence;
  collectedShare: Pence;
  outstandingShare: Pence;
};

export type MoneyLine = LineMoney & {
  treatment: MoneyTreatment;
  rate: number;
  earnedShare: Pence;
  collectedShare: Pence;
};

/** Every line with its money and share. `rateFor` supplies the rate when a line has no stamped rate. */
export function moneyLines(
  treatments: readonly MoneyTreatment[],
  appointmentsById: ReadonlyMap<string, MoneyAppointment>,
  opts: MoneyOptions,
  rateFor: (t: MoneyTreatment) => number = () => 0,
): MoneyLine[] {
  return treatments.map((t) => {
    const m = lineMoney(t, t.appointment_id ? appointmentsById.get(t.appointment_id) : undefined, opts);
    const rate = Number(t.commission_rate_snapshot ?? rateFor(t));
    return { ...m, treatment: t, rate, earnedShare: shareOf(m.earned, rate), collectedShare: shareOf(m.collected, rate) };
  });
}

/** Totals over lines (already filtered to the period and scope). */
export function sumLines(lines: readonly MoneyLine[]): ShareTotals {
  let earned = 0;
  let collected = 0;
  let earnedShare = 0;
  let collectedShare = 0;
  for (const l of lines) {
    earned += l.earned;
    collected += l.collected;
    earnedShare += l.earnedShare;
    collectedShare += l.collectedShare;
  }
  return {
    earned,
    collected,
    outstanding: earned - collected,
    earnedShare,
    collectedShare,
    outstandingShare: earnedShare - collectedShare,
    treatments: lines.length,
  };
}

/** Earned / collected / outstanding over a set of treatments. */
export function moneyTotals(
  treatments: readonly MoneyTreatment[],
  appointmentsById: ReadonlyMap<string, MoneyAppointment>,
  opts: MoneyOptions,
): MoneyTotals {
  const { earned, collected, outstanding, treatments: n } = sumLines(moneyLines(treatments, appointmentsById, opts));
  return { earned, collected, outstanding, treatments: n };
}

/** Value of live bookings that start after now: money the diary holds, not yet earned. */
export function bookedAhead(appointments: readonly MoneyAppointment[], nowMs: number): Pence {
  let sum = 0;
  for (const a of appointments) if (isLiveFuture(a, nowMs)) sum += toPence(a.price);
  return sum;
}

export type SoldTreatment = { name: string; count: number; revenue: Pence };
export type SoldProduct = { name: string; sku: string | null; units: number; revenue: Pence };

/**
 * What sold: treatments by name (count, earned) and retail by product, over
 * rows already filtered to the period. Performance and Insights both show it.
 */
export function whatSold(
  lines: readonly MoneyLine[],
  sales: readonly { product_id?: string | null; qty?: number | null; amount?: number | null }[],
  products: readonly { id: string; name: string; sku?: string | null }[],
) {
  const byTreatment = new Map<string, SoldTreatment>();
  let treatmentRevenue = 0;
  for (const l of lines) {
    const name = l.treatment.name ?? "Treatment";
    const cur = byTreatment.get(name) ?? { name, count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += l.earned;
    treatmentRevenue += l.earned;
    byTreatment.set(name, cur);
  }
  const productById = new Map(products.map((p) => [p.id, p]));
  const byProduct = new Map<string, SoldProduct>();
  let retailRevenue = 0;
  let units = 0;
  for (const s of sales) {
    const product = s.product_id ? productById.get(s.product_id) : undefined;
    const key = product?.id ?? "unknown";
    const cur = byProduct.get(key) ?? { name: product?.name ?? "Product", sku: product?.sku ?? null, units: 0, revenue: 0 };
    const qty = Number(s.qty ?? 1);
    cur.units += qty;
    cur.revenue += toPence(s.amount);
    units += qty;
    retailRevenue += toPence(s.amount);
    byProduct.set(key, cur);
  }
  const total = treatmentRevenue + retailRevenue;
  return {
    treatments: [...byTreatment.values()].sort((a, b) => b.revenue - a.revenue || b.count - a.count || a.name.localeCompare(b.name)),
    products: [...byProduct.values()].sort((a, b) => b.revenue - a.revenue || b.units - a.units),
    retail: {
      revenue: retailRevenue,
      units,
      treatmentRevenue,
      /** Retail as a share of treatment + retail revenue (0–100, one decimal). */
      share: total ? Math.round((retailRevenue / total) * 1000) / 10 : 0,
    },
  };
}
