/**
 * Every headline number the clinic portal shows, computed once from plain
 * rows with the shared definitions. The consistency tests compare each page's
 * builder to this; the rendered-number e2e compares the DOM to it; the demo
 * `/api/demo/metrics` route serves it.
 */
import { isConsultation } from "@/lib/insights.server";
import { planNearingEnd } from "@/lib/offers/stages";
import {
  composition,
  countDueStates,
  dueStates,
  firstToSecond,
  seenInWindow,
  upcomingBookingSet,
  visitsByPatient,
  type AppointmentLike,
  type PatientLike,
  type TreatmentLike,
  type Window,
} from "./definitions";
import {
  bookedAhead,
  inPeriod,
  moneyTotals,
  shareTotals,
  type MoneyAppointment,
  type MoneyTreatment,
} from "./money";

export type SnapshotRows = {
  clinic: { deposit_percent?: number | null; deposit_lead_days?: number | null };
  patients: (PatientLike & { created_at?: string })[];
  treatments: (TreatmentLike &
    MoneyTreatment & {
      id?: string;
      catalogue_id?: string | null;
      name?: string;
      performed_at: string;
    })[];
  appointments: (AppointmentLike &
    MoneyAppointment & { treatment_name?: string | null; catalogue_id?: string | null })[];
  catalogue: { id: string; category?: string | null; name?: string | null }[];
  plans: {
    id: string;
    patient_id: string;
    status: string;
    started_at?: string | null;
    duration_days?: number | null;
    total_sessions?: number | null;
  }[];
  milestones: { plan_id: string; kind?: string | null; status?: string | null }[];
  staff: { userId: string; commissionRate: number }[];
};

export type MetricsSnapshot = ReturnType<typeof metricsSnapshot>;

export function metricsSnapshot(
  rows: SnapshotRows,
  opts: { nowMs: number; window: Window; practitionerId?: string | null; todayKey?: string },
) {
  const { nowMs, window } = opts;
  const scope = opts.practitionerId ?? null;

  // Scope: a practitioner's page covers the patients they have treated.
  const scopedTreatments = scope
    ? rows.treatments.filter((t) => t.practitioner_id === scope)
    : rows.treatments;
  const scopedPatientIds = scope ? new Set(scopedTreatments.map((t) => t.patient_id)) : null;
  const patients = rows.patients.filter((p) =>
    scopedPatientIds ? scopedPatientIds.has(p.id) : true,
  );
  const appointments = scope
    ? rows.appointments.filter((a) => a.practitioner_id === scope)
    : rows.appointments;

  // ---- Due states (dashboard, retention, patients list)
  const states = dueStates({
    patients,
    treatments: scopedTreatments,
    appointments,
    nowMs,
    ...(opts.todayKey ? { todayKey: opts.todayKey } : {}),
  });
  const due = countDueStates(states);
  const active = patients.filter((p) => p.status === "active").length;

  // ---- Visits
  const visits = visitsByPatient(scopedTreatments);
  const seen = seenInWindow(visits, window);
  const mix = composition(seen, visits, window.toMs);
  const f2s = firstToSecond(visits, window, nowMs);

  // ---- Money (period)
  const apptById = new Map<string, MoneyAppointment>(rows.appointments.map((a) => [a.id, a]));
  const depositPercent = Number(rows.clinic.deposit_percent ?? 30);
  const periodTreatments = scopedTreatments.filter((t) =>
    inPeriod(t.performed_at, window.fromMs, window.toMs),
  );
  const money = moneyTotals(periodTreatments, apptById, { depositPercent });
  const ahead = bookedAhead(appointments, nowMs);
  const perPractitioner = Object.fromEntries(
    rows.staff.map((s) => {
      const mine = periodTreatments.filter((t) => t.practitioner_id === s.userId);
      return [
        s.userId,
        {
          ...moneyTotals(mine, apptById, { depositPercent }),
          share: shareTotals(mine, apptById, s.commissionRate, { depositPercent }),
          treatmentsCompleted: mine.length,
        },
      ];
    }),
  );

  // ---- Offer stages (the four stage cards)
  const catalogueById = new Map(rows.catalogue.map((c) => [c.id, c]));
  const consult = (name: string | null | undefined, catalogueId: string | null | undefined) =>
    isConsultation({
      name: name ?? null,
      category: catalogueId ? (catalogueById.get(catalogueId)?.category ?? null) : null,
    });
  const upcoming = upcomingBookingSet(rows.appointments, nowMs);
  const plansBy = new Map<string, SnapshotRows["plans"]>();
  for (const p of rows.plans) plansBy.set(p.patient_id, [...(plansBy.get(p.patient_id) ?? []), p]);
  const milestonesBy = new Map<string, SnapshotRows["milestones"]>();
  for (const m of rows.milestones)
    milestonesBy.set(m.plan_id, [...(milestonesBy.get(m.plan_id) ?? []), m]);
  const stages = { pre_consultation: 0, post_consultation: 0, single_treatment: 0, plan_ending: 0 };
  const allVisits = visitsByPatient(rows.treatments);
  for (const p of rows.patients) {
    if (p.status === "archived") continue;
    const tx = allVisits.get(p.id) ?? [];
    const activePlan = (plansBy.get(p.id) ?? []).find((pl) => pl.status === "active");
    if (activePlan) {
      const sessionsDone = (milestonesBy.get(activePlan.id) ?? []).filter(
        (m) => m.kind === "session" && (m.status === "done" || m.status === "skipped"),
      ).length;
      if (
        planNearingEnd(
          {
            startedAt: activePlan.started_at ?? p.created_at ?? new Date(nowMs).toISOString(),
            durationDays: activePlan.duration_days ?? null,
            sessionsTotal: activePlan.total_sessions ?? 0,
            sessionsDone,
          },
          new Date(nowMs),
        )
      )
        stages.plan_ending += 1;
      continue;
    }
    if (upcoming.has(p.id)) continue;
    const nonConsult = tx.filter((t) => !consult(t.name, t.catalogue_id));
    if (nonConsult.length >= 2) continue;
    if (nonConsult.length === 1) {
      stages.single_treatment += 1;
      continue;
    }
    const consultDates = [
      ...tx.filter((t) => consult(t.name, t.catalogue_id)).map((t) => t.performed_at),
      ...rows.appointments
        .filter(
          (a) =>
            a.patient_id === p.id &&
            a.status !== "cancelled" &&
            a.status !== "no_show" &&
            consult(a.treatment_name, a.catalogue_id),
        )
        .map((a) => a.starts_at),
    ].sort();
    if (consultDates[0]) {
      if (new Date(consultDates[0]).getTime() <= nowMs) stages.post_consultation += 1;
      continue;
    }
    stages.pre_consultation += 1;
  }

  const activePlans = rows.plans.filter((p) => p.status === "active").length;

  return {
    nowMs,
    window,
    scope,
    dashboard: {
      totalClients: patients.length,
      activeClients: active,
      inactiveClients: patients.length - active,
      treatmentsDue: due.treatmentsDue,
      treatmentsOverdue: due.overdue,
      treatmentsDueSoon: due.due_soon,
      toChase: due.toChase,
      activePlans,
    },
    retention: {
      overdue: due.overdue,
      dueSoon: due.due_soon,
      lapsing: due.lapsing,
      lost: due.lost,
      atRisk: due.toChase,
      seenInWindow: seen.size,
      oneVisitOnly: mix.once,
      repeat: mix.twoPlus,
      firstToSecond: f2s,
    },
    insights: {
      composition: mix,
      firstToSecond: f2s,
    },
    performance: {
      ...money,
      bookedAhead: ahead,
      perPractitioner,
    },
    offers: { stages },
    dueStates: states,
  };
}
