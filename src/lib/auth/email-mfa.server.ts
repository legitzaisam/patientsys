/**
 * How, if at all, this deployment can deliver a 6-digit sign-in code.
 *
 * `preview` hands the code back to the browser, so it is opt-in by an explicit
 * variable rather than inferred from NODE_ENV. Inferring it means an unset
 * NODE_ENV — the default for a plain `node` process — silently turns the gate
 * into theatre, and the failure looks identical to success.
 */
export type EmailMfaDelivery = "resend" | "preview" | "unavailable";

export function emailMfaDelivery(): EmailMfaDelivery {
  if (process.env["RESEND_API_KEY"]?.trim()) return "resend";
  if (process.env["AUTH_DEV_SHOW_OTP"]?.trim() === "1") return "preview";
  return "unavailable";
}

/**
 * Email MFA is only enforced when a code can actually reach the person.
 *
 * Owners and managers are challenged on every handler but `getMe` and the two
 * code endpoints, and there is no bypass for an owner. Enforcing that with no
 * way to send a code locks the whole clinic out of its own records, which is
 * the lockout the pre-email gate deliberately avoided.
 */
export function emailMfaEnforceable() {
  return emailMfaDelivery() !== "unavailable";
}
