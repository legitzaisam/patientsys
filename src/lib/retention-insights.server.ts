/**
 * "Where to focus" — the clinic's recommendation engine, extracted from the
 * retention maths so it can grow on its own.
 *
 * Today the insights are heuristic rules over the retention signals below.
 * The shape is deliberately a pure `signals in → typed insights out` function
 * so a future engine (an API call, a model scoring outreach uplift as the
 * clinic accumulates data) can replace the body without touching the report
 * builder or the UI: both only know the `RetentionInsight` contract.
 *
 * Server-only: imported by retention.server.ts, never by a component.
 */
import type { RiskLevel } from "./retention.server";

export type InsightSeverity = "urgent" | "attention" | "opportunity";

export type InsightIcon = "clock" | "wave" | "trend" | "repeat" | "winback";

export type RetentionInsight = {
  id: string;
  severity: InsightSeverity;
  icon: InsightIcon;
  title: string;
  detail: string;
  /** Clicking an insight focuses the at-risk table on this risk band. */
  filter: RiskLevel | "all";
};

export type RetentionSignals = {
  counts: { overdue: number; lapsing: number; lost: number };
  /** Rolling 12-month retention rate per month, oldest first. */
  monthly: { rate: number }[];
  /** New-patient cohorts with their second-visit conversion. */
  cohorts: { patients: number; secondRate: number }[];
};

export function deriveRetentionInsights(signals: RetentionSignals): RetentionInsight[] {
  const { counts, monthly, cohorts } = signals;
  const insights: RetentionInsight[] = [];

  if (counts.overdue) {
    insights.push({
      id: "overdue",
      severity: "urgent",
      icon: "clock",
      title: `${counts.overdue} patient${counts.overdue === 1 ? " is" : "s are"} overdue for a treatment`,
      detail: "Send a recall message so they rebook before the effect wears off.",
      filter: "overdue",
    });
  }
  if (counts.lapsing) {
    insights.push({
      id: "lapsing",
      severity: "attention",
      icon: "wave",
      title: `${counts.lapsing} patient${counts.lapsing === 1 ? "" : "s"} last seen 3-6 months ago`,
      detail: "A short check-in now is the cheapest way to keep them on the books.",
      filter: "lapsing",
    });
  }

  const latest = monthly[monthly.length - 1];
  const monthBefore = monthly[monthly.length - 2];
  if (latest && monthBefore && latest.rate < monthBefore.rate) {
    insights.push({
      id: "dip",
      severity: "attention",
      icon: "trend",
      title: `Retention dipped ${monthBefore.rate - latest.rate}% this month`,
      detail: `Now ${latest.rate}%, down from ${monthBefore.rate}%. Check no-shows and follow-up bookings at discharge.`,
      filter: "all",
    });
  }

  const lastCohort = cohorts[cohorts.length - 1];
  const secondCohort = cohorts.filter((c) => c.patients >= 3).slice(-3);
  const avgSecond = secondCohort.length
    ? Math.round(secondCohort.reduce((s, c) => s + c.secondRate, 0) / secondCohort.length)
    : (lastCohort?.secondRate ?? 0);
  if (secondCohort.length && avgSecond < 60) {
    insights.push({
      id: "second-visit",
      severity: "opportunity",
      icon: "repeat",
      title: `Only ${avgSecond}% of new patients return for a second treatment`,
      detail: "Book the follow-up before they leave the clinic, and send an aftercare message at two weeks.",
      filter: "all",
    });
  }

  if (counts.lost) {
    insights.push({
      id: "lost",
      severity: "opportunity",
      icon: "winback",
      title: `${counts.lost} patient${counts.lost === 1 ? " has" : "s have"} not been seen for 6 months`,
      detail: "Worth one win-back message before marking them inactive.",
      filter: "lost",
    });
  }

  return insights;
}
