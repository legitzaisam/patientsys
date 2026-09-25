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
  formerTeamSeed,
  newId,
  patientName,
  profileName,
  type DemoRole,
} from "@/lib/demo/data";
import { clampDurationMinutes } from "@/lib/treatment-duration";
import { clinicDayDiff, clinicDayKey } from "@/lib/clinic-time";
import { plainVisitNote, sanitizeNoteHtml } from "@/lib/sanitize-note-html";
import { mintVoiceToken, voiceAvailable, voiceTargetFor } from "@/lib/comms/voice.server";
import { isPatientReplyPending, schedulePatientReply } from "@/lib/demo/patient-ai.server";
import { parseInput } from "@/lib/validation/parse";
import * as schemas from "@/lib/validation/schemas";
import * as portal from "@/lib/portal/shape";
import { CONSENT_BODY_DEFAULT, PRE_TREATMENT_CHECKS, canStartTreatment, consentReady, stageHeldForConsent } from "@/lib/visit-stage";
import { fieldsFor, foldResults } from "@/lib/treatment-results";
import { aftercarePointsFor } from "@/lib/aftercare-defaults";
import { advanceToWaitingIfReadyDemo, demoConsentStateOf } from "@/lib/visit-stage.demo";
import { EMAIL_OTP_RESEND_MS } from "@/lib/auth/constants";
import {
  findPractitionerOverlap,
  PRACTITIONER_OVERLAP_MESSAGE,
} from "@/lib/appointment-overlap";
import {
  bookingDetailsMessage,
  formatMoney,
  patientPaymentUrl,
  paymentRequestMessage,
  type PaymentLinkKind,
} from "@/lib/payment-link";
import { assertEmail } from "@/lib/email";
// Re-exported rather than redeclared: a second copy of the key list silently
// drifted from the real one, so demo mode enforced a different set of
// capabilities than production.
import { PERMISSION_KEYS, can, type PermissionKey } from "@/lib/permissions";
import { assertCanSend, nextUnsubscribedAt, prefsFromPatient } from "@/lib/comms/preferences";
import { buildStageCohorts, previewStage, stageCounts } from "@/lib/offers/cohorts";
import { sendOfferToPatients, type OfferStore } from "@/lib/offers/send";
import { effectiveOfferStatus, liveClaimedOffer, patientOfferView } from "@/lib/offers/shape";
import { STAGE_LABEL, STAGE_META } from "@/lib/offers/stages";
import {
  appointmentReminderMessage,
  bookingUpdatedMessage,
  channelsFor,
  consentRequestMessage,
  publicSigningUrl,
  reminderTimes,
} from "@/lib/comms/templates";

export { PERMISSION_KEYS, type PermissionKey };

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
const treatmentPlans = db.treatmentPlans as any[];
const planMilestones = db.planMilestones as any[];
const planMilestoneChecklist = db.planMilestoneChecklist as any[];
const planPauseRequests = db.planPauseRequests as any[];
const journalEntries = db.journalEntries as any[];
const journalAttachments = db.journalAttachments as any[];
const recoveryCheckins = db.recoveryCheckins as any[];
const routineCompletions = db.routineCompletions as any[];
const skincareRoutines = db.skincareRoutines as any[];
const routineItemOverrides = db.routineItemOverrides as any[];
const treatmentSessions = db.treatmentSessions as any[];
const routineItems = db.routineItems as any[];
const clinicNews = db.clinicNews as any[];
const clinicOffers = db.clinicOffers as any[];
const externalTreatments = db.externalTreatments as any[];
const retentionOutreach = db.retentionOutreach as any[];
const staffNotifications = db.staffNotifications as any[];
const staffConversations = db.staffConversations as any[];
const staffChatMessages = db.staffChatMessages as any[];
const staffConversationReads = db.staffConversationReads as any[];
const messageTemplates = db.messageTemplates as any[];
const communications = db.communications as any[];
const treatmentColours = db.treatmentColours as any[];
const colourThemes = db.colourThemes as any[];
const profileChangeRequests = db.profileChangeRequests as any[];
const staffDocuments = db.staffDocuments as any[];
const userNotes = db.userNotes as any[];
const websiteLeads = db.websiteLeads as any[];
const retailProducts = db.retailProducts as any[];
const productSales = db.productSales as any[];
const offerTemplates = db.offerTemplates as any[];
const patientOffers = db.patientOffers as any[];

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
    value === "owner" ||
    value === "admin"
  ) {
    return value;
  }
  return "owner";
}

/** userIds that must change password after invite/reset */
const mustChangePasswordByUser = new Set<string>();

type DemoSession = { id: string; current: boolean; createdAt: string; label?: string };

function seedDemoSessions(): DemoSession[] {
  const now = Date.now();
  return [
    { id: "current", current: true, createdAt: new Date(now).toISOString(), label: "This device" },
    {
      id: "other-phone",
      current: false,
      createdAt: new Date(now - 2 * 86400000).toISOString(),
      label: "Safari on iPhone",
    },
    {
      id: "other-clinic",
      current: false,
      createdAt: new Date(now - 9 * 86400000).toISOString(),
      label: "Chrome at the clinic desk",
    },
  ];
}

let demoSessions: DemoSession[] = seedDemoSessions();
const passwordChangeCodes = new Map<string, string>();
const passwordChangeCodeAt = new Map<string, number>();
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
const exTeamMembers: ExTeamMember[] = formerTeamSeed.map((row) => ({ ...row }));

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
  isAdmin: boolean;
  isManager: boolean;
  canDelete: boolean;
  isPatient: boolean;
  permissions: string[];
  profile: any;
  patient: any;
  mustChangePassword: boolean;
  welcomePending: boolean;
  aal: "aal1" | "aal2";
  mfaEnrolled: boolean;
  mfaRequired: boolean;
  emailMfaSatisfied: boolean;
};

function identity(): Identity {
  const role = currentRole();
  const account = DEMO_ACCOUNTS[role];
  const isStaff = role !== "patient";
  const isOwner = role === "owner";
  const isAdmin = role === "admin";
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
    isAdmin,
    isManager,
    canDelete: isOwner,
    isPatient: !isStaff,
    permissions,
    profile,
    mustChangePassword: mustChangePasswordByUser.has(account.userId),
    welcomePending: isStaff && welcomePendingByUser.has(account.userId),
    aal: "aal2",
    mfaEnrolled: false,
    mfaRequired: false,
    emailMfaSatisfied: true,
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

function requireCapability(key: PermissionKey) {
  const me = identity();
  if (!can(me, key)) throw new Error("You do not have access to this area");
  return me;
}

function requireAccessAdmin() {
  const me = identity();
  // Owner saves the Team staff-access grid. Admin saves the /access catalogue.
  if (!me.isOwner && !me.isAdmin) throw new Error("Admin access required");
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
    avatar_url: p.avatar_url ?? null,
    id: p.id,
  };
}

function appointmentView(a: any) {
  const consent = demoConsentStateOf(a);
  // A visit already marked waiting without a signed form is held at arrived.
  if (a.stage === "waiting" && !consentReady(consent)) {
    a.stage = "arrived";
    a.updated_at = new Date().toISOString();
  }
  const doc = a.consent_document_id ? documents.find((d) => d.id === a.consent_document_id) : null;
  const note = appointmentNotes.find((n) => n.appointment_id === a.id);
  const item = a.catalogue_id ? catalogue.find((c) => c.id === a.catalogue_id) : null;
  return {
    ...a,
    patients: patientJoin(a.patient_id),
    profiles: a.practitioner_id ? { full_name: profileName(a.practitioner_id) } : null,
    documents: doc ? { status: doc.status, title: doc.title } : null,
    treatment_catalogue: item ? { requires_consent: Boolean(item.requires_consent) } : null,
    consentState: consent,
    appointment_notes: note
      ? {
          body: plainVisitNote(note.body),
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
  const me = requireCapability("view.dashboard");
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
  // Mirrors production: one due date per patient, from their most recent
  // treatment that carries one.
  const latestDueByPatient = new Map<string, (typeof treatments)[number]>();
  for (const t of treatments) {
    if (!t.next_due_at) continue;
    const cur = latestDueByPatient.get(t.patient_id);
    if (!cur || t.performed_at > cur.performed_at) latestDueByPatient.set(t.patient_id, t);
  }
  let dueAll = [...latestDueByPatient.values()].filter((t) => t.next_due_at <= in30);
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

  // Mirrors production: a practitioner's book is everyone they have treated or
  // hold a non-cancelled appointment for; the chip is book size now vs the end
  // of last month.
  const monthStartMs = new Date(monthStart).getTime();
  let ownClients: number | null = null;
  let ownClientsPrev = 0;
  if (isPractitioner && !isManager) {
    const firstSeen = new Map<string, number>();
    for (const t of treatments.filter((t) => t.practitioner_id === me.userId)) {
      const ms = new Date(t.performed_at).getTime();
      firstSeen.set(t.patient_id, Math.min(firstSeen.get(t.patient_id) ?? Infinity, ms));
    }
    for (const a of appointments.filter((a) => a.practitioner_id === me.userId && a.status !== "cancelled")) {
      const ms = new Date(a.starts_at).getTime();
      firstSeen.set(a.patient_id, Math.min(firstSeen.get(a.patient_id) ?? Infinity, ms));
    }
    ownClients = firstSeen.size;
    ownClientsPrev = [...firstSeen.values()].filter((ms) => ms < monthStartMs).length;
  }
  const clinicClientsPrev = all.filter((p) => new Date(p.created_at).getTime() < monthStartMs).length;
  const clientsNow = ownClients ?? all.length;
  const clientsPrev = ownClients === null ? clinicClientsPrev : ownClientsPrev;
  const clientsChange = clientsPrev ? Math.round(((clientsNow - clientsPrev) / clientsPrev) * 100) : 0;

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

  // ---- Journeys: active plans grouped by phase (dashboard bottom section).
  let activePlans = treatmentPlans.filter((p) => p.status === "active");
  if (isPractitioner && !isManager) {
    activePlans = activePlans.filter((p) => !p.practitioner_id || p.practitioner_id === me.userId);
  }
  const todayKeyForPlans = clinicDayKey(today);
  const journeyPhases = (["consult", "foundation", "build", "results"] as const).map((phase) => {
    const inPhase = activePlans.filter((p) => p.phase === phase);
    return {
      phase,
      count: inPhase.length,
      plans: inPhase.slice(0, 4).map((p) => {
        const mine = planMilestones.filter((m) => m.plan_id === p.id).sort((a, b) => a.idx - b.idx);
        const patient = patientById(p.patient_id);
        const summary = portal.journeyPlanSummary(mine, todayKeyForPlans);
        return {
          id: p.id,
          patientId: p.patient_id,
          patientName: `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim(),
          avatarUrl: patient?.avatar_url ?? null,
          name: p.name,
          kind: p.kind ?? "treatment",
          ...summary,
          total: summary.total || p.total_sessions,
        };
      }),
    };
  });
  const overduePlanIds = new Set<string>();
  for (const m of planMilestones) {
    if ((m.status === "current" || m.status === "upcoming") && m.due_date && m.due_date < todayKeyForPlans) {
      overduePlanIds.add(m.plan_id);
    }
  }
  const journeys = {
    activeCount: activePlans.length,
    overdueCount: activePlans.filter((p) => overduePlanIds.has(p.id)).length,
    phases: journeyPhases,
  };

  // Same enrichment as production: diary cards read "Session X of Y" from the
  // patient's active plan when one exists.
  const planByPatient = new Map<string, { name: string; totalSessions: number }>();
  for (const p of activePlans) {
    if (!planByPatient.has(p.patient_id)) {
      planByPatient.set(p.patient_id, { name: p.name, totalSessions: p.total_sessions });
    }
  }
  todayAppts = todayAppts.map((a: any) => {
    const claimed = liveClaimedOffer(
      patientOffers.filter((o) => o.patient_id === a.patient_id && o.status === "claimed"),
    );
    return {
      ...a,
      plan: planByPatient.get(a.patient_id) ?? null,
      claimedOffer: claimed ? { id: claimed.id, headline: claimed.headline, code: claimed.code } : null,
    };
  });

  // ---- Safe to proceed: today/tomorrow bookings with pre-visit blockers.
  const horizonEnd = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 2,
  ).toISOString();
  let horizon = sortAsc(
    appointments.filter(
      (a) => a.status === "booked" && a.starts_at >= range.startISO && a.starts_at < horizonEnd,
    ),
    "starts_at",
  ).map(appointmentView);
  if (isPractitioner && !isManager) {
    horizon = horizon.filter((a) => a.practitioner_id === me.userId);
  }
  const safeToProceed: any[] = [];
  for (const a of horizon) {
    const patient = patientById(a.patient_id);
    const blockers: string[] = [];
    if (a.documents?.status !== "signed") blockers.push("Consent not signed");
    if (a.payment_status === "unpaid") blockers.push("Deposit unpaid");
    else if (a.payment_status === "deposit_paid") blockers.push("Balance due");
    const allergies = (patient?.allergies ?? "").trim();
    if (allergies && allergies.toLowerCase() !== "none" && allergies.toLowerCase() !== "none known") {
      blockers.push(`Allergy: ${allergies.slice(0, 60)}`);
    }
    if (blockers.length === 0) continue;
    safeToProceed.push({
      id: a.id,
      patientId: a.patient_id,
      patientName: `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim() || "Patient",
      avatarUrl: patient?.avatar_url ?? null,
      treatment: a.treatment_name,
      startsAt: a.starts_at,
      blockers,
    });
    if (safeToProceed.length >= 8) break;
  }
  const safeReadyCount = horizon.length - safeToProceed.length;

  return {
    kpis: {
      scope: isPractitioner && !isManager ? "own" : "clinic",
      totalClients: all.length,
      ownClients,
      clientsChange,
      activeClients: active,
      inactiveClients: inactive,
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
    journeys,
    safeToProceed,
    safeReadyCount,
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
      const outstanding = documents.filter(
        (d) => d.patient_id === p.id && (d.status === "sent" || d.status === "viewed"),
      ).length;

      // Active practitioner(s): next booking's owner first, then recent treaters.
      const practitionerIds: string[] = [];
      if (next?.practitioner_id) practitionerIds.push(next.practitioner_id);
      for (const t of sortDesc(mine, "performed_at")) {
        if (t.practitioner_id && !practitionerIds.includes(t.practitioner_id)) {
          practitionerIds.push(t.practitioner_id);
        }
      }
      const practitionerNames = practitionerIds.map((pid) => profileName(pid)).filter(Boolean);

      // Open items: assigned recall tasks plus derived chase items.
      const todayKey = clinicDayKey(new Date());
      const openTasks: { id: string; label: string; kind: string }[] = recallTasks
        .filter((t) => t.patient_id === p.id && (t.status === "open" || t.status === "contacted"))
        .map((t) => ({
          id: t.id,
          label: t.note?.trim() ? String(t.note).trim().slice(0, 80) : "Follow up and rebook",
          kind: t.status === "contacted" ? "recall_contacted" : "recall",
        }));
      if (outstanding > 0) {
        openTasks.push({
          id: `docs-${p.id}`,
          label: `${outstanding} form${outstanding === 1 ? "" : "s"} awaiting signature`,
          kind: "paperwork",
        });
      }
      if (dueRow?.next_due_at && dueRow.next_due_at < todayKey) {
        openTasks.push({ id: `due-${p.id}`, label: `${dueRow.name} overdue`, kind: "treatment_due" });
      }

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
        outstandingDocuments: outstanding,
        practitioners: practitionerNames,
        openTasks,
      };
    });
});

export const getPatientMetrics = createServerFn({ method: "GET" }).handler(async () => {
  const me = requireStaff();
  if (!me.isOwner && !me.permissions.includes("reports.insights")) {
    throw new Error("You do not have access to insights reports");
  }
  const { buildBookMetrics } = await import("./insights.server");
  return buildBookMetrics({
    patients,
    treatments,
    appointments,
  });
});

export const getPatient = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => parseInput(schemas.GetPatient, data))
  .handler(async ({ data }) => {
    const me = identity();
    if (me.patient?.id !== data.id) requireCapability("view.patients");
    const patient = patientById(data.id);
    if (!patient) throw new Error("Patient not found");
    const nowIso = new Date().toISOString();
    const withRecord = new Set(
      treatmentSessions.filter((s) => s.patient_id === data.id && s.status === "complete").map((s) => s.treatment_id),
    );
    const mine = sortDesc(
      treatments.filter((t) => t.patient_id === data.id),
      "performed_at",
    ).map((t) => ({
      ...t,
      profiles: { full_name: profileName(t.practitioner_id) },
      hasRecord: withRecord.has(t.id),
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
        const body = plainVisitNote(view.appointment_notes?.body);
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
        const bookingNote =
          String(a.notes ?? "").replace(/^Cancelled:[^\n]*(?:\n\n)?/, "").trim() ||
          plainVisitNote(view.appointment_notes?.body);
        return {
          id: a.id as string,
          startsAt: a.starts_at as string,
          treatmentName: (a.treatment_name as string) || "Treatment",
          practitionerName: view.profiles?.full_name ?? null,
          paymentStatus: (a.payment_status as string) ?? "unpaid",
          consentSigned: docStatus === "signed",
          issues,
          bookingNote,
        };
      })
      .filter((b) => b.issues.length > 0 || b.bookingNote);
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
      journal: sortDesc(
        journalEntries.filter((e) => e.patient_id === data.id && e.shared_with_clinic),
        "entry_date",
      ).slice(0, 20),
      checkins: sortDesc(
        recoveryCheckins.filter((c) => c.patient_id === data.id),
        "checkin_date",
      )
        .slice(0, 14)
        .map((c) => ({ ...c, needsAttention: portal.checkinNeedsAttention(c as any) })),
      nextAppointmentAt: sortAsc(upcoming, "starts_at")[0]?.starts_at ?? null,
      todayVisit: (() => {
        const todayKey = new Date().toDateString();
        const visit = sortAsc(
          appointments.filter(
            (a) =>
              a.patient_id === data.id &&
              new Date(a.starts_at).toDateString() === todayKey &&
              a.status !== "cancelled" &&
              a.status !== "no_show",
          ),
          "starts_at",
        )[0];
        return visit
          ? {
              id: visit.id,
              startsAt: visit.starts_at,
              treatment: visit.treatment_name,
              stage: stageHeldForConsent(visit.stage ?? "booked", demoConsentStateOf(visit)),
              practitionerName: visit.practitioner_id ? profileName(visit.practitioner_id) : null,
              consentState: demoConsentStateOf(visit),
            }
          : null;
      })(),
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
    }) => parseInput(schemas.SavePatient, data),
  )
  .handler(async ({ data }) => {
    requireCapability("patients.edit");
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
      email_opt_in: false,
      sms_opt_in: false,
      reminders_opt_in: true,
      marketing_opt_in: false,
      unsubscribed_at: null,
      avatar_url: null,
      last_visit_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    patients.push(created);
    return { id: created.id };
  });

export const archivePatient = createServerFn({ method: "POST" })
  .validator((data: { id: string; archived: boolean; reason?: string }) =>
    parseInput(schemas.ArchivePatient, data),
  )
  .handler(async ({ data }) => {
    const row = patientById(data.id) as Record<string, unknown> | undefined;
    if (row) {
      row["deleted_at"] = data.archived ? new Date().toISOString() : null;
      row["deletion_reason"] = data.archived ? (data.reason ?? null) : null;
      row["status"] = data.archived ? "archived" : "active";
    }
    return { id: data.id, archived: data.archived };
  });

/* ---------------------------------------------------------------- */
/* catalogue, practitioners, appointments                             */
/* ---------------------------------------------------------------- */

export const listPlanPauseRequests = createServerFn({ method: "GET" }).handler(async () => {
  return sortDesc(
    planPauseRequests.filter((r) => r.status === "pending"),
    "created_at",
  ).map((r) => {
    const patient = patientById(r.patient_id);
    const plan = treatmentPlans.find((p) => p.id === r.plan_id);
    return {
      id: r.id,
      planId: r.plan_id,
      planName: plan?.name ?? "Treatment plan",
      patientId: r.patient_id,
      patientName: patient ? `${patient.first_name} ${patient.last_name}`.trim() : "Patient",
      avatarUrl: patient?.avatar_url ?? null,
      reason: r.reason,
      notes: r.notes,
      createdAt: r.created_at,
    };
  });
});

export const decidePlanPause = createServerFn({ method: "POST" })
  .validator((data: { id: string; approve: boolean; note?: string }) =>
    parseInput(schemas.DecidePlanPause, data),
  )
  .handler(async ({ data }) => {
    requireCapability("treatments.record");
    const me = identity();
    const request = planPauseRequests.find((r) => r.id === data.id);
    if (!request) throw new Error("Request not found");
    if (request.status !== "pending") return { ok: true, alreadyDecided: true };
    request.status = data.approve ? "approved" : "declined";
    request.decided_by = me.userId;
    request.decided_at = new Date().toISOString();
    request.decision_note = data.note?.trim().slice(0, 500) ?? null;
    if (data.approve) {
      const plan = treatmentPlans.find((p) => p.id === request.plan_id);
      if (plan) plan.status = "paused";
    }
    return { ok: true, alreadyDecided: false };
  });

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
  .validator((data: { from: string; to: string }) => parseInput(schemas.ListAppointments, data))
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
    }) => parseInput(schemas.SaveAppointment, data),
  )
  .handler(async ({ data }) => {
    requireCapability("appointments.edit");
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
      const beforeStartsAt = row?.starts_at as string | undefined;
      if (row) Object.assign(row, payload);
      const noteBody = String(data.notes ?? "");
      if (noteBody.trim()) {
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
      // A silent edit is fine for price or notes; a moved time is not.
      const timeChanged =
        Boolean(beforeStartsAt) && new Date(beforeStartsAt!).getTime() !== start.getTime();
      if (timeChanged) {
        notifyBookingChange({
          appointmentId: data.id,
          patientId: data.patient_id,
          treatmentName: data.treatment_name,
          treatmentNumber: data.treatment_number,
          startsAt: payload.starts_at,
          practitionerId: payload.practitioner_id,
          createdBy: me.userId,
        });
        // Reminders for the old time are stale; requeue for the new one.
        cancelPendingCommunications(data.id, "reminder");
        queueAppointmentReminders({
          appointmentId: data.id,
          patientId: data.patient_id,
          treatmentName: data.treatment_name,
          startsAt: payload.starts_at,
          practitionerId: payload.practitioner_id,
          createdBy: me.userId,
        });
      }
      return { id: data.id, notified: timeChanged };
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
    const when = formatWhenLondon(start);
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

    const queuedChannels = queueOnChannels({
      patientId: data.patient_id,
      purpose: "transactional",
      subject: `Booking confirmed — ${data.treatment_name} on ${when}`,
      body: confirmation,
      templateKey: "booking_confirmation",
      relatedEntity: "appointments",
      relatedId: created.id,
      createdBy: me.userId,
    });
    queueAppointmentReminders({
      appointmentId: created.id,
      patientId: data.patient_id,
      treatmentName: data.treatment_name,
      startsAt: payload.starts_at,
      practitionerId: payload.practitioner_id,
      createdBy: me.userId,
    });

    return {
      id: created.id,
      confirmation,
      email: patient?.email ?? null,
      phone: patient?.phone ?? null,
      queued: queuedChannels,
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
    }) => parseInput(schemas.UpdateAppointmentState, data),
  )
  .handler(async ({ data }) => {
    requireCapability("appointments.edit");
    const row = appointments.find((a) => a.id === data.id);
    if (!row) return { ok: true, stage: null };
    if (data.status) row.status = data.status;
    if (data.payment_status) row.payment_status = data.payment_status;
    // Mirrors production: waiting and in-treatment both need consent; a manual
    // "waiting" is arrival plus the rule.
    if ((data.stage === "waiting" || data.stage === "in_treatment") && !consentReady(demoConsentStateOf(row))) {
      throw new Error("Consent is outstanding — complete it in clinic first");
    }
    if (data.stage) {
      row.stage = data.stage === "waiting" ? "arrived" : data.stage;
      row.status =
        data.stage === "no_show" ? "no_show" : data.stage === "booked" ? "booked" : "attended";
    }
    // A cancelled appointment must not remind anyone it is coming up.
    if (row.status === "cancelled") cancelPendingCommunications(data.id, "reminder");
    const reason = String(data.cancel_reason ?? "").trim().slice(0, 2000);
    if (data.status === "cancelled" && reason) {
      const prior = String(row.notes ?? "").trim();
      const stamp = `Cancelled: ${reason}`;
      row.notes = prior ? `${stamp}\n\n${prior}` : stamp;
    }
    row.updated_at = new Date().toISOString();
    if (data.stage === "arrived" || data.stage === "waiting") {
      const advanced = advanceToWaitingIfReadyDemo({ appointmentId: data.id });
      return { ok: true, stage: advanced.advanced ? "waiting" : "arrived" };
    }
    return { ok: true, stage: data.stage ?? null };
  });

export const getAppointmentConsent = createServerFn({ method: "GET" })
  .validator((data: { appointment_id: string }) => parseInput(schemas.GetAppointmentConsent, data))
  .handler(async ({ data }) => {
    requireStaff();
    const appt = appointments.find((a) => a.id === data.appointment_id);
    if (!appt) throw new Error("Appointment not found");
    const doc = appt.consent_document_id ? documents.find((d) => d.id === appt.consent_document_id) : null;
    const patient = patientById(appt.patient_id);
    return {
      appointmentId: appt.id,
      stage: appt.stage,
      patientName: `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim(),
      treatment: appt.treatment_name,
      consentState: demoConsentStateOf(appt),
      document: {
        id: doc?.id ?? null,
        title: doc?.title ?? `${appt.treatment_name} — consent form`,
        body: doc?.body ?? CONSENT_BODY_DEFAULT,
        status: doc?.status ?? null,
        signedAt: doc?.signed_at ?? null,
        signedName: doc?.signed_name ?? null,
        signatureData:
          typeof doc?.signature_data === "string" && String(doc.signature_data).startsWith("data:image/")
            ? doc.signature_data
            : null,
      },
    };
  });

export const completeConsentInClinic = createServerFn({ method: "POST" })
  .validator((data: {
    appointment_id: string;
    signed_name: string;
    signature_data?: string;
    contraindications?: Record<string, "yes" | "no" | "na">;
  }) => parseInput(schemas.CompleteConsentInClinic, data))
  .handler(async ({ data }) => {
    requireCapability("documents.send");
    const me = requireStaff();
    const name = data.signed_name.trim().slice(0, 240);
    const signature =
      typeof data.signature_data === "string" && data.signature_data.startsWith("data:image/")
        ? data.signature_data
        : name;
    const appt = appointments.find((a) => a.id === data.appointment_id);
    if (!appt) throw new Error("Appointment not found");
    const now = new Date().toISOString();
    let doc = appt.consent_document_id ? documents.find((d) => d.id === appt.consent_document_id) : null;
    if (!doc) {
      doc = {
        id: newId("f9"),
        clinic_id: CLINIC_ID,
        patient_id: appt.patient_id,
        treatment_id: null,
        kind: "consent",
        title: `${appt.treatment_name} — consent form`,
        body: CONSENT_BODY_DEFAULT,
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
        witnessed_by: null,
        expires_at: null,
        created_by: me.userId,
        created_at: now,
        updated_at: now,
      };
      documents.unshift(doc);
      appt.consent_document_id = doc.id;
    }
    if (doc.status !== "signed") {
      doc.status = "signed";
      doc.signed_at = now;
      doc.signed_name = name;
      doc.signature_data = signature;
      doc.viewed_at = doc.viewed_at ?? now;
      doc.witnessed_by = me.userId;
      doc.responses = data.contraindications ? { contraindications: data.contraindications } : doc.responses;
      doc.updated_at = now;
    }
    const advanced = advanceToWaitingIfReadyDemo({ appointmentId: appt.id });
    return { ok: true, documentId: doc.id, stage: advanced.advanced ? "waiting" : appt.stage };
  });

export const rescheduleAppointment = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      starts_at: string;
      duration_minutes?: number;
      practitioner_id?: string;
    }) => parseInput(schemas.RescheduleAppointment, data),
  )
  .handler(async ({ data }) => {
    requireCapability("appointments.edit");
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
    notifyBookingChange({
      appointmentId: data.id,
      patientId: row.patient_id,
      treatmentName: row.treatment_name ?? "your treatment",
      treatmentNumber: row.treatment_number ?? null,
      startsAt,
      practitionerId: practitionerId ?? null,
      createdBy: identity().userId,
    });
    // Reminders for the old time are stale; requeue for the new one.
    cancelPendingCommunications(data.id, "reminder");
    queueAppointmentReminders({
      appointmentId: data.id,
      patientId: row.patient_id,
      treatmentName: row.treatment_name ?? "your treatment",
      startsAt,
      practitionerId: practitionerId ?? null,
      createdBy: identity().userId,
    });
    return { ok: true };
  });

export const getAppointmentNote = createServerFn({ method: "GET" })
  .validator((data: { appointment_id: string }) =>
    parseInput(schemas.GetAppointmentNote, { appointment_id: String(data.appointment_id) }),
  )
  .handler(async ({ data }) => {
    const appointment = appointments.find((a) => a.id === data.appointment_id);
    const bookingNotes = String(appointment?.notes ?? "");
    const withoutCancel = bookingNotes.replace(/^Cancelled:[^\n]*(?:\n\n)?/, "").trim();
    return {
      body: plainVisitNote(withoutCancel),
      updatedAt: null,
      updatedBy: null,
    };
  });

export const saveAppointmentNote = createServerFn({ method: "POST" })
  .validator((data: { appointment_id: string; body: string }) =>
    parseInput(schemas.SaveAppointmentNote, {
      appointment_id: String(data.appointment_id),
      body: plainVisitNote(sanitizeNoteHtml(String(data?.body ?? ""))).slice(0, 20000),
    }),
  )
  .handler(async ({ data }) => {
    requireCapability("treatments.record");
    return demoWriteBookingNote(data.appointment_id, data.body);
  });

/** Booking notes stay on the appointment. The diary card reads only these. */
function demoWriteBookingNote(appointmentId: string, body: string) {
  const appointment = appointments.find((a) => a.id === appointmentId);
  if (!appointment) throw new Error("Appointment not found");
  const prior = String(appointment.notes ?? "");
  const cancelLine = prior.match(/^Cancelled:[^\n]*/)?.[0] ?? null;
  appointment.notes = cancelLine ? (body.trim() ? `${cancelLine}\n\n${body}` : cancelLine) : body || null;
  appointment.updated_at = new Date().toISOString();
  return { body, updatedAt: appointment.updated_at, updatedBy: null };
}

/** Demo twin of writeVisitNote: the treatment-form note, kept off the diary card. */
function demoWriteVisitNote(appointmentId: string, body: string) {
  const me = identity();
  const appointment = appointments.find((a) => a.id === appointmentId);
  const now = new Date().toISOString();
  let row = appointmentNotes.find((n) => n.appointment_id === appointmentId);
  if (!row) {
    row = {
      id: newId("r1"),
      appointment_id: appointmentId,
      clinic_id: appointment?.clinic_id ?? CLINIC_ID,
      patient_id: appointment?.patient_id ?? null,
      created_at: now,
    };
    appointmentNotes.push(row);
  }
  row.body = body;
  row.updated_by = me.userId;
  row.updated_by_label = me.profile?.full_name ?? null;
  row.updated_at = now;

  return { body: row.body, updatedAt: row.updated_at, updatedBy: row.updated_by_label };
}

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
    }) => parseInput(schemas.AddTreatment, data),
  )
  .handler(async ({ data }) => {
    requireCapability("treatments.record");
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
      appointment_id?: string;
      storage_path: string;
      kind: "before" | "after";
      caption?: string;
      marketing_consent?: boolean;
    }) => parseInput(schemas.AddPhoto, data),
  )
  .handler(async ({ data }) => {
    requireCapability("photos.manage");
    photos.push({
      id: newId("g9"),
      clinic_id: CLINIC_ID,
      patient_id: data.patient_id,
      treatment_id: data.treatment_id || null,
      appointment_id: data.appointment_id || null,
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

export const deletePhoto = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => parseInput(schemas.DeletePhoto, data))
  .handler(async ({ data }) => {
    requireCapability("photos.manage");
    requireStaff();
    const index = photos.findIndex((p) => p.id === data.id);
    if (index >= 0) photos.splice(index, 1);
    return { ok: true };
  });

/** Signing links stop working after this long; a resend issues a fresh window. */
const DOCUMENT_LINK_TTL_DAYS = 14;

function documentLinkExpiry(from = new Date()) {
  return new Date(from.getTime() + DOCUMENT_LINK_TTL_DAYS * 86400000).toISOString();
}

/**
 * Fixture twin of enqueueCommunication's core: PECR check, then a queued row.
 * Throws with the same reasons as production when the send is refused.
 */
function queueCommunication(input: {
  patientId: string;
  channel: "email" | "sms";
  purpose: "transactional" | "reminder" | "marketing";
  body: string;
  subject?: string | null;
  templateKey?: string | null;
  toAddress?: string | null;
  scheduledFor?: string | null;
  relatedEntity?: string | null;
  relatedId?: string | null;
  createdBy?: string | null;
  bodyHtml?: string | null;
}): { id: string } {
  const patient = patientById(input.patientId);
  if (!patient) throw new Error("Patient not found");
  const toAddress =
    input.toAddress?.trim() ||
    (input.channel === "email"
      ? String(patient.email ?? "").trim()
      : String(patient.phone ?? "").trim());
  const decision = assertCanSend(prefsFromPatient(patient), input.purpose, input.channel, toAddress);
  if (!decision.ok) throw new Error(decision.reason);
  const row = {
    id: newId("m9"),
    clinic_id: CLINIC_ID,
    patient_id: input.patientId,
    channel: input.channel,
    purpose: input.purpose,
    to_address: toAddress,
    template_key: input.templateKey ?? null,
    subject: input.subject?.trim() || null,
    body: input.body,
    body_html: input.bodyHtml ?? null,
    status: "queued",
    provider: null,
    provider_message_id: null,
    error: null,
    attempts: 0,
    scheduled_for: input.scheduledFor || new Date().toISOString(),
    sent_at: null,
    created_by: input.createdBy ?? null,
    related_entity: input.relatedEntity ?? null,
    related_id: input.relatedId ?? null,
    created_at: new Date().toISOString(),
  };
  communications.unshift(row);
  return { id: row.id };
}

/** One formatting of an appointment time for everything patient-facing. */
function formatWhenLondon(start: Date) {
  return start.toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

/** Demo twin of enqueueOnChannels: per-channel queue, refusals never throw. */
function queueOnChannels(opts: {
  patientId: string;
  purpose: "transactional" | "reminder" | "marketing";
  subject: string | null;
  body: string;
  templateKey: string;
  relatedEntity?: string | null;
  relatedId?: string | null;
  scheduledFor?: string | null;
  createdBy: string;
}): ("email" | "sms")[] {
  const patient = patientById(opts.patientId);
  const queued: ("email" | "sms")[] = [];
  for (const channel of channelsFor(patient ?? {}, opts.purpose)) {
    try {
      queueCommunication({
        patientId: opts.patientId,
        channel,
        purpose: opts.purpose,
        subject: channel === "email" ? opts.subject : null,
        body: opts.body,
        templateKey: opts.templateKey,
        scheduledFor: opts.scheduledFor ?? null,
        relatedEntity: opts.relatedEntity ?? null,
        relatedId: opts.relatedId ?? null,
        createdBy: opts.createdBy,
      });
      queued.push(channel);
    } catch {
      // PECR refusal on one channel must not stop the other.
    }
  }
  return queued;
}

/** Demo twin of notifyBookingChange: portal message plus a real queued send. */
function notifyBookingChange(opts: {
  appointmentId: string;
  patientId: string;
  treatmentName: string;
  treatmentNumber?: number | string | null;
  startsAt: string;
  practitionerId?: string | null;
  createdBy: string;
}): ("email" | "sms")[] {
  const patient = patientById(opts.patientId);
  const body = bookingUpdatedMessage({
    name: `${patient?.first_name ?? ""}`.trim() || "there",
    treatment: opts.treatmentName,
    treatmentNumber: opts.treatmentNumber ?? null,
    when: formatWhenLondon(new Date(opts.startsAt)),
    practitioner: opts.practitionerId ? profileName(opts.practitionerId) : null,
  });
  messages.push({
    id: newId("h9"),
    clinic_id: CLINIC_ID,
    patient_id: opts.patientId,
    author: "staff",
    author_id: opts.createdBy,
    body,
    attachments: [],
    read_at: null,
    created_at: new Date().toISOString(),
  });
  return queueOnChannels({
    patientId: opts.patientId,
    purpose: "transactional",
    subject: "Your appointment has been rescheduled",
    body,
    templateKey: "booking_update",
    relatedEntity: "appointments",
    relatedId: opts.appointmentId,
    createdBy: opts.createdBy,
  });
}

/** Demo twin: cancel queued (never-sent) rows tied to an entity. */
function cancelPendingCommunications(relatedId: string, purpose?: "reminder") {
  for (const row of communications) {
    if (
      row.related_id === relatedId &&
      row.status === "queued" &&
      (!purpose || row.purpose === purpose)
    ) {
      row.status = "cancelled";
    }
  }
}

/** Demo twin of queueAppointmentReminders. */
function queueAppointmentReminders(opts: {
  appointmentId: string;
  patientId: string;
  treatmentName: string;
  startsAt: string;
  practitionerId?: string | null;
  createdBy: string;
}) {
  const offsets = (db.clinic["reminder_offsets"] as number[] | undefined) ?? [168, 24];
  const patient = patientById(opts.patientId);
  const body = appointmentReminderMessage({
    name: `${patient?.first_name ?? ""}`.trim() || "there",
    treatment: opts.treatmentName,
    when: formatWhenLondon(new Date(opts.startsAt)),
    practitioner: opts.practitionerId ? profileName(opts.practitionerId) : null,
  });
  for (const scheduledFor of reminderTimes(opts.startsAt, offsets)) {
    queueOnChannels({
      patientId: opts.patientId,
      purpose: "reminder",
      subject: "Appointment reminder",
      body,
      templateKey: "appointment_reminder",
      scheduledFor,
      relatedEntity: "appointments",
      relatedId: opts.appointmentId,
      createdBy: opts.createdBy,
    });
  }
}

/** Demo twin of the production helper: send the signing link, report success. */
function enqueueDocumentEmail(opts: {
  patientId: string;
  documentId: string;
  accessToken: string;
  title: string;
  origin?: string | null | undefined;
  reminder?: boolean;
  channel?: "email" | "sms" | undefined;
  createdBy: string;
}): boolean {
  const channel = opts.channel ?? "email";
  try {
    const patient = patientById(opts.patientId);
    const message = consentRequestMessage({
      name: String(patient?.first_name ?? "there"),
      title: opts.title,
      url: publicSigningUrl(opts.origin ?? "", opts.accessToken),
      reminder: opts.reminder ?? false,
    });
    queueCommunication({
      patientId: opts.patientId,
      channel,
      purpose: "transactional",
      subject: channel === "email" ? message.subject : null,
      body: message.body,
      templateKey: "consent_request",
      relatedEntity: "documents",
      relatedId: opts.documentId,
      createdBy: opts.createdBy,
    });
    return true;
  } catch {
    return false;
  }
}

export const sendDocument = createServerFn({ method: "POST" })
  .validator(
    (data: {
      patient_id: string;
      kind: "consent" | "treatment_plan" | "consultation" | "aftercare" | "other";
      title: string;
      body?: string;
      treatment_id?: string;
      app_origin?: string;
    }) => parseInput(schemas.SendDocument, data),
  )
  .handler(async ({ data }) => {
    requireCapability("documents.send");
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
      expires_at: documentLinkExpiry(),
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
    const emailed = enqueueDocumentEmail({
      patientId: data.patient_id,
      documentId: created.id,
      accessToken: created.access_token,
      title: data.title,
      origin: data.app_origin,
      createdBy: me.userId,
    });
    return { id: created.id, emailed };
  });

export const resendDocument = createServerFn({ method: "POST" })
  .validator(
    (data: { id: string; patient_id: string; app_origin?: string; channel?: "email" | "sms" }) =>
      parseInput(schemas.ResendDocument, data),
  )
  .handler(async ({ data }) => {
    requireCapability("documents.send");
    const me = identity();
    const row = documents.find((d) => d.id === data.id);
    if (!row) throw new Error("Document not found");
    if (row.status === "signed") throw new Error("This form has already been signed");
    row.status = "sent";
    row.sent_at = new Date().toISOString();
    row.expires_at = documentLinkExpiry();
    messages.push({
      id: newId("h9"),
      clinic_id: CLINIC_ID,
      patient_id: data.patient_id,
      author: "staff",
      author_id: me.userId,
      body: `Reminder: ${row.title} is waiting for your signature in your patient portal.`,
      attachments: [],
      read_at: null,
      created_at: new Date().toISOString(),
    });
    const emailed = enqueueDocumentEmail({
      patientId: data.patient_id,
      documentId: row.id,
      accessToken: row.access_token,
      title: row.title,
      origin: data.app_origin,
      reminder: true,
      channel: data.channel,
      createdBy: me.userId,
    });
    return { ok: true, emailed };
  });

export const signDocument = createServerFn({ method: "POST" })
  .validator((data: { id: string; signed_name: string; contraindications?: Record<string, "yes" | "no" | "na"> }) =>
    parseInput(schemas.SignDocument, data),
  )
  .handler(async ({ data }) => {
    const name = data.signed_name.trim().slice(0, 120);
    if (!name) throw new Error("Please type your full name to sign");
    const row = documents.find((d) => d.id === data.id);
    if (row) {
      row.status = "signed";
      row.signed_at = new Date().toISOString();
      row.signed_name = name;
      row.signature_data = name;
      if (data.contraindications) row.responses = { contraindications: data.contraindications };
      // Mirrors production: signing moves an arrived patient on to waiting.
      advanceToWaitingIfReadyDemo({ consentDocumentId: row.id });
    }
    return { ok: true };
  });

/* ---------------------------------------------------------------- */
/* messaging                                                          */
/* ---------------------------------------------------------------- */

export const sendPaymentRequest = createServerFn({ method: "POST" })
  .validator(
    (data: {
      patient_id: string;
      appointment_id: string;
      channel: "email" | "sms";
      kind: "deposit" | "full" | "balance" | "receipt";
      app_origin?: string;
    }) => parseInput(schemas.SendPaymentRequest, data),
  )
  .handler(async ({ data }) => {
    const me = requireStaff();
    if (!can(me, "comms.send")) throw new Error("You do not have access to this area");
    const appointment = appointments.find((a) => a.id === data.appointment_id);
    if (!appointment || appointment.patient_id !== data.patient_id) {
      throw new Error("Appointment not found for this patient");
    }
    const patient = patientById(data.patient_id);
    const name = `${patient?.first_name ?? ""}`.trim() || "there";
    const when = new Date(appointment.starts_at).toLocaleDateString("en-GB");
    const total = Number(appointment.price ?? 0);
    const depositAmount = Math.round(total * 0.3 * 100) / 100;
    const origin = data.app_origin?.trim() || "";

    let body: string;
    let subject: string;
    if (data.kind === "receipt") {
      body =
        `Hi ${name}, here is your receipt for ${appointment.treatment_name} on ${when}. ` +
        `Amount paid: ${formatMoney(total)}. A copy is also available in your patient ` +
        `portal: ${patientPaymentUrl(appointment.id, "full", origin)}`;
      subject = `Your receipt — ${appointment.treatment_name}`;
    } else {
      const amount =
        data.kind === "deposit"
          ? depositAmount
          : data.kind === "balance"
            ? Math.round((total - depositAmount) * 100) / 100
            : total;
      body = paymentRequestMessage({
        name,
        treatment: appointment.treatment_name,
        treatmentNumber: appointment.treatment_number ?? null,
        when,
        amount,
        kind: data.kind,
        appointmentId: appointment.id,
        origin,
      });
      subject = `Payment link — ${appointment.treatment_name}`;
    }

    const { id: communicationId } = queueCommunication({
      patientId: data.patient_id,
      channel: data.channel,
      purpose: "transactional",
      subject: data.channel === "email" ? subject : null,
      body,
      templateKey: data.kind === "receipt" ? "payment_receipt" : "payment_request",
      relatedEntity: "appointments",
      relatedId: data.appointment_id,
      createdBy: me.userId,
    });
    messages.push({
      id: newId("h9"),
      clinic_id: CLINIC_ID,
      patient_id: data.patient_id,
      author: "staff",
      author_id: me.userId,
      body,
      attachments: [],
      read_at: null,
      created_at: new Date().toISOString(),
    });
    return { ok: true, communication_id: communicationId };
  });

export const logCallAttempt = createServerFn({ method: "POST" })
  .validator(
    (data: { patient_id: string; phone?: string }) => parseInput(schemas.LogCallAttempt, data),
  )
  .handler(async ({ data }) => {
    const me = requireStaff();
    const patient = patientById(data.patient_id);
    const to = data.phone?.trim() || String(patient?.phone ?? "").trim();
    if (!to) throw new Error("This patient has no phone number on file");
    communications.unshift({
      id: newId("m9"),
      clinic_id: CLINIC_ID,
      patient_id: data.patient_id,
      channel: "call",
      purpose: "transactional",
      to_address: to,
      template_key: null,
      subject: null,
      body: "Call attempt from the clinic.",
      status: "sent",
      provider: "phone",
      provider_message_id: null,
      error: null,
      attempts: 1,
      scheduled_for: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      created_by: me.userId,
      related_entity: null,
      related_id: null,
      created_at: new Date().toISOString(),
    });
    return { ok: true };
  });

/* Browser voice calls: real telephony even in demo — calls ring the
   TWILIO_DEMO_NUMBERS pool, never the fixture patients' fake numbers. */

export const getVoiceCallConfig = createServerFn({ method: "GET" }).handler(async () => ({
  available: voiceAvailable(),
}));

export const getVoiceCallToken = createServerFn({ method: "POST" }).handler(async () => {
  const me = identity();
  if (!voiceAvailable()) throw new Error("Voice calling is not configured");
  return { token: mintVoiceToken(me.userId), identity: me.userId };
});

export const getVoiceCallTarget = createServerFn({ method: "GET" })
  .validator((data: { patient_id: string }) => parseInput(schemas.GetVoiceCallTarget, data))
  .handler(async ({ data }) => {
    const target = voiceTargetFor(data.patient_id);
    if (!target) throw new Error("Voice calling is not configured");
    return target;
  });

export const sendMessage = createServerFn({ method: "POST" })
  .validator(
    (data: {
      patient_id: string;
      body: string;
      as: "staff" | "patient";
      attachments?: { path: string; name: string; type: string; size: number }[];
    }) => parseInput(schemas.SendMessage, data),
  )
  .handler(async ({ data }) => {
    const me = identity();
    if (me.isStaff) requireCapability("comms.send");
    else if (me.patient?.id !== data.patient_id) throw new Error("Not your record");
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
    // Demo magic: the patient texts back (Cohere persona, canned fallback).
    if (data.as === "staff") schedulePatientReply(data.patient_id);
    // Mirrors production: the patient's own clinician is told about the message.
    if (data.as === "patient") {
      const practitionerId = demoPractitionerForPatient(data.patient_id);
      const patient = patientById(data.patient_id);
      if (practitionerId) {
        staffNotifications.unshift({
          id: newId("l9"),
          clinic_id: CLINIC_ID,
          recipient_id: practitionerId,
          sender_id: null,
          urgent: false,
          kind: "patient_message",
          title: `Message from ${`${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim() || "A patient"}`,
          body: (body || "Sent an attachment").slice(0, 160),
          patient_id: data.patient_id,
          appointment_id: null,
          read_at: null,
          created_at: new Date().toISOString(),
        });
      }
    }
    return { ok: true };
  });

/** Active plan's practitioner, else the next booking's, else the last treatment's. */
function demoPractitionerForPatient(patientId: string): string | null {
  const plan = sortDesc(
    treatmentPlans.filter((p) => p.patient_id === patientId && p.status === "active" && p.practitioner_id),
    "started_at",
  )[0];
  if (plan?.practitioner_id) return plan.practitioner_id;
  const next = demoUpcomingAppointments(patientId, 1)[0];
  if (next?.practitioner_id) return next.practitioner_id;
  const last = sortDesc(treatments.filter((t) => t.patient_id === patientId && t.practitioner_id), "performed_at")[0];
  return last?.practitioner_id ?? null;
}

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

export const listPatientThreads = createServerFn({ method: "GET" }).handler(async () => {
  const threads = new Map<
    string,
    { patientId: string; name: string; avatarUrl: string | null; last: string; lastAt: string; lastAuthor: string; unread: number }
  >();
  for (const row of sortDesc([...messages], "created_at")) {
    let thread = threads.get(row.patient_id);
    if (!thread) {
      const patient = patientById(row.patient_id);
      thread = {
        patientId: row.patient_id,
        name: `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim() || "Patient",
        avatarUrl: patient?.avatar_url ?? null,
        last: row.body,
        lastAt: row.created_at,
        lastAuthor: row.author,
        unread: 0,
      };
      threads.set(row.patient_id, thread);
    }
    if (row.author === "patient" && !row.read_at) thread.unread += 1;
  }
  return [...threads.values()].slice(0, 15);
});

export const getPatientMessages = createServerFn({ method: "GET" })
  .validator((data: { patient_id: string }) => parseInput(schemas.GetPatientMessages, data))
  .handler(async ({ data }) => ({
    messages: sortAsc(
      messages.filter((m) => m.patient_id === data.patient_id),
      "created_at",
    ),
    // True while the AI patient is composing — the chat shows a typing bubble.
    typing: isPatientReplyPending(data.patient_id),
  }));

export const markMessagesRead = createServerFn({ method: "POST" })
  .validator((data: { patient_id: string }) => parseInput(schemas.MarkMessagesRead, data))
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
  .validator((data: { id?: string; title: string; body: string; category?: string }) => parseInput(schemas.SaveMessageTemplate, data))
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
  .validator((data: { id: string }) => parseInput(schemas.DeleteMessageTemplate, data))
  .handler(async ({ data }) => {
    const me = identity();
    if (!me.canDelete) throw new Error("Only managers can delete templates");
    const index = messageTemplates.findIndex((t) => t.id === data.id);
    if (index >= 0) messageTemplates.splice(index, 1);
    return { ok: true };
  });

export const enqueueCommunication = createServerFn({ method: "POST" })
  .validator(
    (data: {
      patient_id: string;
      channel: "email" | "sms";
      purpose: "transactional" | "reminder" | "marketing";
      body: string;
      subject?: string;
      template_key?: string;
      to_address?: string;
      scheduled_for?: string;
      related_entity?: string;
      related_id?: string;
    }) => parseInput(schemas.EnqueueCommunication, data),
  )
  .handler(async ({ data }) => {
    const me = requireStaff();
    if (!can(me, "comms.send")) throw new Error("You do not have access to this area");
    return queueCommunication({
      patientId: data.patient_id,
      channel: data.channel,
      purpose: data.purpose,
      body: data.body,
      subject: data.subject ?? null,
      templateKey: data.template_key ?? null,
      toAddress: data.to_address ?? null,
      scheduledFor: data.scheduled_for ?? null,
      relatedEntity: data.related_entity ?? null,
      relatedId: data.related_id ?? null,
      createdBy: me.userId,
    });
  });

export const listCommunications = createServerFn({ method: "GET" })
  .validator((data: { patient_id: string }) => parseInput(schemas.ListCommunications, data))
  .handler(async ({ data }) => {
    const me = identity();
    if (me.isStaff) {
      if (!can(me, "comms.send")) throw new Error("You do not have access to this area");
    } else if (me.patient?.id !== data.patient_id) {
      throw new Error("You can only view your own messages");
    }
    return sortDesc(
      communications.filter((row) => row.patient_id === data.patient_id),
      "created_at",
    ).slice(0, 50);
  });

export const saveCommsPreferences = createServerFn({ method: "POST" })
  .validator(
    (data: {
      patient_id: string;
      email_opt_in: boolean;
      sms_opt_in: boolean;
      reminders_opt_in: boolean;
      marketing_opt_in: boolean;
    }) => parseInput(schemas.SaveCommsPreferences, data),
  )
  .handler(async ({ data }) => {
    const me = identity();
    if (me.isStaff) {
      if (!patientById(data.patient_id)) throw new Error("Patient not found");
    } else if (me.patient?.id !== data.patient_id) {
      throw new Error("You can only update your own preferences");
    }
    const row = patientById(data.patient_id);
    if (!row) throw new Error("Patient not found");
    const unsubscribed_at = nextUnsubscribedAt({
      marketing_opt_in: data.marketing_opt_in,
      reminders_opt_in: data.reminders_opt_in,
      unsubscribed_at: row.unsubscribed_at ?? null,
    });
    Object.assign(row, {
      email_opt_in: data.email_opt_in,
      sms_opt_in: data.sms_opt_in,
      reminders_opt_in: data.reminders_opt_in,
      marketing_opt_in: data.marketing_opt_in,
      unsubscribed_at,
      updated_at: new Date().toISOString(),
    });
    return { ok: true as const };
  });

export const drainCommunications = createServerFn({ method: "POST" }).handler(async () => {
  const me = requireStaff();
  if (!can(me, "comms.send")) throw new Error("You do not have access to this area");
  const { drainInMemory } = await import("./comms/dispatch.server");
  const { clinic } = await import("@/lib/demo/data");
  await runDemoOfferAutomation();
  return drainInMemory(
    communications,
    new Map([[CLINIC_ID, { name: clinic["name"] ?? null, email: clinic["email"] ?? null }]]),
  );
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
  .validator((data: { id?: string; all?: boolean }) => parseInput(schemas.MarkStaffNotificationRead, data))
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
  .validator((data: { id: string }) => parseInput(schemas.DismissStaffInboxItem, data))
  .handler(async ({ data }) => {
    requireCapability("notifications.delete");
    dismissDemoInboxIds([data.id]);
    return { ok: true };
  });

/** Hide several inbox rows for the signed-in user (e.g. whole peer stack). */
export const dismissStaffInboxItems = createServerFn({ method: "POST" })
  .validator((data: { ids: string[] }) => parseInput(schemas.DismissStaffInboxItems, data))
  .handler(async ({ data }) => {
    requireCapability("notifications.delete");
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
  const staff = userRoles.filter((r) => r.role !== "patient" && r.role !== "admin");
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
    }) => parseInput(schemas.SendStaffAlert, data),
  )
  .handler(async ({ data }) => {
    requireCapability("comms.send");
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
  .validator((data: { practitionerId: string; date: string }) => parseInput(schemas.GetPractitionerDay, data))
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
  .validator((data: { id: string; patient_id: string }) => parseInput(schemas.ReviewHistory, data))
  .handler(async ({ data }) => {
    requireCapability("treatments.record");
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
  const { portalProductsFor } = await import("./insights.server");
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
    products: portalProductsFor({
      patientId: patient.id,
      products: retailProducts,
      sales: productSales,
    }),
  };
});

/* ------------------------------------------------- patient portal (demo twins)

   Same shapes as production; the row source is the in-memory fixture set. */

function demoPortalPatient() {
  const me = identity();
  return patients.find((p) => p.user_id === me.userId) ?? null;
}

function demoRequirePortalPatient() {
  const patient = demoPortalPatient();
  if (!patient) throw new Error("No patient record is linked to your account");
  return patient;
}

function demoPortalPlan(patientId: string) {
  const mine = treatmentPlans.filter((p) => p.patient_id === patientId);
  return mine.find((p) => p.status === "active" || p.status === "paused") ?? mine[0] ?? null;
}

function demoClinician(profileId: string | null) {
  if (!profileId) return null;
  const profile = profiles.find((p) => p.id === profileId);
  if (!profile) return null;
  return {
    name: profile.full_name ?? "Your clinician",
    initials: String(profile.full_name ?? "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w: string) => w[0]?.toUpperCase() ?? "")
      .join(""),
    title: profile.job_title ?? "Clinician",
    avatarUrl: profile.avatar_url ?? null,
  };
}

function demoAppointmentView(a: any) {
  const starts = new Date(a.starts_at);
  return {
    id: a.id,
    treatment: a.treatment_name,
    startsAt: a.starts_at,
    endsAt: a.ends_at ?? null,
    weekday: starts.toLocaleDateString("en-GB", { weekday: "short" }),
    day: String(starts.getDate()),
    monthYear: starts.toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
    date: starts.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    time: starts.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    status: a.status,
    stage: a.stage ?? null,
    confirmedAt: a.patient_confirmed_at ?? null,
  };
}

function demoUpcomingAppointments(patientId: string, limit: number) {
  const now = Date.now();
  return appointments
    .filter((a) => a.patient_id === patientId && a.status !== "cancelled" && new Date(a.starts_at).getTime() >= now)
    .sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)))
    .slice(0, limit);
}

export const getPortalHome = createServerFn({ method: "GET" }).handler(async () => {
  const patient = demoPortalPatient();
  if (!patient) return null;
  const plan = demoPortalPlan(patient.id);
  const milestones = plan ? planMilestones.filter((m) => m.plan_id === plan.id) : [];
  const progress = portal.planProgress(milestones as any);
  const upcoming = demoUpcomingAppointments(patient.id, 1)[0];
  const last = sortDesc(messages.filter((m) => m.patient_id === patient.id), "created_at")[0];
  const live = clinicOffers.filter((o) => !o.expires_at || new Date(o.expires_at) > new Date());
  const myOffers = sortDesc(
    patientOffers.filter((o) => o.patient_id === patient.id && o.status !== "cancelled"),
    "sent_at",
  )
    .map((o) => patientOfferView(o))
    .filter((o) => o.live || o.status === "claimed")
    .sort((a, b) => Number(b.live) - Number(a.live));

  return {
    patient: { id: patient.id, firstName: patient.first_name, name: `${patient.first_name} ${patient.last_name}`.trim() },
    patientOffers: myOffers,
    clinician: demoClinician(plan?.practitioner_id ?? null),
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          strapline: plan.strapline ?? null,
          completion: progress.pct,
          milestonesDone: progress.done,
          milestonesTotal: progress.total,
        }
      : null,
    progressSteps: portal.progressTrack(milestones as any),
    nextAppointment: upcoming ? demoAppointmentView(upcoming) : null,
    news: sortDesc(clinicNews.filter((n) => n.published_at), "published_at")[0] ?? null,
    offer: sortDesc(live, "published_at")[0] ?? null,
    latestMessage: last
      ? {
          body: last.body,
          createdAt: last.created_at,
          author: last.author,
          from: last.author === "staff" ? profileName(last.author_id) : null,
          fromClinic: last.author === "staff",
          read: last.author !== "staff" || Boolean(last.read_at),
        }
      : null,
  };
});

export const getPortalPlan = createServerFn({ method: "GET" }).handler(async () => {
  requireCapability("view.portal.plan");
  const patient = demoPortalPatient();
  if (!patient) return null;
  const plan = demoPortalPlan(patient.id);
  const milestones = plan ? planMilestones.filter((m) => m.plan_id === plan.id) : [];
  const ids = new Set(milestones.map((m) => m.id));
  const checklist = planMilestoneChecklist.filter((c) => ids.has(c.milestone_id));
  const current = portal.currentMilestone(milestones as any);
  const latest = sortDesc(recoveryCheckins.filter((c) => c.patient_id === patient.id), "checkin_date")[0];
  const visible = photos
    .filter((p: any) => p.patient_id === patient.id && p.visible_to_patient)
    .map((p: any) => ({ ...p, url: p.storage_path }));
  const upcoming = demoUpcomingAppointments(patient.id, 1)[0];
  const progress = portal.planProgress(milestones as any);

  return {
    plan: plan
      ? {
          id: plan.id,
          name: plan.name,
          strapline: plan.strapline ?? null,
          phase: plan.phase,
          status: plan.status,
          completion: progress.pct,
          milestonesDone: progress.done,
          milestonesTotal: progress.total,
          totalSessions: plan.total_sessions,
          ...(portal.planDay(plan.started_at, plan.duration_days) ?? {}),
        }
      : null,
    clinician: demoClinician(plan?.practitioner_id ?? null),
    nextAppointment: upcoming ? demoAppointmentView(upcoming) : null,
    todayAction: current
      ? {
          id: current.id,
          title: current.title,
          detail: current.detail ?? "",
          dueDate: current.due_date ?? null,
          icon: current.icon ?? "doc",
        }
      : null,
    checkIn: latest
      ? {
          date: latest.checkin_date,
          rows: [
            { label: "Redness", value: latest.redness, reading: portal.severityLabel(latest.redness) },
            { label: "Sensitivity", value: latest.sensitivity, reading: portal.severityLabel(latest.sensitivity) },
            { label: "Dryness", value: latest.dryness, reading: portal.severityLabel(latest.dryness) },
          ],
          needsAttention: portal.checkinNeedsAttention(latest),
          note: latest.note ?? null,
        }
      : null,
    beforeAfter: {
      before: visible.find((p: any) => p.kind === "before") ?? null,
      after: [...visible].reverse().find((p: any) => p.kind === "after") ?? null,
    },
    improvements: visible.filter((p: any) => p.kind === "after" && p.caption).map((p: any) => p.caption as string).slice(0, 4),
    journeySnapshot: portal.roadmapFor(milestones as any, checklist as any).map((g) => ({
      month: g.month,
      title: g.title,
      steps: g.steps.map((st: any) => ({ label: st.title, done: st.status === "done" || st.status === "skipped" })),
    })),
    safeToProceed: checklist
      .filter((c) => c.milestone_id === current?.id)
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((c) => ({ id: c.id, label: c.label, done: c.done, byClinic: c.clinic_owned })),
  };
});

export const getPortalTimeline = createServerFn({ method: "GET" }).handler(async () => {
  requireCapability("view.portal.plan.timeline");
  const patient = demoPortalPatient();
  if (!patient) return null;
  const plan = demoPortalPlan(patient.id);
  if (!plan) return { plan: null, roadmap: [], pendingPause: null };
  const milestones = planMilestones.filter((m) => m.plan_id === plan.id);
  const ids = new Set(milestones.map((m) => m.id));
  const checklist = planMilestoneChecklist.filter((c) => ids.has(c.milestone_id));
  const progress = portal.planProgress(milestones as any);

  // Mirrors production: the step card reads the linked appointment (and its
  // consent), the treatment note and the visible photos from the record.
  const apptIds = new Set(milestones.map((m) => m.appointment_id).filter(Boolean));
  const extras = portal.stepExtrasFor({
    milestones: milestones as any,
    appointments: appointments
      .filter((a) => apptIds.has(a.id))
      .map((a) => ({
        id: a.id,
        starts_at: a.starts_at,
        treatment_name: a.treatment_name,
        consentSigned: a.consent_document_id
          ? (documents.find((d) => d.id === a.consent_document_id)?.status ?? null) === "signed"
          : null,
      })),
    treatments: treatments
      .filter((t) => t.patient_id === patient.id)
      .map((t) => {
        const session = treatmentSessions.find((x) => x.treatment_id === t.id && x.status === "complete");
        return { ...t, notes: session?.visit_notes ?? t.notes ?? null };
      }) as any,
    photos: photos
      .filter((p: any) => p.patient_id === patient.id && p.visible_to_patient)
      .map((p: any) => ({ ...p, url: p.storage_path })),
  });

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      strapline: plan.strapline ?? null,
      status: plan.status,
      milestonesDone: progress.done,
      milestonesTotal: progress.total,
      completion: progress.pct,
    },
    roadmap: portal.roadmapFor(milestones as any, checklist as any, extras),
    pendingPause:
      sortDesc(
        planPauseRequests.filter((r) => r.plan_id === plan.id && r.status === "pending"),
        "created_at",
      )[0] ?? null,
  };
});

export const getPortalJournal = createServerFn({ method: "GET" }).handler(async () => {
  requireCapability("view.portal.plan.journal");
  const patient = demoPortalPatient();
  if (!patient) return null;
  const entries = sortDesc(journalEntries.filter((e) => e.patient_id === patient.id), "entry_date");
  return {
    entries: entries.map((e) => ({
      id: e.id,
      date: e.entry_date,
      title: e.title,
      body: e.body,
      kind: e.kind,
      sharedWithClinic: e.shared_with_clinic,
      attachments: journalAttachments
        .filter((a) => a.entry_id === e.id)
        .map((a) => ({ ...a, url: a.storage_path })),
    })),
  };
});

export const getPortalRoutine = createServerFn({ method: "GET" }).handler(async () => {
  requireCapability("view.portal.plan.routine");
  const patient = demoPortalPatient();
  if (!patient) return null;
  const routine = skincareRoutines.find((r) => r.patient_id === patient.id) ?? null;
  const items = routine ? routineItems.filter((i) => i.routine_id === routine.id) : [];
  const completions = routineCompletions.filter((c) => c.patient_id === patient.id);
  const overrideFor = new Map(
    routineItemOverrides.filter((o) => o.patient_id === patient.id).map((o) => [o.routine_item_id, o]),
  );
  const withOverride = (i: any) => {
    const o = overrideFor.get(i.id);
    return {
      ...i,
      override: o
        ? { product_name: o.product_name, how_to: o.how_to ?? null, product_url: o.product_url ?? null, source: o.source }
        : null,
    };
  };
  const order = (list: any[]) => [...list].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map(withOverride);
  const today = new Date().toISOString().slice(0, 10);
  const reminder = portal.nextRoutineReminder();
  const doneToday = completions.some(
    (c) => c.completed_on === today && c.period === reminder.period && !c.snoozed_until,
  );
  const snoozed = completions.find(
    (c) => c.completed_on === today && c.period === reminder.period && c.snoozed_until,
  );

  return {
    routine: routine
      ? {
          id: routine.id,
          headline: routine.headline,
          body: routine.body,
          practitionerNote: routine.practitioner_note,
          noteDatedOn: routine.note_dated_on,
        }
      : null,
    clinician: demoClinician(routine?.practitioner_id ?? null),
    morning: order(items.filter((i) => i.period === "morning")),
    evening: order(items.filter((i) => i.period === "evening")),
    adherence: portal.adherenceFor(completions as any),
    reminder: { ...reminder, done: doneToday, snoozedUntil: snoozed?.snoozed_until ?? null },
  };
});

export const getPortalClinic = createServerFn({ method: "GET" }).handler(async () => {
  const patient = demoPortalPatient();
  if (!patient) return null;
  const plan = demoPortalPlan(patient.id);
  return {
    clinician: demoClinician(plan?.practitioner_id ?? null),
    clinic: db.clinic ?? null,
    upcoming: demoUpcomingAppointments(patient.id, 6).map(demoAppointmentView),
    completed: sortDesc(treatments.filter((t) => t.patient_id === patient.id), "performed_at")
      .slice(0, 6)
      .map((t) => ({ id: t.id, name: t.name, performedAt: t.performed_at })),
    external: sortDesc(externalTreatments.filter((e) => e.patient_id === patient.id), "performed_on"),
  };
});

export const getPortalRecords = createServerFn({ method: "GET" }).handler(async () => {
  const patient = demoPortalPatient();
  if (!patient) return null;
  const docs = sortDesc(documents.filter((d) => d.patient_id === patient.id), "created_at");
  return {
    patient,
    treatments: sortDesc(treatments.filter((t) => t.patient_id === patient.id), "performed_at").slice(0, 8),
    labs: docs.filter((d) => d.kind === "consultation" || d.kind === "other"),
    documents: docs.filter((d) => d.kind !== "consultation" && d.kind !== "other"),
    photoCount: photos.filter((p: any) => p.patient_id === patient.id && p.visible_to_patient).length,
    photos: sortDesc(
      photos.filter((p: any) => p.patient_id === patient.id && p.visible_to_patient),
      "taken_at",
    ).map((p: any) => ({
      id: p.id,
      kind: p.kind,
      caption: p.caption ?? null,
      takenAt: p.taken_at,
      treatment: p.treatment_id ? (treatments.find((t) => t.id === p.treatment_id)?.name ?? null) : null,
      url: p.storage_path,
    })),
    latestHistory:
      sortDesc(medicalHistory.filter((h: any) => h.patient_id === patient.id), "created_at")[0] ?? null,
  };
});

export const createJournalEntry = createServerFn({ method: "POST" })
  .validator(
    (data: { title: string; body?: string; kind?: string; entry_date?: string; shared_with_clinic?: boolean }) =>
      parseInput(schemas.CreateJournalEntry, data),
  )
  .handler(async ({ data }) => {
    const patient = demoRequirePortalPatient();
    const id = newId("e2");
    journalEntries.push({
      id,
      clinic_id: CLINIC_ID,
      patient_id: patient.id,
      kind: data.kind ?? "skincare",
      title: data.title.trim().slice(0, 140),
      body: data.body?.trim().slice(0, 4000) ?? null,
      entry_date: data.entry_date ?? new Date().toISOString().slice(0, 10),
      shared_with_clinic: data.shared_with_clinic ?? true,
      created_at: new Date().toISOString(),
    });
    return { ok: true, id };
  });

export const deleteJournalEntry = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => parseInput(schemas.DeleteJournalEntry, data))
  .handler(async ({ data }) => {
    const patient = demoRequirePortalPatient();
    const index = journalEntries.findIndex((e) => e.id === data.id && e.patient_id === patient.id);
    if (index >= 0) journalEntries.splice(index, 1);
    return { ok: true };
  });

export const submitRecoveryCheckin = createServerFn({ method: "POST" })
  .validator((data: { redness: number; sensitivity: number; dryness: number; note?: string }) =>
    parseInput(schemas.SubmitRecoveryCheckin, data),
  )
  .handler(async ({ data }) => {
    const patient = demoRequirePortalPatient();
    const today = new Date().toISOString().slice(0, 10);
    const existing = recoveryCheckins.find((c) => c.patient_id === patient.id && c.checkin_date === today);
    const row = {
      redness: data.redness,
      sensitivity: data.sensitivity,
      dryness: data.dryness,
      note: data.note?.trim().slice(0, 1000) ?? null,
    };
    if (existing) Object.assign(existing, row);
    else
      recoveryCheckins.push({
        id: newId("e4"),
        clinic_id: CLINIC_ID,
        patient_id: patient.id,
        checkin_date: today,
        ...row,
        created_at: new Date().toISOString(),
      });
    return { ok: true };
  });

export const requestPlanPause = createServerFn({ method: "POST" })
  .validator((data: { plan_id: string; reason: string; notes?: string }) =>
    parseInput(schemas.RequestPlanPause, data),
  )
  .handler(async ({ data }) => {
    const patient = demoRequirePortalPatient();
    const plan = treatmentPlans.find((p) => p.id === data.plan_id);
    if (!plan || plan.patient_id !== patient.id) throw new Error("Plan not found");
    const open = planPauseRequests.find((r) => r.plan_id === data.plan_id && r.status === "pending");
    if (open) return { ok: true, id: open.id, alreadyOpen: true };
    const id = newId("f2");
    planPauseRequests.push({
      id,
      clinic_id: CLINIC_ID,
      plan_id: data.plan_id,
      patient_id: patient.id,
      reason: data.reason,
      notes: data.notes?.trim().slice(0, 500) ?? null,
      status: "pending",
      decided_by: null,
      decided_at: null,
      decision_note: null,
      created_at: new Date().toISOString(),
    });
    return { ok: true, id, alreadyOpen: false };
  });

export const confirmAppointment = createServerFn({ method: "POST" })
  .validator((data: { appointment_id: string }) => parseInput(schemas.ConfirmAppointment, data))
  .handler(async ({ data }) => {
    const patient = demoRequirePortalPatient();
    const appt = appointments.find((a) => a.id === data.appointment_id);
    if (
      !appt ||
      appt.patient_id !== patient.id ||
      appt.status !== "booked" ||
      new Date(String(appt.starts_at)).getTime() <= Date.now()
    ) {
      throw new Error("Appointment not found or can no longer be confirmed");
    }
    appt.patient_confirmed_at ??= new Date().toISOString();
    return { ok: true, confirmedAt: appt.patient_confirmed_at as string };
  });

export const markRoutineComplete = createServerFn({ method: "POST" })
  .validator((data: { period: string }) => parseInput(schemas.MarkRoutineComplete, data))
  .handler(async ({ data }) => {
    const patient = demoRequirePortalPatient();
    const today = new Date().toISOString().slice(0, 10);
    const existing = routineCompletions.find(
      (c) => c.patient_id === patient.id && c.period === data.period && c.completed_on === today,
    );
    if (existing) existing.snoozed_until = null;
    else
      routineCompletions.push({
        id: newId("e5"),
        clinic_id: CLINIC_ID,
        patient_id: patient.id,
        period: data.period,
        completed_on: today,
        snoozed_until: null,
        created_at: new Date().toISOString(),
      });
    return { ok: true };
  });

export const snoozeRoutineReminder = createServerFn({ method: "POST" })
  .validator((data: { period: string; minutes?: number }) =>
    parseInput(schemas.SnoozeRoutineReminder, data),
  )
  .handler(async ({ data }) => {
    const patient = demoRequirePortalPatient();
    const today = new Date().toISOString().slice(0, 10);
    const until = new Date(Date.now() + (data.minutes ?? 60) * 60_000).toISOString();
    const existing = routineCompletions.find(
      (c) => c.patient_id === patient.id && c.period === data.period && c.completed_on === today,
    );
    if (existing) existing.snoozed_until = until;
    else
      routineCompletions.push({
        id: newId("e5"),
        clinic_id: CLINIC_ID,
        patient_id: patient.id,
        period: data.period,
        completed_on: today,
        snoozed_until: until,
        created_at: new Date().toISOString(),
      });
    return { ok: true, snoozedUntil: until };
  });

export const extractProductFromLink = createServerFn({ method: "POST" })
  .validator((data: { url: string }) => parseInput(schemas.ExtractProductFromLink, data))
  .handler(async ({ data }) => {
    demoRequirePortalPatient();
    const { extractProductFromUrl } = await import("./portal/product-link.server");
    return extractProductFromUrl(data.url);
  });

function demoRequireOwnRoutineItem(patientId: string, routineItemId: string) {
  const item = routineItems.find((i) => i.id === routineItemId);
  const routine = item ? skincareRoutines.find((r) => r.id === item.routine_id) : null;
  if (!item || routine?.patient_id !== patientId) throw new Error("Routine step not found");
  return item;
}

export const saveRoutineOverride = createServerFn({ method: "POST" })
  .validator(
    (data: {
      routine_item_id: string;
      product_name: string;
      how_to?: string;
      product_url?: string;
      source?: "link" | "ai" | "manual";
    }) => parseInput(schemas.SaveRoutineOverride, data),
  )
  .handler(async ({ data }) => {
    const patient = demoRequirePortalPatient();
    demoRequireOwnRoutineItem(patient.id, data.routine_item_id);
    const row = {
      product_name: data.product_name.trim(),
      how_to: data.how_to?.trim() || null,
      product_url: data.product_url?.trim() || null,
      source: data.source ?? "manual",
      updated_at: new Date().toISOString(),
    };
    const existing = routineItemOverrides.find((o) => o.routine_item_id === data.routine_item_id);
    if (existing) {
      Object.assign(existing, row);
      return { ok: true, id: existing.id };
    }
    const id = newId("e9");
    routineItemOverrides.push({
      id,
      clinic_id: CLINIC_ID,
      patient_id: patient.id,
      routine_item_id: data.routine_item_id,
      ...row,
      created_at: new Date().toISOString(),
    });
    return { ok: true, id };
  });

export const clearRoutineOverride = createServerFn({ method: "POST" })
  .validator((data: { routine_item_id: string }) => parseInput(schemas.ClearRoutineOverride, data))
  .handler(async ({ data }) => {
    const patient = demoRequirePortalPatient();
    const idx = routineItemOverrides.findIndex(
      (o) => o.routine_item_id === data.routine_item_id && o.patient_id === patient.id,
    );
    if (idx >= 0) routineItemOverrides.splice(idx, 1);
    return { ok: true };
  });

export const toggleChecklistItem = createServerFn({ method: "POST" })
  .validator((data: { id: string; done: boolean }) => parseInput(schemas.ToggleChecklistItem, data))
  .handler(async ({ data }) => {
    demoRequirePortalPatient();
    const item = planMilestoneChecklist.find((c) => c.id === data.id);
    if (!item) throw new Error("Checklist item not found");
    if (item.clinic_owned) throw new Error("This step is completed by your clinic");
    item.done = data.done;
    item.done_at = data.done ? new Date().toISOString() : null;
    return { ok: true };
  });

export const updatePortalProfile = createServerFn({ method: "POST" })
  .validator(
    (data: {
      address_line1?: string;
      address_line2?: string;
      city?: string;
      postcode?: string;
      emergency_contact_name?: string;
      emergency_contact_relationship?: string;
      emergency_contact_phone?: string;
    }) => parseInput(schemas.UpdatePortalProfile, data),
  )
  .handler(async ({ data }) => {
    const patient = demoRequirePortalPatient();
    patient.address_line1 = data.address_line1 ?? null;
    patient.address_line2 = data.address_line2 ?? null;
    patient.city = data.city ?? null;
    patient.postcode = data.postcode ?? null;
    patient.emergency_contact_name = data.emergency_contact_name ?? null;
    patient.emergency_contact_relationship = data.emergency_contact_relationship ?? null;
    patient.emergency_contact_phone = data.emergency_contact_phone ?? null;
    return { ok: true };
  });

export const addExternalTreatment = createServerFn({ method: "POST" })
  .validator((data: { treatment: string; clinic_name: string; performed_label: string; notes?: string }) =>
    parseInput(schemas.AddExternalTreatment, data),
  )
  .handler(async ({ data }) => {
    const patient = demoRequirePortalPatient();
    const id = newId("f1");
    externalTreatments.push({
      id,
      clinic_id: CLINIC_ID,
      patient_id: patient.id,
      treatment: data.treatment.trim().slice(0, 140),
      clinic_name: data.clinic_name.trim().slice(0, 140),
      performed_label: data.performed_label.trim().slice(0, 40),
      performed_on: null,
      notes: data.notes?.trim().slice(0, 500) ?? null,
      created_at: new Date().toISOString(),
    });
    return { ok: true, id };
  });

export const deleteExternalTreatment = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => parseInput(schemas.DeleteExternalTreatment, data))
  .handler(async ({ data }) => {
    const patient = demoRequirePortalPatient();
    const index = externalTreatments.findIndex((e) => e.id === data.id && e.patient_id === patient.id);
    if (index >= 0) externalTreatments.splice(index, 1);
    return { ok: true };
  });

export const askCareAssistant = createServerFn({ method: "POST" })
  .validator((data: { question: string }) => parseInput(schemas.AskCareAssistant, data))
  .handler(async ({ data }) => {
    const patient = demoRequirePortalPatient();
    const plan = demoPortalPlan(patient.id);
    const milestones = plan ? planMilestones.filter((m) => m.plan_id === plan.id) : [];
    const current = portal.currentMilestone(milestones as any);
    const upcoming = demoUpcomingAppointments(patient.id, 1)[0];
    const { answerCareQuestion } = await import("@/lib/ai/care-assistant.server");
    return answerCareQuestion({
      question: data.question,
      firstName: patient.first_name,
      planName: plan?.name ?? null,
      currentStep: current ? { title: current.title, detail: current.detail ?? "" } : null,
      nextAppointment: upcoming
        ? { treatment: upcoming.treatment_name, startsAt: upcoming.starts_at }
        : null,
    });
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
    }) => parseInput(schemas.SubmitHistoryUpdate, data),
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

/** Mirrors guards.server.ts: resolved through can(), so display matches enforcement. */
function effectiveCapabilities(userId: string) {
  const roles = userRoles.filter((r) => r.user_id === userId).map((r) => r.role);
  const isOwner = roles.includes("owner");
  const permissions = rolePermissions
    .filter((p) => p.enabled && roles.includes(p.role))
    .map((p) => p.permission);
  const subject = { isOwner, permissions };
  return { isOwner, granted: PERMISSION_KEYS.filter((key) => can(subject, key)) };
}

export const listTeam = createServerFn({ method: "GET" }).handler(async () => {
  const me = identity();
  if (!me.isStaff) throw new Error("Staff access only");
  return userRoles
    .filter((r) => r.role !== "patient" && r.role !== "admin")
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
    }) => parseInput(schemas.CreateStaffAccount, data),
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
    }) => parseInput(schemas.UpdateStaffMember, data),
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
      app_origin?: string;
    }) => parseInput(schemas.InviteStaffMember, data),
  )
  .handler(async ({ data }) => {
    const email = assertEmail(data.email, "work email")!;
    const userId = newId("s8");
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
    welcomePendingByUser.add(userId);
    clearExTeamArchiveDemo(userId);
    return {
      userId,
      email,
      role: data.role,
      delivery: "emailed" as const,
      actionLink: null,
    };
  });

export const revokeStaffAccess = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => parseInput(schemas.RevokeStaffAccess, data))
  .handler(async ({ data }) => {
    const me = identity();
    if (data.userId === me.userId) throw new Error("You cannot revoke your own access");
    const roleRow = userRoles.find((r) => r.user_id === data.userId && r.role !== "patient");
    if (!roleRow) throw new Error("That person is not on the team");
    const profile = profiles.find((p) => p.id === data.userId);
    clearExTeamArchiveDemo(data.userId);
    const revokedAt = new Date();
    const email = db.staffEmails[data.userId] ?? "";
    exTeamMembers.push({
      id: newId("ex"),
      userId: data.userId,
      email,
      fullName: String(profile?.full_name ?? "").trim() || email,
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
    requireCapability("team.view");
  purgeExpiredExTeamMembersDemo();
  const now = Date.now();
  return exTeamMembers
    .filter((r) => !r.purgedAt && new Date(r.retainUntil).getTime() > now)
    .map((r) => {
      const profile = profiles.find((p) => p.id === r.userId);
      const email = r.email || db.staffEmails[r.userId] || "";
      return {
      id: r.id,
      userId: r.userId,
      email,
      fullName: String(r.fullName ?? "").trim() || String(profile?.full_name ?? "").trim() || email,
      jobTitle: r.jobTitle,
      registrationBody: r.registrationBody,
      registrationNumber: r.registrationNumber,
      role: r.role,
      revokedAt: r.revokedAt,
      retainUntil: r.retainUntil,
      daysRemaining: Math.max(0, Math.ceil((new Date(r.retainUntil).getTime() - now) / 86400000)),
    };
    })
    .sort((a, b) => b.revokedAt.localeCompare(a.revokedAt));
});

export const restoreExTeamMember = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => parseInput(schemas.RestoreExTeamMember, data))
  .handler(async ({ data }) => {
    purgeExpiredExTeamMembersDemo();
    const archived = exTeamMembers.find(
      (r) => r.userId === data.userId && !r.purgedAt && new Date(r.retainUntil).getTime() > Date.now(),
    );
    if (!archived) throw new Error("No former team record found (it may have expired)");
    const profile = profiles.find((p) => p.id === data.userId);
    if (profile) {
      if (String(archived.fullName ?? "").trim()) profile.full_name = archived.fullName;
      if (String(archived.jobTitle ?? "").trim()) profile.job_title = archived.jobTitle || null;
      if (String(archived.registrationBody ?? "").trim()) {
        profile.registration_body = archived.registrationBody || null;
      }
      if (String(archived.registrationNumber ?? "").trim()) {
        profile.registration_number = archived.registrationNumber || null;
      }
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
  .validator((data: { userId: string; password: string }) => parseInput(schemas.SetStaffPassword, data))
  .handler(async ({ data }) => {
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters");
    mustChangePasswordByUser.add(data.userId);
    welcomePendingByUser.delete(data.userId);
    return { ok: true };
  });

/** Signed-in staff: replace temporary/reset password and clear the must-change flag. */
export const changeOwnPassword = createServerFn({ method: "POST" })
  .validator((data: { password: string; code?: string }) => parseInput(schemas.ChangeOwnPassword, data))
  .handler(async ({ data }) => {
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters");
    const me = identity();
    const forced = mustChangePasswordByUser.has(me.userId);
    if (!forced) {
      const expected = passwordChangeCodes.get(me.userId);
      if (!data.code) throw new Error("Enter the 6-digit code we emailed you");
      if (!expected || data.code !== expected) throw new Error("That code was not recognised");
      passwordChangeCodes.delete(me.userId);
    }
    mustChangePasswordByUser.delete(me.userId);
    return { ok: true, mustChangePassword: false as const };
  });

export const acknowledgeWelcome = createServerFn({ method: "POST" }).handler(async () => {
  const me = identity();
  welcomePendingByUser.delete(me.userId);
  return { ok: true, welcomePending: false as const };
});

export const confirmStepUp = createServerFn({ method: "POST" })
  .validator((data: { password: string }) => parseInput(schemas.ConfirmStepUp, data))
  .handler(async () => ({ ok: true as const }));

export const sendLoginEmailCode = createServerFn({ method: "POST" }).handler(async () => {
  const me = identity();
  if (!me.isManager) throw new Error("Manager access required");
  return { ok: true as const, email: me.email, sent: true as const };
});

export const sendPasswordEmailCode = createServerFn({ method: "POST" }).handler(async () => {
  const me = requireStaff();
  if (!me.email) throw new Error("Your account has no email to send a code to");
  const last = passwordChangeCodeAt.get(me.userId);
  if (last && Date.now() - last < EMAIL_OTP_RESEND_MS) {
    throw new Error("Wait a moment before requesting another code");
  }
  const code = "246810";
  passwordChangeCodes.set(me.userId, code);
  passwordChangeCodeAt.set(me.userId, Date.now());
  return { ok: true as const, email: me.email, sent: true as const, previewCode: code };
});

export const verifyLoginEmailCode = createServerFn({ method: "POST" })
  .validator((data: { code: string }) => parseInput(schemas.VerifyLoginEmailCode, data))
  .handler(async () => ({ ok: true as const }));

export const listMySessions = createServerFn({ method: "GET" }).handler(async () => ({
  sessions: demoSessions.map((s) => ({ ...s })),
}));

export const revokeOtherSessions = createServerFn({ method: "POST" }).handler(async () => {
  demoSessions = demoSessions.filter((s) => s.current);
  return { ok: true as const };
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
    .filter((r) => r.role !== "patient" && r.role !== "admin" && !db.staffEmails[r.user_id])
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
  .validator((data: { patientId: string; email: string }) => parseInput(schemas.SetPatientEmail, data))
  .handler(async ({ data }) => {
    const email = assertEmail(data.email)!;
    const patient = patientById(data.patientId);
    if (patient) patient.email = email;
    return { ok: true };
  });

export const setStaffEmail = createServerFn({ method: "POST" })
  .validator((data: { userId: string; email: string }) => parseInput(schemas.SetStaffEmail, data))
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
  .validator((data: { from: string; to: string; previousFrom: string; previousTo: string }) =>
    parseInput(schemas.GetPractitionerPerformance, data),
  )
  .handler(async ({ data }) => {
    const me = requireCapability("reports.performance");
    if (!me.isStaff) throw new Error("Staff access only");
    const { buildStats, buildTrend, moneyChanges, moneyTotals, trendViewWindows } = await import("./earnings.server");
    const inputs = earningsInputs(data.from, data.to);
    const prevInputs = earningsInputs(data.previousFrom, data.previousTo);
    const windows = trendViewWindows();
    const yearInputs = earningsInputs(windows.year.from, windows.year.to);

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

    const prevRows = buildStats(
      staff,
      prevInputs.treatments as never,
      prevInputs.appointments as never,
      prevInputs.yearTreatments as never,
      prevInputs.firstSeen,
      { from: data.previousFrom, to: data.previousTo },
    );

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

    const trendViews = {
      month: buildTrend(staff, yearInputs.treatments as never, yearInputs.appointments as never, windows.month),
      six: buildTrend(staff, yearInputs.treatments as never, yearInputs.appointments as never, windows.six),
      year: buildTrend(staff, yearInputs.treatments as never, yearInputs.appointments as never, windows.year),
    };

    return {
      rows,
      previousRows: prevRows,
      totals,
      clinic,
      trend,
      trendViews,
      changes: moneyChanges(moneyTotals(rows), moneyTotals(prevRows)),
    };
  });

export const getMyEarnings = createServerFn({ method: "POST" })
  .validator((data: { from: string; to: string }) => parseInput(schemas.GetMyEarnings, data))
  .handler(async ({ data }) => {
    const me = requireCapability("view.earnings");
    if (!me.isStaff) throw new Error("Staff access only");
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
      appointments: stats.appointments,
      attendance: stats.attendance,
      noShows: stats.noShows,
      cancelled: stats.cancelled,
      lines: sortDesc(mine, "performed_at").map((t) => ({
        id: t.id,
        performedAt: t.performed_at,
        name: t.name,
        patientId: t.patient_id,
        patient: (() => {
          const p = patientById(t.patient_id);
          return p ? `${p.first_name} ${p.last_name}` : "—";
        })(),
        share: Math.round(Number(t.price ?? 0) * Number(t.commission_rate_snapshot ?? rate)) / 100,
      })),
    };
  });

export const setCommissionRate = createServerFn({ method: "POST" })
  .validator((data: { userId: string; rate: number }) => parseInput(schemas.SetCommissionRate, data))
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
    }) => parseInput(schemas.SubmitProfileChange, data),
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
    }) => parseInput(schemas.SaveMyProfile, data),
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
  const me = requireCapability("view.profile");
  if (!me.isStaff) throw new Error("Staff access only");
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
  .validator((data: { id: string; approve: boolean; reviewerNote?: string }) => parseInput(schemas.ReviewProfileChange, data))
  .handler(async ({ data }) => {
    const me = requireCapability("team.approve_changes");
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
  .validator((data: { path: string | null; targetUserId?: string }) => parseInput(schemas.SetMyAvatar, data))
  .handler(async ({ data }) => {
    const me = requireStaff();
    const profile = profiles.find((p) => p.id === (data.targetUserId ?? me.userId));
    if (profile) profile.avatar_url = data.path;
    return { ok: true };
  });

export const listMyDocuments = createServerFn({ method: "GET" })
  .validator((data: { targetUserId?: string }) => parseInput(schemas.ListMyDocuments, data))
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
    }) => parseInput(schemas.AddMyDocument, data),
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
  .validator((data: { id: string }) => parseInput(schemas.DeleteMyDocument, data))
  .handler(async ({ data }) => {
    const index = staffDocuments.findIndex((d) => d.id === data.id);
    if (index >= 0) staffDocuments.splice(index, 1);
    return { ok: true };
  });

export const getStaffProfile = createServerFn({ method: "GET" })
  .validator((data: { userId: string }) => parseInput(schemas.GetStaffProfile, data))
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
    const archived = exTeamMembers.find(
      (r) => r.userId === data.userId && !r.purgedAt && new Date(r.retainUntil).getTime() > Date.now(),
    );
    const email = archived?.email || db.staffEmails[data.userId] || "";
    const fullName = String(archived?.fullName ?? "").trim() || String(profile?.full_name ?? "").trim() || email;
    const safeProfile = profile
      ? {
          ...profile,
          full_name: fullName || profile.full_name,
          commission_rate: me.isManager ? profile.commission_rate : null,
        }
      : null;

    return {
      profile: safeProfile,
      role: roleFor(data.userId) || archived?.role || "",
      email,
      revoked: Boolean(archived),
      daysRemaining: archived
        ? Math.max(0, Math.ceil((new Date(archived.retainUntil).getTime() - Date.now()) / 86400000))
        : 0,
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
      capabilities: me.isManager && !archived ? effectiveCapabilities(data.userId) : null,
    };
  });

/* ---------------------------------------------------------------- */
/* retention and recalls                                              */
/* ---------------------------------------------------------------- */

export const getRetention = createServerFn({ method: "GET" })
  .validator((data: { from?: string; to?: string; key?: string }) => parseInput(schemas.GetRetention, data))
  .handler(async ({ data }) => {
  const me = requireStaff();
  if (!me.isOwner && !me.permissions.includes("reports.retention")) {
    throw new Error("You do not have access to retention reports");
  }
  const { buildRetention } = await import("./retention.server");
  const practitionerNames = new Map<string, string>(
    profiles.map((p) => [p.id as string, p.full_name as string]),
  );
  // 5-year chart + 365-day rolling lookback (same cutoff as live).
  const sixYearsAgo = isoDaysAgo(6 * 365);

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
      .filter((t) => t.performed_at >= sixYearsAgo)
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
    window:
      data.from && data.to
        ? {
            from: new Date(data.from).getTime(),
            to: new Date(data.to).getTime(),
            key: (["day", "week", "month", "year"] as const).find((k) => k === data.key) ?? "year",
          }
        : undefined,
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
  .validator((data: { patient_id: string; channel?: string; note?: string }) => parseInput(schemas.LogRetentionOutreach, data))
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

export const sendRecall = createServerFn({ method: "POST" })
  .validator(
    (data: { patient_id: string; channel: "email" | "sms"; subject?: string; body: string }) =>
      parseInput(schemas.SendRecall, data),
  )
  .handler(async ({ data }) => {
    const me = requireStaff();
    if (!can(me, "comms.send")) throw new Error("You do not have access to this area");
    const { id: communicationId } = queueCommunication({
      patientId: data.patient_id,
      channel: data.channel,
      purpose: "marketing",
      subject: data.subject ?? null,
      body: data.body,
      templateKey: "recall",
      relatedEntity: "retention_outreach",
      createdBy: me.userId,
    });
    retentionOutreach.push({
      id: newId("j9"),
      clinic_id: CLINIC_ID,
      patient_id: data.patient_id,
      contacted_by: me.userId,
      channel: data.channel,
      note: null,
      communication_id: communicationId,
      created_at: new Date().toISOString(),
    });
    return { ok: true, communication_id: communicationId };
  });

export const createRecallTask = createServerFn({ method: "POST" })
  .validator(
    (data: { patient_id: string; note?: string; recipients: { id: string; label: string }[] }) =>
      parseInput(schemas.CreateRecallTask, data),
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
        status: "open",
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
    }) => parseInput(schemas.UpdateRecallTask, data),
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
  .validator((data: { task_id: string; status: "open" | "contacted" | "completed" }) => parseInput(schemas.SetRecallTaskStatus, data))
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
      task.contacted_at = data.status === "open" ? null : now;
      task.completed_at = data.status === "completed" ? now : null;
      task.contacted_by = data.status === "open" ? null : me.userId;
      task.completed_by = data.status === "completed" ? me.userId : null;
      task.status_by_label = data.status === "open" ? null : actor;
      task.updated_at = now;
    }
    return { ok: true };
  });

export const deleteRecallTask = createServerFn({ method: "POST" })
  .validator((data: { task_id: string; assignee_ids?: string[] }) => parseInput(schemas.DeleteRecallTask, data))
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
  .validator((data: { patient_id: string }) => parseInput(schemas.ListRecallTasks, data))
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
  .validator((data: { treatment_name: string; lane: number | null; hex?: string | null }) => parseInput(schemas.SaveTreatmentColour, data))
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
  .validator((data: { name: string }) => parseInput(schemas.SaveColourTheme, data))
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
  .validator((data: { id: string }) => parseInput(schemas.ApplyColourTheme, data))
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
  .validator((data: { id: string }) => parseInput(schemas.DeleteColourTheme, data))
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
  aftercare_points?: string[];
  result_template?: string;
};

export const saveCatalogueItem = createServerFn({ method: "POST" })
  .validator((data: CatalogueInput) => parseInput(schemas.SaveCatalogueItem, data))
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
      result_template: data.result_template?.trim() || null,
      ...(data.aftercare_points
        ? { aftercare_points: data.aftercare_points.map((x) => x.trim()).filter(Boolean) }
        : {}),
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
  .validator((data: { id: string; active: boolean }) => parseInput(schemas.SetCatalogueItemActive, data))
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
  reminder_offsets: db.clinic["reminder_offsets"] ?? [168, 24],
}));

export const updateClinicDetails = createServerFn({ method: "POST" })
  .validator(
    (data: {
      name: string;
      address?: string | null;
      phone?: string | null;
      email?: string | null;
      reminder_offsets?: number[];
    }) => parseInput(schemas.UpdateClinicDetails, data),
  )
  .handler(async ({ data }) => {
    requireSettings();
    const name = (data.name ?? "").trim();
    if (!name) throw new Error("Clinic name is required");
    db.clinic["name"] = name;
    db.clinic["address"] = data.address?.trim() || null;
    db.clinic["phone"] = data.phone?.trim() || null;
    db.clinic["email"] = assertEmail(data.email ?? "", "clinic email", true);
    if (data.reminder_offsets) db.clinic["reminder_offsets"] = data.reminder_offsets;
    return { ok: true };
  });

export const listRolePermissions = createServerFn({ method: "GET" }).handler(async () => {
  const me = requireAccessAdmin();
  const grants: Record<string, Record<string, boolean>> = {
    manager: {},
    front_desk: {},
    practitioner: {},
    patient: {},
  };
  for (const role of ["manager", "front_desk", "practitioner", "patient"]) {
    for (const key of PERMISSION_KEYS) {
      grants[role]![key] =
        rolePermissions.find((r) => r.role === role && r.permission === key)?.enabled ?? false;
    }
  }
  return { grants, canEdit: me.isOwner || me.isAdmin };
});

export const setRolePermission = createServerFn({ method: "POST" })
  .validator(
    (data: { role: "manager" | "front_desk" | "practitioner" | "patient"; permission: string; enabled: boolean }) =>
      parseInput(schemas.SetRolePermission, data),
  )
  .handler(async ({ data }) => {
    const me = requireAccessAdmin();
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
    body: sanitizeNoteHtml(parseInput(schemas.SaveMyNote, { body: String(data?.body ?? "") }).body),
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
  .validator((data: { peerUserId: string }) => parseInput(schemas.GetStaffChat, data))
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
    }) => parseInput(schemas.SendStaffChatMessage, data),
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
  .validator((data: { peerUserId: string }) => parseInput(schemas.MarkStaffChatRead, data))
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

/* ---------------------------------------------------------------- */
/* treatment plans (journeys)                                        */
/* ---------------------------------------------------------------- */

export const listTreatmentPlans = createServerFn({ method: "GET" })
  .validator((data: { practitioner_id?: string; at_risk_only?: boolean; query?: string }) =>
    parseInput(schemas.ListTreatmentPlans, data),
  )
  .handler(async ({ data }) => {
    const todayISO = clinicDayKey(new Date());
    const nowISO = new Date().toISOString();
    const hasUpcoming = new Set(
      appointments.filter((a) => a.status === "booked" && a.starts_at >= nowISO).map((a) => a.patient_id),
    );
    const needle = (data.query ?? "").trim().toLowerCase();

    let rows = treatmentPlans
      .filter((p) => p.status === "active")
      .filter((p) => !data.practitioner_id || p.practitioner_id === data.practitioner_id)
      .map((p) => {
        const patient = patientById(p.patient_id);
        const mine = sortAsc(
          planMilestones.filter((m) => m.plan_id === p.id),
          "idx",
        );
        const done = mine.filter((m) => m.status === "done" || m.status === "skipped").length;
        const next = mine.find((m) => m.status === "current") ?? mine.find((m) => m.status === "upcoming") ?? null;
        const overdue = Boolean(next?.due_date && next.due_date < todayISO);
        const atRisk = overdue || !hasUpcoming.has(p.patient_id);
        return {
          id: p.id,
          patientId: p.patient_id,
          patientName: `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim(),
          patientReference: patient?.reference ?? null,
          avatarUrl: patient?.avatar_url ?? null,
          practitionerId: p.practitioner_id,
          practitionerName: p.practitioner_id ? profileName(p.practitioner_id) : null,
          name: p.name,
          phase: p.phase,
          done,
          total: mine.length || p.total_sessions,
          nextMilestone: next
            ? { id: next.id, title: next.title, kind: next.kind, dueDate: next.due_date }
            : null,
          overdue,
          atRisk,
          riskReason: overdue
            ? "Next step overdue"
            : !hasUpcoming.has(p.patient_id)
              ? "No upcoming booking"
              : null,
        };
      });

    if (needle) {
      rows = rows.filter(
        (r) => r.patientName.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle),
      );
    }
    if (data.at_risk_only) rows = rows.filter((r) => r.atRisk);
    return rows;
  });

export const createTreatmentPlan = createServerFn({ method: "POST" })
  .validator(
    (data: {
      patient_id: string;
      name: string;
      practitioner_id?: string;
      catalogue_id?: string;
      phase?: "consult" | "foundation" | "build" | "results";
      total_sessions?: number;
      milestones: { title: string; kind?: "session" | "task" | "conditional" }[];
    }) => parseInput(schemas.CreateTreatmentPlan, data),
  )
  .handler(async ({ data }) => {
    requireCapability("treatments.record");
    const planId = newId("d7");
    const nowISO = new Date().toISOString();
    treatmentPlans.push({
      id: planId,
      clinic_id: CLINIC_ID,
      patient_id: data.patient_id,
      practitioner_id: data.practitioner_id || null,
      catalogue_id: data.catalogue_id || null,
      kind: "treatment",
      name: data.name,
      phase: data.phase ?? "consult",
      status: "active",
      total_sessions:
        data.total_sessions ??
        Math.max(1, data.milestones.filter((m) => (m.kind ?? "task") === "session").length),
      started_at: nowISO,
      completed_at: null,
      created_by: identity().userId,
      created_at: nowISO,
      updated_at: nowISO,
    });
    data.milestones.forEach((m: any, i: number) => {
      planMilestones.push({
        id: newId("d8"),
        clinic_id: CLINIC_ID,
        plan_id: planId,
        idx: i + 1,
        title: m.title,
        kind: m.kind ?? "task",
        status: i === 0 ? "current" : "upcoming",
        due_date: m.due_date || null,
        appointment_id: null,
        completed_at: null,
        created_at: nowISO,
      });
    });
    return { id: planId };
  });

export const updatePlanMilestone = createServerFn({ method: "POST" })
  .validator((data: { id: string; status: "upcoming" | "current" | "done" | "skipped" }) =>
    parseInput(schemas.UpdatePlanMilestone, data),
  )
  .handler(async ({ data }) => {
    requireCapability("treatments.record");
    demoSetMilestoneStatus(data.id, data.status);
    return { ok: true };
  });

/** Demo twin of setMilestoneStatus. */
function demoSetMilestoneStatus(
  milestoneId: string,
  status: "upcoming" | "current" | "done" | "skipped",
  extra: Record<string, unknown> = {},
) {
  const milestone = planMilestones.find((m) => m.id === milestoneId);
  if (!milestone) throw new Error("Milestone not found.");
  milestone.status = status;
  milestone.completed_at = status === "done" ? new Date().toISOString() : null;
  Object.assign(milestone, extra);

  const siblings = sortAsc(planMilestones.filter((m) => m.plan_id === milestone.plan_id), "idx");
  if (status === "done" || status === "skipped") {
    const hasCurrent = siblings.some((m) => m.status === "current");
    const nextUp = siblings.find((m) => m.status === "upcoming");
    if (!hasCurrent && nextUp) nextUp.status = "current";
    const open = siblings.filter((m) => m.status === "upcoming" || m.status === "current");
    if (open.length === 0) {
      const plan = treatmentPlans.find((p) => p.id === milestone.plan_id);
      if (plan) {
        plan.status = "completed";
        plan.completed_at = new Date().toISOString();
      }
    }
  }
  return milestone;
}

/* ------------------------------------------------------------------ */
/* The treatment form — demo twins                                      */
/* ------------------------------------------------------------------ */

function demoSessionView(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status as "started" | "treating" | "aftercare" | "complete",
    treatmentId: row.treatment_id ?? null,
    preChecks: (row.pre_checks ?? {}) as Record<string, { answer: "yes" | "no" | "na"; note?: string }>,
    results: (row.results ?? {}) as { area?: string; product?: string; dose?: string },
    treatmentNotes: row.treatment_notes ?? null,
    visitNotes: row.visit_notes ?? null,
    aftercarePoints: (row.aftercare_points ?? []) as { label: string; covered: boolean }[],
    aftercareExtra: row.aftercare_extra ?? null,
    startedAt: row.started_at ?? null,
    treatingAt: row.treating_at ?? null,
    aftercareAt: row.aftercare_at ?? null,
    completedAt: row.completed_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function demoFormAppointment(appointmentId: string) {
  const appt = appointments.find((a) => a.id === appointmentId);
  if (!appt) throw new Error("Appointment not found");
  return appt;
}

function demoMilestoneForVisit(appt: any) {
  let milestone = planMilestones.find((m) => m.appointment_id === appt.id) ?? null;
  let planId: string | null = milestone?.plan_id ?? null;
  if (!milestone) {
    const plan = sortDesc(
      treatmentPlans.filter((p) => p.patient_id === appt.patient_id && p.status === "active"),
      "started_at",
    )[0];
    if (plan) {
      planId = plan.id;
      milestone =
        sortAsc(
          planMilestones.filter(
            (m) => m.plan_id === plan.id && m.kind === "session" && (m.status === "current" || m.status === "upcoming"),
          ),
          "idx",
        )[0] ?? null;
    }
  }
  if (!milestone || !planId) return null;
  const sessions = sortAsc(planMilestones.filter((m) => m.plan_id === planId && m.kind === "session"), "idx");
  const n = sessions.findIndex((m) => m.id === milestone!.id) + 1;
  return { id: milestone.id as string, title: milestone.title as string, sessionNumber: n || null, sessionTotal: sessions.length || null };
}

function demoUpsertSession(appt: any, patch: Record<string, unknown>) {
  const me = identity();
  const now = new Date().toISOString();
  let row = treatmentSessions.find((s) => s.appointment_id === appt.id);
  if (!row) {
    row = {
      id: newId("s9"),
      clinic_id: CLINIC_ID,
      appointment_id: appt.id,
      patient_id: appt.patient_id,
      practitioner_id: appt.practitioner_id ?? me.userId,
      catalogue_id: appt.catalogue_id ?? null,
      treatment_id: null,
      pre_checks: {},
      results: {},
      treatment_notes: null,
      visit_notes: null,
      aftercare_points: [],
      aftercare_extra: null,
      status: "started",
      started_at: now,
      treating_at: null,
      aftercare_at: null,
      completed_at: null,
      created_at: now,
      updated_at: now,
    };
    treatmentSessions.push(row);
  }
  Object.assign(row, patch, { updated_at: now });
  return row;
}

export const getTreatmentSession = createServerFn({ method: "GET" })
  .validator((data: { appointment_id: string }) => parseInput(schemas.GetTreatmentSession, data))
  .handler(async ({ data }) => {
    requireStaff();
    const appt = demoFormAppointment(data.appointment_id);
    const patient = patientById(appt.patient_id) ?? {};
    const item = appt.catalogue_id ? catalogue.find((c) => c.id === appt.catalogue_id) : null;
    const doc = appt.consent_document_id ? documents.find((d) => d.id === appt.consent_document_id) : null;
    const consent = demoConsentStateOf(appt);
    const session = treatmentSessions.find((s) => s.appointment_id === appt.id) ?? null;
    const milestone = demoMilestoneForVisit(appt);
    const starts = new Date(appt.starts_at);
    const lastSame = sortDesc(
      treatments.filter((t) => t.patient_id === appt.patient_id && t.name === appt.treatment_name),
      "performed_at",
    )[0];
    return {
      appointment: {
        id: appt.id,
        startsAt: appt.starts_at,
        endsAt: appt.ends_at ?? null,
        date: starts.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }),
        time: starts.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        stage: appt.stage ?? "booked",
        status: appt.status,
        treatment: appt.treatment_name,
        treatmentNumber: appt.treatment_number,
        category: item?.category ?? null,
        price: appt.price ?? null,
        practitionerId: appt.practitioner_id ?? null,
        practitionerName: appt.practitioner_id ? profileName(appt.practitioner_id) : null,
        sessionNumber: milestone?.sessionNumber ?? null,
        sessionTotal: milestone?.sessionTotal ?? null,
      },
      patient: {
        id: appt.patient_id,
        name: `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim(),
        firstName: patient.first_name ?? "",
        reference: patient.reference ?? null,
        dateOfBirth: patient.date_of_birth ?? null,
        allergies: patient.allergies ?? null,
        medications: patient.medications ?? null,
        conditions: patient.conditions ?? null,
        phone: patient.phone ?? null,
        email: patient.email ?? null,
      },
      consent: {
        state: consent,
        documentId: doc?.id ?? null,
        title: doc?.title ?? null,
        signedAt: doc?.signed_at ?? null,
        signedName: doc?.signed_name ?? null,
        witnessed: Boolean(doc?.witnessed_by),
      },
      canStart: canStartTreatment({ stage: appt.stage ?? "booked", consent }),
      session: demoSessionView(session),
      bookingNote: String(appt.notes ?? "").replace(/^Cancelled:[^\n]*(?:\n\n)?/, "").trim(),
      resultFields: fieldsFor(appt.treatment_name, item?.result_template ?? null),
      lastSameTreatment: lastSame
        ? {
            performedAt: lastSame.performed_at,
            product: lastSame.product ?? null,
            dose: lastSame.dose ?? null,
            area: lastSame.area ?? null,
            notes: lastSame.notes ?? null,
            by: lastSame.practitioner_id ? profileName(lastSame.practitioner_id) : null,
          }
        : null,
      aftercarePoints: aftercarePointsFor({
        catalogueAftercare: (item?.aftercare_points as string[] | undefined) ?? null,
        category: item?.category ?? null,
      }),
      checks: PRE_TREATMENT_CHECKS,
      photos: sortAsc(photos.filter((p: any) => p.appointment_id === appt.id), "taken_at").map((p: any) => ({
        id: p.id,
        kind: p.kind,
        takenAt: p.taken_at,
        caption: p.caption ?? null,
        url: p.storage_path,
      })),
      milestone: milestone ? { id: milestone.id, title: milestone.title } : null,
    };
  });

export const startTreatment = createServerFn({ method: "POST" })
  .validator((data: { appointment_id: string; pre_checks: Record<string, { answer: "yes" | "no" | "na"; note?: string }> }) =>
    parseInput(schemas.StartTreatment, data),
  )
  .handler(async ({ data }) => {
    requireCapability("treatments.record");
    requireStaff();
    const appt = demoFormAppointment(data.appointment_id);
    const gate = canStartTreatment({ stage: appt.stage ?? "booked", consent: demoConsentStateOf(appt) });
    if (!gate.ok) throw new Error(gate.reason);
    const now = new Date().toISOString();
    const row = demoUpsertSession(appt, { pre_checks: data.pre_checks, status: "treating", treating_at: now });
    appt.stage = "in_treatment";
    appt.status = "attended";
    appt.updated_at = now;
    return { ok: true, sessionId: row.id as string, stage: "in_treatment" as const };
  });

export const moveToAftercare = createServerFn({ method: "POST" })
  .validator(
    (data: {
      appointment_id: string;
      results: Record<string, string | undefined>;
      treatment_notes?: string;
      visit_notes?: string;
    }) => parseInput(schemas.MoveToAftercare, data),
  )
  .handler(async ({ data }) => {
    requireCapability("treatments.record");
    requireStaff();
    const appt = demoFormAppointment(data.appointment_id);
    const now = new Date().toISOString();
    const visitNotes = plainVisitNote(sanitizeNoteHtml(data.visit_notes ?? "")).slice(0, 20000);
    const row = demoUpsertSession(appt, {
      results: data.results,
      treatment_notes: data.treatment_notes?.trim() || null,
      visit_notes: visitNotes || null,
      status: "aftercare",
      aftercare_at: now,
    });
    if (visitNotes.trim()) demoWriteVisitNote(appt.id, visitNotes);
    appt.stage = "aftercare";
    appt.status = "attended";
    appt.updated_at = now;
    return { ok: true, sessionId: row.id as string, stage: "aftercare" as const };
  });

export const completeTreatment = createServerFn({ method: "POST" })
  .validator(
    (data: { appointment_id: string; aftercare_points: { label: string; covered: boolean }[]; aftercare_extra?: string }) =>
      parseInput(schemas.CompleteTreatment, data),
  )
  .handler(async ({ data }) => {
    requireCapability("treatments.record");
    const me = requireStaff();
    const appt = demoFormAppointment(data.appointment_id);
    const session = treatmentSessions.find((s) => s.appointment_id === appt.id);
    if (!session) throw new Error("Start the treatment form before completing it");
    if (session.treatment_id) return { ok: true, treatmentId: session.treatment_id as string, stage: "complete" as const };
    const now = new Date().toISOString();
    const practitionerId = appt.practitioner_id ?? me.userId;
    const item = appt.catalogue_id ? catalogue.find((c) => c.id === appt.catalogue_id) : null;
    const results = (session.results ?? {}) as Record<string, string>;
    const folded = foldResults(fieldsFor(appt.treatment_name, item?.result_template ?? null), results);
    const interval = (item?.interval_days as number | null | undefined) ?? null;
    const treatmentId = newId("e9");
    treatments.push({
      id: treatmentId,
      clinic_id: CLINIC_ID,
      patient_id: appt.patient_id,
      catalogue_id: appt.catalogue_id ?? null,
      practitioner_id: practitionerId,
      appointment_id: appt.id,
      name: appt.treatment_name,
      product: folded.product,
      dose: folded.dose,
      area: folded.area,
      notes: session.treatment_notes ?? null,
      price: appt.price ?? null,
      performed_at: appt.starts_at,
      next_due_at: interval
        ? new Date(new Date(appt.starts_at).getTime() + interval * 86400000).toISOString().slice(0, 10)
        : null,
      status: "completed",
      consent_document_id: appt.consent_document_id ?? null,
      commission_rate_snapshot: profiles.find((p) => p.id === practitionerId)?.commission_rate ?? 40,
      created_at: now,
      updated_at: now,
    });
    Object.assign(session, {
      treatment_id: treatmentId,
      aftercare_points: data.aftercare_points,
      aftercare_extra: data.aftercare_extra?.trim() || null,
      status: "complete",
      completed_at: now,
      updated_at: now,
    });
    for (const photo of photos as any[]) {
      if (photo.appointment_id === appt.id && !photo.treatment_id) photo.treatment_id = treatmentId;
    }
    const milestone = demoMilestoneForVisit(appt);
    if (milestone) demoSetMilestoneStatus(milestone.id, "done", { appointment_id: appt.id });
    appt.stage = "complete";
    appt.status = "attended";
    appt.updated_at = now;
    const patient = patientById(appt.patient_id);
    if (patient) {
      patient.last_visit_at = appt.starts_at;
      patient.status = "active";
    }
    return { ok: true, treatmentId, stage: "complete" as const };
  });

export const saveTreatmentSessionDraft = createServerFn({ method: "POST" })
  .validator(
    (data: {
      appointment_id: string;
      pre_checks?: Record<string, { answer: "yes" | "no" | "na"; note?: string }>;
      results?: { area?: string; product?: string; dose?: string };
      treatment_notes?: string;
      visit_notes?: string;
      aftercare_points?: { label: string; covered: boolean }[];
      aftercare_extra?: string;
    }) => parseInput(schemas.SaveTreatmentSessionDraft, data),
  )
  .handler(async ({ data }) => {
    requireCapability("treatments.record");
    requireStaff();
    const appt = demoFormAppointment(data.appointment_id);
    const existing = treatmentSessions.find((s) => s.appointment_id === appt.id);
    if (existing?.status === "complete") return { ok: true, saved: false };
    const patch: Record<string, unknown> = {};
    if (data.pre_checks) patch["pre_checks"] = data.pre_checks;
    if (data.results) patch["results"] = data.results;
    if (data.treatment_notes !== undefined) patch["treatment_notes"] = data.treatment_notes.trim() || null;
    if (data.visit_notes !== undefined) patch["visit_notes"] = plainVisitNote(sanitizeNoteHtml(data.visit_notes)).slice(0, 20000) || null;
    if (data.aftercare_points) patch["aftercare_points"] = data.aftercare_points;
    if (data.aftercare_extra !== undefined) patch["aftercare_extra"] = data.aftercare_extra.trim() || null;
    demoUpsertSession(appt, patch);
    return { ok: true, saved: true };
  });

export const getTreatmentRecord = createServerFn({ method: "GET" })
  .validator((data: { treatment_id: string }) => parseInput(schemas.GetTreatmentRecord, data))
  .handler(async ({ data }) => {
    requireStaff();
    const t = treatments.find((x) => x.id === data.treatment_id);
    if (!t) throw new Error("Treatment not found");
    const appt = t.appointment_id ? appointments.find((a) => a.id === t.appointment_id) : null;
    const patient = patientById(t.patient_id);
    const item = t.catalogue_id ? catalogue.find((c) => c.id === t.catalogue_id) : null;
    const session = treatmentSessions.find((s) => s.treatment_id === t.id) ?? null;
    const consent = t.consent_document_id ? documents.find((d) => d.id === t.consent_document_id) : null;
    return {
      treatment: {
        id: t.id,
        name: t.name,
        category: item?.category ?? null,
        resultTemplate: item?.result_template ?? null,
        performedAt: t.performed_at,
        nextDueAt: t.next_due_at ?? null,
        product: t.product ?? null,
        dose: t.dose ?? null,
        area: t.area ?? null,
        notes: t.notes ?? null,
        price: t.price ?? null,
        practitionerName: t.practitioner_id ? profileName(t.practitioner_id) : null,
        treatmentNumber: appt?.treatment_number ?? null,
        appointmentId: t.appointment_id ?? null,
      },
      patient: {
        id: t.patient_id,
        name: `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim(),
        reference: patient?.reference ?? null,
        dateOfBirth: patient?.date_of_birth ?? null,
      },
      session: demoSessionView(session),
      photos: sortAsc(photos.filter((p: any) => p.treatment_id === t.id), "taken_at").map((p: any) => ({
        id: p.id,
        kind: p.kind,
        takenAt: p.taken_at,
        caption: p.caption ?? null,
        url: p.storage_path,
      })),
      consent: consent
        ? {
            id: consent.id,
            title: consent.title,
            status: consent.status,
            signedAt: consent.signed_at,
            signedName: consent.signed_name,
            witnessed: Boolean(consent.witnessed_by),
          }
        : null,
      checks: PRE_TREATMENT_CHECKS,
    };
  });

export const getInsights = createServerFn({ method: "GET" })
  .validator((data: { from: string; to: string }) => parseInput(schemas.GetInsights, data))
  .handler(async ({ data }) => {
    const me = requireStaff();
    if (!me.isOwner && !me.permissions.includes("reports.insights")) {
      throw new Error("You do not have access to insights reports");
    }
    const { buildInsights } = await import("./insights.server");
    return buildInsights({
      from: data.from,
      to: data.to,
      patients: patients.map((p) => ({
        id: p.id,
        title: p.title,
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        phone: p.phone,
        avatar_url: p.avatar_url,
        source: p.source,
        created_at: p.created_at,
      })),
      appointments: appointments.map((a) => ({
        patient_id: a.patient_id,
        starts_at: a.starts_at,
        status: a.status,
        treatment_name: a.treatment_name,
        catalogue_id: a.catalogue_id,
      })),
      treatments: treatments.map((t) => ({
        patient_id: t.patient_id,
        name: t.name,
        price: t.price,
        performed_at: t.performed_at,
        catalogue_id: t.catalogue_id,
      })),
      catalogue: catalogue.map((c) => ({ id: c.id, name: c.name, category: c.category })),
      leads: websiteLeads.map((l) => ({
        id: l.id,
        patient_id: l.patient_id,
        first_name: l.first_name,
        last_name: l.last_name,
        email: l.email,
        phone: l.phone,
        source: l.source,
        interest: l.interest,
        occurred_at: l.occurred_at,
      })),
      products: retailProducts.map((p) => ({ id: p.id, name: p.name, sku: p.sku })),
      sales: productSales.map((s) => ({
        product_id: s.product_id,
        qty: s.qty,
        amount: s.amount,
        occurred_at: s.occurred_at,
      })),
    });
  });

export type RetailProductInput = {
  id?: string | null;
  name: string;
  sku?: string | null;
  price?: number | null;
  featured_on_portal?: boolean;
  image_url?: string | null;
  active?: boolean;
};

export const listRetailProducts = createServerFn({ method: "GET" }).handler(async () => {
  requireStaff();
  return [...retailProducts].sort(
    (a, b) => Number(b.active) - Number(a.active) || String(a.name).localeCompare(String(b.name)),
  );
});

export const saveRetailProduct = createServerFn({ method: "POST" })
  .validator((data: RetailProductInput) => parseInput(schemas.SaveRetailProduct, data))
  .handler(async ({ data }) => {
    requireSettings();
    const name = (data.name ?? "").trim();
    if (!name) throw new Error("Product name is required");
    const row: Record<string, unknown> = {
      clinic_id: CLINIC_ID,
      name,
      sku: data.sku?.trim() || null,
      price: data.price ?? null,
      featured_on_portal: data.featured_on_portal ?? false,
      image_url: data.image_url?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (!data.id) row.active = data.active ?? true;
    else if (data.active !== undefined) row.active = data.active;
    if (data.id) {
      const existing = retailProducts.find((p) => p.id === data.id);
      if (existing) Object.assign(existing, row);
      return { ok: true, id: data.id };
    }
    const created = { id: newId("r9"), created_at: new Date().toISOString(), ...row };
    retailProducts.push(created);
    return { ok: true, id: created.id };
  });

export const setRetailProductActive = createServerFn({ method: "POST" })
  .validator((data: { id: string; active: boolean }) => parseInput(schemas.SetRetailProductActive, data))
  .handler(async ({ data }) => {
    requireSettings();
    const row = retailProducts.find((p) => p.id === data.id);
    if (row) row.active = data.active;
    return { ok: true };
  });

export const getInsightsIngestKeyStatus = createServerFn({ method: "GET" }).handler(async () => {
  const me = identity();
  if (!me.isOwner) throw new Error("Clinic owner access only");
  const last4 = (db.clinic["insights_ingest_key_last4"] as string | null) ?? null;
  return { configured: Boolean(last4), last4 };
});

export const rotateInsightsIngestKey = createServerFn({ method: "POST" }).handler(async () => {
  const me = identity();
  if (!me.isOwner) throw new Error("Clinic owner access only");
  const { generateInsightsIngestKey } = await import("./insights-ingest.server");
  const generated = generateInsightsIngestKey();
  db.clinic["insights_ingest_key_hash"] = generated.hash;
  db.clinic["insights_ingest_key_last4"] = generated.last4;
  return { raw: generated.raw, last4: generated.last4 };
});

/* ---------------------------------------------------------------- */
/* offers and marketing                                              */
/* ---------------------------------------------------------------- */

function demoOfferCohortInput() {
  const activePlans = treatmentPlans.filter((p) => p.status === "active");
  const planIds = new Set(activePlans.map((p) => p.id));
  return {
    patients,
    appointments,
    treatments,
    catalogue,
    plans: activePlans,
    milestones: planMilestones.filter((m) => planIds.has(m.plan_id)),
    offers: patientOffers,
  };
}

function demoOfferStore(origin?: string | null): OfferStore {
  const resolvedOrigin = (origin?.trim() || process.env["APP_ORIGIN"]?.trim() || "").replace(/\/$/, "");
  return {
    clinicId: CLINIC_ID,
    clinicName: db.clinic["name"] ?? "Your clinic",
    origin: resolvedOrigin,
    async getPatients(ids) {
      const wanted = new Set(ids);
      return patients.filter((p) => wanted.has(p.id));
    },
    async insertOffer(row) {
      const created = {
        id: newId("f6"),
        ...row,
        communication_id: null,
        viewed_at: null,
        claimed_at: null,
        created_at: row.sent_at,
      };
      patientOffers.unshift(created);
      return created.id;
    },
    async linkCommunication(offerId, communicationId) {
      const row = patientOffers.find((o) => o.id === offerId);
      if (row) row.communication_id = communicationId;
    },
    async enqueue(input) {
      return queueCommunication({
        patientId: input.patientId,
        channel: input.channel,
        purpose: input.purpose,
        body: input.body,
        bodyHtml: input.bodyHtml ?? null,
        subject: input.subject ?? null,
        templateKey: input.templateKey ?? null,
        toAddress: input.toAddress ?? null,
        scheduledFor: input.scheduledFor ?? null,
        relatedEntity: input.relatedEntity ?? null,
        relatedId: input.relatedId ?? null,
        createdBy: input.createdBy ?? null,
      });
    },
  };
}

/** The demo twin of runOfferAutomation, over the in-memory arrays. */
async function runDemoOfferAutomation() {
  const summary = { templates: 0, sent: 0, skipped: 0 };
  const enabled = offerTemplates.filter((t) => t.automation_enabled && !t.archived_at && t.stage !== "custom");
  if (enabled.length === 0) return summary;
  const input = demoOfferCohortInput();
  const members = buildStageCohorts(input);
  const store = demoOfferStore();
  const now = new Date();
  for (const tmpl of enabled) {
    summary.templates += 1;
    const preview = previewStage(members, patients, patientOffers, tmpl.stage, Number(tmpl.automation_delay_days ?? 0), now);
    summary.skipped += preview.skipped.length;
    if (preview.willSend.length > 0) {
      const result = await sendOfferToPatients(store, tmpl, preview.willSend.map((r) => r.patient_id), {
        source: "automation",
        sentBy: null,
        portalOnlyWhenNoConsent: false,
        now,
      });
      summary.sent += result.sent.length;
      summary.skipped += result.skipped.length;
    }
    tmpl.last_automation_at = now.toISOString();
  }
  return summary;
}

function requireOffersManage() {
  const me = requireStaff();
  if (!can(me, "offers.manage")) throw new Error("You do not have access to this area");
  return me;
}

export const listOfferTemplates = createServerFn({ method: "GET" }).handler(async () => {
  requireStaff();
  const now = new Date();
  return sortAsc(
    offerTemplates.filter((t) => !t.archived_at),
    "created_at",
  ).map((t) => {
    const counts: Record<string, number> = { sent: 0, viewed: 0, claimed: 0, expired: 0, cancelled: 0 };
    for (const o of patientOffers.filter((o) => o.template_id === t.id)) {
      const status = effectiveOfferStatus(o, now);
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return { ...t, counts };
  });
});

export const saveOfferTemplate = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id?: string;
      name: string;
      stage: "pre_consultation" | "post_consultation" | "single_treatment" | "plan_ending" | "custom";
      subject: string;
      headline: string;
      body: string;
      value_text?: string;
      code?: string;
      cta_label?: string;
      valid_days: number;
      send_email: boolean;
      send_sms: boolean;
      show_in_portal: boolean;
    }) => parseInput(schemas.SaveOfferTemplate, data),
  )
  .handler(async ({ data }) => {
    const me = requireOffersManage();
    if (data.stage !== "custom") {
      const clash = offerTemplates.find((t) => t.stage === data.stage && !t.archived_at && t.id !== data.id);
      if (clash) throw new Error(`There is already a ${STAGE_LABEL[data.stage]} template. Edit that one or archive it first.`);
    }
    const payload = {
      name: data.name,
      stage: data.stage,
      subject: data.subject,
      headline: data.headline,
      body: data.body,
      value_text: data.value_text?.trim() || null,
      code: data.code?.trim().toUpperCase() || null,
      cta_label: data.cta_label?.trim() || "Claim this offer",
      valid_days: data.valid_days,
      send_email: data.send_email,
      send_sms: data.send_sms,
      show_in_portal: data.show_in_portal,
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const row = offerTemplates.find((t) => t.id === data.id);
      if (!row) throw new Error("Template not found");
      Object.assign(row, payload);
      return { id: row.id };
    }
    const row = {
      id: newId("f5"),
      clinic_id: CLINIC_ID,
      ...payload,
      automation_enabled: false,
      automation_delay_days: data.stage === "custom" ? 0 : STAGE_META[data.stage].defaultDelayDays,
      last_automation_at: null,
      created_by: me.userId,
      archived_at: null,
      created_at: new Date().toISOString(),
    };
    offerTemplates.push(row);
    return { id: row.id };
  });

export const archiveOfferTemplate = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => parseInput(schemas.ArchiveOfferTemplate, data))
  .handler(async ({ data }) => {
    requireOffersManage();
    const row = offerTemplates.find((t) => t.id === data.id);
    if (!row) throw new Error("Template not found");
    row.archived_at = new Date().toISOString();
    row.automation_enabled = false;
    return { ok: true };
  });

export const setOfferAutomation = createServerFn({ method: "POST" })
  .validator(
    (data: { id: string; enabled: boolean; delay_days: number }) =>
      parseInput(schemas.SetOfferAutomation, data),
  )
  .handler(async ({ data }) => {
    requireOffersManage();
    const row = offerTemplates.find((t) => t.id === data.id);
    if (!row) throw new Error("Template not found");
    if (row.stage === "custom" && data.enabled) throw new Error("One-off templates cannot run automatically.");
    row.automation_enabled = data.enabled;
    row.automation_delay_days = data.delay_days;
    row.updated_at = new Date().toISOString();
    return { ok: true };
  });

export const draftOfferTemplate = createServerFn({ method: "POST" })
  .validator(
    (data: {
      stage: "pre_consultation" | "post_consultation" | "single_treatment" | "plan_ending" | "custom";
      brief: string;
      tone: "warm" | "playful" | "clinical";
    }) => parseInput(schemas.DraftOfferTemplate, data),
  )
  .handler(async ({ data }) => {
    requireOffersManage();
    const { draftOffer } = await import("./offers/draft.server");
    return draftOffer({ stage: data.stage, brief: data.brief, tone: data.tone, clinicName: db.clinic["name"] ?? "the clinic" });
  });

export const previewOfferStage = createServerFn({ method: "GET" })
  .validator(
    (data: {
      stage: "pre_consultation" | "post_consultation" | "single_treatment" | "plan_ending";
      delay_days?: number;
    }) => parseInput(schemas.PreviewOfferStage, data),
  )
  .handler(async ({ data }) => {
    requireOffersManage();
    const input = demoOfferCohortInput();
    const members = buildStageCohorts(input);
    const tmpl = offerTemplates.find((t) => t.stage === data.stage && !t.archived_at);
    const delay = Number(data.delay_days ?? tmpl?.automation_delay_days ?? STAGE_META[data.stage].defaultDelayDays);
    return {
      ...previewStage(members, patients, patientOffers, data.stage, delay),
      counts: stageCounts(members),
      delay_days: delay,
    };
  });

export const listOfferSends = createServerFn({ method: "GET" })
  .validator((data: { template_id: string }) => parseInput(schemas.ListOfferSends, data))
  .handler(async ({ data }) => {
    requireOffersManage();
    return sortDesc(
      patientOffers.filter((o) => o.template_id === data.template_id),
      "sent_at",
    )
      .slice(0, 200)
      .map((o) => ({ ...patientOfferView(o), patient_name: patientName(o.patient_id) }));
  });

export const sendOffer = createServerFn({ method: "POST" })
  .validator(
    (data: {
      template_id: string;
      patient_ids: string[];
      message?: string;
      source: "one_off" | "bulk" | "insights";
      app_origin?: string;
    }) => parseInput(schemas.SendOffer, data),
  )
  .handler(async ({ data }) => {
    const me = requireStaff();
    if (!can(me, "comms.send")) throw new Error("You do not have access to this area");
    const tmpl = offerTemplates.find((t) => t.id === data.template_id);
    if (!tmpl) throw new Error("Template not found");
    return sendOfferToPatients(demoOfferStore(data.app_origin), tmpl, data.patient_ids, {
      source: data.source,
      sentBy: me.userId,
      personalLine: data.message ?? null,
      portalOnlyWhenNoConsent: true,
    });
  });

export const listPatientOffers = createServerFn({ method: "GET" })
  .validator((data: { patient_id: string }) => parseInput(schemas.ListPatientOffers, data))
  .handler(async ({ data }) => {
    requireStaff();
    return sortDesc(
      patientOffers.filter((o) => o.patient_id === data.patient_id),
      "sent_at",
    ).map((o) => ({
      ...patientOfferView(o),
      template_name: offerTemplates.find((t) => t.id === o.template_id)?.name ?? null,
    }));
  });

function demoOwnOffer(id: string) {
  const patient = demoRequirePortalPatient();
  const offer = patientOffers.find((o) => o.id === id);
  if (!offer || offer.patient_id !== patient.id) throw new Error("Offer not found");
  return { patient, offer };
}

export const markOfferViewed = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => parseInput(schemas.MarkOfferViewed, data))
  .handler(async ({ data }) => {
    const { offer } = demoOwnOffer(data.id);
    if (offer.status !== "sent") return { ok: true, status: offer.status };
    offer.status = "viewed";
    offer.viewed_at = new Date().toISOString();
    return { ok: true, status: "viewed" };
  });

export const claimOffer = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => parseInput(schemas.ClaimOffer, data))
  .handler(async ({ data }) => {
    const { patient, offer } = demoOwnOffer(data.id);
    const status = effectiveOfferStatus(offer);
    if (status === "claimed") return { ok: true, claimed_at: offer.claimed_at };
    if (status === "expired") throw new Error("This offer has expired.");
    if (status === "cancelled") throw new Error("This offer is no longer available.");
    const now = new Date().toISOString();
    offer.status = "claimed";
    offer.claimed_at = now;
    offer.viewed_at = offer.viewed_at ?? now;
    const recipients = [
      ...new Set(
        userRoles
          .filter((r) => r.role === "owner" || r.role === "manager" || r.role === "front_desk")
          .map((r) => r.user_id as string),
      ),
    ];
    const name = `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || "A patient";
    for (const recipient_id of recipients) {
      staffNotifications.unshift({
        id: newId("l9"),
        clinic_id: CLINIC_ID,
        recipient_id,
        sender_id: null,
        urgent: false,
        kind: "offer_claimed",
        title: "Offer claimed",
        body: `${name} claimed "${offer.headline}"${offer.code ? ` (code ${offer.code})` : ""}. Apply it when they book.`,
        patient_id: patient.id,
        appointment_id: null,
        read_at: null,
        created_at: now,
      });
    }
    return { ok: true, claimed_at: now };
  });
