/**
 * Insights numbers audit: what each page returns vs an independent
 * recalculation from the raw seed (`insights-recalc.ts`). Writes the table
 * behind `insights-numbers.md` to `docs/audits/insights-numbers.json` and
 * fails on any row that does not match.
 *
 *   TZ=Europe/London npx vitest run --config vitest.metrics.config.ts docs/audits
 */
import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PeriodSelection } from "@/components/period-picker";
import { profiles } from "@/lib/demo/data";
import { calendarMonths, dayRange, recalc, type AuditWindow, type Recalc } from "./insights-recalc";
import { shown } from "./insights-shown";

const NOW = new Date(process.env["DEMO_NOW"] ?? "2026-09-20T12:00:00.000Z").getTime();

type Shown = ReturnType<typeof shown>;
type Check = { id: string; metric: string; where: string; pick: (x: Shown | Recalc) => unknown };

const c = (id: string, metric: string, where: string, pick: (x: any) => unknown): Check => ({ id, metric, where, pick });

const CHECKS: Check[] = [
  c("funnel.signUps", "Online enquiries", "Insights → Funnel tile", (x) => x.funnel.signUps),
  c("funnel.booked", "Booked", "Insights → Funnel tile", (x) => x.funnel.booked),
  c("funnel.bookedRate", "Booked rate", "Insights → Funnel tile", (x) => x.funnel.bookedRate),
  c("funnel.consulted", "Consulted", "Insights → Funnel tile", (x) => x.funnel.consulted),
  c("funnel.consultRate", "Consult rate", "Insights → Funnel tile", (x) => x.funnel.consultRate),
  c("funnel.treated", "Treated", "Insights → Funnel tile", (x) => x.funnel.treated),
  c("funnel.treatRate", "Treatment rate", "Insights → Funnel tile", (x) => x.funnel.treatRate),
  c("funnel.notBooked", "Waiting for a first booking", "Insights → action list", (x) => x.funnel.notBooked),
  c("funnel.consultedNoTreatment", "Consulted, no treatment", "Insights → action list", (x) => x.funnel.consultedNoTreatment),
  c("funnel.chart.months", "Chart months", "Insights → funnel chart", (x) => x.funnel.chart.months.length),
  c("funnel.chart.signUps", "Chart enquiries (sum of bars)", "Insights → funnel chart", (x) => x.funnel.chart.signUps),
  c("funnel.chart.booked", "Chart booked (sum of bars)", "Insights → funnel chart", (x) => x.funnel.chart.booked),
  c("funnel.chart.consulted", "Chart consulted (sum of bars)", "Insights → funnel chart", (x) => x.funnel.chart.consulted),
  c("funnel.sources", "Where enquiries came from (counts)", "Insights → source mix", (x) => x.funnel.sources),
  c("funnel.sourcePercents", "Where enquiries came from (%)", "Insights → source mix", (x) => x.funnel.sourcePercents),
  c("funnel.bestsellers", "Bestsellers (count, £)", "Insights → Bestsellers", (x) => x.funnel.bestsellers),
  c("funnel.retailRevenue", "Retail revenue", "Insights → Bestsellers", (x) => x.funnel.retailRevenue),
  c("book.total", "Total patients", "Insights → Patient base tile", (x) => x.book.total),
  c("book.active", "Active", "Insights → Patient base tile", (x) => x.book.active),
  c("book.inactive", "Inactive", "Insights → Patient base tile hint", (x) => x.book.inactive),
  c("book.newRecords", "New patients (records created)", "Insights → Patient base tile", (x) => x.book.newRecords),
  c("book.newRecordsChart", "New patients chart (sum of bars)", "Insights → New patients chart", (x) => x.book.newRecordsChart),
  c("book.dormant", "Dormant", "Insights → Patient base tile", (x) => x.book.dormant),
  c("book.dormantShare", "Dormant share", "Insights → Patient base tile hint", (x) => x.book.dormantShare),
  c("book.neverTreated", "Never treated", "Insights → composition", (x) => x.book.neverTreated),
  c("book.lastVisit", "Time since last visit", "Insights → last visit card", (x) => x.book.lastVisit),
  c("book.seen", "Seen in the period", "Insights → composition", (x) => x.book.seen),
  c("book.once", "Treated once", "Insights → composition", (x) => x.book.once),
  c("book.twoPlus", "Two or more visits", "Insights → composition", (x) => x.book.twoPlus),
  c("book.firstToSecond", "First to second visit", "Insights → quality tile", (x) => x.book.firstToSecond),
  c("book.rebooked", "Rebooked", "Insights → quality tile", (x) => x.book.rebooked.rate),
  c("book.revenue", "Revenue in the period", "Insights → spend inputs", (x) => x.book.revenue),
  c("book.spendPerPatient", "Spend per patient", "Insights → quality tile", (x) => x.book.spendPerPatient),
  c("book.visitValue", "Average visit value", "Insights → quality tile", (x) => x.book.visitValue),
  c("book.visitsInWindow", "Visits in the period", "Insights → visit value input", (x) => x.book.visitsInWindow),
  c("book.newVsReturning", "New vs returning", "Insights → treated mix", (x) => x.book.newVsReturning),
  c("book.listSources", "Where patients came from (lifetime)", "Insights → sources card", (x) => x.book.listSources),
  c("dashboard.totalClients", "Total clients", "Dashboard KPI", (x) => x.dashboard.totalClients),
  c("dashboard.activeClients", "Active clients", "Dashboard KPI hint", (x) => x.dashboard.activeClients),
  c("dashboard.revenueMonth", "Revenue this month", "Dashboard KPI", (x) => x.dashboard.revenueMonth),
  c("dashboard.treatmentsMonth", "Treatments this month", "Dashboard KPI hint", (x) => x.dashboard.treatmentsMonth),
  c("retention.rate", "Retention rate", "Retention headline / Dashboard KPI", (x) => x.retention.rate),
  c("retention.once", "One visit only", "Retention card (= Insights treated once)", (x) => ("seen" in x.retention ? x.retention.once : x.book.once)),
  c("retention.twoPlus", "Repeat patients", "Retention card (= Insights two or more)", (x) => ("seen" in x.retention ? x.retention.twoPlus : x.book.twoPlus)),
  c("retention.firstToSecond", "First to second (Retention)", "Retention headline (= Insights)", (x) =>
    "seen" in x.retention ? x.retention.firstToSecond : x.book.firstToSecond.rate,
  ),
  c("money.earned", "Earned", "Performance tile", (x) => x.money.earned),
  c("money.collected", "Collected", "Performance tile", (x) => x.money.collected),
  c("money.outstanding", "Outstanding", "Performance tile", (x) => x.money.outstanding),
  c("money.bookedAhead", "Booked ahead", "Performance subtitle", (x) => x.money.bookedAhead),
  c("money.trendEarned", "Earnings trend (sum of months)", "Performance trend chart", (x) => x.money.trendEarned),
  c("money.practitioners.earned", "Earned per practitioner", "Performance table", (x) =>
    Object.fromEntries(x.money.practitioners.map((p: any) => [p.id, p.earned])),
  ),
  c("money.practitioners.collected", "Collected per practitioner", "Performance table", (x) =>
    Object.fromEntries(x.money.practitioners.map((p: any) => [p.id, p.collected])),
  ),
  c("profile.earnedShare", "Your share", "My Profile → Performance", (x) =>
    Object.fromEntries(x.money.practitioners.map((p: any) => [p.id, p.earnedShare])),
  ),
  c("profile.collectedShare", "Collected (your share)", "My Profile → Performance", (x) =>
    Object.fromEntries(x.money.practitioners.map((p: any) => [p.id, p.collectedShare])),
  ),
  c("profile.outstandingShare", "Outstanding (your share)", "My Profile → Performance", (x) =>
    Object.fromEntries(x.money.practitioners.map((p: any) => [p.id, p.outstandingShare])),
  ),
  c("profile.csv", "CSV export (sum of shares)", "My Profile → Export CSV", (x) =>
    Object.fromEntries(x.money.practitioners.map((p: any) => [p.id, p.csvShare])),
  ),
  c("profile.treatments", "Treatments", "My Profile → Performance", (x) =>
    Object.fromEntries(x.money.practitioners.map((p: any) => [p.id, p.treatments])),
  ),
  c("profile.newPatients", "New patients (first visit)", "My Profile → Performance", (x) =>
    Object.fromEntries(x.money.practitioners.map((p: any) => [p.id, p.newPatients])),
  ),
];

const PERIODS: { key: string; selection: PeriodSelection; window: (now: number) => AuditWindow }[] = [
  { key: "12m", selection: { key: "year", offset: 0, preset: "1y" }, window: (n) => calendarMonths(n, 12) },
  { key: "1m", selection: { key: "month", offset: 0, preset: "1m" }, window: (n) => calendarMonths(n, 1) },
  {
    key: "empty",
    selection: { key: "month", offset: 0, preset: "custom", from: "2019-01-01", to: "2019-01-31" },
    window: () => dayRange("2019-01-01", "2019-01-31", "1–31 Jan 2019"),
  },
];

/** Plain objects compare by key, not key order (the pages sort their lists by count). */
function canon(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === "object")
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])]));
  return v;
}
const same = (a: unknown, b: unknown) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

describe("Insights numbers audit", () => {
  it("every figure matches the independent recalculation", () => {
    const out: Record<string, unknown> = { now: new Date(NOW).toISOString(), tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
    const mismatches: string[] = [];
    let seedProblems: string[] = [];
    for (const period of PERIODS) {
      const page = shown(NOW, period.selection);
      const truth = recalc(NOW, period.window(NOW));
      if (period.key === "12m") seedProblems = truth.seedProblems;
      const rows = CHECKS.map((check) => {
        const s = check.pick(page);
        const r = check.pick(truth);
        const match = same(s, r);
        if (!match) mismatches.push(`${period.key} ${check.id}`);
        return { id: check.id, metric: check.metric, where: check.where, shown: s, recalculated: r, match };
      });
      out[period.key] = { shownWindow: page.window, recalcWindow: truth.window, rows };
    }
    out["seedProblems"] = seedProblems;
    out["staff"] = Object.fromEntries(profiles.map((p) => [String(p["id"]), String(p["full_name"] ?? "")]));
    writeFileSync(
      new URL(`./insights-numbers${process.env["AUDIT_TAG"] ? `.${process.env["AUDIT_TAG"]}` : ""}.json`, import.meta.url),
      `${JSON.stringify(out, null, 2)}\n`,
    );
    expect(seedProblems).toEqual([]);
    expect(mismatches).toEqual([]);
  });
});
