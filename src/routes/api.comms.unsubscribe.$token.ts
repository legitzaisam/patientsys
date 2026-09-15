import { createFileRoute } from "@tanstack/react-router";
import { DEMO_MODE } from "@/lib/demo/enabled";

/**
 * One-click unsubscribe target from email footers. POST-only so a mail
 * scanner prefetching the link cannot silently opt a patient out; the /u
 * page makes the confirming click. Applies the PECR stance: marketing and
 * reminders stop, transactional service messages continue.
 */
export const Route = createFileRoute("/api/comms/unsubscribe/$token")({
  server: {
    handlers: {
      POST: async ({ params }) => {
        const { verifyUnsubscribeToken } = await import("@/lib/comms/unsubscribe.server");
        const patientId = verifyUnsubscribeToken(params.token ?? "");
        if (!patientId) return Response.json({ error: "not_found" }, { status: 404 });

        const patch = {
          marketing_opt_in: false,
          reminders_opt_in: false,
          unsubscribed_at: new Date().toISOString(),
        };

        if (DEMO_MODE) {
          const { db } = await import("@/lib/demo/data");
          const patient = (db.patients as Record<string, unknown>[]).find(
            (p) => p["id"] === patientId,
          );
          if (!patient) return Response.json({ error: "not_found" }, { status: 404 });
          Object.assign(patient, patch);
          return Response.json({ ok: true });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("patients").update(patch).eq("id", patientId);
        if (error) return Response.json({ error: "not_found" }, { status: 404 });
        return Response.json({ ok: true });
      },
    },
  },
});
