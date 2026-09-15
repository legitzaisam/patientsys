/**
 * Demo mode renders the whole UI from fixtures instead of Supabase.
 * Enabled with `npm run dev:demo`; the constant is injected by vite.config.ts.
 */
declare const __DEMO_MODE__: boolean | undefined;
declare const __DEMO_NOW__: string | null | undefined;

export const DEMO_MODE = typeof __DEMO_MODE__ !== "undefined" && __DEMO_MODE__ === true;

/** Optional fixed "now" for the demo fixtures, so tests see a stable diary. */
export const DEMO_NOW: string | null =
  typeof __DEMO_NOW__ !== "undefined" && __DEMO_NOW__ ? __DEMO_NOW__ : null;
