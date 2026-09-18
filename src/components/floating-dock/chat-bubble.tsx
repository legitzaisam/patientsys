import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MessageCircle, PanelRight, X } from "lucide-react";
import {
  getPatientMessages,
  getUnreadMessages,
  listPatientThreads,
  markMessagesRead,
} from "@/lib/clinic.functions";
import { PatientAvatar } from "@/components/patient-avatar";
import { PatientChatThread, type PatientChatMessage } from "@/components/patient-chat-thread";
import { useFloatingDock } from "./dock-context";

type ActiveThread = { patientId: string; patientName: string; avatarUrl?: string | null };

function timeAgo(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Messenger-style patient chat: a launcher bubble with the clinic-wide unread
 * count, opening a floating window — a conversation inbox on most pages, or
 * straight into the current patient's thread on their record.
 */
export function ChatBubble() {
  const { chatPage, chatOpen, setChatOpen } = useFloatingDock();
  const [active, setActive] = useState<ActiveThread | null>(null);

  const fetchUnread = useServerFn(getUnreadMessages);
  const { data: unread } = useQuery({
    queryKey: ["unread-messages"],
    queryFn: () => fetchUnread(),
    refetchInterval: 60_000,
  });
  const unreadTotal = unread?.total ?? 0;

  // The record page's docked panel already shows this conversation.
  const hidden = Boolean(chatPage?.docked);

  useEffect(() => {
    if (hidden && chatOpen) setChatOpen(false);
  }, [hidden, chatOpen, setChatOpen]);

  function open() {
    setActive(chatPage ? { patientId: chatPage.patientId, patientName: chatPage.patientName } : null);
    setChatOpen(true);
  }

  useEffect(() => {
    if (!chatOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setChatOpen(false);
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-qc="chat-window"], [data-qc="chat-bubble"]')) return;
      setChatOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [chatOpen, setChatOpen]);

  if (hidden) return null;

  return (
    <div className="flex flex-col items-end gap-3">
      {chatOpen && (
        <ChatWindow
          active={active}
          onBack={() => setActive(null)}
          onPick={(thread) => setActive(thread)}
          onClose={() => setChatOpen(false)}
        />
      )}
      <button
        type="button"
        onClick={() => (chatOpen ? setChatOpen(false) : open())}
        aria-label={
          chatOpen
            ? "Close chat"
            : `Open chat${chatPage ? ` with ${chatPage.patientName}` : ""}${unreadTotal ? ` (${unreadTotal} unread)` : ""}`
        }
        aria-expanded={chatOpen}
        data-qc="chat-bubble"
        // No overflow-hidden: the sheen clips itself (border-radius: inherit),
        // and clipping here cuts off the unread badge that hangs past the circle.
        className="glass-sheen pointer-events-auto relative flex h-10 w-10 items-center justify-center rounded-full border border-edge bg-[linear-gradient(140deg,var(--accent-hi),var(--accent)_75%)] text-accent-foreground shadow-bloom backdrop-blur-glass backdrop-saturate-150 transition-transform hover:scale-105 hover:brightness-[1.05] active:scale-95 active:brightness-[0.92] motion-reduce:transition-none"
      >
        <MessageCircle className="relative z-[1] h-4 w-4" aria-hidden />
        {unreadTotal > 0 && !chatOpen ? (
          <span className="absolute -right-0.5 -top-0.5 z-[1] flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-bold text-white shadow-lift">
            {unreadTotal > 9 ? "9+" : unreadTotal}
          </span>
        ) : null}
      </button>
    </div>
  );
}

function ChatWindow({
  active,
  onBack,
  onPick,
  onClose,
}: {
  active: ActiveThread | null;
  onBack: () => void;
  onPick: (thread: ActiveThread) => void;
  onClose: () => void;
}) {
  const { chatPage, setChatOpen } = useFloatingDock();

  return (
    <div
      role="dialog"
      aria-label={active ? `Chat with ${active.patientName}` : "Patient conversations"}
      data-qc="chat-window"
      className="pointer-events-auto flex h-[560px] max-h-[70vh] w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-edge bg-popover shadow-[var(--shadow-popover)] backdrop-blur-glass backdrop-saturate-150"
    >
      <header className="flex shrink-0 items-center gap-2.5 border-b border-edge px-3.5 py-3">
        {active ? (
          <>
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to conversations"
              className="rounded-full p-1 text-muted-foreground hover:bg-glass-2 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
            </button>
            <PatientAvatar patientId={active.patientId} name={active.patientName} photoUrl={active.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{active.patientName}</p>
              <p className="text-2xs text-muted-foreground">Private messages with this patient</p>
            </div>
            {chatPage && chatPage.patientId === active.patientId ? (
              <button
                type="button"
                aria-label="Dock chat to the page"
                title="Dock chat to the page"
                onClick={() => {
                  chatPage.restoreDock();
                  setChatOpen(false);
                }}
                className="rounded-full p-1.5 text-muted-foreground hover:bg-glass-2 hover:text-foreground"
              >
                <PanelRight className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </>
        ) : (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Messages</p>
            <p className="text-2xs text-muted-foreground">Recent patient conversations</p>
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat window"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-glass-2 hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </header>

      {active ? <ThreadView key={active.patientId} thread={active} /> : <InboxView onPick={onPick} />}
    </div>
  );
}

function InboxView({ onPick }: { onPick: (thread: ActiveThread) => void }) {
  const fetchThreads = useServerFn(listPatientThreads);
  const { data: threads, isLoading } = useQuery({
    queryKey: ["patient-threads"],
    queryFn: () => fetchThreads(),
    refetchInterval: 20_000,
  });

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
      {isLoading && <p className="p-4 text-center text-xs text-muted-foreground">Loading conversations…</p>}
      {!isLoading && (threads ?? []).length === 0 && (
        <p className="p-6 text-center text-xs text-muted-foreground">
          No conversations yet — patients can message from their portal, or open a record to start one.
        </p>
      )}
      <ul className="space-y-0.5">
        {(threads ?? []).map((t: any) => (
          <li key={t.patientId}>
            <button
              type="button"
              onClick={() => onPick({ patientId: t.patientId, patientName: t.name, avatarUrl: t.avatarUrl })}
              className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-glass-2"
            >
              <PatientAvatar patientId={t.patientId} name={t.name} photoUrl={t.avatarUrl} size="md" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`truncate text-sm ${t.unread ? "font-semibold text-foreground" : "font-medium text-foreground/90"}`}>
                    {t.name}
                  </span>
                  <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">{timeAgo(t.lastAt)}</span>
                </span>
                <span className={`block truncate text-xs ${t.unread ? "text-foreground/80" : "text-muted-foreground"}`}>
                  {t.lastAuthor === "staff" ? "You: " : ""}
                  {t.last}
                </span>
              </span>
              {t.unread > 0 ? (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-bold text-white">
                  {t.unread > 9 ? "9+" : t.unread}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ThreadView({ thread }: { thread: ActiveThread }) {
  const queryClient = useQueryClient();
  const fetchMessages = useServerFn(getPatientMessages);
  const markRead = useServerFn(markMessagesRead);
  const { data: messages } = useQuery({
    queryKey: ["patient-messages", thread.patientId],
    queryFn: () => fetchMessages({ data: { patient_id: thread.patientId } }),
    refetchInterval: 12_000,
  });

  // Opening the thread reads it: clear unread + refresh the inbox/bell counts.
  useEffect(() => {
    void markRead({ data: { patient_id: thread.patientId } }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["unread-messages"] });
      queryClient.invalidateQueries({ queryKey: ["patient-threads"] });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thread.patientId]);

  return (
    <PatientChatThread
      patientId={thread.patientId}
      patientName={thread.patientName}
      messages={(messages ?? []) as PatientChatMessage[]}
      as="staff"
      templates
      onSent={() => {
        queryClient.invalidateQueries({ queryKey: ["patient-messages", thread.patientId] });
        queryClient.invalidateQueries({ queryKey: ["patient-threads"] });
        queryClient.invalidateQueries({ queryKey: ["patient", thread.patientId] });
      }}
    />
  );
}
