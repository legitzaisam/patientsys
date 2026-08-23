import { PERMISSION_KEYS, can, type PermissionKey } from "@/lib/permissions";

/**
 * Authorization for every server function.
 *
 * `requireSupabaseAuth` verifies the caller's JWT and then hands the handler a
 * service-role Supabase client, which bypasses Row-Level Security. The database's
 * policies therefore enforce nothing for application traffic, and every access
 * decision has to be made here. A handler that reads or writes without calling
 * one of these guards is open to any authenticated user, including a patient.
 */

export type Ctx = { supabase: any; userId: string; claims: Record<string, unknown> };

export type Identity = Awaited<ReturnType<typeof readIdentity>>;

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

async function readIdentity(context: Ctx) {
  const [rolesRes, profileRes, patientRes, permsRes] = await Promise.all([
    context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
    context.supabase
      .from("profiles")
      .select(
        "id, clinic_id, full_name, job_title, registration_body, registration_number, avatar_url",
      )
      .eq("id", context.userId)
      .maybeSingle(),
    context.supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("user_id", context.userId)
      .maybeSingle(),
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

/**
 * One identity read per request. The auth middleware builds a fresh context
 * object per request, so keying on it gives request-lifetime caching with no TTL
 * and no staleness. The promise rather than the value is cached, so callers that
 * arrive while a read is in flight share it instead of racing another four
 * queries.
 *
 * This does not dedupe across server functions — each is its own HTTP request
 * with its own context. It removes the repeat within a request, which is the
 * common shape: a guard loads the identity, then the handler loads it again.
 */
const identityCache = new WeakMap<object, Promise<Identity>>();

export function loadIdentity(context: Ctx): Promise<Identity> {
  const cached = identityCache.get(context);
  if (cached) return cached;
  const pending = readIdentity(context);
  identityCache.set(context, pending);
  return pending;
}

/**
 * Re-read after mutating the caller's own roles, where the cached copy is known
 * to be stale. Only `getMe`'s bootstrap needs this: it inserts the caller's first
 * role and must see it, or a brand-new owner is told their access was removed.
 */
export function reloadIdentity(context: Ctx): Promise<Identity> {
  const pending = readIdentity(context);
  identityCache.set(context, pending);
  return pending;
}

/** Any clinic staff member: owner, manager, practitioner or front desk. */
export async function requireStaff(context: Ctx) {
  const identity = await loadIdentity(context);
  if (!identity.isStaff) throw new Error("Staff access only");
  return identity;
}

/** The patient whose record this is, and nobody else — not even staff. */
export async function requirePatientSelf(context: Ctx, patientId: string) {
  const identity = await loadIdentity(context);
  if (identity.patient?.id !== patientId) throw new Error("Not your record");
  return identity;
}

/** Staff, or the patient the row belongs to. Use for records a patient may read in the portal. */
export async function requireStaffOrOwnPatient(context: Ctx, patientId: string) {
  const identity = await loadIdentity(context);
  if (identity.isStaff || identity.patient?.id === patientId) return identity;
  throw new Error("Not your record");
}

/**
 * Clinic owner. Resolved through `loadIdentity` rather than its own query so a
 * failed read throws instead of being read as "not an owner", which used to tell
 * the owner they lacked access whenever the database hiccuped.
 */
export async function requireOwner(context: Ctx) {
  const identity = await loadIdentity(context);
  if (!identity.isOwner) throw new Error("Clinic owner access required");
  return identity;
}

/** Owner or manager. */
export async function requireManager(context: Ctx) {
  const identity = await loadIdentity(context);
  if (!identity.isManager) throw new Error("Manager access required");
  return identity;
}

/** Throws unless the caller is a clinic owner or has been granted the capability. */
export async function requirePermission(context: Ctx, key: PermissionKey) {
  const identity = await requireStaff(context);
  if (!can(identity, key)) throw new Error("You do not have access to this area");
  return identity;
}
