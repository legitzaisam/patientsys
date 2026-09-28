/**
 * Every headline number the clinic portal shows, computed once from plain
 * rows with the shared definitions. The consistency tests compare each page's
 * builder to this; the rendered-number e2e compares the DOM to it; the demo
 * `/api/demo/metrics` route serves it.
 */
import { offerResults, type OfferResultOffer } from "@/lib/offers/results";
import { planNearingEnd } from "@/lib/offers/stages";
import { planProgress } from "@/lib/portal/shape";
import {
  countDueStates,
  dueStates,
  upcomingBookingSet,
  visitsByPatient,
  type AppointmentLike,
  type PatientLike,
  type TreatmentLike,
} from "./definitions";
import {
  bookedAhead,
  moneyLines,
  moneyTotals,
  sumLines,
  type MoneyAppointment,
  type MoneyTreatment,
} from "./money";
import { bookMetrics } from "./book";
import { funnelMetrics, type FunnelLead } from "./funnel";
import { fromPence } from "./money";
import { inWindow, type MsWindow as Window } from "./period";
import { isConsultation, isOnList } from "./rules";
import { buildVisits, byPatient, composition, firstToSecond, seenInWindow } from "./visits";

export type SnapshotRows = {
  clinic: { deposit_percent?: number | null; deposit_lead_days?: number | null };
  patients: (PatientLike & {
    created_at?: string;
    deleted_at?: string | null;
    first_name?: string;
    last_name?: string;
    email?: string | null;
    source?: string | null;
  })[];
  /** Website leads, for the Insights funnel. */
  leads?: FunnelLead[];
  treatments: (TreatmentLike &
    MoneyTreatment & {
      id?: string;
      catalogue_id?: string | null;
      name?: string;
      performed_at: string;
    })[];
  appointments: (AppointmentLike &
    MoneyAppointment & {
      treatment_name?: string | null;
      catalogue_id?: string | null;
      created_at?: string | null;
    })[];
  catalogue: { id: string; category?: string | null; name?: string | null }[];
  plans: {
    id: string;
    patient_id: string;
    status: string;
    practitioner_id?: string | null;
    started_at?: string | null;
    duration_days?: number | null;
    total_sessions?: number | null;
  }[];
  milestones: { plan_id: string; kind?: string | null; status?: string | null }[];
  staff: { userId: string; commissionRate: number }[];
  /** Sent offers, for the results funnel per template (optional). */
  offers?: OfferResultOffer[];
};

export type MetricsSnapshot = ReturnType<typeof metricsSnapshot>;

const pounds = <T extends { earned: number; collected: number; outstanding: number }>(m: T) => ({
  ...m,
  earned: fromPence(m.earned),
  collected: fromPence(m.collected),
  outstanding: fromPence(m.outstanding),
});

export function metricsSnapshot(
  rows: SnapshotRows,
  opts: {
    nowMs: number;
    window: Window;
    practitionerId?: string | null;
    todayKey?: string;
    /** The patient portal's scope: their plan progress. */
    patientId?: string | null;
  },
) {
  const { nowMs, window } = opts;
  const scope = opts.practitionerId ?? null;

  // Scope: a practitioner's page covers the patients they have treated.
  // Deleted patients are off the list everywhere, money included.
  const excluded = new Set(rows.patients.filter((p) => !isOnList(p)).map((p) => p.id));
  const listed = <T extends { patient_id: string }>(r: T) => !excluded.has(r.patient_id);
  const scopedTreatments = rows.treatments.filter(
    (t) => listed(t) && (!scope || t.practitioner_id === scope),
  );
  const scopedPatientIds = scope ? new Set(scopedTreatments.map((t) => t.patient_id)) : null;
  const patients = rows.patients.filter(
    (p) => isOnList(p) && (scopedPatientIds ? scopedPatientIds.has(p.id) : true),
  );
  const appointments = rows.appointments.filter(
    (a) => listed(a) && (!scope || a.practitioner_id === scope),
  );

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
  // Patients list "No upcoming treatment": everyone whose state is not "booked".
  const noUpcomingBooking = [...states.values()].filter((s) => s !== "booked").length;

  // ---- Visits
  const visits = byPatient(buildVisits({ treatments: scopedTreatments, appointments, nowMs, excluded }));
  const seen = seenInWindow(visits, window);
  const mix = composition(seen, visits, window.toMs);
  const f2s = firstToSecond(visits, window, nowMs);

  // ---- Money (period)
  const apptById = new Map<string, MoneyAppointment>(rows.appointments.map((a) => [a.id, a]));
  const depositPercent = Number(rows.clinic.deposit_percent ?? 30);
  const periodTreatments = scopedTreatments.filter((t) => inWindow(t.performed_at, window));
  const money = moneyTotals(periodTreatments, apptById, { depositPercent });
  const ahead = bookedAhead(appointments, nowMs);
  const perPractitioner = Object.fromEntries(
    rows.staff.map((s) => {
      const mine = periodTreatments.filter((t) => t.practitioner_id === s.userId);
      const lines = sumLines(moneyLines(mine, apptById, { depositPercent }, () => s.commissionRate));
      return [
        s.userId,
        {
          ...pounds(moneyTotals(mine, apptById, { depositPercent })),
          share: {
            earned: fromPence(lines.earnedShare),
            collected: fromPence(lines.collectedShare),
            outstanding: fromPence(lines.outstandingShare),
            treatments: lines.treatments,
          },
          treatmentsCompleted: mine.length,
        },
      ];
    }),
  );

  // ---- Insights (clinic-wide reports: never scoped to a practitioner)
  const clinicVisits = byPatient(
    buildVisits({ treatments: rows.treatments, appointments: rows.appointments, nowMs, excluded }),
  );
  const bookPatients = rows.patients.map((p) => ({ ...p, created_at: p.created_at ?? "" }));
  const clinicBook = bookMetrics({
    window,
    nowMs,
    patients: bookPatients,
    visits: clinicVisits,
    appointments: rows.appointments.map((a) => ({ ...a, status: a.status ?? "booked" })),
    earnedInWindow: 0,
  });
  const clinicFunnel = rows.leads
    ? funnelMetrics({
        window,
        nowMs,
        patients: bookPatients.map((p) => ({
          ...p,
          first_name: p.first_name ?? "",
          last_name: p.last_name ?? "",
        })),
        appointments: rows.appointments.map((a) => ({ ...a, status: a.status ?? "booked" })),
        treatments: rows.treatments.map((t) => ({ ...t, name: t.name ?? "" })),
        catalogue: rows.catalogue,
        leads: rows.leads,
        visitedPatientIds: new Set(clinicVisits.keys()),
      }).funnel
    : null;

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
  const allVisits = visitsByPatient(rows.treatments.filter(listed));
  for (const p of rows.patients) {
    if (!isOnList(p)) continue;
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

  // A practitioner's dashboard counts the plans they lead (or that nobody leads).
  const activePlans = rows.plans.filter(
    (p) => p.status === "active" && (!scope || !p.practitioner_id || p.practitioner_id === scope),
  ).length;

  // ---- Offer results per template (sent → claimed → booked → £)
  const results = Object.fromEntries(
    offerResults(
      rows.offers ?? [],
      rows.appointments
        .filter((a) => a.created_at)
        .map((a) => ({ patient_id: a.patient_id, created_at: a.created_at!, status: a.status })),
      rows.treatments.map((t) => ({
        patient_id: t.patient_id,
        performed_at: t.performed_at,
        price: t.price ?? null,
      })),
    ),
  );

  // ---- Portal: the patient's active plan progress, as the record shows it.
  let portal: { planDone: number; planTotal: number } | null = null;
  if (opts.patientId) {
    const plan = (plansBy.get(opts.patientId) ?? []).find((pl) => pl.status === "active");
    if (plan) {
      const progress = planProgress(
        (milestonesBy.get(plan.id) ?? []).map((m, i) => ({
          id: `${plan.id}-${i}`,
          title: "",
          status: String(m.status ?? ""),
        })),
      );
      portal = { planDone: progress.done, planTotal: progress.total };
    }
  }

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
      noUpcomingBooking,
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
      book: clinicBook.totals,
      funnel: clinicFunnel,
      composition: mix,
      /** The whole book's never-treated count (outside the window), as Insights shows it. */
      neverTreated: clinicBook.composition.neverTreated,
      firstToSecond: f2s,
    },
    // Pounds at the edge, as the pages show them.
    performance: {
      ...pounds(money),
      bookedAhead: fromPence(ahead),
      perPractitioner,
    },
    offers: { stages, results },
    portal,
    dueStates: states,
  };
}
