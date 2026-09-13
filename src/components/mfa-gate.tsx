import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { EMAIL_OTP_TTL_MS } from "@/lib/auth/constants";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { sendLoginEmailCode, verifyLoginEmailCode } from "@/lib/clinic.functions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const otpSlotClass =
  "h-11 w-10 rounded-[11px] border border-edge bg-glass-2 text-[15px] font-semibold shadow-inset-hi first:rounded-[11px] first:border-l last:rounded-[11px]";

const MFA_CODE_AT_KEY = "aetheria:mfa-code-requested-at";
const MFA_PREVIEW_KEY = "aetheria:mfa-preview-code";
const MFA_SENT_TO_KEY = "aetheria:mfa-sent-to";

function readRecentMfaSend(): { sentTo: string | null; previewCode: string | null } | null {
  try {
    const at = Number(sessionStorage.getItem(MFA_CODE_AT_KEY));
    if (!Number.isFinite(at) || Date.now() - at >= EMAIL_OTP_TTL_MS) return null;
    return {
      sentTo: sessionStorage.getItem(MFA_SENT_TO_KEY),
      previewCode: sessionStorage.getItem(MFA_PREVIEW_KEY),
    };
  } catch {
    return null;
  }
}

function rememberMfaSend(sentTo: string | null, previewCode: string | null) {
  try {
    sessionStorage.setItem(MFA_CODE_AT_KEY, String(Date.now()));
    if (sentTo) sessionStorage.setItem(MFA_SENT_TO_KEY, sentTo);
    else sessionStorage.removeItem(MFA_SENT_TO_KEY);
    if (previewCode) sessionStorage.setItem(MFA_PREVIEW_KEY, previewCode);
    else sessionStorage.removeItem(MFA_PREVIEW_KEY);
  } catch {
    /* private mode / blocked storage */
  }
}

function CodeBoxes({
  id,
  code,
  onChange,
  disabled,
}: {
  id: string;
  code: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <InputOTP
      id={id}
      maxLength={6}
      value={code}
      onChange={onChange}
      disabled={disabled}
      containerClassName="justify-center gap-2.5"
    >
      <InputOTPGroup className="gap-1.5">
        {[0, 1, 2].map((i) => (
          <InputOTPSlot key={i} index={i} className={otpSlotClass} />
        ))}
      </InputOTPGroup>
      <span aria-hidden className="h-1 w-1 rounded-full bg-ink-3" />
      <InputOTPGroup className="gap-1.5">
        {[3, 4, 5].map((i) => (
          <InputOTPSlot key={i} index={i} className={otpSlotClass} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

/** Blocks owner/manager until they confirm the 6-digit code emailed to them. */
export function MfaGate({ email, onSatisfied }: { email?: string; onSatisfied: () => void }) {
  const requestEmailCode = useServerFn(sendLoginEmailCode);
  const checkEmailCode = useServerFn(verifyLoginEmailCode);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const emailedForVisit = useRef(false);

  useEffect(() => {
    if (DEMO_MODE || emailedForVisit.current) return;
    const recent = readRecentMfaSend();
    if (recent) {
      emailedForVisit.current = true;
      setSentTo(recent.sentTo || email || null);
      setPreviewCode(recent.previewCode);
      return;
    }
    emailedForVisit.current = true;
    let cancelled = false;
    void (async () => {
      setSending(true);
      setError(null);
      try {
        const result = await requestEmailCode();
        if (!cancelled) {
          const destination = result.email || email || null;
          const preview = result.previewCode ?? null;
          setSentTo(destination);
          setPreviewCode(preview);
          rememberMfaSend(destination, preview);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not send a login code");
        }
      } finally {
        if (!cancelled) setSending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email, requestEmailCode]);

  async function resendEmail() {
    setSending(true);
    setError(null);
    try {
      const result = await requestEmailCode();
      const destination = result.email || email || null;
      const preview = result.previewCode ?? null;
      setSentTo(destination);
      setPreviewCode(preview);
      rememberMfaSend(destination, preview);
      toast.success(preview ? "A new code is ready" : "A new code is on its way");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send a login code");
    } finally {
      setSending(false);
    }
  }

  async function verifyEmail() {
    if (code.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      await checkEmailCode({ data: { code } });
      toast.success("Signed in");
      onSatisfied();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code was not recognised");
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  const destination = sentTo || email;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(20,28,48,0.45)] px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="mfa-title"
        className="w-full max-w-md rounded-[22px] border border-edge-2 bg-card/95 p-5 shadow-popover"
      >
        <h2 id="mfa-title" className="text-balance section-title">
          Confirm it is you
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {sending
            ? "Sending a 6-digit code…"
            : previewCode
              ? "Email sending is not configured yet, so here is your code for this sign-in."
              : destination
                ? `We sent a 6-digit code to ${destination}.`
                : "We will email you a 6-digit code."}
        </p>
        {previewCode && (
          <p className="mt-3 text-center font-mono text-2xl tracking-[0.28em] text-foreground">{previewCode}</p>
        )}

        <div className="mt-5 flex flex-col items-center gap-2">
          <Label htmlFor="mfa-code">Email code</Label>
          <CodeBoxes id="mfa-code" code={code} onChange={setCode} disabled={busy} />
        </div>

        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}

        <div className="mt-5 flex flex-col gap-2">
          <Button className="w-full" disabled={busy || code.length !== 6} onClick={() => void verifyEmail()}>
            {busy ? "Checking…" : "Continue"}
          </Button>
          <button
            type="button"
            className="w-full text-2xs text-muted-foreground hover:text-foreground"
            disabled={sending}
            onClick={() => void resendEmail()}
          >
            {sending ? "Sending…" : "Resend code"}
          </button>
        </div>
      </div>
    </div>
  );
}
