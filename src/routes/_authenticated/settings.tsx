import { createFileRoute } from "@tanstack/react-router";
import { useIdentity } from "@/lib/use-identity";
import { can } from "@/lib/permissions";
import { AppShell } from "@/components/app-shell";
import { TreatmentCatalogueSettings } from "@/components/treatment-catalogue-settings";
import { ClinicDetailsSettings } from "@/components/clinic-details-settings";
import { AccessControlSettings } from "@/components/access-control-settings";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Clinic settings — Aetheria" },
      {
        name: "description",
        content: "Manager settings for the clinic, including the colour used for each treatment in the diary.",
      },
      { property: "og:title", content: "Clinic settings — Aetheria" },
      { property: "og:description", content: "Customise treatment colours and clinic-wide preferences." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: identity } = useIdentity();
  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  const canEditClinic = can(identity, "settings.treatments");

  return (
    <AppShell identity={identity}>
      <div className="mb-6">
        <h1 className="page-title">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {identity.isManager
            ? "Clinic-wide preferences. Changes here apply to everyone on the team."
            : "Clinic preferences set by your manager."}
        </p>
      </div>
      <div className="space-y-6">
        <ClinicDetailsSettings canEdit={canEditClinic} />
        <TreatmentCatalogueSettings canEdit={canEditClinic} />
        {identity.isManager && <AccessControlSettings canEdit />}
      </div>
    </AppShell>
  );
}
