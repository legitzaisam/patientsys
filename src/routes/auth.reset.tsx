import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "@/lib/clinic.functions";
import { destinationFor } from "@/lib/auth/surfaces";
import { BrandLockup } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth/reset")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Choose a new password — Aetheria" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const fetchMe = useServerFn(getMe);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        if (active) setReady(true);
      }
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) setReady(true);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated");
      try {
        const identity = await fetchMe();
        navigate({
          to: destinationFor(identity.isStaff ? "staff" : "patient", identity),
          replace: true,
        });
      } catch {
        navigate({ to: "/auth", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update your password");
    } finally {
      setBusy(false);
    }
  }

  const mismatch = confirm.length > 0 && password !== confirm;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <BrandLockup />
      <div className="glass-card mt-8 w-full max-w-sm p-8">
        <h1 className="text-[19px] font-semibold tracking-[-0.016em] text-foreground">
          Choose a new password
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {ready
            ? "This replaces the password on your clinic or portal login."
            : "Open the link from your email to continue. If you have already opened it, wait a moment."}
        </p>
        <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-4">
          <div className="field-stack">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={!ready}
            />
          </div>
          <div className="field-stack">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={8}
              disabled={!ready}
            />
            {mismatch && <p className="text-xs text-destructive">Passwords do not match.</p>}
          </div>
          <Button type="submit" className="w-full" disabled={!ready || busy || password.length < 8 || mismatch}>
            {busy ? "Saving…" : "Save password"}
          </Button>
        </form>
        <Link to="/auth" className="mt-6 block text-center text-sm text-muted-foreground hover:text-foreground">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
