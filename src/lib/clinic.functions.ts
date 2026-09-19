import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/auth/session-middleware.server";
import { clinicDayDiff, clinicDayKey, clinicDayRange } from "@/lib/clinic-time";
import { plainVisitNote, sanitizeNoteHtml } from "@/lib/sanitize-note-html";
import { clampDurationMinutes } from "@/lib/treatment-duration";
import {
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
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/permissions";
import { mintVoiceToken, voiceAvailable, voiceTargetFor } from "@/lib/comms/voice.server";
import { parseInput } from "@/lib/validation/parse";
import * as schemas from "@/lib/validation/schemas";
import {
  type Ctx,
  authorize,
  effectiveCapabilities,
  loadIdentity,
  reloadIdentity,
  requireOwner,
  requireManager,
  requireStaff,
  requireStepUp,
  scopeFor,
  stepUpExpiry,
} from "@/lib/auth/guards.server";
import { verifyPassword } from "@/lib/auth/password-verify.server";
import { clinicScoped } from "@/lib/auth/clinic-scope.server";
import { EMAIL_MFA_SESSION_MS, EMAIL_OTP_RESEND_MS, EMAIL_OTP_TTL_MS } from "@/lib/auth/constants";
import { emailMfaDelivery } from "@/lib/auth/email-mfa.server";
import { createHash, randomInt } from "node:crypto";

export { PERMISSION_KEYS, type PermissionKey };

/**
 * The caller's clinic, resolved from their profile (staff) or patient record
 * (portal) by the session middleware. This replaced a hardcoded constant, which
 * meant every write was stamped with the same clinic no matter who made it.
 */
function clinicIdOf(context: unknown): string {
  const id = (context as Ctx).clinicId;
  if (!id) throw new Error("Your account is not linked to a clinic.");
  return id;
}

/**
 * The admin client, clinic-scoped the same way the request client is.
 *
 * `supabaseAdmin` is a module singleton with no request context, so reaching for
 * it directly is the one way to sidestep the isolation the middleware applies.
 * Handlers that need the Auth admin API go through here instead; `.auth` and
 * `.storage` pass through untouched, only `.from()` gains the clinic filter.
 */
async function adminClient(context: unknown) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return clinicScoped(supabaseAdmin, (context as Ctx).clinicId);
}

/** Reject if the practitioner already has a non-cancelled booking overlapping this window. */
async function assertNoPractitionerOverlap(
  supabase: any,
  args: {
    practitionerId: string | null | undefined;
    startsAt: string;
    endsAt: string;
    excludeAppointmentId?: string | null;
  },
) {
  if (!args.practitionerId) return;
  let q = supabase
    .from("appointments")
    .select("id, starts_at, ends_at, status")
    .eq("practitioner_id", args.practitionerId)
    .neq("status", "cancelled")
    .lt("starts_at", args.endsAt)
    .gt("ends_at", args.startsAt);
  if (args.excludeAppointmentId) q = q.neq("id", args.excludeAppointmentId);
  const { data, error } = await q.limit(1);
  if (error) throw new Error(error.message);
  if (data?.length) throw new Error(PRACTITIONER_OVERLAP_MESSAGE);
}

/** ~100 years — revoked staff cannot keep an Auth session or sign back in. */
const STAFF_REVOKE_BAN = "876000h";

async function unbanAuthUser(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const res = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });
  if (res.error) throw new Error(res.error.message);
}

async function banAuthUser(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const existing = await supabaseAdmin.auth.admin.getUserById(userId);
  if (existing.error) throw new Error(existing.error.message);
  const res = await supabaseAdmin.auth.admin.updateUserById(userId, {
    ban_duration: STAFF_REVOKE_BAN,
    app_metadata: {
      ...(existing.data.user?.app_metadata ?? {}),
      must_change_password: false,
      welcome_pending: false,
    },
  });
  if (res.error) throw new Error(res.error.message);
}


const EX_TEAM_RETAIN_DAYS = 90;

function retainUntilFrom(revokedAt: Date = new Date()) {
  return new Date(revokedAt.getTime() + EX_TEAM_RETAIN_DAYS * 86400000).toISOString();
}

function daysRemainingUntil(retainUntil: string) {
  return Math.max(0, Math.ceil((new Date(retainUntil).getTime() - Date.now()) / 86400000));
}

/** Name the manager will recognise: profile, then Auth metadata, then email. */
function staffArchiveIdentity(opts: {
  profileName?: string | null;
  metaName?: string | null;
  email?: string | null;
}) {
  const email = String(opts.email ?? "").trim();
  const fullName =
    String(opts.profileName ?? "").trim() || String(opts.metaName ?? "").trim() || email;
  return { fullName, email };
}

/**
 * Snapshot staff identity into the 90-day ex-team archive.
 * Clinical rows (patients, appointments, treatments, …) are never copied here.
 */
async function archiveExTeamMember(opts: {
  clinicId: string;
  userId: string;
  role: string;
  email: string;
  fullName: string;
  jobTitle: string | null;
  registrationBody: string | null;
  registrationNumber: string | null;
  commissionRate: number | null;
  revokedBy: string;
}) {
  const supabaseAdmin = await adminClient({ clinicId: opts.clinicId });
  const revokedAt = new Date();
  // Replace any prior active archive row for this user.
  await supabaseAdmin
    .from("ex_team_members")
    .delete()
    .eq("user_id", opts.userId)
    .is("purged_at", null);
  const { error } = await supabaseAdmin.from("ex_team_members").insert({
    clinic_id: opts.clinicId,
    user_id: opts.userId,
    email: opts.email || null,
    full_name: opts.fullName || "",
    job_title: opts.jobTitle,
    registration_body: opts.registrationBody,
    registration_number: opts.registrationNumber,
    role: opts.role,
    commission_rate: opts.commissionRate,
    revoked_at: revokedAt.toISOString(),
    revoked_by: opts.revokedBy,
    retain_until: retainUntilFrom(revokedAt),
  });
  if (error) throw new Error(error.message);
}

async function clearExTeamArchive(clinicId: string, userId: string) {
  const supabaseAdmin = await adminClient({ clinicId });
  await supabaseAdmin.from("ex_team_members").delete().eq("user_id", userId).is("purged_at", null);
}

/**
 * After 90 days: remove staff-only identity from the archive + HR files.
 * Never deletes patients, appointments, treatments, messages, or audit history.
 * Profiles stay as anonymised stubs so practitioner FKs remain valid.
 */
async function purgeExpiredExTeamMembers(clinicId: string) {
  const supabaseAdmin = await adminClient({ clinicId });
  const now = new Date().toISOString();
  const { data: expired, error } = await supabaseAdmin
    .from("ex_team_members")
    .select("id, user_id, full_name")
    .is("purged_at", null)
    .lte("retain_until", now);
  if (error) throw new Error(error.message);
  for (const row of expired ?? []) {
    const userId = row.user_id as string;
    const formerLabel = `Former - ${String(row.full_name ?? "").trim() || "team member"}`;
    // Staff HR files only — not patient documents.
    const { data: docs } = await supabaseAdmin
      .from("staff_documents")
      .select("id, path")
      .eq("user_id", userId);
    for (const doc of docs ?? []) {
      if (doc.path) {
        try {
          await supabaseAdmin.storage.from("staff-files").remove([doc.path]);
        } catch {
          /* best-effort — still purge the DB row */
        }
      }
    }
    await supabaseAdmin.from("staff_documents").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_notes").delete().eq("user_id", userId);
    // Keep a named stub so appointments.practitioner_id still resolves usefully.
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: formerLabel,
        job_title: null,
        registration_body: null,
        registration_number: null,
        avatar_url: null,
        commission_rate: 0,
      })
      .eq("id", userId);
    await supabaseAdmin
      .from("ex_team_members")
      .update({
        purged_at: now,
        email: null,
        full_name: formerLabel,
        job_title: null,
        registration_body: null,
        registration_number: null,
        commission_rate: null,
      })
      .eq("id", row.id);
  }
}


/**
 * Every call site runs after its mutation has already committed, so a failure
 * here must not throw: that would report a successful clinical write as an error
 * and invite a retry that duplicates it. Log loudly instead. Making the trail
 * durable and tamper-evident is a separate problem (audit §10.3).
 */
async function audit(
  context: Ctx,
  action: string,
  entity: string,
  entityId: string | null,
  patientId: string | null,
  meta?: Record<string, unknown>,
) {
  const { error } = await context.supabase.from("audit_log").insert({
    clinic_id: clinicIdOf(context),
    actor_id: context.userId,
    actor_label: (context.claims["email"] as string) ?? null,
    action,
    entity,
    entity_id: entityId,
    patient_id: patientId,
    meta: meta ?? null,
  });
  if (error) {
    console.error(
      `[audit] failed to record "${action}" on ${entity}${entityId ? ` ${entityId}` : ""} for actor ${context.userId}: ${error.message}`,
    );
  }
}

/** Signed-in identity. Bootstraps the very first user as clinic owner. */
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabaseAdmin = await adminClient(context);
    const authUser = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (authUser.error) throw new Error(authUser.error.message);
    const bannedUntil = authUser.data.user?.banned_until;
    if (bannedUntil && new Date(bannedUntil) > new Date()) {
      throw new Error("Your clinic access has been removed. Please contact your manager.");
    }

    let identity = await authorize(context as Ctx, "getMe");
    if (identity.roles.length === 0 && !identity.patient) {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .in("role", ["owner", "manager", "practitioner", "front_desk"]);
      if (!count) {
        await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "owner" });
        await supabaseAdmin
          .from("profiles")
          .update({ clinic_id: clinicIdOf(context), job_title: "Clinic Owner" })
          .eq("id", context.userId);
        // Roles just changed for this caller — the cached copy predates the insert.
        identity = await reloadIdentity(context as Ctx);
      }
    }
    // Anyone linked to a patient record with no staff role is explicitly a patient.
    if (identity.roles.length === 0 && identity.patient) {
      await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "patient" });
      identity = await reloadIdentity(context as Ctx);
    }
    // Former staff keep a profiles row after revoke. Without a linked patient
    // record they must not fall into the patient portal — force sign-out.
    if (!identity.isStaff && !identity.patient && identity.profile) {
      throw new Error("Your clinic access has been removed. Please contact your manager.");
    }
    return identity;
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const identity = await authorize(context as Ctx, "getDashboard");
    const supabase = (context as Ctx).supabase;
    const today = new Date();
    const in30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);
    const weekAhead = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const prevMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString();
    const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const yearAgo = new Date(today.getTime() - 365 * 86400000).toISOString();

    const dayRange = clinicDayRange(today);
    const todayStart = dayRange.startISO;
    const tomorrowStart = dayRange.endISO;

    const isManager = identity.isManager;
    const isPractitioner = identity.roles.includes("practitioner");
    const isFrontDesk = identity.roles.includes("front_desk");

    const [
      patients,
      dueRows,
      monthTreatments,
      pendingDocs,
      historyFlags,
      todayAppointmentsRaw,
      unpaidDepositRaw,
      prevMonthTreatments,
      prevMonthPatients,
      unreadMessages,
      dueDatesRaw,
    ] = await Promise.all([
      supabase.from("patients").select("id, status, created_at"),
      supabase
        .from("treatments")
        .select("id, name, next_due_at, patient_id, practitioner_id, patients(first_name, last_name)")
        .not("next_due_at", "is", null)
        .lte("next_due_at", in30)
        .order("next_due_at", { ascending: true })
        .limit(12),
      supabase.from("treatments").select("id, price, patient_id, practitioner_id, performed_at").gte("performed_at", monthStart),
      supabase
        .from("documents")
        .select("id, title, kind, status, patient_id, sent_at, patients(first_name, last_name)")
        .in("status", ["sent", "viewed"])
        .order("sent_at", { ascending: true })
        .limit(10),
      supabase
        .from("medical_history_versions")
        .select("id, patient_id, summary, created_at, patients(first_name, last_name)")
        .is("reviewed_at", null)
        .eq("source", "patient")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("appointments")
        .select(
          "*, patients(first_name, last_name, reference, email, phone, avatar_url), profiles(full_name), documents(status, title), appointment_notes(body, updated_at, updated_by_label)",
        )
        .gte("starts_at", todayStart)
        .lt("starts_at", tomorrowStart)
        .order("starts_at", { ascending: true }),
      supabase
        .from("appointments")
        .select(
          "id, starts_at, treatment_name, patient_id, practitioner_id, status, payment_status, patients(first_name, last_name)",
        )
        .eq("payment_status", "unpaid")
        .neq("status", "cancelled")
        .gte("starts_at", todayStart)
        .lt("starts_at", new Date(today.getTime() + 30 * 86400000).toISOString())
        .order("starts_at", { ascending: true })
        .limit(80),
      supabase.from("treatments").select("id, price, patient_id, practitioner_id, performed_at").gte("performed_at", prevMonthStart).lt("performed_at", prevMonthEnd),
      supabase.from("patients").select("id, created_at").gte("created_at", prevMonthStart).lt("created_at", prevMonthEnd),
      supabase
        .from("messages")
        .select("id, patient_id, body, created_at, patients(first_name, last_name)")
        .is("read_at", null)
        .eq("author", "patient")
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("treatments")
        .select("next_due_at, practitioner_id")
        .not("next_due_at", "is", null)
        .lte("next_due_at", in30),
    ]);

    // Journeys + Safe-to-proceed. Fetched after the main fan-out so the three
    // queries can share the ids above; plans are few, so this stays cheap.
    const dayAfterTomorrow = clinicDayRange(new Date(today.getTime() + 86400000)).endISO;
    const [plansRaw, milestonesRaw, horizonApptsRaw] = await Promise.all([
      supabase
        .from("treatment_plans")
        .select("id, patient_id, practitioner_id, name, phase, status, total_sessions, patients(first_name, last_name, avatar_url)")
        .eq("status", "active")
        .order("started_at", { ascending: true }),
      supabase.from("plan_milestones").select("plan_id, status, kind, idx, due_date"),
      supabase
        .from("appointments")
        .select(
          "id, starts_at, treatment_name, patient_id, practitioner_id, status, payment_status, documents(status), patients(first_name, last_name, allergies, avatar_url)",
        )
        .gte("starts_at", todayStart)
        .lt("starts_at", dayAfterTomorrow)
        .eq("status", "booked")
        .order("starts_at", { ascending: true }),
    ]);

    let all = patients.data ?? [];
    let due = (dueRows.data ?? []) as any[];
    let monthTreats = (monthTreatments.data ?? []) as any[];
    let prevMonthTreats = (prevMonthTreatments.data ?? []) as any[];
    let todayAppts = (todayAppointmentsRaw.data ?? []) as any[];
    let unpaidDeposits = (unpaidDepositRaw.data ?? []) as any[];
    let dueDates = (dueDatesRaw.data ?? []) as { next_due_at: string; practitioner_id: string | null }[];

    const scoped = scopeFor(identity, "getDashboard");
    if (scoped) {
      due = due.filter((t: any) => t.practitioner_id === scoped || !t.practitioner_id);
      dueDates = dueDates.filter((t) => t.practitioner_id === scoped || !t.practitioner_id);
      monthTreats = monthTreats.filter((t: any) => t.practitioner_id === scoped);
      prevMonthTreats = prevMonthTreats.filter((t: any) => t.practitioner_id === scoped);
      todayAppts = todayAppts.filter((a: any) => a.practitioner_id === scoped);
      unpaidDeposits = unpaidDeposits.filter((a: any) => a.practitioner_id === scoped);
    }

    const active = all.filter((p: { status: string }) => p.status === "active").length;
    const inactive = all.filter((p: { status: string }) => p.status !== "active").length;

    const { data: yearTreatments } = await supabase
      .from("treatments")
      .select("patient_id, performed_at")
      .gte("performed_at", new Date(today.getTime() - 730 * 86400000).toISOString());
    const seen = new Map<string, number>();
    const seenPrev = new Map<string, number>();
    const yearAgoMs = new Date(yearAgo).getTime();
    const twoYearsAgoMs = today.getTime() - 730 * 86400000;
    for (const t of yearTreatments ?? []) {
      const ms = new Date(t.performed_at).getTime();
      if (ms >= yearAgoMs) seen.set(t.patient_id, (seen.get(t.patient_id) ?? 0) + 1);
      else if (ms >= twoYearsAgoMs) seenPrev.set(t.patient_id, (seenPrev.get(t.patient_id) ?? 0) + 1);
    }
    const returning = [...seen.values()].filter((n) => n > 1).length;
    const retention = seen.size ? Math.round((returning / seen.size) * 100) : 0;
    const returningPrev = [...seenPrev.values()].filter((n) => n > 1).length;
    const retentionPrev = seenPrev.size ? Math.round((returningPrev / seenPrev.size) * 100) : 0;
    const oneVisitClients = seen.size - returning;

    const todayISO = clinicDayKey(today);
    const treatmentsOverdue = dueDates.filter((t) => t.next_due_at < todayISO).length;
    const treatmentsDueSoon = dueDates.filter((t) => t.next_due_at >= todayISO).length;

    const revenue = monthTreats.reduce((sum: number, t: { price: number | null }) => sum + Number(t.price ?? 0), 0);
    const prevRevenue = prevMonthTreats.reduce((sum: number, t: { price: number | null }) => sum + Number(t.price ?? 0), 0);
    const revenueChange = prevRevenue ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : 0;

    const newPatientsThisMonth = all.filter((p: any) => new Date(p.created_at) >= new Date(monthStart)).length;
    const newPatientsPrevMonth = (prevMonthPatients.data ?? []).length;
    const patientChange = newPatientsPrevMonth ? Math.round(((newPatientsThisMonth - newPatientsPrevMonth) / newPatientsPrevMonth) * 100) : 0;

    const pendingConsents = (pendingDocs.data ?? []).filter((d: { kind: string }) => d.kind === "consent").length;

    const attentionItems: any[] = [];

    for (const a of todayAppts) {
      const stage = a.stage ?? (a.status === "no_show" ? "no_show" : a.status === "attended" ? "complete" : "booked");
      if (stage === "no_show") {
        attentionItems.push({
          id: `no-show-${a.id}`,
          kind: "no_show",
          urgency: "urgent",
          title: `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""} — no show`,
          subtitle: `${a.treatment_name} · ${new Date(a.starts_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`,
          patientId: a.patient_id,
          appointmentId: a.id,
        });
      }
      const docStatus = a.documents?.status;
      const consentSigned = docStatus === "signed";
      if (!consentSigned) {
        attentionItems.push({
          id: `consent-${a.id}`,
          kind: "consent_due",
          urgency: "urgent",
          title: `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""} — consent due`,
          subtitle: `${a.treatment_name}`,
          patientId: a.patient_id,
          appointmentId: a.id,
        });
      }
      // Balance after deposit — still chase on the day.
      if (a.payment_status === "deposit_paid") {
        attentionItems.push({
          id: `payment-${a.id}`,
          kind: "balance_due",
          urgency: "urgent",
          title: `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""} — balance due`,
          subtitle: `${a.treatment_name}`,
          patientId: a.patient_id,
          appointmentId: a.id,
        });
      }
    }

    // Deposits must be paid at least 3 clinic days before the appointment.
    // Inside that window (≤3 days) → urgent chase; further out → this week.
    const DEPOSIT_LEAD_DAYS = 3;
    for (const a of unpaidDeposits) {
      const apptDay = clinicDayKey(new Date(a.starts_at));
      const daysUntil = clinicDayDiff(todayISO, apptDay);
      if (daysUntil < 0) continue;
      const who = `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""}`.trim() || "Patient";
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

    for (const t of due.filter((x: any) => x.next_due_at && x.next_due_at <= weekAhead)) {
      attentionItems.push({
        id: `due-${t.id}`,
        kind: "treatment_due",
        urgency: "this_week",
        title: `${t.patients?.first_name ?? ""} ${t.patients?.last_name ?? ""} — ${t.name}`,
        subtitle: `Due ${new Date(t.next_due_at).toLocaleDateString("en-GB")}`,
        patientId: t.patient_id,
      });
    }

    for (const m of unreadMessages.data ?? []) {
      attentionItems.push({
        id: `msg-${m.id}`,
        kind: "message",
        urgency: "this_week",
        title: `${m.patients?.first_name ?? ""} ${m.patients?.last_name ?? ""} — new message`,
        subtitle: m.body.slice(0, 60) + (m.body.length > 60 ? "…" : ""),
        patientId: m.patient_id,
      });
    }

    // ---- Journeys: active plans grouped by phase (dashboard bottom section).
    let plans = (plansRaw.data ?? []) as any[];
    if (scoped) plans = plans.filter((p) => !p.practitioner_id || p.practitioner_id === scoped);
    const milestoneAgg = new Map<string, { done: number; total: number }>();
    for (const m of (milestonesRaw.data ?? []) as any[]) {
      const agg = milestoneAgg.get(m.plan_id) ?? { done: 0, total: 0 };
      agg.total += 1;
      if (m.status === "done" || m.status === "skipped") agg.done += 1;
      milestoneAgg.set(m.plan_id, agg);
    }
    const journeyPhases = (["consult", "foundation", "build", "results"] as const).map((phase) => {
      const inPhase = plans.filter((p) => p.phase === phase);
      return {
        phase,
        count: inPhase.length,
        plans: inPhase.slice(0, 4).map((p) => {
          const agg = milestoneAgg.get(p.id) ?? { done: 0, total: p.total_sessions };
          return {
            id: p.id,
            patientId: p.patient_id,
            patientName: `${p.patients?.first_name ?? ""} ${p.patients?.last_name ?? ""}`.trim(),
            avatarUrl: p.patients?.avatar_url ?? null,
            name: p.name,
            done: agg.done,
            total: agg.total || p.total_sessions,
          };
        }),
      };
    });
    const todayKeyForPlans = clinicDayKey(today);
    const overduePlanIds = new Set<string>();
    for (const m of ((milestonesRaw.data ?? []) as any[])) {
      if ((m.status === "current" || m.status === "upcoming") && m.due_date && m.due_date < todayKeyForPlans) {
        overduePlanIds.add(m.plan_id);
      }
    }
    const journeys = {
      activeCount: plans.length,
      overdueCount: plans.filter((p) => overduePlanIds.has(p.id)).length,
      phases: journeyPhases,
    };

    // Give each diary card its patient's active plan, so cards can say
    // "Session 2 of 3" instead of a bare treatment number.
    const planByPatient = new Map<string, { name: string; totalSessions: number }>();
    for (const p of plans) {
      if (!planByPatient.has(p.patient_id)) {
        planByPatient.set(p.patient_id, { name: p.name, totalSessions: p.total_sessions });
      }
    }
    todayAppts = todayAppts.map((a: any) => ({ ...a, plan: planByPatient.get(a.patient_id) ?? null }));

    // ---- Safe to proceed: today/tomorrow bookings with pre-visit blockers.
    let horizon = (horizonApptsRaw.data ?? []) as any[];
    if (scoped) horizon = horizon.filter((a) => a.practitioner_id === scoped);
    const safeToProceed: any[] = [];
    for (const a of horizon) {
      const blockers: string[] = [];
      if (a.documents?.status !== "signed") blockers.push("Consent not signed");
      if (a.payment_status === "unpaid") blockers.push("Deposit unpaid");
      else if (a.payment_status === "deposit_paid") blockers.push("Balance due");
      const allergies = (a.patients?.allergies ?? "").trim();
      if (allergies && allergies.toLowerCase() !== "none") blockers.push(`Allergy: ${allergies.slice(0, 60)}`);
      if (blockers.length === 0) continue;
      safeToProceed.push({
        id: a.id,
        patientId: a.patient_id,
        patientName: `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""}`.trim() || "Patient",
        avatarUrl: a.patients?.avatar_url ?? null,
        treatment: a.treatment_name,
        startsAt: a.starts_at,
        blockers,
      });
      if (safeToProceed.length >= 8) break;
    }
    const safeReadyCount = horizon.length - safeToProceed.length;

    return {
      kpis: {
        totalClients: all.length,
        activeClients: active,
        inactiveClients: inactive,
        retention,
        retentionChange: retentionPrev ? retention - retentionPrev : 0,
        repeatClients: returning,
        oneVisitClients,
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
      pendingDocuments: pendingDocs.data ?? [],
      historyFlags: historyFlags.data ?? [],
      role: {
        isManager,
        isPractitioner,
        isFrontDesk,
      },
    };
  });

export const listPatients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorize(context as Ctx, "listPatients");
    const supabase = (context as Ctx).supabase;
    const { data, error } = await supabase
      .from("patients")
      .select("id, first_name, last_name, title, date_of_birth, status, reference, last_visit_at, allergies, avatar_url")
      // Archived records stay in the database for the retention window but drop
      // out of every clinical view; getPatient still resolves them by id.
      .is("deleted_at", null)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((p: { id: string }) => p.id);
    if (ids.length === 0) return [];

    const [{ data: treatments }, { data: docs }, { data: upcoming }, { data: openRecalls }, { data: staffProfiles }] =
      await Promise.all([
        supabase
          .from("treatments")
          .select("patient_id, name, performed_at, next_due_at, practitioner_id")
          .in("patient_id", ids),
        supabase.from("documents").select("patient_id, status").in("patient_id", ids),
        supabase
          .from("appointments")
          .select("patient_id, treatment_name, treatment_number, starts_at, status, practitioner_id")
          .in("patient_id", ids)
          .gte("starts_at", new Date().toISOString())
          .in("status", ["booked"])
          .order("starts_at", { ascending: true }),
        supabase
          .from("recall_tasks")
          .select("id, patient_id, note, status")
          .in("patient_id", ids)
          .in("status", ["open", "contacted"]),
        supabase.from("profiles").select("id, full_name"),
      ]);

    const nameOf = new Map((staffProfiles ?? []).map((s: any) => [s.id, s.full_name as string]));
    const todayKey = clinicDayKey(new Date());

    return (data ?? []).map((p: Record<string, unknown>) => {
      const mine = (treatments ?? []).filter((t: { patient_id: string }) => t.patient_id === p["id"]);
      const last = mine.sort((a: any, b: any) => (a.performed_at < b.performed_at ? 1 : -1))[0];
      const due = mine
        .filter((t: any) => t.next_due_at)
        .sort((a: any, b: any) => (a.next_due_at > b.next_due_at ? 1 : -1))[0];
      const outstanding = (docs ?? []).filter(
        (d: any) => d.patient_id === p["id"] && (d.status === "sent" || d.status === "viewed"),
      ).length;
      const next = (upcoming ?? []).find((a: any) => a.patient_id === p["id"]);

      // Active practitioner(s): whoever holds the next booking, then whoever
      // treated them most recently. Unique, in that order.
      const practitionerIds: string[] = [];
      if (next?.practitioner_id) practitionerIds.push(next.practitioner_id);
      for (const t of mine) {
        if (t.practitioner_id && !practitionerIds.includes(t.practitioner_id)) practitionerIds.push(t.practitioner_id);
      }
      const practitioners = practitionerIds.map((pid) => nameOf.get(pid)).filter(Boolean) as string[];

      // Open items: assigned recall tasks plus derived chase items.
      const openTasks: { id: string; label: string; kind: string }[] = (openRecalls ?? [])
        .filter((t: any) => t.patient_id === p["id"])
        .map((t: any) => ({
          id: t.id,
          label: t.note?.trim() ? t.note.trim().slice(0, 80) : "Follow up and rebook",
          kind: t.status === "contacted" ? "recall_contacted" : "recall",
        }));
      if (outstanding > 0) {
        openTasks.push({
          id: `docs-${p["id"]}`,
          label: `${outstanding} form${outstanding === 1 ? "" : "s"} awaiting signature`,
          kind: "paperwork",
        });
      }
      if (due?.next_due_at && due.next_due_at < todayKey) {
        openTasks.push({ id: `due-${p["id"]}`, label: `${due.name} overdue`, kind: "treatment_due" });
      }

      return {
        ...p,
        lastTreatment: last ?? null,
        nextDue: due ?? null,
        nextAppointment: next ?? null,
        outstandingDocuments: outstanding,
        practitioners,
        openTasks,
      };
    });
  });

export const getPatientMetrics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorize(context as Ctx, "getPatientMetrics");
    const supabase = (context as Ctx).supabase;
    const now = new Date();
    const yearAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [{ data: patients }, { data: treatments }] = await Promise.all([
      supabase.from("patients").select("id, status, created_at").is("deleted_at", null),
      supabase.from("treatments").select("patient_id, name, performed_at, next_due_at"),
    ]);
    const all = patients ?? [];
    const tx = (treatments ?? []) as any[];

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const active = all.filter((p: any) => p.status === "active").length;
    const newThisMonth = all.filter((p: any) => p.created_at >= monthStart).length;

    // New patients per month, last 12 months.
    const monthlyNew: { key: string; label: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      monthlyNew.push({
        key: d.toISOString().slice(0, 7),
        label: d.toLocaleDateString("en-GB", { month: "short" }),
        count: all.filter((p: any) => p.created_at >= d.toISOString() && p.created_at < next.toISOString()).length,
      });
    }

    // Top treatments by volume over the last 12 months.
    const counts = new Map<string, number>();
    for (const t of tx) {
      if (t.performed_at >= yearAgo.toISOString()) counts.set(t.name, (counts.get(t.name) ?? 0) + 1);
    }
    const topTreatments = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Treatments falling due, next six months, plus the overdue backlog.
    const todayKey = clinicDayKey(now);
    const dueByMonth: { key: string; label: string; due: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
      dueByMonth.push({
        key: d.toISOString().slice(0, 7),
        label: d.toLocaleDateString("en-GB", { month: "short" }),
        due: tx.filter(
          (t) =>
            t.next_due_at &&
            t.next_due_at >= d.toISOString().slice(0, 10) &&
            t.next_due_at < next.toISOString().slice(0, 10) &&
            t.next_due_at >= todayKey,
        ).length,
      });
    }
    const overdue = tx.filter((t) => t.next_due_at && t.next_due_at < todayKey).length;

    return {
      totals: { total: all.length, active, inactive: all.length - active, newThisMonth },
      monthlyNew,
      topTreatments,
      dueByMonth,
      overdue,
    };
  });

export const getPatient = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => parseInput(schemas.GetPatient, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    // Returns the full clinical record for whatever ID it is handed, so without
    // this any authenticated user could read any patient by ID.
    await authorize(context as Ctx, "getPatient", { patientId: data.id });
    const supabase = (context as Ctx).supabase;
    const { data: patient, error } = await supabase
      .from("patients")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!patient) throw new Error("Patient not found");

    const [treatments, photos, documents, messages, history, upcoming, visitAppts, bookingAppts] = await Promise.all([
      supabase
        .from("treatments")
        .select("*, profiles(full_name)")
        .eq("patient_id", data.id)
        .order("performed_at", { ascending: false }),
      supabase
        .from("treatment_photos")
        .select("*")
        .eq("patient_id", data.id)
        .order("taken_at", { ascending: true }),
      supabase
        .from("documents")
        .select("*")
        .eq("patient_id", data.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("messages")
        .select("*")
        .eq("patient_id", data.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("medical_history_versions")
        .select("*")
        .eq("patient_id", data.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("starts_at, status")
        .eq("patient_id", data.id)
        .gte("starts_at", new Date().toISOString())
        .not("status", "in", "(cancelled,no_show)")
        .limit(1),
      supabase
        .from("appointments")
        .select(
          "id, starts_at, ends_at, status, treatment_name, treatment_number, notes, profiles(full_name), appointment_notes(body, updated_at, updated_by_label)",
        )
        .eq("patient_id", data.id)
        .order("starts_at", { ascending: false }),
      supabase
        .from("appointments")
        .select(
          "id, starts_at, treatment_name, status, payment_status, profiles(full_name), documents(status, title)",
        )
        .eq("patient_id", data.id)
        .gte("starts_at", new Date().toISOString())
        .not("status", "in", "(cancelled,no_show)")
        .order("starts_at", { ascending: true }),
    ]);

    const signed: Record<string, string> = {};
    for (const photo of photos.data ?? []) {
      const { data: url } = await supabase.storage
        .from("patient-photos")
        .createSignedUrl(photo.storage_path, 3600);
      if (url?.signedUrl) signed[photo.id] = url.signedUrl;
    }

    await audit(context as Ctx, "view", "patient", data.id, data.id);

    const { patientRetention } = await import("./retention.server");
    const retention = patientRetention(
      (treatments.data ?? []).map((t: any) => ({ performed_at: t.performed_at, next_due_at: t.next_due_at })),
      (upcoming.data ?? []).length > 0,
    );

    const visitNotes = (visitAppts.data ?? [])
      .map((a: any) => {
        const embedded = a.appointment_notes;
        const noteRow = Array.isArray(embedded) ? embedded[0] : embedded;
        const fromTable = plainVisitNote(noteRow?.body);
        const booking = plainVisitNote(
          String(a.notes ?? "").replace(/^Cancelled:[^\n]*(?:\n\n)?/, ""),
        );
        const body = fromTable || booking;
        if (!body) return null;
        return {
          appointmentId: a.id as string,
          treatmentName: (a.treatment_name as string) || "Treatment",
          treatmentNumber: a.treatment_number ?? null,
          startsAt: a.starts_at as string,
          status: a.status as string,
          practitionerName: (a.profiles?.full_name as string) ?? null,
          body,
          updatedAt: (noteRow?.updated_at as string) ?? null,
          updatedBy: (noteRow?.updated_by_label as string) ?? null,
        };
      })
      .filter(Boolean);

    const bookingChase = (bookingAppts.data ?? [])
      .map((a: any) => {
        const docStatus = a.documents?.status;
        const issues: string[] = [];
        if (a.payment_status === "unpaid") issues.push("Deposit unpaid");
        if (a.payment_status === "deposit_paid") issues.push("Balance due");
        if (docStatus !== "signed") issues.push("Consent due");
        return {
          id: a.id as string,
          startsAt: a.starts_at as string,
          treatmentName: (a.treatment_name as string) || "Treatment",
          practitionerName: (a.profiles?.full_name as string) ?? null,
          paymentStatus: (a.payment_status as string) ?? "unpaid",
          consentSigned: docStatus === "signed",
          issues,
        };
      })
      .filter((b) => b.issues.length > 0);

    return {
      patient,
      treatments: treatments.data ?? [],
      photos: (photos.data ?? []).map((p: any) => ({ ...p, url: signed[p.id] ?? null })),
      documents: documents.data ?? [],
      messages: messages.data ?? [],
      history: history.data ?? [],
      visitNotes,
      bookingChase,
      retention,
      nextAppointmentAt: (upcoming.data ?? [])[0]?.starts_at ?? null,
    };
  });

export const getCatalogue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorize(context as Ctx, "getCatalogue");
    const { data } = await (context as Ctx).supabase
      .from("treatment_catalogue")
      .select("*")
      .eq("active", true)
      .order("category", { ascending: true });
    return data ?? [];
  });

export const listPractitioners = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorize(context as Ctx, "listPractitioners");
    const ctx = context as Ctx;
    const { data: roles } = await ctx.supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "practitioner");
    const ids = (roles ?? []).map((r: { user_id: string }) => r.user_id);
    if (ids.length === 0) return [];
    const { data } = await ctx.supabase
      .from("profiles")
      .select("id, full_name, job_title")
      .in("id", ids)
      .order("full_name", { ascending: true });
    return data ?? [];
  });

export const listAppointments = createServerFn({ method: "GET" })
  .validator((data: { from: string; to: string }) => parseInput(schemas.ListAppointments, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "listAppointments");
    const { data: rows, error } = await (context as Ctx).supabase
      .from("appointments")
      .select(
        "*, patients(first_name, last_name, reference, email, phone), profiles(full_name), documents(status, title), appointment_notes(body, updated_at, updated_by_label)",
      )
      .gte("starts_at", data.from)
      .lt("starts_at", data.to)
      .order("starts_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

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

/**
 * Queue one message on every channel the patient can receive, returning the
 * channels actually queued. Refusals are per-channel — a PECR opt-out on one
 * must not stop the other — and none of them may fail the clinical write that
 * triggered the send.
 */
async function enqueueOnChannels(
  ctx: Ctx,
  opts: {
    patientId: string;
    purpose: "transactional" | "reminder" | "marketing";
    subject: string | null;
    body: string;
    templateKey: string;
    relatedEntity?: string | null;
    relatedId?: string | null;
    scheduledFor?: string | null;
    patient?: { email?: string | null; phone?: string | null } | null;
  },
): Promise<("email" | "sms")[]> {
  const queued: ("email" | "sms")[] = [];
  try {
    const { enqueueCommunication: enqueue } = await import("./comms/enqueue.server");
    const { channelsFor } = await import("./comms/templates");
    let patient = opts.patient;
    if (!patient) {
      const { data } = await ctx.supabase
        .from("patients")
        .select("email, phone")
        .eq("id", opts.patientId)
        .maybeSingle();
      patient = (data as { email?: string | null; phone?: string | null } | null) ?? {};
    }
    for (const channel of channelsFor(patient ?? {}, opts.purpose)) {
      try {
        await enqueue(ctx.supabase, {
          clinicId: clinicIdOf(ctx),
          patientId: opts.patientId,
          channel,
          purpose: opts.purpose,
          subject: channel === "email" ? opts.subject : null,
          body: opts.body,
          templateKey: opts.templateKey,
          scheduledFor: opts.scheduledFor ?? null,
          relatedEntity: opts.relatedEntity ?? null,
          relatedId: opts.relatedId ?? null,
          createdBy: ctx.userId,
        });
        queued.push(channel);
      } catch (err) {
        console.error(
          `[comms] ${opts.templateKey} ${channel} not queued:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  } catch (err) {
    console.error("[comms] enqueue unavailable:", err instanceof Error ? err.message : err);
  }
  return queued;
}

/**
 * Tell the patient their appointment moved: portal message plus a real
 * transactional send. Shared by the booking-dialog update path and the
 * drag-to-reschedule handler.
 */
async function notifyBookingChange(
  ctx: Ctx,
  opts: {
    appointmentId: string;
    patientId: string;
    treatmentName: string;
    treatmentNumber?: number | string | null;
    startsAt: string;
    practitionerId?: string | null;
  },
): Promise<("email" | "sms")[]> {
  const [{ data: patient }, { data: practitioner }] = await Promise.all([
    ctx.supabase
      .from("patients")
      .select("first_name, email, phone")
      .eq("id", opts.patientId)
      .maybeSingle(),
    opts.practitionerId
      ? ctx.supabase.from("profiles").select("full_name").eq("id", opts.practitionerId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const { bookingUpdatedMessage } = await import("./comms/templates");
  const body = bookingUpdatedMessage({
    name: `${patient?.first_name ?? ""}`.trim() || "there",
    treatment: opts.treatmentName,
    treatmentNumber: opts.treatmentNumber ?? null,
    when: formatWhenLondon(new Date(opts.startsAt)),
    practitioner: (practitioner?.full_name as string) ?? null,
  });
  await ctx.supabase.from("messages").insert({
    clinic_id: clinicIdOf(ctx),
    patient_id: opts.patientId,
    author: "staff",
    author_id: ctx.userId,
    body,
  });
  return enqueueOnChannels(ctx, {
    patientId: opts.patientId,
    purpose: "transactional",
    subject: "Your appointment has been rescheduled",
    body,
    templateKey: "booking_update",
    relatedEntity: "appointments",
    relatedId: opts.appointmentId,
    patient: { email: patient?.email as string | null, phone: patient?.phone as string | null },
  });
}

/**
 * Cancel queued (never-sent) outbox rows tied to an entity — reminders
 * superseded by a reschedule or a cancellation. Cancelled rows stay in the
 * log, so the trail shows what would have gone out and why it did not.
 */
async function cancelPendingCommunications(ctx: Ctx, relatedId: string, purpose?: "reminder") {
  let query = ctx.supabase
    .from("communications")
    .update({ status: "cancelled" })
    .eq("related_id", relatedId)
    .eq("status", "queued");
  if (purpose) query = query.eq("purpose", purpose);
  const { error } = await query;
  if (error) console.error("[comms] could not cancel pending sends:", error.message);
}

/**
 * Queue the clinic's scheduled reminders for one appointment. Offsets are
 * clinic policy (clinics.reminder_offsets, hours before the visit); the
 * Phase 8 drain sends each row when its scheduled_for arrives, so no extra
 * scheduler exists. Failures never block the booking itself.
 */
async function queueAppointmentReminders(
  ctx: Ctx,
  opts: {
    appointmentId: string;
    patientId: string;
    treatmentName: string;
    startsAt: string;
    practitionerId?: string | null;
  },
) {
  try {
    const { appointmentReminderMessage, reminderTimes } = await import("./comms/templates");
    const [{ data: clinic }, { data: patient }, { data: practitioner }] = await Promise.all([
      ctx.supabase
        .from("clinics")
        .select("reminder_offsets")
        .eq("id", clinicIdOf(ctx))
        .maybeSingle(),
      ctx.supabase
        .from("patients")
        .select("first_name, email, phone")
        .eq("id", opts.patientId)
        .maybeSingle(),
      opts.practitionerId
        ? ctx.supabase.from("profiles").select("full_name").eq("id", opts.practitionerId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const offsets = (clinic?.reminder_offsets as number[] | null) ?? [168, 24];
    const body = appointmentReminderMessage({
      name: `${patient?.first_name ?? ""}`.trim() || "there",
      treatment: opts.treatmentName,
      when: formatWhenLondon(new Date(opts.startsAt)),
      practitioner: (practitioner?.full_name as string) ?? null,
    });
    for (const scheduledFor of reminderTimes(opts.startsAt, offsets)) {
      await enqueueOnChannels(ctx, {
        patientId: opts.patientId,
        purpose: "reminder",
        subject: "Appointment reminder",
        body,
        templateKey: "appointment_reminder",
        scheduledFor,
        relatedEntity: "appointments",
        relatedId: opts.appointmentId,
        patient: {
          email: (patient?.email as string) ?? null,
          phone: (patient?.phone as string) ?? null,
        },
      });
    }
  } catch (err) {
    console.error("[comms] reminders not queued:", err instanceof Error ? err.message : err);
  }
}

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
      /** Browser origin so payment links in email/SMS are absolute. */
      app_origin?: string;
      /** Pay-link amount when status is unpaid (defaults to full). */
      pay_kind?: PaymentLinkKind;
    }) => parseInput(schemas.SaveAppointment, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "saveAppointment");
    const supabase = (context as Ctx).supabase;
    const start = new Date(data.starts_at);
    const endsAt = new Date(start.getTime() + (data.duration_minutes || 30) * 60000).toISOString();
    const payload = {
      clinic_id: clinicIdOf(context),
      patient_id: data.patient_id,
      practitioner_id: data.practitioner_id || context.userId,
      catalogue_id: data.catalogue_id || null,
      treatment_name: data.treatment_name,
      treatment_number: data.treatment_number,
      starts_at: start.toISOString(),
      ends_at: endsAt,
      price: data.price ?? null,
      payment_status: (data.payment_status as "unpaid" | "deposit_paid" | "paid" | "refunded") ?? "unpaid",
      consent_document_id: data.consent_document_id || null,
      notes: data.notes || null,
      created_by: context.userId,
    };
    await assertNoPractitionerOverlap(supabase, {
      practitionerId: payload.practitioner_id,
      startsAt: payload.starts_at,
      endsAt: payload.ends_at,
      excludeAppointmentId: data.id ?? null,
    });
    if (data.id) {
      const { data: before } = await supabase
        .from("appointments")
        .select("starts_at")
        .eq("id", data.id)
        .maybeSingle();
      const { error } = await supabase.from("appointments").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await audit(context as Ctx, "update", "appointment", data.id, data.patient_id);
      const noteBody = String(data.notes ?? "");
      if (noteBody.trim()) {
        const { data: me } = await supabase.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
        await supabase.from("appointment_notes").upsert(
          {
            appointment_id: data.id,
            clinic_id: clinicIdOf(context),
            patient_id: data.patient_id,
            body: noteBody,
            updated_by: context.userId,
            updated_by_label: (me?.full_name as string) ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "appointment_id" },
        );
      }
      // A silent edit is fine for price or notes; a moved time is not.
      const timeChanged =
        before?.starts_at && new Date(before.starts_at as string).getTime() !== start.getTime();
      if (timeChanged) {
        await notifyBookingChange(context as Ctx, {
          appointmentId: data.id,
          patientId: data.patient_id,
          treatmentName: data.treatment_name,
          treatmentNumber: data.treatment_number,
          startsAt: payload.starts_at,
          practitionerId: payload.practitioner_id,
        });
        // Reminders for the old time are stale; requeue for the new one.
        await cancelPendingCommunications(context as Ctx, data.id, "reminder");
        await queueAppointmentReminders(context as Ctx, {
          appointmentId: data.id,
          patientId: data.patient_id,
          treatmentName: data.treatment_name,
          startsAt: payload.starts_at,
          practitionerId: payload.practitioner_id,
        });
      }
      return { id: data.id, notified: Boolean(timeChanged) };
    }
    const { data: created, error } = await supabase
      .from("appointments")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(context as Ctx, "create", "appointment", created.id, data.patient_id);

    const noteBody = String(data.notes ?? "");
    if (noteBody.trim()) {
      const { data: me } = await supabase.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
      await supabase.from("appointment_notes").upsert(
        {
          appointment_id: created.id,
          clinic_id: clinicIdOf(context),
          patient_id: data.patient_id,
          body: noteBody,
          updated_by: context.userId,
          updated_by_label: (me?.full_name as string) ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "appointment_id" },
      );
    }

    // Confirmation + payment link, written to the patient's portal thread.
    const [{ data: patient }, { data: practitioner }] = await Promise.all([
      supabase.from("patients").select("first_name, last_name, email, phone").eq("id", data.patient_id).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", payload.practitioner_id).maybeSingle(),
    ]);
    const when = formatWhenLondon(start);
    const patientName = `${patient?.first_name ?? ""}`.trim() || "there";
    const payKind: PaymentLinkKind =
      payload.payment_status === "deposit_paid"
        ? "balance"
        : data.pay_kind === "deposit"
          ? "deposit"
          : "full";
    const confirmation = bookingDetailsMessage({
      name: patientName,
      treatment: data.treatment_name,
      treatmentNumber: data.treatment_number,
      when,
      practitioner: (practitioner?.full_name as string) ?? null,
      appointmentId: created.id,
      price: Number(data.price ?? 0),
      paymentStatus: payload.payment_status,
      payKind,
      origin: data.app_origin,
    });

    // Portal copy of the confirmation, then the real send through the outbox.
    await supabase.from("messages").insert({
      clinic_id: clinicIdOf(context),
      patient_id: data.patient_id,
      author: "staff",
      author_id: context.userId,
      body: confirmation,
    });
    const queuedChannels = await enqueueOnChannels(context as Ctx, {
      patientId: data.patient_id,
      purpose: "transactional",
      subject: `Booking confirmed — ${data.treatment_name} on ${when}`,
      body: confirmation,
      templateKey: "booking_confirmation",
      relatedEntity: "appointments",
      relatedId: created.id as string,
      patient: {
        email: (patient?.email as string) ?? null,
        phone: (patient?.phone as string) ?? null,
      },
    });
    await queueAppointmentReminders(context as Ctx, {
      appointmentId: created.id as string,
      patientId: data.patient_id,
      treatmentName: data.treatment_name,
      startsAt: payload.starts_at,
      practitionerId: payload.practitioner_id,
    });

    // Notify the booked practitioner and clinic managers only.
    {
      const { data: managers } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["owner", "manager"]);
      const recipients = [
        ...new Set(
          [
            payload.practitioner_id,
            ...((managers ?? []) as { user_id: string }[]).map((r) => r.user_id),
          ].filter(Boolean) as string[],
        ),
      ];
      if (recipients.length > 0) {
        const body = `${`${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`.trim() || "Patient"} — ${data.treatment_name} on ${when}`;
        await supabase.from("staff_notifications").insert(
          recipients.map((recipient_id) => ({
            clinic_id: clinicIdOf(context),
            recipient_id,
            kind: "appointment",
            title: "New booking",
            body,
            patient_id: data.patient_id,
            appointment_id: created.id,
          })),
        );
      }
    }

    await audit(context as Ctx, "notify", "appointment", created.id, data.patient_id, {
      channels: {
        portal: true,
        email: queuedChannels.includes("email"),
        sms: queuedChannels.includes("sms"),
      },
      payment_link: payload.payment_status !== "paid",
    });

    return {
      id: created.id as string,
      confirmation,
      email: (patient?.email as string) ?? null,
      phone: (patient?.phone as string) ?? null,
      queued: queuedChannels,
    };
  });

export const updateAppointmentState = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      status?: "booked" | "attended" | "cancelled" | "no_show";
      payment_status?: "unpaid" | "deposit_paid" | "paid" | "refunded";
      stage?: "booked" | "arrived" | "waiting" | "in_treatment" | "aftercare" | "complete" | "no_show";
      cancel_reason?: string;
    }) => parseInput(schemas.UpdateAppointmentState, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "updateAppointmentState");
    const supabase = (context as Ctx).supabase;
    const patch: Record<string, unknown> = {};
    if (data.status) patch["status"] = data.status;
    if (data.payment_status) patch["payment_status"] = data.payment_status;
    if (data.stage) {
      patch["stage"] = data.stage;
      if (data.stage === "no_show") patch["status"] = "no_show";
      else if (data.stage === "booked") patch["status"] = "booked";
      else patch["status"] = "attended";
    }
    const reason = String(data.cancel_reason ?? "").trim().slice(0, 2000);
    if (data.status === "cancelled" && reason) {
      const { data: existing } = await supabase
        .from("appointments")
        .select("notes")
        .eq("id", data.id)
        .maybeSingle();
      const prior = String((existing as { notes?: string | null } | null)?.notes ?? "").trim();
      const stamp = `Cancelled: ${reason}`;
      patch["notes"] = prior ? `${stamp}\n\n${prior}` : stamp;
    }
    const { error } = await supabase.from("appointments").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    // A cancelled appointment must not remind anyone it is coming up.
    if (patch["status"] === "cancelled") {
      await cancelPendingCommunications(context as Ctx, data.id, "reminder");
    }
    await audit(context as Ctx, "update", "appointment", data.id, null, {
      ...patch,
      ...(reason ? { cancel_reason: reason } : {}),
    });
    return { ok: true };
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const identity = await authorize(context as Ctx, "savePatient");
    const supabase = (context as Ctx).supabase;
    const payload = {
      clinic_id: clinicIdOf(context),
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      title: data.title?.trim() || null,
      email: assertEmail(data.email ?? "", "email address", true),
      phone: data.phone?.trim() || null,
      date_of_birth: data.date_of_birth || null,
      status: (data.status as "active" | "inactive" | "archived") ?? "active",
      allergies: data.allergies ?? null,
      medications: data.medications ?? null,
      conditions: data.conditions ?? null,
      notes: data.notes ?? null,
    };
    if (data.id) {
      // Practitioners and front desk may keep clinical notes current, but the
      // patient's identity record and status are manager-only changes.
      const { data: ownerRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", (context as Ctx).userId)
        .eq("role", "owner")
        .maybeSingle();
      const patch = ownerRow
        ? payload
        : (({ first_name, last_name, date_of_birth, status, ...rest }) => rest)(payload);
      const { error } = await supabase.from("patients").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      await audit(context as Ctx, "update", "patient", data.id, data.id);
      return { id: data.id };
    }
    const { data: created, error } = await supabase
      .from("patients")
      .insert({ ...payload, reference: `AV-${Math.floor(1000 + Math.random() * 8999)}` })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(context as Ctx, "create", "patient", created.id, created.id);
    return { id: created.id as string };
  });

/**
 * Archive or restore a patient record.
 *
 * Deleting one is not possible from any route: a BEFORE DELETE trigger refuses
 * it, and the record has to be kept for 8 years after the last treatment under
 * the NHS retention standard. Erasure, when it is genuinely lawful, runs through
 * the `erase_patient` database function — deliberately not one click away.
 */
export const archivePatient = createServerFn({ method: "POST" })
  .validator((data: { id: string; archived: boolean; reason?: string }) =>
    parseInput(schemas.ArchivePatient, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const identity = await authorize(context as Ctx, "archivePatient");
    await requireStepUp(context as Ctx);
    const supabase = (context as Ctx).supabase;

    const patch = data.archived
      ? {
          deleted_at: new Date().toISOString(),
          deleted_by: identity.userId,
          deletion_reason: data.reason?.trim() || null,
          status: "archived",
        }
      : { deleted_at: null, deleted_by: null, deletion_reason: null, status: "active" };

    const { error } = await supabase.from("patients").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(
      context as Ctx,
      data.archived ? "archive" : "restore",
      "patient",
      data.id,
      data.id,
      data.reason ? { reason: data.reason } : undefined,
    );
    return { id: data.id, archived: data.archived };
  });

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
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "addTreatment");
    const supabase = (context as Ctx).supabase;
    const supabaseAdmin = await adminClient(context);
    const { data: rateRow } = await supabaseAdmin
      .from("profiles")
      .select("commission_rate")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: created, error } = await supabase
      .from("treatments")
      .insert({
        clinic_id: clinicIdOf(context),
        patient_id: data.patient_id,
        catalogue_id: data.catalogue_id || null,
        practitioner_id: context.userId,
        name: data.name,
        product: data.product || null,
        dose: data.dose || null,
        area: data.area || null,
        notes: data.notes || null,
        price: data.price ?? null,
        performed_at: data.performed_at,
        next_due_at: data.next_due_at || null,
        commission_rate_snapshot: Number(rateRow?.commission_rate ?? 0),
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await supabase
      .from("patients")
      .update({ last_visit_at: data.performed_at, status: "active" })
      .eq("id", data.patient_id);
    await audit(context as Ctx, "create", "treatment", created.id, data.patient_id, { name: data.name });
    return { id: created.id as string };
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
    }) => parseInput(schemas.AddPhoto, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "addPhoto");
    const { error } = await (context as Ctx).supabase.from("treatment_photos").insert({
      clinic_id: clinicIdOf(context),
      patient_id: data.patient_id,
      treatment_id: data.treatment_id || null,
      storage_path: data.storage_path,
      kind: data.kind,
      caption: data.caption || null,
      marketing_consent: data.marketing_consent ?? false,
    });
    if (error) throw new Error(error.message);
    await audit(context as Ctx, "create", "photo", null, data.patient_id, { kind: data.kind });
    return { ok: true };
  });

/** Signing links stop working after this long; a resend issues a fresh window. */
const DOCUMENT_LINK_TTL_DAYS = 14;

function documentLinkExpiry(from = new Date()) {
  return new Date(from.getTime() + DOCUMENT_LINK_TTL_DAYS * 86400000).toISOString();
}

/**
 * Send the public signing link for a document by email (default) or text.
 * Returns whether the send was queued: a patient with no address (or a refused
 * send) must not block the form reaching their portal, so failures are
 * reported, not thrown.
 */
async function enqueueDocumentEmail(
  ctx: Ctx,
  opts: {
    patientId: string;
    documentId: string;
    accessToken: string;
    title: string;
    origin?: string | null | undefined;
    reminder?: boolean;
    channel?: "email" | "sms" | undefined;
  },
): Promise<boolean> {
  const channel = opts.channel ?? "email";
  try {
    const { enqueueCommunication: enqueue } = await import("./comms/enqueue.server");
    const { consentRequestMessage, publicSigningUrl } = await import("./comms/templates");
    const { data: patient } = await ctx.supabase
      .from("patients")
      .select("first_name")
      .eq("id", opts.patientId)
      .maybeSingle();
    const origin = opts.origin?.trim() || process.env["APP_ORIGIN"]?.trim() || "";
    const message = consentRequestMessage({
      name: String(patient?.first_name ?? "there"),
      title: opts.title,
      url: publicSigningUrl(origin, opts.accessToken),
      reminder: opts.reminder ?? false,
    });
    await enqueue(ctx.supabase, {
      clinicId: clinicIdOf(ctx),
      patientId: opts.patientId,
      channel,
      purpose: "transactional",
      subject: channel === "email" ? message.subject : null,
      body: message.body,
      templateKey: "consent_request",
      relatedEntity: "documents",
      relatedId: opts.documentId,
      createdBy: ctx.userId,
    });
    return true;
  } catch (err) {
    console.error(
      `[comms] consent ${channel} not queued:`,
      err instanceof Error ? err.message : err,
    );
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "sendDocument");
    const supabase = (context as Ctx).supabase;
    const { data: created, error } = await supabase
      .from("documents")
      .insert({
        clinic_id: clinicIdOf(context),
        patient_id: data.patient_id,
        treatment_id: data.treatment_id || null,
        kind: data.kind,
        title: data.title,
        body: data.body || null,
        status: "sent",
        sent_at: new Date().toISOString(),
        expires_at: documentLinkExpiry(),
        created_by: context.userId,
      })
      .select("id, access_token")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("messages").insert({
      clinic_id: clinicIdOf(context),
      patient_id: data.patient_id,
      author: "staff",
      author_id: context.userId,
      body: `${data.title} has been sent to you. Please review and sign it in your patient portal.`,
    });
    const emailed = await enqueueDocumentEmail(context as Ctx, {
      patientId: data.patient_id,
      documentId: created.id as string,
      accessToken: created.access_token as string,
      title: data.title,
      origin: data.app_origin,
    });
    await audit(context as Ctx, "send", "document", created.id, data.patient_id, {
      title: data.title,
      emailed,
    });
    return { id: created.id as string, emailed };
  });

export const resendDocument = createServerFn({ method: "POST" })
  .validator(
    (data: { id: string; patient_id: string; app_origin?: string; channel?: "email" | "sms" }) =>
      parseInput(schemas.ResendDocument, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "resendDocument");
    const supabase = (context as Ctx).supabase;
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, title, status, access_token")
      .eq("id", data.id)
      .maybeSingle();
    if (docError) throw new Error(docError.message);
    if (!doc) throw new Error("Document not found");
    if (doc.status === "signed") throw new Error("This form has already been signed");

    const { error } = await supabase
      .from("documents")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        expires_at: documentLinkExpiry(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    // The reminder toast has always claimed a portal message; now there is one.
    await supabase.from("messages").insert({
      clinic_id: clinicIdOf(context),
      patient_id: data.patient_id,
      author: "staff",
      author_id: context.userId,
      body: `Reminder: ${doc.title} is waiting for your signature in your patient portal.`,
    });
    const emailed = await enqueueDocumentEmail(context as Ctx, {
      patientId: data.patient_id,
      documentId: doc.id as string,
      accessToken: doc.access_token as string,
      title: doc.title as string,
      origin: data.app_origin,
      reminder: true,
      channel: data.channel,
    });
    await audit(context as Ctx, "resend", "document", data.id, data.patient_id, {
      emailed,
      channel: data.channel ?? "email",
    });
    return { ok: true, emailed };
  });

/**
 * Deposit chase, balance chase or receipt from the payment chip. The staff
 * member picked the channel, so a PECR refusal or missing address throws and
 * reaches them as the toast — silently downgrading to portal-only is exactly
 * the lie Phase 0 removed. A portal copy is still written on success.
 */
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "sendPaymentRequest");
    const { data: appointment, error: appointmentError } = await ctx.supabase
      .from("appointments")
      .select("id, patient_id, treatment_name, treatment_number, starts_at, price")
      .eq("id", data.appointment_id)
      .maybeSingle();
    if (appointmentError) throw new Error(appointmentError.message);
    if (!appointment || appointment.patient_id !== data.patient_id) {
      throw new Error("Appointment not found for this patient");
    }
    const { data: patient } = await ctx.supabase
      .from("patients")
      .select("first_name")
      .eq("id", data.patient_id)
      .maybeSingle();

    const name = `${patient?.first_name ?? ""}`.trim() || "there";
    const when = new Date(appointment.starts_at as string).toLocaleDateString("en-GB");
    const total = Number(appointment.price ?? 0);
    const depositAmount = Math.round(total * 0.3 * 100) / 100;
    const origin = data.app_origin?.trim() || process.env["APP_ORIGIN"]?.trim() || "";

    let body: string;
    let subject: string;
    if (data.kind === "receipt") {
      body =
        `Hi ${name}, here is your receipt for ${appointment.treatment_name} on ${when}. ` +
        `Amount paid: ${formatMoney(total)}. A copy is also available in your patient ` +
        `portal: ${patientPaymentUrl(appointment.id as string, "full", origin)}`;
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
        treatment: appointment.treatment_name as string,
        treatmentNumber: appointment.treatment_number as number | null,
        when,
        amount,
        kind: data.kind,
        appointmentId: appointment.id as string,
        origin,
      });
      subject = `Payment link — ${appointment.treatment_name}`;
    }

    const { enqueueCommunication: enqueue } = await import("./comms/enqueue.server");
    const { id: communicationId } = await enqueue(ctx.supabase, {
      clinicId: clinicIdOf(context),
      patientId: data.patient_id,
      channel: data.channel,
      purpose: "transactional",
      subject: data.channel === "email" ? subject : null,
      body,
      templateKey: data.kind === "receipt" ? "payment_receipt" : "payment_request",
      relatedEntity: "appointments",
      relatedId: data.appointment_id,
      createdBy: ctx.userId,
    });
    await ctx.supabase.from("messages").insert({
      clinic_id: clinicIdOf(context),
      patient_id: data.patient_id,
      author: "staff",
      author_id: ctx.userId,
      body,
    });
    await audit(ctx, "comms.payment", "communications", communicationId, data.patient_id, {
      kind: data.kind,
      channel: data.channel,
    });
    return { ok: true, communication_id: communicationId };
  });

/**
 * Record a click-to-dial attempt so phone calls appear in the comms trail
 * alongside emails and texts. Inserted as already 'sent': the drain claims
 * only queued rows, so a call can never reach a provider adapter.
 */
export const logCallAttempt = createServerFn({ method: "POST" })
  .validator(
    (data: { patient_id: string; phone?: string }) => parseInput(schemas.LogCallAttempt, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "logCallAttempt");
    const { data: patient } = await ctx.supabase
      .from("patients")
      .select("phone")
      .eq("id", data.patient_id)
      .maybeSingle();
    const to = data.phone?.trim() || String(patient?.phone ?? "").trim();
    if (!to) throw new Error("This patient has no phone number on file");
    const { error } = await ctx.supabase.from("communications").insert({
      clinic_id: clinicIdOf(context),
      patient_id: data.patient_id,
      channel: "call",
      purpose: "transactional",
      to_address: to,
      subject: null,
      body: "Call attempt from the clinic.",
      status: "sent",
      provider: "phone",
      attempts: 1,
      sent_at: new Date().toISOString(),
      created_by: ctx.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* Browser voice calls (demo pool) — see docs/voice-call-setup.md. */

export const getVoiceCallConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorize(context as Ctx, "getVoiceCallConfig");
    return { available: voiceAvailable() };
  });

export const getVoiceCallToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const identity = await authorize(context as Ctx, "getVoiceCallToken");
    if (!voiceAvailable()) throw new Error("Voice calling is not configured");
    return { token: mintVoiceToken(identity.userId ?? "staff"), identity: identity.userId };
  });

export const getVoiceCallTarget = createServerFn({ method: "GET" })
  .validator((data: { patient_id: string }) => parseInput(schemas.GetVoiceCallTarget, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "getVoiceCallTarget");
    // Demo pool: the patient's real number is never dialled.
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    // `data.as` is ignored: taking the author from the request body let a patient
    // post into their own thread as "staff", so the message rendered as clinical
    // advice from the clinic. Staff may write to any thread; a patient may write
    // only to their own.
    const identity = await authorize(ctx, "sendMessage", { patientId: data.patient_id });
    const author = identity.isStaff ? "staff" : "patient";
    const body = data.body.trim().slice(0, 2000);
    const attachments = (data.attachments ?? []).slice(0, 5);
    if (!body && attachments.length === 0) throw new Error("Message cannot be empty");
    const { error } = await ctx.supabase.from("messages").insert({
      clinic_id: clinicIdOf(context),
      patient_id: data.patient_id,
      author,
      author_id: context.userId,
      body: body || (attachments.length === 1 ? "Sent an attachment" : "Sent attachments"),
      attachments,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Unread message counts for the notification bell: per-patient for staff, total for patients. */
export const getUnreadMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const supabase = (context as Ctx).supabase;
    const identity = await authorize(context as Ctx, "getUnreadMessages");

    if (identity.isPatient) {
      if (!identity.patient) return { total: 0, items: [] as { patient_id: string; name: string; count: number; last: string }[] };
      const { data: rows } = await supabase
        .from("messages")
        .select("id, body, created_at")
        .eq("patient_id", identity.patient.id)
        .eq("author", "staff")
        .is("read_at", null)
        .order("created_at", { ascending: false });
      const list = rows ?? [];
      return {
        total: list.length,
        items: list.length
          ? [
              {
                patient_id: identity.patient.id,
                name: "Your clinic",
                count: list.length,
                last: list[0].body as string,
              },
            ]
          : [],
      };
    }

    // Guarded here rather than at the top: the patient branch above is polled by
    // the portal's notification bell, and an entry guard would break it. Redundant
    // while `isPatient` means `!isStaff`, but that equivalence is what makes the
    // clinic-wide read below safe, so state it rather than rely on it.
    await requireStaff(context as Ctx);
    const { data: rows } = await supabase
      .from("messages")
      .select("id, body, created_at, patient_id, patients(first_name, last_name)")
      .eq("author", "patient")
      .is("read_at", null)
      .order("created_at", { ascending: false });

    const grouped = new Map<string, { patient_id: string; name: string; count: number; last: string }>();
    for (const row of (rows ?? []) as any[]) {
      const existing = grouped.get(row.patient_id);
      if (existing) existing.count += 1;
      else
        grouped.set(row.patient_id, {
          patient_id: row.patient_id,
          name: `${row.patients?.first_name ?? ""} ${row.patients?.last_name ?? ""}`.trim() || "Patient",
          count: 1,
          last: row.body,
        });
    }
    const items = [...grouped.values()];
    return { total: items.reduce((sum, i) => sum + i.count, 0), items };
  });

/** Unread alerts addressed to the signed-in staff member. */
export const listStaffNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "listStaffNotifications");
    // Service-role client bypasses RLS — only show alerts addressed to this user.
    const { data: rows } = await ctx.supabase
      .from("staff_notifications")
      .select("id, title, body, patient_id, appointment_id, read_at, created_at, urgent, sender_id, kind")
      .eq("recipient_id", ctx.userId)
      .is("read_at", null)
      .is("recipient_dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(20);
    const list = (rows ?? []) as {
      id: string;
      title: string;
      body: string | null;
      patient_id: string | null;
      appointment_id: string | null;
      read_at: string | null;
      created_at: string;
      urgent: boolean | null;
      sender_id: string | null;
      kind: string;
    }[];
    const senderIds = [...new Set(list.map((r) => r.sender_id).filter(Boolean))] as string[];
    let names = new Map<string, string>();
    if (senderIds.length > 0) {
      const { data: profiles } = await ctx.supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", senderIds);
      names = new Map(
        ((profiles ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]),
      );
    }
    return list.map((r) => ({
      ...r,
      sender_name: r.sender_id ? (names.get(r.sender_id) ?? null) : null,
    }));
  });

/** Staff directory used for direct alerts between team members. */
export const listStaffDirectory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorize(context as Ctx, "listStaffDirectory");
    const ctx = context as Ctx;
    const { data: roles } = await ctx.supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["owner", "practitioner", "front_desk"]);
    const ids = [...new Set((roles ?? []).map((r: { user_id: string }) => r.user_id))] as string[];
    if (ids.length === 0) return [];
    const { data: profiles } = await ctx.supabase
      .from("profiles")
      .select("id, full_name, job_title")
      .in("id", ids)
      .order("full_name", { ascending: true });
    return (profiles ?? []).map((p: { id: string; full_name: string; job_title: string | null }) => ({
      ...p,
      roles: (roles ?? [])
        .filter((r: { user_id: string }) => r.user_id === p.id)
        .map((r: { role: string }) => r.role) as string[],
    }));
  });

/** Send a direct or urgent alert to teammates; appears in their notification bell. */
export const sendStaffAlert = createServerFn({ method: "POST" })
  .validator(
    (data: {
      audience: "managers" | "practitioners" | "front_desk" | "all" | "user";
      recipientId?: string;
      body: string;
      urgent?: boolean;
    }) => parseInput(schemas.SendStaffAlert, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await authorize(ctx, "sendStaffAlert");

    const body = data.body.trim();
    if (!body) throw new Error("Write a message");

    let recipients: string[] = [];
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
      const { data: roles } = await ctx.supabase.from("user_roles").select("user_id").in("role", wanted);
      recipients = [...new Set((roles ?? []).map((r: { user_id: string }) => r.user_id))] as string[];
    }
    recipients = recipients.filter((id) => id !== ctx.userId);
    if (recipients.length === 0) throw new Error("No recipients found");

    const from = identity.profile?.full_name || identity.email || "A colleague";
    const { error } = await ctx.supabase.from("staff_notifications").insert(
      recipients.map((id) => ({
        clinic_id: clinicIdOf(context),
        recipient_id: id,
        sender_id: ctx.userId,
        urgent: !!data.urgent,
        kind: data.urgent ? "urgent" : "staff_message",
        title: `${data.urgent ? "Urgent" : "Message"} from ${from}`,
        body,
      })),
    );
    if (error) throw new Error(error.message);
    await audit(ctx, "notify", "staff_notification", null, null, {
      audience: data.audience,
      urgent: !!data.urgent,
      recipients: recipients.length,
    });
    return { sent: recipients.length };
  });

/** Day summary for a practitioner: bookings, free windows and their urgent notes to me. */
export const getPractitionerDay = createServerFn({ method: "GET" })
  .validator((data: { practitionerId: string; date: string }) => parseInput(schemas.GetPractitionerDay, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "getPractitionerDay");
    const ctx = context as Ctx;
    const day = new Date(`${data.date}T00:00:00`);
    const from = new Date(day.getFullYear(), day.getMonth(), day.getDate()).toISOString();
    const to = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).toISOString();

    const [{ data: appts }, { data: alerts }] = await Promise.all([
      ctx.supabase
        .from("appointments")
        .select("id, starts_at, ends_at, status")
        .eq("practitioner_id", data.practitionerId)
        .gte("starts_at", from)
        .lt("starts_at", to)
        .order("starts_at", { ascending: true }),
      ctx.supabase
        .from("staff_notifications")
        .select("id, title, body, created_at, urgent")
        .eq("sender_id", data.practitionerId)
        .eq("urgent", true)
        .order("created_at", { ascending: false })
        .limit(3),
    ]);

    const booked = (appts ?? []).filter((a: { status: string }) => a.status !== "cancelled");
    const DAY_START = 9 * 60;
    const DAY_END = 18 * 60;
    const mins = (iso: string) => {
      const d = new Date(iso);
      return d.getHours() * 60 + d.getMinutes();
    };
    const free: { from: number; to: number }[] = [];
    let cursor = DAY_START;
    for (const a of booked as { starts_at: string; ends_at: string }[]) {
      const s = Math.max(mins(a.starts_at), DAY_START);
      const e = Math.min(mins(a.ends_at), DAY_END);
      if (s > cursor) free.push({ from: cursor, to: s });
      cursor = Math.max(cursor, e);
    }
    if (cursor < DAY_END) free.push({ from: cursor, to: DAY_END });

    return {
      bookedCount: booked.length,
      bookedMinutes: (booked as { starts_at: string; ends_at: string }[]).reduce(
        (sum, a) => sum + Math.max(0, mins(a.ends_at) - mins(a.starts_at)),
        0,
      ),
      free: free.filter((f) => f.to - f.from >= 15).slice(0, 4),
      alerts: (alerts ?? []) as { id: string; title: string; body: string | null; created_at: string }[],
    };
  });

export const markStaffNotificationRead = createServerFn({ method: "POST" })
  .validator((data: { id?: string; all?: boolean }) => parseInput(schemas.MarkStaffNotificationRead, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "markStaffNotificationRead");
    // Service-role client bypasses RLS — only update the caller's own alerts.
    let q = ctx.supabase
      .from("staff_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("recipient_id", ctx.userId)
      .is("read_at", null);
    if (data.id) q = q.eq("id", data.id);
    const { error } = await q;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Hide a team inbox row for the signed-in user only (incoming or sent). */
export const dismissStaffInboxItem = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => parseInput(schemas.DismissStaffInboxItem, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "dismissStaffInboxItem");
    const ctx = context as Ctx;
    await dismissStaffInboxRows(ctx, [data.id]);
    return { ok: true };
  });

/** Hide several inbox rows for the signed-in user (e.g. whole peer stack). */
export const dismissStaffInboxItems = createServerFn({ method: "POST" })
  .validator((data: { ids: string[] }) => parseInput(schemas.DismissStaffInboxItems, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "dismissStaffInboxItems");
    const ids = [...new Set(data.ids.filter(Boolean))];
    if (ids.length === 0) return { ok: true };
    await dismissStaffInboxRows(ctx, ids);
    return { ok: true };
  });

async function dismissStaffInboxRows(ctx: Ctx, ids: string[]) {
  const { data: rows, error: fetchErr } = await ctx.supabase
    .from("staff_notifications")
    .select("id, recipient_id, sender_id, read_at")
    .in("id", ids);
  if (fetchErr) throw new Error(fetchErr.message);
  if (!rows?.length) throw new Error("Message not found");

  const now = new Date().toISOString();
  let updated = 0;
  for (const row of rows) {
    const isRecipient = row.recipient_id === ctx.userId;
    const isSender = row.sender_id === ctx.userId;
    if (!isRecipient && !isSender) continue;

    const patch: {
      recipient_dismissed_at?: string;
      sender_dismissed_at?: string;
      read_at?: string;
    } = {};
    if (isRecipient) {
      patch.recipient_dismissed_at = now;
      if (!row.read_at) patch.read_at = now;
    }
    if (isSender) patch.sender_dismissed_at = now;

    const { error } = await ctx.supabase.from("staff_notifications").update(patch).eq("id", row.id);
    if (error) throw new Error(error.message);
    updated += 1;
  }
  if (updated === 0) throw new Error("You can only dismiss your own messages");
}

/** Alerts the signed-in staff member sent recently (seen / waiting per recipient). */
export const listSentStaffAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "listSentStaffAlerts");
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await ctx.supabase
      .from("staff_notifications")
      .select("id, title, body, urgent, kind, recipient_id, read_at, created_at")
      .eq("sender_id", ctx.userId)
      .in("kind", ["urgent", "staff_message", "staff_chat"])
      .is("sender_dismissed_at", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as {
      id: string;
      title: string;
      body: string | null;
      urgent: boolean | null;
      kind: string;
      recipient_id: string;
      read_at: string | null;
      created_at: string;
    }[];
    const recipientIds = [...new Set(list.map((r) => r.recipient_id))];
    let names = new Map<string, string>();
    if (recipientIds.length > 0) {
      const { data: profiles } = await ctx.supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", recipientIds);
      names = new Map(
        ((profiles ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]),
      );
    }
    return list.map((r) => ({
      ...r,
      recipient_name: names.get(r.recipient_id) ?? "Teammate",
    }));
  });

/** Team alerts / chat pings addressed to the signed-in staff member (last 7 days). */
export const listIncomingTeamAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "listIncomingTeamAlerts");
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await ctx.supabase
      .from("staff_notifications")
      .select("id, title, body, urgent, kind, sender_id, read_at, created_at")
      .eq("recipient_id", ctx.userId)
      .in("kind", ["urgent", "staff_message", "staff_chat"])
      .is("recipient_dismissed_at", null)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as {
      id: string;
      title: string;
      body: string | null;
      urgent: boolean | null;
      kind: string;
      sender_id: string | null;
      read_at: string | null;
      created_at: string;
    }[];
    const senderIds = [...new Set(list.map((r) => r.sender_id).filter(Boolean))] as string[];
    let names = new Map<string, string>();
    if (senderIds.length > 0) {
      const { data: profiles } = await ctx.supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", senderIds);
      names = new Map(
        ((profiles ?? []) as { id: string; full_name: string }[]).map((p) => [p.id, p.full_name]),
      );
    }
    return list.map((r) => ({
      ...r,
      sender_name: r.sender_id ? (names.get(r.sender_id) ?? "Teammate") : "Clinic",
    }));
  });

export const listMessageTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorize(context as Ctx, "listMessageTemplates");
    const { data, error } = await (context as Ctx).supabase
      .from("message_templates")
      .select("*")
      .order("category", { ascending: true })
      .order("title", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveMessageTemplate = createServerFn({ method: "POST" })
  .validator((data: { id?: string; title: string; body: string; category?: string }) => parseInput(schemas.SaveMessageTemplate, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "saveMessageTemplate");
    const supabase = (context as Ctx).supabase;
    const payload = {
      clinic_id: clinicIdOf(context),
      title: data.title.trim(),
      body: data.body.trim(),
      category: data.category?.trim() || null,
      created_by: context.userId,
    };
    if (!payload.title || !payload.body) throw new Error("Title and message are required");
    const { error } = data.id
      ? await supabase.from("message_templates").update(payload).eq("id", data.id)
      : await supabase.from("message_templates").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMessageTemplate = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => parseInput(schemas.DeleteMessageTemplate, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "deleteMessageTemplate");
    const { error } = await (context as Ctx).supabase.from("message_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Queue an email or SMS. Phase 8 drains `communications`. This is the only
 * application insert into that table.
 */
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "enqueueCommunication");
    const { enqueueCommunication: enqueue } = await import("./comms/enqueue.server");
    const result = await enqueue(ctx.supabase, {
      clinicId: clinicIdOf(context),
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
      createdBy: ctx.userId,
    });
    await audit(ctx, "comms.enqueue", "communications", result.id, data.patient_id, {
      channel: data.channel,
      purpose: data.purpose,
    });
    return result;
  });

export const listCommunications = createServerFn({ method: "GET" })
  .validator((data: { patient_id: string }) => parseInput(schemas.ListCommunications, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "listCommunications", { patientId: data.patient_id });
    const { data: rows, error } = await ctx.supabase
      .from("communications")
      .select(
        "id, channel, purpose, to_address, template_key, subject, body, status, error, attempts, provider, scheduled_for, sent_at, created_at",
      )
      .eq("patient_id", data.patient_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return rows ?? [];
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "saveCommsPreferences", { patientId: data.patient_id });
    const { nextUnsubscribedAt } = await import("./comms/preferences");
    const { data: current } = await ctx.supabase
      .from("patients")
      .select("unsubscribed_at")
      .eq("id", data.patient_id)
      .maybeSingle();
    const unsubscribed_at = nextUnsubscribedAt({
      marketing_opt_in: data.marketing_opt_in,
      reminders_opt_in: data.reminders_opt_in,
      unsubscribed_at: current?.unsubscribed_at ?? null,
    });
    const { error } = await ctx.supabase
      .from("patients")
      .update({
        email_opt_in: data.email_opt_in,
        sms_opt_in: data.sms_opt_in,
        reminders_opt_in: data.reminders_opt_in,
        marketing_opt_in: data.marketing_opt_in,
        unsubscribed_at,
      })
      .eq("id", data.patient_id);
    if (error) throw new Error(error.message);
    await audit(ctx, "comms.preferences", "patients", data.patient_id, data.patient_id);
    return { ok: true as const };
  });

/** Claim due outbox rows for this clinic and hand them to the adapters. */
export const drainCommunications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "drainCommunications");
    const { drainDueCommunications } = await import("./comms/dispatch.server");
    const summary = await drainDueCommunications(ctx.supabase, { clinicId: clinicIdOf(context) });
    await audit(ctx, "comms.drain", "communications", null, null, summary);
    return summary;
  });

export const listPatientThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorize(context as Ctx, "listPatientThreads");
    const supabase = (context as Ctx).supabase;

    // Recent traffic, grouped into threads. 400 recent rows comfortably covers
    // a clinic's active conversations without scanning the whole table.
    const { data: rows, error } = await supabase
      .from("messages")
      .select("id, patient_id, author, body, read_at, created_at, patients(first_name, last_name, avatar_url)")
      .order("created_at", { ascending: false })
      .limit(400);
    if (error) throw new Error(error.message);

    const threads = new Map<
      string,
      { patientId: string; name: string; avatarUrl: string | null; last: string; lastAt: string; lastAuthor: string; unread: number }
    >();
    for (const row of (rows ?? []) as any[]) {
      let thread = threads.get(row.patient_id);
      if (!thread) {
        thread = {
          patientId: row.patient_id,
          name: `${row.patients?.first_name ?? ""} ${row.patients?.last_name ?? ""}`.trim() || "Patient",
          avatarUrl: row.patients?.avatar_url ?? null,
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    // Ownership-checked like getPatient: staff, or the patient whose thread it is.
    await authorize(context as Ctx, "getPatientMessages", { patientId: data.patient_id });
    const supabase = (context as Ctx).supabase;
    const { data: rows, error } = await supabase
      .from("messages")
      .select("*")
      .eq("patient_id", data.patient_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    // Same shape as the demo twin; real patients type at their own pace.
    return { messages: rows ?? [], typing: false };
  });

export const markMessagesRead = createServerFn({ method: "POST" })
  .validator((data: { patient_id: string }) => parseInput(schemas.MarkMessagesRead, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = (context as Ctx).supabase;
    // The author filter alone did not stop a patient passing someone else's
    // patient_id and marking that thread read.
    const identity = await authorize(context as Ctx, "markMessagesRead", {
      patientId: data.patient_id,
    });

    // Patients read staff messages in their own thread; staff read patient messages for a given patient.
    const authorFilter = identity.isPatient ? "staff" : "patient";
    const { error } = await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("patient_id", data.patient_id)
      .eq("author", authorFilter)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reviewHistory = createServerFn({ method: "POST" })
  .validator((data: { id: string; patient_id: string }) => parseInput(schemas.ReviewHistory, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "reviewHistory");
    const { error } = await (context as Ctx).supabase
      .from("medical_history_versions")
      .update({ reviewed_by: context.userId, reviewed_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context as Ctx, "review", "medical_history", data.id, data.patient_id);
    return { ok: true };
  });

/* ---------- Patient portal ---------- */

export const getMyRecord = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorize(context as Ctx, "getMyRecord");
    const supabase = (context as Ctx).supabase;
    const { data: patient } = await supabase
      .from("patients")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!patient) return null;

    const [treatments, documents, messages, history, photos] = await Promise.all([
      supabase.from("treatments").select("*").eq("patient_id", patient.id).order("performed_at", { ascending: false }),
      supabase.from("documents").select("*").eq("patient_id", patient.id).order("created_at", { ascending: false }),
      supabase.from("messages").select("*").eq("patient_id", patient.id).order("created_at", { ascending: true }),
      supabase
        .from("medical_history_versions")
        .select("*")
        .eq("patient_id", patient.id)
        .order("created_at", { ascending: false }),
      supabase.from("treatment_photos").select("*").eq("patient_id", patient.id).eq("visible_to_patient", true),
    ]);

    const withUrls = [] as any[];
    for (const photo of photos.data ?? []) {
      const { data: url } = await supabase.storage
        .from("patient-photos")
        .createSignedUrl(photo.storage_path, 3600);
      withUrls.push({ ...photo, url: url?.signedUrl ?? null });
    }

    return {
      patient,
      treatments: treatments.data ?? [],
      documents: documents.data ?? [],
      messages: messages.data ?? [],
      history: history.data ?? [],
      photos: withUrls,
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
    }) => parseInput(schemas.SubmitHistoryUpdate, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "submitHistoryUpdate");
    const supabase = (context as Ctx).supabase;
    const { data: patient } = await supabase
      .from("patients")
      .select("id, clinic_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!patient) throw new Error("No patient record linked to this account");

    const { error } = await supabase.from("medical_history_versions").insert({
      clinic_id: patient.clinic_id,
      patient_id: patient.id,
      data,
      summary: "Patient updated their medical and lifestyle information",
      source: "patient",
      changed_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const signDocument = createServerFn({ method: "POST" })
  .validator((data: { id: string; signed_name: string }) => parseInput(schemas.SignDocument, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const name = data.signed_name.trim().slice(0, 120);
    if (!name) throw new Error("Please type your full name to sign");
    // Signing is the patient's own act. Without this, any authenticated user could
    // sign any consent form by ID, including one belonging to another patient.
    const { data: doc, error: docError } = await ctx.supabase
      .from("documents")
      .select("patient_id")
      .eq("id", data.id)
      .maybeSingle();
    if (docError) throw new Error(docError.message);
    if (!doc) throw new Error("Document not found");
    await authorize(ctx, "signDocument", { patientId: doc.patient_id });
    const { error } = await ctx.supabase
      .from("documents")
      .update({
        status: "signed",
        signed_at: new Date().toISOString(),
        signed_name: name,
        signature_data: name,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
/* ------------------------------------------------------------------ */
/* Team administration — manager (owner) only                          */
/* ------------------------------------------------------------------ */

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "listTeam");
    const supabaseAdmin = await adminClient(context);
    const [{ data: profiles }, { data: roles }, users] = await Promise.all([
      supabaseAdmin.from("profiles").select("*"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);
    const emailFor = new Map<string, string>(
      (users.data?.users ?? []).map((u) => [u.id, u.email ?? ""]),
    );
    const signedInAt = new Map<string, string | null>(
      (users.data?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]),
    );
    const staffRoles = (roles ?? []).filter((r) => r.role !== "patient");
    return staffRoles
      .map((r) => {
        const profile = (profiles ?? []).find((p) => p.id === r.user_id);
        return {
          userId: r.user_id,
          role: r.role as string,
          email: emailFor.get(r.user_id) ?? "",
          fullName: profile?.full_name ?? "",
          jobTitle: profile?.job_title ?? "",
          registrationBody: profile?.registration_body ?? "",
          registrationNumber: profile?.registration_number ?? "",
          isSelf: r.user_id === ctx.userId,
          hasSignedIn: Boolean(signedInAt.get(r.user_id)),
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "createStaffAccount");
    const email = assertEmail(data.email, "work email")!;
    const supabaseAdmin = await adminClient(context);
    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (created.error || !created.data.user) throw new Error(created.error?.message ?? "Could not create account");
    const uid = created.data.user.id;
    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      clinic_id: clinicIdOf(context),
      full_name: data.fullName,
      job_title: data.jobTitle ?? null,
      registration_body: data.registrationBody ?? null,
      registration_number: data.registrationNumber ?? null,
    });
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    await unbanAuthUser(uid);
    await audit(ctx, "staff.create", "user_roles", uid, null, { email, role: data.role });
    return { userId: uid };
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "updateStaffMember");
    const supabaseAdmin = await adminClient(context);
    const patch: Record<string, unknown> = {
      full_name: data.fullName,
      job_title: data.jobTitle ?? null,
      registration_body: data.registrationBody ?? null,
      registration_number: data.registrationNumber ?? null,
    };
    if (data.commissionRate !== undefined) {
      patch.commission_rate = Math.min(100, Math.max(0, Number(data.commissionRate) || 0));
    }
    await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
    if (data.userId === ctx.userId && data.role !== "owner") {
      throw new Error("You cannot remove your own manager access");
    }
    // Read before the delete: a role change is only auditable if the entry says
    // what it changed from.
    const { data: priorRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .neq("role", "patient");
    const previousRole = (priorRoles ?? []).map((r: { role: string }) => r.role)[0] ?? null;

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).neq("role", "patient");
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    // Undo revoke / role restore must lift the Auth ban so they can sign in again.
    await clearExTeamArchive(clinicIdOf(context), data.userId);
    await unbanAuthUser(data.userId);
    await audit(ctx, "staff.update", "user_roles", data.userId, null, {
      role: data.role,
      previous_role: previousRole,
      ...(data.commissionRate !== undefined ? { commission_rate: patch.commission_rate } : {}),
    });
    return { ok: true };
  });

/**
 * Manager-only: invite a receptionist or practitioner. Supabase Auth emails an
 * invite link and the invitee chooses their own password on /auth/reset —
 * no plaintext temporary password ever reaches the UI or a manager's mailbox.
 * If the email already has an auth user, a one-time recovery link is returned
 * for the manager to share instead (Auth will not re-invite an existing user).
 */
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "inviteStaffMember");
    const email = assertEmail(data.email, "work email")!;
    const supabaseAdmin = await adminClient(context);
    const origin = (data.app_origin?.trim() || process.env["APP_ORIGIN"]?.trim() || "").replace(/\/$/, "");
    const redirectTo = `${origin}/auth/reset`;

    let uid: string | undefined;
    let delivery: "emailed" | "link" = "emailed";
    let actionLink: string | null = null;

    const invited = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: data.fullName },
      redirectTo,
    });

    if (invited.error) {
      const msg = (invited.error.message || "").toLowerCase();
      const already =
        msg.includes("already been registered") ||
        msg.includes("already registered") ||
        msg.includes("user already exists") ||
        invited.error.status === 422;
      if (!already) throw new Error(invited.error.message);

      // Existing account: mint a one-time recovery link for the manager to
      // share. It expires, it is single-use, and the invitee still chooses
      // their own password — unlike the old plaintext temporary password.
      const link = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo },
      });
      if (link.error) throw new Error(link.error.message);
      uid = link.data.user?.id;
      actionLink = link.data.properties?.action_link ?? null;
      delivery = "link";
    } else {
      uid = invited.data.user?.id;
    }
    if (!uid) throw new Error("Could not create the invitation");

    // They set their own password from the link, so no forced change remains;
    // only the welcome tour is pending.
    const meta = await supabaseAdmin.auth.admin.updateUserById(uid, {
      ban_duration: "none",
      user_metadata: { full_name: data.fullName },
      app_metadata: { welcome_pending: true, must_change_password: false },
    });
    if (meta.error) throw new Error(meta.error.message);

    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      clinic_id: clinicIdOf(context),
      full_name: data.fullName,
      job_title: data.jobTitle ?? null,
      registration_body: data.registrationBody ?? null,
      registration_number: data.registrationNumber ?? null,
    });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid).neq("role", "patient");
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    await clearExTeamArchive(clinicIdOf(context), uid);
    await unbanAuthUser(uid);
    await audit(ctx, "staff.invite", "user_roles", uid, null, { email, role: data.role, delivery });

    return {
      userId: uid,
      email,
      role: data.role,
      delivery,
      actionLink,
    };
  });


export const revokeStaffAccess = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => parseInput(schemas.RevokeStaffAccess, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await authorize(ctx, "revokeStaffAccess");
    await requireStepUp(ctx);
    if (data.userId === ctx.userId) throw new Error("You cannot revoke your own access");
    const supabaseAdmin = await adminClient(context);

    const [{ data: roleRow }, { data: profile }, authUser] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", data.userId)
        .neq("role", "patient")
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
      supabaseAdmin.auth.admin.getUserById(data.userId),
    ]);
    if (!roleRow) throw new Error("That person is not on the team");

    const identitySnap = staffArchiveIdentity({
      profileName: profile?.full_name,
      metaName: (authUser.data.user?.user_metadata as { full_name?: string } | undefined)?.full_name,
      email: authUser.data.user?.email,
    });

    await archiveExTeamMember({
      clinicId: clinicIdOf(context),
      userId: data.userId,
      role: roleRow.role as string,
      email: identitySnap.email,
      fullName: identitySnap.fullName,
      jobTitle: profile?.job_title ?? null,
      registrationBody: profile?.registration_body ?? null,
      registrationNumber: profile?.registration_number ?? null,
      commissionRate: profile?.commission_rate ?? null,
      revokedBy: ctx.userId,
    });

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).neq("role", "patient");
    // End their Auth session and block sign-in until access is restored.
    await banAuthUser(data.userId);
    await audit(ctx, "staff.revoke", "user_roles", data.userId, null);
    return { ok: true };
  });

/** Former team members retained for 90 days (staff identity only — not patient data). */
export const listExTeamMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "listExTeamMembers");
    await purgeExpiredExTeamMembers(clinicIdOf(context));
    const now = new Date().toISOString();
    // The request client rather than supabaseAdmin: both are service-role, but
    // only this one carries the clinic filter.
    const { data, error } = await ctx.supabase
      .from("ex_team_members")
      .select(
        "id, user_id, email, full_name, job_title, registration_body, registration_number, role, revoked_at, retain_until",
      )
      .is("purged_at", null)
      .gt("retain_until", now)
      .order("revoked_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const needsFill = rows.some(
      (row: { full_name?: string | null; email?: string | null }) =>
        !String(row.full_name ?? "").trim() || !String(row.email ?? "").trim(),
    );
    const supabaseAdmin = needsFill ? await adminClient(context) : null;
    const userIds = rows.map((row: { user_id: string }) => row.user_id);
    const [{ data: profiles }, users] = needsFill
      ? await Promise.all([
          supabaseAdmin!.from("profiles").select("id, full_name").in("id", userIds),
          supabaseAdmin!.auth.admin.listUsers({ page: 1, perPage: 200 }),
        ])
      : [{ data: [] as { id: string; full_name: string | null }[] }, { data: { users: [] } }];
    const profileName = new Map(
      (profiles ?? []).map((p: { id: string; full_name: string | null }) => [p.id, p.full_name ?? ""]),
    );
    const authById = new Map(
      (users.data?.users ?? []).map((u) => [
        u.id,
        {
          email: u.email ?? "",
          metaName: (u.user_metadata as { full_name?: string } | undefined)?.full_name ?? "",
        },
      ]),
    );
    return rows.map((row: any) => {
      const auth = authById.get(row.user_id as string);
      const filled = staffArchiveIdentity({
        profileName: (row.full_name as string) || profileName.get(row.user_id as string),
        metaName: auth?.metaName,
        email: (row.email as string | null) || auth?.email,
      });
      return {
        id: row.id as string,
        userId: row.user_id as string,
        email: filled.email,
        fullName: filled.fullName,
        jobTitle: (row.job_title as string | null) ?? "",
        registrationBody: (row.registration_body as string | null) ?? "",
        registrationNumber: (row.registration_number as string | null) ?? "",
        role: row.role as string,
        revokedAt: row.revoked_at as string,
        retainUntil: row.retain_until as string,
        daysRemaining: daysRemainingUntil(row.retain_until as string),
      };
    });
  });

/** Restore a former team member within the 90-day window. */
export const restoreExTeamMember = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => parseInput(schemas.RestoreExTeamMember, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "restoreExTeamMember");
    const supabaseAdmin = await adminClient(context);
    const { data: archived, error } = await supabaseAdmin
      .from("ex_team_members")
      .select("*")
      .eq("user_id", data.userId)
      .is("purged_at", null)
      .gt("retain_until", new Date().toISOString())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!archived) throw new Error("No former team record found (it may have expired)");

    const role = archived.role as "owner" | "manager" | "practitioner" | "front_desk";
    if (!role) throw new Error("That archive has no role to restore");
    const { data: currentProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", data.userId)
      .maybeSingle();
    const authUser = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const filled = staffArchiveIdentity({
      profileName: (archived.full_name as string) || currentProfile?.full_name,
      metaName: (authUser.data.user?.user_metadata as { full_name?: string } | undefined)?.full_name,
      email: (archived.email as string | null) || authUser.data.user?.email,
    });
    const patch: Record<string, unknown> = {};
    if (filled.fullName) patch.full_name = filled.fullName;
    if (String(archived.job_title ?? "").trim()) patch.job_title = archived.job_title;
    if (String(archived.registration_body ?? "").trim()) patch.registration_body = archived.registration_body;
    if (String(archived.registration_number ?? "").trim()) {
      patch.registration_number = archived.registration_number;
    }
    if (archived.commission_rate != null) patch.commission_rate = archived.commission_rate;
    if (Object.keys(patch).length) {
      await supabaseAdmin.from("profiles").update(patch).eq("id", data.userId);
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).neq("role", "patient");
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role });
    await clearExTeamArchive(clinicIdOf(context), data.userId);
    await unbanAuthUser(data.userId);
    await audit(ctx, "staff.restore", "user_roles", data.userId, null, { role });
    return { ok: true, role };
  });

/**
 * Manager-only: set or reset a staff member's password so they can sign in with
 * email + password immediately (invited accounts have no password until the
 * invite link is opened, which is why sign-in fails with "Invalid credentials").
 */
export const setStaffPassword = createServerFn({ method: "POST" })
  .validator((data: { userId: string; password: string }) => parseInput(schemas.SetStaffPassword, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "setStaffPassword");
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters");
    const supabaseAdmin = await adminClient(context);
    const existing = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (existing.error) throw new Error(existing.error.message);
    const res = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
      email_confirm: true,
      app_metadata: {
        ...(existing.data.user?.app_metadata ?? {}),
        must_change_password: true,
        // Password resets must not trigger the new-hire welcome.
        welcome_pending: false,
      },
    });
    if (res.error) throw new Error(res.error.message);
    await audit(ctx, "staff.set_password", "user_roles", data.userId, null);
    return { ok: true };
  });

async function consumePasswordEmailCode(ctx: Ctx, code: string | undefined) {
  if (!code) throw new Error("Enter the 6-digit code we emailed you");
  const { data: row, error } = await ctx.supabase
    .from("auth_email_otp")
    .select("code_hash, channel, expires_at, attempts")
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row || new Date(String(row.expires_at)).getTime() < Date.now()) {
    throw new Error("That code has expired. Request a new one.");
  }
  if ((row.attempts ?? 0) >= 5) {
    throw new Error("Too many attempts. Request a new code.");
  }
  await ctx.supabase
    .from("auth_email_otp")
    .update({ attempts: (row.attempts ?? 0) + 1 })
    .eq("user_id", ctx.userId);
  if (!row.code_hash || row.code_hash !== hashLoginEmailCode(ctx.userId, code)) {
    throw new Error("That code was not recognised");
  }
  const { error: clearError } = await ctx.supabase.from("auth_email_otp").upsert({
    user_id: ctx.userId,
    code_hash: null,
    channel: row.channel,
    expires_at: row.expires_at,
    verified_until: null,
    attempts: 0,
  });
  if (clearError) throw new Error(clearError.message);
}

/** Signed-in staff: replace temporary/reset password and clear the must-change flag. */
export const changeOwnPassword = createServerFn({ method: "POST" })
  .validator((data: { password: string; code?: string }) => parseInput(schemas.ChangeOwnPassword, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "changeOwnPassword");
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters");
    const supabaseAdmin = await adminClient(context);
    // Merge app_metadata so we clear the flag without wiping other Auth keys.
    const existing = await supabaseAdmin.auth.admin.getUserById(ctx.userId);
    if (existing.error) throw new Error(existing.error.message);
    const forced = existing.data.user?.app_metadata?.["must_change_password"] === true;
    if (!forced) await consumePasswordEmailCode(ctx, data.code);
    const res = await supabaseAdmin.auth.admin.updateUserById(ctx.userId, {
      password: data.password,
      app_metadata: {
        ...(existing.data.user?.app_metadata ?? {}),
        must_change_password: false,
      },
    });
    if (res.error) throw new Error(res.error.message);
    await audit(ctx, "staff.change_own_password", "user_roles", ctx.userId, null);
    return { ok: true, mustChangePassword: false as const };
  });

/** Clear the first-login welcome flag after the staff member dismisses it. */
export const acknowledgeWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "acknowledgeWelcome");
    const supabaseAdmin = await adminClient(context);
    const existing = await supabaseAdmin.auth.admin.getUserById(ctx.userId);
    if (existing.error) throw new Error(existing.error.message);
    const res = await supabaseAdmin.auth.admin.updateUserById(ctx.userId, {
      app_metadata: {
        ...(existing.data.user?.app_metadata ?? {}),
        welcome_pending: false,
      },
    });
    if (res.error) throw new Error(res.error.message);
    return { ok: true, welcomePending: false as const };
  });

/** Re-check the caller's password and open a short window for destructive actions. */
export const confirmStepUp = createServerFn({ method: "POST" })
  .validator((data: { password: string }) => parseInput(schemas.ConfirmStepUp, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await authorize(ctx, "confirmStepUp");
    if (!identity.email) throw new Error("Your account has no email to confirm");
    await verifyPassword(identity.email, data.password);
    const { error } = await ctx.supabase.from("auth_step_up").upsert({
      user_id: ctx.userId,
      confirmed_at: new Date().toISOString(),
      expires_at: stepUpExpiry(),
    });
    if (error) throw new Error(error.message);
    await audit(ctx, "auth.step_up", "user_roles", ctx.userId, null);
    return { ok: true as const };
  });

function hashLoginEmailCode(userId: string, code: string) {
  return createHash("sha256").update(`${userId}:${code}`).digest("hex");
}

function loginCodeEmailBody(code: string) {
  return `Your sign-in code is ${code}. It expires in 10 minutes.\n\nIf you did not try to sign in, ignore this email.`;
}

function passwordCodeEmailBody(code: string) {
  return `Someone asked to change the password on your Aetheria account.\n\nApprove the change with this 6-digit code: ${code}\n\nIt expires in 10 minutes. The password will not change until you enter this code on My profile.\n\nIf you did not ask to change your password, ignore this email and sign out other devices on My profile.`;
}

async function emailLoginCode(
  email: string,
  code: string,
  purpose: "login" | "password" = "login",
): Promise<"emailed" | "preview"> {
  const delivery = emailMfaDelivery();
  const key = process.env["RESEND_API_KEY"]?.trim();
  const from = process.env["COMMS_FROM_EMAIL"]?.trim() || "Aetheria <onboarding@resend.dev>";
  const subject =
    purpose === "password" ? "Approve your Aetheria password change" : "Your Aetheria sign-in code";
  const text = purpose === "password" ? passwordCodeEmailBody(code) : loginCodeEmailBody(code);
  if (delivery === "resend" && key) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        text,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!response.ok || !payload?.id) {
      throw new Error(payload?.message || "Could not email a login code");
    }
    return "emailed";
  }
  // Built-in Supabase Auth mail is capped at 2 messages/hour on the free tier
  // and cannot put a 6-digit code in the template. AUTH_DEV_SHOW_OTP=1 hands
  // the code back instead so sign-in still works while Resend is unconfigured.
  if (delivery !== "preview") {
    throw new Error("Add RESEND_API_KEY to send sign-in codes by email.");
  }
  console.info(`[auth] login code for ${email}: ${code}`);
  return "preview";
}

export const sendLoginEmailCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const identity = await authorize(ctx, "sendLoginEmailCode");
    if (!identity.email) throw new Error("Your account has no email to send a code to");
    const existing = await ctx.supabase
      .from("auth_email_otp")
      .select("created_at")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (
      existing.data?.created_at &&
      Date.now() - new Date(String(existing.data.created_at)).getTime() < EMAIL_OTP_RESEND_MS
    ) {
      throw new Error("Wait a moment before requesting another code");
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const delivery = await emailLoginCode(identity.email, code);
    const { error } = await ctx.supabase.from("auth_email_otp").upsert({
      user_id: ctx.userId,
      code_hash: hashLoginEmailCode(ctx.userId, code),
      channel: "hashed",
      expires_at: new Date(Date.now() + EMAIL_OTP_TTL_MS).toISOString(),
      verified_until: null,
      attempts: 0,
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return {
      ok: true as const,
      email: identity.email,
      sent: true as const,
      previewCode: delivery === "preview" ? code : undefined,
    };
  });

/** Email a 6-digit code before changing password from an existing session. */
export const sendPasswordEmailCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const identity = await authorize(ctx, "sendPasswordEmailCode");
    if (!identity.email) throw new Error("Your account has no email to send a code to");
    const existing = await ctx.supabase
      .from("auth_email_otp")
      .select("created_at")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (
      existing.data?.created_at &&
      Date.now() - new Date(String(existing.data.created_at)).getTime() < EMAIL_OTP_RESEND_MS
    ) {
      throw new Error("Wait a moment before requesting another code");
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const delivery = await emailLoginCode(identity.email, code, "password");
    const { error } = await ctx.supabase.from("auth_email_otp").upsert({
      user_id: ctx.userId,
      code_hash: hashLoginEmailCode(ctx.userId, code),
      channel: "hashed",
      expires_at: new Date(Date.now() + EMAIL_OTP_TTL_MS).toISOString(),
      verified_until: null,
      attempts: 0,
      created_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return {
      ok: true as const,
      email: identity.email,
      sent: true as const,
      previewCode: delivery === "preview" ? code : undefined,
    };
  });

export const verifyLoginEmailCode = createServerFn({ method: "POST" })
  .validator((data: { code: string }) => parseInput(schemas.VerifyLoginEmailCode, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "verifyLoginEmailCode");
    const { data: row, error } = await ctx.supabase
      .from("auth_email_otp")
      .select("code_hash, channel, expires_at, attempts")
      .eq("user_id", ctx.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || new Date(String(row.expires_at)).getTime() < Date.now()) {
      throw new Error("That code has expired. Request a new one.");
    }
    if ((row.attempts ?? 0) >= 5) {
      throw new Error("Too many attempts. Request a new code.");
    }
    await ctx.supabase
      .from("auth_email_otp")
      .update({ attempts: (row.attempts ?? 0) + 1 })
      .eq("user_id", ctx.userId);

    if (row.channel === "supabase_otp") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: matched, error: matchError } = await supabaseAdmin.rpc("match_reauthentication_otp", {
        p_user_id: ctx.userId,
        p_code: data.code,
      });
      if (matchError) throw new Error(matchError.message);
      if (!matched) throw new Error("That code was not recognised");
    } else if (row.code_hash !== hashLoginEmailCode(ctx.userId, data.code)) {
      throw new Error("That code was not recognised");
    }

    const { error: stampError } = await ctx.supabase.from("auth_email_otp").upsert({
      user_id: ctx.userId,
      code_hash: null,
      channel: row.channel,
      expires_at: row.expires_at,
      verified_until: new Date(Date.now() + EMAIL_MFA_SESSION_MS).toISOString(),
      attempts: 0,
    });
    if (stampError) throw new Error(stampError.message);
    return { ok: true as const };
  });

export const listMySessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "listMySessions");
    const iat = Number(ctx.claims["iat"] ?? 0);
    return {
      sessions: [
        {
          id: "current",
          current: true,
          createdAt: iat ? new Date(iat * 1000).toISOString() : new Date().toISOString(),
        },
      ],
    };
  });

export const revokeOtherSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "revokeOtherSessions");
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) throw new Error("Missing Supabase configuration");
    const res = await fetch(`${url}/auth/v1/logout?scope=others`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        apikey: key,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || "Could not sign out other devices");
    }
    await audit(ctx, "auth.revoke_other_sessions", "user_roles", ctx.userId, null);
    return { ok: true as const };
  });

/** Manager-only: accounts (patients and staff) with no email address on file. */
export const listAccountsMissingEmail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "listAccountsMissingEmail");
    const supabaseAdmin = await adminClient(context);
    const [{ data: patients }, { data: profiles }, { data: roles }, users] = await Promise.all([
      supabaseAdmin
        .from("patients")
        .select("id, title, first_name, last_name, phone, email, date_of_birth, status")
        .or("email.is.null,email.eq.,phone.is.null,phone.eq.,date_of_birth.is.null")
        .neq("status", "archived")
        .order("last_name", { ascending: true }),
      supabaseAdmin.from("profiles").select("id, full_name, job_title"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
    ]);
    const emailFor = new Map<string, string>(
      (users.data?.users ?? []).map((u) => [u.id, u.email ?? ""]),
    );
    const staff = (roles ?? [])
      .filter((r) => r.role !== "patient")
      .filter((r) => !emailFor.get(r.user_id))
      .map((r) => {
        const profile = (profiles ?? []).find((p) => p.id === r.user_id);
        return {
          userId: r.user_id,
          role: r.role as string,
          fullName: profile?.full_name ?? "Unnamed staff member",
          jobTitle: profile?.job_title ?? "",
        };
      });
    return {
      patients: (patients ?? []).map((p) => ({
        id: p.id as string,
        name: [p.title, p.first_name, p.last_name].filter(Boolean).join(" "),
        phone: (p.phone as string | null) ?? null,
        missingEmail: !((p.email as string | null) ?? "").trim(),
        gaps: [
          !((p.email as string | null) ?? "").trim() ? "email" : null,
          !((p.phone as string | null) ?? "").trim() ? "phone" : null,
          !p.date_of_birth ? "date of birth" : null,
        ].filter(Boolean) as string[],
      })),
      staff,
    };
  });

/** Manager-only: add or correct a patient's email address. */
export const setPatientEmail = createServerFn({ method: "POST" })
  .validator((data: { patientId: string; email: string }) => parseInput(schemas.SetPatientEmail, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "setPatientEmail");
    const email = assertEmail(data.email)!;
    const { error } = await ctx.supabase.from("patients").update({ email }).eq("id", data.patientId);
    if (error) throw new Error(error.message);
    await audit(ctx, "update", "patient", data.patientId, data.patientId);
    return { ok: true };
  });

/** Manager-only: add or correct a staff account's sign-in email. */
export const setStaffEmail = createServerFn({ method: "POST" })
  .validator((data: { userId: string; email: string }) => parseInput(schemas.SetStaffEmail, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "setStaffEmail");
    const email = assertEmail(data.email)!;
    const supabaseAdmin = await adminClient(context);
    const res = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      email,
      email_confirm: true,
    });
    if (res.error) throw new Error(res.error.message);
    await audit(ctx, "staff.set_email", "user_roles", data.userId, null);
    return { ok: true };
  });

/** Manager-only: earnings, KPIs, retention and the clinic/practitioner split per practitioner. */
export const getPractitionerPerformance = createServerFn({ method: "POST" })
  .validator((data: { from: string; to: string; previousFrom: string; previousTo: string }) =>
    parseInput(schemas.GetPractitionerPerformance, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "getPractitionerPerformance");
    await requireManager(ctx);
    const supabaseAdmin = await adminClient(context);
    const { buildStats, buildTrend, moneyChanges, moneyTotals, trendViewWindows } = await import("./earnings.server");
    const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString();
    const previous = { from: data.previousFrom, to: data.previousTo };
    const windows = trendViewWindows();

    const [
      { data: profiles },
      { data: roles },
      { data: treatments },
      { data: appointments },
      { data: prevTreatments },
      { data: prevAppointments },
      { data: yearTreatments },
      { data: firstSeen },
      { data: yearTrendTreatments },
      { data: yearTrendAppointments },
    ] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id, full_name, job_title, commission_rate"),
        supabaseAdmin.from("user_roles").select("user_id, role"),
        supabaseAdmin
          .from("treatments")
          .select("id, practitioner_id, patient_id, name, price, performed_at, commission_rate_snapshot")
          .gte("performed_at", data.from)
          .lte("performed_at", data.to),
        supabaseAdmin
          .from("appointments")
          .select("practitioner_id, price, payment_status, status, starts_at")
          .gte("starts_at", data.from)
          .lte("starts_at", data.to),
        supabaseAdmin
          .from("treatments")
          .select("id, practitioner_id, patient_id, name, price, performed_at, commission_rate_snapshot")
          .gte("performed_at", previous.from)
          .lte("performed_at", previous.to),
        supabaseAdmin
          .from("appointments")
          .select("practitioner_id, price, payment_status, status, starts_at")
          .gte("starts_at", previous.from)
          .lte("starts_at", previous.to),
        supabaseAdmin.from("treatments").select("practitioner_id, patient_id").gte("performed_at", yearAgo),
        supabaseAdmin.from("patients").select("id, created_at"),
        supabaseAdmin
          .from("treatments")
          .select("id, practitioner_id, patient_id, name, price, performed_at, commission_rate_snapshot")
          .gte("performed_at", windows.year.from)
          .lte("performed_at", windows.year.to),
        supabaseAdmin
          .from("appointments")
          .select("practitioner_id, price, payment_status, status, starts_at")
          .gte("starts_at", windows.year.from)
          .lte("starts_at", windows.year.to),
      ]);

    const staffIds = (roles ?? [])
      .filter((r) => r.role === "owner" || r.role === "practitioner")
      .map((r) => r.user_id);
    const staff = [...new Set(staffIds)].map((id) => {
      const p = (profiles ?? []).find((x) => x.id === id);
      return {
        userId: id,
        fullName: p?.full_name || "Unnamed",
        jobTitle: p?.job_title ?? "",
        commissionRate: Number(p?.commission_rate ?? 0),
      };
    });

    const patientFirstSeen = new Map<string, string>(
      (firstSeen ?? []).map((p: { id: string; created_at: string }) => [p.id, p.created_at]),
    );

    const rows = buildStats(
      staff,
      (treatments ?? []) as never,
      (appointments ?? []) as never,
      (yearTreatments ?? []) as never,
      patientFirstSeen,
      { from: data.from, to: data.to },
    ).sort((a, b) => b.earned - a.earned);

    const prevRows = buildStats(
      staff,
      (prevTreatments ?? []) as never,
      (prevAppointments ?? []) as never,
      (yearTreatments ?? []) as never,
      patientFirstSeen,
      previous,
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
      averageValue: totals.treatments ? Math.round((totals.earned / totals.treatments) * 100) / 100 : 0,
      retention: rows.length ? Math.round(rows.reduce((s2, r) => s2 + r.retention, 0) / rows.length) : 0,
      averageCommission: rows.length
        ? Math.round((rows.reduce((s2, r) => s2 + r.commissionRate, 0) / rows.length) * 10) / 10
        : 0,
    };

    const trend = buildTrend(
      staff,
      (treatments ?? []) as never,
      (appointments ?? []) as never,
      { from: data.from, to: data.to },
    );

    const trendSourceTreatments = (yearTrendTreatments ?? []) as never;
    const trendSourceAppointments = (yearTrendAppointments ?? []) as never;
    const trendViews = {
      month: buildTrend(staff, trendSourceTreatments, trendSourceAppointments, windows.month),
      six: buildTrend(staff, trendSourceTreatments, trendSourceAppointments, windows.six),
      year: buildTrend(staff, trendSourceTreatments, trendSourceAppointments, windows.year),
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

/** The caller's own earnings and KPIs. Never returns clinic figures or the split percentage. */
export const getMyEarnings = createServerFn({ method: "POST" })
  .validator((data: { from: string; to: string }) => parseInput(schemas.GetMyEarnings, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "getMyEarnings");
    const supabaseAdmin = await adminClient(context);
    const { buildStats } = await import("./earnings.server");
    const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString();

    const [{ data: profile }, { data: treatments }, { data: appointments }, { data: yearTreatments }, { data: firstSeen }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("id, full_name, job_title, commission_rate")
          .eq("id", ctx.userId)
          .maybeSingle(),
        supabaseAdmin
          .from("treatments")
          .select(
            "id, practitioner_id, patient_id, name, price, performed_at, commission_rate_snapshot, patients(first_name, last_name)",
          )
          .eq("practitioner_id", ctx.userId)
          .gte("performed_at", data.from)
          .lte("performed_at", data.to)
          .order("performed_at", { ascending: false }),
        supabaseAdmin
          .from("appointments")
          .select("practitioner_id, price, payment_status, status, starts_at")
          .eq("practitioner_id", ctx.userId)
          .gte("starts_at", data.from)
          .lte("starts_at", data.to),
        supabaseAdmin
          .from("treatments")
          .select("practitioner_id, patient_id")
          .eq("practitioner_id", ctx.userId)
          .gte("performed_at", yearAgo),
        supabaseAdmin.from("patients").select("id, created_at"),
      ]);

    const rate = Number(profile?.commission_rate ?? 0);
    const stats = buildStats(
      [
        {
          userId: ctx.userId,
          fullName: profile?.full_name ?? "",
          jobTitle: profile?.job_title ?? "",
          commissionRate: rate,
        },
      ],
      (treatments ?? []) as never,
      (appointments ?? []) as never,
      (yearTreatments ?? []) as never,
      new Map<string, string>(
        (firstSeen ?? []).map((p: { id: string; created_at: string }) => [p.id, p.created_at]),
      ),
      { from: data.from, to: data.to },
    )[0]!;

    // Only the caller's own figures leave the server — no clinic revenue, no rate.
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
      lines: (treatments ?? []).map((t: any) => ({
        id: t.id as string,
        performedAt: t.performed_at as string,
        name: t.name as string,
        patient: t.patients ? `${t.patients.first_name} ${t.patients.last_name}` : "—",
        share:
          Math.round(Number(t.price ?? 0) * Number(t.commission_rate_snapshot ?? rate)) / 100,
      })),
    };
  });

/** Manager-only: set a staff member's commission percentage. */
export const setCommissionRate = createServerFn({ method: "POST" })
  .validator((data: { userId: string; rate: number }) => parseInput(schemas.SetCommissionRate, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "setCommissionRate");
    const rate = Math.min(100, Math.max(0, Number(data.rate) || 0));
    const supabaseAdmin = await adminClient(context);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ commission_rate: rate })
      .eq("id", data.userId);
    if (error) throw new Error(error.message);
    await audit(ctx, "staff.commission", "profiles", data.userId, null, { rate });
    return { ok: true };
  });

/* ------------------------------------------------------------------ */
/* Practitioner self-service profile updates (manager approval)        */
/* ------------------------------------------------------------------ */

/** Staff submit changes to their own profile; a manager must approve them. */
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "submitProfileChange");
    if (!data.fullName?.trim()) throw new Error("Full name is required");
    const { error } = await ctx.supabase.from("profile_change_requests").insert({
      clinic_id: clinicIdOf(context),
      user_id: ctx.userId,
      full_name: data.fullName.trim(),
      job_title: data.jobTitle?.trim() || null,
      registration_body: data.registrationBody?.trim() || null,
      registration_number: data.registrationNumber?.trim() || null,
      note: data.note?.trim() || null,
    });
    if (error) throw new Error(error.message);
    await audit(ctx, "profile.change_requested", "profile_change_requests", ctx.userId, null);
    return { ok: true };
  });

/** Staff update their own profile details immediately (no approval queue). */
export const saveMyProfile = createServerFn({ method: "POST" })
  .validator(
    (data: {
      fullName: string;
      jobTitle?: string;
      registrationBody?: string;
      registrationNumber?: string;
    }) => parseInput(schemas.SaveMyProfile, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "saveMyProfile");
    if (!data.fullName?.trim()) throw new Error("Full name is required");
    const supabaseAdmin = await adminClient(context);
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName.trim(),
        job_title: data.jobTitle?.trim() || null,
        registration_body: data.registrationBody?.trim() || null,
        registration_number: data.registrationNumber?.trim() || null,
      })
      .eq("id", ctx.userId);
    if (error) throw new Error(error.message);
    await audit(ctx, "profile.updated", "profiles", ctx.userId, null);
    return { ok: true };
  });

/** The signed-in staff member's own profile plus their request history. */
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const identity = await authorize(ctx, "getMyProfile");
    const { data: requests } = await ctx.supabase
      .from("profile_change_requests")
      .select("*")
      .eq("user_id", ctx.userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return {
      profile: identity.profile,
      isManager: identity.isManager,
      requests: requests ?? [],
    };
  });

/** Manager-only: every profile change request awaiting or past review. */
export const listProfileChangeRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "listProfileChangeRequests");
    const supabaseAdmin = await adminClient(context);
    const [{ data: requests }, { data: profiles }] = await Promise.all([
      supabaseAdmin
        .from("profile_change_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabaseAdmin.from("profiles").select("id, full_name, job_title, registration_body, registration_number"),
    ]);
    return (requests ?? []).map((r: any) => ({
      ...r,
      current: (profiles ?? []).find((p: any) => p.id === r.user_id) ?? null,
    }));
  });

/** Manager-only: approve (applies the change) or decline a request. */
export const reviewProfileChange = createServerFn({ method: "POST" })
  .validator((data: { id: string; approve: boolean; reviewerNote?: string }) => parseInput(schemas.ReviewProfileChange, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "reviewProfileChange");
    const supabaseAdmin = await adminClient(context);
    const { data: req, error: reqError } = await supabaseAdmin
      .from("profile_change_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (reqError) throw new Error(reqError.message);
    if (!req) throw new Error("Request not found");
    if (req.status !== "pending") throw new Error("This request has already been reviewed");

    if (data.approve) {
      const { error } = await supabaseAdmin
        .from("profiles")
        .update({
          full_name: req.full_name ?? "",
          job_title: req.job_title,
          registration_body: req.registration_body,
          registration_number: req.registration_number,
        })
        .eq("id", req.user_id);
      if (error) throw new Error(error.message);
    }

    // Not atomic with the profile write above: if this fails after an approval,
    // the change is applied but the request stays pending and re-approvable.
    const { error: reviewError } = await supabaseAdmin
      .from("profile_change_requests")
      .update({
        status: data.approve ? "approved" : "declined",
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
        reviewer_note: data.reviewerNote?.trim() || null,
      })
      .eq("id", data.id);
    if (reviewError) throw new Error(reviewError.message);

    await audit(
      ctx,
      data.approve ? "profile.change_approved" : "profile.change_declined",
      "profile_change_requests",
      data.id,
      null,
    );
    return { ok: true };
  });

/** Save a staff member's profile picture. Managers may update another user's avatar. */
export const setMyAvatar = createServerFn({ method: "POST" })
  .validator((data: { path: string | null; targetUserId?: string }) => parseInput(schemas.SetMyAvatar, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "setMyAvatar");
    const targetUserId = data.targetUserId ?? ctx.userId;
    if (targetUserId !== ctx.userId) await requireOwner(ctx);
    const supabaseAdmin = await adminClient(context);
    const client = targetUserId === ctx.userId ? ctx.supabase : supabaseAdmin;
    const { error } = await client.from("profiles").update({ avatar_url: data.path }).eq("id", targetUserId);
    if (error) throw new Error(error.message);
    await audit(ctx, "profile.avatar_updated", "profiles", targetUserId, null);
    return { ok: true };
  });

/** A staff member's uploaded work documents. Managers may view another user's file. */
export const listMyDocuments = createServerFn({ method: "GET" })
  .validator((data: { targetUserId?: string }) => parseInput(schemas.ListMyDocuments, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await authorize(ctx, "listMyDocuments");
    const targetUserId = data.targetUserId ?? ctx.userId;
    if (targetUserId !== ctx.userId && !identity.isManager) {
      throw new Error("Only managers can open staff documents");
    }
    const supabaseAdmin = await adminClient(context);
    const client = targetUserId === ctx.userId ? ctx.supabase : supabaseAdmin;
    const { data: rows, error } = await client
      .from("staff_documents")
      .select("*")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Record a work document uploaded to the staff-files bucket. */
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "addMyDocument");
    if (!data.title?.trim()) throw new Error("A document title is required");
    const { error } = await ctx.supabase.from("staff_documents").insert({
      user_id: ctx.userId,
      title: data.title.trim().slice(0, 120),
      category: data.category || "other",
      path: data.path,
      file_name: data.file_name,
      file_type: data.file_type ?? null,
      file_size: data.file_size ?? null,
    });
    if (error) throw new Error(error.message);
    await audit(ctx, "profile.document_added", "staff_documents", null, null);
    return { ok: true };
  });

/** Remove one of the signed-in staff member's work documents. */
export const deleteMyDocument = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => parseInput(schemas.DeleteMyDocument, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await authorize(ctx, "deleteMyDocument");
    // Scoped to the caller: deleting by ID alone let any staff member remove any
    // other's work documents. No manager path depends on this - the delete control
    // is behind !readOnly, and team/$id renders StaffDocuments read-only.
    const { error } = await ctx.supabase
      .from("staff_documents")
      .delete()
      .eq("id", data.id)
      .eq("user_id", identity.userId);
    if (error) throw new Error(error.message);
    await audit(ctx, "profile.document_removed", "staff_documents", data.id, null);
    return { ok: true };
  });

/** Staff profiles: all staff can view details; documents stay manager/self; edit is manager-only in UI. */
export const getStaffProfile = createServerFn({ method: "GET" })
  .validator((data: { userId: string }) => parseInput(schemas.GetStaffProfile, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await authorize(ctx, "getStaffProfile");
    const isSelf = data.userId === ctx.userId;
    const canViewPrivateDetails = true;
    const canViewDocuments = identity.isManager || isSelf;
    const canViewCommission = identity.isManager;

    const supabaseAdmin = await adminClient(context);
    const now = new Date().toISOString();
    const [{ data: profile }, { data: roles }, { data: docs }, users, { data: requests }, { data: archived }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
        supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId),
        supabaseAdmin
          .from("staff_documents")
          .select(canViewDocuments ? "*" : "category")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false }),
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
        identity.isOwner
          ? supabaseAdmin
              .from("profile_change_requests")
              .select("*")
              .eq("user_id", data.userId)
              .order("created_at", { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [] as never[] }),
        supabaseAdmin
          .from("ex_team_members")
          .select("full_name, email, role, retain_until, revoked_at")
          .eq("user_id", data.userId)
          .is("purged_at", null)
          .gt("retain_until", now)
          .maybeSingle(),
      ]);
    const authUser = users.data?.users?.find((u) => u.id === data.userId);
    const filled = staffArchiveIdentity({
      profileName: (archived?.full_name as string | undefined) || profile?.full_name,
      metaName: (authUser?.user_metadata as { full_name?: string } | undefined)?.full_name,
      email: (archived?.email as string | null | undefined) || authUser?.email,
    });
    const role =
      (roles ?? []).find((r) => r.role !== "patient")?.role ??
      (archived?.role as string | undefined) ??
      "";
    const presentCategories = [
      ...new Set((docs ?? []).map((d: { category: string }) => d.category).filter(Boolean)),
    ];
    const safeProfile = profile
      ? {
          ...profile,
          full_name: filled.fullName || profile.full_name,
          commission_rate: canViewCommission ? profile.commission_rate : null,
        }
      : filled.fullName
        ? {
            id: data.userId,
            full_name: filled.fullName,
            job_title: null,
            registration_body: null,
            registration_number: null,
            avatar_url: null,
            commission_rate: null,
          }
        : null;

    return {
      profile: safeProfile,
      role,
      email: filled.email,
      revoked: Boolean(archived),
      daysRemaining: archived?.retain_until ? daysRemainingUntil(String(archived.retain_until)) : 0,
      documents: canViewDocuments ? (docs ?? []) : [],
      presentCategories,
      canViewDocuments,
      canViewPrivateDetails,
      requests: identity.isOwner ? (requests ?? []) : [],
      // "What can this person actually do" — only the management tier needs it,
      // and only they can act on the answer.
      capabilities: identity.isManager && !archived ? await effectiveCapabilities(ctx, data.userId) : null,
    };
  });

/** Retention insight: rolling rate, at-risk patients, cohorts and per-treatment repeat rates. */
export const getRetention = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const identity = await authorize(ctx, "getRetention");
    const { buildRetention } = await import("./retention.server");
    const supabase = ctx.supabase;
    // 5-year chart + 365-day rolling lookback.
    const sixYearsAgo = new Date(Date.now() - 6 * 365 * 86400000).toISOString();

    const [{ data: patients }, { data: treatments }, { data: appointments }, { data: profiles }, { data: outreach }] =
      await Promise.all([
        supabase.from("patients").select("id, title, first_name, last_name, status, email, phone, created_at"),
        supabase
          .from("treatments")
          .select("patient_id, practitioner_id, name, price, performed_at, next_due_at")
          .gte("performed_at", sixYearsAgo),
        supabase.from("appointments").select("patient_id, practitioner_id, starts_at, status"),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("retention_outreach").select("patient_id, created_at"),
      ]);

    const practitionerNames = new Map<string, string>(
      (profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]),
    );

    // Only a practitioner has a book of their own to scope to; other staff who
    // hold the permission (e.g. a coordinator) see the whole clinic.
    const scoped = scopeFor(identity, "getRetention");

    const result = buildRetention({
      patients: (patients ?? []) as any,
      treatments: (treatments ?? []) as any,
      appointments: (appointments ?? []) as any,
      outreach: (outreach ?? []) as any,
      practitionerNames,
      practitionerId: scoped,
    });

    const practitioners = identity.isManager
      ? [...practitionerNames.entries()].map(([userId, fullName]) => ({ userId, fullName }))
      : [];

    return { ...result, isManager: identity.isManager, practitioners };
  });

/**
 * Record that a lapsing patient has been contacted by hand (phone, mailto,
 * portal message). This is a contact log, not a delivery receipt — those live
 * on `communications` once Phase 8 starts draining the outbox.
 */
export const logRetentionOutreach = createServerFn({ method: "POST" })
  .validator((data: { patient_id: string; channel?: string; note?: string }) => parseInput(schemas.LogRetentionOutreach, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "logRetentionOutreach");
    const { error } = await ctx.supabase.from("retention_outreach").insert({
      clinic_id: clinicIdOf(context),
      patient_id: data.patient_id,
      contacted_by: ctx.userId,
      channel: data.channel ?? "message",
      note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    await audit(ctx, "retention.contacted", "patients", data.patient_id, data.patient_id, {
      channel: data.channel ?? "message",
    });
    return { ok: true };
  });

/**
 * Recall a lapsing patient by real email or text through the outbox. Marketing
 * purpose on purpose: a recall promotes a repeat treatment, so it respects the
 * patient's marketing opt-ins under PECR. Unlike the manual contact log above,
 * the outreach row carries the communication id, so retention history can show
 * whether the message actually left and was delivered.
 */
export const sendRecall = createServerFn({ method: "POST" })
  .validator(
    (data: { patient_id: string; channel: "email" | "sms"; subject?: string; body: string }) =>
      parseInput(schemas.SendRecall, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "sendRecall");
    const { enqueueCommunication: enqueue } = await import("./comms/enqueue.server");
    const { id: communicationId } = await enqueue(ctx.supabase, {
      clinicId: clinicIdOf(context),
      patientId: data.patient_id,
      channel: data.channel,
      purpose: "marketing",
      subject: data.subject ?? null,
      body: data.body,
      templateKey: "recall",
      relatedEntity: "retention_outreach",
      createdBy: ctx.userId,
    });
    const { error } = await ctx.supabase.from("retention_outreach").insert({
      clinic_id: clinicIdOf(context),
      patient_id: data.patient_id,
      contacted_by: ctx.userId,
      channel: data.channel,
      communication_id: communicationId,
    });
    if (error) throw new Error(error.message);
    await audit(ctx, "retention.recall_sent", "communications", communicationId, data.patient_id, {
      channel: data.channel,
    });
    return { ok: true, communication_id: communicationId };
  });

/** Create a recall task for a practitioner or receptionist to chase a patient. */
export const createRecallTask = createServerFn({ method: "POST" })
  .validator(
    (data: {
      patient_id: string;
      note?: string;
      recipients: { id: string; label: string }[];
    }) => parseInput(schemas.CreateRecallTask, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await authorize(ctx, "createRecallTask");
    const requested = data.recipients.length
      ? data.recipients
      : [{ id: ctx.userId, label: identity.profile?.full_name ?? "The team" }];

    // Skip anyone who already has an open (not completed) recall for this patient,
    // so the same follow-up never lands twice in "My tasks".
    const { data: openTasks } = await ctx.supabase
      .from("recall_tasks")
      .select("id, assigned_to, group_id, note")
      .eq("patient_id", data.patient_id)
      .neq("status", "completed");
    const note = (data.note ?? "").trim();
    // Same note already open → reuse that group (don't spawn a second chase card).
    const sameNote = (openTasks ?? []).filter(
      (t: { note?: string | null }) => (t.note ?? "").trim() === note,
    );
    const pool = sameNote.length ? sameNote : [];
    const alreadyAssigned = new Set(
      (sameNote.length ? sameNote : openTasks ?? []).map((t: { assigned_to: string }) => t.assigned_to),
    );
    const recipients = requested.filter((r) => !alreadyAssigned.has(r.id));
    if (!recipients.length) {
      return {
        ok: true,
        duplicate: true,
        group_id: (sameNote[0] ?? openTasks?.[0])?.group_id ?? null,
      };
    }
    // Join an existing same-note group when present; otherwise start a new shared group.
    const groupId =
      (pool[0]?.group_id as string | undefined) ||
      (pool[0]?.id as string | undefined) ||
      crypto.randomUUID();
    const { error } = await ctx.supabase.from("recall_tasks").insert(
      recipients.map((r) => ({
        clinic_id: clinicIdOf(context),
        patient_id: data.patient_id,
        group_id: groupId,
        assigned_to: r.id,
        assigned_label: r.label,
        created_by: ctx.userId,
        note: data.note ?? null,
        status: "open" as const,
      })),
    );
    if (error) throw new Error(error.message);
    await audit(ctx, "recall_task.created", "patients", data.patient_id, data.patient_id, {
      assigned_to: recipients.map((r) => r.label).join(", "),
    });
    return { ok: true, group_id: groupId };
  });

/**
 * Manager edit: change who the chase-up is assigned to and/or the note.
 * Keeps shared status across the group and stamps reassigned_at when the
 * assignee set changes so the patient timeline shows the new hand-off time.
 */
export const updateRecallTask = createServerFn({ method: "POST" })
  .validator(
    (data: {
      task_id: string;
      recipients: { id: string; label: string }[];
      note?: string;
    }) => parseInput(schemas.UpdateRecallTask, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "updateRecallTask");
    if (!data.recipients.length) throw new Error("Pick at least one team member");

    const { data: target, error: targetErr } = await ctx.supabase
      .from("recall_tasks")
      .select("*")
      .eq("id", data.task_id)
      .maybeSingle();
    if (targetErr) throw new Error(targetErr.message);
    if (!target) throw new Error("Recall task not found");

    const groupId = (target.group_id as string) || (target.id as string);
    const { data: peers, error: peersErr } = await ctx.supabase
      .from("recall_tasks")
      .select("*")
      .eq("group_id", groupId);
    // Older rows may lack group_id; fall back to the single task.
    const group = peersErr || !peers?.length ? [target] : peers;

    // Ensure every row shares a group id so status stays linked.
    if (!target.group_id) {
      await ctx.supabase.from("recall_tasks").update({ group_id: groupId }).eq("id", target.id);
    }

    const now = new Date().toISOString();
    const note = data.note !== undefined ? data.note : ((target.note as string | null) ?? null);
    const template = group[0] as any;
    const prevIds = new Set(group.map((g: any) => g.assigned_to as string));
    const nextIds = new Set(data.recipients.map((r) => r.id));
    const assigneesChanged =
      prevIds.size !== nextIds.size || [...prevIds].some((id) => !nextIds.has(id));
    const assigneesAdded = data.recipients.some((r) => !prevIds.has(r.id));
    const assigneesRemoved = group.some((g: any) => !nextIds.has(g.assigned_to as string));
    const reassignedAt = assigneesAdded
      ? now
      : assigneesRemoved
        ? null
        : ((template.reassigned_at as string | null) ?? null);

    const shared = {
      clinic_id: template.clinic_id ?? clinicIdOf(context),
      patient_id: template.patient_id,
      group_id: groupId,
      created_by: template.created_by ?? ctx.userId,
      note,
      status: template.status,
      contacted_at: template.contacted_at,
      contacted_by: template.contacted_by,
      completed_at: template.completed_at,
      completed_by: template.completed_by,
      status_by_label: template.status_by_label,
      reassigned_at: reassignedAt,
      updated_at: now,
    };

    const toRemove = group.filter((g: any) => !nextIds.has(g.assigned_to));
    if (toRemove.length) {
      const supabaseAdmin = await adminClient(context);
      const { error } = await supabaseAdmin
        .from("recall_tasks")
        .delete()
        .in(
          "id",
          toRemove.map((g: any) => g.id),
        );
      if (error) throw new Error(error.message);
    }

    const existingByAssignee = new Map(
      group.filter((g: any) => nextIds.has(g.assigned_to)).map((g: any) => [g.assigned_to as string, g]),
    );

    for (const r of data.recipients) {
      const existing = existingByAssignee.get(r.id);
      if (existing) {
        const { error } = await ctx.supabase
          .from("recall_tasks")
          .update({
            assigned_label: r.label,
            note,
            reassigned_at: shared.reassigned_at,
            updated_at: now,
            group_id: groupId,
          })
          .eq("id", existing.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await ctx.supabase.from("recall_tasks").insert({
          ...shared,
          assigned_to: r.id,
          assigned_label: r.label,
          created_at: template.created_at ?? now,
        });
        if (error) throw new Error(error.message);
      }
    }

    await audit(ctx, "recall_task.updated", "patients", template.patient_id, template.patient_id, {
      assigned_to: data.recipients.map((r) => r.label).join(", "),
      reassigned: assigneesChanged,
    });
    return { ok: true, group_id: groupId, reassigned: assigneesChanged };
  });

/**
 * Move a recall along its lifecycle: open -> contacted -> completed.
 * The whole assignment group moves together, so a practitioner marking it
 * off is instantly visible to the front desk (and the other way round) and
 * the patient never gets chased twice.
 */
export const setRecallTaskStatus = createServerFn({ method: "POST" })
  .validator((data: { task_id: string; status: "open" | "contacted" | "completed" }) => parseInput(schemas.SetRecallTaskStatus, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await authorize(ctx, "setRecallTaskStatus");
    const now = new Date().toISOString();
    const actor = identity.profile?.full_name || identity.email || "A team member";
    const { data: target } = await ctx.supabase
      .from("recall_tasks")
      .select("id, group_id, patient_id, assigned_to")
      .eq("id", data.task_id)
      .maybeSingle();
    if (!target) throw new Error("Recall task not found");

    // Assignees in the group can progress it; managers/front desk can too so
    // chase-ups stay visible and actionable from either side of the clinic.
    if (!identity.isManager) {
      const isFrontDesk = identity.roles.includes("front_desk");
      let assigneeIds = [target.assigned_to as string | null];
      if (target.group_id) {
        const { data: peers } = await ctx.supabase
          .from("recall_tasks")
          .select("assigned_to")
          .eq("group_id", target.group_id);
        assigneeIds = (peers ?? []).map((p: { assigned_to: string | null }) => p.assigned_to);
      }
      const isAssignee = assigneeIds.includes(ctx.userId);
      if (!isAssignee && !isFrontDesk) {
        throw new Error("Only the assigned team member can update this recall task");
      }
    }

    const patch: Record<string, unknown> = {
      status: data.status,
      contacted_at: data.status === "open" ? null : now,
      completed_at: data.status === "completed" ? now : null,
      contacted_by: data.status === "open" ? null : ctx.userId,
      completed_by: data.status === "completed" ? ctx.userId : null,
      status_by_label: data.status === "open" ? null : actor,
    };
    const query = ctx.supabase.from("recall_tasks").update(patch);
    const { error } = target.group_id
      ? await query.eq("group_id", target.group_id)
      : await query.eq("id", data.task_id);
    if (error) throw new Error(error.message);
    if (target.patient_id) {
      await audit(ctx, "recall_task.status", "patients", target.patient_id, target.patient_id, {
        status: data.status,
        by: actor,
      });
    }
    return { ok: true };
  });

/**
 * Retract a recall chase-up. Pass assignee_ids to remove only those people from
 * the group; omit it (or pass every assignee) to retract the whole assignment.
 */
export const deleteRecallTask = createServerFn({ method: "POST" })
  .validator((data: { task_id: string; assignee_ids?: string[] }) => parseInput(schemas.DeleteRecallTask, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "deleteRecallTask");
    const { data: target } = await ctx.supabase
      .from("recall_tasks")
      .select("id, group_id, patient_id, assigned_to, assigned_label")
      .eq("id", data.task_id)
      .maybeSingle();
    if (!target) return { ok: true, removed: [] as string[] };

    const groupId = (target.group_id as string | null) ?? null;
    const { data: peers } = groupId
      ? await ctx.supabase.from("recall_tasks").select("id, assigned_to, assigned_label").eq("group_id", groupId)
      : { data: [target] };
    const group = peers?.length ? peers : [target];

    const pick = data.assignee_ids?.length
      ? new Set(data.assignee_ids)
      : new Set(group.map((g: any) => g.assigned_to as string));
    const toRemove = group.filter((g: any) => pick.has(g.assigned_to));
    if (!toRemove.length) return { ok: true, removed: [] as string[] };

    const ids = toRemove.map((g: any) => g.id as string);
    const supabaseAdmin = await adminClient(context);
    const { data: deleted, error } = await supabaseAdmin
      .from("recall_tasks")
      .delete()
      .in("id", ids)
      .select("id");
    if (error) throw new Error(error.message);
    if (!deleted?.length) throw new Error("Could not retract assignment");

    const remaining = group.filter((g: any) => !pick.has(g.assigned_to));
    if (remaining.length > 0) {
      const remainingIds = remaining.map((g: any) => g.id as string);
      const { error: clearErr } = await supabaseAdmin
        .from("recall_tasks")
        .update({ reassigned_at: null, updated_at: new Date().toISOString() })
        .in("id", remainingIds);
      if (clearErr) throw new Error(clearErr.message);
    }

    const removed = toRemove
      .map((g: any) => (g.assigned_label as string) || "Assignee")
      .filter(Boolean);
    if (target.patient_id) {
      await audit(ctx, "recall_task.delete", "patients", target.patient_id, target.patient_id, {
        assignees: removed,
      });
    }
    return { ok: true, removed };
  });

export const listRecallTasks = createServerFn({ method: "GET" })
  .validator((data: { patient_id: string }) => parseInput(schemas.ListRecallTasks, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "listRecallTasks");
    const { data: rows, error } = await ctx.supabase
      .from("recall_tasks")
      .select("*")
      .eq("patient_id", data.patient_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/**
 * One dashboard card per chase-up. A recall can have several assignee rows that
 * share a group_id; managers used to see every copy. Prefer the signed-in
 * user's row when present.
 */
function collapseOpenRecallRows<
  T extends {
    id: string;
    group_id?: string | null;
    assigned_to?: string | null;
    patient_id?: string;
    note?: string | null;
    created_at?: string;
  },
>(rows: T[], userId: string): T[] {
  const byGroup = new Map<string, T>();
  for (const row of rows) {
    const key = row.group_id || row.id;
    const prev = byGroup.get(key);
    if (!prev || (row.assigned_to === userId && prev.assigned_to !== userId)) {
      byGroup.set(key, row);
    }
  }
  // True duplicates (same patient + note, different groups) also collapse.
  const byChase = new Map<string, T>();
  for (const row of byGroup.values()) {
    const key = `${row.patient_id}::${(row.note ?? "").trim()}`;
    const prev = byChase.get(key);
    if (!prev || (row.assigned_to === userId && prev.assigned_to !== userId)) {
      byChase.set(key, row);
    }
  }
  return [...byChase.values()].sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  );
}

/** Open recall/follow-up tasks for the dashboard: mine, or all for managers. */
export const listOpenRecallTasks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const identity = await authorize(ctx, "listOpenRecallTasks");
    let query = ctx.supabase
      .from("recall_tasks")
      .select("*, patients(id, first_name, last_name, phone, email)")
      .neq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(50);
    const scoped = scopeFor(identity, "listOpenRecallTasks");
    if (scoped) query = query.eq("assigned_to", scoped);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return collapseOpenRecallRows(rows ?? [], ctx.userId).slice(0, 25);
  });

/** Move an appointment to a new start time (keeps or updates its duration). */
export const rescheduleAppointment = createServerFn({ method: "POST" })
  .validator(
    (data: { id: string; starts_at: string; duration_minutes?: number; practitioner_id?: string }) => parseInput(schemas.RescheduleAppointment, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "rescheduleAppointment");
    const ctx = context as Ctx;
    const start = new Date(data.starts_at);
    if (Number.isNaN(start.getTime())) throw new Error("Invalid date and time");
    const { data: current } = await ctx.supabase
      .from("appointments")
      .select("starts_at, ends_at, practitioner_id, patient_id, treatment_name, treatment_number")
      .eq("id", data.id)
      .maybeSingle();
    let minutes = data.duration_minutes;
    if (!minutes) {
      minutes =
        current?.starts_at && current?.ends_at
          ? Math.max(
              5,
              Math.round(
                (new Date(current.ends_at).getTime() - new Date(current.starts_at).getTime()) / 60000,
              ),
            )
          : 30;
    }
    const startsAt = start.toISOString();
    const endsAt = new Date(start.getTime() + minutes * 60000).toISOString();
    const practitionerId = data.practitioner_id || current?.practitioner_id;
    await assertNoPractitionerOverlap(ctx.supabase, {
      practitionerId,
      startsAt,
      endsAt,
      excludeAppointmentId: data.id,
    });
    const patch: Record<string, unknown> = {
      starts_at: startsAt,
      ends_at: endsAt,
      stage: "booked",
      status: "booked" as const,
    };
    if (data.practitioner_id) patch["practitioner_id"] = data.practitioner_id;
    const { error } = await ctx.supabase.from("appointments").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (current?.patient_id) {
      await notifyBookingChange(ctx, {
        appointmentId: data.id,
        patientId: current.patient_id as string,
        treatmentName: (current.treatment_name as string) ?? "your treatment",
        treatmentNumber: (current.treatment_number as number) ?? null,
        startsAt,
        practitionerId: (practitionerId as string) ?? null,
      });
      // Reminders for the old time are stale; requeue for the new one.
      await cancelPendingCommunications(ctx, data.id, "reminder");
      await queueAppointmentReminders(ctx, {
        appointmentId: data.id,
        patientId: current.patient_id as string,
        treatmentName: (current.treatment_name as string) ?? "your treatment",
        startsAt,
        practitionerId: (practitionerId as string) ?? null,
      });
    }
    await audit(ctx, "update", "appointment", data.id, null, { starts_at: start.toISOString() });
    return { ok: true };
  });

/** Treatment colour overrides chosen by the manager, keyed by lowercase treatment name. */
export const listTreatmentColours = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorize(context as Ctx, "listTreatmentColours");
    const { data } = await (context as Ctx).supabase
      .from("treatment_colours")
      .select("treatment_name, lane, hex");
    const map: Record<string, number | string> = {};
    for (const row of (data ?? []) as { treatment_name: string; lane: number; hex: string | null }[]) {
      map[row.treatment_name] = row.hex ?? row.lane;
    }
    return map;
  });

/** Manager-only: set or clear the colour used for a treatment across the diary. */
export const saveTreatmentColour = createServerFn({ method: "POST" })
  .validator((data: { treatment_name: string; lane: number | null; hex?: string | null }) => parseInput(schemas.SaveTreatmentColour, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "saveTreatmentColour");
    const key = data.treatment_name.trim().toLowerCase();
    if (!key) throw new Error("Treatment name is required");
    const hex = data.hex ? data.hex.trim().toLowerCase() : null;
    if (hex && !/^#[0-9a-f]{6}$/.test(hex)) throw new Error("Invalid colour");
    if (data.lane === null && !hex) {
      const { error } = await ctx.supabase.from("treatment_colours").delete().eq("treatment_name", key);
      if (error) throw new Error(error.message);
      await audit(ctx, "reset", "treatment_colour", key, null, { treatment_name: key });
      return { ok: true };
    }
    const lane = hex ? 1 : data.lane;
    if (!Number.isInteger(lane) || lane! < 1 || lane! > 8) throw new Error("Invalid colour");
    const { error } = await ctx.supabase
      .from("treatment_colours")
      .upsert(
        {
          treatment_name: key,
          lane: lane as number,
          hex,
          updated_by: ctx.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "clinic_id,treatment_name" },
      );
    if (error) throw new Error(error.message);
    await audit(ctx, "update", "treatment_colour", key, null, { treatment_name: key, lane, hex });
    return { ok: true };
  });

/** Saved treatment colour palettes (named themes) for the clinic diary. */
export const listColourThemes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorize(context as Ctx, "listColourThemes");
    const { data } = await (context as Ctx).supabase
      .from("treatment_colour_themes")
      .select("id, name, colours, updated_at")
      .order("name");
    return (data ?? []) as { id: string; name: string; colours: Record<string, number | string>; updated_at: string }[];
  });

/** Manager-only: save the current treatment colours as a named theme. */
export const saveColourTheme = createServerFn({ method: "POST" })
  .validator((data: { name: string }) => parseInput(schemas.SaveColourTheme, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "saveColourTheme");
    const name = data.name.trim();
    if (!name) throw new Error("Theme name is required");
    const { data: rows } = await ctx.supabase.from("treatment_colours").select("treatment_name, lane, hex");
    const colours: Record<string, number | string> = {};
    for (const row of (rows ?? []) as { treatment_name: string; lane: number; hex: string | null }[]) {
      colours[row.treatment_name] = row.hex ?? row.lane;
    }
    const { data: existing } = await ctx.supabase
      .from("treatment_colour_themes")
      .select("id")
      .ilike("name", name)
      .maybeSingle();
    if (existing?.id) {
      const { error } = await ctx.supabase
        .from("treatment_colour_themes")
        .update({ name, colours })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      await audit(ctx, "update", "colour_theme", existing.id, null, { name });
      return { ok: true, id: existing.id, replaced: true };
    }
    const { data: inserted, error } = await ctx.supabase
      .from("treatment_colour_themes")
      .insert({ name, colours, created_by: ctx.userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(ctx, "create", "colour_theme", inserted!.id, null, { name });
    return { ok: true, id: inserted!.id, replaced: false };
  });

/** Manager-only: apply a saved theme to every treatment colour in the diary. */
export const applyColourTheme = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => parseInput(schemas.ApplyColourTheme, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "applyColourTheme");
    const { data: theme, error: themeError } = await ctx.supabase
      .from("treatment_colour_themes")
      .select("id, name, colours")
      .eq("id", data.id)
      .single();
    if (themeError || !theme) throw new Error("Theme not found");
    const colours = (theme.colours ?? {}) as Record<string, number | string>;
    const { error: clearError } = await ctx.supabase
      .from("treatment_colours")
      .delete()
      .neq("treatment_name", "");
    if (clearError) throw new Error(clearError.message);
    const rows = Object.entries(colours).map(([treatment_name, value]) => ({
      treatment_name,
      lane: typeof value === "number" ? value : 1,
      hex: typeof value === "string" ? value : null,
      updated_by: ctx.userId,
      updated_at: new Date().toISOString(),
    }));
    if (rows.length) {
      const { error } = await ctx.supabase
        .from("treatment_colours")
        .upsert(rows, { onConflict: "clinic_id,treatment_name" });
      if (error) throw new Error(error.message);
    }
    await audit(ctx, "apply", "colour_theme", theme.id, null, { name: theme.name });
    return { ok: true, applied: rows.length };
  });

/** Manager-only: delete a saved colour theme. */
export const deleteColourTheme = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => parseInput(schemas.DeleteColourTheme, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "deleteColourTheme");
    const { error } = await ctx.supabase.from("treatment_colour_themes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(ctx, "delete", "colour_theme", data.id, null, {});
    return { ok: true };
  });

/** Full treatment catalogue, including archived items (settings view). */
export const listCatalogueItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorize(context as Ctx, "listCatalogueItems");
    const { data } = await (context as Ctx).supabase
      .from("treatment_catalogue")
      .select("*")
      .order("active", { ascending: false })
      .order("name", { ascending: true });
    return data ?? [];
  });

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

/** Manager-only: create or update a treatment in the clinic catalogue. */
export const saveCatalogueItem = createServerFn({ method: "POST" })
  .validator((data: CatalogueInput) => parseInput(schemas.SaveCatalogueItem, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "saveCatalogueItem");
    const name = (data.name ?? "").trim();
    if (!name) throw new Error("Treatment name is required");
    const row = {
      clinic_id: clinicIdOf(context),
      name,
      category: data.category?.trim() || null,
      description: data.description?.trim() || null,
      price: data.price ?? null,
      interval_days: data.interval_days ?? null,
      duration_minutes: clampDurationMinutes(data.duration_minutes),
      cooling_off_hours: data.cooling_off_hours ?? 0,
      requires_consent: data.requires_consent ?? true,
      active: data.active ?? true,
    };
    if (data.id) {
      const { error } = await ctx.supabase.from("treatment_catalogue").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
      await audit(ctx, "update", "treatment_catalogue", data.id, null, { name });
      return { ok: true, id: data.id };
    }
    const { data: created, error } = await ctx.supabase
      .from("treatment_catalogue")
      .insert(row)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await audit(ctx, "create", "treatment_catalogue", created?.id ?? null, null, { name });
    return { ok: true, id: created?.id ?? null };
  });

/** Manager-only: archive or restore a treatment (kept for historical records). */
export const setCatalogueItemActive = createServerFn({ method: "POST" })
  .validator((data: { id: string; active: boolean }) => parseInput(schemas.SetCatalogueItemActive, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "setCatalogueItemActive");
    const { error } = await ctx.supabase
      .from("treatment_catalogue")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(ctx, data.active ? "restore" : "archive", "treatment_catalogue", data.id, null, {});
    return { ok: true };
  });

/** Clinic contact details shown on documents and messages. */
export const getClinicDetails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorize(context as Ctx, "getClinicDetails");
    const { data } = await (context as Ctx).supabase
      .from("clinics")
      .select("id, name, address, phone, email, reminder_offsets")
      .eq("id", clinicIdOf(context))
      .maybeSingle();
    return data ?? null;
  });

/** Manager-only: update the clinic's contact details. */
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "updateClinicDetails");
    const name = (data.name ?? "").trim();
    if (!name) throw new Error("Clinic name is required");
    const { error } = await ctx.supabase
      .from("clinics")
      .update({
        name,
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
        email: assertEmail(data.email ?? "", "clinic email", true),
        ...(data.reminder_offsets ? { reminder_offsets: data.reminder_offsets } : {}),
      })
      .eq("id", clinicIdOf(context));
    if (error) throw new Error(error.message);
    await audit(ctx, "update", "clinic", clinicIdOf(context), null, { name });
    return { ok: true };
  });

/** Capability grants for manager / receptionist / practitioner (owner edits). */
export const listRolePermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const identity = await authorize(ctx, "listRolePermissions");
    const { data, error } = await ctx.supabase
      .from("role_permissions")
      .select("role, permission, enabled");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { role: string; permission: string; enabled: boolean }[];
    const editableRoles = ["manager", "front_desk", "practitioner"] as const;
    const grants: Record<string, Record<string, boolean>> = {
      manager: {},
      front_desk: {},
      practitioner: {},
    };
    for (const role of editableRoles) {
      for (const key of PERMISSION_KEYS) {
        grants[role]![key] =
          rows.find((r) => r.role === role && r.permission === key)?.enabled ?? false;
      }
    }
    return { grants, canEdit: identity.isOwner };
  });

/** Clinic owner: turn a single capability on or off for a staff role. */
export const setRolePermission = createServerFn({ method: "POST" })
  .validator(
    (data: {
      role: "manager" | "front_desk" | "practitioner";
      permission: string;
      enabled: boolean;
    }) => parseInput(schemas.SetRolePermission, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "setRolePermission");
    await requireStepUp(ctx);
    if (!(PERMISSION_KEYS as readonly string[]).includes(data.permission))
      throw new Error("Unknown permission");
    const { error } = await ctx.supabase
      .from("role_permissions")
      .upsert(
        {
          role: data.role,
          permission: data.permission,
          enabled: data.enabled,
          updated_by: ctx.userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "clinic_id,role,permission" },
      );
    if (error) throw new Error(error.message);
    await audit(ctx, "access.update", "role_permissions", null, null, {
      role: data.role,
      permission: data.permission,
      enabled: data.enabled,
    });
    return { ok: true };
  });

export const getMyNote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await authorize(context as Ctx, "getMyNote");
    const { supabase, userId } = context as Ctx;
    const { data, error } = await supabase
      .from("user_notes")
      .select("body, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { body: (data?.body as string) ?? "", updatedAt: (data?.updated_at as string) ?? null };
  });

export const saveMyNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { body: string }) => ({
    body: sanitizeNoteHtml(parseInput(schemas.SaveMyNote, { body: String(data?.body ?? "") }).body),
  }))
  .handler(async ({ context, data }) => {
    await authorize(context as Ctx, "saveMyNote");
    const { supabase, userId } = context as Ctx;
    const { data: row, error } = await supabase
      .from("user_notes")
      .upsert({ user_id: userId, body: data.body }, { onConflict: "user_id" })
      .select("body, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return { body: row.body as string, updatedAt: row.updated_at as string };
  });

export const getAppointmentNote = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data: { appointment_id: string }) =>
    parseInput(schemas.GetAppointmentNote, { appointment_id: String(data.appointment_id) }),
  )
  .handler(async ({ context, data }) => {
    await authorize(context as Ctx, "getAppointmentNote");
    const { supabase } = context as Ctx;
    const [{ data: row, error }, { data: appt }] = await Promise.all([
      supabase
        .from("appointment_notes")
        .select("body, updated_at, updated_by_label")
        .eq("appointment_id", data.appointment_id)
        .maybeSingle(),
      supabase.from("appointments").select("notes").eq("id", data.appointment_id).maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    const visitBody = plainVisitNote(row?.body as string);
    if (visitBody) {
      return {
        body: visitBody,
        updatedAt: (row?.updated_at as string) ?? null,
        updatedBy: (row?.updated_by_label as string) ?? null,
      };
    }
    // Fall back to booking notes so both surfaces stay in sync.
    const bookingNotes = String((appt as { notes?: string | null } | null)?.notes ?? "");
    const withoutCancel = bookingNotes.replace(/^Cancelled:[^\n]*(?:\n\n)?/, "").trim();
    return {
      body: plainVisitNote(withoutCancel),
      updatedAt: null,
      updatedBy: null,
    };
  });

export const saveAppointmentNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { appointment_id: string; body: string }) =>
    parseInput(schemas.SaveAppointmentNote, {
      appointment_id: String(data.appointment_id),
      // Visit notes render as escaped React text today, so this is not closing a
      // live XSS hole — it stops stored markup being inherited if these notes ever
      // move to the rich-text editor that `saveMyNote` already sanitises for.
      body: plainVisitNote(sanitizeNoteHtml(String(data?.body ?? ""))).slice(0, 20000),
    }),
  )
  .handler(async ({ context, data }) => {
    const identity = await authorize(context as Ctx, "saveAppointmentNote");
    const { supabase, userId } = context as Ctx;
    const [{ data: appt }, { data: me }] = await Promise.all([
      supabase
        .from("appointments")
        .select("clinic_id, patient_id, notes")
        .eq("id", data.appointment_id)
        .maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    ]);
    const { data: row, error } = await supabase
      .from("appointment_notes")
      .upsert(
        {
          appointment_id: data.appointment_id,
          clinic_id: appt?.clinic_id ?? null,
          patient_id: appt?.patient_id ?? null,
          body: data.body,
          updated_by: userId,
          updated_by_label: (me?.full_name as string) ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "appointment_id" },
      )
      .select("body, updated_at, updated_by_label")
      .single();
    if (error) throw new Error(error.message);

    // Keep appointments.notes mirrored (preserve a cancel stamp if present).
    const prior = String((appt as { notes?: string | null } | null)?.notes ?? "");
    const cancelLine = prior.match(/^Cancelled:[^\n]*/)?.[0] ?? null;
    const mirrored = cancelLine
      ? data.body.trim()
        ? `${cancelLine}\n\n${data.body}`
        : cancelLine
      : data.body || null;
    await supabase.from("appointments").update({ notes: mirrored }).eq("id", data.appointment_id);

    return {
      body: plainVisitNote(row.body as string),
      updatedAt: row.updated_at as string,
      updatedBy: (row.updated_by_label as string) ?? null,
    };
  });


/* ---------------------------------------------------------------- */
/* Staff direct chat                                                 */
/* ---------------------------------------------------------------- */

function chatPair(a: string, b: string) {
  return a < b ? ([a, b] as const) : ([b, a] as const);
}

async function assertStaffPeer(ctx: Ctx, peerUserId: string) {
  const identity = await loadIdentity(ctx);
  if (!identity.isStaff) throw new Error("Staff only");
  if (!peerUserId || peerUserId === ctx.userId) throw new Error("Choose a teammate to message");
  const { data: roles } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", peerUserId)
    .in("role", ["owner", "manager", "practitioner", "front_desk"]);
  if (!roles?.length) throw new Error("That person is not on the clinic team");
  return identity;
}

async function getOrCreateConversationId(ctx: Ctx, peerUserId: string) {
  const [userLow, userHigh] = chatPair(ctx.userId, peerUserId);
  const { data: existing } = await ctx.supabase
    .from("staff_conversations")
    .select("id")
    .eq("user_low", userLow)
    .eq("user_high", userHigh)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created, error } = await ctx.supabase
    .from("staff_conversations")
    .insert({ clinic_id: clinicIdOf(ctx), user_low: userLow, user_high: userHigh })
    .select("id")
    .single();
  if (error) {
    // Concurrent create — fetch the row the other request inserted.
    const { data: again } = await ctx.supabase
      .from("staff_conversations")
      .select("id")
      .eq("user_low", userLow)
      .eq("user_high", userHigh)
      .maybeSingle();
    if (again?.id) return again.id as string;
    throw new Error(error.message);
  }
  return created.id as string;
}

/** Open (or create) a 1:1 staff chat and return messages, peer alerts, and read receipts. */
export const getStaffChat = createServerFn({ method: "GET" })
  .validator((data: { peerUserId: string }) => parseInput(schemas.GetStaffChat, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "getStaffChat");
    await assertStaffPeer(ctx, data.peerUserId);
    const conversationId = await getOrCreateConversationId(ctx, data.peerUserId);
    const peer = data.peerUserId;

    const [messagesRes, readsRes, peerProfileRes, alertsRes] = await Promise.all([
      ctx.supabase
        .from("staff_chat_messages")
        .select("id, sender_id, body, attachments, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200),
      ctx.supabase
        .from("staff_conversation_reads")
        .select("user_id, last_read_at")
        .eq("conversation_id", conversationId),
      ctx.supabase
        .from("profiles")
        .select("id, full_name, job_title, avatar_url")
        .eq("id", peer)
        .maybeSingle(),
      // Direct alerts + alert-replies between these two people (not chat pings).
      ctx.supabase
        .from("staff_notifications")
        .select("id, sender_id, recipient_id, title, body, urgent, kind, read_at, created_at")
        .in("kind", ["urgent", "staff_message"])
        .or(
          `and(sender_id.eq.${ctx.userId},recipient_id.eq.${peer}),and(sender_id.eq.${peer},recipient_id.eq.${ctx.userId})`,
        )
        .order("created_at", { ascending: true })
        .limit(200),
    ]);

    // If attachments column isn't migrated yet, fall back so history still loads.
    let messages = messagesRes.data;
    if (messagesRes.error) {
      const missingAttachments =
        /attachments/i.test(messagesRes.error.message) ||
        messagesRes.error.code === "42703" ||
        messagesRes.error.code === "PGRST204";
      if (!missingAttachments) throw new Error(messagesRes.error.message);
      const fallback = await ctx.supabase
        .from("staff_chat_messages")
        .select("id, sender_id, body, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (fallback.error) throw new Error(fallback.error.message);
      messages = fallback.data;
    }

    const reads = readsRes.data;
    const peerProfile = peerProfileRes.data;
    const alerts = alertsRes.data;

    const peerReadAt =
      ((reads ?? []) as { user_id: string; last_read_at: string }[]).find((r) => r.user_id === peer)
        ?.last_read_at ?? null;
    const myReadAt =
      ((reads ?? []) as { user_id: string; last_read_at: string }[]).find((r) => r.user_id === ctx.userId)
        ?.last_read_at ?? null;

    return {
      conversationId,
      peer: {
        id: peer,
        full_name: (peerProfile as { full_name?: string } | null)?.full_name ?? "Teammate",
        job_title: (peerProfile as { job_title?: string | null } | null)?.job_title ?? null,
        avatar_url: (peerProfile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
      },
      peerReadAt,
      myReadAt,
      messages: ((messages ?? []) as {
        id: string;
        sender_id: string;
        body: string;
        attachments?: unknown;
        created_at: string;
      }[]).map((m) => ({
        ...m,
        attachments: Array.isArray(m.attachments) ? m.attachments : [],
        mine: m.sender_id === ctx.userId,
        readByPeer:
          m.sender_id === ctx.userId && peerReadAt != null && peerReadAt >= m.created_at,
      })),
      alerts: (
        (alerts ?? []) as {
          id: string;
          sender_id: string | null;
          recipient_id: string;
          title: string;
          body: string | null;
          urgent: boolean | null;
          kind: string;
          read_at: string | null;
          created_at: string;
        }[]
      )
        .filter((a) => a.sender_id === ctx.userId || a.sender_id === peer)
        .map((a) => ({
          id: a.id,
          sender_id: a.sender_id as string,
          recipient_id: a.recipient_id,
          title: a.title,
          body: a.body,
          urgent: !!a.urgent || a.kind === "urgent",
          kind: a.kind,
          read_at: a.read_at,
          created_at: a.created_at,
          mine: a.sender_id === ctx.userId,
        })),
    };
  });

/** Send a live chat message to a clinic teammate. */
export const sendStaffChatMessage = createServerFn({ method: "POST" })
  .validator(
    (data: {
      peerUserId: string;
      body: string;
      attachments?: { path: string; name: string; type: string; size: number }[];
    }) => parseInput(schemas.SendStaffChatMessage, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "sendStaffChatMessage");
    const identity = await assertStaffPeer(ctx, data.peerUserId);
    const attachments = (data.attachments ?? []).slice(0, 5);
    const body =
      data.body.trim() ||
      (attachments.length === 1 ? "Sent an attachment" : attachments.length > 1 ? "Sent attachments" : "");
    if (!body && attachments.length === 0) throw new Error("Write a message first");
    if (body.length > 4000) throw new Error("Message is too long");

    const conversationId = await getOrCreateConversationId(ctx, data.peerUserId);
    const now = new Date().toISOString();
    const { data: row, error } = await ctx.supabase
      .from("staff_chat_messages")
      .insert({
        conversation_id: conversationId,
        clinic_id: clinicIdOf(context),
        sender_id: ctx.userId,
        body,
        attachments,
        created_at: now,
      })
      .select("id, sender_id, body, attachments, created_at")
      .single();
    if (error) throw new Error(error.message);

    await ctx.supabase
      .from("staff_conversations")
      .update({ updated_at: now })
      .eq("id", conversationId);

    // Sender has read up to this message.
    await ctx.supabase.from("staff_conversation_reads").upsert(
      { conversation_id: conversationId, user_id: ctx.userId, last_read_at: now },
      { onConflict: "conversation_id,user_id" },
    );

    // Lightweight bell notice for the peer (one pending chat ping per sender).
    const from = identity.profile?.full_name || identity.email || "A colleague";
    const { error: clearErr } = await ctx.supabase
      .from("staff_notifications")
      .delete()
      .eq("recipient_id", data.peerUserId)
      .eq("sender_id", ctx.userId)
      .eq("kind", "staff_chat")
      .is("read_at", null);
    if (clearErr) throw new Error(clearErr.message);
    const { error: notifyErr } = await ctx.supabase.from("staff_notifications").insert({
      clinic_id: clinicIdOf(context),
      recipient_id: data.peerUserId,
      sender_id: ctx.userId,
      urgent: false,
      kind: "staff_chat",
      title: `Message from ${from}`,
      body: body.slice(0, 180),
    });
    if (notifyErr) throw new Error(notifyErr.message);

    return {
      conversationId,
      message: { ...row, mine: true, readByPeer: false },
    };
  });

/** Mark the open staff chat as read (drives peer read receipts). */
export const markStaffChatRead = createServerFn({ method: "POST" })
  .validator((data: { peerUserId: string }) => parseInput(schemas.MarkStaffChatRead, data))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await authorize(ctx, "markStaffChatRead");
    await assertStaffPeer(ctx, data.peerUserId);
    const conversationId = await getOrCreateConversationId(ctx, data.peerUserId);
    const now = new Date().toISOString();
    const { error } = await ctx.supabase.from("staff_conversation_reads").upsert(
      { conversation_id: conversationId, user_id: ctx.userId, last_read_at: now },
      { onConflict: "conversation_id,user_id" },
    );
    if (error) throw new Error(error.message);

    // Clear chat pings from this peer in the bell.
    await ctx.supabase
      .from("staff_notifications")
      .update({ read_at: now })
      .eq("recipient_id", ctx.userId)
      .eq("sender_id", data.peerUserId)
      .eq("kind", "staff_chat")
      .is("read_at", null);

    return { ok: true, lastReadAt: now, conversationId };
  });

/* ---------------------------------------------------------------------------
 * Treatment plans (journeys)
 *
 * A plan is a phased course of care for one patient; its milestones are the
 * ordered steps the clinic tracks. These power the journey board, the
 * dashboard "Active skin plans" KPI and the "Active treatment journeys"
 * section. Role defaults on the board (a practitioner opens "My patients"
 * first) are a client-side default, not a data restriction: any staff member
 * may view the whole board.
 * ------------------------------------------------------------------------- */

export const listTreatmentPlans = createServerFn({ method: "GET" })
  .validator((data: { practitioner_id?: string; at_risk_only?: boolean; query?: string }) =>
    parseInput(schemas.ListTreatmentPlans, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "listTreatmentPlans");
    const supabase = (context as Ctx).supabase;

    let planQuery = supabase
      .from("treatment_plans")
      .select(
        "id, patient_id, practitioner_id, catalogue_id, name, phase, status, total_sessions, started_at, patients(first_name, last_name, reference, avatar_url), profiles(full_name)",
      )
      .eq("status", "active")
      .order("started_at", { ascending: true });
    if (data.practitioner_id) planQuery = planQuery.eq("practitioner_id", data.practitioner_id);
    const { data: plans, error } = await planQuery;
    if (error) throw new Error(error.message);

    const planIds = (plans ?? []).map((p: { id: string }) => p.id);
    const patientIds = [...new Set((plans ?? []).map((p: { patient_id: string }) => p.patient_id))];
    const [{ data: milestones }, { data: upcomingAppts }] = await Promise.all([
      planIds.length
        ? supabase
            .from("plan_milestones")
            .select("id, plan_id, idx, title, kind, status, due_date")
            .in("plan_id", planIds)
            .order("idx", { ascending: true })
        : Promise.resolve({ data: [] as any[] }),
      patientIds.length
        ? supabase
            .from("appointments")
            .select("patient_id, starts_at")
            .in("patient_id", patientIds)
            .eq("status", "booked")
            .gte("starts_at", new Date().toISOString())
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const todayISO = clinicDayKey(new Date());
    const hasUpcoming = new Set((upcomingAppts ?? []).map((a: any) => a.patient_id));
    const needle = (data.query ?? "").trim().toLowerCase();

    let rows = (plans ?? []).map((p: any) => {
      const mine = ((milestones ?? []) as any[]).filter((m) => m.plan_id === p.id);
      const done = mine.filter((m) => m.status === "done" || m.status === "skipped").length;
      const next =
        mine.find((m) => m.status === "current") ?? mine.find((m) => m.status === "upcoming") ?? null;
      const overdue = Boolean(next?.due_date && next.due_date < todayISO);
      const atRisk = overdue || !hasUpcoming.has(p.patient_id);
      return {
        id: p.id,
        patientId: p.patient_id,
        patientName: `${p.patients?.first_name ?? ""} ${p.patients?.last_name ?? ""}`.trim(),
        patientReference: p.patients?.reference ?? null,
        avatarUrl: p.patients?.avatar_url ?? null,
        practitionerId: p.practitioner_id,
        practitionerName: p.profiles?.full_name ?? null,
        name: p.name,
        phase: p.phase,
        done,
        total: mine.length || p.total_sessions,
        nextMilestone: next ? { id: next.id, title: next.title, kind: next.kind, dueDate: next.due_date } : null,
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
        (r: any) => r.patientName.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle),
      );
    }
    if (data.at_risk_only) rows = rows.filter((r: any) => r.atRisk);
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
      milestones: { title: string; kind?: "session" | "task" | "conditional"; due_date?: string }[];
    }) => parseInput(schemas.CreateTreatmentPlan, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "createTreatmentPlan");
    const supabase = (context as Ctx).supabase;
    const clinicId = clinicIdOf(context);

    const totalSessions =
      data.total_sessions ?? Math.max(1, data.milestones.filter((m) => (m.kind ?? "task") === "session").length);
    const { data: created, error } = await supabase
      .from("treatment_plans")
      .insert({
        clinic_id: clinicId,
        patient_id: data.patient_id,
        practitioner_id: data.practitioner_id || null,
        catalogue_id: data.catalogue_id || null,
        name: data.name,
        phase: data.phase ?? "consult",
        total_sessions: totalSessions,
        created_by: (context as Ctx).userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: milestoneError } = await supabase.from("plan_milestones").insert(
      data.milestones.map((m, i) => ({
        clinic_id: clinicId,
        plan_id: created.id,
        idx: i + 1,
        title: m.title,
        kind: m.kind ?? "task",
        status: i === 0 ? ("current" as const) : ("upcoming" as const),
        due_date: m.due_date || null,
      })),
    );
    if (milestoneError) throw new Error(milestoneError.message);

    await audit(context as Ctx, "treatment_plan.create", "treatment_plans", created.id, data.patient_id, {
      name: data.name,
      milestones: data.milestones.length,
    });
    return { id: created.id };
  });

export const updatePlanMilestone = createServerFn({ method: "POST" })
  .validator((data: { id: string; status: "upcoming" | "current" | "done" | "skipped" }) =>
    parseInput(schemas.UpdatePlanMilestone, data),
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    await authorize(context as Ctx, "updatePlanMilestone");
    const supabase = (context as Ctx).supabase;

    const { data: updated, error } = await supabase
      .from("plan_milestones")
      .update({
        status: data.status,
        completed_at: data.status === "done" ? new Date().toISOString() : null,
      })
      .eq("id", data.id)
      .select("id, plan_id, idx")
      .single();
    if (error) throw new Error(error.message);

    // Keep the plan honest: promote the next step, and close the plan when
    // every milestone is settled.
    const { data: siblings } = await supabase
      .from("plan_milestones")
      .select("id, idx, status")
      .eq("plan_id", updated.plan_id)
      .order("idx", { ascending: true });
    const open = (siblings ?? []).filter((m: any) => m.status === "upcoming" || m.status === "current");
    if (data.status === "done" || data.status === "skipped") {
      const hasCurrent = (siblings ?? []).some((m: any) => m.status === "current");
      const nextUp = (siblings ?? []).find((m: any) => m.status === "upcoming");
      if (!hasCurrent && nextUp) {
        await supabase.from("plan_milestones").update({ status: "current" }).eq("id", nextUp.id);
      }
      if (open.length === 0) {
        await supabase
          .from("treatment_plans")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", updated.plan_id);
      }
    }

    await audit(context as Ctx, "plan_milestone.update", "plan_milestones", updated.id, null, {
      status: data.status,
    });
    return { ok: true };
  });
