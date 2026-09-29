import { describe, expect, it } from "vitest";
import {
  nextTreatmentState,
  patientType,
  planSegments,
  relativeAgo,
  suggestedNextStep,
  typeLine,
} from "@/lib/patients/records-summary";

const now = new Date("2026-09-29T13:00:00+01:00");
const plan = {
  id: "p1",
  name: "3-Month Microneedling",
  done: 5,
  total: 8,
  nextStep: "Microneedling session 2",
  overdue: false,
};

describe("patientType / typeLine", () => {
  it("plan wins, then new, then regular", () => {
    expect(patientType({ plan, visitCount: 3 })).toBe("skin_plan");
    expect(patientType({ plan: null, visitCount: 0 })).toBe("new");
    expect(patientType({ plan: null, visitCount: 4 })).toBe("regular");
    expect(typeLine("skin_plan", plan, false)).toBe("Skin plan · 5/8");
    expect(typeLine("regular", null, true)).toBe("Regular · Inactive");
    expect(typeLine("new", null, false)).toBe("New patient");
  });
});

describe("relativeAgo", () => {
  it("days, weeks, months, years", () => {
    expect(relativeAgo("2026-09-29T09:00:00+01:00", now)).toBe("Today");
    expect(relativeAgo("2026-09-28T09:00:00+01:00", now)).toBe("Yesterday");
    expect(relativeAgo("2026-09-24T09:00:00+01:00", now)).toBe("5 days ago");
    expect(relativeAgo("2026-08-25T09:00:00+01:00", now)).toBe("5 wks ago");
    expect(relativeAgo("2026-05-27T09:00:00+01:00", now)).toBe("4 months ago");
    expect(relativeAgo("2024-09-01T09:00:00+01:00", now)).toBe("2 years ago");
  });
});

describe("nextTreatmentState", () => {
  it("booked is calm, due inside 14 days is loud, overdue is pink, later is muted", () => {
    const booked = nextTreatmentState(
      {
        nextAppointment: {
          starts_at: "2026-10-23T10:00:00+01:00",
          treatment_name: "Mesotherapy",
          treatment_number: 2,
        },
        nextDue: null,
      },
      now,
    );
    expect(booked).toMatchObject({
      kind: "booked",
      main: "23 Oct · Mesotherapy #2",
      sub: "Booked",
      tone: "calm",
    });

    const due = nextTreatmentState(
      {
        nextAppointment: null,
        nextDue: null,
        planStep: { title: "Microneedling session 2", dueDate: "2026-10-02", overdue: false },
      },
      now,
    );
    expect(due).toMatchObject({
      kind: "due",
      days: 3,
      main: "Due in 3 days",
      sub: "Microneedling session 2 · not booked",
      tone: "loud",
    });

    const overdue = nextTreatmentState(
      {
        nextAppointment: null,
        nextDue: { next_due_at: "2026-06-26T00:00:00Z", name: "LED Light Therapy" },
      },
      now,
    );
    expect(overdue).toMatchObject({
      kind: "overdue",
      days: 95,
      main: "95 days overdue",
      sub: "LED Light Therapy · not booked",
    });

    const soonish = nextTreatmentState(
      { nextAppointment: null, nextDue: { next_due_at: "2026-11-15T00:00:00Z", name: "Profhilo" } },
      now,
    );
    expect(soonish).toMatchObject({ kind: "due", main: "Due 15 Nov", tone: "calm" });

    const later = nextTreatmentState(
      {
        nextAppointment: null,
        nextDue: { next_due_at: "2027-08-26T00:00:00Z", name: "Cheek Filler" },
      },
      now,
    );
    expect(later).toMatchObject({
      kind: "later",
      main: "Due Aug 2027",
      sub: "Cheek Filler",
      tone: "muted",
    });

    expect(nextTreatmentState({ nextAppointment: null, nextDue: null }, now)).toMatchObject({
      kind: "none",
      sub: "Nothing planned",
    });
  });
});

describe("planSegments", () => {
  it("done, current, future; current goes pink when overdue", () => {
    expect(planSegments({ ...plan, done: 2, total: 4 })).toEqual([
      "done",
      "done",
      "current",
      "future",
    ]);
    expect(planSegments({ ...plan, done: 1, total: 3, overdue: true })).toEqual([
      "done",
      "current_overdue",
      "future",
    ]);
  });
});

describe("suggestedNextStep", () => {
  const base = {
    firstName: "Grace",
    pronoun: "She" as const,
    inactive: false,
    type: "skin_plan" as const,
    plan,
    lastTreatment: { name: "Microneedling", at: "2026-09-24T10:00:00+01:00" },
    openTasks: [],
    now,
  };
  it("due soon with an opened link → send link / call", () => {
    const next = nextTreatmentState(
      {
        nextAppointment: null,
        nextDue: null,
        planStep: { title: "Microneedling session 2", dueDate: "2026-10-02", overdue: false },
      },
      now,
    );
    const s = suggestedNextStep({
      ...base,
      next,
      portal: { kind: "opened_link", when: "2026-09-28T18:00:00+01:00" },
    });
    expect(s.text).toBe(
      "Microneedling session 2 is due in 3 days and nothing is booked. She opened the booking link in the portal yesterday but didn't finish.",
    );
    expect(s.actions.map((a) => a.action)).toEqual(["send_booking_link", "call"]);
  });
  it("urgent question beats everything else", () => {
    const next = nextTreatmentState({ nextAppointment: null, nextDue: null }, now);
    const s = suggestedNextStep({
      ...base,
      next,
      openTasks: [{ type: "question", assigneeName: "Dr Tom Whitfield", dueLabel: "3h 22m left" }],
      portal: {
        kind: "urgent_question",
        when: "2026-09-29T12:22:00+01:00",
        preview: "Is redness on day 3 normal?",
      },
    });
    expect(s.text).toContain("“Is redness on day 3 normal?”");
    expect(s.text).toContain("Dr Tom Whitfield has 3h 22m left");
    expect(s.actions[0]).toEqual({ label: "Open question", action: "open_task" });
  });
  it("no-show → call / rebook; inactive → reactivate; booked → all set", () => {
    const next = nextTreatmentState({ nextAppointment: null, nextDue: null }, now);
    // (en-GB short month for September is "Sept" in ICU, so the story uses August here.)
    expect(suggestedNextStep({ ...base, next, noShowAt: "2026-08-24T10:00:00+01:00" }).text).toBe(
      "Missed microneedling session 2 on 24 Aug. A call usually works better after a no-show.",
    );
    expect(suggestedNextStep({ ...base, next, inactive: true }).actions[0]?.action).toBe(
      "reactivate",
    );
    const booked = nextTreatmentState(
      {
        nextAppointment: {
          starts_at: "2026-10-05T10:00:00+01:00",
          treatment_name: "PRP",
          treatment_number: 3,
        },
        nextDue: null,
      },
      now,
    );
    expect(suggestedNextStep({ ...base, next: booked }).text).toBe(
      "All set: PRP #3 is booked for 5 Oct. A reminder goes out automatically 48h before.",
    );
  });
  it("pending offer and later window", () => {
    const overdue = nextTreatmentState(
      {
        nextAppointment: null,
        nextDue: { next_due_at: "2026-06-26T00:00:00Z", name: "LED Light Therapy" },
      },
      now,
    );
    const s = suggestedNextStep({
      ...base,
      type: "regular",
      plan: null,
      next: overdue,
      pendingOffer: { headline: "15% off LED course" },
    });
    expect(s.text).toContain("win-back offer");
    expect(s.actions[0]?.action).toBe("approve_offer");
    const later = nextTreatmentState(
      {
        nextAppointment: null,
        nextDue: { next_due_at: "2027-08-26T00:00:00Z", name: "Cheek Filler" },
      },
      now,
    );
    expect(suggestedNextStep({ ...base, type: "regular", plan: null, next: later }).text).toBe(
      "Next Cheek Filler is due Aug 2027. Nothing to do yet.",
    );
  });
});
