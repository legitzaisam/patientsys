import { DEMO_NOW } from "@/lib/demo/enabled";
import { defaultDurationMinutes } from "@/lib/treatment-duration";

/**
 * Deterministic in-memory clinic used by demo mode.
 *
 * Rows mirror the Supabase table shapes so the demo server functions can run the
 * same derivations (retention, earnings) as the real ones. Dates are generated
 * relative to the current day, so the diary and dashboard always look live.
 */

export const CLINIC_ID = "11111111-1111-4111-8111-111111111111";

export const USERS = {
  owner: "10000000-0000-4000-8000-000000000001",
  practitioner: "10000000-0000-4000-8000-000000000002",
  practitioner2: "10000000-0000-4000-8000-000000000003",
  frontDesk: "10000000-0000-4000-8000-000000000004",
  patient: "10000000-0000-4000-8000-000000000005",
  former: "10000000-0000-4000-8000-000000000006",
} as const;

export type DemoRole = "owner" | "practitioner" | "front_desk" | "patient";

export const DEMO_ACCOUNTS: Record<DemoRole, { userId: string; email: string; label: string }> = {
  owner: { userId: USERS.owner, email: "amara.osei@aetheria.clinic", label: "Clinic owner" },
  practitioner: {
    userId: USERS.practitioner,
    email: "nadia.rahman@aetheria.clinic",
    label: "Practitioner",
  },
  front_desk: {
    userId: USERS.frontDesk,
    email: "sofia.marchetti@aetheria.clinic",
    label: "Receptionist",
  },
  patient: { userId: USERS.patient, email: "olivia.bennett@example.com", label: "Patient" },
};

/* ---------------------------------------------------------------- */
/* helpers                                                           */
/* ---------------------------------------------------------------- */

/** Small deterministic PRNG so the dataset is identical on every boot. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260816);

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(rand() * list.length)]!;
}

function between(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

let idCounter = 0;
function id(prefix: string) {
  idCounter += 1;
  const n = String(idCounter).padStart(12, "0");
  return `${prefix}0000-0000-4000-8000-${n}`.slice(0, 36);
}

const NOW = DEMO_NOW ? new Date(DEMO_NOW) : new Date();
const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());
const DAY = 86400000;

/** Local-time date `days` from today, optionally at a given hour/minute. */
function day(offset: number, hour = 0, minute = 0) {
  return new Date(
    TODAY.getFullYear(),
    TODAY.getMonth(),
    TODAY.getDate() + offset,
    hour,
    minute,
    0,
    0,
  );
}

function iso(offset: number, hour = 0, minute = 0) {
  return day(offset, hour, minute).toISOString();
}

function dateOnly(offset: number) {
  const d = day(offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ---------------------------------------------------------------- */
/* clinic, staff, access                                             */
/* ---------------------------------------------------------------- */

export type Row = Record<string, any>;

export const clinic: Row = {
  id: CLINIC_ID,
  name: "Aetheria Medical",
  address: "42 Marylebone High Street, London W1U 5HD",
  phone: "020 7946 0812",
  email: "hello@aetheria.clinic",
  reminder_offsets: [168, 24],
  insights_ingest_key_hash: "5e32b7c1034fe10f127852c3b2b47b1ca9b4fff862a47440a2d79505de198682",
  insights_ingest_key_last4: "ghts",
  created_at: iso(-720),
  updated_at: iso(-14),
};

export { DEMO_INSIGHTS_INGEST_KEY } from "@/lib/insights-constants";

export const profiles: Row[] = [
  {
    id: USERS.owner,
    clinic_id: CLINIC_ID,
    full_name: "Dr Amara Osei",
    job_title: "Clinic Director",
    registration_body: "GMC",
    registration_number: "7412885",
    avatar_url: "/patient-avatars/avatar-priya.png",
    commission_rate: 40,
    created_at: iso(-720),
    updated_at: iso(-30),
  },
  {
    id: USERS.practitioner,
    clinic_id: CLINIC_ID,
    full_name: "Dr Nadia Rahman",
    job_title: "Aesthetic Practitioner",
    registration_body: "NMC",
    registration_number: "18C4471E",
    avatar_url: "/patient-avatars/avatar-emma.png",
    commission_rate: 45,
    created_at: iso(-540),
    updated_at: iso(-21),
  },
  {
    id: USERS.practitioner2,
    clinic_id: CLINIC_ID,
    full_name: "Dr Tom Whitfield",
    job_title: "Aesthetic Doctor",
    registration_body: "GMC",
    registration_number: "7719034",
    avatar_url: "/patient-avatars/avatar-theo.png",
    commission_rate: 42,
    created_at: iso(-400),
    updated_at: iso(-60),
  },
  {
    id: USERS.frontDesk,
    clinic_id: CLINIC_ID,
    full_name: "Sofia Marchetti",
    job_title: "Patient Coordinator",
    registration_body: null,
    registration_number: null,
    avatar_url: "/patient-avatars/avatar-grace.png",
    commission_rate: 0,
    created_at: iso(-300),
    updated_at: iso(-45),
  },
  {
    id: USERS.former,
    clinic_id: CLINIC_ID,
    full_name: "Dr Helen Cho",
    job_title: "Aesthetic Practitioner",
    registration_body: "GMC",
    registration_number: "7018821",
    avatar_url: "/patient-avatars/avatar-leila.png",
    commission_rate: 40,
    created_at: iso(-500),
    updated_at: iso(-21),
  },
];

export const userRoles: Row[] = [
  { id: id("a1"), user_id: USERS.owner, role: "owner", created_at: iso(-720) },
  { id: id("a1"), user_id: USERS.practitioner, role: "practitioner", created_at: iso(-540) },
  { id: id("a1"), user_id: USERS.practitioner2, role: "practitioner", created_at: iso(-400) },
  { id: id("a1"), user_id: USERS.frontDesk, role: "front_desk", created_at: iso(-300) },
  { id: id("a1"), user_id: USERS.patient, role: "patient", created_at: iso(-200) },
];

export const staffEmails: Record<string, string> = {
  [USERS.owner]: "amara.osei@aetheria.clinic",
  [USERS.practitioner]: "nadia.rahman@aetheria.clinic",
  [USERS.practitioner2]: "tom.whitfield@aetheria.clinic",
  [USERS.frontDesk]: "sofia.marchetti@aetheria.clinic",
};

export const rolePermissions: Row[] = [
  { role: "manager", permission: "reports.insights", enabled: true },
  { role: "manager", permission: "reports.retention", enabled: true },
  { role: "manager", permission: "reports.performance", enabled: true },
  { role: "manager", permission: "team.view", enabled: true },
  { role: "manager", permission: "team.approve_changes", enabled: true },
  { role: "manager", permission: "settings.treatments", enabled: true },
  { role: "manager", permission: "notifications.delete", enabled: true },
  { role: "manager", permission: "tasks.delete", enabled: true },
  { role: "manager", permission: "patients.edit", enabled: true },
  { role: "manager", permission: "treatments.record", enabled: true },
  { role: "manager", permission: "documents.send", enabled: true },
  { role: "manager", permission: "photos.manage", enabled: true },
  { role: "manager", permission: "appointments.edit", enabled: true },
  { role: "manager", permission: "comms.send", enabled: true },
  { role: "practitioner", permission: "reports.insights", enabled: false },
  { role: "practitioner", permission: "reports.retention", enabled: true },
  { role: "practitioner", permission: "reports.performance", enabled: false },
  { role: "practitioner", permission: "team.view", enabled: true },
  { role: "practitioner", permission: "team.approve_changes", enabled: false },
  { role: "practitioner", permission: "settings.treatments", enabled: false },
  { role: "practitioner", permission: "notifications.delete", enabled: true },
  { role: "practitioner", permission: "tasks.delete", enabled: false },
  { role: "practitioner", permission: "patients.edit", enabled: true },
  { role: "practitioner", permission: "treatments.record", enabled: true },
  { role: "practitioner", permission: "documents.send", enabled: true },
  { role: "practitioner", permission: "photos.manage", enabled: true },
  { role: "practitioner", permission: "appointments.edit", enabled: true },
  { role: "practitioner", permission: "comms.send", enabled: true },
  { role: "front_desk", permission: "reports.insights", enabled: true },
  { role: "front_desk", permission: "reports.retention", enabled: true },
  { role: "front_desk", permission: "reports.performance", enabled: false },
  { role: "front_desk", permission: "team.view", enabled: true },
  { role: "front_desk", permission: "team.approve_changes", enabled: false },
  { role: "front_desk", permission: "settings.treatments", enabled: true },
  { role: "front_desk", permission: "notifications.delete", enabled: false },
  { role: "front_desk", permission: "tasks.delete", enabled: false },
  { role: "front_desk", permission: "patients.edit", enabled: true },
  // Front desk books and takes payment but does not write the clinical record.
  { role: "front_desk", permission: "treatments.record", enabled: false },
  { role: "front_desk", permission: "documents.send", enabled: true },
  { role: "front_desk", permission: "photos.manage", enabled: false },
  { role: "front_desk", permission: "appointments.edit", enabled: true },
  { role: "front_desk", permission: "comms.send", enabled: true },
].map((r) => ({ ...r, id: id("b1"), updated_by: USERS.owner, updated_at: iso(-12) }));

/* ---------------------------------------------------------------- */
/* treatment catalogue                                               */
/* ---------------------------------------------------------------- */

type CatalogueSpec = {
  name: string;
  category: string;
  price: number;
  interval: number | null;
  consent: boolean;
  active?: boolean;
  description: string;
};

const CATALOGUE_SPECS: CatalogueSpec[] = [
  {
    name: "Anti-Wrinkle Injections",
    category: "Injectables",
    price: 275,
    interval: 120,
    consent: true,
    description: "Three areas, botulinum toxin type A. Review at two weeks.",
  },
  {
    name: "Lip Filler",
    category: "Injectables",
    price: 320,
    interval: 270,
    consent: true,
    description: "0.5–1ml hyaluronic acid, cannula technique.",
  },
  {
    name: "Cheek Filler",
    category: "Injectables",
    price: 450,
    interval: 365,
    consent: true,
    description: "Midface volumisation, 1–2ml.",
  },
  {
    name: "Profhilo",
    category: "Skin Boosters",
    price: 350,
    interval: 180,
    consent: true,
    description: "Two-session bio-remodelling course, four weeks apart.",
  },
  {
    name: "Microneedling with PRP",
    category: "Skin",
    price: 295,
    interval: 90,
    consent: true,
    description: "Collagen induction with platelet-rich plasma.",
  },
  {
    name: "Chemical Peel",
    category: "Skin",
    price: 150,
    interval: 60,
    consent: true,
    description: "Medium-depth resurfacing peel.",
  },
  {
    name: "Skin Consultation",
    category: "Consultation",
    price: 50,
    interval: null,
    consent: false,
    description: "Thirty minute assessment and treatment plan.",
  },
  {
    name: "Jawline Filler",
    category: "Injectables",
    price: 480,
    interval: 365,
    consent: true,
    description: "Mandibular contouring, 1–2ml hyaluronic acid.",
  },
  {
    name: "Polynucleotides",
    category: "Skin Boosters",
    price: 380,
    interval: 90,
    consent: true,
    description: "Salmon-DNA biostimulator course, three sessions.",
  },
  {
    name: "Hydrafacial",
    category: "Skin",
    price: 165,
    interval: 28,
    consent: false,
    description: "Medical-grade cleanse, extract and hydrate.",
  },
  {
    name: "Laser Hair Removal",
    category: "Laser",
    price: 180,
    interval: 42,
    consent: true,
    description: "Course of six, Nd:YAG.",
  },
  {
    name: "Vitamin B12 Injection",
    category: "Wellness",
    price: 45,
    interval: 30,
    consent: false,
    active: false,
    description: "Discontinued — no longer offered.",
  },
];

export const catalogue: Row[] = CATALOGUE_SPECS.map((spec) => ({
  id: id("c1"),
  clinic_id: CLINIC_ID,
  name: spec.name,
  category: spec.category,
  description: spec.description,
  price: spec.price,
  interval_days: spec.interval,
  duration_minutes: defaultDurationMinutes(spec.name),
  cooling_off_hours: spec.consent ? 48 : 0,
  requires_consent: spec.consent,
  active: spec.active ?? true,
  created_at: iso(-700),
  updated_at: iso(-40),
}));

const catalogueByName = new Map(catalogue.map((c) => [c["name"] as string, c]));
const activeCatalogue = catalogue.filter((c) => c["active"]);

/* ---------------------------------------------------------------- */
/* patients                                                          */
/* ---------------------------------------------------------------- */

type PatientSpec = {
  title: string | null;
  first: string;
  last: string;
  dob: string;
  /** Days since the patient record was created. */
  joined: number;
  /** Days since their most recent treatment. */
  lastVisit: number;
  /** Number of treatments on file. */
  visits: number;
  practitioner: string;
  favourite: string;
  status?: "active" | "inactive" | "archived";
  /** Days ahead for a future booking, when they have one. */
  upcoming?: number;
  allergies?: string;
  medications?: string;
  conditions?: string;
  source?: "website" | "instagram" | "referral" | "walk_in" | "other";
};

const PATIENT_SPECS: PatientSpec[] = [
  {
    title: "Ms",
    first: "Olivia",
    last: "Bennett",
    dob: "1989-04-12",
    joined: 640,
    lastVisit: 21,
    visits: 9,
    practitioner: USERS.practitioner,
    favourite: "Anti-Wrinkle Injections",
    upcoming: 12,
    allergies: "Penicillin",
    medications: "None",
    conditions: "Mild rosacea",
    source: "instagram",
  },
  {
    title: "Mrs",
    first: "Charlotte",
    last: "Hargreaves",
    dob: "1976-11-03",
    joined: 700,
    lastVisit: 34,
    visits: 12,
    practitioner: USERS.practitioner,
    favourite: "Profhilo",
    upcoming: 6,
    allergies: "None known",
    medications: "Levothyroxine",
  },
  {
    title: "Miss",
    first: "Amelia",
    last: "Fitzgerald",
    dob: "1994-07-22",
    joined: 420,
    lastVisit: 8,
    visits: 6,
    practitioner: USERS.practitioner2,
    favourite: "Lip Filler",
    upcoming: 0,
    allergies: "Lidocaine sensitivity",
  },
  {
    title: "Mr",
    first: "James",
    last: "Okonkwo",
    dob: "1985-01-30",
    joined: 520,
    lastVisit: 55,
    visits: 7,
    practitioner: USERS.practitioner2,
    favourite: "Microneedling with PRP",
  },
  {
    title: "Ms",
    first: "Priya",
    last: "Chandrasekhar",
    dob: "1991-09-14",
    joined: 380,
    lastVisit: 3,
    visits: 5,
    practitioner: USERS.practitioner,
    favourite: "Chemical Peel",
    upcoming: 28,
  },
  {
    title: "Mrs",
    first: "Eleanor",
    last: "Whitmore",
    dob: "1968-02-19",
    joined: 730,
    lastVisit: 132,
    visits: 11,
    practitioner: USERS.owner,
    favourite: "Cheek Filler",
    conditions: "Type 2 diabetes",
  },
  {
    title: "Ms",
    first: "Zara",
    last: "Haddad",
    dob: "1997-12-05",
    joined: 240,
    lastVisit: 14,
    visits: 4,
    practitioner: USERS.practitioner,
    favourite: "Lip Filler",
    upcoming: 3,
  },
  {
    title: "Mr",
    first: "Daniel",
    last: "Kowalski",
    dob: "1982-06-27",
    joined: 610,
    lastVisit: 215,
    visits: 5,
    practitioner: USERS.practitioner2,
    favourite: "Anti-Wrinkle Injections",
    status: "inactive",
  },
  {
    title: "Mrs",
    first: "Fiona",
    last: "MacGregor",
    dob: "1973-03-08",
    joined: 690,
    lastVisit: 96,
    visits: 10,
    practitioner: USERS.owner,
    favourite: "Profhilo",
    allergies: "Latex",
  },
  {
    title: "Miss",
    first: "Grace",
    last: "Adeyemi",
    dob: "1999-08-16",
    joined: 180,
    lastVisit: 5,
    visits: 3,
    practitioner: USERS.practitioner,
    favourite: "Microneedling with PRP",
    upcoming: 19,
  },
  {
    title: "Ms",
    first: "Isabella",
    last: "Rossi",
    dob: "1987-05-21",
    joined: 460,
    lastVisit: 71,
    visits: 8,
    practitioner: USERS.practitioner2,
    favourite: "Anti-Wrinkle Injections",
  },
  {
    title: "Mr",
    first: "Oliver",
    last: "Ashworth",
    dob: "1979-10-11",
    joined: 550,
    lastVisit: 148,
    visits: 6,
    practitioner: USERS.owner,
    favourite: "Chemical Peel",
  },
  {
    title: "Mrs",
    first: "Harriet",
    last: "Blackwood",
    dob: "1965-12-30",
    joined: 720,
    lastVisit: 245,
    visits: 9,
    practitioner: USERS.practitioner,
    favourite: "Cheek Filler",
    status: "inactive",
    medications: "Amlodipine",
  },
  {
    title: "Ms",
    first: "Nadia",
    last: "Petrova",
    dob: "1993-02-25",
    joined: 330,
    lastVisit: 11,
    visits: 5,
    practitioner: USERS.practitioner2,
    favourite: "Lip Filler",
    upcoming: 9,
  },
  {
    title: "Miss",
    first: "Sienna",
    last: "Clarke",
    dob: "1996-06-09",
    joined: 290,
    lastVisit: 41,
    visits: 4,
    practitioner: USERS.practitioner,
    favourite: "Laser Hair Removal",
  },
  {
    title: "Mr",
    first: "Marcus",
    last: "Delaney",
    dob: "1984-04-03",
    joined: 480,
    lastVisit: 102,
    visits: 6,
    practitioner: USERS.practitioner2,
    favourite: "Microneedling with PRP",
  },
  {
    title: "Mrs",
    first: "Rebecca",
    last: "Lindqvist",
    dob: "1971-07-18",
    joined: 660,
    lastVisit: 26,
    visits: 13,
    practitioner: USERS.owner,
    favourite: "Profhilo",
    upcoming: 15,
  },
  {
    title: "Ms",
    first: "Aisha",
    last: "Bello",
    dob: "1990-11-27",
    joined: 400,
    lastVisit: 63,
    visits: 7,
    practitioner: USERS.practitioner,
    favourite: "Anti-Wrinkle Injections",
    allergies: "Aspirin",
  },
  {
    title: "Miss",
    first: "Freya",
    last: "Sundqvist",
    dob: "1998-03-14",
    joined: 150,
    lastVisit: 19,
    visits: 2,
    practitioner: USERS.practitioner2,
    favourite: "Chemical Peel",
  },
  {
    title: "Mr",
    first: "Theo",
    last: "Nakamura",
    dob: "1988-09-02",
    joined: 510,
    lastVisit: 188,
    visits: 4,
    practitioner: USERS.practitioner,
    favourite: "Skin Consultation",
  },
  {
    title: "Mrs",
    first: "Camille",
    last: "Dubois",
    dob: "1974-01-23",
    joined: 640,
    lastVisit: 47,
    visits: 10,
    practitioner: USERS.owner,
    favourite: "Cheek Filler",
  },
  {
    title: "Ms",
    first: "Leila",
    last: "Farouk",
    dob: "1992-05-06",
    joined: 350,
    lastVisit: 7,
    visits: 6,
    practitioner: USERS.practitioner2,
    favourite: "Lip Filler",
    upcoming: 21,
  },
  {
    title: "Miss",
    first: "Poppy",
    last: "Trevelyan",
    dob: "1995-10-19",
    joined: 270,
    lastVisit: 118,
    visits: 3,
    practitioner: USERS.practitioner,
    favourite: "Laser Hair Removal",
  },
  {
    title: "Mr",
    first: "Hugo",
    last: "Berrington",
    dob: "1981-08-28",
    joined: 590,
    lastVisit: 33,
    visits: 8,
    practitioner: USERS.owner,
    favourite: "Anti-Wrinkle Injections",
    conditions: "Hypertension",
  },
  {
    title: "Ms",
    first: "Maya",
    last: "Srinivasan",
    dob: "1986-12-12",
    joined: 430,
    lastVisit: 265,
    visits: 5,
    practitioner: USERS.practitioner2,
    favourite: "Profhilo",
  },
  {
    title: "Mrs",
    first: "Beatrice",
    last: "Ashcombe",
    dob: "1969-06-15",
    joined: 710,
    lastVisit: 88,
    visits: 12,
    practitioner: USERS.practitioner,
    favourite: "Cheek Filler",
    medications: "Atorvastatin",
  },
  {
    title: "Miss",
    first: "Tilly",
    last: "Rowntree",
    dob: "2000-02-08",
    joined: 95,
    lastVisit: 30,
    visits: 2,
    practitioner: USERS.practitioner2,
    favourite: "Chemical Peel",
  },
  {
    title: "Mr",
    first: "Sebastian",
    last: "Ivanov",
    dob: "1983-11-11",
    joined: 470,
    lastVisit: 155,
    visits: 5,
    practitioner: USERS.owner,
    favourite: "Microneedling with PRP",
  },
  // Consultation-only enquiries that never converted — these keep the cohort
  // and "one visit only" figures honest.
  {
    title: "Ms",
    first: "Erin",
    last: "Callaghan",
    dob: "1990-03-17",
    joined: 310,
    lastVisit: 308,
    visits: 1,
    practitioner: USERS.practitioner,
    favourite: "Skin Consultation",
    status: "inactive",
  },
  {
    title: "Mr",
    first: "Rafael",
    last: "Moreno",
    dob: "1987-07-04",
    joined: 220,
    lastVisit: 218,
    visits: 1,
    practitioner: USERS.practitioner2,
    favourite: "Skin Consultation",
  },
  {
    title: "Miss",
    first: "Anouk",
    last: "Vermeulen",
    dob: "1994-09-29",
    joined: 140,
    lastVisit: 138,
    visits: 1,
    practitioner: USERS.owner,
    favourite: "Chemical Peel",
  },
  {
    title: "Mrs",
    first: "Ingrid",
    last: "Halvorsen",
    dob: "1978-05-13",
    joined: 62,
    lastVisit: 60,
    visits: 1,
    practitioner: USERS.practitioner,
    favourite: "Anti-Wrinkle Injections",
  },
  {
    title: "Ms",
    first: "Bianca",
    last: "Costa",
    dob: "1992-01-26",
    joined: 34,
    lastVisit: 32,
    visits: 1,
    practitioner: USERS.practitioner2,
    favourite: "Lip Filler",
    upcoming: 24,
  },
];

// The named specs above carry the detailed stories. A wider roster of routine
// patients is generated behind them so list views, reports and the diary have
// the density of a real book without inventing implausible return intervals.
const FILLER_FIRST = [
  "Alice",
  "Bethan",
  "Cara",
  "Dominic",
  "Elise",
  "Farrah",
  "Gabriel",
  "Hannah",
  "Imogen",
  "Jonas",
  "Kirsty",
  "Lucas",
  "Martha",
  "Niamh",
  "Orla",
  "Patrick",
  "Quinn",
  "Rosa",
  "Simon",
  "Tara",
  "Ursula",
  "Victor",
  "Willow",
  "Xanthe",
  "Yasmin",
  "Zach",
  "Adele",
  "Bruno",
  "Clara",
  "Declan",
  "Esme",
  "Finn",
  "Greta",
  "Henry",
  "Iris",
  "Jed",
  "Kayla",
  "Leo",
  "Mina",
  "Noor",
];
// Surnames are composed from stems and endings so a 600-strong list does not
// repeat the same dozen names down the patient table.
const NAME_STEMS = [
  "Ash",
  "Brad",
  "Cald",
  "Dun",
  "Fair",
  "Green",
  "Hal",
  "Ing",
  "Kes",
  "Lang",
  "Mar",
  "Nor",
  "Oak",
  "Pem",
  "Rad",
  "Sand",
  "Thorn",
  "Under",
  "Wex",
  "Yar",
  "Black",
  "Brook",
  "Chad",
  "Dray",
  "East",
  "Fen",
  "Gars",
  "Hather",
  "Kirk",
  "Lynd",
  "Med",
  "Nether",
  "Orms",
  "Pres",
  "Ravens",
  "Ship",
  "Tarn",
  "Wold",
  "Whit",
  "Wyn",
];
const NAME_ENDINGS = [
  "bury",
  "combe",
  "don",
  "field",
  "ford",
  "ham",
  "hurst",
  "ley",
  "more",
  "stone",
  "ton",
  "well",
  "wick",
  "worth",
  "shaw",
  "brook",
  "dale",
  "gate",
  "land",
  "ridge",
];
const TITLES_F = ["Ms", "Mrs", "Miss"];
const TITLES_M = ["Mr"];
const MALE = new Set([
  "Dominic",
  "Gabriel",
  "Jonas",
  "Lucas",
  "Patrick",
  "Simon",
  "Victor",
  "Zach",
  "Bruno",
  "Declan",
  "Finn",
  "Henry",
  "Jed",
  "Leo",
]);

for (let i = 0; i < 600; i++) {
  const first = pick(FILLER_FIRST);
  const last =
    NAME_STEMS[i % NAME_STEMS.length]! +
    NAME_ENDINGS[Math.floor(i / NAME_STEMS.length) % NAME_ENDINGS.length]!;
  // A slice of the roster registered in the last few weeks so the new-patient
  // and cohort figures move rather than reading as a closed book.
  const joined = between(6, 700);
  // Most of an active clinic's list has been seen recently; the tail is the
  // lapsed cohort the retention report is there to surface.
  const recency = rand() > 0.32 ? between(3, 95) : between(96, 330);
  const lastVisit = Math.min(recency, Math.max(2, joined - 3));
  const visits = Math.max(
    1,
    Math.min(11, Math.round((joined - lastVisit) / between(80, 160)) + between(0, 2)),
  );
  const item = pick(CATALOGUE_SPECS.filter((c) => c.active !== false));
  const upcoming = rand() > 0.72 ? between(2, 30) : 0;
  PATIENT_SPECS.push({
    title: MALE.has(first) ? pick(TITLES_M) : pick(TITLES_F),
    first,
    last,
    dob: `${between(1962, 2001)}-${String(between(1, 12)).padStart(2, "0")}-${String(between(1, 28)).padStart(2, "0")}`,
    joined,
    lastVisit,
    visits,
    practitioner: pick([
      USERS.owner,
      USERS.practitioner,
      USERS.practitioner,
      USERS.practitioner2,
      USERS.practitioner2,
    ]),
    favourite: item.name,
    status: lastVisit > 300 ? "inactive" : "active",
    source: i % 7 === 0 ? "website" : i % 11 === 0 ? "instagram" : i % 5 === 0 ? "referral" : i % 13 === 0 ? "other" : "walk_in",
    ...(upcoming ? { upcoming } : {}),
  });
}

const INSIGHTS_SPECS: Array<
  Pick<PatientSpec, "title" | "first" | "last" | "joined" | "visits" | "source"> & {
    favourite?: string;
    lastVisit?: number;
  }
> = [
  { title: "Ms", first: "Isla", last: "Hartley", joined: 11, visits: 0, source: "website" },
  { title: "Mrs", first: "Maya", last: "Quayle", joined: 18, visits: 0, source: "website" },
  { title: "Ms", first: "Noor", last: "El-Amin", joined: 6, visits: 0, source: "instagram" },
  { title: "Mr", first: "Theo", last: "Langford", joined: 22, visits: 0, source: "website" },
  { title: "Ms", first: "Freya", last: "Nielsen", joined: 28, visits: 1, lastVisit: 16, source: "website", favourite: "Skin Consultation" },
  { title: "Mrs", first: "Aisha", last: "Rahman", joined: 34, visits: 1, lastVisit: 21, source: "website", favourite: "Skin Consultation" },
  { title: "Ms", first: "Bea", last: "Moreau", joined: 19, visits: 1, lastVisit: 9, source: "referral", favourite: "Skin Consultation" },
  { title: "Mr", first: "Callum", last: "West", joined: 40, visits: 2, lastVisit: 12, source: "website", favourite: "Anti-Wrinkle Injections" },
];

for (const extra of INSIGHTS_SPECS) {
  PATIENT_SPECS.push({
    title: extra.title,
    first: extra.first,
    last: extra.last,
    dob: `${between(1978, 1999)}-${String(between(1, 12)).padStart(2, "0")}-${String(between(1, 28)).padStart(2, "0")}`,
    joined: extra.joined,
    lastVisit: extra.lastVisit ?? extra.joined,
    visits: extra.visits,
    practitioner: USERS.practitioner,
    favourite: extra.favourite ?? "Skin Consultation",
    status: "active",
    source: extra.source,
  });
}

export const patients: Row[] = PATIENT_SPECS.map((spec, index) => ({
  id: id("d1"),
  clinic_id: CLINIC_ID,
  user_id: index === 0 ? USERS.patient : null,
  reference: `AV-${1200 + index * 7}`,
  title: spec.title,
  first_name: spec.first,
  last_name: spec.last,
  date_of_birth: spec.dob,
  email: `${spec.first.toLowerCase()}.${spec.last.toLowerCase()}@example.com`,
  phone: `07${between(700, 999)} ${between(100000, 999999)}`,
  status: spec.status ?? "active",
  allergies: spec.allergies ?? "None known",
  medications: spec.medications ?? "None",
  conditions: spec.conditions ?? null,
  notes: null,
  avatar_url: null,
  last_visit_at: spec.visits === 0 ? null : iso(-spec.lastVisit, 11, 0),
  source:
    spec.source ??
    (index % 7 === 0 ? "website" : index % 11 === 0 ? "instagram" : index % 5 === 0 ? "referral" : "walk_in"),
  email_opt_in: false,
  sms_opt_in: false,
  reminders_opt_in: true,
  marketing_opt_in: false,
  unsubscribed_at: null,
  created_at: iso(-spec.joined, 10, 0),
  updated_at: iso(-spec.lastVisit, 11, 0),
}));

const patientSpecById = new Map(patients.map((p, i) => [p["id"] as string, PATIENT_SPECS[i]!]));

/* ---------------------------------------------------------------- */
/* treatments                                                        */
/* ---------------------------------------------------------------- */

const TREATMENT_DETAIL: Record<string, { products: string[]; areas: string[]; doses: string[] }> = {
  "Anti-Wrinkle Injections": {
    products: ["Azzalure", "Bocouture", "Botox"],
    areas: ["Glabella, frontalis, crow's feet", "Glabella and frontalis", "Crow's feet"],
    doses: ["32 units", "40 units", "50 units", "56 units"],
  },
  "Lip Filler": {
    products: ["Juvederm Volift", "Restylane Kysse"],
    areas: ["Upper and lower lip", "Upper lip", "Lip border and body"],
    doses: ["0.5ml", "1ml"],
  },
  "Cheek Filler": {
    products: ["Juvederm Voluma", "Restylane Lyft"],
    areas: ["Midface", "Cheeks and jawline"],
    doses: ["1ml", "1.5ml", "2ml"],
  },
  Profhilo: {
    products: ["Profhilo H+L"],
    areas: ["Full face", "Neck and décolletage"],
    doses: ["2ml"],
  },
  "Microneedling with PRP": {
    products: ["Autologous PRP", "Dermapen 4 with PRP"],
    areas: ["Full face", "Full face and neck"],
    doses: ["1.0mm depth", "1.5mm depth"],
  },
  "Chemical Peel": {
    products: ["ZO 3-Step Peel", "Obagi Blue Peel"],
    areas: ["Full face", "Full face and neck"],
    doses: ["Medium depth", "Superficial"],
  },
  "Skin Consultation": { products: ["—"], areas: ["Full face"], doses: ["—"] },
  "Jawline Filler": {
    products: ["Juvederm Volux", "Restylane Defyne"],
    areas: ["Jawline and chin", "Mandible"],
    doses: ["1ml", "2ml"],
  },
  Polynucleotides: {
    products: ["Plinest", "Nucleofill"],
    areas: ["Periorbital", "Full face"],
    doses: ["2ml"],
  },
  Hydrafacial: {
    products: ["Hydrafacial Syndeo"],
    areas: ["Full face", "Face and neck"],
    doses: ["Signature protocol"],
  },
  "Laser Hair Removal": {
    products: ["Nd:YAG 1064nm"],
    areas: ["Underarms", "Lower legs", "Bikini"],
    doses: ["Fluence 30 J/cm²", "Fluence 24 J/cm²"],
  },
};

function detailsFor(name: string) {
  const detail = TREATMENT_DETAIL[name] ?? TREATMENT_DETAIL["Skin Consultation"]!;
  return { product: pick(detail.products), area: pick(detail.areas), dose: pick(detail.doses) };
}

export const treatments: Row[] = [];

for (const patient of patients) {
  const spec = patientSpecById.get(patient["id"] as string)!;
  const rate = profiles.find((p) => p["id"] === spec.practitioner)?.["commission_rate"] ?? 40;
  const cat = catalogueByName.get(spec.favourite)!;
  const interval = (cat["interval_days"] as number | null) ?? 120;

  for (let visit = spec.visits - 1; visit >= 0; visit--) {
    // Most recent visit is `lastVisit` days ago; earlier ones step back by the cadence.
    const daysAgo = spec.lastVisit + visit * (interval + between(-12, 25));
    if (daysAgo > 730) continue;
    const useFavourite = visit === 0 || rand() > 0.35;
    const item = useFavourite ? cat : pick(activeCatalogue);
    const price = Number(item["price"] ?? 0) + (rand() > 0.7 ? between(1, 4) * 25 : 0);
    const itemInterval = (item["interval_days"] as number | null) ?? null;

    treatments.push({
      id: id("e1"),
      clinic_id: CLINIC_ID,
      patient_id: patient["id"],
      catalogue_id: item["id"],
      practitioner_id: spec.practitioner,
      name: item["name"],
      ...detailsFor(item["name"] as string),
      notes: visit === 0 ? "Tolerated well. Aftercare advice given, review at two weeks." : null,
      price,
      performed_at: iso(-daysAgo, between(9, 16), pick([0, 15, 30, 45])),
      next_due_at: itemInterval ? dateOnly(-daysAgo + itemInterval) : null,
      status: "completed",
      consent_document_id: null,
      commission_rate_snapshot: rate,
      created_at: iso(-daysAgo),
      updated_at: iso(-daysAgo),
    });
  }
}

treatments.sort((a, b) => (a["performed_at"] < b["performed_at"] ? 1 : -1));

/* ---------------------------------------------------------------- */
/* documents                                                         */
/* ---------------------------------------------------------------- */

export const documents: Row[] = [];

function makeDocument(
  patientId: string,
  kind: string,
  title: string,
  status: string,
  daysAgo: number,
): Row {
  const doc: Row = {
    id: id("f1"),
    clinic_id: CLINIC_ID,
    patient_id: patientId,
    treatment_id: null,
    kind,
    title,
    body:
      kind === "consent"
        ? "I confirm the risks, benefits and alternatives have been explained to me, and I consent to the treatment described above."
        : "Please review the information below and confirm it is correct.",
    fields: {},
    responses: null,
    status,
    access_token: id("f9"),
    sent_at: iso(-daysAgo, 9, 30),
    viewed_at: status === "sent" ? null : iso(-daysAgo, 12, 10),
    signed_at: status === "signed" ? iso(-daysAgo, 12, 15) : null,
    signed_name: null,
    signature_data: null,
    signed_ip: null,
    expires_at: null,
    created_by: USERS.frontDesk,
    created_at: iso(-daysAgo, 9, 30),
    updated_at: iso(-daysAgo, 12, 15),
  };
  documents.push(doc);
  return doc;
}

patients.slice(0, 90).forEach((patient, index) => {
  const spec = patientSpecById.get(patient["id"] as string)!;
  const signed = makeDocument(
    patient["id"] as string,
    "consent",
    `${spec.favourite} — consent form`,
    "signed",
    spec.lastVisit,
  );
  signed["signed_name"] = `${spec.first} ${spec.last}`;
  signed["signature_data"] = `${spec.first} ${spec.last}`;

  if (index % 4 === 0) {
    makeDocument(
      patient["id"] as string,
      "aftercare",
      `${spec.favourite} — aftercare advice`,
      "viewed",
      Math.max(1, spec.lastVisit - 1),
    );
  }
  if (index % 5 === 2) {
    makeDocument(
      patient["id"] as string,
      "treatment_plan",
      "Treatment plan — next 6 months",
      "sent",
      between(2, 9),
    );
  }
  if (index % 7 === 1) {
    makeDocument(
      patient["id"] as string,
      "consultation",
      "Consultation summary",
      "signed",
      spec.lastVisit,
    );
  }
});

/**
 * A pending consent with a known token, so the public /d/$token signing route
 * can be exercised in demo mode and by the e2e suite without scraping a token
 * out of the UI.
 */
export const DEMO_CONSENT_TOKEN = "e2ec0deba5e00000e2ec0deba5e00000e2ec0deba5e00000";

{
  const pending = makeDocument(
    patients[0]!["id"] as string,
    "consent",
    "Lip filler — consent form",
    "sent",
    1,
  );
  pending["access_token"] = DEMO_CONSENT_TOKEN;
}

/* ---------------------------------------------------------------- */
/* appointments                                                      */
/* ---------------------------------------------------------------- */

export const appointments: Row[] = [];

const STAGES = [
  "complete",
  "complete",
  "aftercare",
  "in_treatment",
  "waiting",
  "arrived",
  "booked",
  "booked",
  "no_show",
];

function makeAppointment(input: {
  patient: Row;
  practitionerId: string;
  treatmentName: string;
  dayOffset: number;
  hour: number;
  minute: number;
  durationMinutes: number;
  status: string;
  stage: string;
  paymentStatus: string;
  consentDocumentId?: string | null;
}): Row {
  const item = catalogueByName.get(input.treatmentName) ?? activeCatalogue[0]!;
  const starts = day(input.dayOffset, input.hour, input.minute);
  const row: Row = {
    id: id("a9"),
    clinic_id: CLINIC_ID,
    patient_id: input.patient["id"],
    practitioner_id: input.practitionerId,
    catalogue_id: item["id"],
    treatment_name: input.treatmentName,
    treatment_number: between(1, 6),
    starts_at: starts.toISOString(),
    ends_at: new Date(starts.getTime() + input.durationMinutes * 60000).toISOString(),
    status: input.status,
    stage: input.stage,
    payment_status: input.paymentStatus,
    price: Number(item["price"] ?? 0),
    consent_document_id: input.consentDocumentId ?? null,
    notes: null,
    created_by: USERS.frontDesk,
    created_at: iso(input.dayOffset - between(5, 30)),
    updated_at: iso(input.dayOffset),
  };
  appointments.push(row);
  return row;
}

const PRACTITIONER_IDS = [USERS.practitioner, USERS.practitioner2, USERS.owner];

// --- today's diary: a full, varied clinic day
const TODAY_PLAN: {
  patientIndex: number;
  practitionerId: string;
  treatment: string;
  hour: number;
  minute: number;
  duration: number;
  stage: string;
  payment: string;
  consent: "signed" | "sent" | "none";
}[] = [
  {
    patientIndex: 4,
    practitionerId: USERS.practitioner,
    treatment: "Chemical Peel",
    hour: 9,
    minute: 0,
    duration: 45,
    stage: "complete",
    payment: "paid",
    consent: "signed",
  },
  {
    patientIndex: 2,
    practitionerId: USERS.practitioner2,
    treatment: "Lip Filler",
    hour: 9,
    minute: 30,
    duration: 60,
    stage: "complete",
    payment: "paid",
    consent: "signed",
  },
  {
    patientIndex: 9,
    practitionerId: USERS.practitioner,
    treatment: "Microneedling with PRP",
    hour: 10,
    minute: 15,
    duration: 75,
    stage: "aftercare",
    payment: "deposit_paid",
    consent: "signed",
  },
  {
    patientIndex: 21,
    practitionerId: USERS.practitioner2,
    treatment: "Lip Filler",
    hour: 11,
    minute: 0,
    duration: 45,
    stage: "in_treatment",
    payment: "unpaid",
    consent: "sent",
  },
  {
    patientIndex: 6,
    practitionerId: USERS.owner,
    treatment: "Anti-Wrinkle Injections",
    hour: 11,
    minute: 30,
    duration: 30,
    stage: "waiting",
    payment: "unpaid",
    consent: "none",
  },
  {
    patientIndex: 13,
    practitionerId: USERS.practitioner,
    treatment: "Profhilo",
    hour: 13,
    minute: 0,
    duration: 45,
    stage: "arrived",
    payment: "paid",
    consent: "signed",
  },
  {
    patientIndex: 16,
    practitionerId: USERS.owner,
    treatment: "Cheek Filler",
    hour: 14,
    minute: 0,
    duration: 60,
    stage: "booked",
    payment: "deposit_paid",
    consent: "sent",
  },
  {
    patientIndex: 0,
    practitionerId: USERS.practitioner,
    treatment: "Anti-Wrinkle Injections",
    hour: 15,
    minute: 0,
    duration: 30,
    stage: "booked",
    payment: "unpaid",
    consent: "none",
  },
  {
    patientIndex: 18,
    practitionerId: USERS.practitioner2,
    treatment: "Chemical Peel",
    hour: 15,
    minute: 30,
    duration: 45,
    stage: "booked",
    payment: "unpaid",
    consent: "sent",
  },
  {
    patientIndex: 23,
    practitionerId: USERS.owner,
    treatment: "Anti-Wrinkle Injections",
    hour: 16,
    minute: 30,
    duration: 30,
    stage: "no_show",
    payment: "unpaid",
    consent: "signed",
  },
];

for (const plan of TODAY_PLAN) {
  const patient = patients[plan.patientIndex]!;
  let consentId: string | null = null;
  if (plan.consent !== "none") {
    const doc = makeDocument(
      patient["id"] as string,
      "consent",
      `${plan.treatment} — consent form`,
      plan.consent,
      0,
    );
    if (plan.consent === "signed") {
      doc["signed_name"] = `${patient["first_name"]} ${patient["last_name"]}`;
      doc["signature_data"] = doc["signed_name"];
    }
    consentId = doc["id"] as string;
  }
  const status =
    plan.stage === "no_show" ? "no_show" : plan.stage === "booked" ? "booked" : "attended";
  const booking = makeAppointment({
    patient,
    practitionerId: plan.practitionerId,
    treatmentName: plan.treatment,
    dayOffset: 0,
    hour: plan.hour,
    minute: plan.minute,
    durationMinutes: plan.duration,
    status,
    stage: plan.stage,
    paymentStatus: plan.payment,
    consentDocumentId: consentId,
  });

  // Only record a treatment once the slot has actually passed, so "last seen"
  // never reads as a future date when screenshots are taken early in the day.
  if (
    (plan.stage === "complete" || plan.stage === "aftercare") &&
    new Date(booking["starts_at"]) <= NOW
  ) {
    const item = catalogueByName.get(plan.treatment)!;
    const itemInterval = (item["interval_days"] as number | null) ?? null;
    treatments.push({
      id: id("e1"),
      clinic_id: CLINIC_ID,
      patient_id: patient["id"],
      catalogue_id: item["id"],
      practitioner_id: plan.practitionerId,
      name: plan.treatment,
      ...detailsFor(plan.treatment),
      notes: "Tolerated well. Aftercare advice given, review at two weeks.",
      price: booking["price"],
      performed_at: booking["starts_at"],
      next_due_at: itemInterval ? dateOnly(itemInterval) : null,
      status: "completed",
      consent_document_id: consentId,
      commission_rate_snapshot:
        profiles.find((p) => p["id"] === plan.practitionerId)?.["commission_rate"] ?? 40,
      created_at: booking["starts_at"],
      updated_at: booking["starts_at"],
    });
  }
}

// Only patients who are still engaged appear in the recent diary, so the
// lapsed cohort stays lapsed for the retention report.
const engagedPatients = patients.filter((p) => {
  const spec = patientSpecById.get(p["id"] as string)!;
  return spec.lastVisit <= 100 && spec.visits > 1;
});

// --- surrounding weeks: each patient recurs on their own treatment cadence,
// with a random starting phase so bookings spread evenly across the diary
// instead of clustering at the front of the window.
const WINDOW_FROM = -45;
const WINDOW_TO = 30;

for (const patient of engagedPatients) {
  const spec = patientSpecById.get(patient["id"] as string)!;
  const item = catalogueByName.get(spec.favourite)!;
  const cadence = Math.min(180, Math.max(40, (item["interval_days"] as number | null) ?? 90));
  let offset = WINDOW_FROM + between(0, Math.min(cadence, WINDOW_TO - WINDOW_FROM) - 1);

  while (offset <= WINDOW_TO) {
    const step = cadence + between(-8, 8);
    // The clinic is closed on Sundays and today's list is scripted, so nudge
    // those slots either side rather than letting them pile onto Monday.
    let slot = offset;
    if (slot === 0 || day(slot).getDay() === 0) slot += pick([-2, -1, 1, 2]);
    if (slot === 0 || day(slot).getDay() === 0 || slot < WINDOW_FROM || slot > WINDOW_TO) {
      offset += step;
      continue;
    }
    offset = slot;
    const past = offset < 0;
    const roll = rand();
    const status = past
      ? roll > 0.88
        ? "no_show"
        : roll > 0.8
          ? "cancelled"
          : "attended"
      : "booked";
    const stage = past
      ? status === "attended"
        ? "complete"
        : status === "no_show"
          ? "no_show"
          : "booked"
      : "booked";
    const payment = past
      ? status === "attended"
        ? rand() > 0.15
          ? "paid"
          : "deposit_paid"
        : "unpaid"
      : rand() > 0.6
        ? "deposit_paid"
        : "unpaid";

    const booking = makeAppointment({
      patient,
      practitionerId: spec.practitioner,
      treatmentName: spec.favourite,
      dayOffset: offset,
      hour: between(9, 16),
      minute: pick([0, 15, 30, 45]),
      durationMinutes: pick([30, 45, 60, 75]),
      status,
      stage,
      paymentStatus: payment,
    });

    if (status === "attended") {
      const itemInterval = (item["interval_days"] as number | null) ?? null;
      treatments.push({
        id: id("e1"),
        clinic_id: CLINIC_ID,
        patient_id: patient["id"],
        catalogue_id: item["id"],
        practitioner_id: spec.practitioner,
        name: spec.favourite,
        ...detailsFor(spec.favourite),
        notes: null,
        price: booking["price"],
        performed_at: booking["starts_at"],
        next_due_at: itemInterval ? dateOnly(offset + itemInterval) : null,
        status: "completed",
        consent_document_id: null,
        commission_rate_snapshot:
          profiles.find((p) => p["id"] === spec.practitioner)?.["commission_rate"] ?? 40,
        created_at: booking["starts_at"],
        updated_at: booking["starts_at"],
      });
    }

    offset += step;
  }
}

// --- confirmed future bookings for the patients flagged as returning
for (const patient of patients) {
  const spec = patientSpecById.get(patient["id"] as string)!;
  if (spec.upcoming === undefined || spec.upcoming <= 0) continue;
  const dayOffset = day(spec.upcoming).getDay() === 0 ? spec.upcoming + 1 : spec.upcoming;
  makeAppointment({
    patient,
    practitionerId: spec.practitioner,
    treatmentName: spec.favourite,
    dayOffset,
    hour: between(9, 16),
    minute: pick([0, 30]),
    durationMinutes: 45,
    status: "booked",
    stage: "booked",
    paymentStatus: "deposit_paid",
  });
}

appointments.sort((a, b) => (a["starts_at"] < b["starts_at"] ? -1 : 1));
treatments.sort((a, b) => (a["performed_at"] < b["performed_at"] ? 1 : -1));

// Appointment-derived treatments can move a patient's most recent visit forward.
const nowISO = NOW.toISOString();
for (const patient of patients) {
  const latest = treatments.find(
    (t) => t["patient_id"] === patient["id"] && t["performed_at"] <= nowISO,
  );
  if (latest) patient["last_visit_at"] = latest["performed_at"];
}

/* ---------------------------------------------------------------- */
/* photos, messages, history                                         */
/* ---------------------------------------------------------------- */

const oliviaId = patients[0]!["id"] as string;
const oliviaTreatments = treatments.filter((t) => t["patient_id"] === oliviaId);

export const photos: Row[] = [
  {
    id: id("g1"),
    clinic_id: CLINIC_ID,
    patient_id: oliviaId,
    treatment_id: oliviaTreatments[1]?.["id"] ?? null,
    storage_path: "/demo-photos/skin-before-1.png",
    kind: "before",
    caption: "Baseline, relaxed",
    taken_at: iso(-140, 10, 0),
    marketing_consent: true,
    visible_to_patient: true,
    created_at: iso(-140, 10, 0),
  },
  {
    id: id("g1"),
    clinic_id: CLINIC_ID,
    patient_id: oliviaId,
    treatment_id: oliviaTreatments[1]?.["id"] ?? null,
    storage_path: "/demo-photos/skin-after-1.png",
    kind: "after",
    caption: "Two weeks post treatment",
    taken_at: iso(-126, 10, 0),
    marketing_consent: true,
    visible_to_patient: true,
    created_at: iso(-126, 10, 0),
  },
  {
    id: id("g1"),
    clinic_id: CLINIC_ID,
    patient_id: oliviaId,
    treatment_id: oliviaTreatments[0]?.["id"] ?? null,
    storage_path: "/demo-photos/skin-before-2.png",
    kind: "before",
    caption: "Baseline, animated",
    taken_at: iso(-21, 10, 0),
    marketing_consent: false,
    visible_to_patient: true,
    created_at: iso(-21, 10, 0),
  },
  {
    id: id("g1"),
    clinic_id: CLINIC_ID,
    patient_id: oliviaId,
    treatment_id: oliviaTreatments[0]?.["id"] ?? null,
    storage_path: "/demo-photos/skin-after-2.png",
    kind: "after",
    caption: "Two week review",
    taken_at: iso(-7, 10, 0),
    marketing_consent: false,
    visible_to_patient: true,
    created_at: iso(-7, 10, 0),
  },
];

const PHOTO_ASSETS = [
  "/demo-photos/skin-before-1.png",
  "/demo-photos/skin-after-1.png",
  "/demo-photos/skin-before-2.png",
  "/demo-photos/skin-after-2.png",
  "/demo-photos/skin-progress-2.png",
];

function addPhotoSet(patientIndex: number, daysAgo: number) {
  const patient = patients[patientIndex];
  if (!patient) return;
  const mine = treatments.filter((t) => t["patient_id"] === patient["id"]);
  const treatmentId = mine[0]?.["id"] ?? null;
  const captions = [
    ["before", "Baseline, relaxed"],
    ["after", "Two weeks post treatment"],
    ["before", "Baseline, animated"],
    ["after", "Review photos"],
  ] as const;
  captions.forEach(([kind, caption], i) => {
    photos.push({
      id: id("g1"),
      clinic_id: CLINIC_ID,
      patient_id: patient["id"],
      treatment_id: treatmentId,
      storage_path: PHOTO_ASSETS[i % PHOTO_ASSETS.length],
      kind,
      caption,
      taken_at: iso(-(daysAgo - i * 7), 10, 0),
      marketing_consent: i < 2,
      visible_to_patient: true,
      created_at: iso(-(daysAgo - i * 7), 10, 0),
    });
  });
}

for (const [index, daysAgo] of [
  [1, 90],
  [2, 40],
  [3, 55],
  [4, 20],
  [5, 70],
  [6, 15],
  [7, 28],
  [8, 45],
  [9, 12],
  [10, 22],
  [11, 35],
  [12, 60],
  [13, 25],
  [14, 33],
  [15, 50],
  [16, 18],
  [17, 14],
  [18, 9],
  [20, 41],
  [21, 8],
  [22, 19],
  [24, 27],
  [26, 11],
  [28, 16],
] as const) {
  addPhotoSet(index, daysAgo);
}

export const messages: Row[] = [];

function thread(
  patientId: string,
  entries: { author: "staff" | "patient"; body: string; daysAgo: number; unread?: boolean }[],
) {
  for (const entry of entries) {
    messages.push({
      id: id("h1"),
      clinic_id: CLINIC_ID,
      patient_id: patientId,
      author: entry.author,
      author_id: entry.author === "staff" ? USERS.practitioner : null,
      body: entry.body,
      attachments: [],
      read_at: entry.unread ? null : iso(-entry.daysAgo, 18, 0),
      created_at: iso(-entry.daysAgo, between(8, 19), between(0, 59)),
    });
  }
}

thread(oliviaId, [
  {
    author: "staff",
    body: "Hi Olivia, lovely to see you today. Your aftercare sheet is in your portal — avoid exercise and lying flat for four hours.",
    daysAgo: 21,
  },
  {
    author: "patient",
    body: "Thank you! Quick question — is it normal to have a small bruise on the left side?",
    daysAgo: 20,
  },
  {
    author: "staff",
    body: "Completely normal and it should settle within a week. Arnica gel will help. Do send a photo if it is still there on Friday.",
    daysAgo: 20,
  },
  {
    author: "patient",
    body: "All cleared up now, thanks so much. Could I move my next appointment to the afternoon?",
    daysAgo: 2,
    unread: true,
  },
]);

thread(patients[2]!["id"] as string, [
  {
    author: "staff",
    body: "Morning Amelia, your consent form is ready to sign ahead of Thursday.",
    daysAgo: 5,
  },
  { author: "patient", body: "Signed and sent. See you Thursday!", daysAgo: 4 },
]);

thread(patients[6]!["id"] as string, [
  {
    author: "patient",
    body: "Hi, I think I need to reschedule tomorrow — is there anything later in the week?",
    daysAgo: 1,
    unread: true,
  },
]);

thread(patients[13]!["id"] as string, [
  {
    author: "staff",
    body: "Hi Nadia, just confirming your Profhilo second session. Same time, same day next month.",
    daysAgo: 9,
  },
  { author: "patient", body: "Perfect, thank you.", daysAgo: 9 },
]);

thread(patients[16]!["id"] as string, [
  {
    author: "patient",
    body: "Could you send me a copy of my treatment record for insurance?",
    daysAgo: 3,
    unread: true,
  },
]);

thread(patients[4]!["id"] as string, [
  {
    author: "staff",
    body: "Your peel aftercare: no active ingredients for five days, SPF 50 daily.",
    daysAgo: 3,
  },
]);

thread(patients[1]!["id"] as string, [
  {
    author: "staff",
    body: "Charlotte, your Profhilo second session is in the diary. Drink plenty of water the day before.",
    daysAgo: 8,
  },
  { author: "patient", body: "Will do — thanks Nadia.", daysAgo: 8 },
]);

thread(patients[3]!["id"] as string, [
  {
    author: "patient",
    body: "The redness from microneedling has settled. Happy to book session two.",
    daysAgo: 6,
  },
  {
    author: "staff",
    body: "Lovely to hear. Sofia will hold Thursday morning if that still works.",
    daysAgo: 6,
  },
]);

thread(patients[5]!["id"] as string, [
  {
    author: "staff",
    body: "Eleanor, it has been four months since your cheek filler. Would you like a review this month?",
    daysAgo: 4,
  },
  {
    author: "patient",
    body: "Yes please — afternoons are easier.",
    daysAgo: 3,
    unread: true,
  },
]);

thread(patients[7]!["id"] as string, [
  {
    author: "staff",
    body: "We have a complimentary review slot if you would like to come back in.",
    daysAgo: 10,
  },
]);

thread(patients[8]!["id"] as string, [
  {
    author: "patient",
    body: "Could you send the aftercare for the peel again? I lost the email.",
    daysAgo: 2,
    unread: true,
  },
]);

thread(patients[9]!["id"] as string, [
  {
    author: "staff",
    body: "Rest today after PRP. Sleep on your back and skip the gym until Friday.",
    daysAgo: 0,
  },
  { author: "patient", body: "Understood, thank you.", daysAgo: 0 },
]);

thread(patients[11]!["id"] as string, [
  {
    author: "staff",
    body: "Just checking in on the rosacea plan. Any new triggers this week?",
    daysAgo: 7,
  },
  {
    author: "patient",
    body: "Spicy food still flares it. The cream is helping though.",
    daysAgo: 6,
  },
]);

thread(patients[12]!["id"] as string, [
  {
    author: "patient",
    body: "Hi, I moved house — is it still OK to keep my appointments here?",
    daysAgo: 5,
    unread: true,
  },
]);

thread(patients[15]!["id"] as string, [
  {
    author: "staff",
    body: "Welcome to Aetheria. Your consultation forms are in the portal whenever you have a moment.",
    daysAgo: 9,
  },
]);

thread(patients[18]!["id"] as string, [
  {
    author: "staff",
    body: "Consent form for this afternoon's peel is still outstanding — I have resent the link.",
    daysAgo: 0,
  },
]);

thread(patients[21]!["id"] as string, [
  {
    author: "patient",
    body: "Running five minutes late, still coming.",
    daysAgo: 0,
    unread: true,
  },
]);

thread(patients[23]!["id"] as string, [
  {
    author: "staff",
    body: "We missed you this afternoon. Reply here if you would like to rebook — no charge for today.",
    daysAgo: 0,
  },
]);

thread(patients[10]!["id"] as string, [
  {
    author: "staff",
    body: "Your polynucleotide course is booked. Avoid retinoids the night before.",
    daysAgo: 4,
  },
  { author: "patient", body: "Noted — see you then.", daysAgo: 4 },
]);

thread(patients[14]!["id"] as string, [
  {
    author: "patient",
    body: "Could I add a Hydrafacial onto my next visit?",
    daysAgo: 1,
    unread: true,
  },
]);

thread(patients[17]!["id"] as string, [
  {
    author: "staff",
    body: "Photos from last week are in your record. Happy to talk through a jawline plan if you want.",
    daysAgo: 6,
  },
]);

thread(patients[20]!["id"] as string, [
  {
    author: "staff",
    body: "Your peel is overdue — shall I hold a Friday slot?",
    daysAgo: 3,
  },
]);

thread(patients[22]!["id"] as string, [
  {
    author: "patient",
    body: "The anti-wrinkle has started to fade. Can we bring the next one forward?",
    daysAgo: 2,
    unread: true,
  },
]);

thread(patients[24]!["id"] as string, [
  {
    author: "staff",
    body: "Session four of your laser course is in the diary. Shave the area the night before.",
    daysAgo: 1,
  },
  { author: "patient", body: "Will do, thanks.", daysAgo: 1 },
]);

messages.sort((a, b) => (a["created_at"] < b["created_at"] ? -1 : 1));

export const medicalHistory: Row[] = [
  {
    id: id("i1"),
    clinic_id: CLINIC_ID,
    patient_id: oliviaId,
    data: {
      medications: "None",
      allergies: "Penicillin",
      conditions: "Mild rosacea",
      diet: "Vegetarian",
      pregnancy: "No",
      other: "Started a new retinoid in the evenings.",
    },
    summary: "Patient updated their medical and lifestyle information",
    source: "patient",
    changed_by: USERS.patient,
    reviewed_by: null,
    reviewed_at: null,
    created_at: iso(-2, 20, 15),
  },
  {
    id: id("i1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[6]!["id"] as string,
    data: {
      medications: "Sertraline 50mg",
      allergies: "None known",
      conditions: "None",
      diet: "No restrictions",
      pregnancy: "No",
      other: "",
    },
    summary: "Patient updated their medical and lifestyle information",
    source: "patient",
    changed_by: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: iso(-4, 9, 40),
  },
  {
    id: id("i1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[2]!["id"] as string,
    data: {
      medications: "None",
      allergies: "Lidocaine sensitivity",
      conditions: "None",
      diet: "",
      pregnancy: "No",
      other: "",
    },
    summary: "Reviewed at consultation",
    source: "staff",
    changed_by: USERS.practitioner2,
    reviewed_by: USERS.practitioner2,
    reviewed_at: iso(-30, 11, 0),
    created_at: iso(-30, 11, 0),
  },
  {
    id: id("i1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[1]!["id"] as string,
    data: {
      medications: "Levothyroxine",
      allergies: "None known",
      conditions: "Hypothyroidism",
      diet: "No restrictions",
      pregnancy: "No",
      other: "Prefers afternoon appointments.",
    },
    summary: "Patient updated their medical and lifestyle information",
    source: "patient",
    changed_by: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: iso(-6, 19, 10),
  },
  {
    id: id("i1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[4]!["id"] as string,
    data: {
      medications: "None",
      allergies: "None known",
      conditions: "None",
      diet: "Pescatarian",
      pregnancy: "No",
      other: "Started tretinoin three nights a week.",
    },
    summary: "Patient updated their medical and lifestyle information",
    source: "patient",
    changed_by: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: iso(-1, 21, 5),
  },
  {
    id: id("i1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[5]!["id"] as string,
    data: {
      medications: "None",
      allergies: "Aspirin",
      conditions: "None",
      diet: "",
      pregnancy: "No",
      other: "",
    },
    summary: "Reviewed at consultation",
    source: "staff",
    changed_by: USERS.practitioner,
    reviewed_by: USERS.practitioner,
    reviewed_at: iso(-12, 11, 20),
    created_at: iso(-12, 11, 20),
  },
  {
    id: id("i1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[9]!["id"] as string,
    data: {
      medications: "Iron supplement",
      allergies: "None known",
      conditions: "None",
      diet: "Vegetarian",
      pregnancy: "No",
      other: "Bloods done last month — ferritin low-normal.",
    },
    summary: "Patient updated their medical and lifestyle information",
    source: "patient",
    changed_by: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: iso(-3, 18, 40),
  },
  {
    id: id("i1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[11]!["id"] as string,
    data: {
      medications: "Topical ivermectin",
      allergies: "None known",
      conditions: "Rosacea",
      diet: "Avoids spicy food",
      pregnancy: "No",
      other: "Heat and alcohol still flare.",
    },
    summary: "Patient updated their medical and lifestyle information",
    source: "patient",
    changed_by: null,
    reviewed_by: USERS.practitioner2,
    reviewed_at: iso(-5, 14, 0),
    created_at: iso(-8, 20, 0),
  },
  {
    id: id("i1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[13]!["id"] as string,
    data: {
      medications: "None",
      allergies: "None known",
      conditions: "None",
      diet: "",
      pregnancy: "No",
      other: "",
    },
    summary: "Reviewed at consultation",
    source: "staff",
    changed_by: USERS.owner,
    reviewed_by: USERS.owner,
    reviewed_at: iso(-40, 10, 0),
    created_at: iso(-40, 10, 0),
  },
  {
    id: id("i1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[16]!["id"] as string,
    data: {
      medications: "Combined oral contraceptive",
      allergies: "None known",
      conditions: "None",
      diet: "",
      pregnancy: "No",
      other: "",
    },
    summary: "Patient updated their medical and lifestyle information",
    source: "patient",
    changed_by: null,
    reviewed_by: null,
    reviewed_at: null,
    created_at: iso(-2, 22, 18),
  },
];

function addHistory(
  patientIndex: number,
  data: Row,
  daysAgo: number,
  source: "patient" | "staff",
  reviewer?: string,
) {
  const patient = patients[patientIndex];
  if (!patient) return;
  medicalHistory.push({
    id: id("i1"),
    clinic_id: CLINIC_ID,
    patient_id: patient["id"],
    data,
    summary:
      source === "patient"
        ? "Patient updated their medical and lifestyle information"
        : "Reviewed at consultation",
    source,
    changed_by: source === "staff" ? (reviewer ?? USERS.practitioner) : null,
    reviewed_by: reviewer ?? null,
    reviewed_at: reviewer ? iso(-daysAgo, 11, 0) : null,
    created_at: iso(-daysAgo, source === "patient" ? 20 : 11, 0),
  });
}

addHistory(
  3,
  {
    medications: "None",
    allergies: "None known",
    conditions: "None",
    diet: "",
    pregnancy: "No",
    other: "Microneedling course in progress.",
  },
  14,
  "staff",
  USERS.practitioner2,
);
addHistory(
  7,
  {
    medications: "None",
    allergies: "None known",
    conditions: "None",
    diet: "Vegan",
    pregnancy: "No",
    other: "",
  },
  9,
  "patient",
);
addHistory(
  8,
  {
    medications: "None",
    allergies: "Nuts",
    conditions: "None",
    diet: "",
    pregnancy: "No",
    other: "Prefers text reminders.",
  },
  5,
  "patient",
);
addHistory(
  12,
  {
    medications: "None",
    allergies: "None known",
    conditions: "None",
    diet: "",
    pregnancy: "No",
    other: "Moved house recently — confirm address at next visit.",
  },
  11,
  "staff",
  USERS.practitioner,
);
addHistory(
  15,
  {
    medications: "None",
    allergies: "None known",
    conditions: "None",
    diet: "",
    pregnancy: "No",
    other: "New consult, history taken at first visit.",
  },
  10,
  "staff",
  USERS.frontDesk,
);
addHistory(
  18,
  {
    medications: "None",
    allergies: "None known",
    conditions: "None",
    diet: "",
    pregnancy: "No",
    other: "",
  },
  1,
  "patient",
);
addHistory(
  20,
  {
    medications: "None",
    allergies: "None known",
    conditions: "None",
    diet: "",
    pregnancy: "No",
    other: "Overdue peel — skin has been dry.",
  },
  20,
  "staff",
  USERS.owner,
);
addHistory(
  21,
  {
    medications: "None",
    allergies: "None known",
    conditions: "None",
    diet: "",
    pregnancy: "No",
    other: "",
  },
  2,
  "patient",
);
addHistory(
  24,
  {
    medications: "Isotretinoin (completed 2024)",
    allergies: "None known",
    conditions: "Acne (resolved)",
    diet: "",
    pregnancy: "No",
    other: "Waited 12 months after isotretinoin before laser.",
  },
  16,
  "staff",
  USERS.practitioner2,
);

/* ---------------------------------------------------------------- */
/* retention, recalls, notifications, settings                       */
/* ---------------------------------------------------------------- */

export const retentionOutreach: Row[] = [
  {
    id: id("j1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[11]!["id"],
    contacted_by: USERS.frontDesk,
    channel: "message",
    note: "Left a voicemail and sent a portal message.",
    created_at: iso(-6, 14, 0),
  },
  {
    id: id("j1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[8]!["id"],
    contacted_by: USERS.practitioner,
    channel: "email",
    note: "Sent a six-month check-in.",
    created_at: iso(-18, 10, 30),
  },
  {
    id: id("j1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[2]!["id"],
    contacted_by: USERS.frontDesk,
    channel: "phone",
    note: "Spoke on the phone — thinking about a top-up next month.",
    created_at: iso(-4, 15, 20),
  },
  {
    id: id("j1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[15]!["id"],
    contacted_by: USERS.owner,
    channel: "email",
    note: "Win-back offer sent with a review link.",
    created_at: iso(-11, 9, 45),
  },
  {
    id: id("j1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[20]!["id"],
    contacted_by: USERS.practitioner2,
    channel: "message",
    note: "Portal message about their overdue peel.",
    created_at: iso(-2, 12, 10),
  },
  {
    id: id("j1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[11]!["id"],
    contacted_by: USERS.frontDesk,
    channel: "phone",
    note: "No answer — will try again Thursday.",
    created_at: iso(-1, 16, 40),
  },
];

for (const [patientIndex, by, channel, note, daysAgo] of [
  [1, USERS.practitioner, "email", "Profhilo reminder with a booking link.", 9],
  [3, USERS.practitioner2, "phone", "Left a voicemail about session two.", 5],
  [5, USERS.practitioner, "message", "Personal note about cheek filler review.", 3],
  [7, USERS.frontDesk, "email", "Complimentary review offer sent.", 8],
  [12, USERS.frontDesk, "phone", "Win-back call — considering November.", 4],
  [19, USERS.owner, "email", "Consult follow-up with treatment menu.", 10],
  [22, USERS.practitioner, "message", "Anti-wrinkle due — portal reminder.", 2],
  [24, USERS.frontDesk, "email", "Laser course restart offer.", 12],
] as const) {
  retentionOutreach.push({
    id: id("j1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[patientIndex]!["id"],
    contacted_by: by,
    channel,
    note,
    created_at: iso(-daysAgo, 11, 20),
  });
}

const recallGroup1 = id("k9");
const recallGroup2 = id("k9");
const recallGroup3 = id("k9");

export const recallTasks: Row[] = [
  {
    id: id("k1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[5]!["id"],
    group_id: recallGroup1,
    assigned_to: USERS.practitioner,
    assigned_label: "Dr Nadia Rahman",
    created_by: USERS.owner,
    note: "Four months since her cheek filler — worth a personal call.",
    status: "open",
    contacted_at: null,
    contacted_by: null,
    completed_at: null,
    completed_by: null,
    status_by_label: null,
    created_at: iso(-3, 9, 0),
    updated_at: iso(-3, 9, 0),
  },
  {
    id: id("k1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[5]!["id"],
    group_id: recallGroup1,
    assigned_to: USERS.frontDesk,
    assigned_label: "Sofia Marchetti",
    created_by: USERS.owner,
    note: "Four months since her cheek filler — worth a personal call.",
    status: "open",
    contacted_at: null,
    contacted_by: null,
    completed_at: null,
    completed_by: null,
    status_by_label: null,
    created_at: iso(-3, 9, 0),
    updated_at: iso(-3, 9, 0),
  },
  {
    id: id("k1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[7]!["id"],
    group_id: recallGroup2,
    assigned_to: USERS.frontDesk,
    assigned_label: "Sofia Marchetti",
    created_by: USERS.owner,
    note: "Lapsed after two courses. Offer a complimentary review.",
    status: "contacted",
    contacted_at: iso(-1, 15, 20),
    contacted_by: USERS.frontDesk,
    completed_at: null,
    completed_by: null,
    status_by_label: "Sofia Marchetti",
    created_at: iso(-8, 11, 0),
    updated_at: iso(-1, 15, 20),
  },
  {
    id: id("k1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[12]!["id"],
    group_id: recallGroup3,
    assigned_to: USERS.practitioner,
    assigned_label: "Dr Nadia Rahman",
    created_by: USERS.owner,
    note: "Eight months since last visit — win-back message.",
    status: "open",
    contacted_at: null,
    contacted_by: null,
    completed_at: null,
    completed_by: null,
    status_by_label: null,
    created_at: iso(-5, 16, 0),
    updated_at: iso(-5, 16, 0),
  },
  {
    id: id("k1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[19]!["id"],
    group_id: id("k9"),
    assigned_to: USERS.owner,
    assigned_label: "Dr Amara Osei",
    created_by: USERS.owner,
    note: "Consultation only, never converted. Worth one follow-up.",
    status: "open",
    contacted_at: null,
    contacted_by: null,
    completed_at: null,
    completed_by: null,
    status_by_label: null,
    created_at: iso(-2, 8, 30),
    updated_at: iso(-2, 8, 30),
  },
];

function addRecall(patientIndex: number, assignee: string, label: string, note: string, daysAgo: number, status: "open" | "contacted" = "open") {
  recallTasks.push({
    id: id("k1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[patientIndex]!["id"],
    group_id: id("k9"),
    assigned_to: assignee,
    assigned_label: label,
    created_by: USERS.owner,
    note,
    status,
    contacted_at: status === "contacted" ? iso(-(daysAgo - 1), 14, 0) : null,
    contacted_by: status === "contacted" ? assignee : null,
    completed_at: null,
    completed_by: null,
    status_by_label: status === "contacted" ? label : null,
    created_at: iso(-daysAgo, 10, 0),
    updated_at: iso(-daysAgo, 10, 0),
  });
}

addRecall(1, USERS.practitioner, "Dr Nadia Rahman", "Profhilo due — offer the second sitting this month.", 4);
addRecall(3, USERS.practitioner2, "Dr Tom Whitfield", "Microneedling course unfinished. Call about session two.", 6);
addRecall(8, USERS.frontDesk, "Sofia Marchetti", "Six-month peel check-in. Prefers text.", 2);
addRecall(11, USERS.practitioner2, "Dr Tom Whitfield", "Rosacea laser overdue by a week.", 1);
addRecall(15, USERS.frontDesk, "Sofia Marchetti", "New consult who never booked treatment. One more chase.", 7, "contacted");
addRecall(20, USERS.owner, "Dr Amara Osei", "Overdue peel — personal note from Amara.", 3);
addRecall(22, USERS.practitioner, "Dr Nadia Rahman", "Anti-wrinkle lapsed at five months.", 5);
addRecall(24, USERS.frontDesk, "Sofia Marchetti", "Laser course paused. See if they want to restart.", 9);

export const communications: Row[] = [
  {
    id: id("m1"),
    clinic_id: CLINIC_ID,
    patient_id: patients[0]!["id"],
    channel: "email",
    purpose: "reminder",
    to_address: patients[0]!["email"],
    template_key: null,
    subject: "Appointment reminder",
    body: "Due reminder. Process queue marks it sent in demo — nothing leaves the clinic.",
    status: "queued",
    provider: null,
    provider_message_id: null,
    error: null,
    attempts: 0,
    scheduled_for: iso(-1, 10, 0),
    sent_at: null,
    created_by: USERS.frontDesk,
    related_entity: null,
    related_id: null,
    created_at: iso(-1, 10, 0),
  },
];

function pushCommunication(row: Omit<Row, "id" | "clinic_id">) {
  communications.push({
    id: id("m1"),
    clinic_id: CLINIC_ID,
    ...row,
  });
}

const namedForComms = [0, 1, 2, 4, 5, 6, 9, 11, 13, 16, 18, 21];
for (const index of namedForComms) {
  const patient = patients[index]!;
  pushCommunication({
    patient_id: patient["id"],
    channel: index % 2 === 0 ? "email" : "sms",
    purpose: "reminder",
    to_address: index % 2 === 0 ? patient["email"] : patient["phone"],
    template_key: "two_week_review",
    subject: "Two week review",
    body: `Hi ${patient["first_name"]}, you are two weeks post treatment. How are you finding the results?`,
    status: "sent",
    provider: "sandbox",
    provider_message_id: `sbx_${index}_review`,
    error: null,
    attempts: 1,
    scheduled_for: iso(-12, 9, 0),
    sent_at: iso(-12, 9, 2),
    created_by: USERS.frontDesk,
    related_entity: "appointment",
    related_id: null,
    created_at: iso(-12, 9, 0),
  });
  pushCommunication({
    patient_id: patient["id"],
    channel: "email",
    purpose: "reminder",
    to_address: patient["email"],
    template_key: "consent_request",
    subject: "Your consent form",
    body: `Hi ${patient["first_name"]}, your consent form is waiting in the patient portal.`,
    status: index === 18 || index === 21 ? "queued" : "sent",
    provider: index === 18 || index === 21 ? null : "sandbox",
    provider_message_id: index === 18 || index === 21 ? null : `sbx_${index}_consent`,
    error: null,
    attempts: index === 18 || index === 21 ? 0 : 1,
    scheduled_for: iso(-2, 8, 30),
    sent_at: index === 18 || index === 21 ? null : iso(-2, 8, 32),
    created_by: USERS.frontDesk,
    related_entity: "document",
    related_id: null,
    created_at: iso(-2, 8, 30),
  });
}

pushCommunication({
  patient_id: patients[6]!["id"],
  channel: "sms",
  purpose: "transactional",
  to_address: patients[6]!["phone"],
  template_key: "payment_request",
  subject: "Balance outstanding",
  body: "Hi Zara, there is a small balance outstanding on your last visit.",
  status: "sent",
  provider: "sandbox",
  provider_message_id: "sbx_zara_pay",
  error: null,
  attempts: 1,
  scheduled_for: iso(-3, 11, 0),
  sent_at: iso(-3, 11, 1),
  created_by: USERS.frontDesk,
  related_entity: "appointment",
  related_id: null,
  created_at: iso(-3, 11, 0),
});

pushCommunication({
  patient_id: patients[5]!["id"],
  channel: "email",
  purpose: "reminder",
  to_address: patients[5]!["email"],
  template_key: "recall",
  subject: "Time for a review",
  body: "Hi Eleanor, it has been a little while since your last cheek filler with us.",
  status: "sent",
  provider: "sandbox",
  provider_message_id: "sbx_eleanor_recall",
  error: null,
  attempts: 1,
  scheduled_for: iso(-4, 10, 0),
  sent_at: iso(-4, 10, 1),
  created_by: USERS.owner,
  related_entity: "patient",
  related_id: patients[5]!["id"],
  created_at: iso(-4, 10, 0),
});

const extraComms = [7, 8, 10, 12, 14, 17, 20, 22, 24, 26, 28, 30];
for (const index of extraComms) {
  const patient = patients[index];
  if (!patient) continue;
  pushCommunication({
    patient_id: patient["id"],
    channel: "email",
    purpose: "transactional",
    to_address: patient["email"],
    template_key: "confirmation",
    subject: "Your appointment is confirmed",
    body: `Hi ${patient["first_name"]}, your appointment is in the diary. Reply if you need to move it.`,
    status: "sent",
    provider: "sandbox",
    provider_message_id: `sbx_${index}_confirm`,
    error: null,
    attempts: 1,
    scheduled_for: iso(-6, 9, 0),
    sent_at: iso(-6, 9, 1),
    created_by: USERS.frontDesk,
    related_entity: "appointment",
    related_id: null,
    created_at: iso(-6, 9, 0),
  });
  pushCommunication({
    patient_id: patient["id"],
    channel: index % 3 === 0 ? "sms" : "email",
    purpose: "reminder",
    to_address: index % 3 === 0 ? patient["phone"] : patient["email"],
    template_key: "aftercare",
    subject: "Aftercare",
    body: `Hi ${patient["first_name"]}, a quick reminder of today's aftercare. The leaflet is in your portal.`,
    status: index === 30 ? "failed" : "sent",
    provider: "sandbox",
    provider_message_id: `sbx_${index}_after`,
    error: index === 30 ? "Mailbox full" : null,
    attempts: index === 30 ? 3 : 1,
    scheduled_for: iso(-5, 16, 0),
    sent_at: index === 30 ? null : iso(-5, 16, 1),
    created_by: USERS.frontDesk,
    related_entity: "appointment",
    related_id: null,
    created_at: iso(-5, 16, 0),
  });
}

pushCommunication({
  patient_id: patients[4]!["id"],
  channel: "email",
  purpose: "marketing",
  to_address: patients[4]!["email"],
  template_key: "recall",
  subject: "Autumn skin reset",
  body: `Hi ${patients[4]!["first_name"]}, we have a few peel course spaces left this month if you would like to continue.`,
  status: "sent",
  provider: "sandbox",
  provider_message_id: "sbx_peel_mkt",
  error: null,
  attempts: 1,
  scheduled_for: iso(-8, 10, 0),
  sent_at: iso(-8, 10, 2),
  created_by: USERS.owner,
  related_entity: "patient",
  related_id: patients[4]!["id"],
  created_at: iso(-8, 10, 0),
});

export const staffNotifications: Row[] = [
  {
    id: id("l1"),
    clinic_id: CLINIC_ID,
    recipient_id: USERS.owner,
    sender_id: USERS.frontDesk,
    kind: "urgent",
    title: "Urgent from Sofia Marchetti: Room 2 autoclave",
    body: "The autoclave in room 2 failed its cycle this morning. Using room 1 until the engineer visits.",
    urgent: true,
    patient_id: null,
    appointment_id: null,
    read_at: null,
    created_at: iso(0, 8, 15),
  },
  {
    id: id("l1"),
    clinic_id: CLINIC_ID,
    recipient_id: USERS.owner,
    sender_id: null,
    kind: "appointment",
    title: "New booking",
    body: "Zara Haddad — Lip Filler on Thursday at 10:30",
    urgent: false,
    patient_id: patients[6]!["id"],
    appointment_id: null,
    read_at: null,
    created_at: iso(-1, 16, 45),
  },
  {
    id: id("l1"),
    clinic_id: CLINIC_ID,
    recipient_id: USERS.owner,
    sender_id: USERS.practitioner,
    kind: "staff_message",
    title: "Message from Dr Nadia Rahman: Stock",
    body: "We are down to two vials of Profhilo. Can we reorder before Friday?",
    urgent: false,
    patient_id: null,
    appointment_id: null,
    read_at: null,
    created_at: iso(-1, 12, 5),
  },
  {
    id: id("l1"),
    clinic_id: CLINIC_ID,
    recipient_id: USERS.practitioner,
    sender_id: USERS.frontDesk,
    kind: "staff_message",
    title: "Message from Sofia Marchetti: Running late",
    body: "Your 11:00 has called ahead — stuck on the Northern line, roughly fifteen minutes behind.",
    urgent: false,
    patient_id: null,
    appointment_id: null,
    read_at: null,
    created_at: iso(0, 10, 40),
  },
  {
    id: id("l1"),
    clinic_id: CLINIC_ID,
    recipient_id: USERS.frontDesk,
    sender_id: USERS.owner,
    kind: "staff_message",
    title: "Message from Dr Amara Osei: Consent forms",
    body: "Please chase the two outstanding consent forms before this afternoon's list.",
    urgent: false,
    patient_id: null,
    appointment_id: null,
    read_at: null,
    created_at: iso(0, 9, 5),
  },
  {
    id: id("l1"),
    clinic_id: CLINIC_ID,
    recipient_id: USERS.practitioner2,
    sender_id: USERS.frontDesk,
    kind: "staff_message",
    title: "Message from Sofia Marchetti: 11:00 running late",
    body: "Your 11:00 filler has texted from the Northern line — about ten minutes behind.",
    urgent: false,
    patient_id: patients[21]!["id"],
    appointment_id: null,
    read_at: null,
    created_at: iso(0, 10, 48),
  },
  {
    id: id("l1"),
    clinic_id: CLINIC_ID,
    recipient_id: USERS.practitioner,
    sender_id: USERS.owner,
    kind: "urgent",
    title: "Urgent from Dr Amara Osei: Consent chase",
    body: "Please do not start the 15:00 until Olivia's consent is on file.",
    urgent: true,
    patient_id: patients[0]!["id"],
    appointment_id: null,
    read_at: null,
    created_at: iso(0, 14, 20),
  },
  {
    id: id("l1"),
    clinic_id: CLINIC_ID,
    recipient_id: USERS.frontDesk,
    sender_id: USERS.practitioner2,
    kind: "staff_message",
    title: "Message from Dr Tom Whitfield: Aftercare print",
    body: "Room 2 is out of peel aftercare sheets. Could you print a pack?",
    urgent: false,
    patient_id: null,
    appointment_id: null,
    read_at: iso(0, 9, 40),
    created_at: iso(0, 8, 50),
  },
  {
    id: id("l1"),
    clinic_id: CLINIC_ID,
    recipient_id: USERS.practitioner2,
    sender_id: USERS.owner,
    kind: "staff_message",
    title: "Message from Dr Amara Osei: Thursday cover",
    body: "Can you cover Nadia's Thursday morning if her course overruns?",
    urgent: false,
    patient_id: null,
    appointment_id: null,
    read_at: iso(-1, 18, 10),
    created_at: iso(-2, 17, 5),
  },
  {
    id: id("l1"),
    clinic_id: CLINIC_ID,
    recipient_id: USERS.owner,
    sender_id: null,
    kind: "appointment",
    title: "No-show logged",
    body: "A diary no-show was logged this afternoon. Front desk will offer a rebook.",
    urgent: false,
    patient_id: patients[23]!["id"],
    appointment_id: null,
    read_at: iso(0, 16, 0),
    created_at: iso(0, 15, 40),
  },
];

export const messageTemplates: Row[] = [
  {
    id: id("m1"),
    clinic_id: CLINIC_ID,
    key: "recall",
    title: "Recall — treatment due",
    body: "Hi {{first_name}}, it has been a little while since your last {{treatment}} with us. Would you like me to hold a slot for you this month?",
    category: "Recall",
    created_by: USERS.owner,
    created_at: iso(-90),
    updated_at: iso(-90),
  },
  {
    id: id("m1"),
    clinic_id: CLINIC_ID,
    key: "consent_request",
    title: "Consent reminder",
    body: "Hi {{first_name}}, your consent form is waiting in the patient portal. Signing it before your visit means we can start on time.",
    category: "Admin",
    created_by: USERS.frontDesk,
    created_at: iso(-80),
    updated_at: iso(-80),
  },
  {
    id: id("m1"),
    clinic_id: CLINIC_ID,
    key: "two_week_review",
    title: "Two week review",
    body: "Hi {{first_name}}, you are two weeks post treatment. How are you finding the results? Send a photo if you would like us to take a look.",
    category: "Aftercare",
    created_by: USERS.practitioner,
    created_at: iso(-60),
    updated_at: iso(-60),
  },
  {
    id: id("m1"),
    clinic_id: CLINIC_ID,
    key: "payment_request",
    title: "Balance outstanding",
    body: "Hi {{first_name}}, there is a small balance outstanding on your last visit. You can settle it in the portal or we can take it at your next appointment.",
    category: "Payments",
    created_by: USERS.frontDesk,
    created_at: iso(-45),
    updated_at: iso(-45),
  },
  {
    id: id("m1"),
    clinic_id: CLINIC_ID,
    key: "confirmation",
    title: "Appointment confirmed",
    body: "Hi {{first_name}}, your appointment is confirmed. Please arrive five minutes early so we can settle any forms.",
    category: "Admin",
    created_by: USERS.frontDesk,
    created_at: iso(-40),
    updated_at: iso(-40),
  },
  {
    id: id("m1"),
    clinic_id: CLINIC_ID,
    key: "aftercare",
    title: "Aftercare reminder",
    body: "Hi {{first_name}}, a reminder of today's aftercare. The leaflet is in your portal — message us if anything feels unexpected.",
    category: "Aftercare",
    created_by: USERS.practitioner,
    created_at: iso(-35),
    updated_at: iso(-35),
  },
  {
    id: id("m1"),
    clinic_id: CLINIC_ID,
    key: "no_show",
    title: "We missed you",
    body: "Hi {{first_name}}, we missed you today. Reply here if you would like to rebook — there is no charge for this visit.",
    category: "Admin",
    created_by: USERS.frontDesk,
    created_at: iso(-20),
    updated_at: iso(-20),
  },
];

export const treatmentColours: Row[] = [
  {
    treatment_name: "anti-wrinkle injections",
    lane: 1,
    hex: null,
    updated_by: USERS.owner,
    updated_at: iso(-30),
  },
  {
    treatment_name: "lip filler",
    lane: 3,
    hex: null,
    updated_by: USERS.owner,
    updated_at: iso(-30),
  },
  {
    treatment_name: "cheek filler",
    lane: 4,
    hex: null,
    updated_by: USERS.owner,
    updated_at: iso(-30),
  },
  { treatment_name: "profhilo", lane: 2, hex: null, updated_by: USERS.owner, updated_at: iso(-30) },
  {
    treatment_name: "microneedling with prp",
    lane: 6,
    hex: null,
    updated_by: USERS.owner,
    updated_at: iso(-30),
  },
  {
    treatment_name: "chemical peel",
    lane: 5,
    hex: null,
    updated_by: USERS.owner,
    updated_at: iso(-30),
  },
  {
    treatment_name: "laser hair removal",
    lane: 7,
    hex: null,
    updated_by: USERS.owner,
    updated_at: iso(-30),
  },
  {
    treatment_name: "skin consultation",
    lane: 8,
    hex: null,
    updated_by: USERS.owner,
    updated_at: iso(-30),
  },
  {
    treatment_name: "jawline filler",
    lane: 4,
    hex: null,
    updated_by: USERS.owner,
    updated_at: iso(-30),
  },
  {
    treatment_name: "polynucleotides",
    lane: 2,
    hex: null,
    updated_by: USERS.owner,
    updated_at: iso(-30),
  },
  {
    treatment_name: "hydrafacial",
    lane: 6,
    hex: null,
    updated_by: USERS.owner,
    updated_at: iso(-30),
  },
];

export const colourThemes: Row[] = [
  {
    id: id("n1"),
    name: "House palette",
    colours: {
      "anti-wrinkle injections": 1,
      "lip filler": 3,
      "cheek filler": 4,
      profhilo: 2,
      "jawline filler": 4,
      polynucleotides: 2,
      hydrafacial: 6,
    },
    created_by: USERS.owner,
    created_at: iso(-60),
    updated_at: iso(-60),
  },
  {
    id: id("n1"),
    name: "High contrast",
    colours: {
      "anti-wrinkle injections": "#a6dccd",
      "lip filler": "#ef9bc4",
      "cheek filler": "#b9a6e8",
      profhilo: "#eed488",
    },
    created_by: USERS.owner,
    created_at: iso(-25),
    updated_at: iso(-25),
  },
];

export const profileChangeRequests: Row[] = [
  {
    id: id("o1"),
    clinic_id: CLINIC_ID,
    user_id: USERS.practitioner,
    full_name: "Dr Nadia Rahman",
    job_title: "Senior Aesthetic Practitioner",
    registration_body: "NMC",
    registration_number: "18C4471E",
    note: "Promoted to senior in July — please update my job title.",
    status: "pending",
    reviewed_by: null,
    reviewed_at: null,
    reviewer_note: null,
    created_at: iso(-3, 13, 0),
    updated_at: iso(-3, 13, 0),
  },
  {
    id: id("o1"),
    clinic_id: CLINIC_ID,
    user_id: USERS.frontDesk,
    full_name: "Sofia Marchetti",
    job_title: "Lead Patient Coordinator",
    registration_body: null,
    registration_number: null,
    note: "Taking on the reception rota from September.",
    status: "pending",
    reviewed_by: null,
    reviewed_at: null,
    reviewer_note: null,
    created_at: iso(-1, 17, 30),
    updated_at: iso(-1, 17, 30),
  },
  {
    id: id("o1"),
    clinic_id: CLINIC_ID,
    user_id: USERS.practitioner2,
    full_name: "Dr Tom Whitfield",
    job_title: "Aesthetic Doctor",
    registration_body: "GMC",
    registration_number: "7719034",
    note: "Corrected my GMC number.",
    status: "approved",
    reviewed_by: USERS.owner,
    reviewed_at: iso(-20, 10, 0),
    reviewer_note: "Verified against the register.",
    created_at: iso(-22, 9, 0),
    updated_at: iso(-20, 10, 0),
  },
];

/** Categories match the staff file taxonomy the profile page groups by. */
const STAFF_FILES: [string, string, string, string, number, number][] = [
  [
    USERS.owner,
    "jccp_register",
    "JCCP practitioner register entry",
    "jccp-register-entry.pdf",
    142_880,
    210,
  ],
  [USERS.owner, "statutory_registration", "GMC certificate", "gmc-certificate.pdf", 201_774, 300],
  [
    USERS.owner,
    "indemnity_insurance",
    "Medical indemnity schedule 2026/27",
    "indemnity-2026-27.pdf",
    284_912,
    96,
  ],
  [USERS.owner, "bls", "BLS & anaphylaxis training", "bls-anaphylaxis.pdf", 96_215, 140],
  [
    USERS.owner,
    "information_governance",
    "GDPR & information governance",
    "ig-training.pdf",
    88_402,
    180,
  ],
  [
    USERS.practitioner,
    "statutory_registration",
    "NMC registration",
    "nmc-registration.pdf",
    118_430,
    200,
  ],
  [
    USERS.practitioner,
    "qualification",
    "Level 7 aesthetic medicine diploma",
    "level-7-diploma.pdf",
    402_118,
    420,
  ],
  [
    USERS.practitioner,
    "indemnity_insurance",
    "Indemnity insurance certificate",
    "indemnity-2026.pdf",
    274_506,
    120,
  ],
  [
    USERS.practitioner,
    "training",
    "Advanced dermal filler masterclass",
    "filler-masterclass.pdf",
    156_770,
    60,
  ],
  [USERS.practitioner, "dbs", "Enhanced DBS disclosure", "dbs-disclosure.pdf", 74_338, 260],
  [
    USERS.practitioner2,
    "statutory_registration",
    "GMC certificate",
    "gmc-certificate.pdf",
    197_004,
    330,
  ],
  [
    USERS.practitioner2,
    "indemnity_insurance",
    "Indemnity insurance certificate",
    "indemnity-2026.pdf",
    269_441,
    110,
  ],
  [
    USERS.practitioner2,
    "infection_control",
    "Infection control & sharps",
    "infection-control.pdf",
    91_226,
    150,
  ],
  [USERS.frontDesk, "bls", "Basic life support certificate", "bls-2026.pdf", 96_215, 75],
  [
    USERS.frontDesk,
    "safeguarding",
    "Safeguarding adults and children",
    "safeguarding.pdf",
    84_990,
    130,
  ],
  [
    USERS.frontDesk,
    "right_to_work",
    "Right to work — share code",
    "right-to-work.pdf",
    45_112,
    290,
  ],
  [USERS.frontDesk, "contract", "Employment contract", "contract-signed.pdf", 312_665, 300],
];

export const staffDocuments: Row[] = STAFF_FILES.map(
  ([userId, category, title, fileName, fileSize, daysAgo]) => ({
    id: id("p1"),
    user_id: userId,
    title,
    category,
    path: `demo/${fileName}`,
    file_name: fileName,
    file_type: "application/pdf",
    file_size: fileSize,
    created_at: iso(-daysAgo),
  }),
);

export const userNotes: Row[] = [
  {
    id: id("q1"),
    user_id: USERS.owner,
    body: "This week\n\n- Reorder Profhilo before Friday\n- Sign off Nadia's job title change\n- Chase the two outstanding consent forms\n- Look at why second-visit conversion dipped in the last cohort",
    created_at: iso(-14),
    updated_at: iso(0, 8, 30),
  },
];

export const appointmentNotes: Row[] = [];

const VISIT_NOTES = [
  "Patient tolerated well. Mild erythema expected for 24 hours. Aftercare leaflet given and verbally confirmed.",
  "Good result. Advised SPF 50, no actives for five days, and a two-week photo if anything feels uneven.",
  "Cannula technique, no vascular concerns. Arnica gel supplied. Review at two weeks.",
  "Session completed as planned. Cooling applied. Sleep on back tonight, skip the gym until Friday.",
  "Peel endpoint reached. Neutralised. Strict sun avoidance discussed; next sitting booked.",
  "PRP drawn and applied. Patient comfortable throughout. Iron levels noted from last bloods.",
];

{
  const noted = new Set<string>();
  const todayKey = TODAY.toDateString();
  for (const booking of appointments) {
    const when = new Date(booking["starts_at"] as string);
    const isToday = when.toDateString() === todayKey;
    const stage = booking["stage"] as string;
    if (isToday && (stage === "complete" || stage === "aftercare" || stage === "in_treatment" || stage === "waiting" || stage === "arrived")) {
      const practitioner = profiles.find((p) => p["id"] === booking["practitioner_id"]);
      appointmentNotes.push({
        id: id("r1"),
        appointment_id: booking["id"],
        clinic_id: CLINIC_ID,
        patient_id: booking["patient_id"],
        body: VISIT_NOTES[noted.size % VISIT_NOTES.length],
        updated_by: booking["practitioner_id"],
        updated_by_label: practitioner?.["full_name"] ?? "Practitioner",
        created_at: booking["starts_at"],
        updated_at: booking["updated_at"],
      });
      booking["notes"] = String(VISIT_NOTES[noted.size % VISIT_NOTES.length]).replace(/<\/?p>/g, "");
      noted.add(booking["id"] as string);
    }
  }
  for (const booking of appointments) {
    if (noted.size >= 90) break;
    if (noted.has(booking["id"] as string)) continue;
    if (booking["status"] !== "attended" && booking["stage"] !== "complete") continue;
    if (new Date(booking["starts_at"] as string) > NOW) continue;
    const practitioner = profiles.find((p) => p["id"] === booking["practitioner_id"]);
    appointmentNotes.push({
      id: id("r1"),
      appointment_id: booking["id"],
      clinic_id: CLINIC_ID,
      patient_id: booking["patient_id"],
      body: VISIT_NOTES[noted.size % VISIT_NOTES.length],
      updated_by: booking["practitioner_id"],
      updated_by_label: practitioner?.["full_name"] ?? "Practitioner",
      created_at: booking["starts_at"],
      updated_at: booking["updated_at"],
    });
    noted.add(booking["id"] as string);
  }
}

/* ---------------------------------------------------------------- */
/* treatment plans (journeys)                                        */
/* ---------------------------------------------------------------- */

type PlanStepSpec = { t: string; k?: "session" | "task" | "conditional" };
type PlanRecipe = {
  /** Index into PATIENT_SPECS / patients. */
  patient: number;
  name: string;
  phase: "consult" | "foundation" | "build" | "results";
  /** How many leading steps are already done. */
  done: number;
  /** Days until the current step is due; negative = overdue (at risk). */
  nextDueIn: number | null;
  steps: PlanStepSpec[];
};

const MICRONEEDLING_STEPS: PlanStepSpec[] = [
  { t: "Consultation & skin assessment", k: "task" },
  { t: "Baseline photos", k: "task" },
  { t: "Microneedling session 1", k: "session" },
  { t: "Blood test check", k: "task" },
  { t: "If deficient: start vitamins", k: "conditional" },
  { t: "Microneedling session 2", k: "session" },
  { t: "Microneedling session 3", k: "session" },
  { t: "Review & results photos", k: "task" },
];

const PLAN_RECIPES: PlanRecipe[] = [
  {
    patient: 0,
    name: "Anti-Wrinkle Maintenance Plan",
    phase: "build",
    done: 4,
    nextDueIn: 5,
    steps: [
      { t: "Consultation & consent", k: "task" },
      { t: "Treatment session 1", k: "session" },
      { t: "Two-week review", k: "task" },
      { t: "Treatment session 2", k: "session" },
      { t: "Treatment session 3", k: "session" },
      { t: "Maintenance review", k: "task" },
    ],
  },
  {
    patient: 1,
    name: "Profhilo Skin Quality Programme",
    phase: "results",
    done: 5,
    nextDueIn: 9,
    steps: [
      { t: "Consultation & baseline photos", k: "task" },
      { t: "Profhilo round 1", k: "session" },
      { t: "One-month check-in", k: "task" },
      { t: "Profhilo round 2", k: "session" },
      { t: "Results photos", k: "task" },
      { t: "Maintenance plan agreed", k: "task" },
    ],
  },
  {
    patient: 2,
    name: "Lip Enhancement Journey",
    phase: "foundation",
    done: 2,
    nextDueIn: -4,
    steps: [
      { t: "Consultation & patch test", k: "task" },
      { t: "Lip filler session 1", k: "session" },
      { t: "Two-week review & photos", k: "task" },
      { t: "Top-up session", k: "session" },
      { t: "Final review", k: "task" },
    ],
  },
  { patient: 3, name: "3-Month Microneedling Plan", phase: "build", done: 3, nextDueIn: -2, steps: MICRONEEDLING_STEPS },
  {
    patient: 4,
    name: "Chemical Peel Course",
    phase: "foundation",
    done: 2,
    nextDueIn: 7,
    steps: [
      { t: "Skin assessment & prep plan", k: "task" },
      { t: "Peel session 1", k: "session" },
      { t: "Peel session 2", k: "session" },
      { t: "Peel session 3", k: "session" },
      { t: "Aftercare review", k: "task" },
    ],
  },
  {
    patient: 5,
    name: "Skin Rejuvenation Plan",
    phase: "consult",
    done: 1,
    nextDueIn: 3,
    steps: [
      { t: "Consultation & goals", k: "task" },
      { t: "Medical history review", k: "task" },
      { t: "Baseline photos", k: "task" },
      { t: "Treatment plan agreed", k: "task" },
    ],
  },
  { patient: 9, name: "3-Month Microneedling Plan", phase: "build", done: 5, nextDueIn: 4, steps: MICRONEEDLING_STEPS },
  {
    patient: 11,
    name: "Rosacea Management Programme",
    phase: "foundation",
    done: 3,
    nextDueIn: 6,
    steps: [
      { t: "Consultation & triggers diary", k: "task" },
      { t: "Start prescribed routine", k: "task" },
      { t: "Laser session 1", k: "session" },
      { t: "Laser session 2", k: "session" },
      { t: "Six-week review", k: "task" },
    ],
  },
  {
    patient: 13,
    name: "Anti-Ageing Programme",
    phase: "results",
    done: 6,
    nextDueIn: 14,
    steps: [
      { t: "Consultation", k: "task" },
      { t: "Anti-wrinkle session 1", k: "session" },
      { t: "Filler session", k: "session" },
      { t: "Profhilo round 1", k: "session" },
      { t: "Profhilo round 2", k: "session" },
      { t: "Results photos", k: "task" },
      { t: "Discharge & maintenance", k: "task" },
    ],
  },
  {
    patient: 15,
    name: "New Patient Consultation Plan",
    phase: "consult",
    done: 0,
    nextDueIn: -1,
    steps: [
      { t: "Consultation booked", k: "task" },
      { t: "Medical history form", k: "task" },
      { t: "Patch test", k: "task" },
    ],
  },
  {
    patient: 6,
    name: "Lip Shape & Balance Plan",
    phase: "foundation",
    done: 1,
    nextDueIn: 8,
    steps: [
      { t: "Consultation & photos", k: "task" },
      { t: "Lip filler session 1", k: "session" },
      { t: "Two-week review", k: "task" },
      { t: "Balance top-up", k: "session" },
    ],
  },
  {
    patient: 16,
    name: "Midface Volume Programme",
    phase: "build",
    done: 2,
    nextDueIn: 11,
    steps: [
      { t: "Consultation", k: "task" },
      { t: "Cheek filler session 1", k: "session" },
      { t: "Review & photos", k: "task" },
      { t: "Cheek filler session 2", k: "session" },
      { t: "Maintenance plan", k: "task" },
    ],
  },
  {
    patient: 21,
    name: "Lip Filler Aftercare Track",
    phase: "results",
    done: 3,
    nextDueIn: 16,
    steps: [
      { t: "Treatment session", k: "session" },
      { t: "48-hour check-in", k: "task" },
      { t: "Two-week review", k: "task" },
      { t: "Photos & discharge", k: "task" },
    ],
  },
  {
    patient: 7,
    name: "Maintenance Review Track",
    phase: "consult",
    done: 1,
    nextDueIn: 4,
    steps: [
      { t: "Complimentary review booked", k: "task" },
      { t: "Photos", k: "task" },
      { t: "Plan agreed", k: "task" },
    ],
  },
  {
    patient: 8,
    name: "Peel Course",
    phase: "foundation",
    done: 2,
    nextDueIn: 12,
    steps: [
      { t: "Skin prep", k: "task" },
      { t: "Peel session 1", k: "session" },
      { t: "Peel session 2", k: "session" },
      { t: "Peel session 3", k: "session" },
      { t: "Review", k: "task" },
    ],
  },
  {
    patient: 10,
    name: "Skin Booster Course",
    phase: "build",
    done: 2,
    nextDueIn: -3,
    steps: [
      { t: "Consultation", k: "task" },
      { t: "Polynucleotide session 1", k: "session" },
      { t: "Polynucleotide session 2", k: "session" },
      { t: "Polynucleotide session 3", k: "session" },
      { t: "Results photos", k: "task" },
    ],
  },
  {
    patient: 12,
    name: "Win-back Review",
    phase: "consult",
    done: 0,
    nextDueIn: -6,
    steps: [
      { t: "Re-engagement call", k: "task" },
      { t: "Consultation", k: "task" },
      { t: "Treatment plan", k: "task" },
    ],
  },
  {
    patient: 18,
    name: "Hydrafacial Series",
    phase: "foundation",
    done: 1,
    nextDueIn: 10,
    steps: [
      { t: "Consultation", k: "task" },
      { t: "Hydrafacial 1", k: "session" },
      { t: "Hydrafacial 2", k: "session" },
      { t: "Hydrafacial 3", k: "session" },
    ],
  },
  {
    patient: 22,
    name: "Anti-Wrinkle Maintenance",
    phase: "build",
    done: 3,
    nextDueIn: 2,
    steps: [
      { t: "Consultation", k: "task" },
      { t: "Session 1", k: "session" },
      { t: "Two-week review", k: "task" },
      { t: "Session 2", k: "session" },
      { t: "Maintenance diary", k: "task" },
    ],
  },
  {
    patient: 24,
    name: "Laser Hair Course",
    phase: "build",
    done: 4,
    nextDueIn: 8,
    steps: [
      { t: "Patch test", k: "task" },
      { t: "Session 1", k: "session" },
      { t: "Session 2", k: "session" },
      { t: "Session 3", k: "session" },
      { t: "Session 4", k: "session" },
      { t: "Session 5", k: "session" },
      { t: "Session 6", k: "session" },
    ],
  },
];

export const treatmentPlans: Row[] = [];
export const planMilestones: Row[] = [];
for (const recipe of PLAN_RECIPES) {
  const patient = patients[recipe.patient];
  if (!patient) continue;
  const spec = PATIENT_SPECS[recipe.patient]!;
  const planId = id("d7");
  const sessions = recipe.steps.filter((s) => (s.k ?? "task") === "session").length;
  treatmentPlans.push({
    id: planId,
    clinic_id: CLINIC_ID,
    patient_id: patient["id"],
    practitioner_id: spec.practitioner ?? USERS.practitioner,
    catalogue_id: null,
    name: recipe.name,
    phase: recipe.phase,
    status: "active",
    total_sessions: Math.max(1, sessions),
    started_at: iso(-45 + recipe.patient, 10, 0),
    completed_at: null,
    created_by: USERS.owner,
    created_at: iso(-45 + recipe.patient, 10, 0),
    updated_at: iso(-2, 9, 0),
  });
  recipe.steps.forEach((step, i) => {
    const status = i < recipe.done ? "done" : i === recipe.done ? "current" : "upcoming";
    planMilestones.push({
      id: id("d8"),
      clinic_id: CLINIC_ID,
      plan_id: planId,
      idx: i + 1,
      title: step.t,
      kind: step.k ?? "task",
      status,
      due_date:
        status === "current" && recipe.nextDueIn != null
          ? iso(recipe.nextDueIn).slice(0, 10)
          : status === "upcoming"
            ? iso(recipe.nextDueIn ?? 7 + (i - recipe.done) * 14).slice(0, 10)
            : null,
      appointment_id: null,
      completed_at: status === "done" ? iso(-((recipe.done - i) * 9), 15, 0) : null,
      created_at: iso(-45 + recipe.patient, 10, 0),
    });
  });
}

// Stable photo avatars for the demo clinic, matching the mockups.
const AVATAR_POOL = [
  "avatar-emma",
  "avatar-alex",
  "avatar-grace",
  "avatar-priya",
  "avatar-leila",
  "avatar-theo",
  "avatar-p1",
  "avatar-p2",
  "avatar-p3",
  "avatar-p4",
  "avatar-p5",
  "avatar-p6",
];
patients.forEach((p, i) => {
  p["avatar_url"] = `/patient-avatars/${AVATAR_POOL[i % AVATAR_POOL.length]}.png`;
});

/* ---------------------------------------------------------------- */
/* mutable store                                                     */
/* ---------------------------------------------------------------- */


export const staffConversations: Row[] = [];
export const staffChatMessages: Row[] = [];
export const staffConversationReads: Row[] = [];

function seedStaffThread(a: string, b: string, lines: { from: string; body: string; daysAgo: number; hour: number }[]) {
  const [userLow, userHigh] = a < b ? [a, b] : [b, a];
  const conversationId = id("sc");
  staffConversations.push({
    id: conversationId,
    clinic_id: CLINIC_ID,
    user_low: userLow,
    user_high: userHigh,
    created_at: iso(-lines[lines.length - 1]!.daysAgo, 8, 0),
    updated_at: iso(-lines[0]!.daysAgo, lines[0]!.hour, 0),
  });
  for (const line of [...lines].reverse()) {
    staffChatMessages.push({
      id: id("sm"),
      conversation_id: conversationId,
      clinic_id: CLINIC_ID,
      sender_id: line.from,
      body: line.body,
      attachments: [],
      created_at: iso(-line.daysAgo, line.hour, between(0, 50)),
    });
  }
  staffConversationReads.push({
    id: id("sr"),
    conversation_id: conversationId,
    user_id: a,
    last_read_at: iso(0, 8, 0),
  });
  staffConversationReads.push({
    id: id("sr"),
    conversation_id: conversationId,
    user_id: b,
    last_read_at: iso(-1, 18, 0),
  });
}

seedStaffThread(USERS.owner, USERS.frontDesk, [
  { from: USERS.frontDesk, body: "Autoclave in room 2 failed its cycle. Engineer booked for 11.", daysAgo: 0, hour: 8 },
  { from: USERS.owner, body: "Thank you. Use room 1 and put a note on the door.", daysAgo: 0, hour: 8 },
  { from: USERS.frontDesk, body: "Done. Also chasing the two outstanding consent forms now.", daysAgo: 0, hour: 9 },
]);

seedStaffThread(USERS.owner, USERS.practitioner, [
  { from: USERS.practitioner, body: "We are down to two vials of Profhilo. Can we reorder before Friday?", daysAgo: 1, hour: 12 },
  { from: USERS.owner, body: "Yes — I'll sign the order this afternoon.", daysAgo: 1, hour: 13 },
  { from: USERS.practitioner, body: "Olivia's 15:00 still has no consent on file.", daysAgo: 0, hour: 14 },
]);

seedStaffThread(USERS.practitioner, USERS.frontDesk, [
  { from: USERS.frontDesk, body: "Your 11:00 called from the Northern line — about fifteen minutes behind.", daysAgo: 0, hour: 10 },
  { from: USERS.practitioner, body: "Thanks, I'll take the next one first if they are here.", daysAgo: 0, hour: 10 },
]);

seedStaffThread(USERS.practitioner2, USERS.frontDesk, [
  { from: USERS.practitioner2, body: "Room 2 is out of peel aftercare sheets. Could you print a pack?", daysAgo: 0, hour: 8 },
  { from: USERS.frontDesk, body: "Printing now — I'll leave them on the trolley.", daysAgo: 0, hour: 9 },
]);

seedStaffThread(USERS.owner, USERS.practitioner2, [
  { from: USERS.owner, body: "Can you cover Nadia's Thursday morning if her course overruns?", daysAgo: 2, hour: 17 },
  { from: USERS.practitioner2, body: "Yes — I can take the 09:30 and 10:15.", daysAgo: 2, hour: 18 },
  { from: USERS.owner, body: "Perfect. Sofia will move the diary.", daysAgo: 1, hour: 8 },
]);

export const formerTeamSeed = [
  {
    id: id("ex"),
    userId: USERS.former,
    email: "helen.cho@aetheria.clinic",
    fullName: "Dr Helen Cho",
    jobTitle: "Aesthetic Practitioner",
    registrationBody: "GMC",
    registrationNumber: "7018821",
    role: "practitioner",
    commissionRate: 40,
    revokedAt: iso(-21, 10, 0),
    retainUntil: iso(69, 10, 0),
    purgedAt: null,
  },
];

/* Named patients get clinical notes; a few roster rows miss contact details so
   the manager incomplete-profile chase has something to show. */
for (const [index, note] of [
  [0, "Penicillin allergy on file. Prefers Nadia. Portal user."],
  [1, "On levothyroxine — treat as usual. Afternoons only."],
  [2, "Lidocaine sensitivity. Use alternative if injecting."],
  [4, "On a peel course. Strict SPF."],
  [5, "Due a cheek filler review. Personal recall from Amara."],
  [6, "Often runs late. Confirm the morning of."],
  [8, "Prefers text. Six-month peel check-in due."],
  [9, "PRP — sleep on back after sessions."],
  [11, "Rosacea. Heat and alcohol flare."],
  [13, "Prefers Amara. Anti-ageing programme."],
  [16, "Insurance copy requested via portal chat."],
] as const) {
  const patient = patients[index];
  if (patient) patient["notes"] = note;
}

patients.forEach((patient, index) => {
  patient["email_opt_in"] = index % 3 !== 0;
  patient["sms_opt_in"] = index % 4 !== 0;
  patient["marketing_opt_in"] = index % 5 === 0;
  patient["reminders_opt_in"] = true;
});

for (const index of [40, 41, 43]) {
  const patient = patients[index];
  if (!patient) continue;
  patient["email"] = "";
  patient["phone"] = index === 43 ? "" : patient["phone"];
}
if (patients[42]) patients[42]!["date_of_birth"] = "";

const nowIsoForPlans = NOW.toISOString();
for (const milestone of planMilestones) {
  if (milestone["status"] !== "current") continue;
  const plan = treatmentPlans.find((p) => p["id"] === milestone["plan_id"]);
  if (!plan) continue;
  const upcoming = appointments.find(
    (a) =>
      a["patient_id"] === plan["patient_id"] &&
      a["starts_at"] >= nowIsoForPlans &&
      a["status"] === "booked",
  );
  if (upcoming) milestone["appointment_id"] = upcoming["id"];
}

userNotes.push(
  {
    id: id("q1"),
    user_id: USERS.practitioner,
    body: "Today\n\n- Confirm Olivia consent before 15:00\n- Reorder Profhilo\n- Eleanor recall — afternoons",
    created_at: iso(-3),
    updated_at: iso(0, 8, 10),
  },
  {
    id: id("q1"),
    user_id: USERS.frontDesk,
    body: "Front desk\n\n- Print peel aftercare for room 2\n- Chase two consent forms\n- Engineer for autoclave at 11",
    created_at: iso(-1),
    updated_at: iso(0, 8, 20),
  },
  {
    id: id("q1"),
    user_id: USERS.practitioner2,
    body: "List\n\n- Print aftercare pack for room 2\n- Cover Nadia Thursday 09:30 / 10:15\n- Rosacea laser follow-up",
    created_at: iso(-2),
    updated_at: iso(0, 7, 50),
  },
);

function patientByName(first: string, last: string) {
  return patients.find((p) => p["first_name"] === first && p["last_name"] === last) ?? null;
}

export const retailProducts: Row[] = [
  {
    id: id("r1"),
    clinic_id: CLINIC_ID,
    name: "Alumier MD Moisture Matte SPF 40",
    sku: "ALU-MM-40",
    price: 48,
    active: true,
    featured_on_portal: true,
    image_url: null,
    created_at: iso(-120),
    updated_at: iso(-12),
  },
  {
    id: id("r1"),
    clinic_id: CLINIC_ID,
    name: "SkinCeuticals C E Ferulic",
    sku: "SC-CEF-30",
    price: 166,
    active: true,
    featured_on_portal: true,
    image_url: null,
    created_at: iso(-200),
    updated_at: iso(-20),
  },
  {
    id: id("r1"),
    clinic_id: CLINIC_ID,
    name: "Obagi Medical Nu-Derm Toner",
    sku: "OB-ND-TON",
    price: 52,
    active: true,
    featured_on_portal: true,
    image_url: null,
    created_at: iso(-90),
    updated_at: iso(-8),
  },
  {
    id: id("r1"),
    clinic_id: CLINIC_ID,
    name: "iS Clinical Cleansing Complex",
    sku: "IS-CC-180",
    price: 44,
    active: true,
    featured_on_portal: false,
    image_url: null,
    created_at: iso(-60),
    updated_at: iso(-6),
  },
];

export const websiteLeads: Row[] = [];
export const productSales: Row[] = [];

{
  const named = [
    { first: "Isla", last: "Hartley", source: "website", interest: "Skin Consultation", days: 11 },
    { first: "Maya", last: "Quayle", source: "website", interest: "Lip Filler", days: 18 },
    { first: "Noor", last: "El-Amin", source: "instagram", interest: "Skin Consultation", days: 6 },
    { first: "Theo", last: "Langford", source: "website", interest: "Anti-Wrinkle Injections", days: 22 },
    { first: "Freya", last: "Nielsen", source: "website", interest: "Skin Consultation", days: 28 },
    { first: "Aisha", last: "Rahman", source: "website", interest: "Chemical Peel", days: 34 },
    { first: "Bea", last: "Moreau", source: "referral", interest: "Skin Consultation", days: 19 },
    { first: "Callum", last: "West", source: "website", interest: "Anti-Wrinkle Injections", days: 40 },
  ];
  for (const lead of named) {
    const patient = patientByName(lead.first, lead.last);
    websiteLeads.push({
      id: id("w1"),
      clinic_id: CLINIC_ID,
      patient_id: patient?.["id"] ?? null,
      external_id: `web-${lead.first.toLowerCase()}-${lead.last.toLowerCase()}`,
      first_name: lead.first,
      last_name: lead.last,
      email: patient?.["email"] ?? `${lead.first.toLowerCase()}.${lead.last.toLowerCase()}@example.com`,
      phone: patient?.["phone"] ?? null,
      source: lead.source,
      campaign: lead.source === "instagram" ? "stories-sept" : "homepage-consult",
      interest: lead.interest,
      occurred_at: iso(-lead.days, 10, 15),
      created_at: iso(-lead.days, 10, 15),
      updated_at: iso(-lead.days, 10, 15),
    });
  }
  websiteLeads.push({
    id: id("w1"),
    clinic_id: CLINIC_ID,
    patient_id: null,
    external_id: "web-standalone-harper",
    first_name: "Harper",
    last_name: "Voss",
    email: "harper.voss@example.com",
    phone: "07700 900118",
    source: "website",
    campaign: "homepage-consult",
    interest: "Skin Consultation",
    occurred_at: iso(-8, 14, 0),
    created_at: iso(-8, 14, 0),
    updated_at: iso(-8, 14, 0),
  });

  const olivia = patientByName("Olivia", "Bennett");
  const productBySku = new Map(retailProducts.map((p) => [p["sku"] as string, p]));
  const saleSpecs = [
    { sku: "SC-CEF-30", days: 21, qty: 1, amount: 166, patient: olivia },
    { sku: "ALU-MM-40", days: 14, qty: 1, amount: 48, patient: olivia },
    { sku: "ALU-MM-40", days: 9, qty: 2, amount: 96, patient: patientByName("Callum", "West") },
    { sku: "OB-ND-TON", days: 5, qty: 1, amount: 52, patient: null },
    { sku: "IS-CC-180", days: 3, qty: 1, amount: 44, patient: patientByName("Freya", "Nielsen") },
  ];
  for (const sale of saleSpecs) {
    const product = productBySku.get(sale.sku);
    productSales.push({
      id: id("s8"),
      clinic_id: CLINIC_ID,
      product_id: product?.["id"] ?? null,
      patient_id: sale.patient?.["id"] ?? null,
      external_id: `shop-${sale.sku}-${sale.days}`,
      source: "website",
      qty: sale.qty,
      amount: sale.amount,
      occurred_at: iso(-sale.days, 13, 20),
      created_at: iso(-sale.days, 13, 20),
    });
  }
}

export const db = {
  clinic,
  profiles,
  userRoles,
  rolePermissions,
  catalogue,
  patients,
  treatments,
  appointments,
  appointmentNotes,
  documents,
  messages,
  medicalHistory,
  photos,
  recallTasks,
  treatmentPlans,
  planMilestones,
  communications,
  retentionOutreach,
  staffNotifications,
  staffConversations,
  staffChatMessages,
  staffConversationReads,
  messageTemplates,
  treatmentColours,
  colourThemes,
  profileChangeRequests,
  staffDocuments,
  userNotes,
  staffEmails,
  websiteLeads,
  retailProducts,
  productSales,
};

export function newId(prefix = "z1") {
  return id(prefix);
}

export function patientName(patientId: string) {
  const patient = patients.find((p) => p["id"] === patientId);
  if (!patient) return "Patient";
  return `${patient["first_name"]} ${patient["last_name"]}`;
}

export function profileName(userId: string | null) {
  if (!userId) return null;
  return (profiles.find((p) => p["id"] === userId)?.["full_name"] as string | undefined) ?? null;
}
