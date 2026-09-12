import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { listMySessions, revokeOtherSessions } from "@/lib/clinic.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type IdentityLike = {
  userId?: string;
  mfaEnrolled?: boolean;
  mfaRequired?: boolean;
  aal?: "aal1" | "aal2";
};

export function SecuritySettings({ identity }: { identity: IdentityLike }) {
  const queryClient = useQueryClient();
  const fetchSessions = useServerFn(listMySessions);
  const { data: sessions } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: () => fetchSessions(),
    enabled: !DEMO_MODE,
  });

  const signOutOthers = useMutation({
    mutationFn: useServerFn(revokeOtherSessions),
    onSuccess: async () => {
      toast.success("Other devices have been signed out");
      void queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-ink-3" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Security</h2>
          <p className="text-xs text-muted-foreground">
            Authenticator app, and the devices currently signed in as you.
          </p>
        </div>
      </div>

      <MfaCard identity={identity} />

      <div className="space-y-3 border-t border-edge pt-4">
        <p className="text-sm font-medium text-foreground">Signed-in devices</p>
        {(sessions?.sessions ?? [{ id: "current", current: true, createdAt: new Date().toISOString() }]).map(
          (row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-glass-line px-3 py-2.5"
            >
              <div>
                <p className="text-sm text-foreground">{row.current ? "This device" : "Another device"}</p>
                <p className="text-xs text-muted-foreground">
                  {row.createdAt
                    ? `Since ${new Date(row.createdAt).toLocaleString("en-GB")}`
                    : "Current session"}
                </p>
              </div>
            </div>
          ),
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={DEMO_MODE || signOutOthers.isPending}
            onClick={() => signOutOthers.mutate({} as never)}
          >
            {signOutOthers.isPending ? "Signing out…" : "Sign out other devices"}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function MfaCard({ identity }: { identity: IdentityLike }) {
  const queryClient = useQueryClient();
  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function startEnroll() {
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Aetheria authenticator",
      });
      if (error) throw error;
      setFactorId(data.id);
      setQr(data.totp.qr_code);
      setSecret(data.totp.secret);
      setEnrolling(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start setup");
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!factorId || code.length !== 6) return;
    setBusy(true);
    try {
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
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
      toast.success("Authenticator is on");
      setEnrolling(false);
      setCode("");
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That code was not recognised");
    } finally {
      setBusy(false);
    }
  }

  async function unenroll() {
    if (identity.mfaRequired) {
      toast.error("Owners and managers must keep an authenticator on.");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const current = (data?.totp ?? []).find((f) => f.status === "verified");
      if (!current) return;
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: current.id });
      if (unenrollError) throw unenrollError;
      await supabase.auth.refreshSession();
      toast.success("Authenticator removed");
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the authenticator");
    } finally {
      setBusy(false);
    }
  }

  if (DEMO_MODE) {
    return <p className="text-sm text-muted-foreground">Two-factor authentication is not used in demo mode.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">Authenticator app</p>
      {identity.mfaEnrolled && !enrolling ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {identity.aal === "aal2" ? "On for this session." : "On — confirm a code after you next sign in."}
          </p>
          <Button variant="outline" size="sm" disabled={busy || identity.mfaRequired} onClick={() => void unenroll()}>
            Remove
          </Button>
        </div>
      ) : enrolling ? (
        <div className="space-y-3">
          {qr && (
            <div className="flex flex-col items-center gap-2">
              <img src={qr} alt="Authenticator QR code" className="h-40 w-40 rounded-2xl border border-edge bg-white p-2" />
              {secret && <p className="break-all text-center text-2xs text-muted-foreground">{secret}</p>}
            </div>
          )}
          <Label htmlFor="sec-mfa-code">Authenticator code</Label>
          <InputOTP maxLength={6} value={code} onChange={setCode} disabled={busy}>
            <InputOTPGroup>
              {Array.from({ length: 6 }, (_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEnrolling(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={busy || code.length !== 6} onClick={() => void verify()}>
              {busy ? "Checking…" : "Turn on"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {identity.mfaRequired
              ? "Required for owners and managers."
              : "Optional. Adds a code from your phone after your password."}
          </p>
          <Button size="sm" disabled={busy} onClick={() => void startEnroll()}>
            Set up
          </Button>
        </div>
      )}
    </div>
  );
}
