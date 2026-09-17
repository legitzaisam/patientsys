import { AlertBubble } from "./alert-bubble";
import { ChatBubble } from "./chat-bubble";

/**
 * The single owner of the bottom-right corner on staff pages: exactly two
 * launchers — alerts above, chat below (the more frequently used one sits
 * closest to the thumb/cursor resting corner). Expanded surfaces render in
 * the same column, growing upwards; the sonner toaster stays above all of it.
 */
export function FloatingDock({ roles }: { roles: string[] }) {
  return (
    <div
      data-qc="floating-dock"
      className="pointer-events-none fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 print:hidden"
    >
      <AlertBubble roles={roles} />
      <ChatBubble />
    </div>
  );
}
