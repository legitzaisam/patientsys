/**
 * Demo mode renders the whole UI from fixtures instead of Supabase.
 * Enabled with `npm run dev:demo`; the constant is injected by vite.config.ts.
 */
declare const __DEMO_MODE__: boolean | undefined;

export const DEMO_MODE = typeof __DEMO_MODE__ !== "undefined" && __DEMO_MODE__ === true;
