import { describe, expect, it } from "vitest";
import {
  checkinStatus,
  dateBlock,
  dayAfterTreatment,
  historyChangeSummary,
  historyFilter,
  isUrgentCheckin,
  journalDayLabel,
  longDate,
  onPlanAppointmentIds,
  planMonths,
  readinessItems,
  recordTabBadges,
  relativeDays,
  shortDate,
  shortDay,
  stepChip,
  stepDateLine,
  stepNeedsBooking,
  treatmentDetailLine,
  treatmentFormChips,
  upNextStep,
  upcomingIssueChips,
  upcomingMeta,
  worstReading,
  type RoadmapMonthLike,
} from "@/lib/patients/record-overview";

// Thursday 1 Oct 2026, 09:00 London.
const now = new Date("2026-10-01T09:00:00+01:00");

const urgentCheckin = {
  checkin_date: "2026-09-30",
  redness: 76,
  sensitivity: 48,
  dryness: 20,
  note: "Cheeks still red",
  reviewed_at: null,
};
const mildCheckin = {
  checkin_date: "2026-09-27",
  redness: 10,
  sensitivity: 12,
  dryness: 8,
  reviewed_at: null,
};

const pendingHistory = {
  id: "h1",
  source: "patient",
  reviewed_at: null,
  created_at: "2026-09-29T10:00:00Z",
  summary: "Patient update",
  data: {
    allergies: "Lidocaine, itchy rash (2019)",
    medications: "Tretinoin 0.025% cream, nightly",
  },
};

const roadmap: RoadmapMonthLike[] = [
  {
    n: 1,
    month: "Month 1",
    title: "Foundation",
    steps: [
      {
        id: "s1",
        title: "Consultation & consent",
        kind: "task",
        status: "done",
        date: "2026-09-02",
      },
      {
        id: "s2",
        title: "Skin assessment & photos",
        kind: "task",
        status: "done",
        date: "2026-09-02",
      },
      {
        id: "s3",
        title: "Microneedling session 1",
        kind: "session",
        status: "done",
        date: "2026-09-18",
      },
    ],
  },
  {
    n: 2,
    month: "Month 2",
    title: "Build & support",
    steps: [
      {
        id: "s4",
        title: "Microneedling with PRP",
        kind: "session",
        status: "done",
        date: "2026-09-26",
      },
      { id: "s5", title: "One-week review", kind: "review", status: "done", date: "2026-10-01" },
      {
        id: "s6",
        title: "Microneedling session 2",
        kind: "session",
        status: "current",
        date: "2026-10-04",
        checklist: [
          { id: "c1", label: "Pause retinoids 2 days before", done: true, byClinic: false },
          { id: "c2", label: "Arrive with clean skin", done: false, byClinic: false },
          { id: "c3", label: "Session confirmed by clinic", done: false, byClinic: true },
        ],
      },
    ],
  },
  {
    n: 3,
    month: "Month 3",
    title: "Results & confidence",
    steps: [
      {
        id: "s7",
        title: "Three-week review",
        kind: "review",
        status: "upcoming",
        date: "2026-10-25",
      },
      {
        id: "s8",
        title: "Maintenance review",
        kind: "review",
        status: "upcoming",
        date: "2026-12-15",
      },
    ],
  },
];

describe("readinessItems", () => {
  const visit = {
    treatment: "Microneedling with PRP",
    startsAt: "2026-10-01T05:45:00+01:00",
    consentState: "signed" as const,
    paymentStatus: "unpaid",
    price: 295,
  };
  const checklist = roadmap[1]!.steps[2]!.checklist!.map((c) => ({
    ...c,
    doneAt: null,
    doneByKind: null,
  }));

  it("orders alert, review, to-do, then done, and counts the clear ones", () => {
    const { items, clear, total } = readinessItems({
      visit,
      checkins: [urgentCheckin, mildCheckin],
      history: [pendingHistory],
      checklist,
      beforePhotos: Array.from({ length: 6 }, () => ({ taken_at: "2026-09-26T10:00:00Z" })),
      now,
    });
    expect(items.map((i) => `${i.tone}:${i.title}`)).toEqual([
      "alert:Recovery check-in flagged",
      "review:Medical history changed",
      "todo:Balance £295",
      "todo:Arrive with clean skin",
      "done:Consent signed",
      "done:Pause retinoids 2 days before",
      "done:Before photos on file",
    ]);
    expect(items[0]!.detail).toBe("Redness severe, 30 Sep · portal");
    expect(items[0]!.link).toBe("portal");
    expect(items[1]!.detail).toBe("Lidocaine allergy, Tretinoin 0.025% · portal");
    expect(items[1]!.link).toBe("history");
    expect(items[2]!.detail).toBe("Not paid");
    expect(items[2]!.link).toBe("payment");
    expect(items.find((i) => i.kind === "photos")!.detail).toBe("6 photos · 26 Sep");
    expect(clear).toBe(3);
    expect(total).toBe(7);
    // Clinic-owned checklist rows belong to Step details, not the hero.
    expect(items.some((i) => i.title === "Session confirmed by clinic")).toBe(false);
  });

  it("turns the money row around once paid and shows a balance after a deposit", () => {
    const paid = readinessItems({
      visit: { ...visit, paymentStatus: "paid" },
      checkins: [],
      history: [],
      checklist: [],
      beforePhotos: [],
      now,
    });
    expect(paid.items.find((i) => i.kind === "payment")).toMatchObject({
      tone: "done",
      title: "Paid £295",
      link: null,
    });
    const deposit = readinessItems({
      visit: { ...visit, paymentStatus: "deposit_paid" },
      checkins: [],
      history: [],
      checklist: [],
      beforePhotos: [],
      now,
    });
    expect(deposit.items.find((i) => i.kind === "payment")).toMatchObject({
      tone: "todo",
      title: "Balance £206.50",
      detail: "Deposit paid",
    });
  });

  it("asks for consent when it is outstanding and offers to send the form", () => {
    const { items } = readinessItems({
      visit: { ...visit, consentState: "outstanding" },
      checkins: [],
      history: [],
      checklist: [],
      beforePhotos: [],
      now,
    });
    expect(items.find((i) => i.kind === "consent")).toMatchObject({
      tone: "review",
      title: "Consent due",
      link: "consent",
    });
  });

  it("reports clear check-ins and reviewed history as done rows, and nothing when there is no data", () => {
    const reviewed = { ...urgentCheckin, reviewed_at: "2026-09-30T20:00:00Z" };
    const { items } = readinessItems({
      visit: null,
      checkins: [reviewed, mildCheckin],
      history: [{ ...pendingHistory, reviewed_at: "2026-09-30T09:00:00Z" }],
      checklist: [],
      beforePhotos: [],
      now,
    });
    expect(items.map((i) => `${i.tone}:${i.kind}`)).toEqual(["done:checkin", "done:history"]);
    expect(
      readinessItems({
        visit: null,
        checkins: [],
        history: [],
        checklist: [],
        beforePhotos: [],
        now,
      }).total,
    ).toBe(0);
  });
});

describe("check-ins", () => {
  it("flags moderate or worse until someone marks it reviewed", () => {
    expect(isUrgentCheckin(urgentCheckin)).toBe(true);
    expect(isUrgentCheckin({ ...urgentCheckin, reviewed_at: "2026-10-01T08:00:00Z" })).toBe(false);
    expect(isUrgentCheckin(mildCheckin)).toBe(false);
    expect(checkinStatus(urgentCheckin)).toBe("open");
    expect(checkinStatus({ ...urgentCheckin, reviewed_at: "x" })).toBe("reviewed");
    expect(checkinStatus(mildCheckin)).toBe("none");
    expect(worstReading(urgentCheckin)).toBe("Redness severe");
    expect(worstReading({ redness: 10, sensitivity: 40, dryness: 20 })).toBe(
      "Sensitivity moderate",
    );
  });

  it("names the day after the latest treatment", () => {
    const treatments = [
      { name: "Microneedling", performed_at: "2026-09-18T10:00:00+01:00" },
      { name: "Microneedling with PRP", performed_at: "2026-09-26T10:00:00+01:00" },
    ];
    expect(dayAfterTreatment("2026-09-30", treatments)).toEqual({
      days: 4,
      treatment: "Microneedling with PRP",
      label: "day 4 after Microneedling with PRP",
    });
    expect(dayAfterTreatment("2026-09-20", treatments)?.treatment).toBe("Microneedling");
    expect(dayAfterTreatment("2026-09-01", treatments)).toBeNull();
  });
});

describe("skin plan", () => {
  it("splits the bar by month and knows which month the plan is in", () => {
    const months = planMonths(roadmap);
    expect(months.current).toBe(2);
    expect(months.total).toBe(3);
    expect(months.months.map((m) => m.steps)).toEqual([
      ["done", "done", "done"],
      ["done", "done", "current"],
      ["upcoming", "upcoming"],
    ]);
  });

  it("numbers the up-next step across every month and reads its checklist", () => {
    expect(upNextStep(roadmap)).toEqual({
      id: "s6",
      index: 6,
      total: 8,
      title: "Microneedling session 2",
      dueDate: "2026-10-04",
      booked: false,
      bookedAt: null,
      needsBooking: true,
      checklistDone: 1,
      checklistTotal: 3,
    });
    const finished = roadmap.map((m) => ({
      ...m,
      steps: m.steps.map((s) => ({ ...s, status: "done" })),
    }));
    expect(upNextStep(finished)).toBeNull();
  });

  it("derives Not booked for a session step without a diary slot", () => {
    const step = roadmap[1]!.steps[2]!;
    expect(stepNeedsBooking(step)).toBe(true);
    expect(stepNeedsBooking({ ...step, bookedAt: "2026-10-04T10:00:00Z" })).toBe(false);
    expect(stepNeedsBooking({ ...step, kind: "review" })).toBe(false);
    expect(stepChip(step)).toEqual({ label: "In progress", tone: "current" });
    expect(stepChip(roadmap[0]!.steps[0]!)).toEqual({ label: "Completed", tone: "done" });
    expect(stepChip({ ...step, status: "skipped" })).toEqual({ label: "Skipped", tone: "done" });
    expect(stepChip(roadmap[2]!.steps[0]!)).toEqual({ label: "Upcoming", tone: "upcoming" });
  });

  it("writes the roadmap row's date line from the step's state", () => {
    const step = roadmap[1]!.steps[2]!;
    expect(stepDateLine(step)).toBe("Due 4 Oct");
    expect(stepDateLine({ ...step, bookedAt: "2026-10-04T10:30:00" })).toBe(
      "Booked Sun 4 Oct · 10:30",
    );
    expect(stepDateLine({ ...step, date: null })).toBe("No date yet");
    expect(stepDateLine({ ...step, status: "done", completedAt: "2026-09-02T09:00:00" })).toBe(
      "Completed 2 Sep",
    );
    expect(stepDateLine({ ...step, status: "skipped", date: "2026-09-18" })).toBe(
      "Completed 18 Sep",
    );
  });

  it("knows which bookings belong to the plan", () => {
    const ids = onPlanAppointmentIds([{ appointment_id: "a1" }, { appointment_id: null }, {}]);
    expect([...ids]).toEqual(["a1"]);
    const upcoming = [
      {
        id: "a1",
        startsAt: "2026-10-20T12:00:00+01:00",
        paymentStatus: "deposit_paid",
        consentSigned: false,
      },
      {
        id: "a2",
        startsAt: "2026-10-24T11:30:00+01:00",
        paymentStatus: "unpaid",
        consentSigned: false,
      },
    ];
    expect(upcomingMeta(upcoming, ids)).toBe("2 booked · 1 on plan");
    expect(upcomingIssueChips(upcoming[0]!).map((c) => c.label)).toEqual([
      "Balance due",
      "Consent due",
    ]);
    expect(upcomingIssueChips(upcoming[1]!).map((c) => c.label)).toEqual([
      "Deposit unpaid",
      "Consent due",
    ]);
    expect(
      upcomingIssueChips({ ...upcoming[1]!, paymentStatus: "paid", consentSigned: true }),
    ).toEqual([]);
  });
});

describe("treatment history", () => {
  const prp = {
    id: "t1",
    name: "Microneedling with PRP",
    area: "Full face",
    product: "Autologous PRP",
    dose: "1.5mm",
    price: 295,
    performed_at: "2026-09-26T10:00:00+01:00",
    next_due_at: "2026-12-25",
    consent_document_id: "d1",
    hasRecord: true,
  };
  const plain = {
    id: "t2",
    name: "Microneedling",
    area: "Full face",
    product: null,
    dose: null,
    price: 220,
    performed_at: "2026-09-18T10:00:00+01:00",
    hasRecord: true,
  };
  const documents = [
    { id: "d1", treatment_id: null, kind: "consent", status: "signed" },
    {
      id: "d2",
      treatment_id: "t1",
      kind: "aftercare",
      status: "sent",
      sent_at: "2026-09-26T12:00:00Z",
    },
    { id: "d3", treatment_id: "t2", kind: "consent", status: "signed" },
  ];
  const photos = Array.from({ length: 6 }, () => ({
    treatment_id: "t1",
    taken_at: "2026-09-26T10:30:00+01:00",
  }));

  it("lists the forms attached and what is missing", () => {
    expect(treatmentFormChips(prp, documents, photos).map((c) => `${c.tone}:${c.label}`)).toEqual([
      "done:✓ Treatment record",
      "done:✓ Consent",
      "done:✓ Aftercare sent",
      "sky:6 photos",
    ]);
    expect(treatmentFormChips(plain, documents, photos).map((c) => `${c.tone}:${c.label}`)).toEqual(
      ["done:✓ Treatment record", "done:✓ Consent", "alert:Depth not recorded"],
    );
  });

  it("writes the detail line the mockup shows", () => {
    expect(treatmentDetailLine(prp)).toBe(
      "Full face · Autologous PRP · 1.5mm depth · £295 · recall 25/12/2026",
    );
    expect(treatmentDetailLine(plain)).toBe("Full face · £220");
  });

  it("filters by PRP and by missing forms", () => {
    const rows = [prp, plain];
    const chipsFor = (t: typeof prp | typeof plain) => treatmentFormChips(t, documents, photos);
    expect(historyFilter(rows, "all", chipsFor)).toHaveLength(2);
    expect(historyFilter(rows, "prp", chipsFor).map((t) => t.id)).toEqual(["t1"]);
    expect(historyFilter(rows, "missing", chipsFor).map((t) => t.id)).toEqual(["t2"]);
  });
});

describe("badges and wording", () => {
  it("counts bookings to chase, urgent check-ins and pending medical updates", () => {
    expect(
      recordTabBadges({
        bookingChase: [{}, {}, {}, {}],
        checkins: [urgentCheckin, mildCheckin],
        history: [pendingHistory, { ...pendingHistory, id: "h2", source: "staff" }],
      }),
    ).toEqual({ treatments: 4, portal: 1, history: 1 });
  });

  it("summarises a pending medical change and relative days", () => {
    expect(historyChangeSummary(pendingHistory)).toBe("Lidocaine allergy, Tretinoin 0.025%");
    expect(historyChangeSummary({ ...pendingHistory, data: null })).toBe("Patient update");
    expect(relativeDays("2026-10-04", now)).toBe("in 3 days");
    expect(relativeDays("2026-10-02", now)).toBe("tomorrow");
    expect(relativeDays("2026-10-01", now)).toBe("today");
    expect(relativeDays("2026-09-29", now)).toBe("2 days ago");
  });

  it("labels a journal entry by the patient's own day count, else days since treatment", () => {
    const treatments = [
      { name: "Microneedling with PRP", performed_at: "2026-09-26T10:00:00+01:00" },
    ];
    expect(
      journalDayLabel({ title: "Day 4", body: "x", entry_date: "2026-09-30" }, treatments),
    ).toBe("Day 4");
    expect(
      journalDayLabel({ title: "Redness", body: "x", entry_date: "2026-09-30" }, treatments),
    ).toBe("Day 4");
    expect(
      journalDayLabel(
        { title: "Before anything", body: "x", entry_date: "2026-09-01" },
        treatments,
      ),
    ).toBe("Before anything");
  });

  it("spells dates the way the mockup does, whatever the ICU data says", () => {
    expect(shortDate("2026-09-30")).toBe("30 Sep");
    expect(shortDate("2026-09-30T19:12:00+01:00")).toBe("30 Sep");
    expect(shortDay("2026-10-04")).toBe("Sun 4 Oct");
    expect(longDate("2026-10-04")).toBe("4 Oct 2026");
    expect(dateBlock("2026-10-20T12:00:00+01:00")).toEqual({ month: "OCT", day: "20" });
    expect(shortDate(null)).toBe("");
  });
});
