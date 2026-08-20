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
} as const;

export type DemoRole = "owner" | "practitioner" | "front_desk" | "patient";

export const DEMO_ACCOUNTS: Record<DemoRole, { userId: string; email: string; label: string }> = {
  owner: { userId: USERS.owner, email: "amara.osei@aetheria.clinic", label: "Manager" },
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

const NOW = new Date();
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
  created_at: iso(-720),
  updated_at: iso(-14),
};

export const profiles: Row[] = [
  {
    id: USERS.owner,
    clinic_id: CLINIC_ID,
    full_name: "Dr Amara Osei",
    job_title: "Clinic Director",
    registration_body: "GMC",
    registration_number: "7412885",
    avatar_url: null,
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
    avatar_url: null,
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
    avatar_url: null,
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
    avatar_url: null,
    commission_rate: 0,
    created_at: iso(-300),
    updated_at: iso(-45),
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
  { role: "practitioner", permission: "reports.retention", enabled: true },
  { role: "practitioner", permission: "reports.performance", enabled: false },
  { role: "practitioner", permission: "team.view", enabled: true },
  { role: "practitioner", permission: "team.approve_changes", enabled: false },
  { role: "practitioner", permission: "settings.treatments", enabled: false },
  { role: "practitioner", permission: "notifications.delete", enabled: true },
  { role: "practitioner", permission: "tasks.delete", enabled: false },
  { role: "front_desk", permission: "reports.retention", enabled: true },
  { role: "front_desk", permission: "reports.performance", enabled: false },
  { role: "front_desk", permission: "team.view", enabled: false },
  { role: "front_desk", permission: "team.approve_changes", enabled: false },
  { role: "front_desk", permission: "settings.treatments", enabled: true },
  { role: "front_desk", permission: "notifications.delete", enabled: false },
  { role: "front_desk", permission: "tasks.delete", enabled: false },
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
    ...(upcoming ? { upcoming } : {}),
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
  last_visit_at: iso(-spec.lastVisit, 11, 0),
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

patients.slice(0, 18).forEach((patient, index) => {
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
      spec.lastVisit - 1,
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
});

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
    storage_path: "/demo-photos/olivia-before-1.jpg",
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
    storage_path: "/demo-photos/olivia-after-1.jpg",
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
    storage_path: "/demo-photos/olivia-before-2.jpg",
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
    storage_path: "/demo-photos/olivia-after-2.jpg",
    kind: "after",
    caption: "Two week review",
    taken_at: iso(-7, 10, 0),
    marketing_consent: false,
    visible_to_patient: true,
    created_at: iso(-7, 10, 0),
  },
];

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
];

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
];

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
    status: "sent",
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
    status: "sent",
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
    status: "sent",
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
    status: "sent",
    contacted_at: null,
    contacted_by: null,
    completed_at: null,
    completed_by: null,
    status_by_label: null,
    created_at: iso(-2, 8, 30),
    updated_at: iso(-2, 8, 30),
  },
];

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
];

export const messageTemplates: Row[] = [
  {
    id: id("m1"),
    clinic_id: CLINIC_ID,
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
    title: "Balance outstanding",
    body: "Hi {{first_name}}, there is a small balance outstanding on your last visit. You can settle it in the portal or we can take it at your next appointment.",
    category: "Payments",
    created_by: USERS.frontDesk,
    created_at: iso(-45),
    updated_at: iso(-45),
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

/* ---------------------------------------------------------------- */
/* mutable store                                                     */
/* ---------------------------------------------------------------- */

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
  retentionOutreach,
  staffNotifications,
  messageTemplates,
  treatmentColours,
  colourThemes,
  profileChangeRequests,
  staffDocuments,
  userNotes,
  staffEmails,
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
