import { createFileRoute } from "@tanstack/react-router";
import { commsDrainSecret } from "@/lib/comms/config.server";
import { drainDueCommunications } from "@/lib/comms/dispatch.server";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export const Route = createFileRoute("/api/comms/drain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = commsDrainSecret();
        const header = request.headers.get("authorization") ?? "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : "";
        if (!secret || token !== secret) return unauthorized();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const summary = await drainDueCommunications(supabaseAdmin as never);
        return Response.json(summary);
      },
    },
  },
});
