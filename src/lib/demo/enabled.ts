/**
 * Demo mode renders the whole UI from fixtures instead of Supabase.
 * Enabled with `npm run dev:demo`; the constant is injected by vite.config.ts.
 */
declare const __DEMO_MODE__: boolean | undefined;
declare const __DEMO_NOW__: string | null | undefined;
declare const __DEMO_SIGNIN_URL__: string | null | undefined;

export const DEMO_MODE = typeof __DEMO_MODE__ !== "undefined" && __DEMO_MODE__ === true;

/** Optional fixed "now" for the demo fixtures, so tests see a stable diary. */
export const DEMO_NOW: string | null =
  typeof __DEMO_NOW__ !== "undefined" && __DEMO_NOW__ ? __DEMO_NOW__ : null;

/**
 * Where the public demo signs people in. Set by the launch gateway's start-demo.sh
 * (`DEMO_SIGNIN_URL=/login`): the marketing website then owns sign-in, and the
 * app's own /auth, /portal and landing hand the browser back to it. Unset in plain
 * `npm run dev:demo` and in the e2e suite, where those pages behave as before.
 */
export const DEMO_SIGNIN_URL: string | null =
  DEMO_MODE && typeof __DEMO_SIGNIN_URL__ !== "undefined" && __DEMO_SIGNIN_URL__
    ? __DEMO_SIGNIN_URL__
    : null;
