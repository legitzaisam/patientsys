import { type MouseEvent, type TouchEvent } from "react";
import { Minus } from "lucide-react";
import { PatientChatThread, type PatientChatMessage } from "@/components/patient-chat-thread";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { usePanelWidth } from "@/hooks/use-panel-width";

export type { PatientChatMessage };

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
  onCollapse,
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
  /** When set, the header shows a minimise control (chat collapses to a bubble). */
  onCollapse?: () => void;
  templates?: boolean;
  canDeleteTemplates?: boolean;
  title?: string;
  subtitle?: string;
}) {
  const [fontSize, setFontSize] = usePanelWidth(
    as === "staff" ? "patient-messages-font" : "clinic-messages-font",
    13,
  );

  const heading = title ?? (as === "staff" ? patientName : "Your clinic");
  const sub = subtitle ?? (as === "staff" ? "Private messages with this patient" : "Message your clinic");
  const avatar = as === "staff" ? initials(patientName) || "?" : "CL";

  return (
    <Card
      id="patient-chat"
      className="relative flex h-[calc(100dvh-6rem-1.25rem)] max-h-[calc(100dvh-6rem-1.25rem)] min-h-0 flex-col self-start overflow-hidden rounded-2xl p-0 sm:h-[calc(100dvh-6rem-26px)] sm:max-h-[calc(100dvh-6rem-26px)] md:sticky md:top-24 md:h-[calc(100dvh-6rem-max(26px,var(--dock-h,0px)+0.75rem))] md:max-h-[calc(100dvh-6rem-max(26px,var(--dock-h,0px)+0.75rem))]"
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
            className="h-6 w-6 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
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
            className="h-6 w-6 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
            aria-label="Increase message text size"
            disabled={fontSize >= 18}
            onClick={() => setFontSize(Math.min(18, fontSize + 1))}
          >
            <span className="text-2xs font-medium leading-none">A+</span>
          </Button>
        </div>
        {onCollapse ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-glass-2 hover:text-foreground"
            aria-label="Minimise chat"
            title="Minimise chat"
            onClick={onCollapse}
          >
            <Minus className="h-3.5 w-3.5" aria-hidden />
          </Button>
        ) : null}
      </header>

      <PatientChatThread
        patientId={patientId}
        patientName={patientName}
        messages={messages}
        as={as}
        onSent={onSent}
        fontSize={fontSize}
        templates={templates}
        canDeleteTemplates={canDeleteTemplates}
      />
    </Card>
  );
}
