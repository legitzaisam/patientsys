/** True when the event target is inside a Sonner toast (outside dialogs/popovers). */
export function isToastEventTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest("[data-sonner-toast], [data-sonner-toaster]"))
  );
}
