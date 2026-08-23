import { useEffect, useMemo, useRef, type MouseEvent, type TouchEvent } from "react";
import { Check, CheckCheck } from "lucide-react";
import { MessageAttachments, type Attachment } from "@/components/message-attachments";
import { MessageComposer } from "@/components/message-composer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePanelWidth } from "@/hooks/use-panel-width";
import { cn } from "@/lib/utils";

export type PatientChatMessage = {
  id: string;
  author: "staff" | "patient" | string;
  body: string;
  created_at: string;
  read_at?: string | null;
  attachments?: Attachment[] | null;
};

type RenderItem =
  | { type: "day"; key: string; label: string }
  | { type: "message"; key: string; message: PatientChatMessage; mine: boolean; stacked: boolean };

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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Clinic ↔ patient thread — same soft glass chat language as staff 1:1. */
export function PatientChatPanel({
  patientId,
  patientName,
  messages,
  as,
  onSent,
  onResizeStart,
  templates = false,
  canDeleteTemplates = false,
  title,
  subtitle,
}: {
  patientId: string;
  patientName: string;
  messages: PatientChatMessage[];
  as: "staff" | "patient";
  onSent: () => void;
  onResizeStart?: (e: MouseEvent | TouchEvent) => void;
  templates?: boolean;
  canDeleteTemplates?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const [fontSize, setFontSize] = usePanelWidth(
    as === "staff" ? "patient-messages-font" : "clinic-messages-font",
    13,
  );
  const threadRef = useRef<HTMLDivElement | null>(null);
  const firstName = patientName.trim().split(/\s+/)[0] || patientName;

  const heading =
    title ?? (as === "staff" ? patientName : "Your clinic");
  const sub =
    subtitle ?? (as === "staff" ? "Private messages with this patient" : "Message your clinic");
  const avatar = as === "staff" ? initials(patientName) || "?" : "CL";

  const renderItems = useMemo(() => {
    const ordered = [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const out: RenderItem[] = [];
    let lastDay = "";
    ordered.forEach((message, index) => {
      const key = dayKey(message.created_at);
      if (key !== lastDay) {
        out.push({ type: "day", key: `day-${key}`, label: dayLabel(message.created_at) });
        lastDay = key;
      }
      const mine = message.author === as;
      const prev = ordered[index - 1];
      const prevMine = prev ? prev.author === as : false;
      const stacked = Boolean(prev && dayKey(prev.created_at) === key && prevMine === mine);
      out.push({ type: "message", key: `m-${message.id}`, message, mine, stacked });
    });
    return out;
  }, [as, messages]);

  useEffect(() => {
    const thread = threadRef.current;
    if (!thread) return;
    thread.scrollTo({ top: thread.scrollHeight, behavior: "smooth" });
  }, [renderItems.length]);

  return (
    <Card
      id="patient-chat"
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
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent-line bg-accent-wash text-2xs font-semibold tracking-wide text-accent-ink"
          aria-hidden
        >
          {avatar}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="section-title truncate">{heading}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
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
        {messages.length === 0 ? (
          <div className="flex h-full min-h-40 items-center justify-center px-4">
            <p className="staff-chat-day max-w-[16rem] text-center">
              {as === "staff"
                ? "No messages yet. Say hello, or send a treatment reminder."
                : "No messages yet. Ask your clinic anything here."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {renderItems.map((item) => {
              if (item.type === "day") {
                return (
                  <div
                    key={item.key}
                    className="my-[0.85em] flex justify-center"
                    style={{ fontSize: `${fontSize}px` }}
                  >
                    <span className="staff-chat-day font-medium">{item.label}</span>
                  </div>
                );
              }

              const m = item.message;
              const attachments = (m.attachments ?? []) as Attachment[];
              return (
                <div
                  key={item.key}
                  className={cn(
                    "staff-chat-item",
                    item.stacked ? "staff-chat-item--stack" : "staff-chat-item--break",
                  )}
                >
                  <div
                    className={cn(
                      "staff-chat-bubble",
                      item.mine ? "staff-chat-bubble--out" : "staff-chat-bubble--in",
                    )}
                  >
                    {m.body ? <p className="whitespace-pre-wrap break-words pr-[0.15em]">{m.body}</p> : null}
                    <MessageAttachments attachments={attachments} />
                    <div className="staff-chat-meta">
                      <span>{timeLabel(m.created_at)}</span>
                      {item.mine ? (
                        m.read_at ? (
                          <CheckCheck aria-label="Read" className="text-sky-ink" />
                        ) : (
                          <Check aria-label="Sent" className="text-ink-3/70" />
                        )
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <MessageComposer
        patientId={patientId}
        as={as}
        templates={as === "staff"}
        canDeleteTemplates={canDeleteTemplates}
        patientFirstName={firstName}
        placeholder={as === "staff" ? `Message ${firstName}…` : "Message the clinic…"}
        onSent={onSent}
        variant="chat"
      />
    </Card>
  );
}
