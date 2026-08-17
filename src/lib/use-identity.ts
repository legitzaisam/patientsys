import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getMe } from "./clinic.functions";
import { useAuthSessionReady } from "./use-auth-session-ready";
import { DEMO_MODE } from "./demo/enabled";

export function useIdentity() {
  const sessionReady = useAuthSessionReady();
  const fetchMe = useServerFn(getMe);
  const queryClient = useQueryClient();

  // Role/permission changes made by a manager must reach an already open
  // session quickly, so identity is re-checked live rather than cached long.
  useEffect(() => {
    if (!sessionReady || DEMO_MODE) return;

    // React Strict Mode mounts effects twice in development. A unique topic
    // prevents the second mount from reusing a channel that is still being
    // removed asynchronously after the first mount.
    const channelName = `identity-access-${crypto.randomUUID()}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "role_permissions" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["me"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_roles" }, () => {
        void queryClient.invalidateQueries({ queryKey: ["me"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, sessionReady]);

  return useQuery({
    queryKey: ["me"],
    queryFn: () => fetchMe(),
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    refetchInterval: 30_000,
    enabled: sessionReady,
  });
}