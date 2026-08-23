import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";

/** Stable demo staff IDs — kept here so we don't pull the full demo dataset into this hook. */
const DEMO_STAFF_IDS = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
  "10000000-0000-4000-8000-000000000004",
] as const;

type Listener = (ids: Set<string>) => void;

const listeners = new Set<Listener>();
let sharedIds = new Set<string>();
let channel: RealtimeChannel | null = null;
let trackedUserId: string | null = null;

function publish(next: Set<string>) {
  sharedIds = next;
  for (const listener of listeners) listener(new Set(next));
}

function syncFromChannel(ch: RealtimeChannel) {
  const state = ch.presenceState<{ userId?: string }>();
  const next = new Set<string>();
  for (const [key, metas] of Object.entries(state)) {
    next.add(key);
    for (const meta of metas ?? []) {
      if (meta?.userId) next.add(meta.userId);
    }
  }
  publish(next);
}

function teardown() {
  if (!channel) return;
  const ch = channel;
  channel = null;
  trackedUserId = null;
  void ch.untrack();
  void supabase.removeChannel(ch);
}

function demoOnlineIds(selfId: string) {
  // Demo: you + clinic staff show online so presence rings are visible in the UI.
  return new Set<string>([selfId, ...DEMO_STAFF_IDS]);
}

/**
 * Tracks which staff user IDs currently have the app open (Realtime Presence).
 * Shared across the shell + chat so only one Presence channel is opened.
 */
export function useStaffPresence(enabled: boolean, userId?: string | null) {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(() => new Set(sharedIds));

  useEffect(() => {
    if (!enabled || !userId) {
      setOnlineIds(new Set());
      return;
    }

    const onChange: Listener = (ids) => setOnlineIds(ids);
    listeners.add(onChange);

    if (DEMO_MODE) {
      publish(demoOnlineIds(userId));
      return () => {
        listeners.delete(onChange);
        if (listeners.size === 0) publish(new Set());
      };
    }

    if (!channel || trackedUserId !== userId) {
      teardown();
      trackedUserId = userId;
      const ch = supabase.channel("staff-online", {
        config: { presence: { key: userId } },
      });
      channel = ch;
      ch.on("presence", { event: "sync" }, () => syncFromChannel(ch));
      ch.on("presence", { event: "join" }, () => syncFromChannel(ch));
      ch.on("presence", { event: "leave" }, () => syncFromChannel(ch));
      ch.subscribe(async (status) => {
        if (status !== "SUBSCRIBED" || channel !== ch) return;
        await ch.track({ userId, at: Date.now() });
      });
    } else {
      setOnlineIds(new Set(sharedIds));
    }

    return () => {
      listeners.delete(onChange);
      if (listeners.size === 0) teardown();
    };
  }, [enabled, userId]);

  return onlineIds;
}
