import { beforeAll, describe, expect, it, vi } from "vitest";
import { COMMS_MAX_ATTEMPTS, backoffSeconds } from "@/lib/comms/config.server";
import {
  applyDelivery,
  claimDueInMemory,
  drainInMemory,
  type OutboxRow,
} from "@/lib/comms/dispatch.server";

beforeAll(() => {
  // Force the sandbox path so drain tests can never reach a real provider,
  // even on a machine whose shell exports a live RESEND_API_KEY.
  process.env["COMMS_SANDBOX"] = "1";
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

function row(overrides: Partial<OutboxRow> = {}): OutboxRow {
  return {
    id: "row-1",
    clinic_id: "clinic-1",
    channel: "email",
    to_address: "patient@example.com",
    subject: "Subject",
    body: "Body",
    status: "queued",
    attempts: 0,
    scheduled_for: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const NOW = new Date("2026-06-01T12:00:00.000Z");

describe("applyDelivery", () => {
  it("marks a successful send as sent and clears the error", () => {
    const patch = applyDelivery(
      row({ attempts: 2 }),
      { ok: true, provider: "sandbox", messageId: "sandbox:abc" },
      NOW,
    );
    expect(patch).toEqual({
      status: "sent",
      provider: "sandbox",
      provider_message_id: "sandbox:abc",
      error: null,
      attempts: 3,
      sent_at: NOW.toISOString(),
    });
  });

  it("requeues a failure with exponential backoff on scheduled_for", () => {
    const patch = applyDelivery(row({ attempts: 2 }), { ok: false, error: "boom" }, NOW);
    expect(patch["status"]).toBe("queued");
    expect(patch["error"]).toBe("boom");
    expect(patch["attempts"]).toBe(3);
    expect(patch["sent_at"]).toBeNull();
    const expected = new Date(NOW.getTime() + backoffSeconds(3) * 1000).toISOString();
    expect(patch["scheduled_for"]).toBe(expected);
  });

  it("gives up after COMMS_MAX_ATTEMPTS and marks the row failed", () => {
    const patch = applyDelivery(
      row({ attempts: COMMS_MAX_ATTEMPTS - 1 }),
      { ok: false, error: "boom" },
      NOW,
    );
    expect(patch).toEqual({
      status: "failed",
      error: "boom",
      attempts: COMMS_MAX_ATTEMPTS,
      sent_at: null,
    });
  });
});

describe("claimDueInMemory", () => {
  it("claims due queued rows and skips future ones", () => {
    const due = row({ id: "due", scheduled_for: "2026-06-01T11:59:00.000Z" });
    const future = row({ id: "future", scheduled_for: "2026-06-01T12:01:00.000Z" });
    const claimed = claimDueInMemory([due, future], 20, NOW);
    expect(claimed.map((r) => r.id)).toEqual(["due"]);
    expect(due.status).toBe("sending");
    expect(due.scheduled_for).toBe(NOW.toISOString());
    expect(future.status).toBe("queued");
  });

  it("reclaims sending rows only after they have been stale for five minutes", () => {
    const fresh = row({
      id: "fresh",
      status: "sending",
      scheduled_for: "2026-06-01T11:56:00.000Z",
    });
    const stale = row({
      id: "stale",
      status: "sending",
      scheduled_for: "2026-06-01T11:54:00.000Z",
    });
    const claimed = claimDueInMemory([fresh, stale], 20, NOW);
    expect(claimed.map((r) => r.id)).toEqual(["stale"]);
  });

  it("never claims sent or failed rows", () => {
    const sent = row({ id: "sent", status: "sent", scheduled_for: "2026-01-01T00:00:00.000Z" });
    const failed = row({
      id: "failed",
      status: "failed",
      scheduled_for: "2026-01-01T00:00:00.000Z",
    });
    expect(claimDueInMemory([sent, failed], 20, NOW)).toEqual([]);
  });

  it("orders by scheduled_for and honours the limit", () => {
    const later = row({ id: "later", scheduled_for: "2026-06-01T11:30:00.000Z" });
    const earliest = row({ id: "earliest", scheduled_for: "2026-06-01T10:00:00.000Z" });
    const middle = row({ id: "middle", scheduled_for: "2026-06-01T11:00:00.000Z" });
    const claimed = claimDueInMemory([later, earliest, middle], 2, NOW);
    expect(claimed.map((r) => r.id)).toEqual(["earliest", "middle"]);
    expect(later.status).toBe("queued");
  });
});

describe("drainInMemory", () => {
  it("delivers due rows through the sandbox and counts them as sent", async () => {
    const rows = [
      row({ id: "email-row", scheduled_for: "2026-01-01T00:00:00.000Z" }),
      row({
        id: "sms-row",
        channel: "sms",
        to_address: "07700900000",
        scheduled_for: "2026-01-01T00:00:00.000Z",
      }),
      row({ id: "future-row", scheduled_for: "2999-01-01T00:00:00.000Z" }),
    ];
    const clinics = new Map([["clinic-1", { name: "Aetheria", email: "hello@aetheria.clinic" }]]);
    const summary = await drainInMemory(rows, clinics);
    expect(summary).toEqual({ claimed: 2, sent: 2, failed: 0, retried: 0 });
    expect(rows[0]?.status).toBe("sent");
    expect(rows[1]?.status).toBe("sent");
    expect(rows[2]?.status).toBe("queued");
    expect((rows[0] as OutboxRow & { provider?: string }).provider).toBe("sandbox");
  });
});
