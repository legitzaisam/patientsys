/** Staff reception machines are shared; 1 hour 15 minutes idle is a practical requirement. */
export const STAFF_IDLE_MS = (1 * 60 + 15) * 60 * 1000;

/** Step-up password confirmation stays valid for this long. */
export const STEP_UP_TTL_MS = 5 * 60 * 1000;

/** Emailed sign-in codes expire after this. */
export const EMAIL_OTP_TTL_MS = 10 * 60 * 1000;

/** After an email code is accepted, this session is treated as confirmed. */
export const EMAIL_MFA_SESSION_MS = 12 * 60 * 60 * 1000;

/** Minimum gap between emailed login codes. */
export const EMAIL_OTP_RESEND_MS = 30 * 1000;

export const LOGIN_WINDOW_MINUTES = 15;
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MINUTES = 15;

export const STEP_UP_MESSAGE = "Re-enter your password to continue";
export const MFA_REQUIRED_MESSAGE = "Two-factor authentication is required";

export type AuthSurface = "staff" | "patient";
