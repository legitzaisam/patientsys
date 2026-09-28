/**
 * Independent recalculation for the Insights numbers audit.
 *
 * Reads only the raw seed arrays (never the app's metrics code) and applies
 * the agreed definitions from `docs/audits/insights-numbers.md` in integer
 * pence and Europe/London time. `insights-recalc.audit.test.ts` compares this
 * with what the pages return.
 */
import {
  appointments as rawAppointments,
  catalogue as rawCatalogue,
  db,
  patients as rawPatients,
  productSales as rawSales,
  profiles as rawProfiles,
  retailProducts as rawProducts,
  treatments as rawTreatments,
  userRoles as rawRoles,
  websiteLeads as rawLeads,
} from "@/lib/demo/data";

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));
const ms = (v: unknown) => new Date(String(v)).getTime();
const pence = (v: unknown) => Math.round(Number(v ?? 0) * 100);

/* ------------------------------------------------------------ London time */

const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function parts(t: number) {
  const o: Record<string, number> = {};
  for (const p of PARTS.formatToParts(new Date(t))) if (p.type !== "literal") o[p.type] = Number(p.value);
  return { y: o["year"]!, m: o["month"]!, d: o["day"]!, h: o["hour"]!, mi: o["minute"]!, sec: o["second"]! };
}

function offset(t: number) {
  const p = parts(t);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.sec) - Math.floor(t / 1000) * 1000;
}

/** 00:00 London on y-m-d (m is 1-based and may overflow). */
function midnight(y: number, m: number, d: number) {
  const wall = Date.UTC(y, m - 1, d);
  return wall - offset(wall - offset(wall));
}

function dayKey(t: number) {
  const p = parts(t);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

function monthKey(t: number) {
  return dayKey(t).slice(0, 7);
}

/** London midnight on the same date `k` months before `t` (day clamped to the month). */
function monthsBefore(t: number, k: number) {
  const p = parts(t);
  const last = new Date(Date.UTC(p.y, p.m - 1 - k + 1, 0)).getUTCDate();
  return midnight(p.y, p.m - k, Math.min(p.d, last));
}

export type AuditWindow = { from: number; to: number; label: string };

/** The N whole calendar months ending with the month that holds `now`. */
export function calendarMonths(now: number, n: number): AuditWindow {
  const p = parts(now);
  return {
    from: midnight(p.y, p.m - (n - 1), 1),
    to: midnight(p.y, p.m + 1, 1) - 1,
    label: n === 12 ? "Last 12 months" : n === 1 ? "This month" : `Last ${n} months`,
  };
}

export function dayRange(fromKey: string, toKey: string, label: string): AuditWindow {
  const [fy, fm, fd] = fromKey.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = toKey.split("-").map(Number) as [number, number, number];
  return { from: midnight(fy, fm, fd), to: midnight(ty, tm, td + 1) - 1, label };
}

/* ------------------------------------------------------------ the seed */

const P = rawPatients as Row[];
const T = rawTreatments as Row[];
const A = rawAppointments as Row[];
const depositPercent = Number((db.clinic as Row)["deposit_percent"] ?? 30);
const consultCategory = new Map((rawCatalogue as Row[]).map((c) => [String(c["id"]), s(c["category"])]));

function isConsult(name: unknown, catalogueId: unknown) {
  if ((consultCategory.get(String(catalogueId)) ?? "").toLowerCase() === "consultation") return true;
  return /consult/i.test(String(name ?? ""));
}

function sourceOf(v: unknown) {
  const k = String(v ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return ["website", "instagram", "referral", "walk_in"].includes(k) ? k : "other";
}

/** Largest-remainder whole percents, so the list adds to 100. */
function percents(counts: number[]) {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => 0);
  const raw = counts.map((c) => (c * 100) / total);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left <= 0) break;
    out[i]! += 1;
    left -= 1;
  }
  return out;
}

const pct = (n: number, d: number) => (d ? Math.round((n * 100) / d) : null);

export function recalc(now: number, win: AuditWindow) {
  const asOf = Math.min(win.to, now);
  const inWin = (t: number) => t >= win.from && t <= asOf;

  const live = P.filter((p) => !p["deleted_at"]);
  const liveIds = new Set(live.map((p) => String(p["id"])));
  const apptById = new Map(A.map((a) => [String(a["id"]), a]));

  // Seed consistency: every linked treatment sits on an attended booking in
  // the past, and nothing is performed in the future.
  const problems: string[] = [];
  for (const t of T) {
    if (ms(t["performed_at"]) > now) problems.push(`treatment ${t["id"]} performed in the future`);
    const a = t["appointment_id"] ? apptById.get(String(t["appointment_id"])) : null;
    if (t["appointment_id"] && !a) problems.push(`treatment ${t["id"]} links a missing booking`);
    if (a && a["status"] !== "attended") problems.push(`treatment ${t["id"]} sits on a ${a["status"]} booking`);
    if (a && a["patient_id"] !== t["patient_id"]) problems.push(`treatment ${t["id"]} and its booking name different patients`);
  }
  for (const a of A) {
    if (a["status"] === "attended" && ms(a["starts_at"]) > now) problems.push(`booking ${a["id"]} attended in the future`);
    if (a["status"] === "booked" && ms(a["starts_at"]) < now - 86_400_000)
      problems.push(`booking ${a["id"]} still "booked" a day after it started`);
    if (a["status"] === "no_show" && a["payment_status"] === "paid") problems.push(`booking ${a["id"]} is a paid no-show`);
  }

  // ---- visits: one per attended booking, plus each treatment with no
  // booking (a walk-in) on its own.
  type Visit = { patient: string; at: number; practitioner: string | null };
  const visits: Visit[] = [];
  for (const a of A) {
    if (a["status"] !== "attended" || ms(a["starts_at"]) > now) continue;
    if (!liveIds.has(String(a["patient_id"]))) continue;
    visits.push({ patient: String(a["patient_id"]), at: ms(a["starts_at"]), practitioner: s(a["practitioner_id"]) });
  }
  for (const t of T) {
    if (t["appointment_id"] || ms(t["performed_at"]) > now || !liveIds.has(String(t["patient_id"]))) continue;
    visits.push({ patient: String(t["patient_id"]), at: ms(t["performed_at"]), practitioner: s(t["practitioner_id"]) });
  }
  const byPatient = new Map<string, number[]>();
  for (const v of visits) byPatient.set(v.patient, [...(byPatient.get(v.patient) ?? []), v.at]);
  for (const list of byPatient.values()) list.sort((a, b) => a - b);
  const visitsUpTo = (id: string, t: number) => (byPatient.get(id) ?? []).filter((x) => x <= t);

  // ---- money per treatment line
  const money = (t: Row) => {
    const price = pence(t["price"]);
    const a = t["appointment_id"] ? apptById.get(String(t["appointment_id"])) : null;
    if (a?.["payment_status"] === "refunded") return { earned: 0, collected: 0 };
    if (!a || a["payment_status"] === "paid") return { earned: price, collected: price };
    if (a["payment_status"] === "deposit_paid") return { earned: price, collected: Math.round((price * depositPercent) / 100) };
    return { earned: price, collected: 0 };
  };
  const winTreatments = T.filter((t) => liveIds.has(String(t["patient_id"])) && inWin(ms(t["performed_at"])));

  /* ---------------------------------------------------------- Funnel */
  const byEmail = new Map(live.filter((p) => p["email"]).map((p) => [String(p["email"]).trim().toLowerCase(), p]));
  const byId = new Map(live.map((p) => [String(p["id"]), p]));
  const people = new Map<string, { patient: string | null; at: number; source: string }>();
  const keep = (key: string, v: { patient: string | null; at: number; source: string }) => {
    const cur = people.get(key);
    if (!cur || v.at < cur.at) people.set(key, v);
  };
  for (const l of rawLeads as Row[]) {
    const at = ms(l["occurred_at"]);
    if (!inWin(at)) continue;
    const email = s(l["email"])?.trim().toLowerCase() ?? null;
    const linked = l["patient_id"] ? P.find((p) => p["id"] === l["patient_id"]) : null;
    if (linked?.["deleted_at"]) continue;
    const p = (linked ?? (email ? byEmail.get(email) : null)) as Row | null | undefined;
    const key = p ? String(p["id"]) : email ? `email:${email}` : `lead:${l["id"]}`;
    keep(key, { patient: p ? String(p["id"]) : null, at, source: sourceOf(l["source"] ?? p?.["source"]) });
  }
  for (const p of live) {
    if (sourceOf(p["source"]) !== "website" || !inWin(ms(p["created_at"]))) continue;
    const email = s(p["email"])?.trim().toLowerCase();
    if (email) people.delete(`email:${email}`);
    keep(String(p["id"]), { patient: String(p["id"]), at: ms(p["created_at"]), source: "website" });
  }
  const cohort = [...people.values()];

  const bookedIds = new Set<string>();
  for (const a of A) if (a["status"] !== "cancelled") bookedIds.add(String(a["patient_id"]));
  for (const id of byPatient.keys()) bookedIds.add(id);
  const consultedIds = new Set<string>();
  for (const t of T) if (ms(t["performed_at"]) <= now && isConsult(t["name"], t["catalogue_id"])) consultedIds.add(String(t["patient_id"]));
  for (const a of A)
    if (a["status"] === "attended" && ms(a["starts_at"]) <= now && isConsult(a["treatment_name"], a["catalogue_id"]))
      consultedIds.add(String(a["patient_id"]));
  const treatedIds = new Set<string>();
  for (const t of T) if (ms(t["performed_at"]) <= now && !isConsult(t["name"], t["catalogue_id"])) treatedIds.add(String(t["patient_id"]));

  const isBooked = (c: (typeof cohort)[number]) => !!c.patient && bookedIds.has(c.patient);
  const isConsulted = (c: (typeof cohort)[number]) => !!c.patient && consultedIds.has(c.patient);
  const isTreated = (c: (typeof cohort)[number]) => isConsulted(c) && treatedIds.has(c.patient!);
  const signUps = cohort.length;
  const booked = cohort.filter(isBooked).length;
  const consulted = cohort.filter(isConsulted).length;
  const treated = cohort.filter(isTreated).length;

  const chartMonths = new Map<string, { signUps: number; booked: number; consulted: number }>();
  for (const c of cohort) {
    const k = monthKey(c.at);
    const cur = chartMonths.get(k) ?? { signUps: 0, booked: 0, consulted: 0 };
    cur.signUps += 1;
    if (isBooked(c)) cur.booked += 1;
    if (isConsulted(c)) cur.consulted += 1;
    chartMonths.set(k, cur);
  }
  const sourceOrder = ["website", "instagram", "referral", "walk_in", "other"];
  const sourceCounts = sourceOrder.map((k) => cohort.filter((c) => c.source === k).length);

  const treatmentRevenue = new Map<string, { count: number; revenue: number }>();
  for (const t of winTreatments) {
    const cur = treatmentRevenue.get(String(t["name"])) ?? { count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += money(t).earned;
    treatmentRevenue.set(String(t["name"]), cur);
  }
  const bestsellers = [...treatmentRevenue.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue || b.count - a.count);
  const retailPence = (rawSales as Row[]).filter((x) => inWin(ms(x["occurred_at"]))).reduce((n, x) => n + pence(x["amount"]), 0);

  /* ---------------------------------------------------------- Patient base */
  const onList = live.filter((p) => ms(p["created_at"]) <= asOf);
  const total = onList.length;
  const active = onList.filter((p) => p["status"] === "active").length;
  const newRecords = live.filter((p) => inWin(ms(p["created_at"]))).length;
  const cut12 = monthsBefore(asOf, 12);
  const cut6 = monthsBefore(asOf, 6);
  const cut3 = monthsBefore(asOf, 3);
  const lastVisit = { under3: 0, from3to6: 0, from6to12: 0, over12: 0, never: 0 };
  let seen = 0;
  let once = 0;
  let twoPlus = 0;
  let newSeen = 0;
  let visitsInWindow = 0;
  let rebooked = 0;
  for (const p of onList) {
    const id = String(p["id"]);
    const history = visitsUpTo(id, asOf);
    const last = history[history.length - 1];
    if (last === undefined) lastVisit.never += 1;
    else if (last >= cut3) lastVisit.under3 += 1;
    else if (last >= cut6) lastVisit.from3to6 += 1;
    else if (last >= cut12) lastVisit.from6to12 += 1;
    else lastVisit.over12 += 1;
    const inside = history.filter(inWin);
    if (!inside.length) continue;
    seen += 1;
    visitsInWindow += inside.length;
    if (history.length === 1) once += 1;
    else twoPlus += 1;
    if (history[0]! >= win.from) newSeen += 1;
    const lastInside = inside[inside.length - 1]!;
    if (A.some((a) => a["patient_id"] === id && a["status"] !== "cancelled" && ms(a["starts_at"]) > lastInside)) rebooked += 1;
  }
  const horizon = 180 * 86_400_000;
  let f2sCohort = 0;
  let f2sReturned = 0;
  for (const [id, list] of byPatient) {
    if (!liveIds.has(id)) continue;
    const first = list[0]!;
    if (!inWin(first) || now - first < horizon) continue;
    f2sCohort += 1;
    if (list[1] !== undefined && list[1] - first <= horizon) f2sReturned += 1;
  }
  const revenue = winTreatments.reduce((n, t) => n + money(t).earned, 0);
  const createdByMonth = new Map<string, number>();
  for (const p of live) {
    const t = ms(p["created_at"]);
    if (inWin(t)) createdByMonth.set(monthKey(t), (createdByMonth.get(monthKey(t)) ?? 0) + 1);
  }
  const listSources = sourceOrder.map((k) => onList.filter((p) => sourceOf(p["source"]) === k).length);

  /* ---------------------------------------------------------- Money */
  const staffIds = [...new Set((rawRoles as Row[]).filter((r) => r["role"] === "owner" || r["role"] === "practitioner").map((r) => String(r["user_id"])))];
  const rateOf = (id: string) => Number((rawProfiles as Row[]).find((p) => p["id"] === id)?.["commission_rate"] ?? 0);
  const firstVisit = new Map([...byPatient].map(([id, list]) => [id, list[0]!]));
  const practitioners = staffIds.map((id) => {
    const mine = winTreatments.filter((t) => t["practitioner_id"] === id);
    let earned = 0;
    let collected = 0;
    let earnedShare = 0;
    let collectedShare = 0;
    let csvShare = 0;
    for (const t of mine) {
      const m = money(t);
      const rate = Number(t["commission_rate_snapshot"] ?? rateOf(id));
      earned += m.earned;
      collected += m.collected;
      earnedShare += Math.round((m.earned * rate) / 100);
      collectedShare += Math.round((m.collected * rate) / 100);
      csvShare += Math.round((m.earned * rate) / 100);
    }
    const myPatients = new Set(mine.map((t) => String(t["patient_id"])));
    return {
      id,
      earned,
      collected,
      outstanding: earned - collected,
      earnedShare,
      collectedShare,
      outstandingShare: earnedShare - collectedShare,
      csvShare,
      treatments: mine.length,
      newPatients: [...myPatients].filter((pid) => inWin(firstVisit.get(pid) ?? -Infinity)).length,
    };
  });
  const clinicEarned = winTreatments.reduce((n, t) => n + money(t).earned, 0);
  const clinicCollected = winTreatments.reduce((n, t) => n + money(t).collected, 0);
  const trendMonths = new Map<string, number>();
  for (const t of winTreatments) {
    const k = monthKey(ms(t["performed_at"]));
    trendMonths.set(k, (trendMonths.get(k) ?? 0) + money(t).earned);
  }
  const bookedAheadPence = A.filter((a) => a["status"] === "booked" && ms(a["starts_at"]) > now).reduce((n, a) => n + pence(a["price"]), 0);

  // Dashboard: the London calendar month holding now.
  const monthWin = calendarMonths(now, 1);
  const monthTreatments = T.filter((t) => liveIds.has(String(t["patient_id"])) && ms(t["performed_at"]) >= monthWin.from && ms(t["performed_at"]) <= now);

  // Retention headline: patients seen in the 12 months up to the window end.
  const rollFrom = monthsBefore(asOf, 12);
  let rollSeen = 0;
  let rollReturning = 0;
  for (const [id, list] of byPatient) {
    if (!liveIds.has(id)) continue;
    const n = list.filter((x) => x >= rollFrom && x <= asOf).length;
    if (n) rollSeen += 1;
    if (n > 1) rollReturning += 1;
  }

  return {
    window: { from: new Date(win.from).toISOString(), to: new Date(win.to).toISOString(), asOf: new Date(asOf).toISOString() },
    seedProblems: problems,
    funnel: {
      signUps,
      booked,
      consulted,
      treated,
      notBooked: signUps - booked,
      consultedNoTreatment: consulted - treated,
      bookedRate: pct(booked, signUps),
      consultRate: pct(consulted, booked),
      treatRate: pct(treated, consulted),
      chart: {
        months: [...chartMonths.keys()].sort(),
        signUps: [...chartMonths.values()].reduce((n, v) => n + v.signUps, 0),
        booked: [...chartMonths.values()].reduce((n, v) => n + v.booked, 0),
        consulted: [...chartMonths.values()].reduce((n, v) => n + v.consulted, 0),
      },
      sources: Object.fromEntries(sourceOrder.map((k, i) => [k, sourceCounts[i]!]).filter(([, n]) => n)),
      sourcePercents: Object.fromEntries(
        sourceOrder.map((k, i) => [k, percents(sourceCounts)[i]!]).filter((_, i) => sourceCounts[i]),
      ),
      bestsellers: bestsellers.slice(0, 8),
      treatmentRevenue: bestsellers.reduce((n, b) => n + b.revenue, 0),
      retailRevenue: retailPence,
    },
    book: {
      total,
      active,
      inactive: total - active,
      newRecords,
      newRecordsChart: [...createdByMonth.values()].reduce((a, b) => a + b, 0),
      dormant: lastVisit.over12,
      dormantShare: pct(lastVisit.over12, total),
      neverTreated: lastVisit.never,
      lastVisit,
      seen,
      once,
      twoPlus,
      firstToSecond: { cohort: f2sCohort, returned: f2sReturned, rate: pct(f2sReturned, f2sCohort) },
      rebooked: { cohort: seen, count: rebooked, rate: pct(rebooked, seen) },
      revenue,
      spendPerPatient: seen ? Math.round(revenue / seen) : null,
      visitValue: visitsInWindow ? Math.round(revenue / visitsInWindow) : null,
      visitsInWindow,
      newVsReturning: { new: newSeen, returning: seen - newSeen },
      listSources: Object.fromEntries(sourceOrder.map((k, i) => [k, listSources[i]!]).filter(([, n]) => n)),
    },
    money: {
      earned: clinicEarned,
      collected: clinicCollected,
      outstanding: clinicEarned - clinicCollected,
      bookedAhead: bookedAheadPence,
      trendEarned: [...trendMonths.values()].reduce((a, b) => a + b, 0),
      practitioners,
    },
    dashboard: {
      totalClients: live.length,
      activeClients: live.filter((p) => p["status"] === "active").length,
      revenueMonth: monthTreatments.reduce((n, t) => n + money(t).earned, 0),
      treatmentsMonth: monthTreatments.length,
    },
    retention: { rollingSeen: rollSeen, rollingReturning: rollReturning, rate: pct(rollReturning, rollSeen) ?? 0 },
  };
}

export type Recalc = ReturnType<typeof recalc>;
