import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronDown, Eye, EyeOff, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEMO_MODE } from "@/lib/demo/enabled";
import {
  changeOwnPassword,
  listMySessions,
  revokeOtherSessions,
  sendPasswordEmailCode,
} from "@/lib/clinic.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type IdentityLike = {
  userId?: string;
  mfaRequired?: boolean;
  email?: string;
};

const otpSlotClass =
  "h-11 w-10 rounded-[11px] border border-edge bg-card text-[15px] font-semibold shadow-inset-hi first:rounded-[11px] first:border-l last:rounded-[11px]";

const rowPad = "px-5 py-4 sm:px-6";

function sinceLabel(iso?: string) {
  if (!iso) return "Current session";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "Just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 14) return `${days} days ago`;
  return new Date(iso).toLocaleDateString("en-GB");
}

function SecretField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field-stack">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-10"
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((open) => !open)}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function SecuritySettings({
  identity,
  embedded = false,
}: {
  identity: IdentityLike;
  embedded?: boolean;
}) {
  const queryClient = useQueryClient();
  const fetchSessions = useServerFn(listMySessions);
  const { data: sessions } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: () => fetchSessions(),
  });

  const requiredCodes = Boolean(identity.mfaRequired);
  const [emailCodes, setEmailCodes] = useState(requiredCodes || DEMO_MODE);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const signOutOthers = useMutation({
    mutationFn: useServerFn(revokeOtherSessions),
    onSuccess: async () => {
      toast.success("Other devices have been signed out");
      void queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requestCode = useMutation({
    mutationFn: useServerFn(sendPasswordEmailCode),
    onSuccess: (result) => {
      const sent = result as { email?: string | null; previewCode?: string | null };
      setSentTo(sent.email || identity.email || null);
      setPreviewCode(sent.previewCode ?? null);
      setCode("");
      toast.success(
        sent.previewCode
          ? "Approve the change with the code below"
          : "Check your email to approve the change",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savePassword = useMutation({
    mutationFn: useServerFn(changeOwnPassword),
    onSuccess: () => {
      toast.success("Password updated");
      setPassword("");
      setConfirm("");
      setCode("");
      setSentTo(null);
      setPreviewCode(null);
      setPasswordOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleEmailCodes(next: boolean) {
    if (requiredCodes) return;
    setEmailCodes(next);
    toast.success(next ? "Email sign-in codes turned on" : "Email sign-in codes turned off");
  }

  const passwordsReady = password.length >= 8 && password === confirm;
  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;

  function sendCode() {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("The two passwords do not match");
      return;
    }
    requestCode.mutate({} as never);
  }

  function submitPassword() {
    if (!passwordsReady) return;
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code we emailed you");
      return;
    }
    savePassword.mutate({ data: { password, code } });
  }

  const rows = sessions?.sessions ?? [{ id: "current", current: true, createdAt: new Date().toISOString() }];
  const others = rows.filter((r) => !r.current).length;
  const destination = sentTo || identity.email;

  const emailHint = requiredCodes
    ? `Required on this account. Sent to ${identity.email || "your email"} at each sign-in.`
    : DEMO_MODE
      ? "Asked at each sign-in. Demo keeps this on this device only."
      : `Asked at each sign-in and sent to ${identity.email || "your email"}.`;

  const body = (
    <div>
      {embedded ? null : (
        <div className={rowPad}>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 shrink-0 text-ink-3" />
            <h2 className="text-sm font-semibold text-foreground">Security</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Email sign-in codes, password, and the devices currently signed in as you.
          </p>
        </div>
      )}

      <section className={rowPad}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">Email codes</p>
              <Badge
                variant={emailCodes ? "success" : "secondary"}
                className="rounded-xl text-2xs uppercase"
              >
                {requiredCodes ? "Required" : emailCodes ? "On" : "Off"}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{emailHint}</p>
          </div>
          <Switch
            checked={emailCodes}
            disabled={requiredCodes}
            onCheckedChange={toggleEmailCodes}
            aria-label="Email sign-in codes"
          />
        </div>
      </section>

      <section className="border-t border-edge">
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 text-left transition-colors hover:bg-[rgba(47,63,102,0.08)]",
            rowPad,
            passwordOpen && "bg-[rgba(47,63,102,0.08)]",
          )}
          aria-expanded={passwordOpen}
          onClick={() => setPasswordOpen((open) => !open)}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Password</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {passwordOpen
                ? `We email ${identity.email || "your email"} before this can change.`
                : "Click to change. We email you first so a stolen session is not enough."}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-ink-3 transition-transform",
              passwordOpen && "rotate-180",
            )}
            aria-hidden
          />
        </button>

        {passwordOpen ? (
          <div className={cn("space-y-3 border-t border-edge", rowPad)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <SecretField
                id="sec-pass"
                label="New password"
                value={password}
                onChange={setPassword}
                placeholder="At least 8 characters"
                error={tooShort ? "Password must be at least 8 characters." : null}
              />
              <SecretField
                id="sec-confirm"
                label="Confirm password"
                value={confirm}
                onChange={setConfirm}
                placeholder="Repeat password"
                error={mismatch ? "The two passwords do not match." : null}
              />
            </div>

            {sentTo ? (
              <div className="rounded-2xl border border-edge bg-glass-2 p-3.5 shadow-inset-hi">
                <div className="field-stack">
                  <Label htmlFor="sec-code">Approval code</Label>
                  <p className="text-xs text-muted-foreground">
                    {previewCode
                      ? "Email sending is not configured, so here is your approval code."
                      : `Sent to ${destination}. Enter it to approve this change.`}
                  </p>
                  {previewCode ? (
                    <p className="font-mono text-lg tracking-[0.28em] text-foreground">{previewCode}</p>
                  ) : null}
                  <InputOTP
                    id="sec-code"
                    maxLength={6}
                    value={code}
                    onChange={setCode}
                    disabled={savePassword.isPending}
                    containerClassName="justify-start gap-2.5"
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
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    disabled={savePassword.isPending || code.length !== 6 || !passwordsReady}
                    onClick={submitPassword}
                  >
                    {savePassword.isPending ? "Updating…" : "Approve and update"}
                  </Button>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    disabled={requestCode.isPending}
                    onClick={sendCode}
                  >
                    {requestCode.isPending ? "Sending…" : "Resend email"}
                  </button>
                </div>
              </div>
            ) : (
              <Button type="button" disabled={requestCode.isPending || !passwordsReady} onClick={sendCode}>
                {requestCode.isPending ? "Sending…" : "Email me a code"}
              </Button>
            )}
          </div>
        ) : null}
      </section>

      <section className={cn("border-t border-edge", rowPad)}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Signed-in devices</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {others ? `${others} other ${others === 1 ? "device" : "devices"} signed in.` : "Only this device."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={!others || signOutOthers.isPending}
            onClick={() => signOutOthers.mutate({} as never)}
          >
            {signOutOthers.isPending ? "Signing out…" : "Sign out other devices"}
          </Button>
        </div>
        <ul className="-mx-5 mt-3 divide-y divide-edge sm:-mx-6">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-3 px-5 py-2.5 transition-colors hover:bg-[rgba(47,63,102,0.08)] sm:px-6"
            >
              <div className="min-w-0">
                <p className="text-sm text-foreground">
                  {"label" in row && row.label ? String(row.label) : row.current ? "This device" : "Another device"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{sinceLabel(row.createdAt)}</p>
              </div>
              {row.current ? (
                <Badge variant="outline" className="shrink-0 rounded-xl text-2xs uppercase">
                  Current
                </Badge>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={signOutOthers.isPending}
                  onClick={() => signOutOthers.mutate({} as never)}
                >
                  Sign out
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );

  if (embedded) return body;
  return <Card className="overflow-hidden p-0">{body}</Card>;
}
