/** Patient-facing payment deep link (portal sign-in → my record). */
export type PaymentLinkKind = "deposit" | "full" | "balance";

export function patientPaymentUrl(appointmentId: string, kind: PaymentLinkKind, origin?: string) {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const next = `/my-record?pay=${encodeURIComponent(appointmentId)}&kind=${kind}`;
  return `${base}/portal?next=${encodeURIComponent(next)}`;
}

export function formatMoney(n: number) {
  return `£${n.toFixed(2)}`;
}

/** SMS/email body with a clickable portal payment URL. */
export function paymentRequestMessage(opts: {
  name: string;
  treatment: string;
  treatmentNumber?: number | string | null;
  when: string;
  amount: number;
  kind: PaymentLinkKind;
  appointmentId: string;
  origin?: string;
}) {
  const money = formatMoney(opts.amount);
  const label =
    opts.kind === "deposit" ? "deposit" : opts.kind === "balance" ? "remaining balance" : "full payment";
  const url = patientPaymentUrl(opts.appointmentId, opts.kind, opts.origin);
  const tx =
    opts.treatmentNumber != null && opts.treatmentNumber !== ""
      ? ` (treatment #${opts.treatmentNumber})`
      : "";
  return `Hi ${opts.name}, please pay your ${label} of ${money} for ${opts.treatment}${tx} on ${opts.when}. Tap this link to sign in and pay in your patient account: ${url}`;
}

/** Booking confirmation for email/SMS, with optional payment link. */
export function bookingDetailsMessage(opts: {
  name: string;
  treatment: string;
  treatmentNumber?: number | string | null;
  when: string;
  practitioner?: string | null;
  appointmentId: string;
  price: number;
  paymentStatus: "unpaid" | "deposit_paid" | "paid" | "refunded" | string;
  /** When unpaid / deposit_paid, which amount the pay link should request. */
  payKind?: PaymentLinkKind;
  origin?: string;
}) {
  const tx =
    opts.treatmentNumber != null && opts.treatmentNumber !== ""
      ? ` (treatment #${opts.treatmentNumber})`
      : "";
  const withWho = opts.practitioner ? ` with ${opts.practitioner}` : "";
  let body =
    `Hi ${opts.name}, your ${opts.treatment}${tx} appointment is confirmed for ${opts.when}${withWho}. ` +
    `Please arrive 5 minutes early and let us know if you need to reschedule.`;

  if (opts.paymentStatus === "paid") {
    body += ` Payment of ${formatMoney(opts.price)} has been received in full.`;
    return body;
  }

  if (opts.paymentStatus === "deposit_paid") {
    const deposit = Math.round(opts.price * 0.3 * 100) / 100;
    const balance = Math.round((opts.price - deposit) * 100) / 100;
    const url = patientPaymentUrl(opts.appointmentId, "balance", opts.origin);
    body +=
      ` A deposit of ${formatMoney(deposit)} has been received. ` +
      `Please pay the remaining ${formatMoney(balance)} here: ${url}`;
    return body;
  }

  const kind = opts.payKind === "deposit" ? "deposit" : "full";
  const amount = kind === "deposit" ? Math.round(opts.price * 0.3 * 100) / 100 : opts.price;
  const label = kind === "deposit" ? "deposit" : "full payment";
  const url = patientPaymentUrl(opts.appointmentId, kind, opts.origin);
  body +=
    ` To pay your ${label} of ${formatMoney(amount)}, tap this link to sign in to your patient account: ${url}`;
  return body;
}

/**
 * Booking confirmations reach the patient's portal thread and nowhere else:
 * the clinic has no email or SMS transport yet. Do not reinstate a claim that
 * either was sent until dispatch actually exists.
 */
export function bookingNotifyDescription() {
  return "Confirmation and payment details saved to their patient portal.";
}
