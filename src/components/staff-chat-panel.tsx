import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, CheckCheck, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { getStaffChat, markStaffChatRead, sendStaffChatMessage } from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type ChatMessage = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
  mine: boolean;
  readByPeer: boolean;
};

/** Live 1:1 staff chat with read receipts, shown on a teammate's profile. */
export function StaffChatPanel({
  peerUserId,
  peerName,
  autoFocus = false,
}: {
  peerUserId: string;
  peerName?: string;
  autoFocus?: boolean;
}) {
  const { data: identity } = useIdentity();
  const queryClient = useQueryClient();
  const fetchChat = useServerFn(getStaffChat);
  const sendMessage = useServerFn(sendStaffChatMessage);
  const markRead = useServerFn(markStaffChatRead);
  const [draft, setDraft] = useState("");
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

  return (
    <section
      id="staff-chat"
      className="glass-card relative flex min-h-[22rem] flex-col overflow-hidden !rounded-2xl p-0 shadow-popover"
    >
      <div className="flex items-center gap-2 border-b border-edge px-4 py-3">
        <MessageSquare className="h-4 w-4 text-muted-foreground" aria-hidden />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-foreground">
            Chat with {title}
          </h2>
          <p className="text-2xs text-muted-foreground">Live clinic chat · read receipts</p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4 py-3">
        {isLoading && <p className="text-xs text-muted-foreground">Loading conversation…</p>}
        {!isLoading && (data?.messages?.length ?? 0) === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">
            No messages yet. Say hello to start the thread.
          </p>
        )}
        {(data?.messages as ChatMessage[] | undefined)?.map((m) => (
          <div key={m.id} className={cn("flex", m.mine ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-inset-hi",
                m.mine
                  ? "rounded-br-md bg-accent-soft text-foreground"
                  : "rounded-bl-md border border-edge bg-glass-2 text-foreground",
              )}
            >
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <div
                className={cn(
                  "mt-1 flex items-center gap-1 text-2xs",
                  m.mine ? "justify-end text-muted-foreground" : "text-muted-foreground",
                )}
              >
                <span>
                  {new Date(m.created_at).toLocaleTimeString("en-GB", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {m.mine &&
                  (m.readByPeer ? (
                    <CheckCheck className="h-3.5 w-3.5 text-accent-ink" aria-label="Read" />
                  ) : (
                    <Check className="h-3.5 w-3.5 opacity-70" aria-label="Sent" />
                  ))}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-edge p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const body = draft.trim();
          if (!body || send.isPending) return;
          send.mutate(body);
        }}
      >
        <Textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${title}…`}
          rows={2}
          className="min-h-[2.75rem] flex-1 resize-none rounded-2xl"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const body = draft.trim();
              if (!body || send.isPending) return;
              send.mutate(body);
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full"
          disabled={send.isPending || !draft.trim()}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </section>
  );
}
