import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";

/** Keep dashboard + patient recall panels in sync when anyone updates a chase-up. */
export function useRecallTasksLiveSync(patientId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (DEMO_MODE) return;

    const channelName = patientId
      ? `recall-tasks-patient-${patientId}`
      : `recall-tasks-open-${crypto.randomUUID()}`;

    const filter = patientId ? { filter: `patient_id=eq.${patientId}` as const } : {};
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "recall_tasks", ...filter },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["recall-tasks"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [patientId, queryClient]);
}

export function invalidateRecallTasks(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: ["recall-tasks"] });
}
