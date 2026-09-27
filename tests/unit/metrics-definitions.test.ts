import { describe, expect, it } from "vitest";
import {
  DAY_MS,
  composition,
  countDueStates,
  dueState,
  dueStates,
  firstToSecond,
  nextDueFor,
  visitsByPatient,
} from "@/lib/metrics/definitions";
import { appointmentFlags, isRunningLate, phaseOf } from "@/lib/metrics/appointment-flags";
import { bookedAhead, collectedFor, moneyTotals, shareTotals } from "@/lib/metrics/money";
import { monthBucketsUpToNow, noFutureBuckets, trailingMonthsWindow } from "@/lib/metrics/windows";

const NOW = new Date(2026, 8, 20, 12, 0, 0).getTime(); // 20 Sep 2026, local
const iso = (daysFromNow: number) => new Date(NOW + daysFromNow * DAY_MS).toISOString();
const dateOnly = (daysFromNow: number) => iso(daysFromNow).slice(0, 10);

const patient = { id: "p1", status: "active" };

describe("dueState", () => {
  it("a booked patient is never due, overdue or to chase", () => {
    const visits = [{ patient_id: "p1", performed_at: iso(-400), next_due_at: dateOnly(-300) }];
    expect(dueState({ patient, visits, hasUpcoming: true, nowMs: NOW })).toBe("booked");
  });

  it("overdue has no cut-off, however old the due date", () => {
    const visits = [{ patient_id: "p1", performed_at: iso(-700), next_due_at: dateOnly(-500) }];
    expect(dueState({ patient, visits, hasUpcoming: false, nowMs: NOW })).toBe("overdue");
  });

  it("due soon means within 30 days, from today", () => {
    const soon = [{ patient_id: "p1", performed_at: iso(-60), next_due_at: dateOnly(30) }];
    expect(dueState({ patient, visits: soon, hasUpcoming: false, nowMs: NOW })).toBe("due_soon");
    const later = [{ patient_id: "p1", performed_at: iso(-60), next_due_at: dateOnly(31) }];
    expect(dueState({ patient, visits: later, hasUpcoming: false, nowMs: NOW })).toBe("current");
    const today = [{ patient_id: "p1", performed_at: iso(-60), next_due_at: dateOnly(0) }];
    expect(dueState({ patient, visits: today, hasUpcoming: false, nowMs: NOW })).toBe("due_soon");
  });

  it("uses the due date on the most recent treatment, not the earliest date on file", () => {
    // Finn Thornhurst: an old due date behind a newer visit must not read as overdue.
    const visits = [
      { patient_id: "p1", performed_at: iso(-320), next_due_at: dateOnly(-200) },
      { patient_id: "p1", performed_at: iso(-160), next_due_at: dateOnly(20) },
    ];
    expect(nextDueFor(visits)?.next_due_at).toBe(dateOnly(20));
    expect(dueState({ patient, visits, hasUpcoming: false, nowMs: NOW })).toBe("due_soon");
  });

  it("without a due date, days since the last visit decide lapsing and lost", () => {
    const lapsing = [{ patient_id: "p1", performed_at: iso(-100), next_due_at: null }];
    expect(dueState({ patient, visits: lapsing, hasUpcoming: false, nowMs: NOW })).toBe("lapsing");
    const lost = [{ patient_id: "p1", performed_at: iso(-200), next_due_at: null }];
    expect(dueState({ patient, visits: lost, hasUpcoming: false, nowMs: NOW })).toBe("lost");
    const recent = [{ patient_id: "p1", performed_at: iso(-10), next_due_at: null }];
    expect(dueState({ patient, visits: recent, hasUpcoming: false, nowMs: NOW })).toBe("current");
  });

  it("archived patients and never-treated patients are out of the chase list", () => {
    expect(
      dueState({
        patient: { id: "x", status: "archived" },
        visits: [],
        hasUpcoming: false,
        nowMs: NOW,
      }),
    ).toBe("none");
    expect(dueState({ patient, visits: [], hasUpcoming: false, nowMs: NOW })).toBe("never");
  });

  it("counts add up: treatments due = overdue + due soon; to chase adds lapsing and lost", () => {
    const patients = ["a", "b", "c", "d", "e"].map((id) => ({ id, status: "active" }));
    const treatments = [
      { patient_id: "a", performed_at: iso(-90), next_due_at: dateOnly(-10) }, // overdue
      { patient_id: "b", performed_at: iso(-20), next_due_at: dateOnly(10) }, // due soon
      { patient_id: "c", performed_at: iso(-120), next_due_at: null }, // lapsing
      { patient_id: "d", performed_at: iso(-300), next_due_at: null }, // lost
      { patient_id: "e", performed_at: iso(-90), next_due_at: dateOnly(-10) }, // booked
    ];
    const appointments = [{ patient_id: "e", starts_at: iso(3), status: "booked" }];
    const counts = countDueStates(dueStates({ patients, treatments, appointments, nowMs: NOW }));
    expect(counts).toMatchObject({ overdue: 1, due_soon: 1, lapsing: 1, lost: 1, booked: 1 });
    expect(counts.treatmentsDue).toBe(2);
    expect(counts.toChase).toBe(4);
  });
});

describe("composition and first-to-second", () => {
  it("never / once / two or more always sum to the population, counting visits not treatment types", () => {
    const visits = visitsByPatient([
      { patient_id: "a", performed_at: iso(-30), name: "Peel" },
      { patient_id: "a", performed_at: iso(-10), name: "Peel" }, // same treatment twice = two visits
      { patient_id: "b", performed_at: iso(-5), name: "Filler" },
    ]);
    const mix = composition(["a", "b", "c"], visits);
    expect(mix).toEqual({ never: 1, once: 1, twoPlus: 1, total: 3 });
  });

  it("first-to-second waits for the 180-day horizon and measures the second visit inside it", () => {
    const visits = visitsByPatient([
      { patient_id: "a", performed_at: iso(-300) },
      { patient_id: "a", performed_at: iso(-200) }, // second within 180d: returned
      { patient_id: "b", performed_at: iso(-300) },
      { patient_id: "b", performed_at: iso(-100) }, // second after 200d: not within horizon
      { patient_id: "c", performed_at: iso(-300) }, // never came back
      { patient_id: "d", performed_at: iso(-90) }, // too young to judge: pending
    ]);
    const window = { fromMs: NOW - 365 * DAY_MS, toMs: NOW };
    const r = firstToSecond(visits, window, NOW);
    expect(r.cohort).toBe(3);
    expect(r.returned).toBe(1);
    expect(r.rate).toBe(33);
    expect(r.pending).toBe(1);
  });

  it("an empty cohort has a null rate, never 0%", () => {
    const r = firstToSecond(new Map(), { fromMs: NOW - DAY_MS, toMs: NOW }, NOW);
    expect(r.rate).toBeNull();
  });
});

describe("appointment flags", () => {
  const base = {
    starts_at: iso(2),
    status: "booked",
    stage: "booked",
    documents: { status: "signed" },
  };

  it("an unpaid booking inside the deposit lead window is urgent, further out this week", () => {
    const urgent = appointmentFlags(
      { ...base, payment_status: "unpaid" },
      { nowMs: NOW, depositLeadDays: 3 },
    );
    expect(urgent.flags.has("deposit_due")).toBe(true);
    expect(urgent.depositUrgency).toBe("urgent");
    const later = appointmentFlags(
      { ...base, starts_at: iso(9), payment_status: "unpaid" },
      { nowMs: NOW, depositLeadDays: 3 },
    );
    expect(later.depositUrgency).toBe("this_week");
    const withSevenDayRule = appointmentFlags(
      { ...base, starts_at: iso(6), payment_status: "unpaid" },
      { nowMs: NOW, depositLeadDays: 7 },
    );
    expect(withSevenDayRule.depositUrgency).toBe("urgent");
    // On the day it is simply unpaid; the deposit window has passed.
    const today = appointmentFlags(
      { ...base, starts_at: iso(0), payment_status: "unpaid" },
      { nowMs: NOW, depositLeadDays: 3 },
    );
    expect(today.flags.has("unpaid")).toBe(true);
    expect(today.flags.has("deposit_due")).toBe(false);
    expect(today.depositUrgency).toBeNull();
  });

  it("a deposit-paid booking owes the balance; a signed consent is not due; cancelled bookings carry nothing", () => {
    const f = appointmentFlags(
      { ...base, payment_status: "deposit_paid" },
      { nowMs: NOW, depositLeadDays: 3 },
    );
    expect([...f.flags]).toEqual(["balance_due"]);
    const c = appointmentFlags(
      { ...base, status: "cancelled", payment_status: "unpaid", documents: null },
      { nowMs: NOW, depositLeadDays: 3 },
    );
    expect(c.flags.size).toBe(0);
  });

  it("running late is a booked appointment more than five minutes past its start", () => {
    const start = NOW - 6 * 60 * 1000;
    expect(phaseOf(start, NOW)).toBe("late");
    expect(isRunningLate({ starts_at: new Date(start).toISOString(), stage: "booked" }, NOW)).toBe(
      true,
    );
    expect(isRunningLate({ starts_at: new Date(start).toISOString(), stage: "arrived" }, NOW)).toBe(
      false,
    );
    expect(phaseOf(NOW - 20 * 60 * 1000, NOW)).toBe("overdue");
    expect(phaseOf(NOW + 10 * 60 * 1000, NOW)).toBeNull();
  });

  it("details incomplete is a flag of its own", () => {
    const f = appointmentFlags(
      { ...base, payment_status: "paid", details_incomplete: true },
      { nowMs: NOW, depositLeadDays: 3 },
    );
    expect([...f.flags]).toEqual(["details_incomplete"]);
  });
});

describe("money", () => {
  const appts = new Map([
    ["a1", { id: "a1", starts_at: iso(-10), payment_status: "paid", price: 200 }],
    ["a2", { id: "a2", starts_at: iso(-9), payment_status: "deposit_paid", price: 300 }],
    ["a3", { id: "a3", starts_at: iso(-8), payment_status: "unpaid", price: 100 }],
  ]);
  const treatments = [
    { performed_at: iso(-10), price: 200, appointment_id: "a1" },
    { performed_at: iso(-9), price: 300, appointment_id: "a2" },
    { performed_at: iso(-8), price: 100, appointment_id: "a3" },
  ];

  it("a deposit counts the deposit share; earned = collected + outstanding", () => {
    expect(collectedFor(treatments[1]!, appts.get("a2"), { depositPercent: 30 })).toBe(90);
    const t = moneyTotals(treatments, appts, { depositPercent: 30 });
    expect(t.earned).toBe(600);
    expect(t.collected).toBe(290);
    expect(t.outstanding).toBe(310);
    expect(t.earned).toBe(t.collected + t.outstanding);
  });

  it("the share model applies the snapshot rate per treatment and still reconciles", () => {
    const s = shareTotals(
      [
        { ...treatments[0]!, commission_rate_snapshot: 50 },
        { ...treatments[2]!, commission_rate_snapshot: null },
      ],
      appts,
      40,
      { depositPercent: 30 },
    );
    expect(s.earned).toBe(140); // 200 × 50% + 100 × 40%
    expect(s.collected).toBe(100); // only the paid one
    expect(s.outstanding).toBe(40);
  });

  it("booked ahead is the value of live future bookings only", () => {
    const value = bookedAhead(
      [
        { id: "f1", starts_at: iso(3), status: "booked", price: 150 },
        { id: "f2", starts_at: iso(4), status: "cancelled", price: 999 },
        { id: "f3", starts_at: iso(-1), status: "booked", price: 50 },
      ],
      NOW,
    );
    expect(value).toBe(150);
  });
});

describe("windows", () => {
  it("12 months is a rolling window ending today and its buckets never run past now", () => {
    const w = trailingMonthsWindow(NOW, 12);
    expect(new Date(w.fromMs).getMonth()).toBe(8);
    expect(new Date(w.fromMs).getFullYear()).toBe(2025);
    const buckets = monthBucketsUpToNow(w, NOW);
    expect(buckets.length).toBe(13);
    expect(buckets[buckets.length - 1]!.key).toBe("2026-09");
    expect(noFutureBuckets(buckets, NOW)).toBe(true);
  });
});
