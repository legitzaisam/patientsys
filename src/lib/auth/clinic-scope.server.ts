/**
 * Clinic isolation for a Supabase client.
 *
 * The database has `clinic_id` on 23 tables and, since Phase 5, a RESTRICTIVE
 * policy on each one. None of that binds application traffic: every request
 * runs on the service-role client, which bypasses Row-Level Security. So the
 * isolation that actually holds today is this wrapper.
 *
 * It is applied once, in the session middleware, rather than at the ~170 query
 * sites — a filter you have to remember to write is a filter someone forgets.
 */

/** Tables carrying a `clinic_id`. Keep in step with `node scripts/db-snapshot.mjs`. */
export const CLINIC_SCOPED_TABLES = [
  "appointment_notes",
  "appointments",
  "audit_log",
  "communications",
  "documents",
  "ex_team_members",
  "medical_history_versions",
  "message_templates",
  "messages",
  "patients",
  "profile_change_requests",
  "profiles",
  "recall_tasks",
  "retention_outreach",
  "role_permissions",
  "staff_chat_messages",
  "staff_conversations",
  "staff_notifications",
  "treatment_catalogue",
  "treatment_colour_themes",
  "treatment_colours",
  "treatment_photos",
  "treatments",
] as const;

/**
 * Deliberately unscoped. `user_roles` says what someone is, not where — which
 * clinic they belong to is answered by their profile. The rest are keyed to
 * their owning user, and `clinics` is the tenant itself, scoped by id.
 */
const UNSCOPED_TABLES = new Set([
  "auth_login_events",
  "auth_step_up",
  "clinics",
  "staff_conversation_reads",
  "staff_documents",
  "user_notes",
  "user_roles",
]);

const scoped = new Set<string>(CLINIC_SCOPED_TABLES);

function withClinicId<T>(rows: T, clinicId: string): T {
  const stamp = (row: unknown) =>
    row && typeof row === "object" && !("clinic_id" in row) ? { ...row, clinic_id: clinicId } : row;
  return (Array.isArray(rows) ? rows.map(stamp) : stamp(rows)) as T;
}

/**
 * Wrap a client so every read, write and delete on a clinic-scoped table is
 * confined to one clinic.
 *
 * A null `clinicId` passes through unscoped. That is the first-run case: a user
 * with no profile and no patient record has no clinic yet, and `getMe` creates
 * one. Such a caller holds no roles either, so `authorize()` refuses them
 * everything except that bootstrap.
 */
export function clinicScoped<T extends { from: (table: string) => any }>(
  client: T,
  clinicId: string | null,
): T {
  if (!clinicId) return client;

  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop !== "from") return Reflect.get(target, prop, receiver);
      return (table: string) => {
        const builder = target.from(table);
        if (!scoped.has(table)) return builder;
        return {
          ...builder,
          select: (...args: unknown[]) => builder.select(...args).eq("clinic_id", clinicId),
          insert: (rows: unknown) => builder.insert(withClinicId(rows, clinicId)),
          upsert: (rows: unknown, options?: unknown) =>
            builder.upsert(withClinicId(rows, clinicId), options),
          update: (patch: unknown) => builder.update(patch).eq("clinic_id", clinicId),
          delete: (...args: unknown[]) => builder.delete(...args).eq("clinic_id", clinicId),
        };
      };
    },
  });
}

/** True when a table is neither scoped nor knowingly exempt — i.e. someone added one. */
export function isUnclassifiedTable(table: string) {
  return !scoped.has(table) && !UNSCOPED_TABLES.has(table);
}
