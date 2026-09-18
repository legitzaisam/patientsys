import { AlertBubble } from "./alert-bubble";
import { ChatBubble } from "./chat-bubble";

/**
 * The single owner of the bottom-right corner on staff pages: two launchers
 * on one row — alerts to the left of chat. Expanded surfaces grow upwards
 * from each launcher; the sonner toaster stays above all of it.
 */
export function FloatingDock({ roles }: { roles: string[] }) {
  return (
    <div
      data-qc="floating-dock"
      className="pointer-events-none fixed bottom-5 right-5 z-[60] flex items-end gap-3 print:hidden"
    >
      <AlertBubble roles={roles} />
      <ChatBubble />
    </div>
  );
}
