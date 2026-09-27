import { createFileRoute } from "@tanstack/react-router";
import { DEMO_MODE } from "@/lib/demo/enabled";

/**
 * Demo only: the metrics snapshot over the in-memory fixture, computed with
 * the server's clock and the same trailing-12-month window the pages open
 * on. `e2e/metrics/rendered.spec.ts` compares every `data-qc="metric:*"`
 * number on the pages to this. Not registered outside demo mode.
 *
 *   GET /api/demo/metrics?practitioner=<userId>&patient=<patientId>|patientUser=<userId>
 */
export const Route = createFileRoute("/api/demo/metrics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!DEMO_MODE) return Response.json({ error: "Not found" }, { status: 404 });
        const { demoSnapshotRows } = await import("@/lib/metrics/demo-rows");
        const { metricsSnapshot } = await import("@/lib/metrics/snapshot");
        const { trailingMonthsWindow } = await import("@/lib/metrics/windows");
        const url = new URL(request.url);
        const nowMs = Date.now();
        // The portal persona is a user; find their patient record.
        let patientId = url.searchParams.get("patient");
        const patientUser = url.searchParams.get("patientUser");
        if (!patientId && patientUser) {
          const { db } = await import("@/lib/demo/data");
          patientId =
            (db.patients.find((p) => p["user_id"] === patientUser)?.["id"] as string | undefined) ??
            null;
        }
        const { dueStates: _states, ...snapshot } = metricsSnapshot(demoSnapshotRows(), {
          nowMs,
          window: trailingMonthsWindow(nowMs, 12),
          practitionerId: url.searchParams.get("practitioner"),
          patientId,
        });
        return Response.json({ ...snapshot, now: new Date(nowMs).toISOString() });
      },
    },
  },
});
