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

/** Unread-message alerts: live badge, dropdown and toast for new incoming messages. */
export function NotificationBell({ isStaff, scrolled = false }: { isStaff: boolean; scrolled?: boolean }) {
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
    refetchInterval: 60_000,
    enabled: isStaff && sessionReady,
  });
  const seen = useRef<Set<string>>(new Set());
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
    // Any insert can be a clinic-wide booking notice; peer alerts are filtered on fetch.
    const channel = supabase
      .channel("staff-notification-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "staff_notifications" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isStaff, queryClient]);

  const alertList = isStaff ? (alerts ?? []).filter((a) => !pressedNonUrgent.has(a.id)) : [];
  const total = (data?.total ?? 0) + alertList.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={scrolled ? "outline" : "ghost"}
          size="icon"
          className={`relative hover:border-edge-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground hover:shadow-lift active:bg-[rgba(47,63,102,0.14)] ${
            scrolled ? "" : "border border-transparent"
          }`}
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
          <p className="text-xs text-muted-foreground">Bookings and unread messages</p>
        </div>
        <ul className="max-h-80 divide-y divide-glass-line overflow-y-auto">
          {alertList.map((alert) => (
            <li key={alert.id}>
              <div className="flex items-start gap-1 pr-2 hover:bg-glass-2">
              <button
                type="button"
                className="flex-1 px-4 py-3 text-left"
                onClick={async () => {
                  if (!alert.urgent) setPressedNonUrgent((prev) => new Set(prev).add(alert.id));
                  await markAlertRead({ data: { id: alert.id } });
                  queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
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
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${alert.urgent ? "font-medium text-destructive" : "text-foreground"}`}>
                    {alert.title}
                  </span>
                  <span className={`text-xs ${alert.urgent ? "text-destructive" : "text-destructive-ink"}`}>
                    {alert.urgent ? "Urgent" : "New"}
                  </span>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{alert.body}</p>
                {alert.sender_name && (
                  <p className="mt-1 text-2xs text-muted-foreground">{alert.sender_name}</p>
                )}
                {alert.sender_id && (
                  <p className="mt-1.5 text-2xs font-medium text-accent-ink">Message · open chat</p>
                )}
              </button>
              <div className="flex items-center gap-0.5 pt-3">
                {alert.sender_id && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-foreground hover:text-accent-ink"
                    aria-label={`Message ${alert.sender_name || "sender"}`}
                    title="Message"
                    onClick={async () => {
                      await markAlertRead({ data: { id: alert.id } });
                      queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
                      navigate({
                        to: "/team/$id",
                        params: { id: alert.sender_id! },
                        search: { chat: true },
                      });
                    }}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                  </Button>
                )}
                {canClear && alert.urgent && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-success hover:text-success"
                    aria-label="Mark as read and completed"
                    onClick={async () => {
                      await markAlertRead({ data: { id: alert.id } });
                      queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
                      toast.success("Marked as read and completed");
                    }}
                  >
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                )}
                {canClear && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  aria-label="Dismiss notification"
                  onClick={async () => {
                    await markAlertRead({ data: { id: alert.id } });
                    queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                )}
              </div>
              </div>
            </li>
          ))}
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
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{item.name}</span>
                  <span className="text-xs text-destructive-ink">{item.count}</span>
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
