import { useEffect, useMemo, useRef, type MouseEvent, type TouchEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { getStaffChat, markStaffChatRead } from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { useStaffPresence } from "@/lib/use-staff-presence";
import { usePanelWidth } from "@/hooks/use-panel-width";
import { MessageAttachments, type Attachment } from "@/components/message-attachments";
import { MessageComposer } from "@/components/message-composer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  mine: boolean;
  readByPeer: boolean;
  attachments?: Attachment[] | null;
};

type ChatAlert = {
  id: string;
  sender_id: string;
  recipient_id: string;
  title: string;
  body: string | null;
  urgent: boolean;
  kind: string;
  read_at: string | null;
  created_at: string;
  mine: boolean;
};

type TimelineItem =
  | { type: "message"; at: string; message: ChatMessage }
  | { type: "alert"; at: string; alert: ChatAlert };

type RenderItem =
  | { type: "day"; key: string; label: string }
  | { type: "message"; key: string; message: ChatMessage; stacked: boolean }
  | { type: "alert"; key: string; alert: ChatAlert; stacked: boolean };

function dayKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(iso) === dayKey(today.toISOString())) return "Today";
  if (dayKey(iso) === dayKey(yesterday.toISOString())) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function isMine(item: TimelineItem) {
  return item.type === "message" ? item.message.mine : item.alert.mine;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Live 1:1 staff thread — soft glass bubbles for chat + alerts. */
export function StaffChatPanel({
  peerUserId,
  peerName,
  autoFocus = false,
  onResizeStart,
}: {
  peerUserId: string;
  peerName?: string;
  autoFocus?: boolean;
  onResizeStart?: (e: MouseEvent | TouchEvent) => void;
}) {
  const { data: identity } = useIdentity();
  const queryClient = useQueryClient();
  const fetchChat = useServerFn(getStaffChat);
  const markRead = useServerFn(markStaffChatRead);
  const [fontSize, setFontSize] = usePanelWidth("staff-chat-font", 13);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const selfId = identity?.userId;
  const onlineIds = useStaffPresence(Boolean(selfId), selfId);
  const peerOnline = onlineIds.has(peerUserId);

  const enabled = Boolean(selfId && peerUserId && selfId !== peerUserId);

  const { data, isLoading } = useQuery({
    queryKey: ["staff-chat", peerUserId],
    queryFn: () => fetchChat({ data: { peerUserId } }),
    enabled,
    refetchInterval: DEMO_MODE ? 4_000 : false,
  });

  useEffect(() => {
    if (!enabled || DEMO_MODE || !data?.conversationId) return;
    const channel = supabase
      .channel(`staff-chat-${data.conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_chat_messages",
          filter: `conversation_id=eq.${data.conversationId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["staff-chat", peerUserId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_conversation_reads",
          filter: `conversation_id=eq.${data.conversationId}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["staff-chat", peerUserId] });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_notifications",
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as {
            sender_id?: string | null;
            recipient_id?: string;
            kind?: string;
          } | null;
          if (!row) return;
          if (row.kind !== "urgent" && row.kind !== "staff_message") return;
          const involvesPeer =
            (row.sender_id === peerUserId || row.recipient_id === peerUserId) &&
            (row.sender_id === selfId || row.recipient_id === selfId);
          if (!involvesPeer) return;
          void queryClient.invalidateQueries({ queryKey: ["staff-chat", peerUserId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [data?.conversationId, enabled, peerUserId, queryClient, selfId]);

  useEffect(() => {
    if (!enabled || !data?.messages?.length) return;
    const hasIncoming = (data.messages as ChatMessage[]).some((m) => !m.mine);
    if (!hasIncoming) return;
    void markRead({ data: { peerUserId } }).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["incoming-team-alerts"] });
    });
  }, [data?.messages, enabled, markRead, peerUserId, queryClient]);

  const timeline = useMemo(() => {
    const messages = (data?.messages as ChatMessage[] | undefined) ?? [];
    const alerts = (data?.alerts as ChatAlert[] | undefined) ?? [];
    const items: TimelineItem[] = [
      ...messages.map((message) => ({ type: "message" as const, at: message.created_at, message })),
      ...alerts.map((alert) => ({ type: "alert" as const, at: alert.created_at, alert })),
    ];
    items.sort((a, b) => {
      const byTime = a.at.localeCompare(b.at);
      if (byTime !== 0) return byTime;
      if (a.type !== b.type) return a.type === "alert" ? -1 : 1;
      return a.type === "message"
        ? a.message.id.localeCompare((b as Extract<TimelineItem, { type: "message" }>).message.id)
        : a.alert.id.localeCompare((b as Extract<TimelineItem, { type: "alert" }>).alert.id);
    });
    return items;
  }, [data?.alerts, data?.messages]);

  const renderItems = useMemo(() => {
    const out: RenderItem[] = [];
    let lastDay = "";
    timeline.forEach((item, index) => {
      const key = dayKey(item.at);
      if (key !== lastDay) {
        out.push({ type: "day", key: `day-${key}`, label: dayLabel(item.at) });
        lastDay = key;
      }
      const prev = timeline[index - 1];
      const stacked = Boolean(prev && dayKey(prev.at) === key && isMine(prev) === isMine(item));
      if (item.type === "message") {
        out.push({ type: "message", key: `m-${item.message.id}`, message: item.message, stacked });
      } else {
        out.push({ type: "alert", key: `a-${item.alert.id}`, alert: item.alert, stacked });
      }
    });
    return out;
  }, [timeline]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    // Scroll the thread itself — scrollIntoView would also scroll the page shell.
    thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
  }, [renderItems.length]);

  if (!enabled) return null;

  const title = peerName || data?.peer?.full_name || "Teammate";
  const firstName = title.trim().split(/\s+/)[0] || title;
  const avatar = initials(title) || "?";

  function invalidateChat() {
    void queryClient.invalidateQueries({ queryKey: ["staff-chat", peerUserId] });
    void queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["incoming-team-alerts"] });
  }

  return (
    <Card
      id="staff-chat"
      className="relative flex h-[calc(100dvh-6rem-1.25rem)] max-h-[calc(100dvh-6rem-1.25rem)] min-h-0 flex-col self-start overflow-hidden rounded-2xl p-0 sm:h-[calc(100dvh-6rem-26px)] sm:max-h-[calc(100dvh-6rem-26px)] md:sticky md:top-24"
    >
      {onResizeStart ? (
        <div
          className="group absolute -left-3 top-0 bottom-0 z-10 hidden w-6 cursor-col-resize items-center justify-center md:flex"
          onMouseDown={onResizeStart}
          onTouchStart={onResizeStart}
          aria-label="Resize messages panel"
          role="separator"
        >
          <div className="h-10 w-1 rounded-full bg-foreground/20 transition-colors group-hover:bg-foreground/40" />
        </div>
      ) : null}

      <header className="flex shrink-0 items-center gap-3 border-b border-edge px-4 py-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent-line bg-accent-wash text-2xs font-semibold tracking-wide text-accent-ink",
            peerOnline && "ring-2 ring-[#4a9d75] ring-offset-2 ring-offset-[var(--card)]",
          )}
          title={peerOnline ? "Online" : undefined}
          aria-label={peerOnline ? `${title}, online` : title}
        >
          {avatar}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="section-title truncate">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {peerOnline ? "Online · Messages and alerts" : "Messages and alerts"}
          </p>
        </div>
        <div className="flex shrink-0 items-center rounded-lg border border-edge bg-glass-2 p-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-5 w-5 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
            aria-label="Decrease message text size"
            disabled={fontSize <= 11}
            onClick={() => setFontSize(Math.max(11, fontSize - 1))}
          >
            <span className="text-2xs font-medium leading-none">A−</span>
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-5 w-5 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
            aria-label="Increase message text size"
            disabled={fontSize >= 18}
            onClick={() => setFontSize(Math.min(18, fontSize + 1))}
          >
            <span className="text-2xs font-medium leading-none">A+</span>
          </Button>
        </div>
      </header>

      <div
        ref={threadRef}
        className="staff-chat-thread min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
        style={{ ["--staff-chat-fs" as string]: `${fontSize}px` }}
      >
        {isLoading && <p className="px-2 text-sm text-muted-foreground">Loading conversation…</p>}
        {!isLoading && timeline.length === 0 && (
          <div className="flex h-full min-h-40 items-center justify-center px-4">
            <p className="staff-chat-day max-w-[16rem] text-center">
              No messages yet. Say hello, or send an alert from their profile.
            </p>
          </div>
        )}

        <div className="flex flex-col">
          {renderItems.map((item) => {
            if (item.type === "day") {
              return (
                <div key={item.key} className="my-[0.85em] flex justify-center" style={{ fontSize: `${fontSize}px` }}>
                  <span className="staff-chat-day font-medium">{item.label}</span>
                </div>
              );
            }

            if (item.type === "message") {
              const m = item.message;
              return (
                <div
                  key={item.key}
                  className={cn("staff-chat-item", item.stacked ? "staff-chat-item--stack" : "staff-chat-item--break")}
                >
                  <div className={cn("staff-chat-bubble", m.mine ? "staff-chat-bubble--out" : "staff-chat-bubble--in")}>
                    {m.body ? <p className="whitespace-pre-wrap break-words pr-[0.15em]">{m.body}</p> : null}
                    <MessageAttachments attachments={(m.attachments ?? []) as Attachment[]} />
                    <div className="staff-chat-meta">
                      <span>{timeLabel(m.created_at)}</span>
                      {m.mine ? (
                        m.readByPeer ? (
                          <CheckCheck aria-label="Read" className="text-sky-ink" />
                        ) : (
                          <Check aria-label="Sent" className="text-ink-3/70" />
                        )
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            }

            const a = item.alert;
            return (
              <div
                key={item.key}
                className={cn("staff-chat-item", item.stacked ? "staff-chat-item--stack" : "staff-chat-item--break")}
              >
                <div
                  className={cn(
                    "staff-chat-alert",
                    a.mine ? "staff-chat-alert--out" : "staff-chat-alert--in",
                    a.urgent && "staff-chat-alert--urgent",
                  )}
                >
                  <p className={cn("staff-chat-alert__label", a.urgent ? "text-destructive-ink" : "text-sky-ink")}>
                    {a.urgent ? "Urgent" : "Alert"}
                    <span className="staff-chat-alert__label-name">{a.mine ? " · You" : ` · ${firstName}`}</span>
                  </p>
                  {a.body ? (
                    <p className="whitespace-pre-wrap break-words text-foreground/90">{a.body}</p>
                  ) : null}
                  <div className="staff-chat-meta">
                    <span>{timeLabel(a.created_at)}</span>
                    {a.mine ? (
                      a.read_at ? (
                        <CheckCheck aria-label="Seen" className="text-sky-ink" />
                      ) : (
                        <Check aria-label="Waiting" className="text-ink-3/70" />
                      )
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <MessageComposer
        peerUserId={peerUserId}
        templates
        canDeleteTemplates={Boolean(identity?.isManager)}
        patientFirstName={firstName}
        placeholder={`Message ${firstName}…`}
        variant="chat"
        autoFocus={autoFocus}
        onSent={invalidateChat}
      />
    </Card>
  );
}
