import { describe, expect, it } from "vitest";
import {
  bookingDetailsMessage,
  formatMoney,
  patientPaymentUrl,
  paymentRequestMessage,
} from "@/lib/payment-link";

const ORIGIN = "https://clinic.example";

describe("patientPaymentUrl", () => {
  it("deep-links through the portal sign-in with an encoded next", () => {
    expect(patientPaymentUrl("apt-1", "deposit", ORIGIN)).toBe(
      `${ORIGIN}/portal?next=${encodeURIComponent("/my-record?pay=apt-1&kind=deposit")}`,
    );
  });
});

describe("formatMoney", () => {
  it("renders pounds with two decimal places", () => {
    expect(formatMoney(50)).toBe("£50.00");
    expect(formatMoney(49.5)).toBe("£49.50");
  });
});

describe("paymentRequestMessage", () => {
  const base = {
    name: "Olivia",
    treatment: "Lip filler",
    when: "Mon 1 Jun, 10:00",
    amount: 45,
    appointmentId: "apt-1",
    origin: ORIGIN,
  };

  it("labels each payment kind correctly and includes the link", () => {
    const deposit = paymentRequestMessage({ ...base, kind: "deposit" });
    expect(deposit).toContain("pay your deposit of £45.00");
    expect(deposit).toContain(patientPaymentUrl("apt-1", "deposit", ORIGIN));

    expect(paymentRequestMessage({ ...base, kind: "balance" })).toContain(
      "pay your remaining balance of £45.00",
    );
    expect(paymentRequestMessage({ ...base, kind: "full" })).toContain(
      "pay your full payment of £45.00",
    );
  });

  it("mentions the treatment number only when present", () => {
    expect(paymentRequestMessage({ ...base, kind: "full", treatmentNumber: 3 })).toContain(
      "(treatment #3)",
    );
    expect(paymentRequestMessage({ ...base, kind: "full" })).not.toContain("treatment #");
  });
});

describe("bookingDetailsMessage", () => {
  const base = {
    name: "Olivia",
    treatment: "Lip filler",
    when: "Mon 1 Jun, 10:00",
    appointmentId: "apt-1",
    price: 100,
    origin: ORIGIN,
  };

  it("confirms a fully paid booking with no payment link", () => {
    const body = bookingDetailsMessage({ ...base, paymentStatus: "paid" });
    expect(body).toContain("your Lip filler appointment is confirmed for Mon 1 Jun, 10:00");
    expect(body).toContain("Payment of £100.00 has been received in full.");
    expect(body).not.toContain("/portal?next=");
  });

  it("asks for the 70% balance when the deposit is already paid", () => {
    const body = bookingDetailsMessage({ ...base, paymentStatus: "deposit_paid" });
    expect(body).toContain("A deposit of £30.00 has been received.");
    expect(body).toContain("pay the remaining £70.00");
    expect(body).toContain(patientPaymentUrl("apt-1", "balance", ORIGIN));
  });

  it("asks for a 30% deposit when unpaid and payKind is deposit", () => {
    const body = bookingDetailsMessage({ ...base, paymentStatus: "unpaid", payKind: "deposit" });
    expect(body).toContain("pay your deposit of £30.00");
    expect(body).toContain(patientPaymentUrl("apt-1", "deposit", ORIGIN));
  });

  it("defaults an unpaid booking to the full amount", () => {
    const body = bookingDetailsMessage({ ...base, paymentStatus: "unpaid" });
    expect(body).toContain("pay your full payment of £100.00");
    expect(body).toContain(patientPaymentUrl("apt-1", "full", ORIGIN));
  });

  it("names the practitioner and treatment number when given", () => {
    const body = bookingDetailsMessage({
      ...base,
      paymentStatus: "paid",
      practitioner: "Nadia Rahman",
      treatmentNumber: 2,
    });
    expect(body).toContain("(treatment #2)");
    expect(body).toContain("with Nadia Rahman");
  });
});
