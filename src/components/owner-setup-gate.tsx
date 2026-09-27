import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { completeOwnerSetup } from "@/lib/clinic.functions";
import { Button } from "@/components/ui/button";

type MeLike = {
  hasSeparateManager?: boolean;
  ownerSetupAt?: string | null;
  needsOwnerSetup?: boolean;
} | null;

/** First-login questions for the clinic owner. Blocks the clinic until answered. */
export function OwnerSetupGate() {
  const queryClient = useQueryClient();
  const [hasSeparateManager, setHasSeparateManager] = useState<boolean | null>(null);

  const save = useMutation({
    mutationFn: useServerFn(completeOwnerSetup),
    onSuccess: (result) => {
      queryClient.setQueryData<MeLike>(["me"], (prev) =>
        prev
          ? {
              ...prev,
              hasSeparateManager: result.hasSeparateManager,
              ownerSetupAt: new Date().toISOString(),
              needsOwnerSetup: false,
            }
          : prev,
      );
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(20,28,48,0.45)] px-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-setup-title"
        className="glass-card w-full max-w-md p-8"
        data-qc="owner-setup-gate"
      >
        <h1 id="owner-setup-title" className="page-title">
          Set up your clinic
        </h1>
        <p className="page-subtitle">
          You are signing in as the clinic owner. This account already has full access, including
          day-to-day management.
        </p>

        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-foreground">
            Does someone else manage the clinic day to day?
          </legend>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                hasSeparateManager === false
                  ? "border-edge bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                  : "border-edge text-ink-2 hover:bg-[rgba(47,63,102,0.08)]"
              }`}
              onClick={() => setHasSeparateManager(false)}
            >
              No — I will manage it myself
            </button>
            <button
              type="button"
              className={`rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${
                hasSeparateManager === true
                  ? "border-edge bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                  : "border-edge text-ink-2 hover:bg-[rgba(47,63,102,0.08)]"
              }`}
              onClick={() => setHasSeparateManager(true)}
            >
              Yes — I will invite a clinic manager
            </button>
          </div>
        </fieldset>

        <p className="mt-5 text-xs text-muted-foreground">
          Patients will use the patient portal for their records, appointments and messages.
        </p>

        <div className="mt-6 flex justify-end">
          <Button
            disabled={hasSeparateManager === null || save.isPending}
            onClick={() => {
              if (hasSeparateManager === null) return;
              save.mutate({ data: { hasSeparateManager } });
            }}
          >
            {save.isPending ? "Saving…" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
