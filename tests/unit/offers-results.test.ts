import { describe, expect, it } from "vitest";
import { offerResults } from "@/lib/offers/results";

const at = (iso: string) => new Date(iso).toISOString();

describe("offerResults", () => {
  const offers = [
    {
      template_id: "t1",
      patient_id: "p1",
      status: "claimed",
      claimed_at: at("2026-08-01T10:00Z"),
      expires_at: at("2026-08-20T10:00Z"),
    },
    {
      template_id: "t1",
      patient_id: "p2",
      status: "claimed",
      claimed_at: at("2026-08-05T10:00Z"),
      expires_at: at("2026-08-25T10:00Z"),
    },
    {
      template_id: "t1",
      patient_id: "p3",
      status: "viewed",
      claimed_at: null,
      expires_at: at("2026-09-01T10:00Z"),
    },
    { template_id: "t2", patient_id: "p1", status: "sent", claimed_at: null, expires_at: null },
    { template_id: null, patient_id: "p9", status: "sent", claimed_at: null, expires_at: null },
  ];
  const appointments = [
    { patient_id: "p1", created_at: at("2026-08-02T09:00Z"), status: "booked" }, // after the claim → booked
    { patient_id: "p2", created_at: at("2026-08-06T09:00Z"), status: "cancelled" }, // cancelled → not booked
    { patient_id: "p2", created_at: at("2026-07-30T09:00Z"), status: "attended" }, // before the claim
  ];
  const treatments = [
    { patient_id: "p1", performed_at: at("2026-08-10T09:00Z"), price: 200 }, // inside validity
    { patient_id: "p1", performed_at: at("2026-11-10T09:00Z"), price: 150 }, // inside validity + 90 days
    { patient_id: "p1", performed_at: at("2026-11-20T09:00Z"), price: 999 }, // past the tail
    { patient_id: "p1", performed_at: at("2026-07-20T09:00Z"), price: 50 }, // before the claim
    { patient_id: "p2", performed_at: at("2026-08-07T09:00Z"), price: 80 },
  ];

  it("counts sent, claimed, booked after the claim and revenue inside validity plus 90 days", () => {
    const r = offerResults(offers, appointments, treatments);
    expect(r.get("t1")).toEqual({ sent: 3, claimed: 2, booked: 1, revenue: 430 });
    expect(r.get("t2")).toEqual({ sent: 1, claimed: 0, booked: 0, revenue: 0 });
    expect(r.has("null")).toBe(false);
  });
});
