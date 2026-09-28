import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, CheckCheck, CornerUpLeft, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";
import {
  dismissStaffInboxItem,
  getStaffChat,
  markStaffChatRead,
  markStaffNotificationRead,
  replyToStaffAlert,
} from "@/lib/clinic.functions";
import { can } from "@/lib/permissions";
import { parseStaffAlertTitle } from "@/lib/staff-alert-title";
import { useIdentity } from "@/lib/use-identity";
import { usePanelWidth } from "@/hooks/use-panel-width";
import { MessageAttachments, type Attachment } from "@/components/message-attachments";
import { MessageComposer } from "@/components/message-composer";
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
  dismissed?: boolean;
  reply_to_id?: string | null;
  created_at: string;
  mine: boolean;
};

function alertQuote(alert: ChatAlert) {
  const text = alert.body?.trim() || parseStaffAlertTitle(alert.title).topic || alert.title;
  return text.length > 120 ? `${text.slice(0, 117)}…` : text;
}

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

/** Live 1:1 staff thread inside the chat bubble. */
export function StaffChatPanel({
  peerUserId,
  peerName,
  autoFocus = false,
  focusAlert,
}: {
  peerUserId: string;
  peerName?: string;
  autoFocus?: boolean;
  /** Scroll to and highlight this alert; `seq` changes when the same alert is asked for again. */
  focusAlert?: { alertId: string; seq: number } | undefined;
}) {
  const { data: identity } = useIdentity();
  const queryClient = useQueryClient();
  const fetchChat = useServerFn(getStaffChat);
  const markRead = useServerFn(markStaffChatRead);
  const markAlertRead = useServerFn(markStaffNotificationRead);
  const dismissAlert = useServerFn(dismissStaffInboxItem);
  const replyToAlert = useServerFn(replyToStaffAlert);
  const [fontSize] = usePanelWidth("staff-chat-font", 13);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const focusedSeq = useRef<number | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const selfId = identity?.userId;
  const canDismiss = can(identity, "notifications.delete");

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
      void queryClient.invalidateQueries({ queryKey: ["staff-threads"] });
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

  const alertsById = useMemo(
    () => new Map(((data?.alerts as ChatAlert[] | undefined) ?? []).map((a) => [a.id, a])),
    [data?.alerts],
  );

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
    if (focusAlert && focusedSeq.current !== focusAlert.seq) {
      const target = thread.querySelector<HTMLElement>(`[data-alert-id="${focusAlert.alertId}"]`);
      if (target) {
        focusedSeq.current = focusAlert.seq;
        const top = target.offsetTop - thread.offsetTop - thread.clientHeight / 2 + target.offsetHeight / 2;
        thread.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        setHighlightId(focusAlert.alertId);
        return;
      }
      if (isLoading) return;
    }
    thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
  }, [renderItems.length, focusAlert, isLoading]);

  useEffect(() => {
    if (!highlightId) return;
    const timer = window.setTimeout(() => setHighlightId(null), 2400);
    return () => window.clearTimeout(timer);
  }, [highlightId]);

  function invalidateAlerts() {
    void queryClient.invalidateQueries({ queryKey: ["staff-chat", peerUserId] });
    void queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["incoming-team-alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["sent-staff-alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["practitioner-day"] });
    void queryClient.invalidateQueries({ queryKey: ["staff-threads"] });
  }

  const acknowledge = useMutation({
    mutationFn: (id: string) => markAlertRead({ data: { id } }),
    onSuccess: () => {
      invalidateAlerts();
      toast.success("Alert acknowledged");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => dismissAlert({ data: { id } }),
    onSuccess: (_res, id) => {
      if (replyToId === id) setReplyToId(null);
      invalidateAlerts();
      toast.success("Alert dismissed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!enabled) return null;

  const title = peerName || data?.peer?.full_name || "Teammate";
  const nameParts = title.trim().split(/\s+/);
  const firstName =
    (/^(dr|mr|mrs|ms|miss|mx|prof)\.?$/i.test(nameParts[0] ?? "") ? nameParts[1] : nameParts[0]) || title;

  function invalidateChat() {
    void queryClient.invalidateQueries({ queryKey: ["staff-chat", peerUserId] });
    void queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["incoming-team-alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["staff-threads"] });
  }

  function onSent() {
    if (replyToId) {
      setReplyToId(null);
      invalidateAlerts();
      toast.success(`Reply sent to ${title}`);
    }
    invalidateChat();
  }

  function startReply(id: string) {
    setReplyToId(id);
    rootRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
  }

  const replyingTo = replyToId ? alertsById.get(replyToId) : undefined;

  const thread = (
    <div
      ref={threadRef}
      className="staff-chat-thread min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3"
      style={{ ["--staff-chat-fs" as string]: `${fontSize}px` }}
    >
      {isLoading && <p className="px-2 text-sm text-muted-foreground">Loading conversation…</p>}
      {!isLoading && timeline.length === 0 && (
        <div className="flex h-full min-h-40 items-center justify-center px-4">
          <p className="staff-chat-day max-w-[16rem] text-center">
            No messages yet. Say hello, or send an alert from the chat window.
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
          const actionable = !a.mine && a.recipient_id === selfId && !a.dismissed;
          const busy =
            (acknowledge.isPending && acknowledge.variables === a.id) ||
            (dismiss.isPending && dismiss.variables === a.id);
          return (
            <div
              key={item.key}
              className={cn("staff-chat-item", item.stacked ? "staff-chat-item--stack" : "staff-chat-item--break")}
            >
              <div
                data-alert-id={a.id}
                data-qc="staff-chat-alert"
                className={cn(
                  "staff-chat-alert transition-shadow duration-500",
                  a.mine ? "staff-chat-alert--out" : "staff-chat-alert--in",
                  a.urgent && "staff-chat-alert--urgent",
                  highlightId === a.id && "shadow-[0_0_0_3px_var(--accent-line)]",
                )}
              >
                <div className="flex items-start gap-2">
                  <p
                    className={cn(
                      "staff-chat-alert__label min-w-0 flex-1",
                      a.urgent ? "text-destructive-ink" : "text-sky-ink",
                    )}
                  >
                    {a.reply_to_id ? "Reply" : a.urgent ? "Urgent" : "Alert"}
                    <span className="staff-chat-alert__label-name">{a.mine ? " · You" : ` · ${firstName}`}</span>
                  </p>
                  {actionable && canDismiss ? (
                    <button
                      type="button"
                      aria-label="Dismiss alert"
                      title="Dismiss alert"
                      disabled={busy}
                      onClick={() => dismiss.mutate(a.id)}
                      className="-mr-[0.2em] -mt-[0.1em] shrink-0 cursor-pointer rounded-full p-[0.2em] text-ink-3 transition-colors hover:bg-[rgba(47,63,102,0.1)] hover:text-foreground disabled:opacity-40"
                    >
                      <X className="h-[1em] w-[1em]" aria-hidden />
                    </button>
                  ) : null}
                </div>
                {a.reply_to_id ? (
                  <p
                    data-qc="staff-chat-alert-quote"
                    className="mb-[0.35em] truncate rounded-[0.6em] bg-[rgba(47,63,102,0.06)] px-[0.55em] py-[0.2em] text-[0.85em] text-muted-foreground"
                  >
                    {alertsById.get(a.reply_to_id) ? alertQuote(alertsById.get(a.reply_to_id)!) : "Earlier alert"}
                  </p>
                ) : null}
                {a.body ? (
                  <p className="whitespace-pre-wrap break-words text-foreground/90">{a.body}</p>
                ) : null}
                {actionable ? (
                  <div className="mt-[0.55em] flex flex-wrap items-center gap-[0.4em]">
                    {a.read_at ? null : (
                      <button
                        type="button"
                        data-qc="staff-chat-alert-ack"
                        disabled={busy}
                        onClick={() => acknowledge.mutate(a.id)}
                        className="inline-flex cursor-pointer items-center gap-[0.3em] rounded-full border border-accent-line bg-accent-soft px-[0.7em] py-[0.25em] text-[0.85em] font-semibold text-accent-ink shadow-inset-hi transition-[filter] hover:brightness-[0.97] disabled:opacity-50"
                      >
                        <Check className="h-[1em] w-[1em]" aria-hidden />
                        Acknowledge
                      </button>
                    )}
                    <button
                      type="button"
                      data-qc="staff-chat-alert-reply"
                      disabled={busy}
                      onClick={() => startReply(a.id)}
                      className={cn(
                        "inline-flex cursor-pointer items-center gap-[0.3em] rounded-full border border-edge px-[0.7em] py-[0.25em] text-[0.85em] font-medium text-foreground shadow-inset-hi transition-colors disabled:opacity-50",
                        replyToId === a.id ? "bg-accent-soft" : "bg-glass-2 hover:bg-[rgba(47,63,102,0.08)]",
                      )}
                    >
                      <CornerUpLeft className="h-[1em] w-[1em]" aria-hidden />
                      {replyToId === a.id ? "Replying…" : "Reply"}
                    </button>
                  </div>
                ) : null}
                <div className="staff-chat-meta">
                  <span>{timeLabel(a.created_at)}</span>
                  {a.mine ? (
                    a.read_at ? (
                      <CheckCheck aria-label="Seen" className="text-sky-ink" />
                    ) : (
                      <Check aria-label="Waiting" className="text-ink-3/70" />
                    )
                  ) : a.recipient_id === selfId && a.read_at ? (
                    <span className="inline-flex items-center gap-[0.2em]">
                      · {a.dismissed ? "Dismissed" : "Acknowledged"}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const composer = (
    <MessageComposer
      peerUserId={peerUserId}
      templates
      canDeleteTemplates={Boolean(identity?.isManager)}
      patientFirstName={firstName}
      placeholder={`Message ${firstName}…`}
      variant="chat"
      autoFocus={autoFocus}
      onSent={onSent}
      replyTo={
        replyingTo
          ? {
              id: replyingTo.id,
              label: `Replying to ${title}'s ${replyingTo.urgent ? "urgent alert" : "alert"}`,
              quote: alertQuote(replyingTo),
              onCancel: () => setReplyToId(null),
              send: (body: string) => replyToAlert({ data: { alertId: replyingTo.id, body } }),
            }
          : undefined
      }
    />
  );

  return (
    <div ref={rootRef} data-qc="staff-chat-embedded" className="flex min-h-0 flex-1 flex-col">
      {thread}
      {composer}
    </div>
  );
}
