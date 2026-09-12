import { supabase } from "@/integrations/supabase/client";
import type { AuthSurface } from "@/lib/auth/constants";

const SURFACE_KEY = "aetheria:auth-surface";

export type OAuthProvider = "google" | "azure";

export function rememberAuthSurface(surface: AuthSurface) {
  try {
    sessionStorage.setItem(SURFACE_KEY, surface);
  } catch {
    /* private mode */
  }
}

export function peekAuthSurface(): AuthSurface {
  try {
    if (sessionStorage.getItem(SURFACE_KEY) === "patient") return "patient";
  } catch {
    /* private mode */
  }
  return "staff";
}

export function consumeAuthSurface(): AuthSurface {
  const surface = peekAuthSurface();
  try {
    sessionStorage.removeItem(SURFACE_KEY);
  } catch {
    /* private mode */
  }
  return surface;
}

/** Native Supabase OAuth. Replaces @lovable.dev/cloud-auth-js. */
export async function startOAuth(provider: OAuthProvider, surface: AuthSurface) {
  rememberAuthSurface(surface);
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error) throw error;
}
