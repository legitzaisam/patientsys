/**
 * Typed in-memory mock API.
 *
 * Every read returns a structured copy after a short simulated latency; every
 * mutation updates the in-memory DB and persists it to localStorage so the
 * demo state survives reloads. `resetDemoData()` restores the seed.
 */
import { makeSeed } from "./seed";
import type { Appointment, BoardCard, DB, Msg, Patient, Period } from "./types";

const KEY = "aetheria-v3";

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      if (parsed.version === 3) return parsed;
    }
  } catch {
    /* corrupted state falls back to seed */
  }
  return makeSeed();
}

let db: DB = load();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* quota errors are non-fatal in the demo */
  }
}

const delay = (ms = 150 + Math.random() * 150) => new Promise<void>((r) => setTimeout(r, ms));
const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export interface PatientQuery {
  q?: string;
  filter?: "All" | "Active" | "Inactive" | "Treatments due";
  sort?: "name" | "nextDue" | "paperwork" | "status";
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export const api = {
  // ---------------------------------------------------------------- patients
  async getPatients(q: PatientQuery = {}): Promise<{ rows: Patient[]; total: number }> {
    await delay();
    const { q: query = "", filter = "All", sort = "name", dir = "asc", page = 1, pageSize = 12 } = q;
    let rows = db.patients.slice();
    if (query.trim()) {
      const needle = query.trim().toLowerCase();
      rows = rows.filter(
        (p) => `${p.first} ${p.last}`.toLowerCase().includes(needle) || `${p.last} ${p.first}`.toLowerCase().includes(needle) || p.ref.toLowerCase().includes(needle),
      );
    }
    if (filter === "Active" || filter === "Inactive") rows = rows.filter((p) => p.status === filter);
    if (filter === "Treatments due") rows = rows.filter((p) => p.nextTreatment !== "No upcoming treatment");
    const cmp: Record<string, (a: Patient, b: Patient) => number> = {
      name: (a, b) => (a.last + a.first).localeCompare(b.last + b.first),
      nextDue: (a, b) => a.nextDue.split("/").reverse().join("").localeCompare(b.nextDue.split("/").reverse().join("")),
      paperwork: (a, b) => a.paperwork.localeCompare(b.paperwork),
      status: (a, b) => a.status.localeCompare(b.status),
    };
    rows.sort(cmp[sort] ?? cmp.name);
    if (dir === "desc") rows.reverse();
    const total = rows.length;
    rows = rows.slice((page - 1) * pageSize, page * pageSize);
    return { rows: copy(rows), total };
  },

  async getPatient(id: string): Promise<Patient | undefined> {
    await delay();
    return copy(db.patients.find((p) => p.id === id) ?? db.patients.find((p) => p.id === "grace-adeyemi"));
  },

  async createPatient(input: { first: string; last: string; email: string }): Promise<Patient> {
    await delay();
    const p: Patient = {
      id: `new-${Date.now()}`,
      ref: `AV-${9000 + db.patients.length}`,
      title: "Ms",
      first: input.first,
      last: input.last,
      dob: "01/01/1990",
      email: input.email,
      phone: "07700000000",
      status: "Active",
      lastTreatment: "—",
      lastTreatmentDate: "—",
      nextTreatment: "No upcoming treatment",
      nextDue: "—",
      paperwork: "Outstanding",
      practitionerId: "dn",
      visits: 0,
    };
    db.patients.unshift(p);
    persist();
    return copy(p);
  },

  // ------------------------------------------------------------------- diary
  async getDiary(dayOffset: number): Promise<Appointment[]> {
    await delay();
    return copy(db.appointments.filter((a) => a.dayOffset === dayOffset).sort((a, b) => a.start - b.start));
  },

  async createBooking(input: {
    patientName: string;
    treatment: string;
    practitionerId: string;
    start: number;
    durationMin: number;
    dayOffset: number;
  }): Promise<Appointment> {
    await delay();
    const t = (await import("./seed")).TREATMENTS.find((x) => x.name === input.treatment)!;
    const appt: Appointment = {
      id: `new-${Date.now()}`,
      dayOffset: input.dayOffset,
      start: input.start,
      end: input.start + input.durationMin,
      patientId: "grace-adeyemi",
      patientName: input.patientName,
      treatment: input.treatment,
      session: "#1",
      practitionerId: input.practitionerId,
      status: "Scheduled",
      accent: t.accent,
      tint: t.tint,
      paid: "Unpaid",
      consent: "Consent due",
    };
    db.appointments.push(appt);
    persist();
    return copy(appt);
  },

  // -------------------------------------------------------------------- plan
  async getPlan() {
    await delay();
    return copy(db.planSteps);
  },

  async toggleStepChecklist(stepId: string, itemId: string) {
    const step = db.planSteps.find((s) => s.id === stepId);
    const item = step?.checklist?.find((c) => c.id === itemId);
    if (item) item.done = !item.done;
    persist();
    return copy(step!);
  },

  async completeStep(stepId: string) {
    await delay(120);
    const step = db.planSteps.find((s) => s.id === stepId);
    if (step) {
      step.status = "done";
      step.checklist?.forEach((c) => (c.done = true));
      // Promote the next upcoming step to current.
      const next = db.planSteps.find((s) => s.status === "upcoming");
      if (next) next.status = "current";
    }
    persist();
    return copy(db.planSteps);
  },

  async uploadResult(stepId: string, fileName: string) {
    await delay(400);
    const step = db.planSteps.find((s) => s.id === stepId);
    const item = step?.checklist?.find((c) => c.label.toLowerCase().includes("upload"));
    if (item) {
      item.done = true;
      item.meta = fileName;
    }
    persist();
    return copy(step!);
  },

  // ----------------------------------------------------------- patient tasks
  async getFocus() {
    await delay(100);
    return copy(db.focusTasks);
  },
  async toggleFocus(id: string) {
    const t = db.focusTasks.find((x) => x.id === id);
    if (t) t.done = !t.done;
    persist();
    return copy(db.focusTasks);
  },
  async getGarden() {
    await delay(100);
    return copy({ tasks: db.gardenTasks, notifs: db.radiantNotifs, dayComplete: db.dayComplete, routine: db.routineDays });
  },
  async toggleGardenTask(id: string) {
    const t = db.gardenTasks.find((x) => x.id === id);
    if (t) t.done = !t.done;
    persist();
    return copy(db.gardenTasks);
  },
  async markDayComplete() {
    await delay(250);
    db.dayComplete = true;
    db.gardenTasks.forEach((t) => (t.done = true));
    db.routineDays = { am: Math.min(7, db.routineDays.am + 1), pm: Math.min(7, db.routineDays.pm + 1) };
    persist();
    return copy({ tasks: db.gardenTasks, dayComplete: db.dayComplete, routine: db.routineDays });
  },
  async toggleNotif(id: string) {
    const n = db.radiantNotifs.find((x) => x.id === id);
    if (n) n.on = !n.on;
    persist();
    return copy(db.radiantNotifs);
  },
  async setSlider(key: "redness" | "sensitivity" | "dryness", value: number) {
    db.sliders[key] = value;
    persist();
    return copy(db.sliders);
  },
  async getSliders() {
    await delay(80);
    return copy(db.sliders);
  },

  // ------------------------------------------------------------- preferences
  async getPrefs() {
    await delay(80);
    return copy(db.prefs);
  },
  async setPref(key: keyof DB["prefs"], value: boolean) {
    db.prefs[key] = value;
    persist();
    return copy(db.prefs);
  },

  // ---------------------------------------------------------------- messages
  async getThread(threadId: string): Promise<Msg[]> {
    await delay(120);
    return copy(db.threads[threadId] ?? []);
  },
  async sendMessage(threadId: string, from: Msg["from"], author: string, text: string) {
    await delay(200);
    const msg: Msg = { id: `m-${Date.now()}`, from, author, text, at: "Just now" };
    (db.threads[threadId] ??= []).push(msg);
    persist();
    return copy(db.threads[threadId]);
  },

  // --------------------------------------------------------------- clinic ops
  async getContactTasks() {
    await delay(100);
    return copy(db.contactTasks);
  },
  async markContacted(id: string) {
    const t = db.contactTasks.find((x) => x.id === id);
    if (t) t.contacted = true;
    persist();
    return copy(db.contactTasks);
  },
  async getClinActions() {
    await delay(80);
    return copy(db.clinActions);
  },
  async toggleClinAction(id: string) {
    const a = db.clinActions.find((x) => x.id === id);
    if (a) a.done = !a.done;
    persist();
    return copy(db.clinActions);
  },
  async getPrepChecklist() {
    await delay(80);
    return copy(db.prepChecklist);
  },
  async togglePrep(id: string) {
    const p = db.prepChecklist.find((x) => x.id === id);
    if (p) p.done = !p.done;
    persist();
    return copy(db.prepChecklist);
  },
  async getAtRisk() {
    await delay(120);
    return copy(db.atRisk);
  },
  async sendReminder(id: string) {
    await delay(300);
    const r = db.atRisk.find((x) => x.id === id);
    if (r) r.sent = true;
    persist();
    return copy(db.atRisk);
  },
  async getNotes() {
    await delay(80);
    return copy({ myNotes: db.myNotes, clinicNotes: db.clinicNotes, planNote: db.planNote });
  },
  async setPlanNote(text: string) {
    await delay(150);
    db.planNote = text;
    persist();
    return db.planNote;
  },

  // ------------------------------------------------------------------- board
  async getBoard(filters: { atRiskOnly?: boolean; q?: string; practitionerId?: string } = {}): Promise<BoardCard[]> {
    await delay(150);
    let rows = db.boardCards.slice();
    if (filters.atRiskOnly) rows = rows.filter((c) => c.atRisk);
    if (filters.practitionerId && filters.practitionerId !== "all") rows = rows.filter((c) => c.practitionerId === filters.practitionerId);
    if (filters.q?.trim()) {
      const needle = filters.q.trim().toLowerCase();
      rows = rows.filter((c) => c.name.toLowerCase().includes(needle) || c.plan.toLowerCase().includes(needle));
    }
    return copy(rows);
  },

  // ------------------------------------------------------------- performance
  async getPerformance(period: Period) {
    await delay(200);
    return copy(db.performance[period]);
  },

  async getPractitioners() {
    await delay(60);
    return copy(db.practitioners);
  },

  // ------------------------------------------------------------------- reset
  async resetDemoData() {
    await delay(200);
    db = makeSeed();
    persist();
  },
};

export type Api = typeof api;
