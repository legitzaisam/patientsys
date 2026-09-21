import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPortalRecords } from "@/lib/clinic.functions";
import { CommsPreferencesCard } from "@/components/comms/comms-preferences";
import { CommsLogCard } from "@/components/comms/comms-log";

export const Route = createFileRoute("/_authenticated/my-record/settings")({
  component: PortalSettings,
});

/**
 * Contact preferences and the delivery log, folded in from the old
 * single-page portal so nothing was lost when the portal became a subtree.
 */
function PortalSettings() {
  const queryClient = useQueryClient();
  const fetchRecords = useServerFn(getPortalRecords);
  const { data, isLoading } = useQuery({ queryKey: ["portal-records"], queryFn: () => fetchRecords() });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading your settings…</p>;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">No record linked yet.</p>;

  const p = data.patient as any;

  return (
    <div data-qc="portal-settings">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">How your clinic reaches you, and everything it has sent.</p>
        </div>
      </div>

      <div className="grid gap-3.5">
        <CommsPreferencesCard
          patientId={p.id}
          patient={p}
          as="patient"
          onSaved={() => {
            void queryClient.invalidateQueries({ queryKey: ["portal-records"] });
            void queryClient.invalidateQueries({ queryKey: ["communications", p.id] });
          }}
        />
        <CommsLogCard patientId={p.id} enabled />
      </div>
    </div>
  );
}
