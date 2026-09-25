import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AccessCatalogueEditor } from "@/components/access-catalogue-editor";
import { AppShell } from "@/components/app-shell";
import { isAccessAdmin } from "@/lib/access-catalogue";
import { useIdentity } from "@/lib/use-identity";

export const Route = createFileRoute("/_authenticated/access")({
  head: () => ({
    meta: [
      { title: "Access — Aetheria" },
      { name: "description", content: "Choose what each role can see in the clinic and the patient portal." },
      { property: "og:title", content: "Access — Aetheria" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AccessPage,
});

function AccessPage() {
  const { data: identity } = useIdentity();
  const navigate = useNavigate();
  const allowed = isAccessAdmin(identity);

  useEffect(() => {
    if (identity && !allowed) navigate({ to: "/dashboard", replace: true });
  }, [allowed, identity, navigate]);

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!allowed) return null;

  return (
    <AppShell identity={identity}>
      <AccessCatalogueEditor />
    </AppShell>
  );
}
