import { createFileRoute } from "@tanstack/react-router";
import { markCommunicationByProviderId, verifyResendSignature } from "@/lib/comms/webhooks.server";

export const Route = createFileRoute("/api/comms/webhooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RESEND_WEBHOOK_SECRET"]?.trim();
        if (!secret) return Response.json({ error: "Webhook secret is not configured" }, { status: 401 });

        const payload = await request.text();
        const ok = verifyResendSignature({
          payload,
          svixId: request.headers.get("svix-id") ?? "",
          svixTimestamp: request.headers.get("svix-timestamp") ?? "",
          svixSignature: request.headers.get("svix-signature") ?? "",
          secret,
        });
        if (!ok) return Response.json({ error: "Invalid signature" }, { status: 401 });

        const body = JSON.parse(payload) as { type?: string; data?: { email_id?: string } };
        const emailId = body.data?.email_id;
        if (!emailId) return Response.json({ ok: true, ignored: true });

        const event =
          body.type === "email.delivered"
            ? "sent"
            : body.type === "email.bounced" || body.type === "email.complained"
              ? "bounced"
              : null;
        if (!event) return Response.json({ ok: true, ignored: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await markCommunicationByProviderId(supabaseAdmin, emailId, event);
        return Response.json({ ok: true });
      },
    },
  },
});
