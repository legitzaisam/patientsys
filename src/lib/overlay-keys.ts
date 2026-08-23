import type { KeyboardEvent } from "react";
import { handleEnterSubmit } from "@/lib/enter-submit";
import { handleTabBetweenFields } from "@/lib/tab-fields";

/** Shared keyboard behaviour for dialogs, popovers, and hover panels. */
export function handleOverlayKeyDown(e: KeyboardEvent<HTMLElement>) {
  handleTabBetweenFields(e, { trap: true });
  handleEnterSubmit(e);
}
