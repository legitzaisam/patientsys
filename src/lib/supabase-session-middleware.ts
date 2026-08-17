import { createMiddleware } from "@tanstack/react-start";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";

/**
 * Resolves the current browser session and attaches its bearer token in one
 * atomic middleware step. Keeping refresh and attachment together prevents a
 * request from slipping through without a header during session transitions.
 */
/** Waits briefly for a session to appear (hydration / token refresh races). */
async function waitForSession(timeoutMs = 3000): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  return new Promise<Session | null>((resolve) => {
    const timer = setTimeout(() => {
      sub.unsubscribe();
      resolve(null);
    }, timeoutMs);
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) return;
      clearTimeout(timer);
      listener.subscription.unsubscribe();
      resolve(session);
    });
    const sub = listener.subscription;
  });
}

export const ensureSupabaseSession = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (typeof window === "undefined" || DEMO_MODE) return next();

    let session = await waitForSession();
    const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;

    if (session && expiresAt - Date.now() < 60_000) {
      const refreshed = await supabase.auth.refreshSession();
      session = refreshed.data.session;
    }

    const token = session?.access_token;
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);
