/**
 * Visits. A visit is one attended appointment: several treatments recorded
 * against the same appointment are one visit. A treatment with no
 * appointment (a walk-in, or history imported without bookings) is its own
 * visit. No-shows and cancellations are never visits. Deleted patients have
 * no visits.
 *
 * Everything that counts visits (seen, once, two or more, first to second,
 * repeat rate, average visit value) reads these, never raw treatment rows.
 */
import { DAY_MS, type MsWindow } from "./period";
import { isAttended } from "./rules";

export const SECOND_VISIT_HORIZON_DAYS = 180;

export type VisitTreatment = {
  id?: string;
  patient_id: string;
  performed_at: string;
  appointment_id?: string | null;
  practitioner_id?: string | null;
  name?: string | null;
  price?: number | null;
  next_due_at?: string | null;
  catalogue_id?: string | null;
};

export type VisitAppointment = {
  id: string;
  patient_id: string;
  starts_at: string;
  status: string | null;
  practitioner_id?: string | null;
};

export type Visit<T extends VisitTreatment = VisitTreatment> = {
  /** The appointment id, or `t:<treatment id>` for a walk-in. */
  key: string;
  patient_id: string;
  /** When the visit happened: the appointment's start, or the walk-in treatment's time. */
  performed_at: string;
  practitioner_id: string | null;
  /** The latest due date among the visit's treatments. */
  next_due_at: string | null;
  treatments: T[];
};

/**
 * Every visit up to `nowMs`, oldest first. `excluded` holds patient ids that
 * are off the list (deleted), whose visits are dropped.
 */
export function buildVisits<T extends VisitTreatment>(input: {
  treatments: readonly T[];
  appointments: readonly VisitAppointment[];
  nowMs: number;
  excluded?: ReadonlySet<string>;
}): Visit<T>[] {
  const byKey = new Map<string, Visit<T>>();
  const skip = input.excluded ?? new Set<string>();
  for (const a of input.appointments) {
    if (!isAttended(a, input.nowMs) || skip.has(a.patient_id)) continue;
    byKey.set(a.id, {
      key: a.id,
      patient_id: a.patient_id,
      performed_at: a.starts_at,
      practitioner_id: a.practitioner_id ?? null,
      next_due_at: null,
      treatments: [],
    });
  }
  const knownAppointments = new Set(input.appointments.map((a) => a.id));
  for (const t of input.treatments) {
    if (skip.has(t.patient_id) || new Date(t.performed_at).getTime() > input.nowMs) continue;
    // A treatment on a booking that is not marked attended still happened: it
    // is a visit of its own under that booking's key.
    const key = t.appointment_id && knownAppointments.has(t.appointment_id) ? t.appointment_id : `t:${t.id ?? `${t.patient_id}@${t.performed_at}`}`;
    let visit = byKey.get(key);
    if (!visit) {
      visit = {
        key,
        patient_id: t.patient_id,
        performed_at: t.performed_at,
        practitioner_id: t.practitioner_id ?? null,
        next_due_at: null,
        treatments: [],
      };
      byKey.set(key, visit);
    }
    visit.treatments.push(t);
    if (t.next_due_at && (!visit.next_due_at || t.next_due_at > visit.next_due_at)) visit.next_due_at = t.next_due_at;
  }
  return [...byKey.values()].sort((a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime());
}

type Dated = { patient_id: string; performed_at: string };

/** Rows grouped by patient, each list oldest first. */
export function byPatient<T extends Dated>(rows: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const list = map.get(r.patient_id) ?? [];
    list.push(r);
    map.set(r.patient_id, list);
  }
  for (const list of map.values()) list.sort((a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime());
  return map;
}

/** Patients with at least one visit inside the window. */
export function seenInWindow(visits: Map<string, readonly Dated[]>, window: MsWindow): Set<string> {
  const out = new Set<string>();
  for (const [id, list] of visits) {
    if (
      list.some((v) => {
        const ms = new Date(v.performed_at).getTime();
        return ms >= window.fromMs && ms <= window.toMs;
      })
    )
      out.add(id);
  }
  return out;
}

/**
 * Visit-count mix over a population, counting visits up to `upToMs`: never
 * visited, exactly one visit, two or more. The three always add to the
 * population.
 */
export function composition(
  population: Iterable<string>,
  visits: Map<string, readonly Dated[]>,
  upToMs = Number.POSITIVE_INFINITY,
) {
  let never = 0;
  let once = 0;
  let twoPlus = 0;
  for (const id of population) {
    const n = (visits.get(id) ?? []).filter((v) => new Date(v.performed_at).getTime() <= upToMs).length;
    if (n === 0) never++;
    else if (n === 1) once++;
    else twoPlus++;
  }
  return { never, once, twoPlus, total: never + once + twoPlus };
}

/**
 * First-to-second. Cohort: patients whose first visit fell inside the window
 * and is at least `horizonDays` before now, so a second visit has had its
 * chance. Returned: those whose second visit came within `horizonDays` of
 * the first. `rate` is a whole percent, or null when the cohort is empty.
 * `pending` counts first visits in the window still younger than the horizon.
 */
export function firstToSecond(
  visits: Map<string, readonly Dated[]>,
  window: MsWindow,
  nowMs: number,
  horizonDays = SECOND_VISIT_HORIZON_DAYS,
) {
  const horizonMs = horizonDays * DAY_MS;
  let cohort = 0;
  let returned = 0;
  let pending = 0;
  let pendingReturned = 0;
  for (const list of visits.values()) {
    const first = list[0];
    if (!first) continue;
    const firstMs = new Date(first.performed_at).getTime();
    if (firstMs < window.fromMs || firstMs > window.toMs) continue;
    const second = list[1];
    const secondWithin = second ? new Date(second.performed_at).getTime() - firstMs <= horizonMs : false;
    if (nowMs - firstMs < horizonMs) {
      pending += 1;
      if (secondWithin) pendingReturned += 1;
      continue;
    }
    cohort += 1;
    if (secondWithin) returned += 1;
  }
  return {
    cohort,
    returned,
    rate: cohort ? Math.round((returned / cohort) * 100) : null,
    pending,
    pendingReturned,
    horizonDays,
  };
}

/**
 * Repeat rate over a span: of patients with a visit in (fromMs, toMs], the
 * share with two or more visits in it. Retention's headline reads the 12
 * calendar months to the window end.
 */
export function repeatRate(visits: Map<string, readonly Dated[]>, fromMs: number, toMs: number) {
  let active = 0;
  let returning = 0;
  for (const list of visits.values()) {
    const n = list.filter((v) => {
      const ms = new Date(v.performed_at).getTime();
      return ms >= fromMs && ms <= toMs;
    }).length;
    if (n) active += 1;
    if (n > 1) returning += 1;
  }
  return { rate: active ? Math.round((returning / active) * 100) : 0, active, returning };
}
