/**
 * Clinic-wide marketing and sales roll-up shared by live and demo
 * `getInsights` / `getPatientMetrics`. A thin adapter: the figures are
 * defined in `metrics/funnel`, `metrics/book` and `metrics/money`; this file
 * turns rows into their inputs and pence into pounds for the page.
 *
 * Not Retention (chase / recall) and not Performance (earnings / commission).
 */
import {
  INSIGHTS_SOURCES,
  SOURCE_LABEL,
  bookMetrics,
  buildVisits,
  byPatient,
  fromPence,
  funnelMetrics,
  isConsultation,
  isOnList,
  moneyLines,
  normalizeSource,
  sumLines,
  whatSold,
  type FunnelAppointment,
  type FunnelLead,
  type FunnelListRow,
  type FunnelPatient,
  type FunnelPerson,
  type InsightsSource,
  type MoneyAppointment,
  type MoneyOptions,
  type MsWindow,
} from "./metrics";

export { INSIGHTS_SOURCES, SOURCE_LABEL, isConsultation, normalizeSource, type InsightsSource };
export type InsightsPerson = FunnelPerson;
export type InsightsListRow = FunnelListRow;

type CatalogueRow = { id: string; name: string; category: string | null };
type AppointmentRow = FunnelAppointment & {
  id: string;
  practitioner_id?: string | null;
  price?: number | null;
  payment_status?: string | null;
};
type TreatmentRow = {
  id?: string;
  patient_id: string;
  name: string;
  price?: number | null;
  performed_at: string;
  catalogue_id?: string | null;
  appointment_id?: string | null;
  practitioner_id?: string | null;
  next_due_at?: string | null;
};
type ProductRow = { id: string; name: string; sku?: string | null };
type SaleRow = { product_id?: string | null; qty?: number | null; amount?: number | null; occurred_at: string };

function windowOf(from: string, to: string): MsWindow {
  return { fromMs: new Date(from).getTime(), toMs: new Date(to).getTime() };
}

/** Treatment lines performed in the window (up to now), for patients on the list, with their money. */
function periodLines(
  window: MsWindow,
  nowMs: number,
  patients: readonly { id: string; deleted_at?: string | null }[],
  treatments: readonly TreatmentRow[],
  appointments: readonly AppointmentRow[],
  money: MoneyOptions,
) {
  const off = new Set(patients.filter((p) => !isOnList(p)).map((p) => p.id));
  const end = Math.min(window.toMs, nowMs);
  const inside = treatments.filter((t) => {
    const ms = new Date(t.performed_at).getTime();
    return ms >= window.fromMs && ms <= end && !off.has(t.patient_id);
  });
  const byId = new Map<string, MoneyAppointment>(appointments.map((a) => [a.id, a as MoneyAppointment]));
  return moneyLines(inside, byId, money);
}

function visitsFor(nowMs: number, patients: readonly { id: string; deleted_at?: string | null }[], treatments: readonly TreatmentRow[], appointments: readonly AppointmentRow[]) {
  const excluded = new Set(patients.filter((p) => !isOnList(p)).map((p) => p.id));
  return byPatient(buildVisits({ treatments, appointments, nowMs, excluded }));
}

export function buildInsights(input: {
  from: string;
  to: string;
  now?: Date;
  patients: FunnelPatient[];
  appointments: AppointmentRow[];
  treatments: TreatmentRow[];
  catalogue: CatalogueRow[];
  leads: FunnelLead[];
  products: ProductRow[];
  sales: SaleRow[];
  money?: MoneyOptions;
}) {
  const nowMs = (input.now ?? new Date()).getTime();
  const window = windowOf(input.from, input.to);
  const visits = visitsFor(nowMs, input.patients, input.treatments, input.appointments);
  const result = funnelMetrics({
    window,
    nowMs,
    patients: input.patients,
    appointments: input.appointments,
    treatments: input.treatments,
    catalogue: input.catalogue,
    leads: input.leads,
    visitedPatientIds: new Set(visits.keys()),
  });
  const end = Math.min(window.toMs, nowMs);
  const sold = whatSold(
    periodLines(window, nowMs, input.patients, input.treatments, input.appointments, input.money ?? { depositPercent: 30 }),
    input.sales.filter((s) => {
      const ms = new Date(s.occurred_at).getTime();
      return ms >= window.fromMs && ms <= end;
    }),
    input.products,
  );
  return {
    funnel: result.funnel,
    monthly: result.series.map((p) => ({ key: p.key, label: p.label, signUps: p.signUps, firstBookings: p.booked, firstConsults: p.consulted })),
    sources: result.sources,
    waiting: result.waiting,
    consultedNoTreatment: result.consultedNoTreatment,
    bestsellers: {
      treatments: sold.treatments.slice(0, 8).map((t) => ({ name: t.name, count: t.count, revenue: fromPence(t.revenue) })),
      products: sold.products.map((p) => ({ ...p, revenue: fromPence(p.revenue) })),
    },
  };
}

export type InsightsResult = ReturnType<typeof buildInsights>;

export function portalProductsFor(input: {
  patientId: string;
  products: {
    id: string;
    name: string;
    sku?: string | null;
    price?: number | null;
    active?: boolean;
    featured_on_portal?: boolean;
    image_url?: string | null;
  }[];
  sales: { product_id?: string | null; patient_id?: string | null; occurred_at: string }[];
}) {
  const featured = input.products
    .filter((p) => p.active !== false && p.featured_on_portal)
    .map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku ?? null,
      price: Number(p.price ?? 0),
      imageUrl: p.image_url ?? null,
    }));
  const purchasedAt = new Map<string, string>();
  for (const sale of input.sales) {
    if (sale.patient_id !== input.patientId || !sale.product_id) continue;
    const prev = purchasedAt.get(sale.product_id);
    if (!prev || sale.occurred_at > prev) purchasedAt.set(sale.product_id, sale.occurred_at);
  }
  const purchased = input.products
    .filter((p) => purchasedAt.has(p.id))
    .map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku ?? null,
      price: Number(p.price ?? 0),
      imageUrl: p.image_url ?? null,
      purchasedAt: purchasedAt.get(p.id) ?? null,
    }));
  return { featured, purchased };
}

export type BookPatientRow = FunnelPatient | { id: string; status?: string | null; created_at: string; source?: string | null; deleted_at?: string | null };

/** List-quality and growth metrics for Insights → Patient base. Shared by live and demo. */
export function buildBookMetrics(input: {
  now?: Date;
  from: string;
  to: string;
  patients: { id: string; status?: string | null; created_at: string; source?: string | null; deleted_at?: string | null }[];
  treatments: TreatmentRow[];
  appointments: AppointmentRow[];
  money?: MoneyOptions;
}) {
  const nowMs = (input.now ?? new Date()).getTime();
  const window = windowOf(input.from, input.to);
  const visits = visitsFor(nowMs, input.patients, input.treatments, input.appointments);
  const earned = sumLines(periodLines(window, nowMs, input.patients, input.treatments, input.appointments, input.money ?? { depositPercent: 30 })).earned;
  const m = bookMetrics({ window, nowMs, patients: input.patients, visits, appointments: input.appointments, earnedInWindow: earned });
  return {
    ...m,
    quality: {
      ...m.quality,
      spendPerPatient: m.quality.spendPerPatient === null ? null : fromPence(m.quality.spendPerPatient),
      visitValue: m.quality.visitValue === null ? null : fromPence(m.quality.visitValue),
      earned: fromPence(m.quality.earned),
    },
  };
}

export type BookMetrics = ReturnType<typeof buildBookMetrics>;
