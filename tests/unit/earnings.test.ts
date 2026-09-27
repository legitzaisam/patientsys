import { describe, expect, it } from "vitest";
import { buildStats, whatSold, withoutMoney } from "@/lib/earnings.server";

const period = { from: "2026-09-01T00:00:00.000Z", to: "2026-09-30T23:59:59.000Z" };

describe("withoutMoney", () => {
  it("zeroes every £ figure and the commission rate, keeping counts, attendance and retention", () => {
    const staff = [{ userId: "p1", fullName: "Dr A", jobTitle: "Doctor", commissionRate: 40 }];
    const [row] = buildStats(
      staff,
      [
        {
          id: "t1",
          practitioner_id: "p1",
          patient_id: "pt1",
          name: "Lip filler",
          price: 300,
          performed_at: "2026-09-10T10:00:00.000Z",
          commission_rate_snapshot: 40,
          appointment_id: "a1",
        },
      ],
      [
        {
          id: "a1",
          practitioner_id: "p1",
          price: 300,
          payment_status: "paid",
          status: "attended",
          starts_at: "2026-09-10T10:00:00.000Z",
        },
      ],
      [{ practitioner_id: "p1", patient_id: "pt1" }],
      new Map([["pt1", "2026-09-01T00:00:00.000Z"]]),
      period,
      { depositPercent: 30, nowMs: Date.parse("2026-09-20T12:00:00.000Z") },
    );
    expect(row!.earned).toBe(300);
    expect(row!.earnedShare).toBe(120);
    const stripped = withoutMoney(row!);
    expect(stripped.earned).toBe(0);
    expect(stripped.collected).toBe(0);
    expect(stripped.earnedShare).toBe(0);
    expect(stripped.outstanding).toBe(0);
    expect(stripped.bookedAhead).toBe(0);
    expect(stripped.commissionRate).toBe(0);
    expect(stripped.averageValue).toBe(0);
    // What a manager without the commission permission still sees.
    expect(stripped.treatments).toBe(1);
    expect(stripped.appointments).toBe(1);
    expect(stripped.attendance).toBe(100);
    expect(stripped.patients).toBe(1);
    expect(stripped.retention).toBe(row!.retention);
  });
});

describe("whatSold", () => {
  it("ranks treatments and products by revenue in the period and gives retail's share", () => {
    const sold = whatSold(
      [
        { name: "Lip filler", price: 300, performed_at: "2026-09-10T10:00:00.000Z" },
        { name: "Lip filler", price: 300, performed_at: "2026-09-12T10:00:00.000Z" },
        { name: "Peel", price: 100, performed_at: "2026-09-12T11:00:00.000Z" },
        { name: "Peel", price: 100, performed_at: "2026-08-12T11:00:00.000Z" }, // outside the period
      ],
      [
        { product_id: "pr1", qty: 2, amount: 60, occurred_at: "2026-09-15T10:00:00.000Z" },
        { product_id: "pr2", qty: 1, amount: 40, occurred_at: "2026-09-16T10:00:00.000Z" },
        { product_id: "pr1", qty: 1, amount: 30, occurred_at: "2026-10-01T10:00:00.000Z" }, // outside
      ],
      [
        { id: "pr1", name: "SPF 50", sku: "SPF-50" },
        { id: "pr2", name: "Serum", sku: null },
      ],
      period,
    );
    expect(sold.treatments.map((t) => [t.name, t.count, t.revenue])).toEqual([
      ["Lip filler", 2, 600],
      ["Peel", 1, 100],
    ]);
    expect(sold.products.map((p) => [p.name, p.units, p.revenue])).toEqual([
      ["SPF 50", 2, 60],
      ["Serum", 1, 40],
    ]);
    expect(sold.retail.revenue).toBe(100);
    expect(sold.retail.treatmentRevenue).toBe(700);
    // 100 of 800 = 12.5 %
    expect(sold.retail.share).toBe(12.5);
  });
});
