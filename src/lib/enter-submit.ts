import type { KeyboardEvent } from "react";

/**
 * Enter in an open dialog / hover panel should run the same action as the
 * primary button (Save, Confirm, Send, …).
 *
 * Resolution order:
 * 1. `button[data-enter-submit]`
 * 2. Native form submit (`type="submit"`) when focus is in that form
 * 3. Last enabled button in `[data-slot="dialog-footer"]`
 *
 * In textareas / contenteditable: plain Enter submits; Shift+Enter inserts a newline.
 */
export function handleEnterSubmit(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== "Enter" || e.defaultPrevented || e.nativeEvent.isComposing) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  const target = e.target as HTMLElement | null;
  if (!target) return;

  const inMultiline = !!target.closest(
    "textarea, [contenteditable='true'], [contenteditable=''], [role='textbox'][aria-multiline='true']",
  );
  // Shift+Enter keeps a newline in multi-line fields.
  if (inMultiline && e.shiftKey) return;
  if (e.shiftKey) return;

  // Don't steal keys from open lists / menus.
  if (target.closest('[role="listbox"], [role="menu"], [role="tree"]')) return;

  const root = e.currentTarget;

  const marked = root.querySelector<HTMLButtonElement>(
    "button[data-enter-submit]:not(:disabled)",
  );
  if (marked) {
    e.preventDefault();
    e.stopPropagation();
    marked.click();
    return;
  }

  const form = target.closest("form");
  if (form && root.contains(form)) {
    const submitter = form.querySelector<HTMLButtonElement | HTMLInputElement>(
      'button[type="submit"]:not(:disabled), input[type="submit"]:not(:disabled)',
    );
    if (submitter) {
      // Single-line inputs already submit on Enter — avoid double-firing.
      if (!inMultiline && target.matches("input, select")) return;
      e.preventDefault();
      e.stopPropagation();
      form.requestSubmit(submitter);
      return;
    }
  }

  const submitBtn = root.querySelector<HTMLButtonElement>(
    'button[type="submit"]:not(:disabled)',
  );
  if (submitBtn) {
    e.preventDefault();
    e.stopPropagation();
    submitBtn.click();
    return;
  }

  const footer = root.querySelector("[data-slot='dialog-footer']");
  if (!footer) return;

  const buttons = [
    ...footer.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
  ].filter((b) => b.type !== "reset" && !b.hasAttribute("data-enter-cancel"));
  const primary = buttons[buttons.length - 1];
  if (!primary) return;

  e.preventDefault();
  e.stopPropagation();
  primary.click();
}
