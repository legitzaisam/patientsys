import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { PortalDock } from "@/components/portal/portal-dock";
import { useIdentity } from "@/lib/use-identity";

export const Route = createFileRoute("/_authenticated/my-record")({
  head: () => ({
    meta: [
      { title: "My care — Aetheria" },
      {
        name: "description",
        content:
          "Your skin plan, journal, routine and records, and secure messages with your clinic.",
      },
      { property: "og:title", content: "My care — Aetheria" },
      { property: "og:description", content: "Your skin plan, records and clinic messages." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PortalLayout,
});

/**
 * Shell for the whole patient portal. Every page under /my-record renders
 * inside this, so the sidebar, top bar and the two corner bubbles are mounted
 * once rather than per page.
 */
function PortalLayout() {
  const { data: identity } = useIdentity();

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;

  // Staff land here only by typing the URL; the layout gate sends them back.
  if (identity.isStaff) {
    return (
      <AppShell identity={identity}>
        <Card className="p-8">
          <h1 className="page-title">This is the patient portal</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Open a patient from the Patients list to see their record as staff.
          </p>
        </Card>
      </AppShell>
    );
  }

  if (!identity.patient) {
    return (
      <AppShell identity={identity}>
        <Card className="p-8">
          <h1 className="page-title">No record linked yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your clinic will link this account to your patient record. Please check back shortly.
          </p>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell identity={identity}>
      <Outlet />
      <PortalDock />
    </AppShell>
  );
}
