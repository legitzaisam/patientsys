import { createFileRoute } from "@tanstack/react-router";
import { DEMO_MODE } from "@/lib/demo/enabled";

/**
 * Public consent-link API: GET resolves a document by its access token,
 * POST signs it. No session — possession of the token is the credential.
 * All failures are a uniform 404 (see access.server.ts); the one distinct
 * outcome is 409 "signed", so the page can say "already completed".
 */

function clientMeta(request: Request) {
  return {
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null,
    userAgent: request.headers.get("user-agent"),
  };
}

function respond(outcome: { outcome: string } & Record<string, unknown>) {
  if (outcome.outcome === "not_found") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (outcome.outcome === "signed") {
    return Response.json({ status: "signed" }, { status: 409 });
  }
  return Response.json(outcome);
}

export const Route = createFileRoute("/api/documents/access/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const token = params.token ?? "";
        if (DEMO_MODE) {
          const { resolveDocumentByTokenDemo } = await import("@/lib/documents/access.demo");
          return respond(await resolveDocumentByTokenDemo(token));
        }
        const { resolveDocumentByToken } = await import("@/lib/documents/access.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        return respond(await resolveDocumentByToken(supabaseAdmin, token, clientMeta(request)));
      },

      POST: async ({ request, params }) => {
        const token = params.token ?? "";
        const body = (await request.json().catch(() => ({}))) as { signed_name?: unknown };
        const signedName = typeof body.signed_name === "string" ? body.signed_name : "";

        if (DEMO_MODE) {
          const { signDocumentByTokenDemo } = await import("@/lib/documents/access.demo");
          return respond(await signDocumentByTokenDemo(token, signedName));
        }
        const { signDocumentByToken } = await import("@/lib/documents/access.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        return respond(
          await signDocumentByToken(supabaseAdmin, token, signedName, clientMeta(request)),
        );
      },
    },
  },
});
