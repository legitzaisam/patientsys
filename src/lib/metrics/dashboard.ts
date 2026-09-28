/**
 * Dashboard KPI figures, shared by the live and demo `getDashboard`.
 *
 * - Total clients: patients on the list (not deleted); Active / Inactive
 *   split it by status. A practitioner's "Your clients" is everyone they
 *   have treated or hold a booking (not cancelled) for.
 * - Clients change: the book now vs at the end of last month.
 * - Revenue this month: earned (money.ts) in the London calendar month so
 *   far, the same figure Performance shows for "1 month". The change chip
 *   compares it with the whole of last month.
 * - New patients change: records created this month vs last month.
 */
import { calendarMonthsWindow } from "./period";
import { isBooked, isOnList, isActivePatient } from "./rules";
import { fromPence, moneyTotals, type MoneyAppointment, type MoneyOptions, type MoneyTreatment } from "./money";

export function percentChange(current: number, previous: number): number {
  return previous ? Math.round(((current - previous) / previous) * 100) : 0;
}

export function dashboardKpis(input: {
  nowMs: number;
  patients: readonly { id: string; status?: string | null; created_at: string; deleted_at?: string | null }[];
  /** Treatments from at least the start of last month, already scoped to the practitioner if any. */
  treatments: readonly MoneyTreatment[];
  appointmentsById: ReadonlyMap<string, MoneyAppointment>;
  money: MoneyOptions;
  /** A practitioner's own book; null for the clinic view. */
  ownBook: null | {
    treatments: readonly { patient_id: string; performed_at: string }[];
    appointments: readonly { patient_id: string; starts_at: string; status?: string | null }[];
  };
}) {
  const thisMonth = calendarMonthsWindow(input.nowMs, 1);
  const lastMonth = calendarMonthsWindow(input.nowMs, 1, 1);
  const listed = input.patients.filter(isOnList);
  const active = listed.filter(isActivePatient).length;

  let ownClients: number | null = null;
  let ownClientsPrev = 0;
  if (input.ownBook) {
    const firstSeen = new Map<string, number>();
    const note = (id: string, iso: string) => firstSeen.set(id, Math.min(firstSeen.get(id) ?? Infinity, new Date(iso).getTime()));
    const listedIds = new Set(listed.map((p) => p.id));
    for (const t of input.ownBook.treatments) if (listedIds.has(t.patient_id)) note(t.patient_id, t.performed_at);
    for (const a of input.ownBook.appointments) if (listedIds.has(a.patient_id) && isBooked(a)) note(a.patient_id, a.starts_at);
    ownClients = firstSeen.size;
    ownClientsPrev = [...firstSeen.values()].filter((ms) => ms < thisMonth.fromMs).length;
  }
  const clinicPrev = listed.filter((p) => new Date(p.created_at).getTime() < thisMonth.fromMs).length;
  const clientsNow = ownClients ?? listed.length;
  const clientsPrev = ownClients === null ? clinicPrev : ownClientsPrev;

  const listedIds = new Set(listed.map((p) => p.id));
  const between = (fromMs: number, toMs: number) =>
    input.treatments.filter((t) => {
      const ms = new Date(t.performed_at).getTime();
      return ms >= fromMs && ms <= toMs && (!t.patient_id || listedIds.has(t.patient_id));
    });
  const month = moneyTotals(between(thisMonth.fromMs, input.nowMs), input.appointmentsById, input.money);
  const previous = moneyTotals(between(lastMonth.fromMs, lastMonth.toMs), input.appointmentsById, input.money);

  const created = (fromMs: number, toMs: number) =>
    listed.filter((p) => {
      const ms = new Date(p.created_at).getTime();
      return ms >= fromMs && ms <= toMs;
    }).length;

  return {
    totalClients: listed.length,
    ownClients,
    clientsChange: percentChange(clientsNow, clientsPrev),
    activeClients: active,
    inactiveClients: listed.length - active,
    revenueMonth: fromPence(month.earned),
    treatmentsMonth: month.treatments,
    revenueChange: percentChange(month.earned, previous.earned),
    patientChange: percentChange(created(thisMonth.fromMs, input.nowMs), created(lastMonth.fromMs, lastMonth.toMs)),
  };
}
