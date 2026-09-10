import { createFileRoute } from "@tanstack/react-router";
import { markCommunicationByProviderId, verifyTwilioSignature } from "@/lib/comms/webhooks.server";

export const Route = createFileRoute("/api/comms/webhooks/twilio")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["TWILIO_AUTH_TOKEN"]?.trim();
        if (!token) return Response.json({ error: "Twilio is not configured" }, { status: 401 });

        const form = await request.formData();
        const params: Record<string, string> = {};
        form.forEach((value, key) => {
          if (typeof value === "string") params[key] = value;
        });

        const origin = process.env["APP_ORIGIN"]?.replace(/\/$/, "") || new URL(request.url).origin;
        const url = `${origin}/api/comms/webhooks/twilio`;
        const signature = request.headers.get("x-twilio-signature") ?? "";
        if (!verifyTwilioSignature({ url, params, signature, authToken: token })) {
          return Response.json({ error: "Invalid signature" }, { status: 401 });
        }

        const sid = params["MessageSid"] || params["SmsSid"];
        const status = (params["MessageStatus"] || params["SmsStatus"] || "").toLowerCase();
        if (!sid) return Response.json({ ok: true, ignored: true });

        const event =
          status === "delivered"
            ? "sent"
            : status === "undelivered"
              ? "bounced"
              : status === "failed"
                ? "failed"
                : null;
        if (!event) return Response.json({ ok: true, ignored: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await markCommunicationByProviderId(supabaseAdmin, sid, event, params["ErrorMessage"]);
        return Response.json({ ok: true });
      },
    },
  },
});
