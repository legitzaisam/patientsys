import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { backoffSeconds, commsSandbox } from "@/lib/comms/config.server";

describe("backoffSeconds", () => {
  it("starts at 15 seconds and doubles per attempt", () => {
    expect(backoffSeconds(1)).toBe(15);
    expect(backoffSeconds(2)).toBe(30);
    expect(backoffSeconds(3)).toBe(60);
    expect(backoffSeconds(8)).toBe(1920);
  });

  it("treats attempt zero like the first attempt", () => {
    expect(backoffSeconds(0)).toBe(15);
  });

  it("caps at one hour", () => {
    expect(backoffSeconds(9)).toBe(3600);
    expect(backoffSeconds(50)).toBe(3600);
  });
});

describe("commsSandbox", () => {
  const saved: Record<string, string | undefined> = {};
  const KEYS = ["COMMS_SANDBOX", "RESEND_API_KEY", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"];

  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("is sandboxed when no provider keys are configured", () => {
    expect(commsSandbox("email")).toBe(true);
    expect(commsSandbox("sms")).toBe(true);
  });

  it("COMMS_SANDBOX=1 overrides live keys", () => {
    process.env["COMMS_SANDBOX"] = "1";
    process.env["RESEND_API_KEY"] = "re_live";
    process.env["TWILIO_ACCOUNT_SID"] = "AC123";
    process.env["TWILIO_AUTH_TOKEN"] = "token";
    expect(commsSandbox("email")).toBe(true);
    expect(commsSandbox("sms")).toBe(true);
  });

  it("goes live per channel only when that channel's keys exist", () => {
    process.env["RESEND_API_KEY"] = "re_live";
    expect(commsSandbox("email")).toBe(false);
    expect(commsSandbox("sms")).toBe(true);

    process.env["TWILIO_ACCOUNT_SID"] = "AC123";
    expect(commsSandbox("sms")).toBe(true); // still missing the auth token
    process.env["TWILIO_AUTH_TOKEN"] = "token";
    expect(commsSandbox("sms")).toBe(false);
  });
});
