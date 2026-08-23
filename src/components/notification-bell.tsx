import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Check, MessageSquare, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { getUnreadMessages, listStaffNotifications, markStaffNotificationRead } from "@/lib/clinic.functions";
import { can } from "@/lib/permissions";
import { useIdentity } from "@/lib/use-identity";
import { useAuthSessionReady } from "@/lib/use-auth-session-ready";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseStaffAlertTitle, formatTeamAlertToast } from "@/lib/staff-alert-title";
import { cn } from "@/lib/utils";
import { showChatQuickReplyToast } from "@/components/chat-quick-reply-toast";

const TEAM_KINDS = new Set(["urgent", "staff_message", "staff_chat"]);

function openTeamChat(
  navigate: ReturnType<typeof useNavigate>,
  senderId: string,
) {
  navigate({
    to: "/team/$id",
    params: { id: senderId },
    search: { chat: true },
  });
}

function showTeamAlertToast(opts: {
  id: string;
  senderId?: string | null;
  title: string;
  body?: string | null;
  kind?: string | null;
  urgent?: boolean | null;
  navigate: ReturnType<typeof useNavigate>;
}) {
  if (opts.senderId) {
    showChatQuickReplyToast({
      notificationId: opts.id,
      senderId: opts.senderId,
      title: opts.title,
      body: opts.body,
      kind: opts.kind,
      urgent: opts.urgent,
      onOpen: () => openTeamChat(opts.navigate, opts.senderId!),
    });
    return;
  }
  const copy = formatTeamAlertToast({
    title: opts.title,
    body: opts.body,
    kind: opts.kind,
    urgent: opts.urgent,
  });
  toast.message(copy.title, { description: copy.description });
}

/** Unread-message alerts: live badge, dropdown and toast for new incoming messages. */
export function NotificationBell({
  isStaff,
  chipClassName,
}: {
  isStaff: boolean;
  chipClassName?: string;
}) {
  const { data: identity } = useIdentity();
  const canClear = can(identity, "notifications.delete");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const sessionReady = useAuthSessionReady();
  const fetchUnread = useServerFn(getUnreadMessages);
  const fetchAlerts = useServerFn(listStaffNotifications);
  const markAlertRead = useServerFn(markStaffNotificationRead);
  const { data } = useQuery({
    queryKey: ["unread-messages"],
    queryFn: () => fetchUnread(),
    refetchInterval: 60_000,
    enabled: sessionReady,
  });
  const { data: alerts } = useQuery({
    queryKey: ["staff-notifications"],
    queryFn: () => fetchAlerts(),
    // Demo has no realtime fan-out across role switches; poll often so chat pings show up.
    refetchInterval: DEMO_MODE ? 4_000 : 60_000,
    enabled: isStaff && sessionReady,
  });
  const seen = useRef<Set<string>>(new Set());
  const seenStaffAlerts = useRef<Set<string>>(new Set());
  const staffAlertsPrimedFor = useRef<string | null>(null);
  const [pressedNonUrgent, setPressedNonUrgent] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (DEMO_MODE) return;
    const channel = supabase
      .channel("message-alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const row = payload.new as { id: string; author: string; body: string; patient_id: string };
        const incoming = isStaff ? row.author === "patient" : row.author === "staff";
        if (!incoming || seen.current.has(row.id)) return;
        seen.current.add(row.id);
        toast.message(isStaff ? "New patient message" : "New message from your clinic", {
          description: row.body.slice(0, 120),
          action: {
            label: "Open",
            onClick: () =>
              isStaff
                ? navigate({ to: "/patients/$id", params: { id: row.patient_id } })
                : navigate({ to: "/my-record" }),
          },
        });
        queryClient.invalidateQueries({ queryKey: ["unread-messages"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isStaff, navigate, queryClient]);

  useEffect(() => {
    if (!isStaff || DEMO_MODE) return;
    const channel = supabase
      .channel("staff-notification-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "staff_notifications" },
        (payload) => {
          const row = payload.new as {
            id: string;
            recipient_id?: string;
            sender_id?: string | null;
            title?: string;
            body?: string | null;
            kind?: string;
            urgent?: boolean | null;
          };
          queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
          queryClient.invalidateQueries({ queryKey: ["incoming-team-alerts"] });
          if (!row.id || seenStaffAlerts.current.has(row.id)) return;
          if (row.recipient_id && identity?.userId && row.recipient_id !== identity.userId) return;
          seenStaffAlerts.current.add(row.id);
          if (row.kind === "staff_chat" || row.kind === "staff_message" || row.kind === "urgent") {
            showTeamAlertToast({
              id: row.id,
              senderId: row.sender_id,
              title: row.title ?? "New team message",
              body: row.body,
              kind: row.kind,
              urgent: row.urgent,
              navigate,
            });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [identity?.userId, isStaff, navigate, queryClient]);

  const alertList = isStaff
    ? (alerts ?? []).filter((a) => !pressedNonUrgent.has(a.id) && !TEAM_KINDS.has(a.kind))
    : [];
  const total = (data?.total ?? 0) + alertList.length;

  // Demo: no realtime — toast when a new staff/chat alert appears in the polled list.
  useEffect(() => {
    if (!DEMO_MODE || !isStaff || !alerts || !identity?.userId) return;
    if (staffAlertsPrimedFor.current !== identity.userId) {
      seenStaffAlerts.current = new Set(alerts.map((a) => a.id));
      staffAlertsPrimedFor.current = identity.userId;
      return;
    }
    for (const alert of alerts) {
      if (seenStaffAlerts.current.has(alert.id)) continue;
      seenStaffAlerts.current.add(alert.id);
      if (alert.kind !== "staff_chat" && alert.kind !== "staff_message" && alert.kind !== "urgent") {
        continue;
      }
      showTeamAlertToast({
        id: alert.id,
        senderId: alert.sender_id,
        title: alert.title,
        body: alert.body,
        kind: alert.kind,
        urgent: alert.urgent,
        navigate,
      });
    }
  }, [alerts, identity?.userId, isStaff, navigate]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-9 w-9",
            chipClassName ?? "border border-transparent",
          )}
          aria-label={`Notifications${total ? `, ${total} unread` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {total > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-medium text-destructive-foreground">
              {total > 9 ? "9+" : total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl p-0">
        <div className="bg-glass-2 px-4 py-3">
          <p className="text-sm font-medium text-foreground">Notifications</p>
          <p className="text-xs text-muted-foreground">Bookings and patient messages</p>
        </div>
        <ul className="max-h-80 divide-y divide-glass-line overflow-y-auto">
          {alertList.map((alert) => {
            const { headline } = parseStaffAlertTitle(alert.title);
            return (
            <li key={alert.id}>
              <div className="px-4 py-3 hover:bg-glass-2">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={async () => {
                      if (!alert.urgent) setPressedNonUrgent((prev) => new Set(prev).add(alert.id));
                      await markAlertRead({ data: { id: alert.id } });
                      queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
                      queryClient.invalidateQueries({ queryKey: ["incoming-team-alerts"] });
                      queryClient.invalidateQueries({ queryKey: ["sent-staff-alerts"] });
                      queryClient.invalidateQueries({ queryKey: ["staff-chat"] });
                      if (alert.sender_id) {
                        navigate({
                          to: "/team/$id",
                          params: { id: alert.sender_id },
                          search: { chat: true },
                        });
                      } else if (alert.patient_id) {
                        navigate({ to: "/patients/$id", params: { id: alert.patient_id } });
                      } else if (alert.kind === "appointment") {
                        navigate({ to: "/schedule" });
                      }
                    }}
                  >
                    <p
                      className={`text-sm leading-5 ${
                        alert.urgent ? "font-medium text-destructive" : "font-medium text-foreground"
                      }`}
                    >
                      {headline}
                    </p>
                    
                    {alert.body ? (
                      <p className="mt-1.5 text-xs font-medium leading-snug text-foreground">
                        {alert.body}
                      </p>
                    ) : null}
                  </button>
                  <div className="flex h-5 shrink-0 items-center gap-2.5">
                    <span
                      className={`text-xs font-semibold leading-none ${
                        alert.urgent ? "text-destructive" : "text-accent-ink"
                      }`}
                    >
                      {alert.urgent ? "Urgent" : "New"}
                    </span>
                    {alert.sender_id && (
                      <button
                        type="button"
                        className="inline-flex text-foreground hover:text-accent-ink"
                        aria-label={`Message ${alert.sender_name || "sender"}`}
                        title="Message"
                        onClick={async () => {
                          await markAlertRead({ data: { id: alert.id } });
                          queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
                          queryClient.invalidateQueries({ queryKey: ["incoming-team-alerts"] });
                          queryClient.invalidateQueries({ queryKey: ["sent-staff-alerts"] });
                          queryClient.invalidateQueries({ queryKey: ["staff-chat"] });
                          navigate({
                            to: "/team/$id",
                            params: { id: alert.sender_id! },
                            search: { chat: true },
                          });
                        }}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </button>
                    )}
                    {canClear && alert.urgent && (
                      <button
                        type="button"
                        className="inline-flex text-success hover:text-success"
                        aria-label="Mark as read and completed"
                        onClick={async () => {
                          await markAlertRead({ data: { id: alert.id } });
                          queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
                          queryClient.invalidateQueries({ queryKey: ["incoming-team-alerts"] });
                          queryClient.invalidateQueries({ queryKey: ["sent-staff-alerts"] });
                          queryClient.invalidateQueries({ queryKey: ["staff-chat"] });
                          toast.success("Marked as read and completed");
                        }}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    )}
                    {canClear && (
                      <button
                        type="button"
                        className="inline-flex text-muted-foreground hover:text-destructive"
                        aria-label="Dismiss notification"
                        onClick={async () => {
                          await markAlertRead({ data: { id: alert.id } });
                          queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
                          queryClient.invalidateQueries({ queryKey: ["incoming-team-alerts"] });
                          queryClient.invalidateQueries({ queryKey: ["sent-staff-alerts"] });
                          queryClient.invalidateQueries({ queryKey: ["staff-chat"] });
                        }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
            );
          })}
          {(data?.items ?? []).map((item) => (
            <li key={item.patient_id}>
              <button
                type="button"
                className="w-full px-4 py-3 text-left hover:bg-glass-2"
                onClick={() =>
                  isStaff
                    ? navigate({ to: "/patients/$id", params: { id: item.patient_id } })
                    : navigate({ to: "/my-record" })
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{item.name}</span>
                  <span className="shrink-0 rounded-full bg-destructive-bg/70 px-2 py-0.5 text-2xs font-semibold text-destructive-ink">
                    {item.count}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.last}</p>
              </button>
            </li>
          ))}
          {total === 0 && <li className="px-4 py-6 text-sm text-muted-foreground">You're all caught up.</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
