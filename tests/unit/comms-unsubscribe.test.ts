import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  unsubscribeFooter,
  unsubscribeToken,
  verifyUnsubscribeToken,
} from "@/lib/comms/unsubscribe.server";

const PATIENT = "d10000-0000-4000-8000-000000000054";

describe("unsubscribe tokens", () => {
  let savedSecret: string | undefined;
  let savedOrigin: string | undefined;

  beforeEach(() => {
    savedSecret = process.env["COMMS_UNSUBSCRIBE_SECRET"];
    savedOrigin = process.env["APP_ORIGIN"];
    process.env["COMMS_UNSUBSCRIBE_SECRET"] = "unit-test-secret";
    process.env["APP_ORIGIN"] = "https://clinic.example";
  });

  afterEach(() => {
    if (savedSecret === undefined) delete process.env["COMMS_UNSUBSCRIBE_SECRET"];
    else process.env["COMMS_UNSUBSCRIBE_SECRET"] = savedSecret;
    if (savedOrigin === undefined) delete process.env["APP_ORIGIN"];
    else process.env["APP_ORIGIN"] = savedOrigin;
  });

  it("round-trips: a minted token verifies back to the patient id", () => {
    const token = unsubscribeToken(PATIENT);
    expect(token).toBeTruthy();
    expect(verifyUnsubscribeToken(token!)).toBe(PATIENT);
  });

  it("rejects a tampered patient id or MAC", () => {
    const token = unsubscribeToken(PATIENT)!;
    const otherPatient = token.replace("000054", "000055");
    expect(verifyUnsubscribeToken(otherPatient)).toBeNull();
    const flipped = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifyUnsubscribeToken(flipped)).toBeNull();
    expect(verifyUnsubscribeToken("garbage")).toBeNull();
    expect(verifyUnsubscribeToken("")).toBeNull();
  });

  it("tokens minted under one secret die when the secret rotates", () => {
    const token = unsubscribeToken(PATIENT)!;
    process.env["COMMS_UNSUBSCRIBE_SECRET"] = "rotated";
    expect(verifyUnsubscribeToken(token)).toBeNull();
  });

  it("builds a footer with the public route", () => {
    const footer = unsubscribeFooter(PATIENT);
    expect(footer).toContain("https://clinic.example/u/");
    expect(footer).toContain(PATIENT);
  });
});
