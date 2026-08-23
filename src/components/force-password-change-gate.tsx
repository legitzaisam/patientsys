import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { acknowledgeWelcome, changeOwnPassword } from "@/lib/clinic.functions";
import { handleOverlayKeyDown } from "@/lib/overlay-keys";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MeLike = {
  mustChangePassword?: boolean;
  welcomePending?: boolean;
  userId?: string;
} | null | undefined;

const pwClearedKey = (userId: string) => `aetheria:password-cleared:${userId}`;
const welcomeAfterGateKey = (userId: string) => `aetheria:welcome-after-gate:${userId}`;

export function hasClearedPasswordGate(userId: string) {
  try {
    return sessionStorage.getItem(pwClearedKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function shouldShowWelcomeAfterGate(userId: string) {
  try {
    return sessionStorage.getItem(welcomeAfterGateKey(userId)) === "1";
  } catch {
    return false;
  }
}

function markPasswordGateCleared(userId: string) {
  try {
    sessionStorage.setItem(pwClearedKey(userId), "1");
  } catch {
    /* private mode / blocked storage */
  }
}

function markWelcomeAfterGate(userId: string) {
  try {
    sessionStorage.setItem(welcomeAfterGateKey(userId), "1");
  } catch {
    /* private mode / blocked storage */
  }
}

export function clearWelcomeAfterGate(userId: string) {
  try {
    sessionStorage.removeItem(welcomeAfterGateKey(userId));
  } catch {
    /* private mode / blocked storage */
  }
}

/**
 * Blocking gate after invite / manager password reset. Staff cannot dismiss this
 * until they set a new password.
 *
 * If this is a new invite (`welcomePending`), completing the gate arms the
 * one-time team welcome — password resets alone do not.
 */
export function ForcePasswordChangeGate({
  userId,
  welcomePending,
}: {
  userId: string;
  welcomePending?: boolean;
}) {
  const queryClient = useQueryClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const change = useMutation({
    mutationFn: useServerFn(changeOwnPassword),
    onSuccess: async () => {
      if (!DEMO_MODE) {
        await supabase.auth.refreshSession();
      }
      markPasswordGateCleared(userId);
      if (welcomePending) markWelcomeAfterGate(userId);
      // Drop the gate immediately; getMe may still see a stale JWT claim.
      queryClient.setQueryData<MeLike>(["me"], (prev) =>
        prev ? { ...prev, mustChangePassword: false } : prev,
      );
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Password updated");
      setPassword("");
      setConfirm("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 8 && password === confirm && !change.isPending;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(20,28,48,0.45)] px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="force-pw-title"
        className="w-full max-w-md rounded-[22px] border border-edge-2 bg-card/95 p-5 shadow-popover"
        onKeyDown={handleOverlayKeyDown}
        data-overlay-keys=""
      >
        <h2
          id="force-pw-title"
          className="text-balance section-title"
        >
          Choose a new password
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account still uses a temporary password. Set a new one to continue.
        </p>
        <div className="mt-4 space-y-3">
          <div className="field-stack">
            <Label htmlFor="force-pw">New password</Label>
            <Input
              id="force-pw"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="field-stack">
            <Label htmlFor="force-pw-confirm">Confirm password</Label>
            <Input
              id="force-pw-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password"
            />
            {mismatch && (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-end" data-slot="dialog-footer">
          <Button
            className="text-xs"
            enterSubmit
            disabled={!canSubmit}
            onClick={() => change.mutate({ data: { password } })}
          >
            {change.isPending ? "Saving…" : "Save password"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** First-login welcome for newly invited staff. Dismissible via X or outside click. */
export function StaffWelcomeDialog({
  open,
  name,
  userId,
}: {
  open: boolean;
  name?: string | null;
  userId: string;
}) {
  const queryClient = useQueryClient();
  const ack = useMutation({
    mutationFn: useServerFn(acknowledgeWelcome),
    onSuccess: () => {
      clearWelcomeAfterGate(userId);
      queryClient.setQueryData<MeLike>(["me"], (prev) =>
        prev ? { ...prev, welcomePending: false } : prev,
      );
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });

  const firstName = name?.trim().split(/\s+/)[0];
  const hello = firstName ? `Welcome to the team, ${firstName}` : "Welcome to the team";

  function dismiss() {
    if (!open) return;
    clearWelcomeAfterGate(userId);
    queryClient.setQueryData<MeLike>(["me"], (prev) =>
      prev ? { ...prev, welcomePending: false } : prev,
    );
    ack.mutate({} as never);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) dismiss();
      }}
    >
      <DialogContent className="flex w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[22px] border-edge-2 bg-card/95 p-5 shadow-popover sm:rounded-[22px]">
        <DialogHeader className="shrink-0 pr-8 text-left">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl border border-edge bg-glass-2 text-foreground">
            <Sparkles className="h-4 w-4" aria-hidden />
          </div>
          <DialogTitle>
            {hello}
          </DialogTitle>
          <DialogDescription>
            You’re all set. Take a look around the diary, patients and clinic tools — we’re glad
            you’re here.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 flex justify-end">
          <Button onClick={dismiss}>
            Get started
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
