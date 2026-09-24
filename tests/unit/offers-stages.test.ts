import { describe, expect, it } from "vitest";
import {
  delayElapsed,
  offerClaimUrl,
  offerExpiry,
  planNearingEnd,
  renderOffer,
  stageOf,
  type PatientFacts,
} from "@/lib/offers/stages";

const NOW = new Date("2026-09-24T09:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

const base: PatientFacts = {
  createdAt: daysAgo(40),
  firstConsultAt: null,
  treatmentDates: [],
  hasUpcomingBooking: false,
  activePlan: null,
};

describe("stageOf", () => {
  it("puts a sign-up with nothing booked in pre-consultation, dated from sign-up", () => {
    expect(stageOf(base, NOW)).toEqual({ stage: "pre_consultation", since: base.createdAt });
  });

  it("puts a consulted patient with no treatment in post-consultation, dated from the consult", () => {
    const facts = { ...base, firstConsultAt: daysAgo(10) };
    expect(stageOf(facts, NOW)).toEqual({ stage: "post_consultation", since: facts.firstConsultAt });
  });

  it("does not count a consultation that is still in the future", () => {
    const facts = { ...base, firstConsultAt: new Date(NOW.getTime() + 86400000).toISOString() };
    expect(stageOf(facts, NOW)).toBeNull();
  });

  it("puts one treatment with nothing booked in single-treatment", () => {
    const facts = { ...base, firstConsultAt: daysAgo(30), treatmentDates: [daysAgo(25)] };
    expect(stageOf(facts, NOW)).toEqual({ stage: "single_treatment", since: daysAgo(25) });
  });

  it("leaves out anyone with an upcoming booking or several treatments", () => {
    expect(stageOf({ ...base, hasUpcomingBooking: true }, NOW)).toBeNull();
    expect(stageOf({ ...base, treatmentDates: [daysAgo(60), daysAgo(20)] }, NOW)).toBeNull();
  });

  it("puts a nearly finished plan in plan-ending and a mid-plan patient nowhere", () => {
    const plan = { startedAt: daysAgo(60), durationDays: 120, sessionsTotal: 4, sessionsDone: 3 };
    expect(stageOf({ ...base, activePlan: plan }, NOW)).toEqual({
      stage: "plan_ending",
      since: plan.startedAt,
    });
    expect(
      stageOf({ ...base, activePlan: { ...plan, sessionsDone: 1 } }, NOW),
    ).toBeNull();
  });
});

describe("planNearingEnd", () => {
  it("needs at least three sessions", () => {
    expect(
      planNearingEnd({ startedAt: daysAgo(10), durationDays: 30, sessionsTotal: 2, sessionsDone: 1 }, NOW),
    ).toBe(false);
  });

  it("fires with one session or less left", () => {
    expect(
      planNearingEnd({ startedAt: daysAgo(10), durationDays: null, sessionsTotal: 3, sessionsDone: 2 }, NOW),
    ).toBe(true);
    expect(
      planNearingEnd({ startedAt: daysAgo(10), durationDays: null, sessionsTotal: 6, sessionsDone: 3 }, NOW),
    ).toBe(false);
  });

  it("fires past 80% of the plan's duration", () => {
    expect(
      planNearingEnd({ startedAt: daysAgo(85), durationDays: 100, sessionsTotal: 6, sessionsDone: 2 }, NOW),
    ).toBe(true);
    expect(
      planNearingEnd({ startedAt: daysAgo(50), durationDays: 100, sessionsTotal: 6, sessionsDone: 2 }, NOW),
    ).toBe(false);
  });
});

describe("delayElapsed", () => {
  it("waits out the stage delay", () => {
    expect(delayElapsed(daysAgo(6), 7, NOW)).toBe(false);
    expect(delayElapsed(daysAgo(7), 7, NOW)).toBe(true);
    expect(delayElapsed(daysAgo(0), 0, NOW)).toBe(true);
  });
});

describe("renderOffer", () => {
  const template = {
    subject: "{{first_name}}, {{offer}} at {{clinic}}",
    headline: "Ready when you are",
    body: "First paragraph.\n\nSecond <b>paragraph</b>.",
    value_text: "£25 off your first treatment",
    code: "WELCOME25",
    cta_label: "Book now",
    valid_days: 30,
  };
  const rendered = renderOffer(
    template,
    { first_name: "Olivia", last_name: "Bennett" },
    {
      clinicName: "Aetheria",
      claimUrl: "https://clinic.test/portal?next=%2Fmy-record%3Foffer%3Dabc",
      personalLine: "Lovely to see you last week.",
      expiresAt: "2026-10-24T09:00:00Z",
    },
  );

  it("fills variables into the subject and text", () => {
    expect(rendered.subject).toBe("Olivia, £25 off your first treatment at Aetheria");
    expect(rendered.text).toContain("Hi Olivia,");
    expect(rendered.text).toContain("Lovely to see you last week.");
    expect(rendered.text).toContain("Quote code WELCOME25 when you book.");
    expect(rendered.text).toContain("Valid until 24 October 2026.");
    expect(rendered.text).toContain("Book now: https://clinic.test/portal?next=");
  });

  it("escapes HTML and renders the button", () => {
    expect(rendered.html).toContain("Second &lt;b&gt;paragraph&lt;/b&gt;.");
    expect(rendered.html).toContain('href="https://clinic.test/portal?next=%2Fmy-record%3Foffer%3Dabc"');
    expect(rendered.html).toContain(">Book now</a>");
    expect(rendered.html).toContain("<strong>WELCOME25</strong>");
  });

  it("returns the portal card fields", () => {
    expect(rendered.card).toEqual({
      headline: "Ready when you are",
      body: "First paragraph.\n\nSecond <b>paragraph</b>.",
      value_text: "£25 off your first treatment",
      code: "WELCOME25",
      cta_label: "Book now",
    });
  });

  it("falls back to 'there' and the default CTA", () => {
    const out = renderOffer(
      { subject: "", headline: "H", body: "B", cta_label: "" },
      {},
      { clinicName: "Aetheria", claimUrl: "https://x" },
    );
    expect(out.subject).toBe("An offer from Aetheria");
    expect(out.text.startsWith("Hi there,")).toBe(true);
    expect(out.card.cta_label).toBe("Claim this offer");
  });
});

describe("links and expiry", () => {
  it("routes the claim link through the portal login", () => {
    expect(offerClaimUrl("https://clinic.test/", "abc")).toBe(
      "https://clinic.test/portal?next=%2Fmy-record%3Foffer%3Dabc",
    );
  });

  it("expires valid_days after send, defaulting to 30", () => {
    expect(offerExpiry("2026-09-24T09:00:00Z", 10)).toBe("2026-10-04T09:00:00.000Z");
    expect(offerExpiry("2026-09-24T09:00:00Z", null)).toBe("2026-10-24T09:00:00.000Z");
  });
});
