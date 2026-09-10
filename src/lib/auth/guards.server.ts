import { PERMISSION_KEYS, can, type PermissionKey } from "@/lib/permissions";
import { POLICY, resolveScope, type HandlerName } from "@/lib/auth/policy";
import { MFA_REQUIRED_MESSAGE, STEP_UP_MESSAGE, STEP_UP_TTL_MS } from "@/lib/auth/constants";

export type Ctx = {
  /** Already clinic-scoped by the session middleware; see auth/clinic-scope.server.ts. */
  supabase: any;
  clinicId: string | null;
  userId: string;
  claims: Record<string, unknown>;
  accessToken: string;
};

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
      .select("id, clinic_id, first_name, last_name")
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
  // Which clinic this caller belongs to: their staff profile, or the patient
  // record their login is attached to. Every clinic-scoped query filters on it,
  // because the service-role client makes the database's isolation policies
  // advisory — this value is the isolation.
  const clinicId: string | null = profile?.clinic_id ?? patient?.clinic_id ?? null;
  const aal: "aal1" | "aal2" = context.claims["aal"] === "aal2" ? "aal2" : "aal1";
  const mfaRequired = isOwner || roleList.includes("manager");
  const mfaEnrolled = await readMfaEnrolled(context);

  return {
    userId: context.userId,
    email: (context.claims["email"] as string) ?? "",
    clinicId,
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
    aal,
    mfaEnrolled,
    mfaRequired,
    profile: profile ?? null,
    patient: patient ?? null,
    /** True when staff must set a new password before using the app (invite / reset). */
    mustChangePassword: await resolveAppMetaFlag(context, "must_change_password"),
    /** True for newly invited staff until they dismiss the welcome dialog. */
    welcomePending: await resolveAppMetaFlag(context, "welcome_pending"),
  };
}

async function readMfaEnrolled(context: Ctx): Promise<boolean> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const listed = await (
      supabaseAdmin.auth.admin as unknown as {
        mfa?: {
          listFactors: (opts: { userId: string }) => Promise<{
            data?: { totp?: Array<{ status: string }> };
            error?: { message: string } | null;
          }>;
        };
      }
    ).mfa?.listFactors({ userId: context.userId });
    if (listed?.data?.totp?.some((f) => f.status === "verified")) return true;
    const user = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const factors = (user.data.user as { factors?: Array<{ factor_type?: string; status?: string }> } | undefined)
      ?.factors;
    if (factors?.some((f) => f.factor_type === "totp" && f.status === "verified")) return true;
  } catch {
    /* Auth admin APIs vary by version; fall through to the JWT. */
  }
  return context.claims["aal"] === "aal2";
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

/**
 * The one authorization call a handler makes. It looks the handler up in
 * `POLICY` and applies that rule, so the access decision lives in the table
 * rather than in the handler body, and a handler missing from the table fails
 * the startup completeness check instead of silently running unguarded.
 *
 * Returns the identity, so it replaces both the old guard call and the
 * `loadIdentity` that usually followed it.
 */
export async function authorize(
  context: Ctx,
  name: HandlerName,
  resource?: { patientId?: string | null },
): Promise<Identity> {
  const rule = POLICY[name] as import("@/lib/auth/policy").Access;

  let identity: Identity;
  switch (rule.kind) {
    case "self":
      identity = await loadIdentity(context);
      break;
    case "staff":
      identity = await requireStaff(context);
      break;
    case "manager":
      identity = await requireManager(context);
      break;
    case "owner":
      identity = await requireOwner(context);
      break;
    case "capability":
      identity = await requirePermission(context, rule.key);
      break;
    case "patientSelf":
      identity = await requirePatientSelf(context, requirePatientId(name, resource));
      break;
    case "staffOrOwnPatient": {
      identity = await requireStaffOrOwnPatient(context, requirePatientId(name, resource));
      // The capability describes the staff side only. A patient legitimately
      // messaging their own clinic holds no capabilities and must not be gated.
      if (rule.staffKey && identity.isStaff && !can(identity, rule.staffKey)) {
        throw new Error("You do not have access to this area");
      }
      break;
    }
    default: {
      const _exhaustive: never = rule;
      throw new Error(`Unknown access rule for ${name}: ${JSON.stringify(_exhaustive)}`);
    }
  }

  // Once a manager has a verified factor, every handler except getMe needs AAL2.
  // Enrolment itself is client-side against Auth. We do not refuse people who
  // have not enrolled yet — that would lock the clinic out if TOTP is not
  // enabled on the project. The client gate is what pushes them to enrol.
  if (name !== "getMe" && identity.mfaRequired && identity.mfaEnrolled && identity.aal !== "aal2") {
    throw new Error(MFA_REQUIRED_MESSAGE);
  }
  return identity;
}

/** Destructive actions need a password confirmed in the last few minutes. */
export async function requireStepUp(context: Ctx) {
  const { data, error } = await context.supabase
    .from("auth_step_up")
    .select("expires_at")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (error) throw new Error(`Could not confirm your identity: ${error.message}`);
  if (!data?.expires_at || new Date(String(data.expires_at)).getTime() < Date.now()) {
    throw new Error(STEP_UP_MESSAGE);
  }
}

export function stepUpExpiry() {
  return new Date(Date.now() + STEP_UP_TTL_MS).toISOString();
}

function requirePatientId(name: string, resource?: { patientId?: string | null }) {
  const id = resource?.patientId;
  // A programming error, not a caller error: an ownership rule with no resource
  // to compare against would otherwise pass everyone.
  if (!id) throw new Error(`${name} requires a patientId to check ownership`);
  return id;
}

/** Which rows this caller may see. `null` is clinic-wide; a user id narrows to their own. */
export function scopeFor(identity: Identity, name: HandlerName): string | null {
  return resolveScope(identity, name);
}

/**
 * What a given staff member can actually do, resolved through the same `can()`
 * the guards call. Answering "does this person hold X" from the raw grant rows
 * would miss the owner's implicit grant, so the displayed answer could disagree
 * with what the server enforces. Deriving it here means it cannot.
 */
export async function effectiveCapabilities(context: Ctx, userId: string) {
  const [rolesRes, permsRes] = await Promise.all([
    context.supabase.from("user_roles").select("role").eq("user_id", userId),
    context.supabase.from("role_permissions").select("role, permission, enabled"),
  ]);
  if (rolesRes.error) throw new Error(`Could not load roles: ${rolesRes.error.message}`);
  if (permsRes.error) throw new Error(`Could not load permissions: ${permsRes.error.message}`);

  const roles: string[] = (rolesRes.data ?? []).map((r: { role: string }) => r.role);
  const isOwner = roles.includes("owner");
  const permissions = ((permsRes.data ?? []) as { role: string; permission: string; enabled: boolean }[])
    .filter((p) => p.enabled && roles.includes(p.role))
    .map((p) => p.permission);

  const subject = { isOwner, permissions };
  return {
    isOwner,
    granted: PERMISSION_KEYS.filter((key) => can(subject, key)),
  };
}
