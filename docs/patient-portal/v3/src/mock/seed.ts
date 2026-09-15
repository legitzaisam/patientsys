import type { Appointment, BoardCard, DB, Patient, PerfSeries, PlanStep, Period } from "./types";

/** Deterministic RNG so the 633 generated patients are stable across reloads. */
function lcg(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

export const TREATMENTS = [
  { name: "Anti-Wrinkle Injections", accent: "#aadfca", tint: "#e9f7f2" },
  { name: "Cheek Filler", accent: "#8fc1f2", tint: "#ebf4fe" },
  { name: "Chemical Peel", accent: "#ee8bb3", tint: "#fae7ee" },
  { name: "Lip Filler", accent: "#f2d478", tint: "#fcf6e6" },
  { name: "Microneedling with PRP", accent: "#b9a6e8", tint: "#f2eefe" },
  { name: "Profhilo", accent: "#4f9c74", tint: "#e2f2e9" },
];

const FIRSTS = ["Grace","Jonas","Beatrice","Cara","Patrick","Rosa","Esme","Kirsty","Iris","Imogen","Greta","Olivia","Zara","Rebecca","Hugo","Priya","Nadia","Amelia","Leila","Freya","Theo","Eleanor","Harriet","Daniel","Maya","James","Sophie","Charlotte","Ethan","Emma","Hannah","Lily","Ryan","Chloe","Isla","Lucas","Ella","Nathan","Sam","Oliver"];
const LASTS = ["Adeyemi","Ashbury","Ashcombe","Ashdon","Ashfield","Ashford","Ashham","Ashhurst","Ashley","Ashmore","Ashshaw","Bennett","Haddad","Lindqvist","Berrington","Chandrasekhar","Petrova","Fitzgerald","Farouk","Sundqvist","Nakamura","Whitmore","Blackwood","Kowalski","Patel","O'Connor","Chen","Green","Morris","Reed","Brooks","Wilson","Clarke","Martin","Turner","Grant","Cooper","Gray","Miller","Park"];
const TITLES: Record<string, string> = { f: "Miss", m: "Mr", w: "Mrs", s: "Ms" };

function pad(n: number, w = 2) {
  return String(n).padStart(w, "0");
}

function makePatients(): Patient[] {
  const rnd = lcg(20260913);
  const out: Patient[] = [];
  const seen = new Set<string>();
  let refN = 1263;
  for (let i = 0; i < 633; i++) {
    let first = FIRSTS[Math.floor(rnd() * FIRSTS.length)];
    let last = LASTS[Math.floor(rnd() * LASTS.length)];
    if (i === 0) {
      first = "Grace";
      last = "Adeyemi";
    }
    let key = `${first} ${last}`;
    while (seen.has(key)) {
      first = FIRSTS[Math.floor(rnd() * FIRSTS.length)];
      last = LASTS[Math.floor(rnd() * LASTS.length)];
      key = `${first} ${last}`;
    }
    seen.add(key);
    const t = TREATMENTS[Math.floor(rnd() * TREATMENTS.length)];
    const hasNext = rnd() > 0.55;
    const yr = 1965 + Math.floor(rnd() * 40);
    const titleKeys = Object.keys(TITLES);
    out.push({
      id: i === 0 ? "grace-adeyemi" : `p-${refN + i * 28}`,
      ref: `AV-${refN + i * 28}`,
      title: i === 0 ? "Miss" : TITLES[titleKeys[Math.floor(rnd() * titleKeys.length)]],
      first,
      last,
      dob: i === 0 ? "16/08/1999" : `${pad(1 + Math.floor(rnd() * 28))}/${pad(1 + Math.floor(rnd() * 12))}/${yr}`,
      email: `${first.toLowerCase().replace(/[^a-z]/g, "")}.${last.toLowerCase().replace(/[^a-z]/g, "")}@example.com`,
      phone: `077${pad(Math.floor(rnd() * 100000000), 8)}`,
      status: rnd() > 0.024 ? "Active" : "Inactive",
      lastTreatment: i === 0 ? "Microneedling with PRP" : t.name,
      lastTreatmentDate: i === 0 ? "13/09/2026" : `${pad(1 + Math.floor(rnd() * 28))}/${pad(1 + Math.floor(rnd() * 9))}/2026`,
      nextTreatment: i === 0 ? "Microneedling with PRP #1" : hasNext ? `${t.name} #${1 + Math.floor(rnd() * 6)}` : "No upcoming treatment",
      nextDue: `${pad(1 + Math.floor(rnd() * 28))}/${pad(1 + Math.floor(rnd() * 12))}/${rnd() > 0.3 ? 2026 : 2025}`,
      paperwork: rnd() > 0.12 ? "Complete" : "Outstanding",
      practitionerId: ["dn", "dt", "da"][Math.floor(rnd() * 3)],
      visits: 1 + Math.floor(rnd() * 9),
      avatar: i === 0 ? "/assets/avatar-grace.png" : undefined,
    });
  }
  out.sort((a, b) => (a.last + a.first).localeCompare(b.last + b.first));
  // Grace first for the demo record links.
  const gi = out.findIndex((p) => p.id === "grace-adeyemi");
  const [g] = out.splice(gi, 1);
  out.unshift(g);
  return out;
}

function makeAppointments(): Appointment[] {
  const A = (
    id: string, dayOffset: number, start: number, end: number, patientName: string,
    treatment: string, session: string, practitionerId: string,
    status: Appointment["status"], paid: Appointment["paid"], consent: Appointment["consent"],
  ): Appointment => {
    const t = TREATMENTS.find((x) => x.name === treatment)!;
    return {
      id, dayOffset, start, end, patientName, treatment, session, practitionerId, status, paid, consent,
      patientId: patientName === "Grace Adeyemi" ? "grace-adeyemi" : `by-name-${patientName.toLowerCase().replace(/\s/g, "-")}`,
      accent: t.accent, tint: t.tint,
    };
  };
  return [
    A("a1", 0, 540, 585, "Priya Chandrasekhar", "Chemical Peel", "#4", "dn", "Complete", "Paid", "Consent"),
    A("a2", 0, 570, 630, "Amelia Fitzgerald", "Lip Filler", "#3", "dt", "Complete", "Paid", "Consent"),
    A("a3", 0, 615, 690, "Grace Adeyemi", "Microneedling with PRP", "#3", "dn", "Aftercare", "Deposit paid", "Consent"),
    A("a4", 0, 660, 705, "Leila Farouk", "Lip Filler", "#5", "dt", "Scheduled", "Unpaid", "Consent due"),
    A("a5", 0, 690, 720, "Zara Haddad", "Anti-Wrinkle Injections", "#4", "da", "Scheduled", "Paid", "Consent"),
    A("a6", 0, 780, 825, "Nadia Petrova", "Profhilo", "#6", "dn", "Scheduled", "Paid", "Consent"),
    A("a7", 0, 840, 900, "Rebecca Lindqvist", "Cheek Filler", "#4", "da", "Scheduled", "Paid", "Consent"),
    A("a8", 0, 900, 930, "Olivia Bennett", "Anti-Wrinkle Injections", "#1", "dn", "Scheduled", "Deposit paid", "Consent"),
    A("a9", 0, 930, 975, "Freya Sundqvist", "Chemical Peel", "#1", "dt", "Scheduled", "Unpaid", "Consent due"),
    A("a10", 0, 990, 1020, "Hugo Berrington", "Anti-Wrinkle Injections", "#2", "da", "Scheduled", "Paid", "Consent"),
    // Yesterday / tomorrow so day navigation shows different content.
    A("b1", -1, 570, 615, "Theo Nakamura", "Anti-Wrinkle Injections", "#2", "dn", "Complete", "Paid", "Consent"),
    A("b2", -1, 660, 735, "Eleanor Whitmore", "Cheek Filler", "#4", "dt", "Complete", "Paid", "Consent"),
    A("b3", -1, 840, 885, "Daniel Kowalski", "Profhilo", "#2", "da", "Complete", "Paid", "Consent"),
    A("c1", 1, 540, 600, "Maya Patel", "Chemical Peel", "#2", "dn", "Scheduled", "Deposit paid", "Consent"),
    A("c2", 1, 630, 705, "James O'Connor", "Microneedling with PRP", "#1", "dt", "Scheduled", "Unpaid", "Consent due"),
    A("c3", 1, 810, 855, "Sophie Chen", "Lip Filler", "#2", "da", "Scheduled", "Paid", "Consent"),
  ];
}

const PLAN_STEPS: PlanStep[] = [
  { id: "s1", n: 1, month: 0, status: "done", title: "Consultation & Skin Assessment", date: "5 Sep 2024", desc: "Initial consultation, skin analysis and treatment goals." },
  { id: "s2", n: 2, month: 0, status: "done", title: "Treatment Plan Agreed", date: "5 Sep 2024", desc: "Plan, pricing and consent agreed with your practitioner." },
  { id: "s3", n: 3, month: 0, status: "done", title: "Microneedling Session 1", date: "15 Sep 2024", desc: "First microneedling session with PRP." },
  { id: "s4", n: 4, month: 0, status: "done", title: "Wait 3 Days", date: "18 Sep 2024", desc: "Allow initial healing before starting new products." },
  { id: "s5", n: 5, month: 0, status: "done", title: "Start New Skincare Routine", date: "18 Sep 2024", desc: "Begin the prescribed AM/PM routine." },
  { id: "s6", n: 6, month: 1, status: "done", title: "Daily Skin Health Tasks", date: "Ongoing", desc: "Hydration, SPF and routine adherence tracked daily." },
  {
    id: "s7", n: 7, month: 1, status: "current", title: "Blood Test Check", date: "22 Sep 2024",
    desc: "Check key nutrient levels to support your skin health and treatment results.",
    due: "22 Sep 2024", state: "In progress",
    note: "If vitamin B12 is low, your plan will unlock supplement guidance.",
    checklist: [
      { id: "c1", label: "Book your blood test (GP or private)", done: false },
      { id: "c2", label: "Upload your results", done: false },
      { id: "c3", label: "Clinic to review and confirm next steps", done: false },
    ],
  },
  { id: "s8", n: 8, month: 1, status: "conditional", title: "If Deficient: Start Vitamins", date: "Conditional", desc: "Unlocked automatically if your blood test shows a deficiency." },
  { id: "s9", n: 9, month: 1, status: "upcoming", title: "1 Week Before Session 2 Stop Active Ingredients", date: "20 Sep 2024", desc: "Pause retinoids, acids and exfoliants before your session." },
  { id: "s10", n: 10, month: 1, status: "upcoming", title: "Microneedling Session 2", date: "27 Sep 2024", desc: "Second microneedling session with PRP." },
  { id: "s11", n: 11, month: 2, status: "upcoming", title: "Continue Routine & Healthy Habits", date: "Ongoing", desc: "Keep up the routine while your skin builds collagen." },
  { id: "s12", n: 12, month: 2, status: "upcoming", title: "1 Week Before Session 3 Stop Active Ingredients", date: "18 Oct 2024", desc: "Pause actives again before the final session." },
  { id: "s13", n: 13, month: 2, status: "upcoming", title: "Microneedling Session 3", date: "25 Oct 2024", desc: "Final microneedling session with PRP." },
  { id: "s14", n: 14, month: 2, status: "upcoming", title: "Review & Results", date: "1 Nov 2024", desc: "Final comparison photos, review and maintenance plan." },
];

function series(base: number[], f: number): number[] {
  return base.map((v, i) => Math.round(v * f * (1 + 0.08 * Math.sin(i * 2.1))));
}

function makePerformance(): Record<Period, PerfSeries> {
  const EARN = [1800, 2600, 2200, 3400, 3050, 4100, 3600, 4600, 4200, 3300, 3800, 4400, 3900, 3200, 3600, 4200, 4800, 4100, 3500, 3900, 3400, 2900, 3300, 3700, 3100, 3500, 3900, 3300, 2800, 3200];
  const APPT = [9, 14, 11, 17, 13, 19, 15, 10, 16, 12, 18, 14, 20, 11, 15, 17, 13, 19, 22, 14, 10, 16, 12, 18, 15, 21, 13, 17, 11, 15];
  const ATT = [82, 75, 88, 70, 85, 78, 92, 74, 86, 80, 72, 84, 90, 78, 76, 88, 70, 82, 86, 74, 90, 80, 84, 72, 88, 76, 82, 86, 78, 84];
  const NOSH = [1, 0, 2, 1, 0, 3, 1, 2, 0, 1, 4, 2, 1, 0, 2, 1, 3, 0, 1, 2, 0, 1, 2, 3, 1, 0, 2, 1, 0, 1];
  const mk = (f: number, stats: PerfSeries["stats"]): PerfSeries => ({
    earn: series(EARN, f),
    coll: series(EARN, f * 0.62),
    appt: APPT.map((v) => Math.max(2, Math.round(v * (0.7 + f * 0.3)))),
    att: ATT.map((v) => Math.min(98, Math.round(v * (0.94 + f * 0.06)))),
    nosh: NOSH.map((v, i) => (f < 1 && i % 3 === 0 ? v + 1 : v)),
    stats,
  });
  return {
    month: mk(1, { earned: "£31,925.00", collected: "£15,370.00", toPract: "£13,642.85", retained: "£18,282.15" }),
    lastMonth: mk(0.86, { earned: "£27,410.00", collected: "£14,190.00", toPract: "£11,730.60", retained: "£15,679.40" }),
    year: mk(1.18, { earned: "£342,880.00", collected: "£301,420.00", toPract: "£146,551.00", retained: "£196,329.00" }),
  };
}

const BOARD: Array<[BoardCard["col"], string, string, string, string, string, string, BoardCard["tone"], string, boolean, string]> = [
  [0, "SL", "Sophie Lane", "Acne Programme", "1/7", "Send skincare routine", "Today", "amber", "Consent pending", false, "dn"],
  [0, "JW", "James Wilson", "Pigmentation Plan", "1/6", "Upload baseline photos", "Today", "mint", "On track", false, "dt"],
  [0, "HB", "Hannah Brooks", "Rosacea Management", "1/6", "Book blood test", "Tomorrow", "red", "Blood test pending", true, "da"],
  [0, "MA", "Maya Ali", "Anti-Ageing Plan", "1/6", "Complete medical history", "21 Oct", "mint", "On track", false, "dn"],
  [1, "CG", "Charlotte Green", "Skin Rebalance", "2/8", "Start actives (PM)", "Today", "mint", "On track", false, "dt"],
  [1, "RP", "Ryan Patel", "Acne Programme", "3/8", "Check in on tolerance", "Today", "amber", "Stop actives soon", true, "da"],
  [1, "EM", "Emma Morris", "Pigmentation Plan", "2/8", "Microneedling prep", "Tomorrow", "mint", "On track", false, "dn"],
  [1, "DC", "Daniel Carter", "Skin Rejuvenation", "2/8", "Review skincare routine", "22 Oct", "mint", "On track", false, "dt"],
  [2, "JW", "James Wilson", "Microneedling", "4/8", "Session 2", "Today, 11:00", "mint", "On track", false, "da"],
  [2, "PS", "Priya Shah", "Skin Plan Review", "4/8", "Blood test review", "Today", "red", "Blood test pending", true, "dn"],
  [2, "OL", "Oliver Grant", "B12 Programme", "3/6", "Follow up call", "Tomorrow", "mint", "On track", false, "dt"],
  [2, "LH", "Lily Chen", "Rosacea Management", "4/8", "Adjust actives", "22 Oct", "mint", "On track", true, "da"],
  [3, "SP", "Sophie Park", "Acne Programme", "6/6", "Results review", "", "mint", "Results review", false, "dn"],
  [3, "NG", "Nathan Gray", "Skin Rejuvenation", "6/6", "Final comparison", "Tomorrow", "mint", "On track", false, "dt"],
  [3, "EC", "Ella Cooper", "Pigmentation Plan", "5/6", "Maintenance plan", "23 Oct", "mint", "On track", false, "da"],
  [3, "SM", "Sam Miller", "Anti-Ageing Plan", "6/6", "Discharge & next steps", "24 Oct", "mint", "On track", false, "dn"],
];

export function makeSeed(): DB {
  return {
    version: 3,
    practitioners: [
      { id: "da", initials: "DA", name: "Dr Amara Osei", role: "Clinic Owner", bg: "#dff0e6", fg: "#2e7d5b" },
      { id: "dn", initials: "DN", name: "Dr Nadia Rahman", role: "Aesthetic Practitioner", bg: "#fae9be", fg: "#7a5f18" },
      { id: "dt", initials: "DT", name: "Dr Tom Whitfield", role: "Aesthetic Doctor", bg: "#f2eefe", fg: "#7a5fb8" },
      { id: "sm", initials: "SM", name: "Sofia Marchetti", role: "Front of House", bg: "#fdebf4", fg: "#c2588a" },
    ],
    patients: makePatients(),
    appointments: makeAppointments(),
    planSteps: PLAN_STEPS,
    focusTasks: [
      { id: "f1", label: "Drink 2L water", done: false },
      { id: "f2", label: "Follow AM/PM routine", done: true },
      { id: "f3", label: "Book blood test", done: false },
      { id: "f4", label: "Log any irritation", done: false },
    ],
    gardenTasks: [
      { id: "g1", label: "Hydration", sub: "Aim for 2–3 litres today", done: false },
      { id: "g2", label: "Skincare routine", sub: "AM & PM routine", done: true },
      { id: "g3", label: "Upload lab result", sub: "Blood test due Apr 18, 2024", done: false },
      { id: "g4", label: "Log recovery", sub: "How are you feeling today?", done: false },
    ],
    radiantNotifs: [
      { id: "n1", label: "Appointment reminders", on: true },
      { id: "n2", label: "Lab result reminders", on: true },
      { id: "n3", label: "Skincare routine nudges", on: true },
      { id: "n4", label: "New messages", on: true },
      { id: "n5", label: "Product refill alerts", on: false },
    ],
    dayComplete: false,
    routineDays: { am: 5, pm: 4 },
    sliders: { redness: 30, sensitivity: 55, dryness: 26 },
    prefs: { reminders: true, marketingEmail: false, marketingText: false },
    threads: {
      "grace-adeyemi": [],
      "patient-clinic": [
        { id: "m1", from: "clinic", author: "Dr. Emily Chen", at: "Apr 4, 2024", text: "Your skin is responding beautifully! Keep up with your routine, and don't forget to upload your blood test results when available. We're on track for great progress. 💚" },
      ],
    },
    contactTasks: [
      { id: "t1", initials: "TN", bg: "#fae9be", fg: "#7a5f18", name: "Theo Nakamura", desc: "Consultation only, never converted. Worth one follow-up.", contacted: false },
      { id: "t2", initials: "EW", bg: "#f2eefe", fg: "#7a5fb8", name: "Eleanor Whitmore", desc: "Four months since her cheek filler — worth a personal call.", contacted: false },
      { id: "t3", initials: "HB", bg: "#fdebf4", fg: "#c2588a", name: "Harriet Blackwood", desc: "Eight months since last visit — win-back message.", contacted: false },
    ],
    clinActions: [
      { id: "a1", label: "Check blood test result (GP or private)", done: false },
      { id: "a2", label: "Review skincare routine adherence", done: false },
      { id: "a3", label: "Confirm stop actives before Session 2", done: false },
      { id: "a4", label: "Upload latest photos", done: false },
      { id: "a5", label: "Send pre-appointment message", done: false },
      { id: "a6", label: "Add clinical note", done: false },
      { id: "a7", label: "Mark this stage as reviewed", done: false },
    ],
    prepChecklist: [
      { id: "p1", label: "Consent form completed", meta: "12 Oct 2025", done: true },
      { id: "p2", label: "Stop actives (5 days)", meta: "Confirmed", done: true },
      { id: "p3", label: "B12 blood test result", meta: "Received 18 Oct", done: true },
      { id: "p4", label: "Treatment area photos", meta: "Take now", done: false },
      { id: "p5", label: "Prepare treatment room", meta: "In progress", done: true },
    ],
    atRisk: [
      { id: "r1", initials: "OL", name: "Olivia Bennett", phase: "Treatment 1 of 3", phaseTone: "blue", lastVisit: "22 Aug 2024", nextStep: "Book treatment 2", reason: "No booking (14 days)", action: "Send reminder", sent: false },
      { id: "r2", initials: "ZP", name: "Zara Haddad", phase: "Mid-plan", phaseTone: "mint", lastVisit: "5 Sep 2024", nextStep: "Treatment 3", reason: "Overdue (10 days)", action: "Contact patient", sent: false },
      { id: "r3", initials: "FC", name: "Freya Sundqvist", phase: "Treatment 2 of 4", phaseTone: "blue", lastVisit: "12 Aug 2024", nextStep: "Book treatment 3", reason: "No booking (21 days)", action: "Send reminder", sent: false },
      { id: "r4", initials: "TN", name: "Theo Nakamura", phase: "Consultation", phaseTone: "slate", lastVisit: "3 Sep 2024", nextStep: "Start plan", reason: "No booking (10 days)", action: "Send message", sent: false },
      { id: "r5", initials: "AC", name: "Amelia Fitzgerald", phase: "Mid-plan", phaseTone: "mint", lastVisit: "18 Aug 2024", nextStep: "Treatment 3", reason: "Overdue (12 days)", action: "Contact patient", sent: false },
    ],
    boardCards: BOARD.map((b, i) => ({
      id: `bc-${i}`, col: b[0], initials: b[1], name: b[2], plan: b[3], frac: b[4],
      next: b[5], when: b[6], tone: b[7], label: b[8], atRisk: b[9], practitionerId: b[10],
    })),
    performance: makePerformance(),
    myNotes: [
      "Reorder Profhilo before Friday",
      "Sign off Nadia's job title change",
      "Chase the two outstanding consent forms",
      "Look at why second-visit conversion dipped in the last cohort",
    ],
    clinicNotes: [
      "Follow up all outstanding blood test results.",
      "Check patients are stopping actives 3 days before treatment.",
      "Send aftercare messages to yesterday's patients.",
      "Review before & after photos for September cohort.",
      "Prepare stock for next week's microneedling sessions.",
      "Team meeting at 4pm in treatment room 1.",
    ],
    planNote:
      "Grace is responding well to treatment. Skin texture improving and no adverse reactions. Keep monitoring vitamin D and B12 levels. Encourage consistent home care routine.",
  };
}
