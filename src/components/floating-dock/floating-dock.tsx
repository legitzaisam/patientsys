import { useEffect, useRef } from "react";
import { AlertBubble } from "./alert-bubble";
import { ChatBubble } from "./chat-bubble";

/**
 * The single owner of the bottom-right corner on staff pages: two launchers
 * on one row — alerts to the left of chat. Expanded surfaces grow upwards
 * from each launcher; the sonner toaster stays above all of it.
 *
 * The dock publishes the height of its launcher row (plus its bottom offset)
 * as `--dock-h` on the root element so sticky surfaces that share the
 * bottom-right corner — the patient record and team chat panels — keep their
 * composers above the pills. Only the persistent row counts: the alert cards
 * that peek or open above it are transient and may cover the panel briefly.
 */
export function FloatingDock({ roles }: { roles: string[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => {
      const bottom = el.getBoundingClientRect().bottom;
      let top = bottom;
      el.querySelectorAll<HTMLElement>('[data-qc="alert-bubble"], [data-qc="chat-bubble"]').forEach(
        (b) => {
          top = Math.min(top, b.getBoundingClientRect().top);
        },
      );
      root.style.setProperty("--dock-h", `${Math.ceil(bottom - top) + 20}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--dock-h");
    };
  }, []);

  return (
    <div
      ref={ref}
      data-qc="floating-dock"
      className="pointer-events-none fixed bottom-5 right-5 z-40 flex items-end gap-3 print:hidden"
    >
      <AlertBubble roles={roles} />
      <ChatBubble />
    </div>
  );
}
