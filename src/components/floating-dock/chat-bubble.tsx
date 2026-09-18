import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MessageCircle, Mic, MicOff, PanelRight, Phone, PhoneOff, X } from "lucide-react";
import {
  getPatientMessages,
  getUnreadMessages,
  getVoiceCallConfig,
  getVoiceCallTarget,
  listPatientThreads,
  logCallAttempt,
  markMessagesRead,
} from "@/lib/clinic.functions";
import { PatientAvatar } from "@/components/patient-avatar";
import { PatientChatThread, type PatientChatMessage } from "@/components/patient-chat-thread";
import { useFloatingDock } from "./dock-context";
import { useVoiceCall, type VoiceCallState } from "./use-voice-call";

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
    // The window floats above the launcher row (absolute, anchored to the
    // bubble) so opening it never widens the row and shifts the alert pill.
    <div className="relative flex flex-col items-end">
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

  const fetchVoiceConfig = useServerFn(getVoiceCallConfig);
  const fetchVoiceTarget = useServerFn(getVoiceCallTarget);
  const logCall = useServerFn(logCallAttempt);
  const { data: voiceConfig } = useQuery({
    queryKey: ["voice-call-config"],
    queryFn: () => fetchVoiceConfig(),
    staleTime: Infinity,
  });
  const voiceReady = Boolean(voiceConfig?.available);
  const call = useVoiceCall();
  const [callTargetLabel, setCallTargetLabel] = useState<string | null>(null);

  async function startCall() {
    if (!active || !voiceReady || call.state === "connecting" || call.state === "ringing" || call.state === "connected") return;
    try {
      const target = await fetchVoiceTarget({ data: { patient_id: active.patientId } });
      setCallTargetLabel(target.label);
      // Comms trail: the call shows up on the patient record.
      void logCall({ data: { patient_id: active.patientId, phone: target.phone } }).catch(() => {});
      await call.start(target.phone);
    } catch {
      /* the hook surfaces its own error state */
    }
  }

  return (
    <div
      role="dialog"
      aria-label={active ? `Chat with ${active.patientName}` : "Patient conversations"}
      data-qc="chat-window"
      className="pointer-events-auto absolute bottom-[calc(100%+0.75rem)] right-0 flex h-[560px] max-h-[70vh] w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-edge bg-popover shadow-[var(--shadow-popover)] backdrop-blur-glass backdrop-saturate-150"
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
            <button
              type="button"
              data-qc="call-button"
              aria-label={voiceReady ? `Call ${active.patientName}` : "Voice calling is not configured"}
              title={
                voiceReady
                  ? `Call ${active.patientName} (rings your demo line)`
                  : "Voice calling isn't configured — see docs/voice-call-setup.md"
              }
              disabled={!voiceReady}
              onClick={() => void startCall()}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-glass-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Phone className="h-4 w-4" aria-hidden />
            </button>
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

      {call.state !== "idle" && (
        <CallStrip
          state={call.state}
          error={call.error}
          muted={call.muted}
          seconds={call.seconds}
          targetLabel={callTargetLabel}
          patientName={active?.patientName ?? "Patient"}
          onMute={call.toggleMute}
          onHangUp={call.hangUp}
          onDismiss={call.dismiss}
        />
      )}

      {active ? <ThreadView key={active.patientId} thread={active} /> : <InboxView onPick={onPick} />}
    </div>
  );
}

function CallStrip({
  state,
  error,
  muted,
  seconds,
  targetLabel,
  patientName,
  onMute,
  onHangUp,
  onDismiss,
}: {
  state: VoiceCallState;
  error: string | null;
  muted: boolean;
  seconds: number;
  targetLabel: string | null;
  patientName: string;
  onMute: () => void;
  onHangUp: () => void;
  onDismiss: () => void;
}) {
  const live = state === "connecting" || state === "ringing" || state === "connected";
  const timer = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const label =
    state === "connecting"
      ? "Connecting…"
      : state === "ringing"
        ? `Ringing ${patientName}…`
        : state === "connected"
          ? `On call with ${patientName}`
          : state === "ended"
            ? "Call ended"
            : (error ?? "Call failed");

  return (
    <div
      data-qc="call-strip"
      className={`flex shrink-0 items-center gap-2 border-b border-edge px-3.5 py-2 text-xs ${
        state === "error" ? "bg-destructive-bg text-destructive" : "bg-accent-wash text-foreground"
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${
        state === "connected" ? "bg-success" : state === "error" ? "bg-destructive" : "bg-warning animate-pulse motion-reduce:animate-none"
      }`} aria-hidden />
      <span className="min-w-0 flex-1 truncate font-medium">
        {label}
        {targetLabel && live ? <span className="text-muted-foreground"> · {targetLabel}</span> : null}
        {state === "connected" ? <span className="tabular-nums text-muted-foreground"> · {timer}</span> : null}
      </span>
      {state === "connected" ? (
        <button
          type="button"
          onClick={onMute}
          aria-label={muted ? "Unmute" : "Mute"}
          aria-pressed={muted}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-glass-2 hover:text-foreground"
        >
          {muted ? <MicOff className="h-3.5 w-3.5" aria-hidden /> : <Mic className="h-3.5 w-3.5" aria-hidden />}
        </button>
      ) : null}
      {live ? (
        <button
          type="button"
          onClick={onHangUp}
          aria-label="Hang up"
          className="flex items-center gap-1 rounded-full bg-destructive px-2.5 py-1 text-2xs font-semibold text-white hover:brightness-110"
        >
          <PhoneOff className="h-3 w-3" aria-hidden /> End
        </button>
      ) : (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss call status"
          className="rounded-full p-1 text-muted-foreground hover:bg-glass-2 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
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
  // After sending, poll fast for a while: the demo AI patient replies within
  // seconds and the typing bubble + answer should land without a long wait.
  const fastUntil = useRef(0);
  const { data } = useQuery({
    queryKey: ["patient-messages", thread.patientId],
    queryFn: () => fetchMessages({ data: { patient_id: thread.patientId } }),
    refetchInterval: (query) =>
      Date.now() < fastUntil.current || query.state.data?.typing ? 4_000 : 12_000,
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
      messages={(data?.messages ?? []) as PatientChatMessage[]}
      typing={Boolean(data?.typing)}
      as="staff"
      templates
      onSent={() => {
        fastUntil.current = Date.now() + 30_000;
        queryClient.invalidateQueries({ queryKey: ["patient-messages", thread.patientId] });
        queryClient.invalidateQueries({ queryKey: ["patient-threads"] });
        queryClient.invalidateQueries({ queryKey: ["patient", thread.patientId] });
      }}
    />
  );
}
