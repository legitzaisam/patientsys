/**
 * Results per offer template: sent → claimed → booked → £ revenue. Pure;
 * production and demo hand in the rows.
 *
 * Booked = the patient made a booking (a non-cancelled appointment created)
 * after claiming. Revenue = treatments performed for that patient after the
 * claim and within the offer's validity plus 90 days.
 */
export type OfferResultOffer = {
  template_id: string | null;
  patient_id: string;
  status: string;
  claimed_at: string | null;
  expires_at: string | null;
};

export type OfferResults = { sent: number; claimed: number; booked: number; revenue: number };

const REVENUE_TAIL_MS = 90 * 86_400_000;

export function offerResults(
  offers: OfferResultOffer[],
  appointments: { patient_id: string; created_at: string; status: string | null }[],
  treatments: { patient_id: string; performed_at: string; price: number | null }[],
): Map<string, OfferResults> {
  const apptsBy = new Map<string, { created_at: string; status: string | null }[]>();
  for (const a of appointments) {
    const list = apptsBy.get(a.patient_id);
    if (list) list.push(a);
    else apptsBy.set(a.patient_id, [a]);
  }
  const txBy = new Map<string, { performed_at: string; price: number | null }[]>();
  for (const t of treatments) {
    const list = txBy.get(t.patient_id);
    if (list) list.push(t);
    else txBy.set(t.patient_id, [t]);
  }

  const results = new Map<string, OfferResults>();
  for (const offer of offers) {
    if (!offer.template_id) continue;
    const bucket = results.get(offer.template_id) ?? { sent: 0, claimed: 0, booked: 0, revenue: 0 };
    bucket.sent += 1;
    if (offer.status === "claimed" && offer.claimed_at) {
      bucket.claimed += 1;
      const claimedMs = new Date(offer.claimed_at).getTime();
      const windowEnd = new Date(offer.expires_at ?? offer.claimed_at).getTime() + REVENUE_TAIL_MS;
      const booked = (apptsBy.get(offer.patient_id) ?? []).some(
        (a) => a.status !== "cancelled" && new Date(a.created_at).getTime() > claimedMs,
      );
      if (booked) bucket.booked += 1;
      for (const t of txBy.get(offer.patient_id) ?? []) {
        const at = new Date(t.performed_at).getTime();
        if (at > claimedMs && at <= windowEnd) bucket.revenue += Number(t.price ?? 0);
      }
    }
    results.set(offer.template_id, bucket);
  }
  return results;
}

export const EMPTY_RESULTS: OfferResults = { sent: 0, claimed: 0, booked: 0, revenue: 0 };
