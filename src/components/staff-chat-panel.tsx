import { useEffect, useRef, useState, type MouseEvent, type TouchEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCheck, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { getStaffChat, markStaffChatRead, sendStaffChatMessage } from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { usePanelWidth } from "@/hooks/use-panel-width";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  mine: boolean;
  readByPeer: boolean;
};

/** Live 1:1 staff chat — same shell and bubbles as clinic ↔ patient messages. */
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
  const sendMessage = useServerFn(sendStaffChatMessage);
  const markRead = useServerFn(markStaffChatRead);
  const [draft, setDraft] = useState("");
  const [chatFontSize, setChatFontSize] = usePanelWidth("staff-chat-font", 12);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const selfId = identity?.userId;

  const enabled = Boolean(selfId && peerUserId && selfId !== peerUserId);

  const { data, isLoading } = useQuery({
    queryKey: ["staff-chat", peerUserId],
    queryFn: () => fetchChat({ data: { peerUserId } }),
    enabled,
    refetchInterval: DEMO_MODE ? 4_000 : false,
  });

  const send = useMutation({
    mutationFn: (body: string) => sendMessage({ data: { peerUserId, body } }),
    onSuccess: () => {
      setDraft("");
      void queryClient.invalidateQueries({ queryKey: ["staff-chat", peerUserId] });
      void queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
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
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [data?.conversationId, enabled, peerUserId, queryClient]);

  useEffect(() => {
    if (!enabled || !data?.messages?.length) return;
    const hasIncoming = (data.messages as ChatMessage[]).some((m) => !m.mine);
    if (!hasIncoming) return;
    void markRead({ data: { peerUserId } }).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
    });
  }, [data?.messages, enabled, markRead, peerUserId, queryClient]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages?.length]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus, peerUserId]);

  if (!enabled) return null;

  const title = peerName || data?.peer?.full_name || "Teammate";
  const messages = (data?.messages as ChatMessage[] | undefined) ?? [];

  function submit() {
    const body = draft.trim();
    if (!body || send.isPending) return;
    send.mutate(body);
  }

  return (
    <Card id="staff-chat" className="relative flex min-h-[420px] flex-col rounded-2xl p-0">
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
      <div className="flex items-start justify-between gap-2 border-b border-edge px-5 py-4">
        <div className="min-w-0">
          <h2 className="section-title">Messages</h2>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Secure clinic thread with {title}
          </p>
        </div>
        <div className="flex shrink-0 items-center rounded-lg border border-edge bg-glass-2 p-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-5 w-5 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
            aria-label="Decrease message text size"
            disabled={chatFontSize <= 10}
            onClick={() => setChatFontSize(Math.max(10, chatFontSize - 1))}
          >
            <span className="text-2xs font-medium leading-none">A−</span>
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-5 w-5 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
            aria-label="Increase message text size"
            disabled={chatFontSize >= 18}
            onClick={() => setChatFontSize(Math.min(18, chatFontSize + 1))}
          >
            <span className="text-2xs font-medium leading-none">A+</span>
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading conversation…</p>}
        {!isLoading && messages.length === 0 && (
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{ fontSize: `${chatFontSize}px`, lineHeight: 1.45 }}
            className={`max-w-[85%] rounded-xl px-3 py-2 ${
              m.mine ? "ml-auto bg-primary text-primary-foreground" : "bg-glass-2 text-foreground"
            }`}
          >
            <p className="whitespace-pre-wrap break-words">{m.body}</p>
            <div
              className="mt-1 flex items-center gap-1 opacity-70"
              style={{ fontSize: `${Math.max(9, chatFontSize - 3)}px` }}
            >
              <span>{new Date(m.created_at).toLocaleString("en-GB")}</span>
              {m.mine && m.readByPeer && (
                <span className="inline-flex items-center gap-0.5" title="Read by teammate">
                  <CheckCheck className="h-3 w-3" /> Read
                </span>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="space-y-2 border-t border-edge p-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex items-end gap-1.5">
          <Textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Message ${title}…`}
            rows={1}
            className="min-h-9 h-9 flex-1 resize-none rounded-xl py-2 text-sm leading-5"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={send.isPending || !draft.trim()}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </Card>
  );
}
