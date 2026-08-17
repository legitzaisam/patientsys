import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => ({
    meta: [
      { title: "Team & access — Aetheria" },
      {
        name: "description",
        content: "Create practitioner accounts and control what each member of the clinic team can do.",
      },
      { property: "og:title", content: "Team & access — Aetheria" },
      { property: "og:description", content: "Manage practitioner accounts and permission levels." },
    ],
  }),
  component: TeamLayout,
});

function TeamLayout() {
  return <Outlet />;
}
