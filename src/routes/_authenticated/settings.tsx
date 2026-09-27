import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useIdentity } from "@/lib/use-identity";
import { can } from "@/lib/permissions";
import { AppShell } from "@/components/app-shell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TreatmentCatalogueSettings } from "@/components/treatment-catalogue-settings";
import { ClinicDetailsSettings } from "@/components/clinic-details-settings";
import { RetailProductSettings } from "@/components/retail-product-settings";
import { PaymentsDepositsSettings } from "@/components/payments-deposits-settings";

type SettingsTab = "clinic" | "treatments" | "products" | "payments";
const TABS: { key: SettingsTab; label: string }[] = [
  { key: "clinic", label: "Clinic" },
  { key: "treatments", label: "Treatments" },
  { key: "products", label: "Products" },
  { key: "payments", label: "Payments and deposits" },
];

export const Route = createFileRoute("/_authenticated/settings")({
  validateSearch: (search: Record<string, unknown>): { tab?: SettingsTab } => {
    const tab = String(search?.["tab"] ?? "");
    return TABS.some((t) => t.key === tab) ? { tab: tab as SettingsTab } : {};
  },
  head: () => ({
    meta: [
      { title: "Clinic settings — Aetheria" },
      {
        name: "description",
        content:
          "Manager settings for the clinic, including the colour used for each treatment in the diary.",
      },
      { property: "og:title", content: "Clinic settings — Aetheria" },
      {
        property: "og:description",
        content: "Customise treatment colours and clinic-wide preferences.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { data: identity } = useIdentity();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!identity.isStaff) {
    return <div className="p-12 text-sm text-muted-foreground">Staff access only.</div>;
  }
  const canEditClinic = can(identity, "settings.treatments");
  const active: SettingsTab = tab ?? "clinic";

  return (
    <AppShell identity={identity}>
      <div className="mb-6">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">
          {identity.isManager
            ? "Clinic-wide preferences. Changes here apply to everyone on the team."
            : "Clinic preferences set by your manager."}
        </p>
      </div>
      {/* One section per tab so the page never becomes one long scroll. The tab lives in the URL. */}
      <Tabs
        value={active}
        onValueChange={(value) =>
          void navigate({
            to: "/settings",
            search: value === "clinic" ? {} : { tab: value as SettingsTab },
            replace: true,
          })
        }
      >
        <TabsList
          className="mb-6 h-auto max-w-full flex-wrap justify-start"
          data-qc="settings-tabs"
        >
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="clinic">
          <ClinicDetailsSettings canEdit={canEditClinic} />
        </TabsContent>
        <TabsContent value="treatments">
          <TreatmentCatalogueSettings canEdit={canEditClinic} />
        </TabsContent>
        <TabsContent value="products">
          <RetailProductSettings canEdit={canEditClinic} />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsDepositsSettings canEdit={canEditClinic} />
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
