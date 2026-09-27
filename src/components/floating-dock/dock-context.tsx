import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Page → floating-dock channel.
 *
 * The dock is global (mounted once in the app shell); pages that carry their
 * own chat context register it here. Today that is the patient record: it
 * tells the dock which patient the page is about, so the bubble opens straight
 * into their thread, and it can ask the dock to open that thread now (the
 * record's "Open chat" button). The chat bubble shows on every page; the
 * record no longer docks its own panel.
 */
export type ChatPageContext = {
  patientId: string;
  patientName: string;
};

export type TeamChatContext = {
  userId: string;
  name: string;
  /** Scroll the thread to this alert so the recipient can acknowledge, reply or dismiss it. */
  focusAlertId?: string | undefined;
};

export type ChatRequest =
  | (ChatPageContext & { kind: "patient"; seq: number })
  | (TeamChatContext & { kind: "team"; seq: number });

type DockApi = {
  chatPage: ChatPageContext | null;
  setChatPage: (ctx: ChatPageContext | null) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  /** Open the floating window on this patient's thread. */
  requestChat: (thread: ChatPageContext) => void;
  /** Open the floating window on the Team tab, in this teammate's thread. */
  requestTeamChat: (peer: TeamChatContext) => void;
  /** `seq` is bumped on every request so the same thread can be re-opened. */
  chatRequest: ChatRequest | null;
};

const DockContext = createContext<DockApi | null>(null);

export function FloatingDockProvider({ children }: { children: React.ReactNode }) {
  const [chatPage, setChatPage] = useState<ChatPageContext | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatRequest, setChatRequest] = useState<ChatRequest | null>(null);
  const requestChat = useCallback((thread: ChatPageContext) => {
    setChatRequest((prev) => ({ ...thread, kind: "patient", seq: (prev?.seq ?? 0) + 1 }));
    setChatOpen(true);
  }, []);
  const requestTeamChat = useCallback((peer: TeamChatContext) => {
    setChatRequest((prev) => ({ ...peer, kind: "team", seq: (prev?.seq ?? 0) + 1 }));
    setChatOpen(true);
  }, []);
  const value = useMemo(
    () => ({ chatPage, setChatPage, chatOpen, setChatOpen, requestChat, requestTeamChat, chatRequest }),
    [chatPage, chatOpen, requestChat, requestTeamChat, chatRequest],
  );
  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}

export function useFloatingDock(): DockApi {
  const ctx = useContext(DockContext);
  if (!ctx) {
    // Pages can render outside the staff shell (patient portal, auth screens);
    // give them an inert API instead of crashing.
    return {
      chatPage: null,
      setChatPage: () => {},
      chatOpen: false,
      setChatOpen: () => {},
      requestChat: () => {},
      requestTeamChat: () => {},
      chatRequest: null,
    };
  }
  return ctx;
}

/** Open a 1:1 team thread in the chat bubble. */
export function useOpenTeamChat() {
  const { requestTeamChat } = useFloatingDock();
  return useCallback((peer: TeamChatContext) => requestTeamChat(peer), [requestTeamChat]);
}

/** Convenience for pages: register/refresh their chat context. */
export function useRegisterChatPage() {
  const { setChatPage } = useFloatingDock();
  return useCallback(
    (ctx: ChatPageContext | null) => setChatPage(ctx),
    [setChatPage],
  );
}
