/**
 * What the pages return, for the Insights numbers audit: each page's builder
 * called with the inputs its demo handler passes and the window its picker
 * sends. The dashboard's KPIs come from the shared dashboard builder.
 * Money is converted to pence and rates to whole percents for comparison.
 */
import { CURRENT_YEAR, periodRange, type PeriodSelection } from "@/components/period-picker";
import {
  appointments,
  catalogue,
  db,
  patients,
  productSales,
  profiles,
  retailProducts,
  treatments,
  userRoles,
  websiteLeads,
} from "@/lib/demo/data";
import { buildStats, buildTrend } from "@/lib/earnings.server";
import { buildBookMetrics, buildInsights } from "@/lib/insights.server";
import { buildRetention } from "@/lib/retention.server";

type Row = Record<string, any>;
const P = patients as Row[];
const T = treatments as Row[];
const A = appointments as Row[];
const p100 = (n: number | null | undefined) => (n == null ? null : Math.round(n * 100));

export function shown(now: number, period: PeriodSelection = CURRENT_YEAR) {
  const nowDate = new Date(now);
  const range = periodRange(period, nowDate);

  const insights = buildInsights({
    from: range.from,
    to: range.to,
    now: nowDate,
    patients: P.map((p) => ({ ...p })) as never,
    appointments: A.map((a) => ({ ...a })) as never,
    treatments: T.map((t) => ({ ...t })) as never,
    catalogue: (catalogue as Row[]).map((c) => ({ id: c.id, name: c.name, category: c.category })),
    leads: websiteLeads as never,
    products: (retailProducts as Row[]).map((p) => ({ id: p.id, name: p.name, sku: p.sku ?? null })),
    sales: productSales as never,
  });
  const book = buildBookMetrics({ from: range.from, to: range.to, now: nowDate, patients: P, treatments: T, appointments: A } as never);

  // Performance / My Profile: the demo earningsInputs, on the audit clock.
  const nowIso = nowDate.toISOString();
  const yearAgo = new Date(now - 365 * 86_400_000).toISOString();
  const inputs = {
    treatments: T.filter((t) => t.performed_at >= range.from && t.performed_at <= range.to),
    appointments: A.filter(
      (a) => (a.starts_at >= range.from && a.starts_at <= range.to) || (a.starts_at >= nowIso && a.status !== "cancelled"),
    ),
    yearTreatments: T.filter((t) => t.performed_at >= yearAgo),
    firstSeen: new Map<string, string>(P.map((p) => [p.id, p.created_at])),
  };
  const staffIds = [...new Set((userRoles as Row[]).filter((r) => r.role === "owner" || r.role === "practitioner").map((r) => r.user_id))];
  const staff = staffIds.map((id) => {
    const p = (profiles as Row[]).find((x) => x.id === id);
    return { userId: id, fullName: p?.full_name ?? "", jobTitle: "", commissionRate: Number(p?.commission_rate ?? 0) };
  });
  const moneyOpts = { depositPercent: Number(db.clinic["deposit_percent"] ?? 30), nowMs: now };
  const rows = buildStats(staff, inputs.treatments as never, inputs.appointments as never, inputs.yearTreatments as never, inputs.firstSeen, range, moneyOpts);
  const trend = buildTrend(staff, inputs.treatments as never, inputs.appointments as never, range, moneyOpts);
  const practitioners = rows.map((r) => {
    const rate = staff.find((x) => x.userId === r.userId)!.commissionRate;
    const lines = inputs.treatments.filter((t) => t.practitioner_id === r.userId);
    return {
      id: r.userId,
      earned: p100(r.earned)!,
      collected: p100(r.collected)!,
      outstanding: p100(r.outstanding)!,
      earnedShare: p100(r.earnedShare)!,
      collectedShare: p100(r.collectedShare)!,
      outstandingShare: p100(Math.round((r.earnedShare - r.collectedShare) * 100) / 100)!,
      csvShare: lines.reduce((n, t) => n + Math.round(Number(t.price ?? 0) * Number(t.commission_rate_snapshot ?? rate)), 0),
      treatments: r.treatments,
      newPatients: r.newPatients,
    };
  });
  const sum = (k: "earned" | "collected" | "outstanding") => rows.reduce((n, r) => n + r[k], 0);

  // Dashboard KPIs: the demo handler's own arithmetic (month in server local time).
  const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).toISOString();
  const monthTreats = T.filter((t) => t.performed_at >= monthStart);

  const retention = buildRetention({
    patients: P as never,
    treatments: T as never,
    appointments: A as never,
    outreach: [],
    practitionerNames: new Map(),
    now,
    window: { from: new Date(range.from).getTime(), to: new Date(range.to).getTime(), key: "year" },
  });

  const sourceTotal = insights.sources.reduce((n, r) => n + r.count, 0) || 1;
  return {
    window: range,
    funnel: {
      signUps: insights.funnel.signUps,
      booked: insights.funnel.bookedCount,
      consulted: insights.funnel.consulted,
      treated: insights.funnel.converted,
      notBooked: insights.waiting.length,
      consultedNoTreatment: insights.consultedNoTreatment.length,
      bookedRate: insights.funnel.signUps ? p100(insights.funnel.bookedRate) : null,
      consultRate: insights.funnel.consulted || insights.funnel.bookedCount ? p100(insights.funnel.consultRate) : null,
      treatRate: insights.funnel.consulted ? p100(insights.funnel.convertRate) : null,
      chart: {
        months: insights.monthly.map((m) => m.label),
        signUps: insights.monthly.reduce((n, m) => n + m.signUps, 0),
        booked: insights.monthly.reduce((n, m) => n + m.firstBookings, 0),
        consulted: insights.monthly.reduce((n, m) => n + m.firstConsults, 0),
      },
      sources: Object.fromEntries(insights.sources.map((r) => [r.source, r.count])),
      sourcePercents: Object.fromEntries(insights.sources.map((r) => [r.source, Math.round((r.count / sourceTotal) * 100)])),
      bestsellers: insights.bestsellers.treatments.map((b) => ({ name: b.name, count: b.count, revenue: p100(b.revenue)! })),
      treatmentRevenue: null as number | null,
      retailRevenue: p100(insights.bestsellers.products.reduce((n, x) => n + x.revenue, 0)),
    },
    book: {
      total: book.totals.total,
      active: book.totals.active,
      inactive: book.totals.inactive,
      newRecords: book.totals.newThisMonth,
      newRecordsChart: book.monthlyNew.reduce((n, m) => n + m.count, 0),
      dormant: book.totals.dormant,
      dormantShare: p100(book.totals.dormantShare),
      neverTreated: book.composition.neverTreated,
      lastVisit: book.lastVisit,
      seen: book.composition.seen,
      once: book.composition.treatedOnce,
      twoPlus: book.composition.multiTreatment,
      firstToSecond: { cohort: book.secondVisit.cohort, returned: book.secondVisit.returned, rate: book.secondVisit.rate },
      rebooked: { cohort: book.quality.rebookedCohort, count: null as number | null, rate: p100(book.quality.rebooked) },
      revenue: p100(book.quality.revenueLast12m),
      spendPerPatient: p100(book.quality.spendPerPatient),
      visitValue: p100(book.quality.visitValue),
      visitsInWindow: book.quality.treatmentsLast12m,
      newVsReturning: { new: book.treatedMix.firstTimers, returning: book.treatedMix.returning },
      listSources: Object.fromEntries(book.sources.map((r) => [r.source, r.count])),
    },
    money: {
      earned: p100(sum("earned"))!,
      collected: p100(sum("collected"))!,
      outstanding: p100(sum("outstanding"))!,
      bookedAhead: p100(rows.reduce((n, r) => n + r.bookedAhead, 0))!,
      trendEarned: p100(trend.clinic.reduce((n, x) => n + x.earned, 0))!,
      practitioners,
    },
    dashboard: {
      totalClients: P.length,
      activeClients: P.filter((p) => p.status === "active").length,
      revenueMonth: p100(monthTreats.reduce((n, t) => n + Number(t.price ?? 0), 0))!,
      treatmentsMonth: monthTreats.length,
    },
    retention: {
      rollingSeen: retention.summary.activeInWindow,
      rollingReturning: retention.summary.returningInWindow,
      rate: retention.summary.rate,
      seen: retention.summary.oneVisitPatients + retention.summary.repeatPatients,
      once: retention.summary.oneVisitPatients,
      twoPlus: retention.summary.repeatPatients,
      firstToSecond: retention.summary.firstToSecond.rate,
    },
  };
}
