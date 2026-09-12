import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { confirmStepUp } from "@/lib/clinic.functions";
import { STEP_UP_MESSAGE } from "@/lib/auth/constants";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function isStepUpRequired(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes(STEP_UP_MESSAGE);
}

/**
 * Prompts for the caller's password, records a 5-minute step-up on the server,
 * then retries the action. Used for archive, revoke, and permission changes.
 */
export function useStepUp() {
  const queryClient = useQueryClient();
  const confirm = useServerFn(confirmStepUp);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const pending = useRef<(() => Promise<unknown>) | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (DEMO_MODE) return { ok: true as const };
      return confirm({ data: { password } });
    },
    onSuccess: async () => {
      const next = pending.current;
      pending.current = null;
      setOpen(false);
      setPassword("");
      if (next) await next();
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    try {
      return await fn();
    } catch (error) {
      if (!isStepUpRequired(error)) throw error;
      pending.current = fn;
      setOpen(true);
      return undefined;
    }
  }

  const dialog = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="rounded-[22px] border-edge-2 bg-card/95 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm it is you</DialogTitle>
          <DialogDescription>
            This change is destructive. Re-enter your password to continue.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (password.length >= 8) save.mutate();
          }}
        >
          <div className="field-stack">
            <Label htmlFor="step-up-password">Password</Label>
            <Input
              id="step-up-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending || password.length < 8}>
              {save.isPending ? "Checking…" : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { run, dialog };
}
