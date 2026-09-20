import { describe, expect, it } from "vitest";
import { buildBookMetrics, buildInsights, isConsultation, normalizeSource } from "@/lib/insights.server";

describe("isConsultation", () => {
  it("treats the Consultation category as a consult", () => {
    expect(isConsultation({ category: "Consultation", name: "Skin plan" })).toBe(true);
  });

  it("matches consult in the treatment name", () => {
    expect(isConsultation({ category: "Skin", name: "Skin Consultation" })).toBe(true);
    expect(isConsultation({ category: "Injectables", name: "Lip Filler" })).toBe(false);
  });
});

describe("normalizeSource", () => {
  it("falls back to other", () => {
    expect(normalizeSource("TikTok")).toBe("other");
    expect(normalizeSource("walk-in")).toBe("walk_in");
  });
});

describe("buildInsights", () => {
  it("counts website sign-ups, unbooked leads and consult conversion", () => {
    const result = buildInsights({
      from: "2026-09-01T00:00:00.000Z",
      to: "2026-09-30T23:59:59.000Z",
      now: new Date("2026-09-19T12:00:00.000Z"),
      patients: [
        {
          id: "p-web",
          first_name: "Isla",
          last_name: "Hartley",
          email: "isla@example.com",
          source: "website",
          created_at: "2026-09-08T10:00:00.000Z",
        },
        {
          id: "p-consult",
          first_name: "Freya",
          last_name: "Nielsen",
          email: "freya@example.com",
          source: "website",
          created_at: "2026-09-02T10:00:00.000Z",
        },
      ],
      appointments: [
        {
          patient_id: "p-consult",
          starts_at: "2026-09-05T10:00:00.000Z",
          status: "attended",
          treatment_name: "Skin Consultation",
          catalogue_id: "c-consult",
        },
      ],
      treatments: [
        {
          patient_id: "p-consult",
          name: "Skin Consultation",
          price: 50,
          performed_at: "2026-09-05T10:30:00.000Z",
          catalogue_id: "c-consult",
        },
      ],
      catalogue: [{ id: "c-consult", name: "Skin Consultation", category: "Consultation" }],
      leads: [
        {
          id: "l1",
          patient_id: "p-web",
          first_name: "Isla",
          last_name: "Hartley",
          email: "isla@example.com",
          source: "website",
          interest: "Consultation",
          occurred_at: "2026-09-08T10:00:00.000Z",
        },
      ],
      products: [],
      sales: [],
    });

    expect(result.funnel.signUps).toBe(2);
    expect(result.funnel.notBooked).toBe(1);
    expect(result.funnel.bookedCount).toBe(1);
    expect(result.funnel.bookedRate).toBe(0.5);
    expect(result.funnel.consulted).toBe(1);
    expect(result.funnel.converted).toBe(0);
    expect(result.waiting[0]?.firstName).toBe("Isla");
    expect(result.consultedNoTreatment[0]?.firstName).toBe("Freya");
  });
});

describe("buildBookMetrics", () => {
  const now = new Date("2026-09-20T12:00:00.000Z");

  it("counts dormant patients as never treated or with no visit in 12 months", () => {
    const result = buildBookMetrics({
      now,
      patients: [
        { id: "never", status: "active", created_at: "2026-08-01T00:00:00.000Z", source: "website" },
        { id: "old", status: "inactive", created_at: "2024-01-01T00:00:00.000Z", source: "referral" },
        { id: "recent", status: "active", created_at: "2025-01-01T00:00:00.000Z", source: "walk_in" },
      ],
      treatments: [
        { patient_id: "old", name: "Botox", price: 200, performed_at: "2025-08-01T10:00:00.000Z" },
        { patient_id: "recent", name: "Botox", price: 200, performed_at: "2026-08-01T10:00:00.000Z" },
      ],
      appointments: [],
    });

    expect(result.totals.dormant).toBe(2);
    expect(result.totals.dormantShare).toBeCloseTo(2 / 3);
    expect(result.composition.neverTreated).toBe(1);
    expect(result.composition.treatedOnce).toBe(2);
    expect(result.composition.multiTreatment).toBe(0);
    expect(result.sources.map((row) => row.source).sort()).toEqual(["referral", "walk_in", "website"]);
  });

  it("measures first-to-second within 90 days for a 90–365 day first-visit cohort", () => {
    const result = buildBookMetrics({
      now,
      patients: [
        { id: "returned", status: "active", created_at: "2026-03-01T00:00:00.000Z" },
        { id: "stayed", status: "active", created_at: "2026-03-01T00:00:00.000Z" },
        { id: "too-recent", status: "active", created_at: "2026-08-01T00:00:00.000Z" },
        { id: "too-old", status: "active", created_at: "2024-01-01T00:00:00.000Z" },
      ],
      treatments: [
        { patient_id: "returned", name: "Consult", price: 50, performed_at: "2026-04-01T10:00:00.000Z" },
        { patient_id: "returned", name: "Botox", price: 250, performed_at: "2026-05-01T10:00:00.000Z" },
        { patient_id: "stayed", name: "Consult", price: 50, performed_at: "2026-04-01T10:00:00.000Z" },
        { patient_id: "too-recent", name: "Consult", price: 50, performed_at: "2026-08-01T10:00:00.000Z" },
        { patient_id: "too-old", name: "Consult", price: 50, performed_at: "2025-08-01T10:00:00.000Z" },
      ],
      appointments: [],
    });

    expect(result.quality.firstToSecondCohort).toBe(2);
    expect(result.quality.firstToSecond).toBe(0.5);
    expect(result.composition.multiTreatment).toBe(1);
  });

  it("counts rebooked as a future non-cancelled appointment after a visit in 90 days", () => {
    const result = buildBookMetrics({
      now,
      patients: [
        { id: "booked", status: "active", created_at: "2025-01-01T00:00:00.000Z" },
        { id: "open", status: "active", created_at: "2025-01-01T00:00:00.000Z" },
        { id: "cancelled-only", status: "active", created_at: "2025-01-01T00:00:00.000Z" },
      ],
      treatments: [
        { patient_id: "booked", name: "Botox", price: 280, performed_at: "2026-08-01T10:00:00.000Z" },
        { patient_id: "open", name: "Botox", price: 280, performed_at: "2026-08-10T10:00:00.000Z" },
        { patient_id: "cancelled-only", name: "Botox", price: 280, performed_at: "2026-08-15T10:00:00.000Z" },
      ],
      appointments: [
        { patient_id: "booked", starts_at: "2026-10-01T10:00:00.000Z", status: "scheduled" },
        { patient_id: "cancelled-only", starts_at: "2026-10-02T10:00:00.000Z", status: "cancelled" },
      ],
    });

    expect(result.quality.rebookedCohort).toBe(3);
    expect(result.quality.rebooked).toBeCloseTo(1 / 3);
    expect(result.quality.spendPerPatient).toBe(280);
    expect(result.quality.visitValue).toBe(280);
    expect(result.treatedMix).toEqual({ firstTimers: 3, returning: 0 });
  });
});
