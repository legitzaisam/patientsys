import { supabase } from "@/integrations/supabase/client";
import type { AuthSurface } from "@/lib/auth/constants";

type Throttle = { allowed: boolean; retry_after_seconds: number };

function asThrottle(value: unknown): Throttle {
  if (value && typeof value === "object" && "allowed" in value) {
    const row = value as { allowed?: unknown; retry_after_seconds?: unknown };
    return {
      allowed: row.allowed === true,
      retry_after_seconds: Number(row.retry_after_seconds) || 0,
    };
  }
  return { allowed: true, retry_after_seconds: 0 };
}

export async function assertLoginAllowed(email: string, surface: AuthSurface) {
  const { data, error } = await supabase.rpc("check_login_throttle", {
    p_email: email,
    p_surface: surface,
  });
  if (error) {
    // Fail open on a missing function so a half-applied migration cannot
    // lock the whole clinic out of signing in.
    console.error("[auth] check_login_throttle failed:", error.message);
    return;
  }
  const throttle = asThrottle(data);
  if (throttle.allowed) return;
  const minutes = Math.max(1, Math.ceil(throttle.retry_after_seconds / 60));
  throw new Error(
    `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
  );
}

export async function recordLoginEvent(email: string, surface: AuthSurface, success: boolean) {
  const { error } = await supabase.rpc("record_login_event", {
    p_email: email,
    p_surface: surface,
    p_success: success,
  });
  if (error) console.error("[auth] record_login_event failed:", error.message);
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset`,
  });
  if (error) throw error;
}
