import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getPortalRecords, getPatientMessages, markMessagesRead } from "@/lib/clinic.functions";
import { PatientChatThread, type PatientChatMessage } from "@/components/patient-chat-thread";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/my-record/messages")({
  component: PortalMessages,
});

function PortalMessages() {
  const queryClient = useQueryClient();
  const fetchRecords = useServerFn(getPortalRecords);
  const fetchMessages = useServerFn(getPatientMessages);
  const markRead = useServerFn(markMessagesRead);

  const { data: records } = useQuery({ queryKey: ["portal-records"], queryFn: () => fetchRecords() });
  const patientId = records?.patient?.id as string | undefined;

  const { data } = useQuery({
    queryKey: ["patient-messages", patientId],
    queryFn: () => fetchMessages({ data: { patient_id: patientId! } }),
    enabled: Boolean(patientId),
    refetchInterval: 20_000,
  });

  // Opening the page reads the thread, which clears the nav badge.
  useEffect(() => {
    if (!patientId) return;
    void markRead({ data: { patient_id: patientId } }).then(() => {
      void queryClient.invalidateQueries({ queryKey: ["unread-messages"] });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  return (
    <div data-qc="portal-messages">
      <div className="page-header">
        <div>
          <h1 className="page-title">Messages</h1>
          <p className="page-subtitle">Secure messages with your clinic. We usually reply within one working day.</p>
        </div>
      </div>

      <Card className="flex h-[calc(100dvh-16rem)] min-h-[420px] flex-col overflow-hidden rounded-[22px] p-0">
        {patientId ? (
          <PatientChatThread
            patientId={patientId}
            patientName="Your clinic"
            messages={(data?.messages ?? []) as PatientChatMessage[]}
            as="patient"
            onSent={() => {
              void queryClient.invalidateQueries({ queryKey: ["patient-messages", patientId] });
              void queryClient.invalidateQueries({ queryKey: ["portal-home"] });
            }}
          />
        ) : (
          <p className="p-6 text-sm text-muted-foreground">Loading your messages…</p>
        )}
      </Card>
    </div>
  );
}
