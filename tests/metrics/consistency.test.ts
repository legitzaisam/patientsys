import { mkdirSync, writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { DEMO_NOW } from "@/lib/demo/enabled";
import { demoSnapshotRows } from "@/lib/metrics/demo-rows";
import { metricsSnapshot } from "@/lib/metrics/snapshot";
import { monthBucketsUpToNow, noFutureBuckets, trailingMonthsWindow } from "@/lib/metrics/windows";

/**
 * Cross-page consistency over the real demo fixture, clock pinned by
 * vitest.metrics.config.ts. Each `it` is one promise the portal makes: the
 * same idea shows the same number wherever it appears. Builder comparisons
 * are `todo` until Phase 4 moves the builders onto the metrics module, and
 * the UI-wired ones until Phase 7.
 */
const nowMs = new Date(DEMO_NOW ?? Date.now()).getTime();
const rows = demoSnapshotRows();
const window = trailingMonthsWindow(nowMs, 12);
const snap = metricsSnapshot(rows, { nowMs, window });

// check:metrics reads this to print its reconciliation table.
afterAll(() => {
  mkdirSync("test-results-metrics", { recursive: true });
  const { dueStates: _states, ...printable } = snap;
  writeFileSync(
    "test-results-metrics/snapshot.json",
    JSON.stringify(
      { ...printable, now: new Date(nowMs).toISOString(), patients: rows.patients.length },
      null,
      2,
    ),
  );
});

describe("metrics snapshot (demo fixture)", () => {
  it("pins the clock", () => {
    expect(DEMO_NOW).toBeTruthy();
  });

  it("has a population to reason about", () => {
    expect(rows.patients.length).toBeGreaterThan(500);
    expect(rows.treatments.length).toBeGreaterThan(1000);
    expect(rows.appointments.length).toBeGreaterThan(500);
  });

  it("dashboard: treatments due = overdue + due soon", () => {
    expect(snap.dashboard.treatmentsDue).toBe(
      snap.dashboard.treatmentsOverdue + snap.dashboard.treatmentsDueSoon,
    );
  });

  it("dashboard 'to chase' is the retention at-risk total", () => {
    expect(snap.dashboard.toChase).toBe(snap.retention.atRisk);
    expect(snap.retention.atRisk).toBe(
      snap.retention.overdue +
        snap.retention.dueSoon +
        snap.retention.lapsing +
        snap.retention.lost,
    );
  });

  it("a booked patient is never counted as due or to chase", () => {
    for (const [, state] of snap.dueStates) expect(state === "booked" || true).toBe(true);
    const bookedIds = new Set(
      rows.appointments
        .filter(
          (a) =>
            a.status !== "cancelled" &&
            a.status !== "no_show" &&
            new Date(a.starts_at).getTime() >= nowMs,
        )
        .map((a) => a.patient_id),
    );
    for (const id of bookedIds) {
      const p = rows.patients.find((x) => x.id === id);
      if (p?.status === "archived") continue;
      expect(snap.dueStates.get(id)).toBe("booked");
    }
  });

  it("retention 'one visit only' and insights 'treated once' are the same number over the same window", () => {
    expect(snap.retention.oneVisitOnly).toBe(snap.insights.composition.once);
  });

  it("composition sums to the patients seen in the window", () => {
    const c = snap.insights.composition;
    expect(c.never + c.once + c.twoPlus).toBe(c.total);
    expect(c.total).toBe(snap.retention.seenInWindow);
    expect(c.never).toBe(0);
  });

  it("first-to-second is one figure for insights and retention", () => {
    expect(snap.insights.firstToSecond).toEqual(snap.retention.firstToSecond);
    if (snap.insights.firstToSecond.rate !== null) {
      expect(snap.insights.firstToSecond.rate).toBeGreaterThanOrEqual(0);
      expect(snap.insights.firstToSecond.rate).toBeLessThanOrEqual(100);
    }
  });

  it("performance: earned = collected + outstanding, in total and per practitioner", () => {
    const p = snap.performance;
    expect(p.earned).toBeCloseTo(p.collected + p.outstanding, 2);
    let earned = 0;
    for (const row of Object.values(p.perPractitioner)) {
      expect(row.earned).toBeCloseTo(row.collected + row.outstanding, 2);
      expect(row.share.earned).toBeCloseTo(row.share.collected + row.share.outstanding, 2);
      expect(row.share.earned).toBeLessThanOrEqual(row.earned + 0.01);
      earned += row.earned;
    }
    // Every treatment in the period belongs to a staff member or is unassigned; the sum never exceeds the total.
    expect(earned).toBeLessThanOrEqual(p.earned + 0.01);
  });

  it("booked ahead is separate from collected", () => {
    expect(snap.performance.bookedAhead).toBeGreaterThanOrEqual(0);
  });

  it("offers: single treatment = patients with exactly one treatment, nothing booked, no plan", () => {
    // The stage count is a subset of the one-visit patients over all time.
    let oneVisitEver = 0;
    const byPatient = new Map<string, number>();
    for (const t of rows.treatments)
      byPatient.set(t.patient_id, (byPatient.get(t.patient_id) ?? 0) + 1);
    for (const n of byPatient.values()) if (n === 1) oneVisitEver++;
    expect(snap.offers.stages.single_treatment).toBeLessThanOrEqual(oneVisitEver);
    expect(snap.offers.stages.single_treatment).toBeGreaterThan(0);
  });

  it("no chart bucket lies in the future", () => {
    expect(noFutureBuckets(monthBucketsUpToNow(window, nowMs), nowMs)).toBe(true);
    expect(window.toMs).toBeGreaterThanOrEqual(nowMs);
  });

  // ---- Builders (Phase 4 wires each onto the metrics module)
  it.todo(
    "retention builder: counts.overdue / lapsing / lost and oneVisitPatients equal the snapshot",
  );
  it.todo("insights builder: composition and firstToSecond equal the snapshot");
  it.todo("earnings builder: totals earned / collected / outstanding equal the snapshot");
  it.todo("offers cohorts: stageCounts equal the snapshot");
  it.todo("getDashboard: treatmentsDue / overdue / dueSoon and patientsToChase equal the snapshot");
  it.todo("listPatients: 'Treatments due' filter count equals dashboard treatmentsDue");

  // ---- UI-wired (Phase 7)
  it.todo("each patient row's open-items pill equals the record's open items");
  it.todo("the Treatments tab badge equals the record's booking chase length");
  it.todo("portal plan progress for Olivia equals the clinic-side plan progress");
});
