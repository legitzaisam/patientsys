#!/usr/bin/env node
/**
 * Metrics guard. Runs the cross-page consistency suite over the demo fixture
 * with a pinned clock (vitest.metrics.config.ts) and prints the numbers every
 * page must agree on. Fails when any invariant fails.
 *
 *   npm run check:metrics
 *   DEMO_NOW=2026-10-01T09:00:00Z npm run check:metrics
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const run = spawnSync(
  "npx",
  ["vitest", "run", "--config", "vitest.metrics.config.ts", "--reporter=dot"],
  {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    env: process.env,
  },
);
const out = `${run.stdout ?? ""}${run.stderr ?? ""}`;
const summary = out.match(/Tests\s+.*$/m)?.[0]?.trim() ?? "";

const file = "test-results-metrics/snapshot.json";
if (!existsSync(file)) {
  console.error(out);
  console.error("metrics check FAILED — no snapshot written");
  process.exit(1);
}
const snap = JSON.parse(readFileSync(file, "utf8"));

const pad = (s, n) => String(s).padEnd(n);
const money = (n) => `£${Number(n).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
const lines = [];
const row = (page, metric, value, rule) =>
  lines.push(`  ${pad(page, 12)} ${pad(metric, 26)} ${pad(value, 12)} ${rule}`);

console.log(
  `metrics snapshot — demo fixture, now ${snap.now}, window last 12 months, ${snap.patients} patients`,
);
console.log(`  ${pad("page", 12)} ${pad("metric", 26)} ${pad("value", 12)} definition`);
row(
  "dashboard",
  "treatments due",
  snap.dashboard.treatmentsDue,
  "overdue + due soon, active patients with nothing booked",
);
row("dashboard", "  overdue", snap.dashboard.treatmentsOverdue, "next due date in the past");
row("dashboard", "  due soon", snap.dashboard.treatmentsDueSoon, "next due date within 30 days");
row("dashboard", "to chase", snap.dashboard.toChase, "= retention at risk");
row("retention", "at risk", snap.retention.atRisk, "overdue + due soon + lapsing + lost");
row("retention", "  lapsing", snap.retention.lapsing, "no due date, 90–180 days since last visit");
row("retention", "  lost", snap.retention.lost, "no due date, over 180 days since last visit");
row(
  "retention",
  "one visit only",
  snap.retention.oneVisitOnly,
  "= insights treated once (seen in window)",
);
row("insights", "treated once", snap.insights.composition.once, "exactly one visit, any treatment");
row("insights", "two or more", snap.insights.composition.twoPlus, "two or more visits");
row("insights", "seen in window", snap.insights.composition.total, "never + once + two or more");
row(
  "insights",
  "first-to-second",
  snap.insights.firstToSecond.rate === null ? "—" : `${snap.insights.firstToSecond.rate}%`,
  `${snap.insights.firstToSecond.returned} of ${snap.insights.firstToSecond.cohort} within 180 days (${snap.insights.firstToSecond.pending} too early)`,
);
row("performance", "earned", money(snap.performance.earned), "treatments performed in the window");
row("performance", "collected", money(snap.performance.collected), "paid in full + deposit share");
row("performance", "outstanding", money(snap.performance.outstanding), "earned − collected");
row(
  "performance",
  "booked ahead",
  money(snap.performance.bookedAhead),
  "live future bookings (not collected)",
);
row(
  "offers",
  "pre-consultation",
  snap.offers.stages.pre_consultation,
  "no consult, nothing booked",
);
row(
  "offers",
  "post-consultation",
  snap.offers.stages.post_consultation,
  "consulted, no treatment, nothing booked",
);
row(
  "offers",
  "single treatment",
  snap.offers.stages.single_treatment,
  "one treatment, nothing booked, no plan",
);
row("offers", "plan ending", snap.offers.stages.plan_ending, "active plan nearing its end");
console.log(lines.join("\n"));
console.log("");

if (run.status !== 0) {
  console.error(
    out
      .split("\n")
      .filter((l) => /FAIL|AssertionError|expected|Error:/.test(l))
      .join("\n"),
  );
  console.error(`metrics check FAILED — ${summary}`);
  process.exit(1);
}
console.log(`metrics check ok — ${summary}`);
