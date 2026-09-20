/**
 * Clinic-wide marketing and sales roll-up shared by live and demo `getInsights`.
 *
 * Not Retention (chase / recall) and not Performance (earnings / commission).
 * Consultation = catalogue category `Consultation` or a name matching /consult/i.
 */

export const INSIGHTS_SOURCES = ["website", "instagram", "referral", "walk_in", "other"] as const;
export type InsightsSource = (typeof INSIGHTS_SOURCES)[number];

export const SOURCE_LABEL: Record<InsightsSource, string> = {
  website: "Website",
  instagram: "Instagram",
  referral: "Referral",
  walk_in: "Walk-in",
  other: "Other",
};

export function isConsultation(input: { category?: string | null; name?: string | null }) {
  if ((input.category ?? "").trim().toLowerCase() === "consultation") return true;
  return /consult/i.test(input.name ?? "");
}

export function normalizeSource(value: string | null | undefined): InsightsSource {
  const key = (value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return (INSIGHTS_SOURCES as readonly string[]).includes(key) ? (key as InsightsSource) : "other";
}

export type InsightsPerson = {
  patientId: string | null;
  leadId: string | null;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  source: InsightsSource;
  interest: string | null;
  signedUpAt: string;
};

export type InsightsListRow = InsightsPerson & {
  daysWaiting?: number;
  lastConsultAt?: string;
};

export type InsightsResult = {
  funnel: {
    signUps: number;
    notBooked: number;
    bookedCount: number;
    consulted: number;
    converted: number;
    bookedRate: number;
    consultRate: number;
    convertRate: number;
  };
  monthly: { key: string; label: string; signUps: number; firstBookings: number; firstConsults: number }[];
  sources: { source: InsightsSource; label: string; count: number }[];
  waiting: InsightsListRow[];
  consultedNoTreatment: InsightsListRow[];
  bestsellers: {
    treatments: { name: string; count: number; revenue: number }[];
    products: { name: string; sku: string | null; units: number; revenue: number }[];
  };
};

type CatalogueRow = { id: string; name: string; category: string | null };
type PatientRow = {
  id: string;
  title?: string | null;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  source?: string | null;
  created_at: string;
};
type AppointmentRow = {
  patient_id: string;
  starts_at: string;
  status: string;
  treatment_name?: string | null;
  catalogue_id?: string | null;
};
type TreatmentRow = {
  patient_id: string;
  name: string;
  price?: number | null;
  performed_at: string;
  catalogue_id?: string | null;
};
type LeadRow = {
  id: string;
  patient_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  interest?: string | null;
  occurred_at: string;
};
type ProductRow = { id: string; name: string; sku?: string | null };
type SaleRow = {
  product_id?: string | null;
  qty?: number | null;
  amount?: number | null;
  occurred_at: string;
};

function inRange(iso: string | null | undefined, from: string, to: string) {
  if (!iso) return false;
  return iso >= from && iso <= to;
}

function isBookedStatus(status: string | null | undefined) {
  return status !== "cancelled";
}

type SeriesBucket = { key: string; label: string; start: string; end: string };

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function hourBuckets(from: Date, to: Date): SeriesBucket[] {
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate(), from.getHours(), 0, 0, 0);
  const buckets: SeriesBucket[] = [];
  while (cursor <= to) {
    const next = new Date(cursor);
    next.setHours(next.getHours() + 1);
    buckets.push({
      key: `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}T${pad(cursor.getHours())}`,
      label: cursor.toLocaleTimeString("en-GB", { hour: "2-digit" }),
      start: cursor.toISOString(),
      end: next.toISOString(),
    });
    cursor.setHours(cursor.getHours() + 1);
  }
  return buckets;
}

function dayBuckets(from: Date, to: Date): SeriesBucket[] {
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  const span = Math.round((last.getTime() - cursor.getTime()) / 86400000) + 1;
  const buckets: SeriesBucket[] = [];
  while (cursor <= last) {
    const next = new Date(cursor);
    next.setDate(next.getDate() + 1);
    buckets.push({
      key: `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}`,
      label:
        span <= 8
          ? cursor.toLocaleDateString("en-GB", { weekday: "short" })
          : String(cursor.getDate()),
      start: cursor.toISOString(),
      end: next.toISOString(),
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return buckets;
}

function weekBuckets(from: Date, to: Date): SeriesBucket[] {
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const weekday = cursor.getDay();
  cursor.setDate(cursor.getDate() - (weekday === 0 ? 6 : weekday - 1));
  const last = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  const buckets: SeriesBucket[] = [];
  while (cursor <= last) {
    const next = new Date(cursor);
    next.setDate(next.getDate() + 7);
    const weekEnd = new Date(next.getTime() - 1);
    const clipStart = cursor < from ? new Date(from) : new Date(cursor);
    const clipEnd = next > to ? new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1) : next;
    const sameMonth = clipStart.getMonth() === weekEnd.getMonth();
    buckets.push({
      key: `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(cursor.getDate())}w`,
      label: sameMonth
        ? `${clipStart.getDate()}–${weekEnd.getDate()}`
        : `${clipStart.getDate()} ${clipStart.toLocaleDateString("en-GB", { month: "short" })}`,
      start: clipStart.toISOString(),
      end: clipEnd.toISOString(),
    });
    cursor.setDate(cursor.getDate() + 7);
  }
  return buckets;
}

function monthBuckets(from: Date, to: Date): SeriesBucket[] {
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  const last = new Date(to.getFullYear(), to.getMonth(), 1);
  const buckets: SeriesBucket[] = [];
  while (cursor <= last) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    buckets.push({
      key: `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}`,
      label: cursor.toLocaleDateString("en-GB", { month: "short" }),
      start: cursor.toISOString(),
      end: next.toISOString(),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

/** Hour / day / month bars so Today, This week, This month and This year all chart cleanly. */
function seriesBuckets(from: string, to: string): SeriesBucket[] {
  const start = new Date(from);
  const end = new Date(to);
  const days = (end.getTime() - start.getTime()) / 86400000;
  if (days <= 1.5) return hourBuckets(start, end);
  if (days <= 10) return dayBuckets(start, end);
  if (days <= 45) return weekBuckets(start, end);
  return monthBuckets(start, end);
}

function displayName(first: string | null | undefined, last: string | null | undefined) {
  return { firstName: (first ?? "").trim() || "Lead", lastName: (last ?? "").trim() };
}

export function buildInsights(input: {
  from: string;
  to: string;
  now?: Date;
  patients: PatientRow[];
  appointments: AppointmentRow[];
  treatments: TreatmentRow[];
  catalogue: CatalogueRow[];
  leads: LeadRow[];
  products: ProductRow[];
  sales: SaleRow[];
}): InsightsResult {
  const now = input.now ?? new Date();
  const catalogueById = new Map(input.catalogue.map((c) => [c.id, c]));
  const patientById = new Map(input.patients.map((p) => [p.id, p]));
  const patientByEmail = new Map(
    input.patients
      .filter((p) => p.email)
      .map((p) => [p.email!.trim().toLowerCase(), p] as const),
  );

  const consultName = (name: string | null | undefined, catalogueId?: string | null) =>
    isConsultation({
      name,
      category: catalogueId ? catalogueById.get(catalogueId)?.category ?? null : null,
    });

  const appointmentsByPatient = new Map<string, AppointmentRow[]>();
  for (const row of input.appointments) {
    const list = appointmentsByPatient.get(row.patient_id) ?? [];
    list.push(row);
    appointmentsByPatient.set(row.patient_id, list);
  }
  const treatmentsByPatient = new Map<string, TreatmentRow[]>();
  for (const row of input.treatments) {
    const list = treatmentsByPatient.get(row.patient_id) ?? [];
    list.push(row);
    treatmentsByPatient.set(row.patient_id, list);
  }

  function firstBookingAt(patientId: string | null) {
    if (!patientId) return null;
    const booked = (appointmentsByPatient.get(patientId) ?? [])
      .filter((a) => isBookedStatus(a.status))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return booked[0]?.starts_at ?? null;
  }

  function firstConsultAt(patientId: string | null) {
    if (!patientId) return null;
    const fromTx = (treatmentsByPatient.get(patientId) ?? [])
      .filter((t) => consultName(t.name, t.catalogue_id))
      .map((t) => t.performed_at);
    const fromAppt = (appointmentsByPatient.get(patientId) ?? [])
      .filter((a) => isBookedStatus(a.status) && consultName(a.treatment_name, a.catalogue_id))
      .map((a) => a.starts_at);
    const all = [...fromTx, ...fromAppt].sort();
    return all[0] ?? null;
  }

  function hasNonConsultTreatment(patientId: string | null) {
    if (!patientId) return false;
    return (treatmentsByPatient.get(patientId) ?? []).some((t) => !consultName(t.name, t.catalogue_id));
  }

  function hasAnyAppointment(patientId: string | null) {
    if (!patientId) return false;
    return (appointmentsByPatient.get(patientId) ?? []).some((a) => isBookedStatus(a.status));
  }

  const people = new Map<string, InsightsPerson>();

  function remember(key: string, person: InsightsPerson) {
    const existing = people.get(key);
    if (!existing || person.signedUpAt < existing.signedUpAt) people.set(key, person);
  }

  for (const lead of input.leads) {
    if (!inRange(lead.occurred_at, input.from, input.to)) continue;
    const email = lead.email?.trim().toLowerCase() || null;
    const matched = (lead.patient_id && patientById.get(lead.patient_id)) || (email ? patientByEmail.get(email) : null);
    const key = matched?.id ?? (email ? `email:${email}` : `lead:${lead.id}`);
    const names = displayName(matched?.first_name ?? lead.first_name, matched?.last_name ?? lead.last_name);
    remember(key, {
      patientId: matched?.id ?? lead.patient_id ?? null,
      leadId: lead.id,
      firstName: names.firstName,
      lastName: names.lastName,
      title: matched?.title ?? null,
      email: matched?.email ?? lead.email ?? null,
      phone: matched?.phone ?? lead.phone ?? null,
      avatarUrl: matched?.avatar_url ?? null,
      source: normalizeSource(lead.source ?? matched?.source),
      interest: lead.interest ?? null,
      signedUpAt: lead.occurred_at,
    });
  }

  for (const patient of input.patients) {
    if (normalizeSource(patient.source) !== "website") continue;
    if (!inRange(patient.created_at, input.from, input.to)) continue;
    const email = patient.email?.trim().toLowerCase() || null;
    const key = patient.id;
    remember(key, {
      patientId: patient.id,
      leadId: null,
      firstName: patient.first_name,
      lastName: patient.last_name,
      title: patient.title ?? null,
      email: patient.email ?? null,
      phone: patient.phone ?? null,
      avatarUrl: patient.avatar_url ?? null,
      source: "website",
      interest: null,
      signedUpAt: patient.created_at,
    });
    if (email) {
      const alias = people.get(`email:${email}`);
      if (alias && alias.patientId !== patient.id) people.delete(`email:${email}`);
    }
  }

  const cohort = [...people.values()];
  let notBooked = 0;
  let consulted = 0;
  let converted = 0;
  const waiting: InsightsListRow[] = [];
  const consultedNoTreatment: InsightsListRow[] = [];

  for (const person of cohort) {
    const booked = hasAnyAppointment(person.patientId);
    const consultAt = firstConsultAt(person.patientId);
    const convertedPerson = hasNonConsultTreatment(person.patientId);
    if (!booked) {
      notBooked += 1;
      waiting.push({
        ...person,
        daysWaiting: Math.max(0, Math.floor((now.getTime() - new Date(person.signedUpAt).getTime()) / 86400000)),
      });
    }
    if (consultAt) consulted += 1;
    if (consultAt && convertedPerson) converted += 1;
    if (consultAt && !convertedPerson) {
      consultedNoTreatment.push({ ...person, lastConsultAt: consultAt });
    }
  }

  waiting.sort((a, b) => (b.daysWaiting ?? 0) - (a.daysWaiting ?? 0));
  consultedNoTreatment.sort((a, b) => (b.lastConsultAt ?? "").localeCompare(a.lastConsultAt ?? ""));

  const signUps = cohort.length;
  const bookedCount = signUps - notBooked;
  const buckets = seriesBuckets(input.from, input.to);
  const monthly = buckets.map((bucket) => {
    let signUpCount = 0;
    let firstBookings = 0;
    let firstConsults = 0;
    for (const person of cohort) {
      if (person.signedUpAt >= bucket.start && person.signedUpAt < bucket.end) signUpCount += 1;
      const bookingAt = firstBookingAt(person.patientId);
      if (bookingAt && bookingAt >= bucket.start && bookingAt < bucket.end) firstBookings += 1;
      const consultAt = firstConsultAt(person.patientId);
      if (consultAt && consultAt >= bucket.start && consultAt < bucket.end) firstConsults += 1;
    }
    return { key: bucket.key, label: bucket.label, signUps: signUpCount, firstBookings, firstConsults };
  });

  const sourceCounts = new Map<InsightsSource, number>();
  for (const source of INSIGHTS_SOURCES) sourceCounts.set(source, 0);
  for (const person of cohort) sourceCounts.set(person.source, (sourceCounts.get(person.source) ?? 0) + 1);
  const sources = INSIGHTS_SOURCES.map((source) => ({
    source,
    label: SOURCE_LABEL[source],
    count: sourceCounts.get(source) ?? 0,
  })).filter((row) => row.count > 0);

  const treatmentCounts = new Map<string, { count: number; revenue: number }>();
  for (const t of input.treatments) {
    if (!inRange(t.performed_at, input.from, input.to)) continue;
    const current = treatmentCounts.get(t.name) ?? { count: 0, revenue: 0 };
    current.count += 1;
    current.revenue += Number(t.price ?? 0);
    treatmentCounts.set(t.name, current);
  }
  const treatments = [...treatmentCounts.entries()]
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count)
    .slice(0, 8);

  const productById = new Map(input.products.map((p) => [p.id, p]));
  const productCounts = new Map<string, { name: string; sku: string | null; units: number; revenue: number }>();
  for (const sale of input.sales) {
    if (!inRange(sale.occurred_at, input.from, input.to)) continue;
    const product = sale.product_id ? productById.get(sale.product_id) : null;
    const key = product?.id ?? "unknown";
    const current = productCounts.get(key) ?? {
      name: product?.name ?? "Product",
      sku: product?.sku ?? null,
      units: 0,
      revenue: 0,
    };
    current.units += Number(sale.qty ?? 1);
    current.revenue += Number(sale.amount ?? 0);
    productCounts.set(key, current);
  }
  const products = [...productCounts.values()].sort((a, b) => b.revenue - a.revenue || b.units - a.units);

  return {
    funnel: {
      signUps,
      notBooked,
      bookedCount,
      consulted,
      converted,
      bookedRate: signUps ? bookedCount / signUps : 0,
      consultRate: bookedCount ? consulted / bookedCount : signUps ? consulted / signUps : 0,
      convertRate: consulted ? converted / consulted : 0,
    },
    monthly,
    sources,
    waiting: waiting.slice(0, 12),
    consultedNoTreatment: consultedNoTreatment.slice(0, 12),
    bestsellers: { treatments, products },
  };
}

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

const MS_DAY = 86_400_000;

export type BookPatientRow = {
  id: string;
  status?: string | null;
  created_at: string;
  source?: string | null;
  last_visit_at?: string | null;
};

export type BookTreatmentRow = {
  patient_id: string;
  name: string;
  price?: number | null;
  performed_at: string;
};

export type BookAppointmentRow = {
  patient_id: string;
  starts_at: string;
  status: string;
};

export type BookMetrics = {
  totals: {
    total: number;
    active: number;
    inactive: number;
    newThisMonth: number;
    dormant: number;
    dormantShare: number;
  };
  quality: {
    firstToSecond: number | null;
    firstToSecondCohort: number;
    rebooked: number | null;
    rebookedCohort: number;
    spendPerPatient: number | null;
    visitValue: number | null;
    treatedLast12m: number;
    treatmentsLast12m: number;
    revenueLast12m: number;
  };
  monthlyNew: { key: string; label: string; count: number }[];
  treatedMix: { firstTimers: number; returning: number };
  sources: { source: InsightsSource; label: string; count: number }[];
  composition: { neverTreated: number; treatedOnce: number; multiTreatment: number };
};

/** List-quality and growth metrics for Insights → Book. Shared by live and demo. */
export function buildBookMetrics(input: {
  now?: Date;
  patients: BookPatientRow[];
  treatments: BookTreatmentRow[];
  appointments: BookAppointmentRow[];
}): BookMetrics {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * MS_DAY).toISOString();
  const yearAgo = new Date(now.getTime() - 365 * MS_DAY).toISOString();

  const all = input.patients;
  const active = all.filter((p) => p.status === "active").length;
  const newThisMonth = all.filter((p) => p.created_at >= monthStart).length;

  const byPatient = new Map<string, BookTreatmentRow[]>();
  for (const treatment of input.treatments) {
    const list = byPatient.get(treatment.patient_id) ?? [];
    list.push(treatment);
    byPatient.set(treatment.patient_id, list);
  }
  for (const list of byPatient.values()) {
    list.sort((a, b) => a.performed_at.localeCompare(b.performed_at));
  }

  const futureBooked = new Set<string>();
  for (const appointment of input.appointments) {
    if (appointment.status === "cancelled") continue;
    if (appointment.starts_at > nowIso) futureBooked.add(appointment.patient_id);
  }

  let dormant = 0;
  let neverTreated = 0;
  let treatedOnce = 0;
  let multiTreatment = 0;
  let firstToSecondCohort = 0;
  let firstToSecondReturned = 0;
  let rebookedCohort = 0;
  let rebooked = 0;
  let firstTimers = 0;
  let returning = 0;
  let treatmentsLast12m = 0;
  let revenueLast12m = 0;
  const treatedLast12m = new Set<string>();

  for (const patient of all) {
    const visits = byPatient.get(patient.id) ?? [];
    if (visits.length === 0) {
      neverTreated++;
      dormant++;
      continue;
    }
    if (visits.length === 1) treatedOnce++;
    if (new Set(visits.map((visit) => visit.name)).size >= 2) multiTreatment++;

    const last = visits[visits.length - 1]!;
    if (last.performed_at < twelveMonthsAgo) dormant++;

    const first = visits[0]!;
    if (first.performed_at >= yearAgo && first.performed_at <= ninetyDaysAgo) {
      firstToSecondCohort++;
      const windowEnd = new Date(new Date(first.performed_at).getTime() + 90 * MS_DAY).toISOString();
      if (visits.some((visit) => visit.performed_at > first.performed_at && visit.performed_at <= windowEnd)) {
        firstToSecondReturned++;
      }
    }

    if (visits.some((visit) => visit.performed_at >= ninetyDaysAgo)) {
      rebookedCohort++;
      if (futureBooked.has(patient.id)) rebooked++;
    }

    const inWindow = visits.filter((visit) => visit.performed_at >= twelveMonthsAgo);
    if (inWindow.length === 0) continue;
    treatedLast12m.add(patient.id);
    for (const visit of inWindow) {
      treatmentsLast12m++;
      revenueLast12m += Number(visit.price ?? 0);
    }
    if (first.performed_at >= twelveMonthsAgo) firstTimers++;
    else returning++;
  }

  const monthlyNew: BookMetrics["monthlyNew"] = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    monthlyNew.push({
      key: start.toISOString().slice(0, 7),
      label: start.toLocaleDateString("en-GB", { month: "short" }),
      count: all.filter((patient) => patient.created_at >= start.toISOString() && patient.created_at < end.toISOString())
        .length,
    });
  }

  const sourceCounts = new Map<InsightsSource, number>();
  for (const source of INSIGHTS_SOURCES) sourceCounts.set(source, 0);
  for (const patient of all) {
    const source = normalizeSource(patient.source);
    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
  }
  const sources = INSIGHTS_SOURCES.map((source) => ({
    source,
    label: SOURCE_LABEL[source],
    count: sourceCounts.get(source) ?? 0,
  }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const treatedCount = treatedLast12m.size;
  return {
    totals: {
      total: all.length,
      active,
      inactive: all.length - active,
      newThisMonth,
      dormant,
      dormantShare: all.length ? dormant / all.length : 0,
    },
    quality: {
      firstToSecond: firstToSecondCohort ? firstToSecondReturned / firstToSecondCohort : null,
      firstToSecondCohort,
      rebooked: rebookedCohort ? rebooked / rebookedCohort : null,
      rebookedCohort,
      spendPerPatient: treatedCount ? revenueLast12m / treatedCount : null,
      visitValue: treatmentsLast12m ? revenueLast12m / treatmentsLast12m : null,
      treatedLast12m: treatedCount,
      treatmentsLast12m,
      revenueLast12m,
    },
    monthlyNew,
    treatedMix: { firstTimers, returning },
    sources,
    composition: { neverTreated, treatedOnce, multiTreatment },
  };
}
