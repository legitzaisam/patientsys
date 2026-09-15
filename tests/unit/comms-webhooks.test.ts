import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  applyWebhookStatus,
  verifyResendSignature,
  verifyTwilioSignature,
} from "@/lib/comms/webhooks.server";

describe("applyWebhookStatus", () => {
  it("maps provider events onto outbox statuses", () => {
    expect(applyWebhookStatus("sent")).toEqual({ status: "sent", error: null });
    expect(applyWebhookStatus("bounced")).toEqual({ status: "bounced" });
    expect(applyWebhookStatus("failed")).toEqual({ status: "failed" });
  });
});

describe("verifyResendSignature", () => {
  const rawSecret = Buffer.from("test-webhook-secret");
  const secret = `whsec_${rawSecret.toString("base64")}`;
  const payload = JSON.stringify({ type: "email.delivered", data: { email_id: "abc" } });
  const svixId = "msg_123";
  const svixTimestamp = "1750000000";

  function sign(body: string) {
    const digest = createHmac("sha256", rawSecret)
      .update(`${svixId}.${svixTimestamp}.${body}`)
      .digest("base64");
    return `v1,${digest}`;
  }

  it("accepts a correctly signed payload", () => {
    expect(
      verifyResendSignature({
        payload,
        svixId,
        svixTimestamp,
        svixSignature: sign(payload),
        secret,
      }),
    ).toBe(true);
  });

  it("accepts when any of the space-separated signatures matches", () => {
    expect(
      verifyResendSignature({
        payload,
        svixId,
        svixTimestamp,
        svixSignature: `v1,notthisone ${sign(payload)}`,
        secret,
      }),
    ).toBe(true);
  });

  it("rejects a tampered payload and an empty signature", () => {
    expect(
      verifyResendSignature({
        payload: payload + "x",
        svixId,
        svixTimestamp,
        svixSignature: sign(payload),
        secret,
      }),
    ).toBe(false);
    expect(
      verifyResendSignature({ payload, svixId, svixTimestamp, svixSignature: "", secret }),
    ).toBe(false);
  });
});

describe("verifyTwilioSignature", () => {
  const authToken = "twilio-auth-token";
  const url = "https://clinic.example/api/comms/webhooks/twilio";
  const params = { MessageSid: "SM123", MessageStatus: "delivered", To: "+447700900000" };

  function sign(u: string, p: Record<string, string>) {
    const sorted = Object.keys(p)
      .sort()
      .reduce((acc, key) => acc + key + p[key], u);
    return createHmac("sha1", authToken).update(sorted).digest("base64");
  }

  it("accepts Twilio's url+sorted-params HMAC", () => {
    expect(verifyTwilioSignature({ url, params, signature: sign(url, params), authToken })).toBe(
      true,
    );
  });

  it("rejects when a param was altered or the signature is for another URL", () => {
    expect(
      verifyTwilioSignature({
        url,
        params: { ...params, MessageStatus: "failed" },
        signature: sign(url, params),
        authToken,
      }),
    ).toBe(false);
    expect(
      verifyTwilioSignature({
        url,
        params,
        signature: sign("https://evil.example/hook", params),
        authToken,
      }),
    ).toBe(false);
  });
});
