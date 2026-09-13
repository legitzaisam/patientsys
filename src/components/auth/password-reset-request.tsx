import { useState } from "react";
import { toast } from "sonner";
import { checkEmail } from "@/lib/email";
import { toastEmailError } from "@/lib/email-toast";
import { assertLoginAllowed, requestPasswordReset } from "@/lib/auth/login-throttle";
import type { AuthSurface } from "@/lib/auth/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordResetRequest({
  surface,
  defaultEmail,
  onBack,
}: {
  surface: AuthSurface;
  defaultEmail?: string;
  onBack: () => void;
}) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const emailCheck = checkEmail(email);
    if (!emailCheck.ok) {
      toastEmailError(emailCheck, (suggestion) => setEmail(suggestion));
      return;
    }
    setBusy(true);
    try {
      await assertLoginAllowed(emailCheck.email, surface);
      await requestPasswordReset(emailCheck.email);
      toast.success("If that email is on file, you will receive a reset link shortly.");
      onBack();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send a reset link");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form onSubmit={(e) => void submit(e)} className="mt-5 space-y-3">
        <div className="field-stack">
          <Label htmlFor="reset-email">Email</Label>
          <Input
            id="reset-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Sending…" : "Send reset link"}
        </Button>
      </form>
      <button
        type="button"
        className="mt-2 w-full text-2xs text-muted-foreground hover:text-foreground"
        onClick={onBack}
      >
        Back to sign in
      </button>
    </>
  );
}
