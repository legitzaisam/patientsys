import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageCircle, Send, Sparkles, X } from "lucide-react";
import {
  askCareAssistant,
  getPatientMessages,
  getPortalRecords,
  getUnreadMessages,
  markMessagesRead,
} from "@/lib/clinic.functions";
import { PatientChatThread, type PatientChatMessage } from "@/components/patient-chat-thread";
import { cn } from "@/lib/utils";

type Surface = null | "chat" | "ai";

/**
 * The two corner launchers from the mockups: a message bubble for the clinic
 * conversation and an AI bubble for the care assistant.
 *
 * Same corner rules the staff dock already follows — one row bottom-right,
 * chat nearest the corner, surfaces grow upward, Escape and click-outside
 * close, and only one surface is open at a time.
 */
export function PortalDock() {
  const [open, setOpen] = useState<Surface>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const fetchUnread = useServerFn(getUnreadMessages);
  const { data: unread } = useQuery({
    queryKey: ["unread-messages"],
    queryFn: () => fetchUnread(),
    refetchInterval: 60_000,
  });
  const unreadTotal = unread?.total ?? 0;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(null);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      data-qc="portal-dock"
      className="fixed bottom-5 right-5 z-[60] flex items-end gap-3 print:hidden"
    >
      <div className="relative">
        {open === "ai" && <AssistantPanel onClose={() => setOpen(null)} />}
        <button
          type="button"
          data-qc="ai-bubble"
          aria-label="Ask the care assistant"
          aria-expanded={open === "ai"}
          onClick={() => setOpen((s) => (s === "ai" ? null : "ai"))}
          className="grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-edge bg-[linear-gradient(140deg,#ffffff,var(--sky-bg)_80%)] text-sky-ink shadow-lift transition-transform hover:scale-105 active:scale-95 motion-reduce:transition-none"
        >
          <Sparkles className="h-4 w-4" aria-hidden />
        </button>
      </div>

      <div className="relative">
        {open === "chat" && <ChatPanel onClose={() => setOpen(null)} />}
        <button
          type="button"
          data-qc="chat-bubble"
          aria-label={`Message your clinic${unreadTotal ? ` (${unreadTotal} unread)` : ""}`}
          aria-expanded={open === "chat"}
          onClick={() => setOpen((s) => (s === "chat" ? null : "chat"))}
          className="relative grid h-11 w-11 cursor-pointer place-items-center rounded-full border border-edge bg-[linear-gradient(140deg,var(--accent-hi),var(--accent)_75%)] text-accent-ink shadow-bloom transition-transform hover:scale-105 active:scale-95 motion-reduce:transition-none"
        >
          <MessageCircle className="h-4 w-4" aria-hidden />
          {unreadTotal > 0 && open !== "chat" && (
            <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-destructive px-1 text-2xs font-bold text-white shadow-lift">
              {unreadTotal > 9 ? "9+" : unreadTotal}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function PanelShell({
  title,
  sub,
  onClose,
  children,
  qc,
}: {
  title: string;
  sub: string;
  onClose: () => void;
  children: React.ReactNode;
  qc: string;
}) {
  return (
    <div
      role="dialog"
      aria-label={title}
      data-qc={qc}
      className="absolute bottom-[calc(100%+12px)] right-0 flex max-h-[70vh] w-[min(340px,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-[20px] border border-edge bg-popover shadow-popover backdrop-blur-glass backdrop-saturate-150"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-edge-2 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold">{title}</p>
          <p className="text-2xs text-muted-foreground">{sub}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="grid h-6 w-6 cursor-pointer place-items-center rounded-full text-ink-3 hover:bg-glass-2 hover:text-foreground"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      </header>
      {children}
    </div>
  );
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const fetchRecords = useServerFn(getPortalRecords);
  const fetchMessages = useServerFn(getPatientMessages);
  const markRead = useServerFn(markMessagesRead);

  const { data: records } = useQuery({ queryKey: ["portal-records"], queryFn: () => fetchRecords() });
  const patientId = records?.patient?.id as string | undefined;

  const { data } = useQuery({
    queryKey: ["patient-messages", patientId],
    queryFn: () => fetchMessages({ data: { patient_id: patientId! } }),
    enabled: Boolean(patientId),
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!patientId) return;
    void markRead({ data: { patient_id: patientId } }).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["unread-messages"] });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  return (
    <PanelShell qc="chat-panel" title="Your clinic" sub="Secure messages with your care team" onClose={onClose}>
      <div className="flex min-h-[320px] flex-col">
        {patientId ? (
          <PatientChatThread
            patientId={patientId}
            patientName="Your clinic"
            messages={(data?.messages ?? []) as PatientChatMessage[]}
            as="patient"
            fontSize={12}
            onSent={() => {
              void queryClient.invalidateQueries({ queryKey: ["patient-messages", patientId] });
              void queryClient.invalidateQueries({ queryKey: ["portal-home"] });
            }}
          />
        ) : (
          <p className="p-4 text-xs text-muted-foreground">Loading…</p>
        )}
      </div>
    </PanelShell>
  );
}

type Turn = { role: "you" | "assistant"; text: string; referToClinic?: boolean };

const SUGGESTIONS = [
  "What should I do before my next session?",
  "When is my next milestone due?",
  "How do I use my evening routine?",
];

function AssistantPanel({ onClose }: { onClose: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const ask = useMutation({
    mutationFn: useServerFn(askCareAssistant),
    onSuccess: (res: any) => {
      setTurns((t) => [...t, { role: "assistant", text: res.answer, referToClinic: res.referToClinic }]);
    },
    onError: (e: Error) => {
      setTurns((t) => [...t, { role: "assistant", text: e.message, referToClinic: true }]);
    },
  });

  function send(text: string) {
    const q = text.trim();
    if (!q || ask.isPending) return;
    setTurns((t) => [...t, { role: "you", text: q }]);
    setQuestion("");
    ask.mutate({ data: { question: q } });
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length, ask.isPending]);

  return (
    <PanelShell
      qc="ai-panel"
      title="Care assistant"
      sub="Answers about your plan and routine"
      onClose={onClose}
    >
      <div ref={scrollRef} className="min-h-[220px] flex-1 overflow-y-auto p-3.5">
        <p className="rounded-[13px] bg-glass-2 px-3 py-2 text-xs leading-relaxed shadow-[inset_0_0_0_1px_var(--edge-2)]">
          I can help with your plan, your routine and how to prepare for appointments. For anything clinical, message
          your clinic and they'll reply.
        </p>

        {turns.map((t, i) => (
          <div
            key={i}
            className={cn(
              "mt-2 max-w-[86%] rounded-[13px] px-3 py-2 text-xs leading-relaxed",
              t.role === "you"
                ? "ml-auto bg-accent-soft"
                : t.referToClinic
                  ? "bg-warning-bg text-warning-ink"
                  : "bg-glass-2 shadow-[inset_0_0_0_1px_var(--edge-2)]",
            )}
          >
            {t.text}
          </div>
        ))}
        {ask.isPending && (
          <div className="mt-2 flex w-14 items-center gap-1 rounded-[13px] bg-glass-2 px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--edge-2)]">
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-3/60 motion-reduce:animate-none"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </div>
        )}

        {turns.length === 0 && (
          <div className="mt-2.5 grid gap-1.5">
            {SUGGESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                data-qc="ai-suggestion"
                onClick={() => send(q)}
                className="cursor-pointer rounded-[11px] bg-accent-wash px-2.5 py-1.5 text-left text-[11px] text-accent-ink shadow-[inset_0_0_0_1px_var(--accent-line)] hover:bg-accent-soft"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        className="flex shrink-0 gap-1.5 border-t border-edge-2 px-3.5 py-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          send(question);
        }}
      >
        <input
          data-qc="ai-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask about your plan…"
          aria-label="Ask the care assistant"
          className="h-8 min-w-0 flex-1 rounded-[11px] border border-edge-2 bg-glass-2 px-2.5 text-xs shadow-inset-hi"
        />
        <button
          type="submit"
          data-qc="ai-send"
          disabled={!question.trim() || ask.isPending}
          aria-label="Send question"
          className="grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-full bg-accent text-accent-foreground shadow-bloom disabled:opacity-45"
        >
          <Send className="h-3.5 w-3.5" aria-hidden />
        </button>
      </form>
    </PanelShell>
  );
}
