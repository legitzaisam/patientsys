import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronRight, MessageSquare, Minus, Send, X } from "lucide-react";
import { toast } from "sonner";
import { getStaffChat, markStaffChatRead, sendStaffChatMessage } from "@/lib/clinic.functions";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { formatTeamAlertToast } from "@/lib/staff-alert-title";
import { useAuthSessionReady } from "@/lib/use-auth-session-ready";
import { useIdentity } from "@/lib/use-identity";
import { pinAetheriaToast, unpinAetheriaToast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatQuickReplyToastProps = {
  toastId: string | number;
  senderId: string;
  notificationId: string;
  title: string;
  description?: string;
  onOpen: () => void;
};

type ThreadMessage = {
  id: string;
  body: string;
  created_at: string;
  mine: boolean;
};

type ThreadAlert = {
  id: string;
  body: string | null;
  created_at: string;
  mine: boolean;
  urgent: boolean;
};

type ThreadItem =
  | { type: "message"; id: string; body: string; created_at: string; mine: boolean }
  | { type: "alert"; id: string; body: string | null; created_at: string; mine: boolean; urgent: boolean };

function buildTimeline(messages: ThreadMessage[], alerts: ThreadAlert[]): ThreadItem[] {
  const items: ThreadItem[] = [
    ...messages.map((m) => ({
      type: "message" as const,
      id: m.id,
      body: m.body,
      created_at: m.created_at,
      mine: m.mine,
    })),
    ...alerts.map((a) => ({
      type: "alert" as const,
      id: a.id,
      body: a.body,
      created_at: a.created_at,
      mine: a.mine,
      urgent: a.urgent,
    })),
  ];
  items.sort((a, b) => {
    const byTime = a.created_at.localeCompare(b.created_at);
    if (byTime !== 0) return byTime;
    if (a.type !== b.type) return a.type === "alert" ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  return items;
}

function peerFromTitle(title: string) {
  const m = title.match(/^(.+?) messaged you$/i);
  return m?.[1]?.trim() || title.replace(/^(Message|Urgent) from /i, "").trim() || "Teammate";
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** How much of the toast stays visible when docked off the left edge. */
const PEEK_VISIBLE = 0.15;

function dockedTranslate(el: HTMLElement) {
  const width = el.offsetWidth || 320;
  const peek = width * PEEK_VISIBLE;
  const prev = el.style.transform;
  el.style.transform = "none";
  const naturalLeft = el.getBoundingClientRect().left;
  el.style.transform = prev;
  // Leftmost `peek` pixels stay visible at the viewport edge.
  const targetLeft = peek - width;
  return targetLeft - naturalLeft;
}

function useQuickReplyToastDock(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [docked, setDocked] = useState(false);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const dragging = useRef(false);
  const dragMoved = useRef(false);
  const dragStart = useRef({ x: 0, offset: 0, width: 320, hidden: -272 });

  const toastEl = () => containerRef.current?.closest("[data-sonner-toast]") as HTMLElement | null;

  useEffect(() => {
    const el = toastEl();
    if (!el) return;

    const apply = () => {
      if (dragging.current && dragOffset !== null) {
        el.style.transform = `translateX(${dragOffset}px)`;
        el.style.transition = "none";
        return;
      }
      const hidden = dockedTranslate(el);
      const x = docked ? hidden : 0;
      el.style.transform = x === 0 ? "" : `translateX(${x}px)`;
      el.style.transition = "transform 0.38s cubic-bezier(0.4, 0, 0.2, 1)";
      el.dataset.aetheriaDocked = docked ? "true" : "false";
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      el.style.transform = "";
      el.style.transition = "";
      delete el.dataset.aetheriaDocked;
    };
  }, [containerRef, docked, dragOffset]);

  const beginDrag = (clientX: number) => {
    const el = toastEl();
    if (!el) return;
    dragMoved.current = false;
    const hidden = dockedTranslate(el);
    const current = dragOffset ?? (docked ? hidden : 0);
    dragStart.current = {
      x: clientX,
      offset: current,
      width: el.offsetWidth || 320,
      hidden,
    };
    dragging.current = true;
    setDragOffset(current);
  };

  const moveDrag = (clientX: number) => {
    if (!dragging.current) return;
    const { x, offset, hidden } = dragStart.current;
    if (Math.abs(clientX - x) > 4) dragMoved.current = true;
    const next = Math.max(hidden, Math.min(0, offset + clientX - x));
    setDragOffset(next);
  };

  const endDrag = (toggleOnTap: boolean) => {
    if (!dragging.current) return;
    dragging.current = false;
    const { hidden } = dragStart.current;
    const final = dragOffset ?? (docked ? hidden : 0);
    const midpoint = hidden / 2;
    if (toggleOnTap && !dragMoved.current) {
      setDocked((prev) => !prev);
    } else {
      setDocked(final < midpoint);
    }
    setDragOffset(null);
  };

  const onSlidePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    beginDrag(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onSlidePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return;
    e.stopPropagation();
    moveDrag(e.clientX);
  };

  const onSlidePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging.current) return;
    e.stopPropagation();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    endDrag(true);
  };

  return { docked, onSlidePointerDown, onSlidePointerMove, onSlidePointerUp };
}

/** Expandable toast: reply in place without leaving the current page. */
function ChatQuickReplyToast({
  toastId,
  senderId,
  notificationId,
  title,
  description,
  onOpen,
}: ChatQuickReplyToastProps) {
  const queryClient = useQueryClient();
  const { data: identity } = useIdentity();
  const sessionReady = useAuthSessionReady();
  const fetchChat = useServerFn(getStaffChat);
  const sendMessage = useServerFn(sendStaffChatMessage);
  const markRead = useServerFn(markStaffChatRead);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [sentFlash, setSentFlash] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { docked, onSlidePointerDown, onSlidePointerMove, onSlidePointerUp } =
    useQuickReplyToastDock(rootRef);
  const peerName = peerFromTitle(title);
  const selfId = identity?.userId;
  const chatEnabled = Boolean(sessionReady && selfId && senderId && selfId !== senderId);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["staff-chat", senderId],
    queryFn: () => fetchChat({ data: { peerUserId: senderId } }),
    enabled: chatEnabled,
    refetchInterval: expanded && DEMO_MODE ? 4_000 : false,
  });

  const thread = useMemo(() => {
    const messages = (data?.messages as ThreadMessage[] | undefined) ?? [];
    const alerts = (data?.alerts as ThreadAlert[] | undefined) ?? [];
    return buildTimeline(messages, alerts).slice(-8);
  }, [data?.alerts, data?.messages]);

  const latestIncoming = useMemo(() => {
    for (let i = thread.length - 1; i >= 0; i -= 1) {
      const item = thread[i];
      if (!item.mine) {
        return item.type === "message" ? item.body : item.body ?? "";
      }
    }
    return "";
  }, [thread]);

  const send = useMutation({
    mutationFn: (body: string) => sendMessage({ data: { peerUserId: senderId, body } }),
    onSuccess: async () => {
      setDraft("");
      setSentFlash(true);
      window.setTimeout(() => setSentFlash(false), 1800);
      await markRead({ data: { peerUserId: senderId } });
      void queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["staff-chat", senderId] });
      window.setTimeout(() => inputRef.current?.focus(), 0);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    // Stay until the user presses close — pin immediately on mount.
    pinAetheriaToast(toastId);
  }, [toastId]);

  useEffect(() => {
    if (!expanded) return;
    pinAetheriaToast(toastId);
    const t = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(t);
  }, [expanded, toastId]);

  useEffect(() => {
    if (!expanded || !threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [expanded, thread.length, sentFlash]);

  useEffect(() => {
    if (!expanded || !chatEnabled || !thread.length) return;
    const hasIncoming = thread.some((item) => !item.mine);
    if (!hasIncoming) return;
    void markRead({ data: { peerUserId: senderId } }).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
    });
  }, [chatEnabled, expanded, markRead, queryClient, senderId, thread]);

  function closeToast() {
    unpinAetheriaToast(toastId);
    toast.dismiss(toastId);
  }

  function openExpanded() {
    pinAetheriaToast(toastId);
    setExpanded(true);
    if (chatEnabled) void refetch();
  }

  function submit() {
    const body = draft.trim();
    if (!body || send.isPending) return;
    send.mutate(body);
  }

  function minimize() {
    setExpanded(false);
  }

  function handleHeaderClick(e: React.MouseEvent<HTMLElement>) {
    e.stopPropagation();
    if (expanded) minimize();
  }

  const preview = latestIncoming || description?.replace(/^["“]|["”]$/g, "") || "";

  return (
    <div
      ref={rootRef}
      data-aetheria-quick-reply=""
      data-expanded={expanded ? "true" : "false"}
      data-docked={docked ? "true" : "false"}
      className="relative w-full text-left"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        data-aetheria-quick-reply-slide=""
        aria-label={docked ? "Slide message in" : "Slide message aside"}
        title={docked ? "Slide in" : "Slide aside"}
        className={cn(
          "absolute -left-0.5 top-0 z-20 flex h-full w-9 cursor-grab touch-none flex-col items-center justify-center gap-0.5",
          "rounded-l-[22px] border-r border-edge/60 bg-glass-2/95 text-ink-3 shadow-inset-hi",
          "transition-colors active:cursor-grabbing hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground",
          docked && "bg-accent-wash/90 text-accent-ink",
        )}
        onPointerDown={onSlidePointerDown}
        onPointerMove={onSlidePointerMove}
        onPointerUp={onSlidePointerUp}
        onPointerCancel={onSlidePointerUp}
      >
        <ChevronRight
          className={cn("h-4 w-4 shrink-0 transition-transform duration-300", !docked && "rotate-180")}
          strokeWidth={2.25}
        />
        {docked ? (
          <span className="max-w-[2rem] truncate text-[9px] font-semibold leading-tight text-accent-ink">
            {peerName.split(/\s+/)[0]}
          </span>
        ) : null}
      </button>

      <div className={cn("relative", docked ? "pointer-events-none opacity-0" : "pl-7")}>
      <div className="absolute right-0 top-0 z-10 flex h-7 items-center gap-1.5">
        {expanded ? (
          <button
            type="button"
            className="shrink-0 px-0.5 text-2xs font-semibold leading-none text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            Open Chat
          </button>
        ) : null}
        {expanded ? (
          <button
            type="button"
            data-aetheria-quick-reply-minimize=""
            aria-label="Minimize"
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full",
              "border border-edge bg-glass-2 text-ink-3 shadow-inset-hi transition-colors",
              "hover:border-edge-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground",
            )}
            onClick={(e) => {
              e.stopPropagation();
              minimize();
            }}
          >
            <Minus className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        ) : null}
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

      <header
        className={cn(
          "flex min-h-7 items-center",
          expanded ? "pr-[7.75rem]" : "pr-8",
          expanded && "cursor-pointer rounded-xl transition-colors hover:bg-glass-2/80",
        )}
        onClick={handleHeaderClick}
        onKeyDown={(e) => {
          if (expanded && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            minimize();
          }
        }}
        role={expanded ? "button" : undefined}
        tabIndex={expanded ? 0 : undefined}
        aria-label={expanded ? `Minimize chat with ${peerName}` : undefined}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <p className="min-w-0 truncate text-sm font-semibold tracking-[-0.012em] text-foreground">{peerName}</p>
          {!expanded ? (
            <>
              <span className="shrink-0 text-[10px] leading-none text-muted-foreground/45" aria-hidden>
                ·
              </span>
              <p className="shrink-0 text-2xs text-muted-foreground">New message</p>
            </>
          ) : null}
        </div>
      </header>

      {!expanded ? (
        <>
          {preview ? (
            <div className="mt-2 rounded-xl border border-edge bg-glass-2/90 px-3 py-2">
              <p className="line-clamp-3 text-[13px] leading-snug text-foreground">{preview}</p>
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              className="text-2xs font-semibold text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
            >
              Open Chat
            </button>
            <Button
              type="button"
              variant="selected"
              size="sm"
              className="gap-1.5"
              onClick={(e) => {
                e.stopPropagation();
                openExpanded();
              }}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Quick reply
            </Button>
          </div>
        </>
      ) : (
        <div className="mt-2.5 flex flex-col gap-2">
          <div
            ref={threadRef}
            className="staff-chat-thread quick-reply-thread -mx-3.5 max-h-[11.5rem] min-h-[4.5rem] space-y-2 overflow-y-auto overscroll-contain px-3.5 py-2"
          >
            {isLoading && (
              <p className="px-1 py-3 text-center text-xs text-muted-foreground">Loading messages…</p>
            )}
            {!isLoading && thread.length === 0 && (
              <p className="px-1 py-3 text-center text-xs text-muted-foreground">No messages yet — say hello.</p>
            )}
            {thread.map((item, i) => {
              const prev = thread[i - 1];
              const showTime = !prev || prev.mine !== item.mine || prev.created_at !== item.created_at;
              return (
                <div key={`${item.type}-${item.id}`} className={cn("flex flex-col", item.mine ? "items-end" : "items-start")}>
                  {showTime && (
                    <span className="mb-1 px-1 text-[10px] font-medium tabular-nums text-muted-foreground">
                      {item.mine ? "You" : peerName.split(/\s+/)[0]} · {timeLabel(item.created_at)}
                    </span>
                  )}
                  {item.type === "alert" ? (
                    <div
                      className={cn(
                        "staff-chat-alert max-w-[92%] text-[13px] leading-snug",
                        item.mine ? "staff-chat-alert--out" : "staff-chat-alert--in",
                        item.urgent && "staff-chat-alert--urgent",
                      )}
                    >
                      <p className={cn("staff-chat-alert__label text-[10px]", item.urgent ? "text-destructive-ink" : "text-sky-ink")}>
                        {item.urgent ? "Urgent" : "Alert"}
                      </p>
                      {item.body ? <p className="font-medium">{item.body}</p> : null}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "staff-chat-bubble max-w-[92%] text-[13px] font-medium leading-snug",
                        item.mine ? "staff-chat-bubble--out" : "staff-chat-bubble--in",
                      )}
                    >
                      {item.body}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div
            data-aetheria-quick-reply-composer=""
            className="rounded-2xl border border-edge bg-glass-2/90 p-1.5 shadow-inset-hi"
          >
            <div className="flex items-center gap-2">
              <Textarea
                id={`quick-reply-${notificationId}`}
                ref={inputRef}
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`Reply to ${peerName.split(/\s+/)[0]}…`}
                aria-label={`Reply to ${peerName}`}
                className={cn(
                  "h-9 min-h-9 flex-1 resize-none rounded-xl border-transparent bg-card/90 px-3 py-2",
                  "text-[13.5px] leading-5 text-foreground shadow-none",
                  "placeholder:text-ink-3 focus-visible:border-accent-deep focus-visible:ring-2 focus-visible:ring-ring/35",
                )}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                className={cn(
                  "h-9 w-9 shrink-0 rounded-full transition-colors",
                  sentFlash && "bg-success text-white hover:bg-success",
                )}
                disabled={send.isPending || (!draft.trim() && !sentFlash)}
                aria-label={sentFlash ? "Sent" : "Send reply"}
                onClick={(e) => {
                  e.stopPropagation();
                  submit();
                }}
              >
                {sentFlash ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      )}
      <span className="sr-only">{notificationId}</span>
      </div>
    </div>
  );
}

/** Show a team/chat ping as an expandable quick-reply toast. */
export function showChatQuickReplyToast(opts: {
  notificationId: string;
  senderId: string;
  title: string;
  body?: string | null;
  kind?: string | null;
  urgent?: boolean | null;
  onOpen: () => void;
}) {
  const copy = formatTeamAlertToast({
    title: opts.title,
    body: opts.body,
    kind: opts.kind,
    urgent: opts.urgent,
  });

  toast.custom(
    (toastId) => (
      <ChatQuickReplyToast
        toastId={toastId}
        senderId={opts.senderId}
        notificationId={opts.notificationId}
        title={copy.title}
        description={copy.description}
        onOpen={opts.onOpen}
      />
    ),
    {
      id: `team-alert-${opts.notificationId}`,
      duration: Infinity,
      dismissible: false,
      closeButton: false,
      className: cn(
        "aetheria-toast aetheria-quick-reply-toast aetheria-toast-pinned",
        "border border-edge bg-[rgba(255,255,255,0.78)] text-foreground shadow-popover",
        "backdrop-blur-sm rounded-[22px]",
        "!font-sans",
      ),
      onDismiss: () => {
        unpinAetheriaToast(`team-alert-${opts.notificationId}`);
      },
    },
  );
}
