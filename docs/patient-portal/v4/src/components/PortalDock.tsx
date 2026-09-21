import { useState } from "react";
import { Icon } from "./Icon";
import { Avatar } from "./ui";
import { clinician, latestMessage, patient, plan } from "../mock/seed";

type Surface = null | "chat" | "ai";

/**
 * The two circular launchers the mockups place bottom-right: a message bubble
 * for the clinic conversation and an AI bubble for the care assistant. Same
 * corner-ownership rules as the clinic portal's staff dock — one row, chat
 * nearest the corner, surfaces grow upward from their launcher.
 */
export function PortalDock() {
  const [open, setOpen] = useState<Surface>(null);
  const toggle = (s: Surface) => setOpen((cur) => (cur === s ? null : s));

  return (
    <div className="portal-dock">
      <div style={{ position: "relative" }}>
        {open === "ai" && <AssistantPanel onClose={() => setOpen(null)} />}
        <button
          type="button"
          data-qc="ai-bubble"
          aria-label="Ask the care assistant"
          aria-expanded={open === "ai"}
          className="dock-bubble dock-bubble--ai"
          onClick={() => toggle("ai")}
        >
          <Icon d="spark" size={17} />
        </button>
      </div>

      <div style={{ position: "relative" }}>
        {open === "chat" && <ChatPanel onClose={() => setOpen(null)} />}
        <button
          type="button"
          data-qc="chat-bubble"
          aria-label="Message your clinic"
          aria-expanded={open === "chat"}
          className="dock-bubble dock-bubble--chat"
          onClick={() => toggle("chat")}
        >
          <Icon d="msg" size={17} />
          <span className="dock-badge">1</span>
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
  footer,
}: {
  title: string;
  sub: string;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="dock-panel" role="dialog" aria-label={title}>
      <header className="dock-panel-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontSize: 13, fontWeight: 600 }}>{title}</p>
          <p className="tiny" style={{ fontSize: 10 }}>
            {sub}
          </p>
        </div>
        <button type="button" className="icon-btn" style={{ width: 24, height: 24 }} onClick={onClose} aria-label="Close">
          <Icon d="x" size={12} />
        </button>
      </header>
      <div className="dock-panel-body">{children}</div>
      <div className="dock-panel-foot">{footer}</div>
    </div>
  );
}

function ChatPanel({ onClose }: { onClose: () => void }) {
  return (
    <PanelShell
      title="Your clinic"
      sub={`Private messages with ${clinician.shortName}`}
      onClose={onClose}
      footer={
        <>
          <input className="field" placeholder="Message your clinic…" />
          <button type="button" className="btn btn-primary btn-sm" style={{ flex: "none" }}>
            Send
          </button>
        </>
      }
    >
      <div style={{ display: "flex", gap: 8 }}>
        <Avatar initials={clinician.initials} size={26} />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 11.5, fontWeight: 600 }}>{clinician.shortName}</p>
          <p className="tiny" style={{ fontSize: 9.5 }}>
            {latestMessage.when}
          </p>
          <div className="dock-bubble-in">{latestMessage.body}</div>
        </div>
      </div>
      <div className="dock-bubble-out">Thank you — I've paused my retinoid as advised.</div>
    </PanelShell>
  );
}

function AssistantPanel({ onClose }: { onClose: () => void }) {
  return (
    <PanelShell
      title="Care assistant"
      sub="Answers about your plan and routine"
      onClose={onClose}
      footer={
        <>
          <input className="field" placeholder="Ask about your plan…" />
          <button type="button" className="btn btn-primary btn-sm" style={{ flex: "none" }}>
            Ask
          </button>
        </>
      }
    >
      <div className="dock-bubble-in">
        Hi {patient.first} — I can help with your {plan.name}, your routine and what to expect next. For anything
        clinical, message your clinic and {clinician.shortName} will reply.
      </div>
      <div style={{ display: "grid", gap: 5, marginTop: 9 }}>
        {["What should I do before my next session?", "Why has my skin felt drier?", "When is my next milestone due?"].map(
          (q) => (
            <button key={q} type="button" className="dock-suggestion">
              {q}
            </button>
          ),
        )}
      </div>
    </PanelShell>
  );
}
