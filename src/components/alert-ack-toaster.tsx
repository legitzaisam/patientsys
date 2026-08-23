import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { listSentStaffAlerts } from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { useAuthSessionReady } from "@/lib/use-auth-session-ready";

const PEER_KINDS = new Set(["urgent", "staff_message"]);

/**
 * Live “they acknowledged your alert” toast for the sender.
 * Does not write to the notification bell — toast + Sent list only.
 */
export function AlertAckToaster() {
  const { data: identity } = useIdentity();
  const sessionReady = useAuthSessionReady();
  const queryClient = useQueryClient();
  const fetchSent = useServerFn(listSentStaffAlerts);
  const seenAckIds = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  const userId = identity?.userId;
  const enabled = Boolean(identity?.isStaff && sessionReady && userId);

  const { data: sent } = useQuery({
    queryKey: ["sent-staff-alerts"],
    queryFn: () => fetchSent(),
    enabled: enabled && DEMO_MODE,
    refetchInterval: DEMO_MODE ? 5_000 : false,
  });

  // Seed known acknowledged ids so we only toast on newly seen acks.
  useEffect(() => {
    if (!enabled || !DEMO_MODE || !sent || primed.current) return;
    for (const row of sent) {
      if (row.read_at) seenAckIds.current.add(row.id);
    }
    primed.current = true;
  }, [enabled, sent]);

  // Demo: poll sent list and toast when read_at appears.
  useEffect(() => {
    if (!enabled || !DEMO_MODE || !sent || !primed.current) return;
    for (const row of sent) {
      if (!row.read_at || seenAckIds.current.has(row.id)) continue;
      if (!PEER_KINDS.has(row.kind)) continue;
      seenAckIds.current.add(row.id);
      toast.message(`${row.recipient_name} acknowledged your alert`, {
        description: row.title.slice(0, 120),
      });
      void queryClient.invalidateQueries({ queryKey: ["sent-staff-alerts"] });
    }
  }, [enabled, sent, queryClient]);

  // Live: realtime UPDATE on rows the signed-in user sent.
  useEffect(() => {
    if (!enabled || DEMO_MODE || !userId) return;

    const channel = supabase
      .channel(`staff-alert-acks:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "staff_notifications",
          filter: `sender_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            kind?: string;
            title?: string;
            read_at?: string | null;
            recipient_id?: string;
          };
          if (!row.read_at || seenAckIds.current.has(row.id)) return;
          if (!PEER_KINDS.has(row.kind ?? "")) return;
          seenAckIds.current.add(row.id);

          const recipientId = row.recipient_id;
          void (async () => {
            let name = "A teammate";
            if (recipientId) {
              const { data: profile } = await supabase
                .from("profiles")
                .select("full_name")
                .eq("id", recipientId)
                .maybeSingle();
              if (profile?.full_name) name = profile.full_name;
            }
            toast.message(`${name} acknowledged your alert`, {
              description: (row.title ?? "Alert").slice(0, 120),
            });
            void queryClient.invalidateQueries({ queryKey: ["sent-staff-alerts"] });
          })();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, userId, queryClient]);

  return null;
}
