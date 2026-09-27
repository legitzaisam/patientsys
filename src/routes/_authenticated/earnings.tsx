import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/earnings")({
  head: () => ({
    meta: [
      { title: "My earnings — Aetheria" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: function EarningsRedirect() {
    return <Navigate to="/profile" replace />;
  },
});
