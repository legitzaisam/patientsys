import { describe, expect, it } from "vitest";
import {
  assertCanSend,
  DEFAULT_COMMS_PREFS,
  nextUnsubscribedAt,
  prefsFromPatient,
  type CommsChannel,
  type CommsPrefs,
  type CommsPurpose,
} from "@/lib/comms/preferences";

const optedInToEverything: CommsPrefs = {
  email_opt_in: true,
  sms_opt_in: true,
  reminders_opt_in: true,
  marketing_opt_in: true,
  unsubscribed_at: null,
};

const optedOutOfEverything: CommsPrefs = {
  email_opt_in: false,
  sms_opt_in: false,
  reminders_opt_in: false,
  marketing_opt_in: false,
  unsubscribed_at: "2026-01-01T00:00:00.000Z",
};

const CHANNELS: CommsChannel[] = ["email", "sms"];
const PURPOSES: CommsPurpose[] = ["transactional", "reminder", "marketing"];

describe("assertCanSend", () => {
  it("blocks every purpose on every channel when there is no address", () => {
    for (const purpose of PURPOSES) {
      const email = assertCanSend(optedInToEverything, purpose, "email", "  ");
      expect(email).toEqual({ ok: false, reason: "This patient has no email address." });
      const sms = assertCanSend(optedInToEverything, purpose, "sms", "");
      expect(sms).toEqual({ ok: false, reason: "This patient has no mobile number." });
    }
  });

  it("always allows transactional mail when an address exists, even after unsubscribe", () => {
    for (const channel of CHANNELS) {
      expect(assertCanSend(optedOutOfEverything, "transactional", channel, "x@y.z").ok).toBe(true);
    }
  });

  it("blocks reminders and marketing once unsubscribed_at is set, even with opt-ins", () => {
    const unsubscribed = { ...optedInToEverything, unsubscribed_at: "2026-01-01T00:00:00.000Z" };
    for (const channel of CHANNELS) {
      expect(assertCanSend(unsubscribed, "reminder", channel, "x@y.z")).toEqual({
        ok: false,
        reason: "This patient has unsubscribed from clinic messages.",
      });
      expect(assertCanSend(unsubscribed, "marketing", channel, "x@y.z")).toEqual({
        ok: false,
        reason: "This patient has unsubscribed from clinic messages.",
      });
    }
  });

  it("gates reminders on reminders_opt_in only, not the channel opt-ins", () => {
    const remindersOnly: CommsPrefs = {
      email_opt_in: false,
      sms_opt_in: false,
      reminders_opt_in: true,
      marketing_opt_in: false,
      unsubscribed_at: null,
    };
    for (const channel of CHANNELS) {
      expect(assertCanSend(remindersOnly, "reminder", channel, "x@y.z").ok).toBe(true);
    }
    const optedOut = { ...remindersOnly, reminders_opt_in: false };
    for (const channel of CHANNELS) {
      expect(assertCanSend(optedOut, "reminder", channel, "x@y.z")).toEqual({
        ok: false,
        reason: "This patient has opted out of appointment reminders.",
      });
    }
  });

  it("requires marketing_opt_in plus the per-channel opt-in for marketing", () => {
    const noMarketing = { ...optedInToEverything, marketing_opt_in: false };
    for (const channel of CHANNELS) {
      expect(assertCanSend(noMarketing, "marketing", channel, "x@y.z")).toEqual({
        ok: false,
        reason: "This patient has not opted in to marketing messages.",
      });
    }

    const noEmail = { ...optedInToEverything, email_opt_in: false };
    expect(assertCanSend(noEmail, "marketing", "email", "x@y.z")).toEqual({
      ok: false,
      reason: "This patient has not opted in to marketing email.",
    });
    expect(assertCanSend(noEmail, "marketing", "sms", "07700900000").ok).toBe(true);

    const noSms = { ...optedInToEverything, sms_opt_in: false };
    expect(assertCanSend(noSms, "marketing", "sms", "07700900000")).toEqual({
      ok: false,
      reason: "This patient has not opted in to marketing texts.",
    });
    expect(assertCanSend(noSms, "marketing", "email", "x@y.z").ok).toBe(true);

    expect(assertCanSend(optedInToEverything, "marketing", "email", "x@y.z").ok).toBe(true);
    expect(assertCanSend(optedInToEverything, "marketing", "sms", "07700900000").ok).toBe(true);
  });
});

describe("prefsFromPatient", () => {
  it("returns the defaults for a missing patient", () => {
    expect(prefsFromPatient(null)).toEqual(DEFAULT_COMMS_PREFS);
    expect(prefsFromPatient(undefined)).toEqual(DEFAULT_COMMS_PREFS);
  });

  it("defaults are marketing off, reminders on", () => {
    expect(DEFAULT_COMMS_PREFS).toEqual({
      email_opt_in: false,
      sms_opt_in: false,
      reminders_opt_in: true,
      marketing_opt_in: false,
      unsubscribed_at: null,
    });
  });

  it("fills only the missing fields", () => {
    expect(prefsFromPatient({ marketing_opt_in: true })).toEqual({
      ...DEFAULT_COMMS_PREFS,
      marketing_opt_in: true,
    });
  });
});

describe("nextUnsubscribedAt", () => {
  it("stamps a new timestamp when both marketing and reminders are off", () => {
    const stamped = nextUnsubscribedAt({ marketing_opt_in: false, reminders_opt_in: false });
    expect(stamped).not.toBeNull();
    expect(Number.isNaN(new Date(stamped as string).getTime())).toBe(false);
  });

  it("preserves an existing timestamp instead of moving it", () => {
    const existing = "2026-01-01T00:00:00.000Z";
    expect(
      nextUnsubscribedAt({
        marketing_opt_in: false,
        reminders_opt_in: false,
        unsubscribed_at: existing,
      }),
    ).toBe(existing);
  });

  it("clears when either channel is back on", () => {
    expect(nextUnsubscribedAt({ marketing_opt_in: true, reminders_opt_in: false })).toBeNull();
    expect(nextUnsubscribedAt({ marketing_opt_in: false, reminders_opt_in: true })).toBeNull();
  });
});
