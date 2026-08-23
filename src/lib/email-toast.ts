import { toast } from "sonner";
import type { EmailCheck } from "@/lib/email";

/**
 * Show an email validation error. When a domain typo suggestion is available
 * and `onApply` is provided, offer a Yes action that fills the corrected address.
 */
export function toastEmailError(
  check: Extract<EmailCheck, { ok: false }>,
  onApply?: (suggestion: string) => void,
) {
  if (check.suggestion && onApply) {
    toast.error(check.error, {
      action: {
        label: "Yes",
        onClick: () => onApply(check.suggestion!),
      },
      duration: 10_000,
    });
    return;
  }
  toast.error(check.error);
}
