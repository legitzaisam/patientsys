import { useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";

/**
 * Query keys that read from `tasks`: the Tasks page, its summary (sidebar
 * badge, dashboard card), the patient list's Tasks pills and drawer, the
 * record's tasks panel and the dashboard. Completing a task anywhere clears
 * it everywhere once these refetch.
 */
export const TASK_QUERY_KEYS: readonly (readonly string[])[] = [
  ["tasks"],
  ["tasks-summary"],
  ["patient-tasks"],
  ["patients"],
  ["dashboard"],
  ["recall-tasks"],
];

export function invalidateTaskQueries(queryClient: QueryClient) {
  return Promise.all(
    TASK_QUERY_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [...key] })),
  );
}

const DEMO_POLL_MS = 5_000;

/**
 * Keep every task surface in step. Production subscribes to `tasks` changes
 * through Supabase realtime; the demo has no realtime, so it polls the same
 * keys every few seconds while the surface is mounted.
 */
export function useTasksLiveSync(patientId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (DEMO_MODE) {
      const timer = window.setInterval(() => {
        if (document.visibilityState !== "visible") return;
        void queryClient.invalidateQueries({ queryKey: ["tasks"] });
        void queryClient.invalidateQueries({ queryKey: ["tasks-summary"] });
        if (patientId)
          void queryClient.invalidateQueries({ queryKey: ["patient-tasks", patientId] });
      }, DEMO_POLL_MS);
      return () => window.clearInterval(timer);
    }

    const channelName = patientId ? `tasks-patient-${patientId}` : `tasks-${crypto.randomUUID()}`;
    const filter = patientId ? { filter: `patient_id=eq.${patientId}` as const } : {};
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", ...filter }, () => {
        void invalidateTaskQueries(queryClient);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [patientId, queryClient]);
}
