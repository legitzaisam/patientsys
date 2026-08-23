import type { KeyboardEvent as ReactKeyboardEvent } from "react";

const FIELD_SELECTOR = [
  'input:not([type="hidden"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([disabled]):not([tabindex="-1"])',
  "textarea:not([disabled]):not([tabindex='-1'])",
  "select:not([disabled]):not([tabindex='-1'])",
  '[contenteditable="true"]:not([tabindex="-1"])',
  "[data-tab-field]:not([disabled]):not([tabindex='-1'])",
].join(",");

function isVisible(el: HTMLElement) {
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (el.closest("[hidden], [aria-hidden='true']")) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden") return false;
  return el.getClientRects().length > 0;
}

/** Fillable controls in DOM order inside `root`. */
export function listTabFields(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FIELD_SELECTOR)].filter(isVisible);
}

function focusField(el: HTMLElement) {
  el.focus();
  if (
    el instanceof HTMLInputElement &&
    !["checkbox", "radio", "file", "color", "range"].includes(el.type)
  ) {
    try {
      el.select();
    } catch {
      /* some input types cannot select */
    }
  } else if (el instanceof HTMLTextAreaElement) {
    el.select();
  }
}

type TabOptions = {
  /**
   * When true (dialogs / popovers / hover panels), Tab cycles inside the root.
   * When false (page forms), Tab leaves the form after the last / before the first field.
   */
  trap?: boolean;
};

/**
 * Tab / Shift+Tab moves focus to the next / previous field to fill
 * (inputs, textareas, selects, and `[data-tab-field]`), skipping other controls.
 */
export function handleTabBetweenFields(
  e: ReactKeyboardEvent<HTMLElement> | KeyboardEvent,
  options: TabOptions = {},
) {
  if (e.key !== "Tab" || e.defaultPrevented) return;
  const composing =
    "nativeEvent" in e ? e.nativeEvent.isComposing : (e as KeyboardEvent).isComposing;
  if (composing) return;

  const target = e.target as HTMLElement | null;
  if (!target) return;

  // Nested pickers / menus manage their own focus.
  if (
    target.closest(
      '[role="listbox"], [role="menu"], [role="tree"], [data-radix-select-content], [data-radix-menu-content]',
    )
  ) {
    return;
  }

  const trap = options.trap ?? false;
  const root =
    "currentTarget" in e && e.currentTarget instanceof HTMLElement
      ? e.currentTarget
      : (target.closest(
          '[role="dialog"], [data-tab-fields], form, [data-radix-popper-content-wrapper]',
        ) as HTMLElement | null);

  if (!root) return;

  // Prefer the popper content node when the wrapper was matched.
  const scope =
    root.hasAttribute("data-radix-popper-content-wrapper")
      ? ((root.firstElementChild as HTMLElement | null) ?? root)
      : root;

  const fields = listTabFields(scope);
  if (fields.length === 0) return;

  const active = document.activeElement as HTMLElement | null;
  const idx = fields.findIndex((el) => el === active || (active != null && el.contains(active)));

  if (!trap) {
    // Allow leaving the form at the ends.
    if (idx < 0) return;
    if (!e.shiftKey && idx >= fields.length - 1) return;
    if (e.shiftKey && idx <= 0) return;
  }

  e.preventDefault();
  if ("stopPropagation" in e) e.stopPropagation();

  let next: HTMLElement;
  if (idx < 0) {
    next = e.shiftKey ? fields[fields.length - 1]! : fields[0]!;
  } else if (e.shiftKey) {
    next = fields[idx === 0 ? fields.length - 1 : idx - 1]!;
  } else {
    next = fields[idx >= fields.length - 1 ? 0 : idx + 1]!;
  }

  focusField(next);
}

/**
 * Document-level Tab: within any form / `[data-tab-fields]` scope, jump
 * field-to-field (no trap — can leave at the ends).
 */
export function onDocumentTabBetweenFields(e: KeyboardEvent) {
  if (e.key !== "Tab" || e.defaultPrevented || e.isComposing) return;
  const target = e.target as HTMLElement | null;
  if (!target) return;

  // Overlays handle Tab themselves with trapping.
  if (
    target.closest(
      '[role="dialog"], [data-radix-hover-card-content], [data-state][data-side]',
    )
  ) {
    // Still allow if they didn't trap (no overlay handler) — but our overlays do.
    if (target.closest("[data-overlay-keys]")) return;
  }

  const scope = target.closest<HTMLElement>("form, [data-tab-fields]");
  if (!scope) return;

  // Re-dispatch through the same logic with the form as root.
  const fields = listTabFields(scope);
  if (fields.length < 2) return;

  const active = document.activeElement as HTMLElement | null;
  const idx = fields.findIndex((el) => el === active || (active != null && el.contains(active)));
  if (idx < 0) return;
  if (!e.shiftKey && idx >= fields.length - 1) return;
  if (e.shiftKey && idx <= 0) return;

  // Skip intervening non-fields (buttons, links, …).
  const nextIdx = e.shiftKey ? idx - 1 : idx + 1;
  const next = fields[nextIdx];
  if (!next) return;

  e.preventDefault();
  focusField(next);
}
