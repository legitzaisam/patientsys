/** Staff reception machines are shared; 15 minutes idle is a practical requirement. */
export const STAFF_IDLE_MS = 15 * 60 * 1000;

/** Step-up password confirmation stays valid for this long. */
export const STEP_UP_TTL_MS = 5 * 60 * 1000;

export const LOGIN_WINDOW_MINUTES = 15;
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MINUTES = 15;

export const STEP_UP_MESSAGE = "Re-enter your password to continue";
export const MFA_REQUIRED_MESSAGE = "Two-factor authentication is required";

export type AuthSurface = "staff" | "patient";
