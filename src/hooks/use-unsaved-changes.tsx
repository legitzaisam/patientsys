import { useBlocker } from "@tanstack/react-router";
import { ConfirmDialog } from "@/components/confirm-dialog";

/**
 * Warn before leaving a page with unsaved changes. Blocks in-app navigation
 * with a confirmation and asks the browser to confirm on reload / close.
 *
 *   const leaveGuard = useUnsavedChanges(dirty);
 *   return <>{leaveGuard}{form}</>;
 */
export function useUnsavedChanges(dirty: boolean, qc = "unsaved-changes") {
  const blocker = useBlocker({
    shouldBlockFn: () => dirty,
    enableBeforeUnload: () => dirty,
    withResolver: true,
    disabled: !dirty,
  });

  return (
    <ConfirmDialog
      open={blocker.status === "blocked"}
      onOpenChange={(open) => {
        if (!open) blocker.reset?.();
      }}
      title="Leave without saving?"
      description="You have unsaved changes on this page. They will be lost if you leave."
      confirmLabel="Leave"
      cancelLabel="Stay"
      destructive
      qc={qc}
      onConfirm={() => blocker.proceed?.()}
    />
  );
}

/** Shallow "has anything changed" for plain form objects. */
export function isDirtyForm<T extends Record<string, unknown>>(
  current: T,
  saved: T | null | undefined,
) {
  if (!saved) return false;
  return Object.keys(current).some((k) => current[k] !== saved[k]);
}
