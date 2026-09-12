import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { checkEmail } from "@/lib/email";
import { toastEmailError } from "@/lib/email-toast";
import { getMe } from "@/lib/clinic.functions";
import { assertLoginAllowed, recordLoginEvent } from "@/lib/auth/login-throttle";
import { destinationFor } from "@/lib/auth/surfaces";
import { BrandLockup } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { PasswordResetRequest } from "@/components/auth/password-reset-request";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { idle?: "1" } => {
    const idle = search["idle"];
    return idle === "1" || idle === true ? { idle: "1" } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in — Aetheria Clinic Records" },
      {
        name: "description",
        content: "Secure sign in for clinic practitioners of Aetheria.",
      },
      { property: "og:title", content: "Sign in — Aetheria Clinic Records" },
      { property: "og:description", content: "Secure sign in for clinic staff." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { idle } = Route.useSearch();
  const fetchMe = useServerFn(getMe);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (idle) toast.message("You were signed out after a period of inactivity.");
  }, [idle]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active || !data.session) return;
      try {
        const identity = await fetchMe();
        navigate({ to: destinationFor("staff", identity), replace: true });
      } catch {
        await supabase.auth.signOut();
      }
    });
    return () => {
      active = false;
    };
  }, [fetchMe, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const emailCheck = checkEmail(email);
    if (!emailCheck.ok) {
      toastEmailError(emailCheck, (suggestion) => setEmail(suggestion));
      return;
    }
    setBusy(true);
    try {
      await assertLoginAllowed(emailCheck.email, "staff");
      const { error } = await supabase.auth.signInWithPassword({
        email: emailCheck.email,
        password,
      });
      if (error) {
        await recordLoginEvent(emailCheck.email, "staff", false);
        throw error;
      }
      const identity = await fetchMe();
      await recordLoginEvent(emailCheck.email, "staff", true);
      navigate({ to: destinationFor("staff", identity), replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      if (message.includes("patient portal") || message.includes("staff")) {
        await supabase.auth.signOut();
      }
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-accent-hi via-accent to-70% to-lane-6 p-12 text-accent-foreground lg:flex">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(700px_460px_at_18%_-8%,var(--sheen),transparent_62%)]"
        />
        <BrandLockup variant="on-gold" light className="relative" />
        <div className="relative max-w-md space-y-4">
          <h1 className="text-[40px] font-semibold leading-[1.1] tracking-[-0.02em]">
            Patient records built for aesthetic practice.
          </h1>
          <p className="text-sm text-accent-foreground/75">
            Treatment histories, before &amp; after imagery, consent and consultation forms, and
            direct patient messaging — held to JCCP and UK GDPR expectations.
          </p>
        </div>
        <p className="relative text-xs text-accent-foreground/65">
          Every record access is written to an immutable audit trail.
        </p>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="glass-card w-full max-w-sm p-8">
          <h2 className="text-[19px] font-semibold tracking-[-0.016em] text-foreground">
            {mode === "forgot" ? "Reset your password" : "Staff sign in"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "forgot"
              ? "We will email a link if this address has a clinic login."
              : "Clinic staff only. Patients use the patient portal."}
          </p>

          {mode === "forgot" ? (
            <PasswordResetRequest
              surface="staff"
              defaultEmail={email}
              onBack={() => setMode("signin")}
            />
          ) : (
            <>
              <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-4">
                <div className="field-stack">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="field-stack">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </form>

              <button
                type="button"
                className="mt-3 w-full text-sm text-muted-foreground hover:text-foreground"
                onClick={() => setMode("forgot")}
              >
                Forgot password?
              </button>

              <div className="my-6 flex items-center gap-3 text-xs tracking-[0.02em] text-muted-foreground">
                <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
              </div>

              <OAuthButtons surface="staff" />

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Need an account? Ask your clinic owner to invite you.
              </p>

              <Link to="/portal" className="mt-4 block text-center text-sm text-accent-ink hover:underline">
                Are you a patient? Use the patient portal
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
