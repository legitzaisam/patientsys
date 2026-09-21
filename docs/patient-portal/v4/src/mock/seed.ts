/**
 * V4 mock data — every string here is taken from the reference mockups in
 * docs/patient-portal/v3/mockups, with the clinic rebranded to Aetheria.
 * The wireframes read exclusively from this file so content can be reshaped
 * without touching layout.
 */

export type Status = "done" | "current" | "upcoming" | "progress";

export const patient = {
  first: "Emma",
  name: "Emma Carter",
  initials: "EM",
  role: "Patient",
  avatar: "/avatars/avatar-emma.png",
  dob: "12 Mar 1990",
  email: "emma.carter@email.com",
  phone: "+61 412 345 678",
  address: ["123 Miller Street", "Melbourne VIC 3000"],
};

export const clinician = {
  name: "Dr. Layla Hassan",
  shortName: "Layla Hassan",
  initials: "LH",
  title: "Dermatology Specialist",
  longTitle: "Consultant Dermatologist",
  avatar: "/avatars/avatar-leila.png",
};

export const clinic = {
  name: "Aetheria Skin Clinic",
  address: ["123 Harley Street", "London W1G 8DJ"],
  phone: "+44 20 7123 4567",
  email: "hello@aetheriaclinic.co.uk",
};

export const plan = {
  name: "3-Month Microneedling Plan",
  strapline: "Smoother texture. Brighter tone. A stronger, healthier you.",
  straplineAlt: "Smoother texture. Brighter tone. A healthier, more confident you.",
  completion: 43,
  milestonesDone: 5,
  milestonesTotal: 12,
  roadmapDone: 3,
  roadmapPct: 25,
  phase: "Session 2 of 3",
  phaseLabel: "Treatment phase",
  day: 12,
  days: 90,
};

export const nextAppointment = {
  weekday: "Mon",
  day: "20",
  monthYear: "Oct 2025",
  date: "20 Oct 2025",
  time: "10:00 AM",
  duration: "10:00 AM (60 mins)",
  treatment: "Microneedling Session 2",
  clinic: clinic.name,
};

export const clinicNews = {
  title: "Introducing our new city clinic",
  body: "We're excited to announce the opening of our new clinic space, designed with your comfort in mind.",
  cta: "Learn more",
  image: "/photos/skin-progress-2.png",
};

export const offer = {
  flag: "LIMITED TIME",
  title: "10% off your next skincare product",
  body: "Support your results with clinic-recommended skincare.",
  cta: "Shop now",
};

export const latestMessage = {
  from: clinician.shortName,
  initials: clinician.initials,
  when: "15 Oct 2025 • 9:24 AM",
  body:
    "Your skin is responding really well to treatment! Remember to pause retinoids, acids and exfoliants 2 days before your next session. Let us know if you have any questions.",
};

export const quickActions = [
  { icon: "doc", label: "Upload a result" },
  { icon: "mail", label: "Message your clinic" },
  { icon: "pen", label: "Complete your daily journal" },
  { icon: "drop", label: "View your skincare routine" },
];

/** Compact six-step track shown on Home. */
export const progressSteps: { label: string; state: Status; note?: string }[] = [
  { label: "Consultation", state: "done" },
  { label: "Skin prep", state: "done" },
  { label: "Session 1", state: "done" },
  { label: "Session 2", state: "current", note: "Current" },
  { label: "Session 3", state: "upcoming", note: "Upcoming" },
  { label: "Final review", state: "upcoming", note: "Upcoming" },
];

/* ------------------------------------------------------------- overview */

export const todayAction = {
  day: "Day 12 of 90",
  title: "Book or upload your B12 blood test result",
  body:
    "Your B12 level helps us ensure the best healing and results. Upload your result or book a test with our partner lab.",
  primary: "Upload result",
  secondary: "Book a blood test",
  tasks: [
    { icon: "person", title: "Complete your daily skincare routine", sub: "AM and PM routine" },
    { icon: "drop", title: "Stay hydrated", sub: "Aim for 2–3 litres of water today" },
  ],
};

export const checkIn = {
  date: "Mon 20 Oct 2025",
  question: "How are you feeling today?",
  rows: [
    { label: "Redness", value: 52, reading: "Mild" },
    { label: "Sensitivity", value: 34, reading: "Moderate" },
    { label: "Dryness", value: 22, reading: "Mild" },
  ],
  noteLink: "Add a note if you're experiencing increased symptoms",
  alert: "Your response suggests higher irritation. Please add a note so we can track this in your journal.",
};

export const beforeAfter = {
  before: { image: "/photos/skin-before-1.png", label: "Before", date: "12 Sep 2025" },
  after: { image: "/photos/skin-after-1.png", label: "After", date: "—" },
  improvements: ["Smoother texture", "More even tone", "Reduced post-acne marks"],
};

export const journeySnapshot = [
  {
    month: "Month 1",
    title: "Foundation",
    steps: [
      { label: "Consultation", done: true },
      { label: "Skin prep & baseline photos", done: true },
      { label: "Microneedling Session 1", done: true },
      { label: "Healing & recovery", done: false },
    ],
  },
  {
    month: "Month 2",
    title: "Build & Support",
    steps: [
      { label: "B12 test & supplement (if needed)", done: false },
      { label: "Microneedling Session 2", done: false },
      { label: "Continue skincare routine", done: false },
      { label: "Track progress photos", done: false },
    ],
  },
  {
    month: "Month 3",
    title: "Results & Confidence",
    steps: [
      { label: "Microneedling Session 3", done: false },
      { label: "Final comparison", done: false },
      { label: "Maintenance plan", done: false },
      { label: "Celebrate your progress ✨", done: false },
    ],
  },
];

export const safeToProceed = {
  blurb: "Complete these steps before your next session.",
  items: [
    { label: "B12 blood test result uploaded", done: true },
    { label: "No active skin infections or cold sores", done: true },
    { label: "Avoid retinol for 5 days before treatment", done: false },
    { label: "Avoid excessive sun exposure", done: false },
    { label: "Feeling well on the day of your appointment", done: true },
  ],
};

/* ------------------------------------------------------------- timeline */

export type Step = {
  id: string;
  icon: string;
  title: string;
  date: string;
  status: Status;
  statusLabel: string;
  detail: string;
  checklist: { label: string; done: boolean; byClinic?: boolean }[];
  guidance: string;
};

export const roadmap: { n: number; month: string; title: string; blurb: string; steps: Step[] }[] = [
  {
    n: 1,
    month: "Month 1",
    title: "Foundation",
    blurb: "Prepare, assess and begin your skin renewal journey.",
    steps: [
      {
        id: "blood-test",
        icon: "drop",
        title: "Blood Test Check",
        date: "15 Oct 2025",
        status: "progress",
        statusLabel: "In progress",
        detail:
          "A quick blood test helps us make sure it's safe for you to proceed with microneedling. Your clinic will review your results and confirm when you're ready for your first session.",
        checklist: [
          { label: "Book your blood test", done: false },
          { label: "Complete blood test", done: false },
          { label: "Results reviewed by clinic", done: false, byClinic: true },
        ],
        guidance:
          "Please complete your blood test at least 3 days before your first treatment. If you have any questions, contact your clinic via Messages.",
      },
      {
        id: "session-1",
        icon: "cal",
        title: "Microneedling Session 1",
        date: "20 Oct 2025",
        status: "upcoming",
        statusLabel: "Upcoming",
        detail:
          "Your first microneedling treatment. Arrive with clean skin and no make-up, and allow 60 minutes for the appointment.",
        checklist: [
          { label: "Pause retinoids 2 days before", done: false },
          { label: "Arrive with clean skin", done: false },
          { label: "Session completed", done: false, byClinic: true },
        ],
        guidance:
          "Avoid active ingredients for 48 hours before your session. Bring your SPF for the journey home.",
      },
      {
        id: "post-care",
        icon: "shield",
        title: "Post-Treatment Care",
        date: "21 Oct 2025",
        status: "upcoming",
        statusLabel: "Upcoming",
        detail:
          "Simple aftercare keeps your skin calm while it renews. Follow the gentle routine for 5 days after your session.",
        checklist: [
          { label: "Use gentle cleanser only", done: false },
          { label: "Apply recovery cream twice daily", done: false },
          { label: "SPF 50 every morning", done: false },
        ],
        guidance: "No exfoliants, retinoids or make-up for 48 hours after your session.",
      },
    ],
  },
  {
    n: 2,
    month: "Month 2",
    title: "Build & Support",
    blurb: "Continue treatment and reinforce your results.",
    steps: [
      {
        id: "session-2",
        icon: "cal",
        title: "Microneedling Session 2",
        date: "12 Nov 2025",
        status: "upcoming",
        statusLabel: "Upcoming",
        detail: "Your second treatment builds on the collagen response from session one.",
        checklist: [
          { label: "Pause retinoids 2 days before", done: false },
          { label: "Progress photos taken", done: false, byClinic: true },
        ],
        guidance: "Keep your routine consistent between sessions for the best results.",
      },
      {
        id: "barrier-check",
        icon: "shield",
        title: "Skin Barrier Support Check",
        date: "19 Nov 2025",
        status: "upcoming",
        statusLabel: "Upcoming",
        detail: "A short check-in to make sure your barrier is healthy before we continue.",
        checklist: [
          { label: "Complete recovery check-in", done: false },
          { label: "Upload progress photo", done: false },
        ],
        guidance: "Log any dryness or irritation in your journal so we can adjust your routine.",
      },
      {
        id: "clinic-review",
        icon: "msg",
        title: "Clinic Review",
        date: "26 Nov 2025",
        status: "upcoming",
        statusLabel: "Upcoming",
        detail: "Your clinician reviews your progress and confirms the plan for month three.",
        checklist: [{ label: "Review completed by clinic", done: false, byClinic: true }],
        guidance: "You'll receive a summary in Messages after the review.",
      },
      {
        id: "home-care",
        icon: "plus",
        title: "At-Home Care Milestone",
        date: "30 Nov 2025",
        status: "upcoming",
        statusLabel: "Upcoming",
        detail: "Celebrate eight weeks of consistent home care — the part that makes results last.",
        checklist: [{ label: "8 weeks of routine logged", done: false }],
        guidance: "Consistency at home is what carries your results between sessions.",
      },
    ],
  },
  {
    n: 3,
    month: "Month 3",
    title: "Results & Confidence",
    blurb: "Complete your plan and assess your progress.",
    steps: [
      {
        id: "session-3",
        icon: "cal",
        title: "Microneedling Session 3",
        date: "10 Dec 2025",
        status: "upcoming",
        statusLabel: "Upcoming",
        detail: "Your final treatment in this plan.",
        checklist: [{ label: "Pause retinoids 2 days before", done: false }],
        guidance: "Same preparation as your previous sessions.",
      },
      {
        id: "final-photos",
        icon: "photo",
        title: "Final Comparison Photos",
        date: "17 Dec 2025",
        status: "upcoming",
        statusLabel: "Upcoming",
        detail: "Before and after photos taken in the same lighting as your baseline set.",
        checklist: [{ label: "Photos taken by clinic", done: false, byClinic: true }],
        guidance: "We'll walk you through the comparison together.",
      },
      {
        id: "review-call",
        icon: "msg",
        title: "Results Review",
        date: "20 Dec 2025",
        status: "upcoming",
        statusLabel: "Upcoming",
        detail: "A conversation about what changed and what to keep doing.",
        checklist: [{ label: "Review booked", done: false }],
        guidance: "Bring any questions about maintenance.",
      },
      {
        id: "maintenance",
        icon: "layers",
        title: "Maintenance Plan",
        date: "22 Dec 2025",
        status: "upcoming",
        statusLabel: "Upcoming",
        detail: "Your personalised plan for keeping these results.",
        checklist: [{ label: "Plan issued by clinic", done: false, byClinic: true }],
        guidance: "Most patients continue with a session every 3–4 months.",
      },
      {
        id: "celebrate",
        icon: "heart",
        title: "Celebrate Your Progress",
        date: "23 Dec 2025",
        status: "upcoming",
        statusLabel: "Upcoming",
        detail: "Look back at how far your skin has come across the full plan.",
        checklist: [{ label: "Share your before and after", done: false }],
        guidance: "You've earned this one.",
      },
    ],
  },
];

export const pauseReasons = [
  "Going on holiday",
  "Medical reason",
  "Cost / budget",
  "Skin is irritated",
  "Other",
];

/* -------------------------------------------------------------- journal */

export const journalFilters = [
  "All",
  "Skincare",
  "Photos",
  "Vitamins",
  "Other appointments",
  "Skin changes",
  "Voice notes",
];

export type JournalEntry = {
  date: string;
  day: number;
  title: string;
  body?: string;
  tag?: { label: string; tone: string };
  photos?: string[];
  voice?: { length: string };
  filters: string[];
};

export const journalMonth = "September 2025";

export const journal: JournalEntry[] = [
  {
    date: "18 Sep 2025",
    day: 18,
    title: "Skincare product change",
    body: "Started using a new gentle cleanser (CeraVe) as recommended by my clinician.",
    tag: { label: "Skincare", tone: "sky" },
    photos: ["/photos/skin-progress-2.png"],
    filters: ["Skincare", "Photos"],
  },
  {
    date: "15 Sep 2025",
    day: 15,
    title: "Microneedling Session 1",
    body: "Felt a little red afterwards but overall good. Skin feels smoother today.",
    photos: ["/photos/skin-before-2.png", "/photos/skin-after-1.png"],
    filters: ["Photos", "Other appointments"],
  },
  {
    date: "12 Sep 2025",
    day: 12,
    title: "Vitamin D",
    body: "Took 1000 IU with breakfast.",
    tag: { label: "Vitamins", tone: "rose" },
    filters: ["Vitamins"],
  },
  {
    date: "10 Sep 2025",
    day: 10,
    title: "Noticed some dryness",
    body: "Skin feels a bit drier around my cheeks. Increased moisturiser and hydration.",
    tag: { label: "Skin change", tone: "butter" },
    photos: ["/photos/skin-before-1.png"],
    filters: ["Skin changes", "Photos"],
  },
  {
    date: "5 Sep 2025",
    day: 5,
    title: "Voice note",
    voice: { length: "0:32" },
    tag: { label: "Voice note", tone: "warning" },
    filters: ["Voice notes"],
  },
];

/* -------------------------------------------------------------- routine */

export type Product = {
  step: string;
  name: string;
  how: string;
  image: string;
};

export const routineBanner = {
  title: "Your Practitioner recommends this skincare routine for you",
  body: "This routine has been created by your care team to support your treatment, skin health and long-term results.",
  quote: "Consistency is key. These products work together to support your skin throughout your treatment journey.",
};

export const morningRoutine: Product[] = [
  {
    step: "Cleanser",
    name: "Aetheria Gentle Cleanser",
    how: "Use a pea-sized amount on damp skin, massage, then rinse.",
    image: "/photos/skin-progress-2.png",
  },
  {
    step: "Antioxidant",
    name: "Aetheria Vitamin C Serum",
    how: "Apply 2–3 drops to clean, dry skin.",
    image: "/photos/skin-after-2.png",
  },
  {
    step: "Moisturiser",
    name: "Aetheria Daily Moisturiser",
    how: "Apply evenly to face and neck.",
    image: "/photos/skin-before-2.png",
  },
  {
    step: "SPF",
    name: "Aetheria Mineral SPF 50",
    how: "Apply generously as the last step. Reapply throughout the day.",
    image: "/photos/skin-after-1.png",
  },
];

export const eveningRoutine: Product[] = [
  {
    step: "Cleanser",
    name: "Aetheria Gentle Cleanser",
    how: "Use a pea-sized amount on damp skin, massage, then rinse.",
    image: "/photos/skin-progress-2.png",
  },
  {
    step: "Treatment",
    name: "Aetheria Retinol+ Serum",
    how: "Apply a pea-sized amount to dry skin (2–3 nights per week).",
    image: "/photos/skin-after-2.png",
  },
  {
    step: "Moisturiser",
    name: "Aetheria Recovery Cream",
    how: "Apply evenly to face and neck.",
    image: "/photos/skin-before-1.png",
  },
  {
    step: "Optional",
    name: "Aetheria Eye Renewal",
    how: "Gently pat a small amount around the eye area.",
    image: "/photos/skin-before-2.png",
  },
];

export const adherence = {
  pct: 71,
  headline: "You're doing great!",
  body: "You've completed your routine on 5 of 7 days this week.",
  morning: { done: 6, of: 7 },
  evening: { done: 5, of: 7 },
};

export const reminder = {
  title: "Time for your evening routine",
  when: "Today at 8:00 PM",
  primary: "Mark as complete",
  secondary: "Snooze for 1 hour",
};

export const skinResponse = {
  headline: "Your skin is showing positive progress",
  body: "You reported less redness and improved texture this week.",
};

export const practitionerNote = {
  date: "Oct 15, 2025",
  body:
    "Your routine is supporting your treatment really well. Keep going with the current plan and let us know if you experience any irritation or have questions.",
};

/* ------------------------------------------------------------- my clinic */

export const upcomingTreatments = [
  { date: "20 Oct 2025 · 10:00 AM", name: "Microneedling Session 2" },
  { date: "1 Nov 2025 · 10:00 AM", name: "Microneedling Session 3" },
];

export const completedTreatments = [
  { date: "15 Sep 2025", name: "Microneedling Session 1" },
  { date: "10 Mar 2025", name: "Chemical Peel" },
];

export const otherClinicHistory = [
  { date: "Jan 2024", treatment: "Lip Filler", clinic: "The Private Clinic, London" },
  { date: "Jun 2023", treatment: "Botox", clinic: "Rejuvenate Aesthetics, Dubai" },
  { date: "Mar 2023", treatment: "Chemical Peel", clinic: "SkinLab, London" },
];

/* --------------------------------------------------------------- records */

export const emergencyContact = {
  name: "James Carter",
  relationship: "Partner",
  phone: "+61 418 765 432",
};

export const medicalHistory = {
  allergies: "Penicillin, pollen (hay fever)",
  medications: "None listed",
  conditions: "Mild eczema",
  note: "Please keep this information up to date so we can provide the safest and most effective care.",
};

export const treatmentHistory = [
  { date: "20 Oct 2025", name: "Microneedling Session 2" },
  { date: "15 Sep 2025", name: "Skin Consultation" },
  { date: "12 Aug 2025", name: "LED Light Therapy" },
  { date: "01 Jul 2025", name: "Microneedling Session 1" },
];

export const labResults = [
  { name: "Skin Analysis Report", date: "20 Oct 2025", icon: "doc" },
  { name: "Progress Photos Analysis", date: "15 Sep 2025", icon: "doc" },
  { name: "Lab Results – Vitamin D", date: "12 Aug 2025", icon: "flask" },
  { name: "Skin Barrier Assessment", date: "01 Jul 2025", icon: "doc" },
];

export const clinicDocuments = [
  { name: "Consent Form – Treatments", meta: "Signed 15 Sep 2025" },
  { name: "Medical Information Questionnaire", meta: "Submitted 15 Sep 2025" },
  { name: "Privacy Policy Acknowledgement", meta: "Signed 01 Jul 2025" },
  { name: "Treatment Aftercare Guide", meta: "Issued 01 Jul 2025" },
];

export const messagesUnread = 2;
export const notificationsUnread = 2;
