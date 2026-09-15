export type Period = "month" | "lastMonth" | "year";

export interface Practitioner {
  id: string;
  initials: string;
  name: string;
  role: string;
  bg: string;
  fg: string;
}

export interface Patient {
  id: string;
  ref: string;
  title: string;
  first: string;
  last: string;
  dob: string;
  email: string;
  phone: string;
  status: "Active" | "Inactive";
  lastTreatment: string;
  lastTreatmentDate: string;
  nextTreatment: string;
  nextDue: string;
  paperwork: "Complete" | "Outstanding";
  practitionerId: string;
  visits: number;
  avatar?: string;
}

export interface Appointment {
  id: string;
  /** Day relative to the demo "today" (0 = today). */
  dayOffset: number;
  /** Minutes from midnight. */
  start: number;
  end: number;
  patientId: string;
  patientName: string;
  treatment: string;
  session: string;
  practitionerId: string;
  status: "Complete" | "Aftercare" | "Scheduled";
  /** Treatment colour pair (accent + tint) used by the diaries. */
  accent: string;
  tint: string;
  paid: "Paid" | "Deposit paid" | "Unpaid";
  consent: "Consent" | "Consent due";
}

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  meta?: string;
}

export interface PlanStep {
  id: string;
  n: number;
  title: string;
  date: string;
  month: 0 | 1 | 2;
  status: "done" | "current" | "conditional" | "upcoming";
  desc: string;
  due?: string;
  state?: string;
  checklist?: ChecklistItem[];
  note?: string;
}

export interface Msg {
  id: string;
  from: "clinic" | "patient";
  author: string;
  text: string;
  at: string;
}

export interface SimpleTask {
  id: string;
  label: string;
  sub?: string;
  done: boolean;
}

export interface ContactTask {
  id: string;
  initials: string;
  bg: string;
  fg: string;
  name: string;
  desc: string;
  contacted: boolean;
}

export interface RiskRow {
  id: string;
  initials: string;
  name: string;
  phase: string;
  phaseTone: "mint" | "blue" | "slate";
  lastVisit: string;
  nextStep: string;
  reason: string;
  action: string;
  sent: boolean;
}

export interface BoardCard {
  id: string;
  col: 0 | 1 | 2 | 3;
  initials: string;
  name: string;
  plan: string;
  frac: string;
  next: string;
  when: string;
  tone: "mint" | "amber" | "red";
  label: string;
  atRisk: boolean;
  practitionerId: string;
}

export interface PerfSeries {
  earn: number[];
  coll: number[];
  appt: number[];
  att: number[];
  nosh: number[];
  stats: { earned: string; collected: string; toPract: string; retained: string };
}

export interface Notif {
  id: string;
  label: string;
  on: boolean;
}

export interface DB {
  version: number;
  practitioners: Practitioner[];
  patients: Patient[];
  appointments: Appointment[];
  planSteps: PlanStep[];
  /** Lumina/Radiant per-day patient tasks. */
  focusTasks: SimpleTask[];
  gardenTasks: SimpleTask[];
  radiantNotifs: Notif[];
  dayComplete: boolean;
  routineDays: { am: number; pm: number };
  sliders: { redness: number; sensitivity: number; dryness: number };
  prefs: { reminders: boolean; marketingEmail: boolean; marketingText: boolean };
  threads: Record<string, Msg[]>;
  contactTasks: ContactTask[];
  clinActions: ChecklistItem[];
  prepChecklist: ChecklistItem[];
  atRisk: RiskRow[];
  boardCards: BoardCard[];
  performance: Record<Period, PerfSeries>;
  myNotes: string[];
  clinicNotes: string[];
  planNote: string;
}
