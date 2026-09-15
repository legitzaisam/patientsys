import { describe, expect, it } from "vitest";
import {
  classifyDocument,
  isExpired,
  type PublicDocument,
} from "@/lib/documents/access.server";
import { consentRequestMessage, publicSigningUrl } from "@/lib/comms/templates";

const NOW = new Date("2026-06-01T12:00:00.000Z");

function doc(overrides: Partial<PublicDocument> = {}): PublicDocument {
  return {
    id: "doc-1",
    title: "Lip filler — consent form",
    body: "I consent.",
    kind: "consent",
    status: "sent",
    expires_at: null,
    ...overrides,
  };
}

describe("classifyDocument", () => {
  it("maps a missing document to the uniform not_found", () => {
    expect(classifyDocument(null, NOW)).toEqual({ outcome: "not_found" });
  });

  it("maps a signed document to the one distinct outcome", () => {
    expect(classifyDocument(doc({ status: "signed" }), NOW)).toEqual({ outcome: "signed" });
  });

  it("maps an expired link to not_found — indistinguishable from a bad token", () => {
    const expired = doc({ expires_at: "2026-05-01T00:00:00.000Z" });
    expect(classifyDocument(expired, NOW)).toEqual({ outcome: "not_found" });
  });

  it("returns sent and viewed documents for signing", () => {
    expect(classifyDocument(doc(), NOW).outcome).toBe("ok");
    expect(classifyDocument(doc({ status: "viewed" }), NOW).outcome).toBe("ok");
    const future = doc({ expires_at: "2026-07-01T00:00:00.000Z" });
    expect(classifyDocument(future, NOW).outcome).toBe("ok");
  });
});

describe("isExpired", () => {
  it("treats a null expiry as never expiring", () => {
    expect(isExpired({ expires_at: null }, NOW)).toBe(false);
  });

  it("expires exactly on the boundary", () => {
    expect(isExpired({ expires_at: NOW.toISOString() }, NOW)).toBe(true);
  });
});

describe("signing link message", () => {
  it("builds the public URL without a double slash", () => {
    expect(publicSigningUrl("https://clinic.example/", "abc123")).toBe(
      "https://clinic.example/d/abc123",
    );
    expect(publicSigningUrl("https://clinic.example", "abc123")).toBe(
      "https://clinic.example/d/abc123",
    );
  });

  it("differentiates first send from reminder in the subject only", () => {
    const first = consentRequestMessage({ name: "Olivia", title: "Consent", url: "u" });
    const again = consentRequestMessage({ name: "Olivia", title: "Consent", url: "u", reminder: true });
    expect(first.subject).toBe("Consent — please review and sign");
    expect(again.subject).toBe("Reminder: Consent is waiting for your signature");
    expect(first.body).toBe(again.body);
    expect(first.body).toContain("no account needed: u");
  });
});
