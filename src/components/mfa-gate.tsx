import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

/**
 * Blocks owner/manager until they have a verified TOTP factor and this session
 * is AAL2. Enrolment talks to Supabase Auth directly so it still works while
 * every other server function refuses (`getMe` excepted).
 */
export function MfaGate({
  enrolled,
  onSatisfied,
}: {
  enrolled: boolean;
  onSatisfied: () => void;
}) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (DEMO_MODE) return;
    let cancelled = false;
    void (async () => {
      try {
        if (enrolled) {
          const { data, error: listError } = await supabase.auth.mfa.listFactors();
          if (listError) throw listError;
          const current = (data?.totp ?? []).find((f) => f.status === "verified");
          if (!cancelled && current) setFactorId(current.id);
          return;
        }
        const { data, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Aetheria authenticator",
        });
        if (enrollError) throw enrollError;
        if (cancelled) return;
        setFactorId(data.id);
        setQr(data.totp.qr_code);
        setSecret(data.totp.secret);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not start two-factor setup");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enrolled]);

  async function verify() {
    if (!factorId || code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const { error: challengeError, data: challenge } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) throw verifyError;
      await supabase.auth.refreshSession();
      toast.success("Two-factor authentication is on");
      onSatisfied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code was not recognised");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(20,28,48,0.45)] px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mfa-title"
        className="w-full max-w-md rounded-[22px] border border-edge-2 bg-card/95 p-5 shadow-popover"
      >
        <h2 id="mfa-title" className="text-balance section-title">
          {enrolled ? "Confirm it is you" : "Set up two-factor authentication"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {enrolled
            ? "Enter the six-digit code from your authenticator app to continue."
            : "Owners and managers must use an authenticator app. Scan the code, then enter the six-digit number it shows."}
        </p>

        {!enrolled && qr && (
          <div className="mt-4 flex flex-col items-center gap-3">
            <img
              src={qr}
              alt="Authenticator QR code"
              className="h-44 w-44 rounded-2xl border border-edge bg-white p-2"
            />
            {secret && (
              <p className="break-all text-center text-2xs text-muted-foreground">
                Or enter this key: {secret}
              </p>
            )}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <Label htmlFor="mfa-code">Authenticator code</Label>
          <InputOTP
            id="mfa-code"
            maxLength={6}
            value={code}
            onChange={setCode}
            disabled={busy || !factorId}
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
        </div>

        {error && (
          <p className="mt-3 text-sm text-destructive">
            {error} If your clinic has not enabled authenticator apps yet, you can continue and set
            this up later from your profile.
          </p>
        )}

        <div className="mt-4 flex justify-end gap-2">
          {error && !factorId && (
            <Button type="button" variant="outline" className="text-xs" onClick={onSatisfied}>
              Continue for now
            </Button>
          )}
          <Button
            className="text-xs"
            disabled={busy || code.length !== 6 || !factorId}
            onClick={() => void verify()}
          >
            {busy ? "Checking…" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
