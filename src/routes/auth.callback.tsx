import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/clinic.functions";
import { consumeAuthSurface } from "@/lib/auth/oauth";
import { destinationFor } from "@/lib/auth/surfaces";
import { BrandLockup } from "@/components/brand-mark";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Signing in — Aetheria" }],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const fetchMe = useServerFn(getMe);
  const [error, setError] = useState<string | null>(null);
  const [signinHref, setSigninHref] = useState("/auth");

  useEffect(() => {
    let active = true;
    void (async () => {
      const surface = consumeAuthSurface();
      if (active) setSigninHref(surface === "patient" ? "/portal" : "/auth");
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error("Sign-in did not complete. Try again.");
        }
        const identity = await fetchMe();
        if (!active) return;
        navigate({ to: destinationFor(surface, identity), replace: true });
      } catch (err) {
        await supabase.auth.signOut();
        if (!active) return;
        setError(err instanceof Error ? err.message : "Could not complete sign-in");
      }
    })();
    return () => {
      active = false;
    };
  }, [fetchMe, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6">
      <BrandLockup />
      {error ? (
        <div className="glass-card max-w-sm p-6 text-center">
          <p className="text-sm text-foreground">{error}</p>
          <a href={signinHref} className="mt-4 inline-block text-sm text-accent-ink hover:underline">
            Back to sign in
          </a>
        </div>
      ) : (
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-deep border-t-transparent" />
      )}
    </div>
  );
}
