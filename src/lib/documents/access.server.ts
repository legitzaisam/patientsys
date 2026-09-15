/**
 * Public consent-link access, keyed on documents.access_token.
 *
 * Every failure — unknown token, expired link, malformed token, throttled
 * caller — resolves to the same "not_found", so the route cannot be used to
 * probe which tokens exist or why one stopped working. A signed document is
 * the one deliberately distinct outcome: the patient who signed yesterday
 * should see "already completed", not a dead link.
 *
 * Single use on sign is enforced by the database, not just here: the Phase 5
 * documents_signed_immutable trigger rejects any update once status is
 * 'signed', and it fires for the service-role client too.
 */

export type PublicDocument = {
  id: string;
  title: string;
  body: string | null;
  kind: string;
  status: string;
  expires_at: string | null;
};

export type ResolveOutcome =
  { outcome: "ok"; document: PublicDocument } | { outcome: "signed" } | { outcome: "not_found" };

export type SignOutcome = { outcome: "ok" } | { outcome: "signed" } | { outcome: "not_found" };

type Db = { from: (table: string) => any };

/** 24 random bytes hex-encoded by the column default; demo fixtures use uuid-shaped tokens. */
const TOKEN_SHAPE = /^[0-9a-f-]{16,64}$/i;

const DOCUMENT_COLUMNS = "id, title, body, kind, status, expires_at";

/** Sliding-window throttle: this many token requests per IP, then 404s. */
export const TOKEN_ATTEMPT_LIMIT = 30;
export const TOKEN_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;

export function isExpired(doc: { expires_at: string | null }, now = new Date()) {
  return Boolean(doc.expires_at && new Date(doc.expires_at).getTime() <= now.getTime());
}

/** Map a fetched row (or null) onto the public outcome. Pure, unit-tested. */
export function classifyDocument(doc: PublicDocument | null, now = new Date()): ResolveOutcome {
  if (!doc) return { outcome: "not_found" };
  if (doc.status === "signed") return { outcome: "signed" };
  if (isExpired(doc, now)) return { outcome: "not_found" };
  return { outcome: "ok", document: doc };
}

async function findByToken(db: Db, token: string): Promise<PublicDocument | null> {
  if (!TOKEN_SHAPE.test(token)) return null;
  const { data, error } = await db
    .from("documents")
    .select(DOCUMENT_COLUMNS)
    .eq("access_token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PublicDocument | null) ?? null;
}

async function recordAccess(
  db: Db,
  documentId: string | null,
  event: "view" | "sign" | "rejected",
  meta: { ip?: string | null; userAgent?: string | null },
) {
  await db.from("document_access_events").insert({
    document_id: documentId,
    event,
    ip: meta.ip?.slice(0, 100) ?? null,
    user_agent: meta.userAgent?.slice(0, 300) ?? null,
  });
}

/** True when this IP has hammered the public routes recently. */
export async function tooManyTokenRequests(db: Db, ip: string | null | undefined) {
  if (!ip) return false;
  const since = new Date(Date.now() - TOKEN_ATTEMPT_WINDOW_MS).toISOString();
  const { count, error } = await db
    .from("document_access_events")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);
  if (error) return false; // a broken throttle must not take the link down
  return (count ?? 0) >= TOKEN_ATTEMPT_LIMIT;
}

export async function resolveDocumentByToken(
  db: Db,
  token: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<ResolveOutcome> {
  if (await tooManyTokenRequests(db, meta.ip)) return { outcome: "not_found" };

  const doc = await findByToken(db, token);
  const outcome = classifyDocument(doc);
  await recordAccess(db, doc?.id ?? null, outcome.outcome === "ok" ? "view" : "rejected", meta);

  if (outcome.outcome === "ok") {
    // First open stamps viewed_at and moves 'sent' along to 'viewed'.
    await db
      .from("documents")
      .update({
        viewed_at: new Date().toISOString(),
        ...(outcome.document.status === "sent" ? { status: "viewed" } : {}),
      })
      .eq("id", outcome.document.id)
      .is("viewed_at", null);
  }
  return outcome;
}

export async function signDocumentByToken(
  db: Db,
  token: string,
  signedName: string,
  meta: { ip?: string | null; userAgent?: string | null } = {},
): Promise<SignOutcome> {
  if (await tooManyTokenRequests(db, meta.ip)) return { outcome: "not_found" };

  const name = signedName.trim();
  if (!name || name.length > 200) return { outcome: "not_found" };

  const doc = await findByToken(db, token);
  const classified = classifyDocument(doc);
  if (classified.outcome !== "ok") {
    await recordAccess(db, doc?.id ?? null, "rejected", meta);
    return classified.outcome === "signed" ? { outcome: "signed" } : { outcome: "not_found" };
  }

  const { error } = await db
    .from("documents")
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
      signed_name: name,
      signature_data: name,
      signed_ip: meta.ip ?? null,
    })
    .eq("id", classified.document.id)
    .neq("status", "signed");
  if (error) {
    // The immutability trigger rejecting a concurrent double-sign lands here.
    await recordAccess(db, classified.document.id, "rejected", meta);
    return { outcome: "signed" };
  }

  await recordAccess(db, classified.document.id, "sign", meta);
  return { outcome: "ok" };
}
