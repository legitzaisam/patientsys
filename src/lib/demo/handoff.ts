import { DEMO_SIGNIN_URL } from "@/lib/demo/enabled";

/**
 * Hand the browser back to the marketing website in the public demo.
 *
 * The gateway already redirects full loads of /auth and /portal; these helpers
 * cover the client-side routes the gateway never sees (Sign out, the 404's Go
 * home, the brand link on sign-in pages). Every return is a full page load so
 * the gateway serves the website. All of it is inert unless DEMO_SIGNIN_URL is set.
 */

export type HandoffTarget = "staff" | "patient" | "home";

/** The website URL for a target, or null when the demo is not behind the website. */
export function demoHandoffUrl(
  target: HandoffTarget,
  opts: { idle?: boolean } = {},
): string | null {
  if (!DEMO_SIGNIN_URL) return null;
  if (target === "home") return "/";
  const [base, hash] = DEMO_SIGNIN_URL.split("#");
  const query = opts.idle ? "?idle=1" : "";
  const fragment = target === "patient" ? "#patient" : hash ? `#${hash}` : "";
  return `${base}${query}${fragment}`;
}

/** Forget the demo persona so the next entry starts from the website's picker. */
export function clearDemoRole() {
  if (typeof document === "undefined") return;
  document.cookie = "demo_role=; path=/; max-age=0; samesite=lax";
}

/** Replace the current page with the website target; true when a hand-off happened. */
export function handoffToWebsite(target: HandoffTarget, opts: { idle?: boolean } = {}): boolean {
  const url = demoHandoffUrl(target, opts);
  if (!url || typeof window === "undefined") return false;
  window.location.replace(url);
  return true;
}
