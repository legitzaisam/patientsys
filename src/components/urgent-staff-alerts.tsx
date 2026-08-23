import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Megaphone,
  MessageSquare,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import {
  listStaffNotifications,
  markStaffNotificationRead,
  sendStaffAlert,
} from "@/lib/clinic.functions";
import { useAuthSessionReady } from "@/lib/use-auth-session-ready";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Bottom-right popup for unread urgent peer alerts.
 * Matches arrival-alert chrome (glass card, badge, collapsed pill).
 */
export function UrgentStaffAlerts() {
  const queryClient = useQueryClient();
  const sessionReady = useAuthSessionReady();
  const fetchAlerts = useServerFn(listStaffNotifications);
  const markRead = useServerFn(markStaffNotificationRead);
  const sendAlert = useServerFn(sendStaffAlert);
  const [collapsed, setCollapsed] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const collapsedBtnRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useRef(false);

  const { data: alerts } = useQuery({
    queryKey: ["staff-notifications"],
    queryFn: () => fetchAlerts(),
    refetchInterval: 60_000,
    enabled: sessionReady,
  });

  const urgent = useMemo(
    () => (alerts ?? []).filter((a) => a.urgent === true || a.kind === "urgent"),
    [alerts],
  );

  useEffect(() => {
    if (collapsed || urgent.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (replying) {
          setReplying(false);
          setReply("");
          return;
        }
        restoreFocus.current = true;
        setCollapsed(true);
      } else if (panelRef.current?.contains(document.activeElement) && !replying) {
        if (e.key === "ArrowRight") setCursor((c) => c + 1);
        if (e.key === "ArrowLeft") setCursor((c) => Math.max(0, c - 1));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [collapsed, urgent.length, replying]);

  useEffect(() => {
    if (collapsed && restoreFocus.current) {
      restoreFocus.current = false;
      collapsedBtnRef.current?.focus();
    }
  }, [collapsed]);

  useEffect(() => {
    setCursor((c) => (urgent.length === 0 ? 0 : Math.min(c, urgent.length - 1)));
  }, [urgent.length]);

  const acknowledge = useMutation({
    mutationFn: (id: string) => markRead({ data: { id } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["sent-staff-alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["staff-chat"] });
      toast.success("Alert acknowledged");
      setCursor(0);
      setReplying(false);
      setReply("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const replyMutation = useMutation({
    mutationFn: async (args: { recipientId: string; body: string; alertId: string }) => {
      await sendAlert({
        data: {
          audience: "user",
          recipientId: args.recipientId,
          body: args.body,
          urgent: false,
        },
      });
      await markRead({ data: { id: args.alertId } });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
      void queryClient.invalidateQueries({ queryKey: ["sent-staff-alerts"] });
      void queryClient.invalidateQueries({ queryKey: ["staff-chat"] });
      toast.success("Reply sent");
      setReplying(false);
      setReply("");
      setCursor(0);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (urgent.length === 0) return null;

  const index = Math.min(cursor, urgent.length - 1);
  const current = urgent[index]!;
  const fromName = current.sender_name?.trim() || "A teammate";
  const displayTitle = current.title
    .replace(/^(Urgent|Message)\s+from\s+[^:]+:\s*/i, "")
    .trim() || current.title;

  if (collapsed) {
    return (
      <button
        type="button"
        ref={collapsedBtnRef}
        aria-expanded={false}
        aria-label={`Show ${urgent.length} urgent team alert${urgent.length > 1 ? "s" : ""}`}
        onClick={() => setCollapsed(false)}
        className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-[#b8a8e0] px-3.5 text-xs font-semibold text-[#4a3a7a] shadow-glass ring-1 ring-warning/40 transition-all hover:-translate-y-0.5"
      >
        <Megaphone className="h-3.5 w-3.5" />
        <span className="tabular-nums">{urgent.length}</span> Alert
        {urgent.length > 1 ? "s" : ""}
        <ChevronUp className="h-3.5 w-3.5 opacity-70" />
      </button>
    );
  }

  return (
    <div ref={panelRef} role="region" aria-label="Urgent team alerts" className="w-full">
      <div className="glass-card relative overflow-hidden !rounded-2xl p-3 shadow-popover ring-1 ring-warning/40">
        <div
          className="pointer-events-none absolute inset-0 bg-[rgba(184,168,224,0.52)]"
          aria-hidden
        />

        <div className="relative flex items-start gap-2">
          <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-[#b8a8e0] px-2 py-0.5 text-2xs font-semibold text-[#4a3a7a]">
            <Megaphone className="h-3 w-3" />
            Team alert
            <span className="tabular-nums">· Urgent</span>
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            {urgent.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous urgent alert"
                  disabled={index === 0 || replying}
                  onClick={() => {
                    setReplying(false);
                    setReply("");
                    setCursor(index - 1);
                  }}
                  className="rounded-full p-1 text-muted-foreground hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground disabled:opacity-30"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="min-w-[2rem] text-center text-2xs tabular-nums text-muted-foreground">
                  {index + 1}/{urgent.length}
                </span>
                <button
                  type="button"
                  aria-label="Next urgent alert"
                  disabled={index >= urgent.length - 1 || replying}
                  onClick={() => {
                    setReplying(false);
                    setReply("");
                    setCursor(index + 1);
                  }}
                  className="rounded-full p-1 text-muted-foreground hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground disabled:opacity-30"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <button
              type="button"
              aria-label="Collapse urgent alerts"
              onClick={() => {
                setReplying(false);
                setReply("");
                setCollapsed(true);
              }}
              className="rounded-full p-1 text-muted-foreground hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="relative mt-2.5 min-w-0">
          <p className="text-xs font-semibold text-foreground">From {fromName}</p>
          {(current.body || displayTitle) ? (
            <p className="mt-1.5 text-sm font-medium leading-snug text-foreground">
              {current.body || displayTitle}
            </p>
          ) : null}
        </div>

        {replying ? (
          <div className="relative mt-3 space-y-2">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={`Reply to ${fromName}…`}
              rows={3}
              className="min-h-[4.5rem] resize-none text-xs"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 flex-1 px-3 text-xs"
                disabled={replyMutation.isPending}
                onClick={() => {
                  setReplying(false);
                  setReply("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-8 flex-1 px-3 text-xs"
                disabled={replyMutation.isPending || !reply.trim() || !current.sender_id}
                onClick={() => {
                  if (!current.sender_id) {
                    toast.error("Cannot reply — sender unknown");
                    return;
                  }
                  replyMutation.mutate({
                    recipientId: current.sender_id,
                    body: reply.trim(),
                    alertId: current.id,
                  });
                }}
              >
                <Send className="h-3.5 w-3.5" />
                {replyMutation.isPending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative mt-3 flex gap-2">
            <Button
              size="sm"
              className="h-8 flex-1 px-3 text-xs"
              disabled={acknowledge.isPending}
              onClick={() => acknowledge.mutate(current.id)}
            >
              <Check className="h-3.5 w-3.5" /> Acknowledge
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 flex-1 px-3 text-xs"
              disabled={!current.sender_id}
              onClick={() => setReplying(true)}
            >
              <MessageSquare className="h-3.5 w-3.5" /> Message
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
