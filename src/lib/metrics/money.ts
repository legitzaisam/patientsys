/**
 * The money model (26 Sep 2026 review):
 *
 *   Earned      = value of treatments performed in the period
 *   Collected   = the part of that value already paid (a paid booking counts
 *                 in full; a deposit counts the clinic's deposit share)
 *   Outstanding = Earned − Collected
 *
 * so the three always reconcile. Money on future bookings is "Booked ahead",
 * a separate line that never enters Collected. Practitioner pages show each
 * figure as their share by commission rate.
 */

export type MoneyTreatment = {
  id?: string;
  patient_id?: string;
  practitioner_id?: string | null;
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
  /** Deposit share of the price, from Settings (Payments and deposits). */
  depositPercent: number;
  /**
   * A treatment with no linked booking has no payment record. Clinics that
   * treat walk-ins take payment at the desk, so these count as paid unless
   * told otherwise.
   */
  unlinkedCountsAs?: "paid" | "unpaid";
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** The paid part of one treatment's price, from its booking's payment state. */
export function collectedFor(
  treatment: MoneyTreatment,
  appointment: MoneyAppointment | undefined,
  opts: MoneyOptions,
): number {
  const price = Number(treatment.price ?? 0);
  if (!price) return 0;
  if (!appointment) return (opts.unlinkedCountsAs ?? "paid") === "paid" ? price : 0;
  switch (appointment.payment_status ?? "unpaid") {
    case "paid":
      return price;
    case "deposit_paid":
      return round2((price * opts.depositPercent) / 100);
    default:
      return 0;
  }
}

export type MoneyTotals = {
  earned: number;
  collected: number;
  outstanding: number;
  treatments: number;
};

/** Earned / collected / outstanding over a set of treatments (already filtered to the period). */
export function moneyTotals(
  treatments: readonly MoneyTreatment[],
  appointmentsById: Map<string, MoneyAppointment>,
  opts: MoneyOptions,
): MoneyTotals {
  let earned = 0;
  let collected = 0;
  for (const t of treatments) {
    const price = Number(t.price ?? 0);
    earned += price;
    collected += collectedFor(
      t,
      t.appointment_id ? appointmentsById.get(t.appointment_id) : undefined,
      opts,
    );
  }
  earned = round2(earned);
  collected = round2(collected);
  return {
    earned,
    collected,
    outstanding: round2(earned - collected),
    treatments: treatments.length,
  };
}

/** Value of live bookings that start after `nowMs`: money the diary holds, not yet earned. */
export function bookedAhead(appointments: readonly MoneyAppointment[], nowMs: number): number {
  let sum = 0;
  for (const a of appointments) {
    if (a.status === "cancelled" || a.status === "no_show") continue;
    if (new Date(a.starts_at).getTime() <= nowMs) continue;
    sum += Number(a.price ?? 0);
  }
  return round2(sum);
}

/** A practitioner's share of an amount at a commission rate (percent). */
export function share(amount: number, ratePercent: number): number {
  return round2((amount * ratePercent) / 100);
}

/** Share totals, honouring each treatment's snapshot rate where it has one. */
export function shareTotals(
  treatments: readonly MoneyTreatment[],
  appointmentsById: Map<string, MoneyAppointment>,
  fallbackRatePercent: number,
  opts: MoneyOptions,
): MoneyTotals {
  let earned = 0;
  let collected = 0;
  for (const t of treatments) {
    const rate = Number(t.commission_rate_snapshot ?? fallbackRatePercent);
    const price = Number(t.price ?? 0);
    earned += share(price, rate);
    collected += share(
      collectedFor(t, t.appointment_id ? appointmentsById.get(t.appointment_id) : undefined, opts),
      rate,
    );
  }
  earned = round2(earned);
  collected = round2(collected);
  return {
    earned,
    collected,
    outstanding: round2(earned - collected),
    treatments: treatments.length,
  };
}

export function inPeriod(iso: string, fromMs: number, toMs: number): boolean {
  const ms = new Date(iso).getTime();
  return ms >= fromMs && ms <= toMs;
}
