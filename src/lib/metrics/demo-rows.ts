/**
 * The demo fixture as the plain rows the metrics snapshot reads. Used by the
 * consistency tests, `check:metrics` and the demo-only `/api/demo/metrics`.
 */
import { db } from "@/lib/demo/data";
import type { SnapshotRows } from "./snapshot";

type Row = Record<string, unknown>;
const str = (v: unknown) => (v == null ? null : String(v));
const num = (v: unknown) => (v == null ? null : Number(v));

export function demoSnapshotRows(): SnapshotRows {
  const rows = db as unknown as Record<string, Row[] | Row>;
  const clinic = rows["clinic"] as Row;
  return {
    clinic: {
      deposit_percent: num(clinic["deposit_percent"]) ?? 30,
      deposit_lead_days: num(clinic["deposit_lead_days"]) ?? 3,
    },
    patients: (rows["patients"] as Row[]).map((p) => ({
      id: String(p["id"]),
      status: String(p["status"] ?? "active"),
      created_at: String(p["created_at"] ?? ""),
    })),
    treatments: (rows["treatments"] as Row[]).map((t) => ({
      id: String(t["id"]),
      patient_id: String(t["patient_id"]),
      practitioner_id: str(t["practitioner_id"]),
      name: String(t["name"] ?? ""),
      catalogue_id: str(t["catalogue_id"]),
      price: num(t["price"]),
      performed_at: String(t["performed_at"]),
      next_due_at: str(t["next_due_at"]),
      appointment_id: str(t["appointment_id"]),
      commission_rate_snapshot: num(t["commission_rate_snapshot"]),
    })),
    appointments: (rows["appointments"] as Row[]).map((a) => ({
      id: String(a["id"]),
      patient_id: String(a["patient_id"]),
      practitioner_id: str(a["practitioner_id"]),
      starts_at: String(a["starts_at"]),
      status: String(a["status"] ?? "booked"),
      payment_status: str(a["payment_status"]),
      price: num(a["price"]),
      treatment_name: str(a["treatment_name"]),
      catalogue_id: str(a["catalogue_id"]),
      created_at: str(a["created_at"]),
    })),
    catalogue: (rows["catalogue"] as Row[]).map((c) => ({
      id: String(c["id"]),
      category: str(c["category"]),
      name: str(c["name"]),
    })),
    plans: (rows["treatmentPlans"] as Row[]).map((p) => ({
      id: String(p["id"]),
      patient_id: String(p["patient_id"]),
      status: String(p["status"] ?? ""),
      practitioner_id: str(p["practitioner_id"]),
      started_at: str(p["started_at"]),
      duration_days: num(p["duration_days"]),
      total_sessions: num(p["total_sessions"]),
    })),
    milestones: (rows["planMilestones"] as Row[]).map((m) => ({
      plan_id: String(m["plan_id"]),
      kind: str(m["kind"]),
      status: str(m["status"]),
    })),
    staff: (rows["userRoles"] as Row[])
      .filter(
        (r) => r["role"] === "owner" || r["role"] === "practitioner" || r["role"] === "manager",
      )
      .map((r) => {
        const profile = (rows["profiles"] as Row[]).find((p) => p["id"] === r["user_id"]);
        return {
          userId: String(r["user_id"]),
          commissionRate: Number(profile?.["commission_rate"] ?? 0),
        };
      }),
    offers: (rows["patientOffers"] as Row[]).map((o) => ({
      template_id: str(o["template_id"]),
      patient_id: String(o["patient_id"]),
      status: String(o["status"] ?? "sent"),
      claimed_at: str(o["claimed_at"]),
      expires_at: str(o["expires_at"]),
    })),
  };
}
