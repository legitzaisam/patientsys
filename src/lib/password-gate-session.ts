/** Session flags for the force-password gate and post-invite welcome. */

const pwClearedKey = (userId: string) => `aetheria:password-cleared:${userId}`;
const welcomeAfterGateKey = (userId: string) => `aetheria:welcome-after-gate:${userId}`;

export function hasClearedPasswordGate(userId: string) {
  try {
    return sessionStorage.getItem(pwClearedKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function shouldShowWelcomeAfterGate(userId: string) {
  try {
    return sessionStorage.getItem(welcomeAfterGateKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markPasswordGateCleared(userId: string) {
  try {
    sessionStorage.setItem(pwClearedKey(userId), "1");
  } catch {
    /* private mode / blocked storage */
  }
}

export function markWelcomeAfterGate(userId: string) {
  try {
    sessionStorage.setItem(welcomeAfterGateKey(userId), "1");
  } catch {
    /* private mode / blocked storage */
  }
}

export function clearWelcomeAfterGate(userId: string) {
  try {
    sessionStorage.removeItem(welcomeAfterGateKey(userId));
  } catch {
    /* private mode / blocked storage */
  }
}

const mfaSatisfiedKey = (userId: string) => `aetheria:mfa-satisfied:${userId}`;

export function hasSatisfiedMfaGate(userId: string) {
  try {
    return sessionStorage.getItem(mfaSatisfiedKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function markMfaGateSatisfied(userId: string) {
  try {
    sessionStorage.setItem(mfaSatisfiedKey(userId), "1");
  } catch {
    /* private mode / blocked storage */
  }
}
