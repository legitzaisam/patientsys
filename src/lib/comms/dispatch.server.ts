import {
  backoffSeconds,
  COMMS_CLAIM_LIMIT,
  COMMS_MAX_ATTEMPTS,
  COMMS_STALE_SENDING_MS,
  commsFromEmail,
} from "./config.server";
import { sendEmail } from "./email.server";
import { sendSms } from "./sms.server";

export type OutboxRow = {
  id: string;
  clinic_id: string;
  channel: "email" | "sms";
  to_address: string;
  subject: string | null;
  body: string;
  status: string;
  attempts: number;
  scheduled_for: string;
};

export type DrainSummary = { claimed: number; sent: number; failed: number; retried: number };

type ClinicFrom = { name: string | null; email: string | null };

export async function deliverRow(row: OutboxRow, clinic?: ClinicFrom) {
  if (row.channel === "sms") return sendSms({ to: row.to_address, body: row.body });
  return sendEmail({
    to: row.to_address,
    subject: row.subject || "Message from your clinic",
    body: row.body,
    fromEmail: commsFromEmail() || clinic?.email || null,
    fromName: clinic?.name ?? null,
  });
}

export function applyDelivery(
  row: OutboxRow,
  result: Awaited<ReturnType<typeof deliverRow>>,
  now = new Date(),
): Record<string, unknown> {
  const attempts = row.attempts + 1;
  if (result.ok) {
    return {
      status: "sent",
      provider: result.provider,
      provider_message_id: result.messageId,
      error: null,
      attempts,
      sent_at: now.toISOString(),
    };
  }
  if (attempts >= COMMS_MAX_ATTEMPTS) {
    return {
      status: "failed",
      error: result.error,
      attempts,
      sent_at: null,
    };
  }
  return {
    status: "queued",
    error: result.error,
    attempts,
    scheduled_for: new Date(now.getTime() + backoffSeconds(attempts) * 1000).toISOString(),
    sent_at: null,
  };
}

function isDue(row: Pick<OutboxRow, "status" | "scheduled_for">, now: Date) {
  const due = new Date(row.scheduled_for).getTime() <= now.getTime();
  if (row.status === "queued") return due;
  if (row.status === "sending") {
    return new Date(row.scheduled_for).getTime() <= now.getTime() - COMMS_STALE_SENDING_MS;
  }
  return false;
}

/** In-memory claim used by demo (and tests). Mutates `rows`. */
export function claimDueInMemory<T extends OutboxRow>(rows: T[], limit = COMMS_CLAIM_LIMIT, now = new Date()) {
  const due = rows
    .filter((row) => isDue(row, now))
    .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for))
    .slice(0, limit);
  const lockAt = now.toISOString();
  for (const row of due) {
    row.status = "sending";
    // Stamp the lock clock so a due-in-the-past row is not immediately reclaimable.
    row.scheduled_for = lockAt;
  }
  return due;
}

export async function drainInMemory<T extends OutboxRow>(
  rows: T[],
  clinicById: Map<string, ClinicFrom>,
  limit = COMMS_CLAIM_LIMIT,
): Promise<DrainSummary> {
  const claimed = claimDueInMemory(rows, limit);
  const summary: DrainSummary = { claimed: claimed.length, sent: 0, failed: 0, retried: 0 };
  for (const row of claimed) {
    const result = await deliverRow(row, clinicById.get(row.clinic_id));
    Object.assign(row, applyDelivery(row, result));
    if (row.status === "sent") summary.sent += 1;
    else if (row.status === "failed") summary.failed += 1;
    else summary.retried += 1;
  }
  return summary;
}

type Db = { from: (table: string) => any; rpc: (name: string, args?: object) => any };

async function clinicFrom(db: Db, clinicId: string): Promise<ClinicFrom> {
  const { data } = await db.from("clinics").select("name, email").eq("id", clinicId).maybeSingle();
  return { name: data?.name ?? null, email: data?.email ?? null };
}

async function claimDueOnDb(db: Db, opts: { clinicId?: string; limit: number }): Promise<OutboxRow[]> {
  // The RPC claims across every clinic. Staff drain is clinic-scoped, so it
  // must not call it — that would leave another clinic's rows stuck in sending.
  if (!opts.clinicId) {
    const { data: rpcRows, error: rpcError } = await db.rpc("claim_queued_communications", {
      _limit: opts.limit,
    });
    if (!rpcError) return (rpcRows ?? []) as OutboxRow[];
  }

  const now = new Date();
  const stale = new Date(now.getTime() - COMMS_STALE_SENDING_MS).toISOString();
  let query = db
    .from("communications")
    .select("id, clinic_id, channel, to_address, subject, body, status, attempts, scheduled_for")
    .or(`and(status.eq.queued,scheduled_for.lte.${now.toISOString()}),and(status.eq.sending,scheduled_for.lte.${stale})`)
    .order("scheduled_for", { ascending: true })
    .limit(opts.limit);
  if (opts.clinicId) query = query.eq("clinic_id", opts.clinicId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const claimed: OutboxRow[] = [];
  for (const row of (data ?? []) as OutboxRow[]) {
    const { data: locked, error: lockError } = await db
      .from("communications")
      .update({ status: "sending", scheduled_for: now.toISOString() })
      .eq("id", row.id)
      .in("status", ["queued", "sending"])
      .select("id, clinic_id, channel, to_address, subject, body, status, attempts, scheduled_for")
      .maybeSingle();
    if (lockError) throw new Error(lockError.message);
    if (locked) claimed.push(locked as OutboxRow);
  }
  return claimed;
}

/**
 * Drain due outbox rows. Pass the admin client for the cron route (all clinics)
 * or the request client for a staff-triggered clinic-scoped drain.
 */
export async function drainDueCommunications(
  db: Db,
  opts?: { clinicId?: string; limit?: number },
): Promise<DrainSummary> {
  const claimed = await claimDueOnDb(db, {
    ...(opts?.clinicId ? { clinicId: opts.clinicId } : {}),
    limit: opts?.limit ?? COMMS_CLAIM_LIMIT,
  });
  const summary: DrainSummary = { claimed: claimed.length, sent: 0, failed: 0, retried: 0 };
  const clinics = new Map<string, ClinicFrom>();
  for (const row of claimed) {
    if (!clinics.has(row.clinic_id)) clinics.set(row.clinic_id, await clinicFrom(db, row.clinic_id));
    const result = await deliverRow(row, clinics.get(row.clinic_id));
    const patch = applyDelivery(row, result);
    const { error } = await db.from("communications").update(patch).eq("id", row.id);
    if (error) throw new Error(error.message);
    if (patch["status"] === "sent") summary.sent += 1;
    else if (patch["status"] === "failed") summary.failed += 1;
    else summary.retried += 1;
  }
  return summary;
}
