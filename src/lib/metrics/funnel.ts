/**
 * The enquiry funnel (Insights → Funnel).
 *
 * - Enquiries: distinct people with an online enquiry in the window, or a
 *   website-sourced patient record created in it. A person is their patient
 *   record, else their email, else the enquiry; each person counts once, at
 *   their earliest enquiry. Deleted patients are left out.
 * - Booked: of those, anyone with a booking that is not cancelled (future
 *   bookings and no-shows included) or a visit on file.
 * - Consulted: of those, anyone whose consultation has happened, as a
 *   consultation treatment or an attended consultation booking up to now.
 * - Treated: of the consulted, anyone with a non-consultation treatment.
 *
 * Each stage is inside the one before, so every rate is 0–100%. Rates have a
 * fixed denominator (enquiries → booked → consulted) and are null when it is
 * 0. The chart counts the same people by the month (or week, day) they
 * enquired, so its bars add up to the tiles.
 */
import { asOf, bucketOf, chartBuckets, type MsWindow } from "./period";
import { INSIGHTS_SOURCES, SOURCE_LABEL, isBooked, isConsultation, isOnList, normalizeSource, rate, sharePercents, type InsightsSource } from "./rules";

export type FunnelPatient = {
  id: string;
  title?: string | null;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  source?: string | null;
  created_at: string;
  deleted_at?: string | null;
};
export type FunnelAppointment = { patient_id: string; starts_at: string; status: string; treatment_name?: string | null; catalogue_id?: string | null };
export type FunnelTreatment = { patient_id: string; name: string; performed_at: string; catalogue_id?: string | null };
export type FunnelLead = {
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

export type FunnelPerson = {
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

export type FunnelListRow = FunnelPerson & { daysWaiting?: number; lastConsultAt?: string };

const DAY = 86_400_000;

function names(first: string | null | undefined, last: string | null | undefined) {
  return { firstName: (first ?? "").trim() || "Lead", lastName: (last ?? "").trim() };
}

export function funnelMetrics(input: {
  window: MsWindow;
  nowMs: number;
  patients: readonly FunnelPatient[];
  appointments: readonly FunnelAppointment[];
  treatments: readonly FunnelTreatment[];
  catalogue: readonly { id: string; category?: string | null }[];
  leads: readonly FunnelLead[];
  /** Visits (any patient) on file up to now; a visit counts as booked. */
  visitedPatientIds: ReadonlySet<string>;
}) {
  const { nowMs } = input;
  const end = asOf(input.window, nowMs);
  const inside = (iso: string) => {
    const ms = new Date(iso).getTime();
    return ms >= input.window.fromMs && ms <= end;
  };
  const categoryOf = new Map(input.catalogue.map((c) => [c.id, c.category ?? null]));
  const consult = (name: string | null | undefined, catalogueId?: string | null) =>
    isConsultation({ name: name ?? null, category: catalogueId ? (categoryOf.get(catalogueId) ?? null) : null });

  const deleted = new Set(input.patients.filter((p) => !isOnList(p)).map((p) => p.id));
  const listed = input.patients.filter(isOnList);
  const patientById = new Map(listed.map((p) => [p.id, p]));
  const patientByEmail = new Map(listed.filter((p) => p.email).map((p) => [p.email!.trim().toLowerCase(), p] as const));

  const booked = new Set<string>(input.visitedPatientIds);
  for (const a of input.appointments) if (isBooked(a)) booked.add(a.patient_id);
  const consultAt = new Map<string, string>();
  const noteConsult = (id: string, at: string) => {
    const cur = consultAt.get(id);
    if (!cur || at < cur) consultAt.set(id, at);
  };
  for (const t of input.treatments)
    if (new Date(t.performed_at).getTime() <= nowMs && consult(t.name, t.catalogue_id)) noteConsult(t.patient_id, t.performed_at);
  for (const a of input.appointments)
    if (a.status === "attended" && new Date(a.starts_at).getTime() <= nowMs && consult(a.treatment_name, a.catalogue_id))
      noteConsult(a.patient_id, a.starts_at);
  const treated = new Set<string>();
  for (const t of input.treatments)
    if (new Date(t.performed_at).getTime() <= nowMs && !consult(t.name, t.catalogue_id)) treated.add(t.patient_id);

  // ---- the cohort
  const people = new Map<string, FunnelPerson>();
  const remember = (key: string, person: FunnelPerson) => {
    const existing = people.get(key);
    if (!existing || person.signedUpAt < existing.signedUpAt) people.set(key, person);
  };
  for (const lead of input.leads) {
    if (!inside(lead.occurred_at)) continue;
    if (lead.patient_id && deleted.has(lead.patient_id)) continue;
    const email = lead.email?.trim().toLowerCase() || null;
    const matched = (lead.patient_id ? patientById.get(lead.patient_id) : undefined) ?? (email ? patientByEmail.get(email) : undefined);
    const key = matched?.id ?? (email ? `email:${email}` : `lead:${lead.id}`);
    const n = names(matched?.first_name ?? lead.first_name, matched?.last_name ?? lead.last_name);
    remember(key, {
      patientId: matched?.id ?? null,
      leadId: lead.id,
      firstName: n.firstName,
      lastName: n.lastName,
      title: matched?.title ?? null,
      email: matched?.email ?? lead.email ?? null,
      phone: matched?.phone ?? lead.phone ?? null,
      avatarUrl: matched?.avatar_url ?? null,
      source: normalizeSource(lead.source ?? matched?.source),
      interest: lead.interest ?? null,
      signedUpAt: lead.occurred_at,
    });
  }
  for (const p of listed) {
    if (normalizeSource(p.source) !== "website" || !inside(p.created_at)) continue;
    const email = p.email?.trim().toLowerCase();
    if (email) people.delete(`email:${email}`);
    remember(p.id, {
      patientId: p.id,
      leadId: null,
      firstName: p.first_name,
      lastName: p.last_name,
      title: p.title ?? null,
      email: p.email ?? null,
      phone: p.phone ?? null,
      avatarUrl: p.avatar_url ?? null,
      source: "website",
      interest: null,
      signedUpAt: p.created_at,
    });
  }
  const cohort = [...people.values()];

  const isBookedPerson = (p: FunnelPerson) => !!p.patientId && booked.has(p.patientId);
  const consultOf = (p: FunnelPerson) => (p.patientId ? consultAt.get(p.patientId) : undefined);
  const isTreatedPerson = (p: FunnelPerson) => !!consultOf(p) && treated.has(p.patientId!);

  const waiting: FunnelListRow[] = [];
  const consultedNoTreatment: FunnelListRow[] = [];
  let bookedCount = 0;
  let consulted = 0;
  let converted = 0;
  for (const p of cohort) {
    if (isBookedPerson(p)) bookedCount += 1;
    else waiting.push({ ...p, daysWaiting: Math.max(0, Math.floor((nowMs - new Date(p.signedUpAt).getTime()) / DAY)) });
    const at = consultOf(p);
    if (!at) continue;
    consulted += 1;
    if (isTreatedPerson(p)) converted += 1;
    else consultedNoTreatment.push({ ...p, lastConsultAt: at, daysWaiting: Math.max(0, Math.floor((nowMs - new Date(at).getTime()) / DAY)) });
  }
  waiting.sort((a, b) => (b.daysWaiting ?? 0) - (a.daysWaiting ?? 0));
  consultedNoTreatment.sort((a, b) => (b.daysWaiting ?? 0) - (a.daysWaiting ?? 0));

  const buckets = chartBuckets(input.window, nowMs);
  const series = buckets.map((b) => ({ key: b.key, label: b.label, signUps: 0, booked: 0, consulted: 0 }));
  for (const p of cohort) {
    const b = bucketOf(buckets, new Date(p.signedUpAt).getTime());
    const point = b ? series[buckets.indexOf(b)]! : undefined;
    if (!point) continue;
    point.signUps += 1;
    if (isBookedPerson(p)) point.booked += 1;
    if (consultOf(p)) point.consulted += 1;
  }

  const counts = INSIGHTS_SOURCES.map((s) => cohort.filter((p) => p.source === s).length);
  const percents = sharePercents(counts);
  const sources = INSIGHTS_SOURCES.map((source, i) => ({ source, label: SOURCE_LABEL[source], count: counts[i]!, percent: percents[i]! }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  const signUps = cohort.length;
  return {
    funnel: {
      signUps,
      notBooked: signUps - bookedCount,
      bookedCount,
      consulted,
      converted,
      bookedRate: rate(bookedCount, signUps),
      consultRate: rate(consulted, bookedCount),
      convertRate: rate(converted, consulted),
    },
    series,
    sources,
    waiting,
    consultedNoTreatment,
  };
}
