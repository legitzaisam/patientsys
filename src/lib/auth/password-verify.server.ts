import { createClient } from "@supabase/supabase-js";

/** Confirm a password without touching the caller's existing session. */
export async function verifyPassword(email: string, password: string) {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Missing Supabase configuration");
  const probe = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { error } = await probe.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Password was not recognised");
}
