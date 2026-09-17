import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Page → floating-dock channel.
 *
 * The dock is global (mounted once in the app shell); pages that carry their
 * own chat context register it here. Today that is the patient record: it
 * tells the dock which patient the page is about, whether its docked chat
 * panel is open (the chat bubble hides then — the page already shows chat),
 * and how to restore the docked panel from the floating window.
 */
export type ChatPageContext = {
  patientId: string;
  patientName: string;
  /** True while the page's own docked chat panel is visible. */
  docked: boolean;
  /** Re-open the page's docked panel (used by the window's dock-back action). */
  restoreDock: () => void;
};

type DockApi = {
  chatPage: ChatPageContext | null;
  setChatPage: (ctx: ChatPageContext | null) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
};

const DockContext = createContext<DockApi | null>(null);

export function FloatingDockProvider({ children }: { children: React.ReactNode }) {
  const [chatPage, setChatPage] = useState<ChatPageContext | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const value = useMemo(
    () => ({ chatPage, setChatPage, chatOpen, setChatOpen }),
    [chatPage, chatOpen],
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
    };
  }
  return ctx;
}

/** Convenience for pages: register/refresh their chat context. */
export function useRegisterChatPage() {
  const { setChatPage } = useFloatingDock();
  return useCallback(
    (ctx: ChatPageContext | null) => setChatPage(ctx),
    [setChatPage],
  );
}
