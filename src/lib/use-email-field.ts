import { useCallback, useState } from "react";
import { checkEmail, type EmailCheck } from "@/lib/email";

/**
 * Email field state that only surfaces validation after the user leaves the
 * field (blur) or tries to submit — never while they are still typing.
 */
export function useEmailField(label = "email address") {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const clearFeedback = useCallback(() => {
    setError(null);
    setSuggestion(null);
  }, []);

  const applyCheck = useCallback(
    (raw: string, { allowEmpty = false }: { allowEmpty?: boolean } = {}): EmailCheck | { ok: true; email: "" } => {
      const trimmed = raw.trim();
      if (!trimmed) {
        clearFeedback();
        if (allowEmpty) return { ok: true, email: "" };
        const empty = checkEmail("", label);
        setError(empty.ok ? null : empty.error);
        setSuggestion(null);
        return empty;
      }
      const check = checkEmail(raw, label);
      setError(check.ok ? null : check.error);
      setSuggestion(check.ok ? null : (check.suggestion ?? null));
      return check;
    },
    [clearFeedback, label],
  );

  const onChange = useCallback(
    (next: string) => {
      setValue(next);
      // Never show typo / validity messages mid-keystroke.
      clearFeedback();
    },
    [clearFeedback],
  );

  const onBlur = useCallback(() => {
    if (!value.trim()) {
      clearFeedback();
      return;
    }
    applyCheck(value);
  }, [applyCheck, clearFeedback, value]);

  /** Run before submit. Returns the normalised email when valid (or "" when empty + optional). */
  const validate = useCallback(
    (opts?: { optional?: boolean }): string | null => {
      const check = applyCheck(value, { allowEmpty: Boolean(opts?.optional) });
      if (!check.ok) return null;
      return check.email;
    },
    [applyCheck, value],
  );

  const acceptSuggestion = useCallback(() => {
    if (!suggestion) return;
    setValue(suggestion);
    clearFeedback();
  }, [clearFeedback, suggestion]);

  const reset = useCallback(() => {
    setValue("");
    clearFeedback();
  }, [clearFeedback]);

  return {
    value,
    setValue,
    error,
    suggestion,
    onChange,
    onBlur,
    validate,
    acceptSuggestion,
    reset,
    clearFeedback,
  };
}
