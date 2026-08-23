import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";

/**
 * Tracks which staff user IDs currently have the app open (Realtime Presence).
 * In demo mode, only the signed-in user is marked online.
 */
export function useStaffPresence(enabled: boolean, userId?: string | null) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!enabled || !userId) {
      setOnlineIds(new Set());
      return;
    }

    if (DEMO_MODE) {
      setOnlineIds(new Set([userId]));
      return;
    }

    const channel = supabase.channel("staff-online", {
      config: { presence: { key: userId } },
    });

    const sync = () => {
      const state = channel.presenceState<{ userId?: string }>();
      const next = new Set<string>();
      for (const [key, metas] of Object.entries(state)) {
        next.add(key);
        for (const meta of metas ?? []) {
          if (meta?.userId) next.add(meta.userId);
        }
      }
      setOnlineIds(next);
    };

    channel.on("presence", { event: "sync" }, sync);
    channel.on("presence", { event: "join" }, sync);
    channel.on("presence", { event: "leave" }, sync);

    channel.subscribe(async (status) => {
      if (status !== "SUBSCRIBED") return;
      await channel.track({ userId, at: Date.now() });
    });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, [enabled, userId]);

  return onlineIds;
}
