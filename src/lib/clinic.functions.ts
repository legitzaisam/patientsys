import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clinicDayKey, clinicDayRange } from "@/lib/clinic-time";
import { sanitizeNoteHtml } from "@/lib/sanitize-note-html";
import { clampDurationMinutes } from "@/lib/treatment-duration";
import {
  PRACTITIONER_OVERLAP_MESSAGE,
} from "@/lib/appointment-overlap";
import { bookingDetailsMessage, type PaymentLinkKind } from "@/lib/payment-link";
import { assertEmail } from "@/lib/email";

const CLINIC_ID = "11111111-1111-4111-8111-111111111111";

type Ctx = { supabase: any; userId: string; claims: Record<string, unknown> };

/** Readable temporary password for new staff invites (manager shares it out-of-band). */
function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  let raw = "";
  for (const b of bytes) raw += alphabet[b % alphabet.length]!;
  return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 9)}-${raw.slice(9, 12)}`;
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
    .eq("clinic_id", CLINIC_ID)
    .eq("practitioner_id", args.practitionerId)
    .neq("status", "cancelled")
    .lt("starts_at", args.endsAt)
    .gt("ends_at", args.startsAt);
  if (args.excludeAppointmentId) q = q.neq("id", args.excludeAppointmentId);
  const { data, error } = await q.limit(1);
  if (error) throw new Error(error.message);
  if (data?.length) throw new Error(PRACTITIONER_OVERLAP_MESSAGE);
}

/** Capabilities a manager can grant to receptionists and practitioners. */
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

async function loadIdentity(context: Ctx) {
  const [rolesRes, profileRes, patientRes, permsRes] = await Promise.all([
    context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    context.supabase
      .from("profiles")
      .select("id, clinic_id, full_name, job_title, registration_body, registration_number, avatar_url")
      .eq("id", context.userId)
      .maybeSingle(),
    context.supabase.from("patients").select("id, first_name, last_name").eq("user_id", context.userId).maybeSingle(),
    context.supabase.from("role_permissions").select("role, permission, enabled"),
  ]);

  // A failed read here is indistinguishable from "no rows", which would silently
  // strip a manager of every role and reclassify them as a patient. Fail loudly
  // instead, so the caller sees a broken connection rather than wrong access.
  const failed = (
    [
      ["roles", rolesRes],
      ["profile", profileRes],
      ["patient record", patientRes],
      ["permissions", permsRes],
    ] as const
  ).find(([, res]) => res.error);
  if (failed) {
    const [what, res] = failed;
    throw new Error(`Could not load your ${what}: ${res.error.message}`);
  }

  const { data: roles } = rolesRes;
  const { data: profile } = profileRes;
  const { data: patient } = patientRes;
  const { data: perms } = permsRes;
  const roleList: string[] = (roles ?? []).map((r: { role: string }) => r.role);
  const isOwner = roleList.includes("owner");
  const isStaff = roleList.some(
    (r) => r === "owner" || r === "manager" || r === "practitioner" || r === "front_desk",
  );
  /** Management tier (clinic owner or manager) — used for overview UI, not full access. */
  const isManager = isOwner || roleList.includes("manager");
  // Only clinic owners get every capability automatically; managers use role_permissions.
  const permissions: string[] = isOwner
    ? [...PERMISSION_KEYS]
    : Array.from(
        new Set(
          ((perms ?? []) as { role: string; permission: string; enabled: boolean }[])
            .filter((p) => p.enabled && roleList.includes(p.role))
            .map((p) => p.permission),
        ),
      );
  return {
    userId: context.userId,
    email: (context.claims["email"] as string) ?? "",
    roles: roleList,
    isStaff,
    /** Clinic owner — full access; customises manager / staff permissions. */
    isOwner,
    /** Owner or manager role (management portal tier). */
    isManager,
    /** Hard deletes stay with the clinic owner. */
    canDelete: isOwner,
    isPatient: !isStaff,
    /** Capability keys from role_permissions (owners hold every key). */
    permissions,
    profile: profile ?? null,
    patient: patient ?? null,
    /** True when staff must set a new password before using the app (invite / reset). */
    mustChangePassword: await resolveAppMetaFlag(context, "must_change_password"),
    /** True for newly invited staff until they dismiss the welcome dialog. */
    welcomePending: await resolveAppMetaFlag(context, "welcome_pending"),
  };
}

type AppMetaFlag = "must_change_password" | "welcome_pending";

/**
 * Prefer Auth’s live app_metadata over the access-token claim. After admin
 * updates (password change, welcome ack) the JWT can stay stale until refresh.
 */
async function resolveAppMetaFlag(context: Ctx, flag: AppMetaFlag): Promise<boolean> {
  const fromJwt = Boolean(
    (context.claims["app_metadata"] as Record<string, unknown> | undefined)?.[flag],
  );
  if (!fromJwt) return false;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (error || !data.user) return fromJwt;
    return Boolean((data.user.app_metadata as Record<string, unknown> | undefined)?.[flag]);
  } catch {
    return fromJwt;
  }
}

/** Metadata stamped on invited staff — password gate, then one-time team welcome. */
const NEW_STAFF_APP_META = {
  must_change_password: true,
  welcome_pending: true,
} as const;

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

/**
 * Snapshot staff identity into the 90-day ex-team archive.
 * Clinical rows (patients, appointments, treatments, …) are never copied here.
 */
async function archiveExTeamMember(opts: {
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
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const revokedAt = new Date();
  // Replace any prior active archive row for this user.
  await supabaseAdmin
    .from("ex_team_members")
    .delete()
    .eq("user_id", opts.userId)
    .is("purged_at", null);
  const { error } = await supabaseAdmin.from("ex_team_members").insert({
    clinic_id: CLINIC_ID,
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

async function clearExTeamArchive(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("ex_team_members").delete().eq("user_id", userId).is("purged_at", null);
}

/**
 * After 90 days: remove staff-only identity from the archive + HR files.
 * Never deletes patients, appointments, treatments, messages, or audit history.
 * Profiles stay as anonymised stubs so practitioner FKs remain valid.
 */
async function purgeExpiredExTeamMembers() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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


/** Throws unless the caller is a manager or has been granted the capability. */
async function requirePermission(context: Ctx, key: PermissionKey) {
  const identity = await loadIdentity(context);
  if (!identity.isStaff) throw new Error("Staff access only");
  if (!identity.isOwner && !identity.permissions.includes(key)) {
    throw new Error("You do not have access to this area");
  }
  return identity;
}

async function audit(
  context: Ctx,
  action: string,
  entity: string,
  entityId: string | null,
  patientId: string | null,
  meta?: Record<string, unknown>,
) {
  await context.supabase.from("audit_log").insert({
    clinic_id: CLINIC_ID,
    actor_id: context.userId,
    actor_label: (context.claims["email"] as string) ?? null,
    action,
    entity,
    entity_id: entityId,
    patient_id: patientId,
    meta: meta ?? null,
  });
}

/** Signed-in identity. Bootstraps the very first user as clinic owner. */
export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const authUser = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (authUser.error) throw new Error(authUser.error.message);
    const bannedUntil = authUser.data.user?.banned_until;
    if (bannedUntil && new Date(bannedUntil) > new Date()) {
      throw new Error("Your clinic access has been removed. Please contact your manager.");
    }

    let identity = await loadIdentity(context as Ctx);
    if (identity.roles.length === 0 && !identity.patient) {
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("id", { count: "exact", head: true })
        .in("role", ["owner", "manager", "practitioner", "front_desk"]);
      if (!count) {
        await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "owner" });
        await supabaseAdmin
          .from("profiles")
          .update({ clinic_id: CLINIC_ID, job_title: "Clinic Owner" })
          .eq("id", context.userId);
        identity = await loadIdentity(context as Ctx);
      }
    }
    // Anyone linked to a patient record with no staff role is explicitly a patient.
    if (identity.roles.length === 0 && identity.patient) {
      await supabaseAdmin.from("user_roles").insert({ user_id: context.userId, role: "patient" });
      identity = await loadIdentity(context as Ctx);
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
    const supabase = (context as Ctx).supabase;
    const identity = await loadIdentity(context as Ctx);
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
          "*, patients(first_name, last_name, reference, email, phone), profiles(full_name), documents(status, title), appointment_notes(body, updated_at, updated_by_label)",
        )
        .gte("starts_at", todayStart)
        .lt("starts_at", tomorrowStart)
        .order("starts_at", { ascending: true }),
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

    let all = patients.data ?? [];
    let due = (dueRows.data ?? []) as any[];
    let monthTreats = (monthTreatments.data ?? []) as any[];
    let prevMonthTreats = (prevMonthTreatments.data ?? []) as any[];
    let todayAppts = (todayAppointmentsRaw.data ?? []) as any[];
    let dueDates = (dueDatesRaw.data ?? []) as { next_due_at: string; practitioner_id: string | null }[];

    if (isPractitioner && !isManager) {
      due = due.filter((t: any) => t.practitioner_id === identity.userId || !t.practitioner_id);
      dueDates = dueDates.filter((t) => t.practitioner_id === identity.userId || !t.practitioner_id);
      monthTreats = monthTreats.filter((t: any) => t.practitioner_id === identity.userId);
      prevMonthTreats = prevMonthTreats.filter((t: any) => t.practitioner_id === identity.userId);
      todayAppts = todayAppts.filter((a: any) => a.practitioner_id === identity.userId);
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
      if (a.payment_status === "unpaid" || a.payment_status === "deposit_paid") {
        attentionItems.push({
          id: `payment-${a.id}`,
          kind: a.payment_status === "deposit_paid" ? "balance_due" : "payment_due",
          urgency: "urgent",
          title: `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""} — ${a.payment_status === "deposit_paid" ? "balance due" : "unpaid"}`,
          subtitle: `${a.treatment_name}`,
          patientId: a.patient_id,
          appointmentId: a.id,
        });
      }
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
    const supabase = (context as Ctx).supabase;
    const { data, error } = await supabase
      .from("patients")
      .select("id, first_name, last_name, title, date_of_birth, status, reference, last_visit_at, allergies, avatar_url")
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((p: { id: string }) => p.id);
    if (ids.length === 0) return [];

    const [{ data: treatments }, { data: docs }, { data: upcoming }] = await Promise.all([
      supabase.from("treatments").select("patient_id, name, performed_at, next_due_at").in("patient_id", ids),
      supabase.from("documents").select("patient_id, status").in("patient_id", ids),
      supabase
        .from("appointments")
        .select("patient_id, treatment_name, treatment_number, starts_at, status")
        .in("patient_id", ids)
        .gte("starts_at", new Date().toISOString())
        .in("status", ["booked"])
        .order("starts_at", { ascending: true }),
    ]);

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
      return {
        ...p,
        lastTreatment: last ?? null,
        nextDue: due ?? null,
        nextAppointment: next ?? null,
        outstandingDocuments: outstanding,
      };
    });
  });

export const getPatient = createServerFn({ method: "GET" })
  .validator((data: { id: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = (context as Ctx).supabase;
    const { data: patient, error } = await supabase
      .from("patients")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!patient) throw new Error("Patient not found");

    const [treatments, photos, documents, messages, history, upcoming, visitAppts] = await Promise.all([
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
        const fromTable = String(noteRow?.body ?? "").trim();
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
          practitionerName: (a.profiles?.full_name as string) ?? null,
          body,
          updatedAt: (noteRow?.updated_at as string) ?? null,
          updatedBy: (noteRow?.updated_by_label as string) ?? null,
        };
      })
      .filter(Boolean);

    return {
      patient,
      treatments: treatments.data ?? [],
      photos: (photos.data ?? []).map((p: any) => ({ ...p, url: signed[p.id] ?? null })),
      documents: documents.data ?? [],
      messages: messages.data ?? [],
      history: history.data ?? [],
      visitNotes,
      retention,
      nextAppointmentAt: (upcoming.data ?? [])[0]?.starts_at ?? null,
    };
  });

export const getCatalogue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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
  .validator((data: { from: string; to: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
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
    }) => data,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = (context as Ctx).supabase;
    const start = new Date(data.starts_at);
    const endsAt = new Date(start.getTime() + (data.duration_minutes || 30) * 60000).toISOString();
    const payload = {
      clinic_id: CLINIC_ID,
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
      const { error } = await supabase.from("appointments").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
      await audit(context as Ctx, "update", "appointment", data.id, data.patient_id);
      const noteBody = String(data.notes ?? "");
      if (noteBody.trim()) {
        const { data: me } = await supabase.from("profiles").select("full_name").eq("id", context.userId).maybeSingle();
        await supabase.from("appointment_notes").upsert(
          {
            appointment_id: data.id,
            clinic_id: CLINIC_ID,
            patient_id: data.patient_id,
            body: noteBody,
            updated_by: context.userId,
            updated_by_label: (me?.full_name as string) ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "appointment_id" },
        );
      }
      return { id: data.id };
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
          clinic_id: CLINIC_ID,
          patient_id: data.patient_id,
          body: noteBody,
          updated_by: context.userId,
          updated_by_label: (me?.full_name as string) ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "appointment_id" },
      );
    }

    // Confirmation + payment link for email/text (and portal thread).
    const [{ data: patient }, { data: practitioner }] = await Promise.all([
      supabase.from("patients").select("first_name, last_name, email, phone").eq("id", data.patient_id).maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", payload.practitioner_id).maybeSingle(),
    ]);
    const when = start.toLocaleString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    });
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

    // Patient-facing confirmation in their portal thread (email + text release).
    await supabase.from("messages").insert({
      clinic_id: CLINIC_ID,
      patient_id: data.patient_id,
      author: "staff",
      author_id: context.userId,
      body: confirmation,
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
            clinic_id: CLINIC_ID,
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
      channels: { portal: true, email: patient?.email ?? null, sms: patient?.phone ?? null },
      payment_link: payload.payment_status !== "paid",
    });

    return {
      id: created.id as string,
      confirmation,
      email: (patient?.email as string) ?? null,
      phone: (patient?.phone as string) ?? null,
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
    }) => data,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
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
    }) => data,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = (context as Ctx).supabase;
    const payload = {
      clinic_id: CLINIC_ID,
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = (context as Ctx).supabase;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rateRow } = await supabaseAdmin
      .from("profiles")
      .select("commission_rate")
      .eq("id", context.userId)
      .maybeSingle();
    const { data: created, error } = await supabase
      .from("treatments")
      .insert({
        clinic_id: CLINIC_ID,
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
    }) => data,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { error } = await (context as Ctx).supabase.from("treatment_photos").insert({
      clinic_id: CLINIC_ID,
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
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = (context as Ctx).supabase;
    const { data: created, error } = await supabase
      .from("documents")
      .insert({
        clinic_id: CLINIC_ID,
        patient_id: data.patient_id,
        treatment_id: data.treatment_id || null,
        kind: data.kind,
        title: data.title,
        body: data.body || null,
        status: "sent",
        sent_at: new Date().toISOString(),
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await supabase.from("messages").insert({
      clinic_id: CLINIC_ID,
      patient_id: data.patient_id,
      author: "staff",
      author_id: context.userId,
      body: `${data.title} has been sent to you. Please review and sign it in your patient portal.`,
    });
    await audit(context as Ctx, "send", "document", created.id, data.patient_id, { title: data.title });
    return { id: created.id as string };
  });

export const resendDocument = createServerFn({ method: "POST" })
  .validator((data: { id: string; patient_id: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { error } = await (context as Ctx).supabase
      .from("documents")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context as Ctx, "resend", "document", data.id, data.patient_id);
    return { ok: true };
  });

export const sendMessage = createServerFn({ method: "POST" })
  .validator(
    (data: {
      patient_id: string;
      body: string;
      as: "staff" | "patient";
      attachments?: { path: string; name: string; type: string; size: number }[];
    }) => data,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const body = data.body.trim().slice(0, 2000);
    const attachments = (data.attachments ?? []).slice(0, 5);
    if (!body && attachments.length === 0) throw new Error("Message cannot be empty");
    const { error } = await (context as Ctx).supabase.from("messages").insert({
      clinic_id: CLINIC_ID,
      patient_id: data.patient_id,
      author: data.as,
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
    const identity = await loadIdentity(context as Ctx);

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
    // Service-role client bypasses RLS — only show alerts addressed to this user.
    const { data: rows } = await ctx.supabase
      .from("staff_notifications")
      .select("id, title, body, patient_id, appointment_id, read_at, created_at, urgent, sender_id, kind")
      .eq("recipient_id", ctx.userId)
      .is("read_at", null)
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
      audience: "managers" | "front_desk" | "all" | "user";
      recipientId?: string;
      title: string;
      body: string;
      urgent?: boolean;
    }) => data,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isStaff) throw new Error("Staff only");

    let recipients: string[] = [];
    if (data.audience === "user") {
      recipients = data.recipientId ? [data.recipientId] : [];
    } else {
      const wanted =
        data.audience === "managers"
          ? ["owner", "manager"]
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
        clinic_id: CLINIC_ID,
        recipient_id: id,
        sender_id: ctx.userId,
        urgent: !!data.urgent,
        kind: data.urgent ? "urgent" : "staff_message",
        title: `${data.urgent ? "Urgent" : "Message"} from ${from}: ${data.title}`,
        body: data.body,
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
  .validator((data: { practitionerId: string; date: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
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
  .validator((data: { id?: string; all?: boolean }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
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

/** Alerts the signed-in staff member sent recently (seen / waiting per recipient). */
export const listSentStaffAlerts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows, error } = await ctx.supabase
      .from("staff_notifications")
      .select("id, title, body, urgent, kind, recipient_id, read_at, created_at")
      .eq("sender_id", ctx.userId)
      .in("kind", ["urgent", "staff_message"])
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

export const listMessageTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context as Ctx).supabase
      .from("message_templates")
      .select("*")
      .order("category", { ascending: true })
      .order("title", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveMessageTemplate = createServerFn({ method: "POST" })
  .validator((data: { id?: string; title: string; body: string; category?: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = (context as Ctx).supabase;
    const identity = await loadIdentity(context as Ctx);
    if (!identity.isStaff) throw new Error("Staff only");
    const payload = {
      clinic_id: CLINIC_ID,
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
  .validator((data: { id: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const identity = await loadIdentity(context as Ctx);
    if (!identity.canDelete) throw new Error("Only managers can delete templates");
    const { error } = await (context as Ctx).supabase.from("message_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markMessagesRead = createServerFn({ method: "POST" })
  .validator((data: { patient_id: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const supabase = (context as Ctx).supabase;
    const identity = await loadIdentity(context as Ctx);

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
  .validator((data: { id: string; patient_id: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
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
    }) => data,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
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
  .validator((data: { id: string; signed_name: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const name = data.signed_name.trim().slice(0, 120);
    if (!name) throw new Error("Please type your full name to sign");
    const { error } = await (context as Ctx).supabase
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

async function requireOwner(context: Ctx) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "owner")
    .maybeSingle();
  if (!data) throw new Error("Clinic owner access required");
}

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isStaff) throw new Error("Staff only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    }) => data,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireOwner(ctx);
    const email = assertEmail(data.email, "work email")!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
      clinic_id: CLINIC_ID,
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
    }) => data,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireOwner(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).neq("role", "patient");
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role: data.role });
    // Undo revoke / role restore must lift the Auth ban so they can sign in again.
    await clearExTeamArchive(data.userId);
    await unbanAuthUser(data.userId);
    await audit(ctx, "staff.update", "user_roles", data.userId, null, {
      role: data.role,
      ...(data.commissionRate !== undefined ? { commission_rate: patch.commission_rate } : {}),
    });
    return { ok: true };
  });

/**
 * Manager-only: invite a receptionist or practitioner. Creates the account with an
 * auto-generated temporary password (returned once for the manager to share) and
 * requires the invitee to change it on first sign-in.
 * If the email already has an auth user, their password is reset instead.
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
    }) => data,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireOwner(ctx);
    const email = assertEmail(data.email, "work email")!;
    const temporaryPassword = generateTemporaryPassword();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let uid: string | undefined;

    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
      app_metadata: { ...NEW_STAFF_APP_META },
    });

    if (created.error) {
      const msg = (created.error.message || "").toLowerCase();
      const already =
        msg.includes("already been registered") ||
        msg.includes("already registered") ||
        msg.includes("user already exists") ||
        created.error.status === 422;
      if (!already) throw new Error(created.error.message);

      // Email already has an auth user — reset password so invite still works.
      const listed = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (listed.error) throw new Error(listed.error.message);
      const existing = (listed.data.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
      if (!existing) throw new Error("That email is already registered, but the account could not be found to reset.");
      uid = existing.id;
      const updated = await supabaseAdmin.auth.admin.updateUserById(uid, {
        password: temporaryPassword,
        email_confirm: true,
        ban_duration: "none",
        user_metadata: { full_name: data.fullName },
        app_metadata: {
          ...(existing.app_metadata ?? {}),
          ...NEW_STAFF_APP_META,
        },
      });
      if (updated.error) throw new Error(updated.error.message);
    } else {
      if (!created.data.user) throw new Error("Could not create the invitation");
      uid = created.data.user.id;
      // Belt-and-braces: some Auth setups accept createUser but leave password unusable
      // until an explicit updateUserById. Force-set the same temporary password.
      const confirmPw = await supabaseAdmin.auth.admin.updateUserById(uid, {
        password: temporaryPassword,
        email_confirm: true,
        ban_duration: "none",
        app_metadata: { ...NEW_STAFF_APP_META },
      });
      if (confirmPw.error) throw new Error(confirmPw.error.message);
    }

    await supabaseAdmin.from("profiles").upsert({
      id: uid,
      clinic_id: CLINIC_ID,
      full_name: data.fullName,
      job_title: data.jobTitle ?? null,
      registration_body: data.registrationBody ?? null,
      registration_number: data.registrationNumber ?? null,
    });
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid).neq("role", "patient");
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    await clearExTeamArchive(uid);
    await unbanAuthUser(uid);
    await audit(ctx, "staff.invite", "user_roles", uid, null, { email, role: data.role });

    return {
      userId: uid,
      email,
      role: data.role,
      temporaryPassword,
    };
  });


export const revokeStaffAccess = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireOwner(ctx);
    if (data.userId === ctx.userId) throw new Error("You cannot revoke your own access");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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

    await archiveExTeamMember({
      userId: data.userId,
      role: roleRow.role as string,
      email: authUser.data.user?.email ?? "",
      fullName: profile?.full_name ?? "",
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
    await requirePermission(ctx, "team.view");
    await purgeExpiredExTeamMembers();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("ex_team_members")
      .select(
        "id, user_id, email, full_name, job_title, registration_body, registration_number, role, revoked_at, retain_until",
      )
      .eq("clinic_id", CLINIC_ID)
      .is("purged_at", null)
      .gt("retain_until", now)
      .order("revoked_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id as string,
      userId: row.user_id as string,
      email: (row.email as string | null) ?? "",
      fullName: (row.full_name as string) ?? "",
      jobTitle: (row.job_title as string | null) ?? "",
      registrationBody: (row.registration_body as string | null) ?? "",
      registrationNumber: (row.registration_number as string | null) ?? "",
      role: row.role as string,
      revokedAt: row.revoked_at as string,
      retainUntil: row.retain_until as string,
      daysRemaining: Math.max(
        0,
        Math.ceil((new Date(row.retain_until as string).getTime() - Date.now()) / 86400000),
      ),
    }));
  });

/** Restore a former team member within the 90-day window. */
export const restoreExTeamMember = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireOwner(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: archived.full_name || "",
        job_title: archived.job_title,
        registration_body: archived.registration_body,
        registration_number: archived.registration_number,
        ...(archived.commission_rate != null ? { commission_rate: archived.commission_rate } : {}),
      })
      .eq("id", data.userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId).neq("role", "patient");
    await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role });
    await clearExTeamArchive(data.userId);
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
  .validator((data: { userId: string; password: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireOwner(ctx);
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

/** Signed-in staff: replace temporary/reset password and clear the must-change flag. */
export const changeOwnPassword = createServerFn({ method: "POST" })
  .validator((data: { password: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Merge app_metadata so we clear the flag without wiping other Auth keys.
    const existing = await supabaseAdmin.auth.admin.getUserById(ctx.userId);
    if (existing.error) throw new Error(existing.error.message);
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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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


/** Manager-only: accounts (patients and staff) with no email address on file. */
export const listAccountsMissingEmail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    await requireOwner(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
  .validator((data: { patientId: string; email: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireOwner(ctx);
    const email = assertEmail(data.email)!;
    const { error } = await ctx.supabase.from("patients").update({ email }).eq("id", data.patientId);
    if (error) throw new Error(error.message);
    await audit(ctx, "update", "patient", data.patientId, data.patientId);
    return { ok: true };
  });

/** Manager-only: add or correct a staff account's sign-in email. */
export const setStaffEmail = createServerFn({ method: "POST" })
  .validator((data: { userId: string; email: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireOwner(ctx);
    const email = assertEmail(data.email)!;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
  .validator((data: { from: string; to: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requirePermission(ctx, "reports.performance");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { buildStats, buildTrend } = await import("./earnings.server");
    const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString();

    const [{ data: profiles }, { data: roles }, { data: treatments }, { data: appointments }, { data: yearTreatments }, { data: firstSeen }] =
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
        supabaseAdmin.from("treatments").select("practitioner_id, patient_id").gte("performed_at", yearAgo),
        supabaseAdmin.from("patients").select("id, created_at"),
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

    return { rows, totals, clinic, trend };
  });

/** The caller's own earnings and KPIs. Never returns clinic figures or the split percentage. */
export const getMyEarnings = createServerFn({ method: "POST" })
  .validator((data: { from: string; to: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isStaff) throw new Error("Staff access required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

    // Only the caller's own share leaves the server — no clinic revenue, no rate.
    return {
      earnedShare: stats.earnedShare,
      collectedShare: stats.collectedShare,
      outstanding: stats.outstanding,
      treatments: stats.treatments,
      patients: stats.patients,
      newPatients: stats.newPatients,
      retention: stats.retention,
      averageValue: stats.averageValue,
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
  .validator((data: { userId: string; rate: number }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requireOwner(ctx);
    const rate = Math.min(100, Math.max(0, Number(data.rate) || 0));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    }) => data,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isStaff) throw new Error("Staff access only");
    if (!data.fullName?.trim()) throw new Error("Full name is required");
    const { error } = await ctx.supabase.from("profile_change_requests").insert({
      clinic_id: CLINIC_ID,
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

/** The signed-in staff member's own profile plus their request history. */
export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isStaff) throw new Error("Staff access only");
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
    await requirePermission(ctx, "team.approve_changes");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
  .validator((data: { id: string; approve: boolean; reviewerNote?: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await requirePermission(ctx, "team.approve_changes");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

    await supabaseAdmin
      .from("profile_change_requests")
      .update({
        status: data.approve ? "approved" : "declined",
        reviewed_by: ctx.userId,
        reviewed_at: new Date().toISOString(),
        reviewer_note: data.reviewerNote?.trim() || null,
      })
      .eq("id", data.id);

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
  .validator((data: { path: string | null; targetUserId?: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isStaff) throw new Error("Staff access only");
    const targetUserId = data.targetUserId ?? ctx.userId;
    if (targetUserId !== ctx.userId) await requireOwner(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const client = targetUserId === ctx.userId ? ctx.supabase : supabaseAdmin;
    const { error } = await client.from("profiles").update({ avatar_url: data.path }).eq("id", targetUserId);
    if (error) throw new Error(error.message);
    await audit(ctx, "profile.avatar_updated", "profiles", targetUserId, null);
    return { ok: true };
  });

/** A staff member's uploaded work documents. Managers may view another user's file. */
export const listMyDocuments = createServerFn({ method: "GET" })
  .validator((data: { targetUserId?: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isStaff) throw new Error("Staff access only");
    const targetUserId = data.targetUserId ?? ctx.userId;
    if (targetUserId !== ctx.userId) await requireOwner(ctx);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    }) => data,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isStaff) throw new Error("Staff access only");
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
  .validator((data: { id: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isStaff) throw new Error("Staff access only");
    const { error } = await ctx.supabase.from("staff_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(ctx, "profile.document_removed", "staff_documents", data.id, null);
    return { ok: true };
  });

/** Manager-only: full staff profile, documents and recent change requests for a given user. */
export const getStaffProfile = createServerFn({ method: "GET" })
  .validator((data: { userId: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isStaff) throw new Error("Staff only");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, { data: roles }, { data: docs }, users, { data: requests }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", data.userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", data.userId),
      supabaseAdmin.from("staff_documents").select("*").eq("user_id", data.userId).order("created_at", { ascending: false }),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 }),
      supabaseAdmin
        .from("profile_change_requests")
        .select("*")
        .eq("user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    const email = users.data?.users?.find((u) => u.id === data.userId)?.email ?? "";
    const role = (roles ?? []).find((r) => r.role !== "patient")?.role ?? "";
    return { profile, role, email, documents: docs ?? [], requests: requests ?? [] };
  });

/** Retention insight: rolling rate, at-risk patients, cohorts and per-treatment repeat rates. */
export const getRetention = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isStaff) throw new Error("Staff access only");
    if (!identity.isOwner && !identity.permissions.includes("reports.retention"))
      throw new Error("You do not have access to retention reports");
    const { buildRetention } = await import("./retention.server");
    const supabase = ctx.supabase;
    const twoYearsAgo = new Date(Date.now() - 730 * 86400000).toISOString();

    const [{ data: patients }, { data: treatments }, { data: appointments }, { data: profiles }, { data: outreach }] =
      await Promise.all([
        supabase.from("patients").select("id, title, first_name, last_name, status, email, phone, created_at"),
        supabase
          .from("treatments")
          .select("patient_id, practitioner_id, name, price, performed_at, next_due_at")
          .gte("performed_at", twoYearsAgo),
        supabase.from("appointments").select("patient_id, practitioner_id, starts_at, status"),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("retention_outreach").select("patient_id, created_at"),
      ]);

    const practitionerNames = new Map<string, string>(
      (profiles ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]),
    );

    // Only a practitioner has a book of their own to scope to; other staff who
    // hold the permission (e.g. a coordinator) see the whole clinic.
    const scoped =
      identity.isManager || !identity.roles.includes("practitioner") ? null : ctx.userId;

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

/** Record that a lapsing patient has been contacted, so they drop off the recall list. */
export const logRetentionOutreach = createServerFn({ method: "POST" })
  .validator((data: { patient_id: string; channel?: string; note?: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isStaff) throw new Error("Staff access only");
    const { error } = await ctx.supabase.from("retention_outreach").insert({
      clinic_id: CLINIC_ID,
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

/** Create a recall task for a practitioner or receptionist to chase a patient. */
export const createRecallTask = createServerFn({ method: "POST" })
  .validator(
    (data: {
      patient_id: string;
      note?: string;
      recipients: { id: string; label: string }[];
    }) => data,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isStaff) throw new Error("Staff access only");
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
        clinic_id: CLINIC_ID,
        patient_id: data.patient_id,
        group_id: groupId,
        assigned_to: r.id,
        assigned_label: r.label,
        created_by: ctx.userId,
        note: data.note ?? null,
        status: "sent" as const,
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
    }) => data,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isManager) throw new Error("Manager access only");
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
    const prevIds = new Set(group.map((g: any) => g.assigned_to as string));
    const nextIds = new Set(data.recipients.map((r) => r.id));
    const assigneesChanged =
      prevIds.size !== nextIds.size || [...prevIds].some((id) => !nextIds.has(id));

    const template = group[0] as any;
    const shared = {
      clinic_id: template.clinic_id ?? CLINIC_ID,
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
      reassigned_at: assigneesChanged ? now : (template.reassigned_at ?? null),
      updated_at: now,
    };

    const toRemove = group.filter((g: any) => !nextIds.has(g.assigned_to));
    if (toRemove.length) {
      const { error } = await ctx.supabase
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
 * Move a recall along its lifecycle: sent -> contacted -> completed.
 * The whole assignment group moves together, so a practitioner marking it
 * off is instantly visible to the front desk (and the other way round) and
 * the patient never gets chased twice.
 */
export const setRecallTaskStatus = createServerFn({ method: "POST" })
  .validator((data: { task_id: string; status: "sent" | "contacted" | "completed" }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isStaff) throw new Error("Staff access only");
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
      contacted_at: data.status === "sent" ? null : now,
      completed_at: data.status === "completed" ? now : null,
      contacted_by: data.status === "sent" ? null : ctx.userId,
      completed_by: data.status === "completed" ? ctx.userId : null,
      status_by_label: data.status === "sent" ? null : actor,
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
  .validator((data: { task_id: string; assignee_ids?: string[] }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isOwner && !identity.permissions.includes("tasks.delete"))
      throw new Error("You do not have access to delete tasks");
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
    const { error } = await ctx.supabase.from("recall_tasks").delete().in("id", ids);
    if (error) throw new Error(error.message);

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
  .validator((data: { patient_id: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isStaff) throw new Error("Staff access only");
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
    const identity = await loadIdentity(ctx);
    if (!identity.isStaff) throw new Error("Staff access only");
    let query = ctx.supabase
      .from("recall_tasks")
      .select("*, patients(id, first_name, last_name, phone, email)")
      .neq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(50);
    if (!identity.isManager) query = query.eq("assigned_to", ctx.userId);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return collapseOpenRecallRows(rows ?? [], ctx.userId).slice(0, 25);
  });

/** Move an appointment to a new start time (keeps or updates its duration). */
export const rescheduleAppointment = createServerFn({ method: "POST" })
  .validator(
    (data: { id: string; starts_at: string; duration_minutes?: number; practitioner_id?: string }) => data,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const start = new Date(data.starts_at);
    if (Number.isNaN(start.getTime())) throw new Error("Invalid date and time");
    const { data: current } = await ctx.supabase
      .from("appointments")
      .select("starts_at, ends_at, practitioner_id")
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
    await audit(ctx, "update", "appointment", data.id, null, { starts_at: start.toISOString() });
    return { ok: true };
  });

/** Treatment colour overrides chosen by the manager, keyed by lowercase treatment name. */
export const listTreatmentColours = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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
  .validator((data: { treatment_name: string; lane: number | null; hex?: string | null }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isOwner && !identity.permissions.includes("settings.treatments"))
      throw new Error("You do not have access to change clinic settings");
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
        { onConflict: "treatment_name" },
      );
    if (error) throw new Error(error.message);
    await audit(ctx, "update", "treatment_colour", key, null, { treatment_name: key, lane, hex });
    return { ok: true };
  });

/** Saved treatment colour palettes (named themes) for the clinic diary. */
export const listColourThemes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await (context as Ctx).supabase
      .from("treatment_colour_themes")
      .select("id, name, colours, updated_at")
      .order("name");
    return (data ?? []) as { id: string; name: string; colours: Record<string, number | string>; updated_at: string }[];
  });

/** Manager-only: save the current treatment colours as a named theme. */
export const saveColourTheme = createServerFn({ method: "POST" })
  .validator((data: { name: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isOwner && !identity.permissions.includes("settings.treatments"))
      throw new Error("You do not have access to change clinic settings");
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
  .validator((data: { id: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isOwner && !identity.permissions.includes("settings.treatments"))
      throw new Error("You do not have access to change clinic settings");
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
        .upsert(rows, { onConflict: "treatment_name" });
      if (error) throw new Error(error.message);
    }
    await audit(ctx, "apply", "colour_theme", theme.id, null, { name: theme.name });
    return { ok: true, applied: rows.length };
  });

/** Manager-only: delete a saved colour theme. */
export const deleteColourTheme = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isOwner && !identity.permissions.includes("settings.treatments"))
      throw new Error("You do not have access to change clinic settings");
    const { error } = await ctx.supabase.from("treatment_colour_themes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(ctx, "delete", "colour_theme", data.id, null, {});
    return { ok: true };
  });

/** Full treatment catalogue, including archived items (settings view). */
export const listCatalogueItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
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
  .validator((data: CatalogueInput) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isOwner && !identity.permissions.includes("settings.treatments"))
      throw new Error("You do not have access to change clinic settings");
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
  .validator((data: { id: string; active: boolean }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isOwner && !identity.permissions.includes("settings.treatments"))
      throw new Error("You do not have access to change clinic settings");
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
    const { data } = await (context as Ctx).supabase
      .from("clinics")
      .select("id, name, address, phone, email")
      .eq("id", CLINIC_ID)
      .maybeSingle();
    return data ?? null;
  });

/** Manager-only: update the clinic's contact details. */
export const updateClinicDetails = createServerFn({ method: "POST" })
  .validator((data: { name: string; address?: string | null; phone?: string | null; email?: string | null }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isOwner && !identity.permissions.includes("settings.treatments"))
      throw new Error("You do not have access to change clinic settings");
    const name = (data.name ?? "").trim();
    if (!name) throw new Error("Clinic name is required");
    const { error } = await ctx.supabase
      .from("clinics")
      .update({
        name,
        address: data.address?.trim() || null,
        phone: data.phone?.trim() || null,
        email: assertEmail(data.email ?? "", "clinic email", true),
      })
      .eq("id", CLINIC_ID);
    if (error) throw new Error(error.message);
    await audit(ctx, "update", "clinic", CLINIC_ID, null, { name });
    return { ok: true };
  });

/** Capability grants for manager / receptionist / practitioner (owner edits). */
export const listRolePermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isStaff) throw new Error("Staff access only");
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
    }) => data,
  )
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await loadIdentity(ctx);
    if (!identity.isOwner) throw new Error("Clinic owner access only");
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
        { onConflict: "role,permission" },
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
    body: sanitizeNoteHtml(String(data?.body ?? "")),
  }))
  .handler(async ({ context, data }) => {
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
  .validator((data: { appointment_id: string }) => ({ appointment_id: String(data.appointment_id) }))
  .handler(async ({ context, data }) => {
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
    const visitBody = ((row?.body as string) ?? "").trim();
    if (visitBody) {
      return {
        body: row!.body as string,
        updatedAt: (row?.updated_at as string) ?? null,
        updatedBy: (row?.updated_by_label as string) ?? null,
      };
    }
    // Fall back to booking notes so both surfaces stay in sync.
    const bookingNotes = String((appt as { notes?: string | null } | null)?.notes ?? "");
    const withoutCancel = bookingNotes.replace(/^Cancelled:[^\n]*(?:\n\n)?/, "").trim();
    return {
      body: withoutCancel,
      updatedAt: null,
      updatedBy: null,
    };
  });

export const saveAppointmentNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { appointment_id: string; body: string }) => ({
    appointment_id: String(data.appointment_id),
    body: String(data?.body ?? "").slice(0, 20000),
  }))
  .handler(async ({ context, data }) => {
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
      body: row.body as string,
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
    .eq("clinic_id", CLINIC_ID)
    .eq("user_low", userLow)
    .eq("user_high", userHigh)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created, error } = await ctx.supabase
    .from("staff_conversations")
    .insert({ clinic_id: CLINIC_ID, user_low: userLow, user_high: userHigh })
    .select("id")
    .single();
  if (error) {
    // Concurrent create — fetch the row the other request inserted.
    const { data: again } = await ctx.supabase
      .from("staff_conversations")
      .select("id")
      .eq("clinic_id", CLINIC_ID)
      .eq("user_low", userLow)
      .eq("user_high", userHigh)
      .maybeSingle();
    if (again?.id) return again.id as string;
    throw new Error(error.message);
  }
  return created.id as string;
}

/** Open (or create) a 1:1 staff chat and return messages + read receipts. */
export const getStaffChat = createServerFn({ method: "GET" })
  .validator((data: { peerUserId: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    await assertStaffPeer(ctx, data.peerUserId);
    const conversationId = await getOrCreateConversationId(ctx, data.peerUserId);

    const [{ data: messages }, { data: reads }, { data: peerProfile }] = await Promise.all([
      ctx.supabase
        .from("staff_chat_messages")
        .select("id, sender_id, body, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(200),
      ctx.supabase
        .from("staff_conversation_reads")
        .select("user_id, last_read_at")
        .eq("conversation_id", conversationId),
      ctx.supabase.from("profiles").select("id, full_name, job_title, avatar_url").eq("id", data.peerUserId).maybeSingle(),
    ]);

    const peerReadAt =
      ((reads ?? []) as { user_id: string; last_read_at: string }[]).find((r) => r.user_id === data.peerUserId)
        ?.last_read_at ?? null;
    const myReadAt =
      ((reads ?? []) as { user_id: string; last_read_at: string }[]).find((r) => r.user_id === ctx.userId)
        ?.last_read_at ?? null;

    return {
      conversationId,
      peer: {
        id: data.peerUserId,
        full_name: (peerProfile as { full_name?: string } | null)?.full_name ?? "Teammate",
        job_title: (peerProfile as { job_title?: string | null } | null)?.job_title ?? null,
        avatar_url: (peerProfile as { avatar_url?: string | null } | null)?.avatar_url ?? null,
      },
      peerReadAt,
      myReadAt,
      messages: ((messages ?? []) as { id: string; sender_id: string; body: string; created_at: string }[]).map(
        (m) => ({
          ...m,
          mine: m.sender_id === ctx.userId,
          readByPeer:
            m.sender_id === ctx.userId && peerReadAt != null && peerReadAt >= m.created_at,
        }),
      ),
    };
  });

/** Send a live chat message to a clinic teammate. */
export const sendStaffChatMessage = createServerFn({ method: "POST" })
  .validator((data: { peerUserId: string; body: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
    const identity = await assertStaffPeer(ctx, data.peerUserId);
    const body = data.body.trim();
    if (!body) throw new Error("Write a message first");
    if (body.length > 4000) throw new Error("Message is too long");

    const conversationId = await getOrCreateConversationId(ctx, data.peerUserId);
    const now = new Date().toISOString();
    const { data: row, error } = await ctx.supabase
      .from("staff_chat_messages")
      .insert({
        conversation_id: conversationId,
        clinic_id: CLINIC_ID,
        sender_id: ctx.userId,
        body,
        created_at: now,
      })
      .select("id, sender_id, body, created_at")
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
    await ctx.supabase
      .from("staff_notifications")
      .delete()
      .eq("recipient_id", data.peerUserId)
      .eq("sender_id", ctx.userId)
      .eq("kind", "staff_chat")
      .is("read_at", null);
    await ctx.supabase.from("staff_notifications").insert({
      clinic_id: CLINIC_ID,
      recipient_id: data.peerUserId,
      sender_id: ctx.userId,
      urgent: false,
      kind: "staff_chat",
      title: `Message from ${from}`,
      body: body.slice(0, 180),
    });

    return {
      conversationId,
      message: { ...row, mine: true, readByPeer: false },
    };
  });

/** Mark the open staff chat as read (drives peer read receipts). */
export const markStaffChatRead = createServerFn({ method: "POST" })
  .validator((data: { peerUserId: string }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const ctx = context as Ctx;
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
