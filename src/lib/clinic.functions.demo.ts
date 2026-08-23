/**
 * Demo stand-in for `clinic.functions.ts`.
 *
 * Same exported names and return shapes, but every handler reads from the
 * in-memory fixture clinic in `./demo/data` instead of Supabase, and none of
 * them require an authenticated session. Vite swaps this module in when the
 * app is started with `npm run dev:demo`.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import {
  CLINIC_ID,
  DEMO_ACCOUNTS,
  USERS,
  db,
  newId,
  profileName,
  type DemoRole,
} from "@/lib/demo/data";
import { clampDurationMinutes } from "@/lib/treatment-duration";
import { clinicDayDiff, clinicDayKey } from "@/lib/clinic-time";
import { sanitizeNoteHtml } from "@/lib/sanitize-note-html";
import {
  findPractitionerOverlap,
  PRACTITIONER_OVERLAP_MESSAGE,
} from "@/lib/appointment-overlap";
import { bookingDetailsMessage, type PaymentLinkKind } from "@/lib/payment-link";
import { assertEmail } from "@/lib/email";

export const PERMISSION_KEYS = [
  "reports.retention",
  "reports.performance",
  "team.view",
  "team.approve_changes",
  "settings.treatments",
  "notifications.delete",
  "tasks.delete",
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];

const patients = db.patients as any[];
const profiles = db.profiles as any[];
const userRoles = db.userRoles as any[];
const rolePermissions = db.rolePermissions as any[];
const catalogue = db.catalogue as any[];
const treatments = db.treatments as any[];
const appointments = db.appointments as any[];
const appointmentNotes = db.appointmentNotes as any[];
const documents = db.documents as any[];
const messages = db.messages as any[];
const medicalHistory = db.medicalHistory as any[];
const photos = db.photos as any[];
const recallTasks = db.recallTasks as any[];
const retentionOutreach = db.retentionOutreach as any[];
const staffNotifications = db.staffNotifications as any[];
const staffConversations = db.staffConversations as any[];
const staffChatMessages = db.staffChatMessages as any[];
const staffConversationReads = db.staffConversationReads as any[];
const messageTemplates = db.messageTemplates as any[];
const treatmentColours = db.treatmentColours as any[];
const colourThemes = db.colourThemes as any[];
const profileChangeRequests = db.profileChangeRequests as any[];
const staffDocuments = db.staffDocuments as any[];
const userNotes = db.userNotes as any[];

/* ---------------------------------------------------------------- */
/* identity — driven by the demo_role cookie                          */
/* ---------------------------------------------------------------- */

function currentRole(): DemoRole {
  let cookie = "";
  try {
    cookie = getRequest()?.headers.get("cookie") ?? "";
  } catch {
    cookie = "";
  }
  const value = /(?:^|;\s*)demo_role=([^;]+)/.exec(cookie)?.[1];
  if (
    value === "practitioner" ||
    value === "front_desk" ||
    value === "patient" ||
    value === "owner"
  ) {
    return value;
  }
  return "owner";
}

/** userIds that must change password after invite/reset */
const mustChangePasswordByUser = new Set<string>();
/** Newly invited demo staff until they dismiss the welcome dialog. */
const welcomePendingByUser = new Set<string>();

type ExTeamMember = {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  jobTitle: string;
  registrationBody: string;
  registrationNumber: string;
  role: string;
  commissionRate: number | null;
  revokedAt: string;
  retainUntil: string;
  purgedAt: string | null;
};

const EX_TEAM_RETAIN_DAYS = 90;
const exTeamMembers: ExTeamMember[] = [];

function retainUntilFrom(revokedAt = new Date()) {
  return new Date(revokedAt.getTime() + EX_TEAM_RETAIN_DAYS * 86400000).toISOString();
}

function purgeExpiredExTeamMembersDemo() {
  const now = Date.now();
  for (const row of exTeamMembers) {
    if (row.purgedAt) continue;
    if (new Date(row.retainUntil).getTime() > now) continue;
    const formerLabel = `Former - ${row.fullName.trim() || "team member"}`;
    row.purgedAt = new Date().toISOString();
    row.email = "";
    row.fullName = formerLabel;
    row.jobTitle = "";
    row.registrationBody = "";
    row.registrationNumber = "";
    row.commissionRate = null;
    const profile = profiles.find((p) => p.id === row.userId);
    if (profile) {
      profile.full_name = formerLabel;
      profile.job_title = null;
      profile.registration_body = null;
      profile.registration_number = null;
      profile.avatar_url = null;
      profile.commission_rate = 0;
    }
    // Clinical data (patients, appointments, treatments) is intentionally untouched.
  }
}

function clearExTeamArchiveDemo(userId: string) {
  for (let i = exTeamMembers.length - 1; i >= 0; i--) {
    const row = exTeamMembers[i]!;
    if (row.userId === userId && !row.purgedAt) exTeamMembers.splice(i, 1);
  }
}


type Identity = {
  userId: string;
  email: string;
  roles: string[];
  isStaff: boolean;
  isOwner: boolean;
  isManager: boolean;
  canDelete: boolean;
  isPatient: boolean;
  permissions: string[];
  profile: any;
  patient: any;
  mustChangePassword: boolean;
  welcomePending: boolean;
};

function identity(): Identity {
  const role = currentRole();
  const account = DEMO_ACCOUNTS[role];
  const isStaff = role !== "patient";
  const isOwner = role === "owner";
  const isManager = isOwner || role === "manager";
  const permissions = isOwner
    ? [...PERMISSION_KEYS]
    : rolePermissions
        .filter((p) => p.enabled && p.role === role)
        .map((p) => p.permission as string);
  const profile = profiles.find((p) => p.id === account.userId) ?? null;
  const linked = patients.find((p) => p.user_id === account.userId);
  return {
    userId: account.userId,
    email: account.email,
    roles: [role],
    isStaff,
    isOwner,
    isManager,
    canDelete: isOwner,
    isPatient: !isStaff,
    permissions,
    profile,
    mustChangePassword: mustChangePasswordByUser.has(account.userId),
    welcomePending: isStaff && welcomePendingByUser.has(account.userId),
    patient: linked
      ? { id: linked.id, first_name: linked.first_name, last_name: linked.last_name }
      : null,
  };
}

function requireStaff() {
  const me = identity();
  if (!me.isStaff) throw new Error("Staff access only");
  return me;
}

/* ---------------------------------------------------------------- */
/* lookups and joins                                                  */
/* ---------------------------------------------------------------- */

const patientById = (id: string) => patients.find((p) => p.id === id) ?? null;

function patientJoin(id: string) {
  const p = patientById(id);
  if (!p) return null;
  return {
    first_name: p.first_name,
    last_name: p.last_name,
    reference: p.reference,
    email: p.email,
    phone: p.phone,
    id: p.id,
  };
}

function appointmentView(a: any) {
  const doc = a.consent_document_id ? documents.find((d) => d.id === a.consent_document_id) : null;
  const note = appointmentNotes.find((n) => n.appointment_id === a.id);
  return {
    ...a,
    patients: patientJoin(a.patient_id),
    profiles: a.practitioner_id ? { full_name: profileName(a.practitioner_id) } : null,
    documents: doc ? { status: doc.status, title: doc.title } : null,
    appointment_notes: note
      ? {
          body: note.body ?? "",
          updated_at: note.updated_at ?? null,
          updated_by_label: note.updated_by_label ?? null,
        }
      : null,
  };
}

function isoDaysAgo(days: number) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function sortDesc(list: any[], key: string) {
  return [...list].sort((a, b) => (a[key] < b[key] ? 1 : -1));
}

function sortAsc(list: any[], key: string) {
  return [...list].sort((a, b) => (a[key] > b[key] ? 1 : -1));
}

/* ---------------------------------------------------------------- */
/* identity + dashboard                                               */
/* ---------------------------------------------------------------- */

export const getMe = createServerFn({ method: "GET" }).handler(async () => identity());

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const me = identity();
  const today = new Date();
  const in30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const weekAhead = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
  const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();

  // The fixtures build the day in local time so the dashboard and the diary
  // (which renders in the browser's timezone) agree on what "today" contains.
  const range = {
    startISO: new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString(),
    endISO: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString(),
  };
  const isManager = me.isManager;
  const isPractitioner = me.roles.includes("practitioner");
  const isFrontDesk = me.roles.includes("front_desk");

  const all = patients;
  let dueAll = treatments.filter((t) => t.next_due_at && t.next_due_at <= in30);
  let monthTreats = treatments.filter((t) => t.performed_at >= monthStart);
  let prevMonthTreats = treatments.filter(
    (t) => t.performed_at >= prevMonthStart && t.performed_at < prevMonthEnd,
  );
  let todayAppts = sortAsc(
    appointments.filter((a) => a.starts_at >= range.startISO && a.starts_at < range.endISO),
    "starts_at",
  ).map(appointmentView);

  if (isPractitioner && !isManager) {
    dueAll = dueAll.filter((t) => t.practitioner_id === me.userId || !t.practitioner_id);
    monthTreats = monthTreats.filter((t) => t.practitioner_id === me.userId);
    prevMonthTreats = prevMonthTreats.filter((t) => t.practitioner_id === me.userId);
    todayAppts = todayAppts.filter((a) => a.practitioner_id === me.userId);
  }

  const todayISO = clinicDayKey(today);
  const treatmentsOverdue = dueAll.filter((t) => t.next_due_at && t.next_due_at < todayISO).length;
  const treatmentsDueSoon = dueAll.filter((t) => t.next_due_at && t.next_due_at >= todayISO).length;
  let due = sortAsc(dueAll, "next_due_at")
    .slice(0, 12)
    .map((t) => ({ ...t, patients: patientJoin(t.patient_id) }));

  const active = all.filter((p) => p.status === "active").length;
  const inactive = all.filter((p) => p.status !== "active").length;

  const yearAgoMs = today.getTime() - 365 * 86400000;
  const twoYearsAgoMs = today.getTime() - 730 * 86400000;
  const seen = new Map<string, number>();
  const seenPrev = new Map<string, number>();
  for (const t of treatments) {
    const ms = new Date(t.performed_at).getTime();
    if (ms >= yearAgoMs) seen.set(t.patient_id, (seen.get(t.patient_id) ?? 0) + 1);
    else if (ms >= twoYearsAgoMs) seenPrev.set(t.patient_id, (seenPrev.get(t.patient_id) ?? 0) + 1);
  }
  const returning = [...seen.values()].filter((n) => n > 1).length;
  const retention = seen.size ? Math.round((returning / seen.size) * 100) : 0;
  const returningPrev = [...seenPrev.values()].filter((n) => n > 1).length;
  const retentionPrev = seenPrev.size ? Math.round((returningPrev / seenPrev.size) * 100) : 0;

  const revenue = monthTreats.reduce((sum, t) => sum + Number(t.price ?? 0), 0);
  const prevRevenue = prevMonthTreats.reduce((sum, t) => sum + Number(t.price ?? 0), 0);
  const revenueChange = prevRevenue ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : 0;

  const newPatientsThisMonth = all.filter(
    (p) => new Date(p.created_at) >= new Date(monthStart),
  ).length;
  const newPatientsPrevMonth = all.filter(
    (p) => p.created_at >= prevMonthStart && p.created_at < prevMonthEnd,
  ).length;
  const patientChange = newPatientsPrevMonth
    ? Math.round(((newPatientsThisMonth - newPatientsPrevMonth) / newPatientsPrevMonth) * 100)
    : 0;

  const pendingDocs = sortAsc(
    documents.filter((d) => d.status === "sent" || d.status === "viewed"),
    "sent_at",
  )
    .slice(0, 10)
    .map((d) => ({ ...d, patients: patientJoin(d.patient_id) }));

  const historyFlags = sortDesc(
    medicalHistory.filter((h) => !h.reviewed_at && h.source === "patient"),
    "created_at",
  )
    .slice(0, 10)
    .map((h) => ({ ...h, patients: patientJoin(h.patient_id) }));

  const unread = sortDesc(
    messages.filter((m) => !m.read_at && m.author === "patient"),
    "created_at",
  ).slice(0, 10);

  const pendingConsents = pendingDocs.filter((d) => d.kind === "consent").length;

  const attentionItems: any[] = [];
  for (const a of todayAppts) {
    const stage =
      a.stage ??
      (a.status === "no_show" ? "no_show" : a.status === "attended" ? "complete" : "booked");
    const who = `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""}`.trim();
    const at = new Date(a.starts_at).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
    if (stage === "no_show") {
      attentionItems.push({
        id: `no-show-${a.id}`,
        kind: "no_show",
        urgency: "urgent",
        title: `${who} — no show`,
        subtitle: `${a.treatment_name} · ${at}`,
        patientId: a.patient_id,
        appointmentId: a.id,
      });
    }
    if (a.documents?.status !== "signed") {
      attentionItems.push({
        id: `consent-${a.id}`,
        kind: "consent_due",
        urgency: "urgent",
        title: `${who} — consent due`,
        subtitle: `${a.treatment_name}`,
        patientId: a.patient_id,
        appointmentId: a.id,
      });
    }
    if (a.payment_status === "deposit_paid") {
      attentionItems.push({
        id: `payment-${a.id}`,
        kind: "balance_due",
        urgency: "urgent",
        title: `${who} — balance due`,
        subtitle: `${a.treatment_name}`,
        patientId: a.patient_id,
        appointmentId: a.id,
      });
    }
  }

  const DEPOSIT_LEAD_DAYS = 3;
  let unpaidDeposits = sortAsc(
    appointments.filter(
      (a) =>
        a.payment_status === "unpaid" &&
        a.status !== "cancelled" &&
        a.starts_at >= range.startISO &&
        a.starts_at < new Date(today.getTime() + 30 * 86400000).toISOString(),
    ),
    "starts_at",
  ).map(appointmentView);
  if (isPractitioner && !isManager) {
    unpaidDeposits = unpaidDeposits.filter((a) => a.practitioner_id === me.userId);
  }
  for (const a of unpaidDeposits) {
    const who = `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""}`.trim() || "Patient";
    const apptDay = clinicDayKey(new Date(a.starts_at));
    const daysUntil = clinicDayDiff(todayISO, apptDay);
    if (daysUntil < 0) continue;
    const when = new Date(a.starts_at).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    const urgent = daysUntil <= DEPOSIT_LEAD_DAYS;
    attentionItems.push({
      id: `deposit-${a.id}`,
      kind: "deposit_due",
      urgency: urgent ? "urgent" : "this_week",
      title: `${who} — deposit unpaid`,
      subtitle: `${a.treatment_name} · ${when}`,
      patientId: a.patient_id,
      appointmentId: a.id,
    });
  }

  for (const t of due.filter((x) => x.next_due_at && x.next_due_at <= weekAhead)) {
    attentionItems.push({
      id: `due-${t.id}`,
      kind: "treatment_due",
      urgency: "this_week",
      title: `${t.patients?.first_name ?? ""} ${t.patients?.last_name ?? ""} — ${t.name}`,
      subtitle: `Due ${new Date(t.next_due_at).toLocaleDateString("en-GB")}`,
      patientId: t.patient_id,
    });
  }
  for (const m of unread) {
    const p = patientById(m.patient_id);
    attentionItems.push({
      id: `msg-${m.id}`,
      kind: "message",
      urgency: "this_week",
      title: `${p?.first_name ?? ""} ${p?.last_name ?? ""} — new message`,
      subtitle: m.body.slice(0, 60) + (m.body.length > 60 ? "…" : ""),
      patientId: m.patient_id,
    });
  }

  return {
    kpis: {
      totalClients: all.length,
      activeClients: active,
      inactiveClients: inactive,
      retention,
      retentionChange: retentionPrev ? retention - retentionPrev : 0,
      repeatClients: returning,
      oneVisitClients: seen.size - returning,
      treatmentsDue: treatmentsDueSoon + treatmentsOverdue,
      treatmentsDueSoon,
      treatmentsOverdue,
      pendingConsents,
      revenueMonth: revenue,
      treatmentsMonth: monthTreats.length,
      revenueChange,
      patientChange,
    },
    todayAppointments: todayAppts,
    attentionItems,
    due,
    pendingDocuments: pendingDocs,
    historyFlags,
    role: { isManager, isPractitioner, isFrontDesk },
  };
});

/* ---------------------------------------------------------------- */
/* patients                                                           */
/* ---------------------------------------------------------------- */

export const listPatients = createServerFn({ method: "GET" }).handler(async () => {
  const nowIso = new Date().toISOString();
  return [...patients]
    .sort(
      (a, b) => a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name),
    )
    .map((p) => {
      const mine = treatments.filter((t) => t.patient_id === p.id);
      const last = sortDesc(mine, "performed_at")[0] ?? null;
      const dueRow =
        sortAsc(
          mine.filter((t) => t.next_due_at),
          "next_due_at",
        )[0] ?? null;
      const next =
        sortAsc(
          appointments.filter(
            (a) => a.patient_id === p.id && a.starts_at >= nowIso && a.status === "booked",
          ),
          "starts_at",
        )[0] ?? null;
      return {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        title: p.title,
        date_of_birth: p.date_of_birth,
        status: p.status,
        reference: p.reference,
        last_visit_at: p.last_visit_at,
        allergies: p.allergies,
        avatar_url: p.avatar_url,
        lastTreatment: last
          ? { name: last.name, performed_at: last.performed_at, next_due_at: last.next_due_at }
          : null,
        nextDue: dueRow
          ? {
              name: dueRow.name,
              performed_at: dueRow.performed_at,
              next_due_at: dueRow.next_due_at,
            }
          : null,
        nextAppointment: next
          ? {
              treatment_name: next.treatment_name,
              treatment_number: next.treatment_number,
              starts_at: next.starts_at,
              status: next.status,
            }
          : null,
        outstandingDocuments: documents.filter(
          (d) => d.patient_id === p.id && (d.status === "sent" || d.status === "viewed"),
        ).length,
      };
    });
});

export const getPatient = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const patient = patientById(data.id);
    if (!patient) throw new Error("Patient not found");
    const nowIso = new Date().toISOString();
    const mine = sortDesc(
      treatments.filter((t) => t.patient_id === data.id),
      "performed_at",
    ).map((t) => ({
      ...t,
      profiles: { full_name: profileName(t.practitioner_id) },
    }));
    const upcoming = appointments.filter(
      (a) =>
        a.patient_id === data.id &&
        a.starts_at >= nowIso &&
        a.status !== "cancelled" &&
        a.status !== "no_show",
    );
    const visitNotes = sortDesc(
      appointments.filter((a) => a.patient_id === data.id),
      "starts_at",
    )
      .map((a) => {
        const view = appointmentView(a);
        const fromTable = String(view.appointment_notes?.body ?? "").trim();
        const booking = String(a.notes ?? "")
          .replace(/^Cancelled:[^\n]*(?:\n\n)?/, "")
          .trim();
        const body = fromTable || booking;
        if (!body) return null;
        return {
          appointmentId: a.id as string,
          treatmentName: (a.treatment_name as string) || "Treatment",
          treatmentNumber: a.treatment_number ?? null,
          startsAt: a.starts_at as string,
          status: a.status as string,
          practitionerName: view.profiles?.full_name ?? null,
          body,
          updatedAt: view.appointment_notes?.updated_at ?? null,
          updatedBy: view.appointment_notes?.updated_by_label ?? null,
        };
      })
      .filter(Boolean);
    const bookingChase = sortAsc(upcoming, "starts_at")
      .map((a) => {
        const view = appointmentView(a);
        const docStatus = view.documents?.status;
        const issues: string[] = [];
        if (a.payment_status === "unpaid") issues.push("Deposit unpaid");
        if (a.payment_status === "deposit_paid") issues.push("Balance due");
        if (docStatus !== "signed") issues.push("Consent due");
        return {
          id: a.id as string,
          startsAt: a.starts_at as string,
          treatmentName: (a.treatment_name as string) || "Treatment",
          practitionerName: view.profiles?.full_name ?? null,
          paymentStatus: (a.payment_status as string) ?? "unpaid",
          consentSigned: docStatus === "signed",
          issues,
        };
      })
      .filter((b) => b.issues.length > 0);
    const { patientRetention } = await import("./retention.server");
    return {
      patient,
      treatments: mine,
      photos: sortAsc(
        photos.filter((p) => p.patient_id === data.id),
        "taken_at",
      ).map((p) => ({
        ...p,
        url: p.storage_path,
      })),
      documents: sortDesc(
        documents.filter((d) => d.patient_id === data.id),
        "created_at",
      ),
      messages: sortAsc(
        messages.filter((m) => m.patient_id === data.id),
        "created_at",
      ),
      history: sortDesc(
        medicalHistory.filter((h) => h.patient_id === data.id),
        "created_at",
      ),
      visitNotes,
      bookingChase,
      retention: patientRetention(
        mine.map((t) => ({ performed_at: t.performed_at, next_due_at: t.next_due_at })),
        upcoming.length > 0,
      ),
      nextAppointmentAt: sortAsc(upcoming, "starts_at")[0]?.starts_at ?? null,
    };
  });

export const savePatient = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id?: string;
      first_name: string;
      last_name: string;
      title?: string;
      email?: string;
      phone?: string;
      date_of_birth?: string;
      status?: string;
      allergies?: string;
      medications?: string;
      conditions?: string;
      notes?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const email = assertEmail(data.email ?? "", "email address", true);
    if (data.id) {
      const row = patientById(data.id);
      if (row) Object.assign(row, { ...data, email, updated_at: new Date().toISOString() });
      return { id: data.id };
    }
    const created = {
      id: newId("d9"),
      clinic_id: CLINIC_ID,
      user_id: null,
      reference: `AV-${Math.floor(1000 + Math.random() * 8999)}`,
      title: data.title ?? null,
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      date_of_birth: data.date_of_birth ?? null,
      email,
      phone: data.phone ?? null,
      status: data.status ?? "active",
      allergies: data.allergies ?? null,
      medications: data.medications ?? null,
      conditions: data.conditions ?? null,
      notes: data.notes ?? null,
      avatar_url: null,
      last_visit_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    patients.push(created);
    return { id: created.id };
  });

/* ---------------------------------------------------------------- */
/* catalogue, practitioners, appointments                             */
/* ---------------------------------------------------------------- */

export const getCatalogue = createServerFn({ method: "GET" }).handler(async () =>
  catalogue
    .filter((c) => c.active)
    .sort((a, b) => String(a.category).localeCompare(String(b.category))),
);

export const listPractitioners = createServerFn({ method: "GET" }).handler(async () => {
  const ids = userRoles.filter((r) => r.role === "practitioner").map((r) => r.user_id);
  return profiles
    .filter((p) => ids.includes(p.id))
    .map((p) => ({ id: p.id, full_name: p.full_name, job_title: p.job_title }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
});

export const listAppointments = createServerFn({ method: "GET" })
  .validator((data: { from: string; to: string }) => data)
  .handler(async ({ data }) =>
    sortAsc(
      appointments.filter((a) => a.starts_at >= data.from && a.starts_at < data.to),
      "starts_at",
    ).map(appointmentView),
  );

export const saveAppointment = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id?: string;
      patient_id: string;
      practitioner_id?: string;
      catalogue_id?: string;
      treatment_name: string;
      treatment_number: number;
      starts_at: string;
      duration_minutes: number;
      price?: number;
      payment_status?: string;
      consent_document_id?: string;
      notes?: string;
      app_origin?: string;
      pay_kind?: PaymentLinkKind;
    }) => data,
  )
  .handler(async ({ data }) => {
    const me = identity();
    const start = new Date(data.starts_at);
    const endsAt = new Date(start.getTime() + (data.duration_minutes || 30) * 60000).toISOString();
    const payload = {
      clinic_id: CLINIC_ID,
      patient_id: data.patient_id,
      practitioner_id: data.practitioner_id || me.userId,
      catalogue_id: data.catalogue_id || null,
      treatment_name: data.treatment_name,
      treatment_number: data.treatment_number,
      starts_at: start.toISOString(),
      ends_at: endsAt,
      price: data.price ?? null,
      payment_status: data.payment_status ?? "unpaid",
      consent_document_id: data.consent_document_id || null,
      notes: data.notes || null,
      created_by: me.userId,
      status: "booked",
      stage: "booked",
      updated_at: new Date().toISOString(),
    };

    if (payload.practitioner_id) {
      const clash = findPractitionerOverlap({
        appointments: appointments.filter((a) => a.practitioner_id === payload.practitioner_id),
        startsAt: payload.starts_at,
        endsAt: payload.ends_at,
        excludeAppointmentId: data.id ?? null,
      });
      if (clash) throw new Error(PRACTITIONER_OVERLAP_MESSAGE);
    }

    if (data.id) {
      const row = appointments.find((a) => a.id === data.id);
      if (row) Object.assign(row, payload);
      const noteBody = String(data.notes ?? "");
      if (noteBody.trim()) {
        const me = identity();
        const now = new Date().toISOString();
        let note = appointmentNotes.find((n) => n.appointment_id === data.id);
        if (!note) {
          note = {
            id: newId("r1"),
            appointment_id: data.id,
            clinic_id: CLINIC_ID,
            patient_id: data.patient_id,
            created_at: now,
          };
          appointmentNotes.push(note);
        }
        note.body = noteBody;
        note.updated_by = me.userId;
        note.updated_by_label = me.profile?.full_name ?? null;
        note.updated_at = now;
      }
      return { id: data.id };
    }

    const created = { id: newId("a8"), created_at: new Date().toISOString(), ...payload };
    appointments.push(created);

    const noteBody = String(data.notes ?? "");
    if (noteBody.trim()) {
      const me = identity();
      const now = new Date().toISOString();
      appointmentNotes.push({
        id: newId("r1"),
        appointment_id: created.id,
        clinic_id: CLINIC_ID,
        patient_id: data.patient_id,
        body: noteBody,
        created_at: now,
        updated_by: me.userId,
        updated_by_label: me.profile?.full_name ?? null,
        updated_at: now,
      });
    }

    const patient = patientById(data.patient_id);
    const when = start.toLocaleString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    });
    const practitioner = profileName(payload.practitioner_id);
    const payKind: PaymentLinkKind =
      payload.payment_status === "deposit_paid"
        ? "balance"
        : data.pay_kind === "deposit"
          ? "deposit"
          : "full";
    const confirmation = bookingDetailsMessage({
      name: `${patient?.first_name ?? ""}`.trim() || "there",
      treatment: data.treatment_name,
      treatmentNumber: data.treatment_number,
      when,
      practitioner,
      appointmentId: created.id,
      price: Number(data.price ?? 0),
      paymentStatus: String(payload.payment_status ?? "unpaid"),
      payKind,
      origin: data.app_origin,
    });

    messages.push({
      id: newId("h9"),
      clinic_id: CLINIC_ID,
      patient_id: data.patient_id,
      author: "staff",
      author_id: me.userId,
      body: confirmation,
      attachments: [],
      read_at: null,
      created_at: new Date().toISOString(),
    });

    // Notify the booked practitioner and clinic managers only.
    const bookingRecipients = [
      ...new Set(
        [
          payload.practitioner_id,
          ...userRoles.filter((r) => r.role === "owner" || r.role === "manager").map((r) => r.user_id),
        ].filter(Boolean) as string[],
      ),
    ];
    const bookingBody = `${`${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim() || "Patient"} — ${data.treatment_name} on ${when}`;
    const bookingAt = new Date().toISOString();
    for (const recipient_id of bookingRecipients) {
      staffNotifications.unshift({
        id: newId("l9"),
        clinic_id: CLINIC_ID,
        recipient_id,
        sender_id: null,
        urgent: false,
        kind: "appointment",
        title: "New booking",
        body: bookingBody,
        patient_id: data.patient_id,
        appointment_id: created.id,
        read_at: null,
        created_at: bookingAt,
      });
    }

    return {
      id: created.id,
      confirmation,
      email: patient?.email ?? null,
      phone: patient?.phone ?? null,
    };
  });

export const updateAppointmentState = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      status?: "booked" | "attended" | "cancelled" | "no_show";
      payment_status?: "unpaid" | "deposit_paid" | "paid" | "refunded";
      stage?:
        "booked" | "arrived" | "waiting" | "in_treatment" | "aftercare" | "complete" | "no_show";
      cancel_reason?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const row = appointments.find((a) => a.id === data.id);
    if (!row) return { ok: true };
    if (data.status) row.status = data.status;
    if (data.payment_status) row.payment_status = data.payment_status;
    if (data.stage) {
      row.stage = data.stage;
      row.status =
        data.stage === "no_show" ? "no_show" : data.stage === "booked" ? "booked" : "attended";
    }
    const reason = String(data.cancel_reason ?? "").trim().slice(0, 2000);
    if (data.status === "cancelled" && reason) {
      const prior = String(row.notes ?? "").trim();
      const stamp = `Cancelled: ${reason}`;
      row.notes = prior ? `${stamp}\n\n${prior}` : stamp;
    }
    row.updated_at = new Date().toISOString();
    return { ok: true };
  });

export const rescheduleAppointment = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      starts_at: string;
      duration_minutes?: number;
      practitioner_id?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const start = new Date(data.starts_at);
    if (Number.isNaN(start.getTime())) throw new Error("Invalid date and time");
    const row = appointments.find((a) => a.id === data.id);
    if (!row) return { ok: true };
    const minutes =
      data.duration_minutes ??
      Math.max(
        5,
        Math.round((new Date(row.ends_at).getTime() - new Date(row.starts_at).getTime()) / 60000),
      );
    const startsAt = start.toISOString();
    const endsAt = new Date(start.getTime() + minutes * 60000).toISOString();
    const practitionerId = data.practitioner_id || row.practitioner_id;
    if (practitionerId) {
      const clash = findPractitionerOverlap({
        appointments: appointments.filter((a) => a.practitioner_id === practitionerId),
        startsAt,
        endsAt,
        excludeAppointmentId: data.id,
      });
      if (clash) throw new Error(PRACTITIONER_OVERLAP_MESSAGE);
    }
    row.starts_at = startsAt;
    row.ends_at = endsAt;
    row.stage = "booked";
    row.status = "booked";
    if (data.practitioner_id) row.practitioner_id = data.practitioner_id;
    return { ok: true };
  });

export const getAppointmentNote = createServerFn({ method: "GET" })
  .validator((data: { appointment_id: string }) => ({
    appointment_id: String(data.appointment_id),
  }))
  .handler(async ({ data }) => {
    const row = appointmentNotes.find((n) => n.appointment_id === data.appointment_id);
    const visitBody = (row?.body ?? "").trim();
    if (visitBody) {
      return {
        body: row!.body ?? "",
        updatedAt: row?.updated_at ?? null,
        updatedBy: row?.updated_by_label ?? null,
      };
    }
    const appointment = appointments.find((a) => a.id === data.appointment_id);
    const bookingNotes = String(appointment?.notes ?? "");
    const withoutCancel = bookingNotes.replace(/^Cancelled:[^\n]*(?:\n\n)?/, "").trim();
    return {
      body: withoutCancel,
      updatedAt: null,
      updatedBy: null,
    };
  });

export const saveAppointmentNote = createServerFn({ method: "POST" })
  .validator((data: { appointment_id: string; body: string }) => ({
    appointment_id: String(data.appointment_id),
    body: String(data?.body ?? "").slice(0, 20000),
  }))
  .handler(async ({ data }) => {
    const me = identity();
    const appointment = appointments.find((a) => a.id === data.appointment_id);
    const now = new Date().toISOString();
    let row = appointmentNotes.find((n) => n.appointment_id === data.appointment_id);
    if (!row) {
      row = {
        id: newId("r1"),
        appointment_id: data.appointment_id,
        clinic_id: appointment?.clinic_id ?? CLINIC_ID,
        patient_id: appointment?.patient_id ?? null,
        created_at: now,
      };
      appointmentNotes.push(row);
    }
    row.body = data.body;
    row.updated_by = me.userId;
    row.updated_by_label = me.profile?.full_name ?? null;
    row.updated_at = now;

    if (appointment) {
      const prior = String(appointment.notes ?? "");
      const cancelLine = prior.match(/^Cancelled:[^\n]*/)?.[0] ?? null;
      appointment.notes = cancelLine
        ? data.body.trim()
          ? `${cancelLine}\n\n${data.body}`
          : cancelLine
        : data.body || null;
      appointment.updated_at = now;
    }

    return { body: row.body, updatedAt: row.updated_at, updatedBy: row.updated_by_label };
  });

/* ---------------------------------------------------------------- */
/* treatments, photos, documents                                      */
/* ---------------------------------------------------------------- */

export const addTreatment = createServerFn({ method: "POST" })
  .validator(
    (data: {
      patient_id: string;
      catalogue_id?: string;
      name: string;
      product?: string;
      dose?: string;
      area?: string;
      notes?: string;
      price?: number;
      performed_at: string;
      next_due_at?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const me = identity();
    const created = {
      id: newId("e9"),
      clinic_id: CLINIC_ID,
      patient_id: data.patient_id,
      catalogue_id: data.catalogue_id || null,
      practitioner_id: me.userId,
      name: data.name,
      product: data.product || null,
      dose: data.dose || null,
      area: data.area || null,
      notes: data.notes || null,
      price: data.price ?? null,
      performed_at: data.performed_at,
      next_due_at: data.next_due_at || null,
      status: "completed",
      consent_document_id: null,
      commission_rate_snapshot: Number(me.profile?.commission_rate ?? 0),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    treatments.unshift(created);
    const patient = patientById(data.patient_id);
    if (patient) {
      patient.last_visit_at = data.performed_at;
      patient.status = "active";
    }
    return { id: created.id };
  });

export const addPhoto = createServerFn({ method: "POST" })
  .validator(
    (data: {
      patient_id: string;
      treatment_id?: string;
      storage_path: string;
      kind: "before" | "after";
      caption?: string;
      marketing_consent?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    photos.push({
      id: newId("g9"),
      clinic_id: CLINIC_ID,
      patient_id: data.patient_id,
      treatment_id: data.treatment_id || null,
      storage_path: data.storage_path,
      kind: data.kind,
      caption: data.caption || null,
      taken_at: new Date().toISOString(),
      marketing_consent: data.marketing_consent ?? false,
      visible_to_patient: true,
      created_at: new Date().toISOString(),
    });
    return { ok: true };
  });

export const sendDocument = createServerFn({ method: "POST" })
  .validator(
    (data: {
      patient_id: string;
      kind: "consent" | "treatment_plan" | "consultation" | "aftercare" | "other";
      title: string;
      body?: string;
      treatment_id?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const me = identity();
    const now = new Date().toISOString();
    const created = {
      id: newId("f9"),
      clinic_id: CLINIC_ID,
      patient_id: data.patient_id,
      treatment_id: data.treatment_id || null,
      kind: data.kind,
      title: data.title,
      body: data.body || null,
      fields: {},
      responses: null,
      status: "sent",
      access_token: newId("f8"),
      sent_at: now,
      viewed_at: null,
      signed_at: null,
      signed_name: null,
      signature_data: null,
      signed_ip: null,
      expires_at: null,
      created_by: me.userId,
      created_at: now,
      updated_at: now,
    };
    documents.unshift(created);
    messages.push({
      id: newId("h9"),
      clinic_id: CLINIC_ID,
      patient_id: data.patient_id,
      author: "staff",
      author_id: me.userId,
      body: `${data.title} has been sent to you. Please review and sign it in your patient portal.`,
      attachments: [],
      read_at: null,
      created_at: now,
    });
    return { id: created.id };
  });

export const resendDocument = createServerFn({ method: "POST" })
  .validator((data: { id: string; patient_id: string }) => data)
  .handler(async ({ data }) => {
    const row = documents.find((d) => d.id === data.id);
    if (row) {
      row.status = "sent";
      row.sent_at = new Date().toISOString();
    }
    return { ok: true };
  });

export const signDocument = createServerFn({ method: "POST" })
  .validator((data: { id: string; signed_name: string }) => data)
  .handler(async ({ data }) => {
    const name = data.signed_name.trim().slice(0, 120);
    if (!name) throw new Error("Please type your full name to sign");
    const row = documents.find((d) => d.id === data.id);
    if (row) {
      row.status = "signed";
      row.signed_at = new Date().toISOString();
      row.signed_name = name;
      row.signature_data = name;
    }
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* messaging                                                          */
/* ---------------------------------------------------------------- */

export const sendMessage = createServerFn({ method: "POST" })
  .validator(
    (data: {
      patient_id: string;
      body: string;
      as: "staff" | "patient";
      attachments?: { path: string; name: string; type: string; size: number }[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const me = identity();
    const body = data.body.trim().slice(0, 2000);
    const attachments = (data.attachments ?? []).slice(0, 5);
    if (!body && attachments.length === 0) throw new Error("Message cannot be empty");
    messages.push({
      id: newId("h9"),
      clinic_id: CLINIC_ID,
      patient_id: data.patient_id,
      author: data.as,
      author_id: me.userId,
      body: body || (attachments.length === 1 ? "Sent an attachment" : "Sent attachments"),
      attachments,
      read_at: null,
      created_at: new Date().toISOString(),
    });
    return { ok: true };
  });

export const getUnreadMessages = createServerFn({ method: "GET" }).handler(async () => {
  const me = identity();
  if (me.isPatient) {
    if (!me.patient) return { total: 0, items: [] as any[] };
    const list = sortDesc(
      messages.filter((m) => m.patient_id === me.patient.id && m.author === "staff" && !m.read_at),
      "created_at",
    );
    return {
      total: list.length,
      items: list.length
        ? [
            {
              patient_id: me.patient.id,
              name: "Your clinic",
              count: list.length,
              last: list[0].body,
            },
          ]
        : [],
    };
  }
  const rows = sortDesc(
    messages.filter((m) => m.author === "patient" && !m.read_at),
    "created_at",
  );
  const grouped = new Map<
    string,
    { patient_id: string; name: string; count: number; last: string }
  >();
  for (const row of rows) {
    const existing = grouped.get(row.patient_id);
    if (existing) existing.count += 1;
    else {
      const p = patientById(row.patient_id);
      grouped.set(row.patient_id, {
        patient_id: row.patient_id,
        name: `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || "Patient",
        count: 1,
        last: row.body,
      });
    }
  }
  const items = [...grouped.values()];
  return { total: items.reduce((sum, i) => sum + i.count, 0), items };
});

export const markMessagesRead = createServerFn({ method: "POST" })
  .validator((data: { patient_id: string }) => data)
  .handler(async ({ data }) => {
    const me = identity();
    const author = me.isPatient ? "staff" : "patient";
    for (const m of messages) {
      if (m.patient_id === data.patient_id && m.author === author && !m.read_at) {
        m.read_at = new Date().toISOString();
      }
    }
    return { ok: true };
  });

export const listMessageTemplates = createServerFn({ method: "GET" }).handler(async () =>
  [...messageTemplates].sort(
    (a, b) =>
      String(a.category).localeCompare(String(b.category)) ||
      String(a.title).localeCompare(String(b.title)),
  ),
);

export const saveMessageTemplate = createServerFn({ method: "POST" })
  .validator((data: { id?: string; title: string; body: string; category?: string }) => data)
  .handler(async ({ data }) => {
    const me = requireStaff();
    const title = data.title.trim();
    const body = data.body.trim();
    if (!title || !body) throw new Error("Title and message are required");
    if (data.id) {
      const row = messageTemplates.find((t) => t.id === data.id);
      if (row) Object.assign(row, { title, body, category: data.category?.trim() || null });
      return { ok: true };
    }
    messageTemplates.push({
      id: newId("m9"),
      clinic_id: CLINIC_ID,
      title,
      body,
      category: data.category?.trim() || null,
      created_by: me.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return { ok: true };
  });

export const deleteMessageTemplate = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const me = identity();
    if (!me.canDelete) throw new Error("Only managers can delete templates");
    const index = messageTemplates.findIndex((t) => t.id === data.id);
    if (index >= 0) messageTemplates.splice(index, 1);
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* staff notifications and directory                                  */
/* ---------------------------------------------------------------- */

export const listStaffNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const me = identity();
  return sortDesc(
    staffNotifications.filter(
      (n) =>
        !n.read_at &&
        n.recipient_id === me.userId &&
        !(n as { recipient_dismissed_at?: string | null }).recipient_dismissed_at,
    ),
    "created_at",
  )
    .slice(0, 20)
    .map((n) => ({ ...n, sender_name: profileName(n.sender_id) }));
});

export const markStaffNotificationRead = createServerFn({ method: "POST" })
  .validator((data: { id?: string; all?: boolean }) => data)
  .handler(async ({ data }) => {
    const me = identity();
    const now = new Date().toISOString();
    for (const n of staffNotifications) {
      if (n.read_at || n.recipient_id !== me.userId) continue;
      if (data.id && n.id !== data.id) continue;
      n.read_at = now;
    }
    return { ok: true };
  });

/** Hide a team inbox row for the signed-in user only (incoming or sent). */
export const dismissStaffInboxItem = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    dismissDemoInboxIds([data.id]);
    return { ok: true };
  });

/** Hide several inbox rows for the signed-in user (e.g. whole peer stack). */
export const dismissStaffInboxItems = createServerFn({ method: "POST" })
  .validator((data: { ids: string[] }) => data)
  .handler(async ({ data }) => {
    dismissDemoInboxIds(data.ids);
    return { ok: true };
  });

function dismissDemoInboxIds(ids: string[]) {
  const me = identity();
  const now = new Date().toISOString();
  const wanted = new Set(ids);
  let found = false;
  for (const n of staffNotifications) {
    if (!wanted.has(n.id)) continue;
    found = true;
    const row = n as typeof n & {
      recipient_dismissed_at?: string | null;
      sender_dismissed_at?: string | null;
    };
    const isRecipient = row.recipient_id === me.userId;
    const isSender = row.sender_id === me.userId;
    if (!isRecipient && !isSender) continue;
    if (isRecipient) {
      row.recipient_dismissed_at = now;
      if (!row.read_at) row.read_at = now;
    }
    if (isSender) row.sender_dismissed_at = now;
  }
  if (!found) throw new Error("Message not found");
}

/** Alerts the signed-in staff member sent recently (seen / waiting per recipient). */
export const listSentStaffAlerts = createServerFn({ method: "GET" }).handler(async () => {
  const me = identity();
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return sortDesc(
    staffNotifications.filter((n) => {
      const dismissed = (n as { sender_dismissed_at?: string | null }).sender_dismissed_at;
      return (
        n.sender_id === me.userId &&
        !dismissed &&
        (n.kind === "urgent" || n.kind === "staff_message" || n.kind === "staff_chat") &&
        new Date(n.created_at).getTime() >= since
      );
    }),
    "created_at",
  )
    .slice(0, 50)
    .map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body ?? null,
      urgent: !!n.urgent,
      kind: n.kind,
      recipient_id: n.recipient_id,
      read_at: n.read_at ?? null,
      created_at: n.created_at,
      recipient_name: profileName(n.recipient_id) || "Teammate",
    }));
});

/** Team alerts / chat pings addressed to the signed-in staff member (last 7 days). */
export const listIncomingTeamAlerts = createServerFn({ method: "GET" }).handler(async () => {
  const me = identity();
  const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return sortDesc(
    staffNotifications.filter((n) => {
      const dismissed = (n as { recipient_dismissed_at?: string | null }).recipient_dismissed_at;
      return (
        n.recipient_id === me.userId &&
        !dismissed &&
        (n.kind === "urgent" || n.kind === "staff_message" || n.kind === "staff_chat") &&
        new Date(n.created_at).getTime() >= since
      );
    }),
    "created_at",
  )
    .slice(0, 50)
    .map((n) => ({
      id: n.id as string,
      title: n.title as string,
      body: (n.body as string | null) ?? null,
      urgent: !!n.urgent,
      kind: n.kind as string,
      sender_id: (n.sender_id as string | null) ?? null,
      read_at: (n.read_at as string | null) ?? null,
      created_at: n.created_at as string,
      sender_name: profileName(n.sender_id) || "Teammate",
    }));
});

export const listStaffDirectory = createServerFn({ method: "GET" }).handler(async () => {
  const staff = userRoles.filter((r) => r.role !== "patient");
  const ids = [...new Set(staff.map((r) => r.user_id))];
  return profiles
    .filter((p) => ids.includes(p.id))
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      job_title: p.job_title,
      roles: staff.filter((r) => r.user_id === p.id).map((r) => r.role),
    }))
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
});

export const sendStaffAlert = createServerFn({ method: "POST" })
  .validator(
    (data: {
      audience: "managers" | "practitioners" | "front_desk" | "all" | "user";
      recipientId?: string;
      body: string;
      urgent?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const me = requireStaff();
    const body = data.body.trim();
    if (!body) throw new Error("Write a message");
    let recipients: string[];
    if (data.audience === "user") {
      recipients = data.recipientId ? [data.recipientId] : [];
    } else {
      const wanted =
        data.audience === "managers"
          ? ["owner", "manager"]
          : data.audience === "practitioners"
            ? ["practitioner"]
            : data.audience === "front_desk"
              ? ["front_desk"]
              : ["owner", "manager", "front_desk", "practitioner"];
      recipients = [
        ...new Set(userRoles.filter((r) => wanted.includes(r.role)).map((r) => r.user_id)),
      ];
    }
    recipients = recipients.filter((rid) => rid !== me.userId);
    if (recipients.length === 0) throw new Error("No recipients found");
    const from = me.profile?.full_name || me.email || "A colleague";
    const now = new Date().toISOString();
    for (const rid of recipients) {
      staffNotifications.unshift({
        id: newId("l9"),
        clinic_id: CLINIC_ID,
        recipient_id: rid,
        sender_id: me.userId,
        urgent: !!data.urgent,
        kind: data.urgent ? "urgent" : "staff_message",
        title: `${data.urgent ? "Urgent" : "Message"} from ${from}`,
        body,
        patient_id: null,
        appointment_id: null,
        read_at: null,
        created_at: now,
      });
    }
    return { sent: recipients.length };
  });

export const getPractitionerDay = createServerFn({ method: "GET" })
  .validator((data: { practitionerId: string; date: string }) => data)
  .handler(async ({ data }) => {
    const base = new Date(`${data.date}T00:00:00`);
    const from = new Date(base.getFullYear(), base.getMonth(), base.getDate()).toISOString();
    const to = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1).toISOString();
    const booked = sortAsc(
      appointments.filter(
        (a) =>
          a.practitioner_id === data.practitionerId &&
          a.starts_at >= from &&
          a.starts_at < to &&
          a.status !== "cancelled",
      ),
      "starts_at",
    );

    const DAY_START = 9 * 60;
    const DAY_END = 18 * 60;
    const mins = (value: string) => {
      const d = new Date(value);
      return d.getHours() * 60 + d.getMinutes();
    };
    const free: { from: number; to: number }[] = [];
    let cursor = DAY_START;
    for (const a of booked) {
      const s = Math.max(mins(a.starts_at), DAY_START);
      const e = Math.min(mins(a.ends_at), DAY_END);
      if (s > cursor) free.push({ from: cursor, to: s });
      cursor = Math.max(cursor, e);
    }
    if (cursor < DAY_END) free.push({ from: cursor, to: DAY_END });

    return {
      bookedCount: booked.length,
      bookedMinutes: booked.reduce(
        (sum, a) => sum + Math.max(0, mins(a.ends_at) - mins(a.starts_at)),
        0,
      ),
      free: free.filter((f) => f.to - f.from >= 15).slice(0, 4),
      alerts: sortDesc(
        staffNotifications.filter((n) => n.sender_id === data.practitionerId && n.urgent),
        "created_at",
      ).slice(0, 3),
    };
  });

/* ---------------------------------------------------------------- */
/* medical history and patient portal                                 */
/* ---------------------------------------------------------------- */

export const reviewHistory = createServerFn({ method: "POST" })
  .validator((data: { id: string; patient_id: string }) => data)
  .handler(async ({ data }) => {
    const me = identity();
    const row = medicalHistory.find((h) => h.id === data.id);
    if (row) {
      row.reviewed_by = me.userId;
      row.reviewed_at = new Date().toISOString();
    }
    return { ok: true };
  });

export const getMyRecord = createServerFn({ method: "GET" }).handler(async () => {
  const me = identity();
  const patient = patients.find((p) => p.user_id === me.userId) ?? null;
  if (!patient) return null;
  return {
    patient,
    treatments: sortDesc(
      treatments.filter((t) => t.patient_id === patient.id),
      "performed_at",
    ),
    documents: sortDesc(
      documents.filter((d) => d.patient_id === patient.id),
      "created_at",
    ),
    messages: sortAsc(
      messages.filter((m) => m.patient_id === patient.id),
      "created_at",
    ),
    history: sortDesc(
      medicalHistory.filter((h) => h.patient_id === patient.id),
      "created_at",
    ),
    photos: photos
      .filter((p) => p.patient_id === patient.id && p.visible_to_patient)
      .map((p) => ({ ...p, url: p.storage_path })),
  };
});

export const submitHistoryUpdate = createServerFn({ method: "POST" })
  .validator(
    (data: {
      medications: string;
      allergies: string;
      conditions: string;
      diet: string;
      pregnancy: string;
      other: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const me = identity();
    const patient = patients.find((p) => p.user_id === me.userId);
    if (!patient) throw new Error("No patient record linked to this account");
    medicalHistory.unshift({
      id: newId("i9"),
      clinic_id: CLINIC_ID,
      patient_id: patient.id,
      data,
      summary: "Patient updated their medical and lifestyle information",
      source: "patient",
      changed_by: me.userId,
      reviewed_by: null,
      reviewed_at: null,
      created_at: new Date().toISOString(),
    });
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* team administration                                                */
/* ---------------------------------------------------------------- */

function roleFor(userId: string) {
  return userRoles.find((r) => r.user_id === userId && r.role !== "patient")?.role ?? "";
}

export const listTeam = createServerFn({ method: "GET" }).handler(async () => {
  const me = identity();
  if (!me.isStaff) throw new Error("Staff access only");
  return userRoles
    .filter((r) => r.role !== "patient")
    .map((r) => {
      const profile = profiles.find((p) => p.id === r.user_id);
      return {
        userId: r.user_id,
        role: r.role,
        email: db.staffEmails[r.user_id] ?? "",
        fullName: profile?.full_name ?? "",
        jobTitle: profile?.job_title ?? "",
        registrationBody: profile?.registration_body ?? "",
        registrationNumber: profile?.registration_number ?? "",
        isSelf: r.user_id === me.userId,
        hasSignedIn: true,
      };
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
});

export const createStaffAccount = createServerFn({ method: "POST" })
  .validator(
    (data: {
      email: string;
      password: string;
      fullName: string;
      jobTitle?: string;
      role: "owner" | "manager" | "practitioner" | "front_desk";
      registrationBody?: string;
      registrationNumber?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const email = assertEmail(data.email, "work email")!;
    const userId = newId("s9");
    profiles.push({
      id: userId,
      clinic_id: CLINIC_ID,
      full_name: data.fullName,
      job_title: data.jobTitle ?? null,
      registration_body: data.registrationBody ?? null,
      registration_number: data.registrationNumber ?? null,
      avatar_url: null,
      commission_rate: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    userRoles.push({
      id: newId("a1"),
      user_id: userId,
      role: data.role,
      created_at: new Date().toISOString(),
    });
    db.staffEmails[userId] = email;
    return { userId };
  });

export const updateStaffMember = createServerFn({ method: "POST" })
  .validator(
    (data: {
      userId: string;
      role: "owner" | "manager" | "practitioner" | "front_desk";
      fullName: string;
      jobTitle?: string;
      registrationBody?: string;
      registrationNumber?: string;
      commissionRate?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const me = identity();
    if (!me.isManager) throw new Error("Manager access required");
    if (data.userId === me.userId && data.role !== "owner") {
      throw new Error("You cannot remove your own manager access");
    }
    const profile = profiles.find((p) => p.id === data.userId);
    if (profile) {
      profile.full_name = data.fullName;
      profile.job_title = data.jobTitle ?? null;
      profile.registration_body = data.registrationBody ?? null;
      profile.registration_number = data.registrationNumber ?? null;
      if (data.commissionRate !== undefined) {
        profile.commission_rate = Math.min(100, Math.max(0, Number(data.commissionRate) || 0));
      }
    }
    const role = userRoles.find((r) => r.user_id === data.userId && r.role !== "patient");
    if (role) role.role = data.role;
    else
      userRoles.push({
        id: newId("a1"),
        user_id: data.userId,
        role: data.role,
        created_at: new Date().toISOString(),
      });
    clearExTeamArchiveDemo(data.userId);
    return { ok: true };
  });

export const inviteStaffMember = createServerFn({ method: "POST" })
  .validator(
    (data: {
      email: string;
      fullName: string;
      jobTitle?: string;
      role: "owner" | "manager" | "practitioner" | "front_desk";
      registrationBody?: string;
      registrationNumber?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const email = assertEmail(data.email, "work email")!;
    const userId = newId("s8");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    let raw = "";
    for (const b of bytes) raw += alphabet[b % alphabet.length]!;
    const temporaryPassword = `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 9)}-${raw.slice(9, 12)}`;
    profiles.push({
      id: userId,
      clinic_id: CLINIC_ID,
      full_name: data.fullName,
      job_title: data.jobTitle ?? null,
      registration_body: data.registrationBody ?? null,
      registration_number: data.registrationNumber ?? null,
      avatar_url: null,
      commission_rate: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    userRoles.push({
      id: newId("a1"),
      user_id: userId,
      role: data.role,
      created_at: new Date().toISOString(),
    });
    db.staffEmails[userId] = email;
    mustChangePasswordByUser.add(userId);
    welcomePendingByUser.add(userId);
    clearExTeamArchiveDemo(userId);
    return {
      userId,
      email,
      role: data.role,
      temporaryPassword,
    };
  });

export const revokeStaffAccess = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const me = identity();
    if (data.userId === me.userId) throw new Error("You cannot revoke your own access");
    const roleRow = userRoles.find((r) => r.user_id === data.userId && r.role !== "patient");
    if (!roleRow) throw new Error("That person is not on the team");
    const profile = profiles.find((p) => p.id === data.userId);
    clearExTeamArchiveDemo(data.userId);
    const revokedAt = new Date();
    exTeamMembers.push({
      id: newId("ex"),
      userId: data.userId,
      email: db.staffEmails[data.userId] ?? "",
      fullName: profile?.full_name ?? "",
      jobTitle: profile?.job_title ?? "",
      registrationBody: profile?.registration_body ?? "",
      registrationNumber: profile?.registration_number ?? "",
      role: roleRow.role,
      commissionRate: profile?.commission_rate ?? null,
      revokedAt: revokedAt.toISOString(),
      retainUntil: retainUntilFrom(revokedAt),
      purgedAt: null,
    });
    for (let i = userRoles.length - 1; i >= 0; i--) {
      const row = userRoles[i];
      if (row.user_id === data.userId && row.role !== "patient") userRoles.splice(i, 1);
    }
    return { ok: true };
  });

export const listExTeamMembers = createServerFn({ method: "GET" }).handler(async () => {
  purgeExpiredExTeamMembersDemo();
  const now = Date.now();
  return exTeamMembers
    .filter((r) => !r.purgedAt && new Date(r.retainUntil).getTime() > now)
    .map((r) => ({
      id: r.id,
      userId: r.userId,
      email: r.email,
      fullName: r.fullName,
      jobTitle: r.jobTitle,
      registrationBody: r.registrationBody,
      registrationNumber: r.registrationNumber,
      role: r.role,
      revokedAt: r.revokedAt,
      retainUntil: r.retainUntil,
      daysRemaining: Math.max(0, Math.ceil((new Date(r.retainUntil).getTime() - now) / 86400000)),
    }))
    .sort((a, b) => b.revokedAt.localeCompare(a.revokedAt));
});

export const restoreExTeamMember = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    purgeExpiredExTeamMembersDemo();
    const archived = exTeamMembers.find(
      (r) => r.userId === data.userId && !r.purgedAt && new Date(r.retainUntil).getTime() > Date.now(),
    );
    if (!archived) throw new Error("No former team record found (it may have expired)");
    const profile = profiles.find((p) => p.id === data.userId);
    if (profile) {
      profile.full_name = archived.fullName;
      profile.job_title = archived.jobTitle || null;
      profile.registration_body = archived.registrationBody || null;
      profile.registration_number = archived.registrationNumber || null;
      if (archived.commissionRate != null) profile.commission_rate = archived.commissionRate;
    }
    const existing = userRoles.find((r) => r.user_id === data.userId && r.role !== "patient");
    if (existing) existing.role = archived.role as typeof existing.role;
    else
      userRoles.push({
        id: newId("a1"),
        user_id: data.userId,
        role: archived.role as "owner" | "manager" | "practitioner" | "front_desk",
        created_at: new Date().toISOString(),
      });
    clearExTeamArchiveDemo(data.userId);
    return { ok: true, role: archived.role };
  });

export const setStaffPassword = createServerFn({ method: "POST" })
  .validator((data: { userId: string; password: string }) => data)
  .handler(async ({ data }) => {
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters");
    mustChangePasswordByUser.add(data.userId);
    welcomePendingByUser.delete(data.userId);
    return { ok: true };
  });

/** Signed-in staff: replace temporary/reset password and clear the must-change flag. */
export const changeOwnPassword = createServerFn({ method: "POST" })
  .validator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters");
    const me = identity();
    mustChangePasswordByUser.delete(me.userId);
    return { ok: true, mustChangePassword: false as const };
  });

export const acknowledgeWelcome = createServerFn({ method: "POST" }).handler(async () => {
  const me = identity();
  welcomePendingByUser.delete(me.userId);
  return { ok: true, welcomePending: false as const };
});

export const listAccountsMissingEmail = createServerFn({ method: "GET" }).handler(async () => ({
  patients: patients
    .filter((p) => p.status !== "archived" && (!p.email || !p.phone || !p.date_of_birth))
    .map((p) => ({
      id: p.id,
      name: [p.title, p.first_name, p.last_name].filter(Boolean).join(" "),
      phone: p.phone ?? null,
      missingEmail: !String(p.email ?? "").trim(),
      gaps: [
        !String(p.email ?? "").trim() ? "email" : null,
        !String(p.phone ?? "").trim() ? "phone" : null,
        !p.date_of_birth ? "date of birth" : null,
      ].filter(Boolean) as string[],
    })),
  staff: userRoles
    .filter((r) => r.role !== "patient" && !db.staffEmails[r.user_id])
    .map((r) => {
      const profile = profiles.find((p) => p.id === r.user_id);
      return {
        userId: r.user_id,
        role: r.role,
        fullName: profile?.full_name ?? "Unnamed staff member",
        jobTitle: profile?.job_title ?? "",
      };
    }),
}));

export const setPatientEmail = createServerFn({ method: "POST" })
  .validator((data: { patientId: string; email: string }) => data)
  .handler(async ({ data }) => {
    const email = assertEmail(data.email)!;
    const patient = patientById(data.patientId);
    if (patient) patient.email = email;
    return { ok: true };
  });

export const setStaffEmail = createServerFn({ method: "POST" })
  .validator((data: { userId: string; email: string }) => data)
  .handler(async ({ data }) => {
    const email = assertEmail(data.email)!;
    db.staffEmails[data.userId] = email;
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* performance and earnings                                           */
/* ---------------------------------------------------------------- */

function earningsInputs(from: string, to: string) {
  return {
    treatments: treatments
      .filter((t) => t.performed_at >= from && t.performed_at <= to)
      .map((t) => ({
        id: t.id,
        practitioner_id: t.practitioner_id,
        patient_id: t.patient_id,
        name: t.name,
        price: t.price,
        performed_at: t.performed_at,
        commission_rate_snapshot: t.commission_rate_snapshot,
      })),
    appointments: appointments
      .filter((a) => a.starts_at >= from && a.starts_at <= to)
      .map((a) => ({
        practitioner_id: a.practitioner_id,
        price: a.price,
        payment_status: a.payment_status,
        status: a.status,
        starts_at: a.starts_at,
      })),
    yearTreatments: treatments
      .filter((t) => t.performed_at >= isoDaysAgo(365))
      .map((t) => ({ practitioner_id: t.practitioner_id, patient_id: t.patient_id })),
    firstSeen: new Map<string, string>(
      patients.map((p) => [p.id as string, p.created_at as string]),
    ),
  };
}

export const getPractitionerPerformance = createServerFn({ method: "POST" })
  .validator((data: { from: string; to: string }) => data)
  .handler(async ({ data }) => {
    const me = identity();
    if (!me.isStaff) throw new Error("Staff access only");
    if (!me.isOwner && !me.permissions.includes("reports.performance")) {
      throw new Error("You do not have access to this area");
    }
    const { buildStats, buildTrend } = await import("./earnings.server");
    const inputs = earningsInputs(data.from, data.to);

    const staffIds = [
      ...new Set(
        userRoles
          .filter((r) => r.role === "owner" || r.role === "practitioner")
          .map((r) => r.user_id),
      ),
    ];
    const staff = staffIds.map((sid) => {
      const p = profiles.find((x) => x.id === sid);
      return {
        userId: sid,
        fullName: p?.full_name || "Unnamed",
        jobTitle: p?.job_title ?? "",
        commissionRate: Number(p?.commission_rate ?? 0),
      };
    });

    const rows = buildStats(
      staff,
      inputs.treatments as never,
      inputs.appointments as never,
      inputs.yearTreatments as never,
      inputs.firstSeen,
      { from: data.from, to: data.to },
    ).sort((a, b) => b.earned - a.earned);

    const totals = rows.reduce(
      (acc, r) => ({
        earned: acc.earned + r.earned,
        collected: acc.collected + r.collected,
        toPractitioners: acc.toPractitioners + r.earnedShare,
        toClinic: acc.toClinic + r.clinicEarnedShare,
        treatments: acc.treatments + r.treatments,
        patients: acc.patients + r.patients,
        newPatients: acc.newPatients + r.newPatients,
        appointments: acc.appointments + r.appointments,
        attended: acc.attended + r.attended,
        noShows: acc.noShows + r.noShows,
        cancelled: acc.cancelled + r.cancelled,
        outstanding: acc.outstanding + r.outstanding,
      }),
      {
        earned: 0,
        collected: 0,
        toPractitioners: 0,
        toClinic: 0,
        treatments: 0,
        patients: 0,
        newPatients: 0,
        appointments: 0,
        attended: 0,
        noShows: 0,
        cancelled: 0,
        outstanding: 0,
      },
    );

    const settled = totals.attended + totals.noShows;
    const clinic = {
      ...totals,
      attendance: settled ? Math.round((totals.attended / settled) * 100) : 0,
      averageValue: totals.treatments
        ? Math.round((totals.earned / totals.treatments) * 100) / 100
        : 0,
      retention: rows.length
        ? Math.round(rows.reduce((s, r) => s + r.retention, 0) / rows.length)
        : 0,
      averageCommission: rows.length
        ? Math.round((rows.reduce((s, r) => s + r.commissionRate, 0) / rows.length) * 10) / 10
        : 0,
    };

    const trend = buildTrend(staff, inputs.treatments as never, inputs.appointments as never, {
      from: data.from,
      to: data.to,
    });

    return { rows, totals, clinic, trend };
  });

export const getMyEarnings = createServerFn({ method: "POST" })
  .validator((data: { from: string; to: string }) => data)
  .handler(async ({ data }) => {
    const me = requireStaff();
    const { buildStats } = await import("./earnings.server");
    const inputs = earningsInputs(data.from, data.to);
    const rate = Number(me.profile?.commission_rate ?? 0);
    const mine = inputs.treatments.filter((t) => t.practitioner_id === me.userId);

    const stats = buildStats(
      [
        {
          userId: me.userId,
          fullName: me.profile?.full_name ?? "",
          jobTitle: me.profile?.job_title ?? "",
          commissionRate: rate,
        },
      ],
      inputs.treatments as never,
      inputs.appointments as never,
      inputs.yearTreatments.filter((t) => t.practitioner_id === me.userId) as never,
      inputs.firstSeen,
      { from: data.from, to: data.to },
    )[0]!;

    return {
      earnedShare: stats.earnedShare,
      collectedShare: stats.collectedShare,
      outstanding: stats.outstanding,
      treatments: stats.treatments,
      patients: stats.patients,
      newPatients: stats.newPatients,
      retention: stats.retention,
      averageValue: stats.averageValue,
      lines: sortDesc(mine, "performed_at").map((t) => ({
        id: t.id,
        performedAt: t.performed_at,
        name: t.name,
        patient: (() => {
          const p = patientById(t.patient_id);
          return p ? `${p.first_name} ${p.last_name}` : "—";
        })(),
        share: Math.round(Number(t.price ?? 0) * Number(t.commission_rate_snapshot ?? rate)) / 100,
      })),
    };
  });

export const setCommissionRate = createServerFn({ method: "POST" })
  .validator((data: { userId: string; rate: number }) => data)
  .handler(async ({ data }) => {
    const rate = Math.min(100, Math.max(0, Number(data.rate) || 0));
    const profile = profiles.find((p) => p.id === data.userId);
    if (profile) profile.commission_rate = rate;
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* profile self-service                                               */
/* ---------------------------------------------------------------- */

export const submitProfileChange = createServerFn({ method: "POST" })
  .validator(
    (data: {
      fullName: string;
      jobTitle?: string;
      registrationBody?: string;
      registrationNumber?: string;
      note?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const me = requireStaff();
    if (!data.fullName?.trim()) throw new Error("Full name is required");
    profileChangeRequests.unshift({
      id: newId("o9"),
      clinic_id: CLINIC_ID,
      user_id: me.userId,
      full_name: data.fullName.trim(),
      job_title: data.jobTitle?.trim() || null,
      registration_body: data.registrationBody?.trim() || null,
      registration_number: data.registrationNumber?.trim() || null,
      note: data.note?.trim() || null,
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
      reviewer_note: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return { ok: true };
  });

export const saveMyProfile = createServerFn({ method: "POST" })
  .validator(
    (data: {
      fullName: string;
      jobTitle?: string;
      registrationBody?: string;
      registrationNumber?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const me = requireStaff();
    if (!data.fullName?.trim()) throw new Error("Full name is required");
    const profile = profiles.find((p) => p.id === me.userId);
    if (!profile) throw new Error("Profile not found");
    profile.full_name = data.fullName.trim();
    profile.job_title = data.jobTitle?.trim() || null;
    profile.registration_body = data.registrationBody?.trim() || null;
    profile.registration_number = data.registrationNumber?.trim() || null;
    return { ok: true };
  });

export const getMyProfile = createServerFn({ method: "GET" }).handler(async () => {
  const me = requireStaff();
  return {
    profile: me.profile,
    isManager: me.isManager,
    requests: sortDesc(
      profileChangeRequests.filter((r) => r.user_id === me.userId),
      "created_at",
    ).slice(0, 20),
  };
});

export const listProfileChangeRequests = createServerFn({ method: "GET" }).handler(async () => {
  const me = requireStaff();
  if (!me.isOwner && !me.permissions.includes("team.approve_changes")) {
    throw new Error("You do not have access to this area");
  }
  return sortDesc(profileChangeRequests, "created_at")
    .slice(0, 50)
    .map((r) => ({
      ...r,
      current: profiles.find((p) => p.id === r.user_id) ?? null,
    }));
});

export const reviewProfileChange = createServerFn({ method: "POST" })
  .validator((data: { id: string; approve: boolean; reviewerNote?: string }) => data)
  .handler(async ({ data }) => {
    const me = requireStaff();
    const req = profileChangeRequests.find((r) => r.id === data.id);
    if (!req) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error("This request has already been reviewed");
    if (data.approve) {
      const profile = profiles.find((p) => p.id === req.user_id);
      if (profile) {
        profile.full_name = req.full_name ?? "";
        profile.job_title = req.job_title;
        profile.registration_body = req.registration_body;
        profile.registration_number = req.registration_number;
      }
    }
    req.status = data.approve ? "approved" : "declined";
    req.reviewed_by = me.userId;
    req.reviewed_at = new Date().toISOString();
    req.reviewer_note = data.reviewerNote?.trim() || null;
    return { ok: true };
  });

export const setMyAvatar = createServerFn({ method: "POST" })
  .validator((data: { path: string | null; targetUserId?: string }) => data)
  .handler(async ({ data }) => {
    const me = requireStaff();
    const profile = profiles.find((p) => p.id === (data.targetUserId ?? me.userId));
    if (profile) profile.avatar_url = data.path;
    return { ok: true };
  });

export const listMyDocuments = createServerFn({ method: "GET" })
  .validator((data: { targetUserId?: string }) => data)
  .handler(async ({ data }) => {
    const me = requireStaff();
    const target = data.targetUserId ?? me.userId;
    if (target !== me.userId && !me.isManager) {
      throw new Error("Only managers can open staff documents");
    }
    return sortDesc(
      staffDocuments.filter((d) => d.user_id === target),
      "created_at",
    );
  });

export const addMyDocument = createServerFn({ method: "POST" })
  .validator(
    (data: {
      title: string;
      category: string;
      path: string;
      file_name: string;
      file_type?: string;
      file_size?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const me = requireStaff();
    if (!data.title?.trim()) throw new Error("A document title is required");
    staffDocuments.unshift({
      id: newId("p9"),
      user_id: me.userId,
      title: data.title.trim().slice(0, 120),
      category: data.category || "other",
      path: data.path,
      file_name: data.file_name,
      file_type: data.file_type ?? null,
      file_size: data.file_size ?? null,
      created_at: new Date().toISOString(),
    });
    return { ok: true };
  });

export const deleteMyDocument = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const index = staffDocuments.findIndex((d) => d.id === data.id);
    if (index >= 0) staffDocuments.splice(index, 1);
    return { ok: true };
  });

export const getStaffProfile = createServerFn({ method: "GET" })
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const me = requireStaff();
    const isSelf = data.userId === me.userId;
    const canViewPrivateDetails = true;
    const canViewDocuments = me.isManager || isSelf;
    const docs = sortDesc(
      staffDocuments.filter((d) => d.user_id === data.userId),
      "created_at",
    );
    const presentCategories = [...new Set(docs.map((d) => d.category).filter(Boolean))];
    const profile = profiles.find((p) => p.id === data.userId) ?? null;
    const safeProfile = profile
      ? {
          ...profile,
          commission_rate: me.isManager ? profile.commission_rate : null,
        }
      : null;

    return {
      profile: safeProfile,
      role: roleFor(data.userId),
      email: db.staffEmails[data.userId] ?? "",
      documents: canViewDocuments ? docs : [],
      presentCategories,
      canViewDocuments,
      canViewPrivateDetails,
      requests: me.isOwner
        ? sortDesc(
            profileChangeRequests.filter((r) => r.user_id === data.userId),
            "created_at",
          ).slice(0, 20)
        : [],
    };
  });

/* ---------------------------------------------------------------- */
/* retention and recalls                                              */
/* ---------------------------------------------------------------- */

export const getRetention = createServerFn({ method: "GET" }).handler(async () => {
  const me = requireStaff();
  if (!me.isOwner && !me.permissions.includes("reports.retention")) {
    throw new Error("You do not have access to retention reports");
  }
  const { buildRetention } = await import("./retention.server");
  const practitionerNames = new Map<string, string>(
    profiles.map((p) => [p.id as string, p.full_name as string]),
  );
  const twoYearsAgo = isoDaysAgo(730);

  const result = buildRetention({
    patients: patients.map((p) => ({
      id: p.id,
      title: p.title,
      first_name: p.first_name,
      last_name: p.last_name,
      status: p.status,
      email: p.email,
      phone: p.phone,
      created_at: p.created_at,
    })),
    treatments: treatments
      .filter((t) => t.performed_at >= twoYearsAgo)
      .map((t) => ({
        patient_id: t.patient_id,
        practitioner_id: t.practitioner_id,
        name: t.name,
        price: t.price,
        performed_at: t.performed_at,
        next_due_at: t.next_due_at,
      })),
    appointments: appointments.map((a) => ({
      patient_id: a.patient_id,
      practitioner_id: a.practitioner_id,
      starts_at: a.starts_at,
      status: a.status,
    })),
    outreach: retentionOutreach.map((o) => ({
      patient_id: o.patient_id,
      created_at: o.created_at,
    })),
    practitionerNames,
    // Only a practitioner has a book of their own to scope to; other staff who
    // hold the permission (e.g. a coordinator) see the whole clinic.
    practitionerId: me.isManager || !me.roles.includes("practitioner") ? null : me.userId,
  });

  return {
    ...result,
    isManager: me.isManager,
    practitioners: me.isManager
      ? [...practitionerNames.entries()].map(([userId, fullName]) => ({ userId, fullName }))
      : [],
  };
});

export const logRetentionOutreach = createServerFn({ method: "POST" })
  .validator((data: { patient_id: string; channel?: string; note?: string }) => data)
  .handler(async ({ data }) => {
    const me = requireStaff();
    retentionOutreach.push({
      id: newId("j9"),
      clinic_id: CLINIC_ID,
      patient_id: data.patient_id,
      contacted_by: me.userId,
      channel: data.channel ?? "message",
      note: data.note ?? null,
      created_at: new Date().toISOString(),
    });
    return { ok: true };
  });

export const createRecallTask = createServerFn({ method: "POST" })
  .validator(
    (data: { patient_id: string; note?: string; recipients: { id: string; label: string }[] }) =>
      data,
  )
  .handler(async ({ data }) => {
    const me = requireStaff();
    const requested = data.recipients.length
      ? data.recipients
      : [{ id: me.userId, label: me.profile?.full_name ?? "The team" }];
    const openTasks = recallTasks.filter(
      (t) => t.patient_id === data.patient_id && t.status !== "completed",
    );
    const note = (data.note ?? "").trim();
    const sameNote = openTasks.filter((t) => (t.note ?? "").trim() === note);
    const alreadyAssigned = new Set(
      (sameNote.length ? sameNote : openTasks).map((t) => t.assigned_to),
    );
    const recipients = requested.filter((r) => !alreadyAssigned.has(r.id));
    if (!recipients.length) {
      return {
        ok: true,
        duplicate: true,
        group_id: (sameNote[0] ?? openTasks[0])?.group_id ?? null,
      };
    }
    const groupId =
      sameNote[0]?.group_id || sameNote[0]?.id || newId("k8");
    const now = new Date().toISOString();
    for (const r of recipients) {
      recallTasks.unshift({
        id: newId("k9"),
        clinic_id: CLINIC_ID,
        patient_id: data.patient_id,
        group_id: groupId,
        assigned_to: r.id,
        assigned_label: r.label,
        created_by: me.userId,
        note: data.note ?? null,
        status: "sent",
        contacted_at: null,
        contacted_by: null,
        completed_at: null,
        completed_by: null,
        status_by_label: null,
        created_at: now,
        updated_at: now,
        reassigned_at: null,
      });
    }
    return { ok: true, group_id: groupId };
  });

export const updateRecallTask = createServerFn({ method: "POST" })
  .validator(
    (data: {
      task_id: string;
      recipients: { id: string; label: string }[];
      note?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const me = requireStaff();
    if (!me.isManager) throw new Error("Manager access only");
    if (!data.recipients.length) throw new Error("Pick at least one team member");

    const target = recallTasks.find((t) => t.id === data.task_id);
    if (!target) throw new Error("Recall task not found");
    const groupId = target.group_id || target.id;
    const group = target.group_id
      ? recallTasks.filter((t) => t.group_id === target.group_id)
      : recallTasks.filter((t) => t.id === target.id || t.group_id === target.id);

    const now = new Date().toISOString();
    const note = data.note !== undefined ? data.note : (target.note ?? null);
    const prevIds = new Set(group.map((g) => g.assigned_to));
    const nextIds = new Set(data.recipients.map((r) => r.id));
    const assigneesChanged =
      prevIds.size !== nextIds.size || [...prevIds].some((id) => !nextIds.has(id));
    const assigneesAdded = data.recipients.some((r) => !prevIds.has(r.id));
    const assigneesRemoved = group.some((g) => !nextIds.has(g.assigned_to));
    const reassignedAt = assigneesAdded
      ? now
      : assigneesRemoved
        ? null
        : ((target as any).reassigned_at ?? null);

    const template = group[0]!;
    for (let i = recallTasks.length - 1; i >= 0; i--) {
      const task = recallTasks[i]!;
      const inGroup = group.some((g) => g.id === task.id);
      if (!inGroup) continue;
      if (!nextIds.has(task.assigned_to)) {
        recallTasks.splice(i, 1);
      }
    }

    for (const r of data.recipients) {
      const existing = recallTasks.find(
        (t) => (t.group_id === groupId || t.id === groupId) && t.assigned_to === r.id,
      );
      if (existing) {
        existing.assigned_label = r.label;
        existing.note = note;
        existing.group_id = groupId;
        existing.updated_at = now;
        (existing as any).reassigned_at = reassignedAt;
      } else {
        recallTasks.unshift({
          id: newId("k9"),
          clinic_id: CLINIC_ID,
          patient_id: template.patient_id,
          group_id: groupId,
          assigned_to: r.id,
          assigned_label: r.label,
          created_by: template.created_by ?? me.userId,
          note,
          status: template.status,
          contacted_at: template.contacted_at,
          contacted_by: template.contacted_by,
          completed_at: template.completed_at,
          completed_by: template.completed_by,
          status_by_label: template.status_by_label,
          reassigned_at: reassignedAt,
          created_at: template.created_at,
          updated_at: now,
        } as any);
      }
    }
    return { ok: true, group_id: groupId, reassigned: assigneesChanged };
  });

export const setRecallTaskStatus = createServerFn({ method: "POST" })
  .validator((data: { task_id: string; status: "sent" | "contacted" | "completed" }) => data)
  .handler(async ({ data }) => {
    const me = requireStaff();
    const now = new Date().toISOString();
    const actor = me.profile?.full_name || me.email || "A team member";
    const target = recallTasks.find((t) => t.id === data.task_id);
    if (!target) throw new Error("Recall task not found");
    const group = target.group_id
      ? recallTasks.filter((t) => t.group_id === target.group_id)
      : [target];

    if (!me.isManager) {
      const isFrontDesk = me.roles.includes("front_desk");
      const isAssignee = group.some((t) => t.assigned_to === me.userId);
      if (!isAssignee && !isFrontDesk) {
        throw new Error("Only the assigned team member can update this recall task");
      }
    }

    for (const task of group) {
      task.status = data.status;
      task.contacted_at = data.status === "sent" ? null : now;
      task.completed_at = data.status === "completed" ? now : null;
      task.contacted_by = data.status === "sent" ? null : me.userId;
      task.completed_by = data.status === "completed" ? me.userId : null;
      task.status_by_label = data.status === "sent" ? null : actor;
      task.updated_at = now;
    }
    return { ok: true };
  });

export const deleteRecallTask = createServerFn({ method: "POST" })
  .validator((data: { task_id: string; assignee_ids?: string[] }) => data)
  .handler(async ({ data }) => {
    const me = identity();
    if (!me.isOwner && !me.permissions.includes("tasks.delete")) {
      throw new Error("You do not have access to delete tasks");
    }
    const target = recallTasks.find((t) => t.id === data.task_id);
    if (!target) return { ok: true, removed: [] as string[] };
    const group = target.group_id
      ? recallTasks.filter((t) => t.group_id === target.group_id)
      : [target];
    const pick = data.assignee_ids?.length
      ? new Set(data.assignee_ids)
      : new Set(group.map((t) => t.assigned_to as string));
    const removed: string[] = [];
    for (let i = recallTasks.length - 1; i >= 0; i--) {
      const task = recallTasks[i]!;
      const inGroup = target.group_id ? task.group_id === target.group_id : task.id === target.id;
      if (!inGroup || !pick.has(task.assigned_to)) continue;
      removed.push((task.assigned_label as string) || "Assignee");
      recallTasks.splice(i, 1);
    }
    const now = new Date().toISOString();
    for (const task of recallTasks) {
      const inGroup = target.group_id ? task.group_id === target.group_id : task.id === target.id;
      if (inGroup) {
        (task as any).reassigned_at = null;
        task.updated_at = now;
      }
    }
    return { ok: true, removed };
  });

export const listRecallTasks = createServerFn({ method: "GET" })
  .validator((data: { patient_id: string }) => data)
  .handler(async ({ data }) => {
    requireStaff();
    return sortDesc(
      recallTasks.filter((t) => t.patient_id === data.patient_id),
      "created_at",
    );
  });

export const listOpenRecallTasks = createServerFn({ method: "GET" }).handler(async () => {
  const me = requireStaff();
  const rows = sortDesc(
    recallTasks.filter(
      (t) => t.status !== "completed" && (me.isManager || t.assigned_to === me.userId),
    ),
    "created_at",
  ).map((t) => {
    const p = patientById(t.patient_id);
    return {
      ...t,
      patients: p
        ? {
            id: p.id,
            first_name: p.first_name,
            last_name: p.last_name,
            phone: p.phone,
            email: p.email,
          }
        : null,
    };
  });
  // One card per chase-up (group), and collapse identical patient+note duplicates.
  const byGroup = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const key = row.group_id || row.id;
    const prev = byGroup.get(key);
    if (!prev || (row.assigned_to === me.userId && prev.assigned_to !== me.userId)) {
      byGroup.set(key, row);
    }
  }
  const byChase = new Map<string, (typeof rows)[number]>();
  for (const row of byGroup.values()) {
    const key = `${row.patient_id}::${(row.note ?? "").trim()}`;
    const prev = byChase.get(key);
    if (!prev || (row.assigned_to === me.userId && prev.assigned_to !== me.userId)) {
      byChase.set(key, row);
    }
  }
  return sortDesc([...byChase.values()], "created_at").slice(0, 25);
});

/* ---------------------------------------------------------------- */
/* settings: colours, catalogue, clinic, permissions, notes           */
/* ---------------------------------------------------------------- */

function requireSettings() {
  const me = requireStaff();
  if (!me.isOwner && !me.permissions.includes("settings.treatments")) {
    throw new Error("You do not have access to change clinic settings");
  }
  return me;
}

export const listTreatmentColours = createServerFn({ method: "GET" }).handler(async () => {
  const map: Record<string, number | string> = {};
  for (const row of treatmentColours) map[row.treatment_name] = row.hex ?? row.lane;
  return map;
});

export const saveTreatmentColour = createServerFn({ method: "POST" })
  .validator((data: { treatment_name: string; lane: number | null; hex?: string | null }) => data)
  .handler(async ({ data }) => {
    const me = requireSettings();
    const key = data.treatment_name.trim().toLowerCase();
    if (!key) throw new Error("Treatment name is required");
    const hex = data.hex ? data.hex.trim().toLowerCase() : null;
    if (hex && !/^#[0-9a-f]{6}$/.test(hex)) throw new Error("Invalid colour");

    const index = treatmentColours.findIndex((c) => c.treatment_name === key);
    if (data.lane === null && !hex) {
      if (index >= 0) treatmentColours.splice(index, 1);
      return { ok: true };
    }
    const lane = hex ? 1 : data.lane;
    if (!Number.isInteger(lane) || (lane as number) < 1 || (lane as number) > 8)
      throw new Error("Invalid colour");
    const row = {
      treatment_name: key,
      lane,
      hex,
      updated_by: me.userId,
      updated_at: new Date().toISOString(),
    };
    if (index >= 0) treatmentColours[index] = row;
    else treatmentColours.push(row);
    return { ok: true };
  });

export const listColourThemes = createServerFn({ method: "GET" }).handler(async () =>
  [...colourThemes].sort((a, b) => String(a.name).localeCompare(String(b.name))),
);

export const saveColourTheme = createServerFn({ method: "POST" })
  .validator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    const me = requireSettings();
    const name = data.name.trim();
    if (!name) throw new Error("Theme name is required");
    const colours: Record<string, number | string> = {};
    for (const row of treatmentColours) colours[row.treatment_name] = row.hex ?? row.lane;
    const existing = colourThemes.find((t) => String(t.name).toLowerCase() === name.toLowerCase());
    if (existing) {
      existing.name = name;
      existing.colours = colours;
      return { ok: true, id: existing.id, replaced: true };
    }
    const created = {
      id: newId("n9"),
      name,
      colours,
      created_by: me.userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    colourThemes.push(created);
    return { ok: true, id: created.id, replaced: false };
  });

export const applyColourTheme = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const me = requireSettings();
    const theme = colourThemes.find((t) => t.id === data.id);
    if (!theme) throw new Error("Theme not found");
    const colours = (theme.colours ?? {}) as Record<string, number | string>;
    treatmentColours.length = 0;
    for (const [treatment_name, value] of Object.entries(colours)) {
      treatmentColours.push({
        treatment_name,
        lane: typeof value === "number" ? value : 1,
        hex: typeof value === "string" ? value : null,
        updated_by: me.userId,
        updated_at: new Date().toISOString(),
      });
    }
    return { ok: true, applied: treatmentColours.length };
  });

export const deleteColourTheme = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    requireSettings();
    const index = colourThemes.findIndex((t) => t.id === data.id);
    if (index >= 0) colourThemes.splice(index, 1);
    return { ok: true };
  });

export const listCatalogueItems = createServerFn({ method: "GET" }).handler(async () =>
  [...catalogue].sort(
    (a, b) => Number(b.active) - Number(a.active) || String(a.name).localeCompare(String(b.name)),
  ),
);

export type CatalogueInput = {
  id?: string | null;
  name: string;
  category?: string | null;
  description?: string | null;
  price?: number | null;
  interval_days?: number | null;
  duration_minutes?: number | null;
  cooling_off_hours?: number | null;
  requires_consent?: boolean;
  active?: boolean;
};

export const saveCatalogueItem = createServerFn({ method: "POST" })
  .validator((data: CatalogueInput) => data)
  .handler(async ({ data }) => {
    requireSettings();
    const name = (data.name ?? "").trim();
    if (!name) throw new Error("Treatment name is required");
    const row = {
      clinic_id: CLINIC_ID,
      name,
      category: data.category?.trim() || null,
      description: data.description?.trim() || null,
      price: data.price ?? null,
      interval_days: data.interval_days ?? null,
      duration_minutes: clampDurationMinutes(data.duration_minutes),
      cooling_off_hours: data.cooling_off_hours ?? 0,
      requires_consent: data.requires_consent ?? true,
      active: data.active ?? true,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const existing = catalogue.find((c) => c.id === data.id);
      if (existing) Object.assign(existing, row);
      return { ok: true, id: data.id };
    }
    const created = { id: newId("c9"), created_at: new Date().toISOString(), ...row };
    catalogue.push(created);
    return { ok: true, id: created.id };
  });

export const setCatalogueItemActive = createServerFn({ method: "POST" })
  .validator((data: { id: string; active: boolean }) => data)
  .handler(async ({ data }) => {
    requireSettings();
    const row = catalogue.find((c) => c.id === data.id);
    if (row) row.active = data.active;
    return { ok: true };
  });

export const getClinicDetails = createServerFn({ method: "GET" }).handler(async () => ({
  id: db.clinic["id"],
  name: db.clinic["name"],
  address: db.clinic["address"],
  phone: db.clinic["phone"],
  email: db.clinic["email"],
}));

export const updateClinicDetails = createServerFn({ method: "POST" })
  .validator(
    (data: {
      name: string;
      address?: string | null;
      phone?: string | null;
      email?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    requireSettings();
    const name = (data.name ?? "").trim();
    if (!name) throw new Error("Clinic name is required");
    db.clinic["name"] = name;
    db.clinic["address"] = data.address?.trim() || null;
    db.clinic["phone"] = data.phone?.trim() || null;
    db.clinic["email"] = assertEmail(data.email ?? "", "clinic email", true);
    return { ok: true };
  });

export const listRolePermissions = createServerFn({ method: "GET" }).handler(async () => {
  const me = requireStaff();
  const grants: Record<string, Record<string, boolean>> = { manager: {}, front_desk: {}, practitioner: {} };
  for (const role of ["manager", "front_desk", "practitioner"]) {
    for (const key of PERMISSION_KEYS) {
      grants[role]![key] =
        rolePermissions.find((r) => r.role === role && r.permission === key)?.enabled ?? false;
    }
  }
  return { grants, canEdit: me.isOwner };
});

export const setRolePermission = createServerFn({ method: "POST" })
  .validator(
    (data: { role: "manager" | "front_desk" | "practitioner"; permission: string; enabled: boolean }) => data,
  )
  .handler(async ({ data }) => {
    const me = identity();
    if (!me.isOwner) throw new Error("Clinic owner access only");
    if (!(PERMISSION_KEYS as readonly string[]).includes(data.permission))
      throw new Error("Unknown permission");
    const row = rolePermissions.find(
      (r) => r.role === data.role && r.permission === data.permission,
    );
    if (row) row.enabled = data.enabled;
    else
      rolePermissions.push({
        id: newId("b9"),
        role: data.role,
        permission: data.permission,
        enabled: data.enabled,
        updated_by: me.userId,
        updated_at: new Date().toISOString(),
      });
    return { ok: true };
  });

export const getMyNote = createServerFn({ method: "GET" }).handler(async () => {
  const me = identity();
  const row = userNotes.find((n) => n.user_id === me.userId);
  return { body: row?.body ?? "", updatedAt: row?.updated_at ?? null };
});

export const saveMyNote = createServerFn({ method: "POST" })
  .validator((data: { body: string }) => ({
    body: sanitizeNoteHtml(String(data?.body ?? "")),
  }))
  .handler(async ({ data }) => {
    const me = identity();
    const now = new Date().toISOString();
    let row = userNotes.find((n) => n.user_id === me.userId);
    if (!row) {
      row = { id: newId("q9"), user_id: me.userId, body: "", created_at: now, updated_at: now };
      userNotes.push(row);
    }
    row.body = data.body;
    row.updated_at = now;
    return { body: row.body, updatedAt: row.updated_at };
  });

function chatPair(a: string, b: string) {
  return a < b ? ([a, b] as const) : ([b, a] as const);
}

function getOrCreateDemoConversation(meId: string, peerUserId: string) {
  const [userLow, userHigh] = chatPair(meId, peerUserId);
  let row = staffConversations.find(
    (c) => c.clinic_id === CLINIC_ID && c.user_low === userLow && c.user_high === userHigh,
  );
  if (!row) {
    row = {
      id: newId("sc"),
      clinic_id: CLINIC_ID,
      user_low: userLow,
      user_high: userHigh,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    staffConversations.push(row);
  }
  return row;
}

export const getStaffChat = createServerFn({ method: "GET" })
  .validator((data: { peerUserId: string }) => data)
  .handler(async ({ data }) => {
    const me = requireStaff();
    if (data.peerUserId === me.userId) throw new Error("Choose a teammate to message");
    const conversation = getOrCreateDemoConversation(me.userId, data.peerUserId);
    const messages = staffChatMessages
      .filter((m) => m.conversation_id === conversation.id)
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    const peerReadAt =
      staffConversationReads.find((r) => r.conversation_id === conversation.id && r.user_id === data.peerUserId)
        ?.last_read_at ?? null;
    const myReadAt =
      staffConversationReads.find((r) => r.conversation_id === conversation.id && r.user_id === me.userId)
        ?.last_read_at ?? null;
    const peer = data.peerUserId;
    const alerts = staffNotifications
      .filter(
        (n) =>
          (n.kind === "urgent" || n.kind === "staff_message") &&
          n.sender_id &&
          ((n.sender_id === me.userId && n.recipient_id === peer) ||
            (n.sender_id === peer && n.recipient_id === me.userId)),
      )
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .slice(0, 200)
      .map((n) => ({
        id: n.id as string,
        sender_id: n.sender_id as string,
        recipient_id: n.recipient_id as string,
        title: n.title as string,
        body: (n.body as string | null) ?? null,
        urgent: !!n.urgent || n.kind === "urgent",
        kind: n.kind as string,
        read_at: (n.read_at as string | null) ?? null,
        created_at: n.created_at as string,
        mine: n.sender_id === me.userId,
      }));
    return {
      conversationId: conversation.id as string,
      peer: {
        id: peer,
        full_name: profileName(peer) ?? "Teammate",
        job_title: profiles.find((p) => p.id === peer)?.job_title ?? null,
        avatar_url: profiles.find((p) => p.id === peer)?.avatar_url ?? null,
      },
      peerReadAt,
      myReadAt,
      messages: messages.map((m) => ({
        id: m.id as string,
        sender_id: m.sender_id as string,
        body: m.body as string,
        attachments: Array.isArray(m.attachments) ? m.attachments : [],
        created_at: m.created_at as string,
        mine: m.sender_id === me.userId,
        readByPeer:
          m.sender_id === me.userId && peerReadAt != null && String(peerReadAt) >= String(m.created_at),
      })),
      alerts,
    };
  });

export const sendStaffChatMessage = createServerFn({ method: "POST" })
  .validator(
    (data: {
      peerUserId: string;
      body: string;
      attachments?: { path: string; name: string; type: string; size: number }[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const me = requireStaff();
    const attachments = (data.attachments ?? []).slice(0, 5);
    const body =
      data.body.trim() ||
      (attachments.length === 1 ? "Sent an attachment" : attachments.length > 1 ? "Sent attachments" : "");
    if (!body && attachments.length === 0) throw new Error("Write a message first");
    if (data.peerUserId === me.userId) throw new Error("Choose a teammate to message");
    const conversation = getOrCreateDemoConversation(me.userId, data.peerUserId);
    const now = new Date().toISOString();
    const message = {
      id: newId("sm"),
      conversation_id: conversation.id,
      clinic_id: CLINIC_ID,
      sender_id: me.userId,
      body,
      attachments,
      created_at: now,
    };
    staffChatMessages.push(message);
    conversation.updated_at = now;
    const existingRead = staffConversationReads.find(
      (r) => r.conversation_id === conversation.id && r.user_id === me.userId,
    );
    if (existingRead) existingRead.last_read_at = now;
    else staffConversationReads.push({ conversation_id: conversation.id, user_id: me.userId, last_read_at: now });

    const from = me.profile?.full_name || "A colleague";
    for (let i = staffNotifications.length - 1; i >= 0; i--) {
      const n = staffNotifications[i];
      if (
        n.recipient_id === data.peerUserId &&
        n.sender_id === me.userId &&
        n.kind === "staff_chat" &&
        !n.read_at
      ) {
        staffNotifications.splice(i, 1);
      }
    }
    staffNotifications.unshift({
      id: newId("l1"),
      clinic_id: CLINIC_ID,
      recipient_id: data.peerUserId,
      sender_id: me.userId,
      kind: "staff_chat",
      title: `Message from ${from}`,
      body: body.slice(0, 180),
      urgent: false,
      patient_id: null,
      appointment_id: null,
      read_at: null,
      created_at: now,
    });

    return {
      conversationId: conversation.id as string,
      message: { ...message, mine: true, readByPeer: false },
    };
  });

export const markStaffChatRead = createServerFn({ method: "POST" })
  .validator((data: { peerUserId: string }) => data)
  .handler(async ({ data }) => {
    const me = requireStaff();
    const conversation = getOrCreateDemoConversation(me.userId, data.peerUserId);
    const now = new Date().toISOString();
    const existing = staffConversationReads.find(
      (r) => r.conversation_id === conversation.id && r.user_id === me.userId,
    );
    if (existing) existing.last_read_at = now;
    else staffConversationReads.push({ conversation_id: conversation.id, user_id: me.userId, last_read_at: now });

    for (const n of staffNotifications) {
      if (
        n.recipient_id === me.userId &&
        n.sender_id === data.peerUserId &&
        n.kind === "staff_chat" &&
        !n.read_at
      ) {
        n.read_at = now;
      }
    }
    return { ok: true, lastReadAt: now, conversationId: conversation.id as string };
  });
