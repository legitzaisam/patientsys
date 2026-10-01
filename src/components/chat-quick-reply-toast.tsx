import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { formatTeamAlertToast, isStaffAlertReply } from "@/lib/staff-alert-title";
import { pinAetheriaToast, unpinAetheriaToast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { getAppZoom } from "@/lib/app-zoom";

type ChatQuickReplyToastProps = {
  toastId: string | number;
  peerName: string;
  tag: string;
  description?: string | undefined;
  onOpen: () => void;
};

function peerFromTitle(title: string) {
  const m = title.match(/^(.+?) messaged you$/i);
  return m?.[1]?.trim() || title.replace(/^(Message|Urgent|Reply) from /i, "").trim() || "Teammate";
}

/** How much of the toast stays visible when docked off the left edge. */
const PEEK_VISIBLE = 0.15;

/**
 * Slide the Sonner toast shell via `left` (not transform) so we don't fight
 * Sonner's stacking transform, and the whole glass card moves together.
 */
function useQuickReplyToastDock(contentRef: React.RefObject<HTMLDivElement | null>) {
  const [docked, setDocked] = useState(false);
  const dragging = useRef(false);
  const dragMoved = useRef(false);
  const pointerId = useRef<number | null>(null);
  const dragStart = useRef({ x: 0, offset: 0, hidden: -272 });
  const offsetRef = useRef(0);
  const dockedRef = useRef(docked);
  dockedRef.current = docked;

  const shell = () =>
    contentRef.current?.closest("[data-sonner-toast]") as HTMLElement | null;

  const dockOffset = (el: HTMLElement) => -((el.offsetWidth || 320) * (1 - PEEK_VISIBLE));

  const applyLeft = (el: HTMLElement, x: number, animate: boolean) => {
    offsetRef.current = x;
    el.style.left = `${x}px`;
    el.style.transition = animate
      ? "left 0.38s cubic-bezier(0.4, 0, 0.2, 1)"
      : "none";
    el.dataset["aetheriaDocked"] = x < -8 || dockedRef.current ? "true" : "false";
  };

  useEffect(() => {
    const el = shell();
    if (!el) return;
    applyLeft(el, docked ? dockOffset(el) : 0, true);
    const ro = new ResizeObserver(() => {
      if (dragging.current) return;
      applyLeft(el, dockedRef.current ? dockOffset(el) : 0, false);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      el.style.left = "";
      el.style.transition = "";
      delete el.dataset["aetheriaDocked"];
    };
  }, [contentRef, docked]);

  useEffect(() => {
    const el = shell();
    if (!el) return;

    const isInteractive = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest("button, a, [data-aetheria-quick-reply-close]"));
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (!dockedRef.current && isInteractive(e.target)) return;
      dragMoved.current = false;
      const hidden = dockOffset(el);
      const current = dockedRef.current ? hidden : offsetRef.current;
      dragStart.current = { x: e.clientX, offset: current, hidden };
      dragging.current = true;
      pointerId.current = e.pointerId;
      applyLeft(el, current, false);
      el.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!dragging.current || pointerId.current !== e.pointerId) return;
      const { x, offset, hidden } = dragStart.current;
      if (Math.abs(e.clientX - x) > 6) dragMoved.current = true;
      applyLeft(el, Math.max(hidden, Math.min(0, offset + (e.clientX - x) / getAppZoom())), false);
    };

    const onUp = (e: PointerEvent) => {
      if (!dragging.current || pointerId.current !== e.pointerId) return;
      dragging.current = false;
      pointerId.current = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);

      const { hidden } = dragStart.current;
      const final = offsetRef.current;
      const dockThreshold = hidden * 0.2;

      if (dockedRef.current && !dragMoved.current) {
        setDocked(false);
        applyLeft(el, 0, true);
        return;
      }
      if (!dragMoved.current) {
        applyLeft(el, dockedRef.current ? hidden : 0, true);
        return;
      }

      const shouldDock = final <= dockThreshold;
      setDocked(shouldDock);
      applyLeft(el, shouldDock ? hidden : 0, true);
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [contentRef]);

  return { docked };
}

/** Team/chat ping: preview plus Open Chat. Replies live in the chat bubble. */
function ChatQuickReplyToast({
  toastId,
  peerName,
  tag,
  description,
  onOpen,
}: ChatQuickReplyToastProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { docked } = useQuickReplyToastDock(rootRef);
  const preview = description?.replace(/^["“]|["”]$/g, "") || "";

  useEffect(() => {
    pinAetheriaToast(toastId);
  }, [toastId]);

  function closeToast() {
    unpinAetheriaToast(toastId);
    toast.dismiss(toastId);
  }

  function openChat() {
    onOpen();
    closeToast();
  }

  return (
    <div
      ref={rootRef}
      data-aetheria-quick-reply=""
      data-docked={docked ? "true" : "false"}
      className="relative w-full touch-pan-y text-left"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="absolute right-0 top-0 z-10 flex h-7 items-center">
        <button
          type="button"
          data-aetheria-quick-reply-close=""
          aria-label="Close"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full",
            "border border-edge bg-glass-2 text-ink-3 shadow-inset-hi transition-colors",
            "hover:border-edge-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground",
          )}
          onClick={(e) => {
            e.stopPropagation();
            closeToast();
          }}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      </div>

      <header className="flex min-h-7 items-center pr-8">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <p className="min-w-0 truncate text-sm font-semibold tracking-[-0.012em] text-foreground">{peerName}</p>
          <span className="shrink-0 text-[10px] leading-none text-muted-foreground/45" aria-hidden>
            ·
          </span>
          <p className="shrink-0 text-2xs text-muted-foreground">{tag}</p>
        </div>
      </header>

      {preview ? (
        <div className="-mt-1.5 rounded-xl border border-edge bg-glass-2/90 px-3 py-2">
          <p className="line-clamp-3 text-[13px] leading-snug text-foreground">{preview}</p>
        </div>
      ) : null}
      <div className="mt-1 flex items-center justify-end">
        <button
          type="button"
          className="text-2xs font-semibold text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            openChat();
          }}
        >
          Open Chat
        </button>
      </div>
    </div>
  );
}

/** Show a team/chat ping as a toast that opens the chat bubble. */
export function showChatQuickReplyToast(opts: {
  notificationId: string;
  senderId: string;
  title: string;
  body?: string | null | undefined;
  kind?: string | null | undefined;
  urgent?: boolean | null | undefined;
  onOpen: () => void;
}) {
  const copy = formatTeamAlertToast({
    title: opts.title,
    body: opts.body,
    kind: opts.kind,
    urgent: opts.urgent,
  });
  showChatToast({
    id: `team-alert-${opts.notificationId}`,
    peerName: peerFromTitle(copy.title),
    tag: isStaffAlertReply(opts.title)
      ? "Replied to your alert"
      : opts.urgent || opts.kind === "urgent"
        ? "Urgent alert"
        : opts.kind === "staff_chat"
          ? "New message"
          : "Team alert",
    description: copy.description,
    onOpen: opts.onOpen,
  });
}

/** Any chat toast (team or patient): who, what kind, a preview, and Open Chat. */
export function showChatToast(opts: {
  id: string;
  peerName: string;
  tag: string;
  description?: string | undefined;
  onOpen: () => void;
}) {
  toast.custom(
    (toastId) => (
      <ChatQuickReplyToast
        toastId={toastId}
        peerName={opts.peerName}
        tag={opts.tag}
        description={opts.description}
        onOpen={opts.onOpen}
      />
    ),
    {
      id: opts.id,
      duration: Infinity,
      dismissible: false,
      closeButton: false,
      className: cn(
        "aetheria-toast aetheria-quick-reply-toast aetheria-toast-pinned",
        "border border-edge bg-[rgba(255,255,255,0.95)] text-foreground shadow-popover",
        "backdrop-blur-glass backdrop-saturate-150 rounded-[22px]",
        "!font-sans cursor-grab active:cursor-grabbing",
      ),
      onDismiss: () => {
        unpinAetheriaToast(opts.id);
      },
    },
  );
}
