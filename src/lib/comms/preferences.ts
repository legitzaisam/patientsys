/**
 * Shared PECR rules for the outbox.
 *
 * Marketing is opt-in. Reminders are opt-out. Transactional mail (consent
 * links, booking confirmations that are part of the service) goes if we have
 * an address. `unsubscribed_at` blocks marketing and reminders, not
 * transactional.
 */

export type CommsChannel = "email" | "sms";
export type CommsPurpose = "transactional" | "reminder" | "marketing";
export type CommsStatus = "queued" | "sending" | "sent" | "failed" | "bounced";

export type CommsPrefs = {
  email_opt_in: boolean;
  sms_opt_in: boolean;
  reminders_opt_in: boolean;
  marketing_opt_in: boolean;
  unsubscribed_at: string | null;
};

export const DEFAULT_COMMS_PREFS: CommsPrefs = {
  email_opt_in: false,
  sms_opt_in: false,
  reminders_opt_in: true,
  marketing_opt_in: false,
  unsubscribed_at: null,
};

export function prefsFromPatient(patient: Partial<CommsPrefs> | null | undefined): CommsPrefs {
  return {
    email_opt_in: patient?.email_opt_in ?? DEFAULT_COMMS_PREFS.email_opt_in,
    sms_opt_in: patient?.sms_opt_in ?? DEFAULT_COMMS_PREFS.sms_opt_in,
    reminders_opt_in: patient?.reminders_opt_in ?? DEFAULT_COMMS_PREFS.reminders_opt_in,
    marketing_opt_in: patient?.marketing_opt_in ?? DEFAULT_COMMS_PREFS.marketing_opt_in,
    unsubscribed_at: patient?.unsubscribed_at ?? null,
  };
}

/** When both non-transactional channels are off, stamp a global unsubscribe. */
export function nextUnsubscribedAt(prefs: {
  marketing_opt_in: boolean;
  reminders_opt_in: boolean;
  unsubscribed_at?: string | null;
}): string | null {
  if (!prefs.marketing_opt_in && !prefs.reminders_opt_in) {
    return prefs.unsubscribed_at ?? new Date().toISOString();
  }
  return null;
}

export function assertCanSend(
  prefs: CommsPrefs,
  purpose: CommsPurpose,
  channel: CommsChannel,
  toAddress: string,
): { ok: true } | { ok: false; reason: string } {
  if (!toAddress.trim()) {
    return {
      ok: false,
      reason:
        channel === "email"
          ? "This patient has no email address."
          : "This patient has no mobile number.",
    };
  }
  if (purpose === "transactional") return { ok: true };

  if (prefs.unsubscribed_at) {
    return { ok: false, reason: "This patient has unsubscribed from clinic messages." };
  }
  if (purpose === "reminder") {
    if (!prefs.reminders_opt_in) {
      return { ok: false, reason: "This patient has opted out of appointment reminders." };
    }
    return { ok: true };
  }
  if (!prefs.marketing_opt_in) {
    return { ok: false, reason: "This patient has not opted in to marketing messages." };
  }
  if (channel === "email" && !prefs.email_opt_in) {
    return { ok: false, reason: "This patient has not opted in to marketing email." };
  }
  if (channel === "sms" && !prefs.sms_opt_in) {
    return { ok: false, reason: "This patient has not opted in to marketing texts." };
  }
  return { ok: true };
}
