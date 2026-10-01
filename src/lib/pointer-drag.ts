import { getAppZoom } from "@/lib/app-zoom";

/**
 * One drag gesture (move a panel, resize a box, resize the sidebar) that works
 * the same for mouse, pen and touch.
 *
 * Why this exists: on iPad a drag handle without `touch-action: none` lets
 * Safari turn the gesture into a page scroll. Safari then sends
 * `pointercancel` instead of `pointerup`, a hand-rolled drag never ends, and
 * every later touch anywhere on the page keeps moving the panel ("jumping"),
 * while long-presses start text selection across the page.
 *
 * This helper:
 *  - ends on pointerup, pointercancel or lost capture, so a drag can never leak;
 *  - captures the pointer on the handle and blocks page scroll, text selection
 *    and the touch context menu for the length of the gesture;
 *  - reports movement as CSS pixels (divided by the app zoom).
 *
 * Give the handle element the `drag-handle` class (src/styles.css) so the
 * browser hands the gesture to the page from the first touch.
 */
export type PointerDragHandlers = {
  /** Total movement since the press, in CSS pixels. */
  onMove: (dx: number, dy: number, event: PointerEvent) => void;
  /** Called once when the gesture ends; `cancelled` if the browser took it over. */
  onEnd?: (cancelled: boolean) => void;
};

const DRAGGING_CLASS = "app-dragging";

export function startPointerDrag(
  input: PointerEvent | { nativeEvent: PointerEvent; currentTarget: EventTarget | null },
  handlers: PointerDragHandlers,
): boolean {
  const event = "nativeEvent" in input ? input.nativeEvent : input;
  const handle = (
    "nativeEvent" in input ? input.currentTarget : event.currentTarget
  ) as Element | null;
  if (event.button !== 0 || !event.isPrimary) return false;
  event.preventDefault();

  const { pointerId } = event;
  const startX = event.clientX;
  const startY = event.clientY;
  const zoom = getAppZoom();
  let done = false;

  try {
    handle?.setPointerCapture?.(pointerId);
  } catch {
    /* capture is best-effort */
  }

  const move = (e: PointerEvent) => {
    if (e.pointerId !== pointerId) return;
    if (e.cancelable) e.preventDefault();
    handlers.onMove((e.clientX - startX) / zoom, (e.clientY - startY) / zoom, e);
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId === pointerId) end(false);
  };
  const cancel = (e: PointerEvent) => {
    if (e.pointerId === pointerId) end(true);
  };
  const block = (e: Event) => {
    if (e.cancelable) e.preventDefault();
  };
  const passiveFalse = { capture: true, passive: false } as AddEventListenerOptions;

  function end(cancelled: boolean) {
    if (done) return;
    done = true;
    window.removeEventListener("pointermove", move, true);
    window.removeEventListener("pointerup", up, true);
    window.removeEventListener("pointercancel", cancel, true);
    window.removeEventListener("touchmove", block, passiveFalse);
    document.removeEventListener("selectstart", block, true);
    window.removeEventListener("contextmenu", block, true);
    handle?.removeEventListener("lostpointercapture", lost);
    document.documentElement.classList.remove(DRAGGING_CLASS);
    try {
      if (handle?.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
    } catch {
      /* already released */
    }
    handlers.onEnd?.(cancelled);
  }
  // Capture lost without a pointerup (element removed, browser took over).
  const lost = () => setTimeout(() => end(true), 0);

  window.addEventListener("pointermove", move, true);
  window.addEventListener("pointerup", up, true);
  window.addEventListener("pointercancel", cancel, true);
  window.addEventListener("touchmove", block, passiveFalse);
  document.addEventListener("selectstart", block, true);
  window.addEventListener("contextmenu", block, true);
  handle?.addEventListener("lostpointercapture", lost);
  document.documentElement.classList.add(DRAGGING_CLASS);
  window.getSelection?.()?.removeAllRanges();
  return true;
}
