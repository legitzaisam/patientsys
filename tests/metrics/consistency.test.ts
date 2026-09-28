import { mkdirSync, writeFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/lib/demo/data";
import { DEMO_NOW } from "@/lib/demo/enabled";
import { buildStats, earningsInputs } from "@/lib/earnings.server";
import { buildBookMetrics } from "@/lib/insights.server";
import { demoSnapshotRows } from "@/lib/metrics/demo-rows";
import { metricsSnapshot } from "@/lib/metrics/snapshot";
import { DEFAULT_PERIOD, chartBuckets, periodIso, resolvePeriod } from "@/lib/metrics/period";
import { buildStageCohorts, stageCounts } from "@/lib/offers/cohorts";
import { buildRetention } from "@/lib/retention.server";

/**
 * Cross-page consistency over the real demo fixture, clock pinned by
 * vitest.metrics.config.ts. Each `it` is one promise the portal makes: the
 * same idea shows the same number wherever it appears: every page builder
 * is fed the rows its demo server function hands it and must equal the
 * snapshot, which composes the same metrics module.
 */
const nowMs = new Date(DEMO_NOW ?? Date.now()).getTime();
const rows = demoSnapshotRows();
const window = resolvePeriod(DEFAULT_PERIOD, nowMs);
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

  it("no chart bucket lies in the future, and 12 months is 12 bars", () => {
    const buckets = chartBuckets(window, nowMs);
    expect(buckets.every((b) => b.startMs <= nowMs)).toBe(true);
    expect(buckets).toHaveLength(12);
    expect(window.toMs).toBeGreaterThanOrEqual(nowMs);
  });

  // ---- Builders (Phase 4 wired each onto the metrics module). Each is fed
  // the same rows the demo server functions hand it.
  const fixture = db as unknown as Record<string, Record<string, unknown>[]>;

  it("retention builder: counts.overdue / dueSoon / lapsing / lost and oneVisitPatients equal the snapshot", () => {
    const result = buildRetention({
      patients: fixture["patients"]!.map((p) => ({
        id: String(p["id"]),
        title: (p["title"] as string | null) ?? null,
        first_name: String(p["first_name"] ?? ""),
        last_name: String(p["last_name"] ?? ""),
        status: String(p["status"] ?? "active"),
        email: (p["email"] as string | null) ?? null,
        phone: (p["phone"] as string | null) ?? null,
        created_at: String(p["created_at"] ?? ""),
        deleted_at: (p["deleted_at"] as string | null) ?? null,
      })),
      treatments: rows.treatments.map((t) => ({
        id: t.id,
        appointment_id: t.appointment_id ?? null,
        patient_id: t.patient_id,
        practitioner_id: t.practitioner_id ?? null,
        name: t.name ?? "",
        price: t.price ?? null,
        performed_at: t.performed_at,
        next_due_at: t.next_due_at ?? null,
      })),
      appointments: rows.appointments.map((a) => ({
        id: a.id,
        payment_status: a.payment_status ?? null,
        patient_id: a.patient_id,
        practitioner_id: a.practitioner_id ?? null,
        starts_at: a.starts_at,
        status: a.status ?? "booked",
      })),
      outreach: [],
      practitionerNames: new Map(),
      now: nowMs,
      window: { from: window.fromMs, to: window.toMs, key: "year" },
    });
    expect(result.summary.counts).toEqual({
      overdue: snap.retention.overdue,
      dueSoon: snap.retention.dueSoon,
      lapsing: snap.retention.lapsing,
      lost: snap.retention.lost,
    });
    expect(result.summary.atRiskCount).toBe(snap.retention.atRisk);
    expect(result.summary.oneVisitPatients).toBe(snap.retention.oneVisitOnly);
    expect(result.summary.repeatPatients).toBe(snap.retention.repeat);
    expect(result.summary.firstToSecond.rate).toBe(snap.retention.firstToSecond.rate);
    expect(result.summary.firstToSecond.cohort).toBe(snap.retention.firstToSecond.cohort);
  });

  it("insights builder: composition and firstToSecond equal the snapshot", () => {
    const book = buildBookMetrics({
      now: new Date(nowMs),
      ...periodIso(DEFAULT_PERIOD, nowMs),
      patients: fixture["patients"] as never,
      treatments: fixture["treatments"] as never,
      appointments: fixture["appointments"] as never,
    });
    expect(book.composition.treatedOnce).toBe(snap.insights.composition.once);
    expect(book.composition.multiTreatment).toBe(snap.insights.composition.twoPlus);
    expect(book.composition.seen).toBe(snap.retention.seenInWindow);
    expect(book.secondVisit.rate).toBe(snap.insights.firstToSecond.rate);
    expect(book.secondVisit.cohort).toBe(snap.insights.firstToSecond.cohort);
    expect(book.secondVisit.pending).toBe(snap.insights.firstToSecond.pending);
    expect(book.totals).toEqual(snap.insights.book);
    expect(book.composition.neverTreated).toBe(snap.insights.neverTreated);
  });

  it("earnings builder: totals earned / collected / outstanding / booked ahead equal the snapshot", () => {
    const period = {
      from: new Date(window.fromMs).toISOString(),
      to: new Date(window.toMs).toISOString(),
    };
    const staff = rows.staff.map((s) => ({
      userId: s.userId,
      fullName: "",
      jobTitle: "",
      commissionRate: s.commissionRate,
    }));
    const inputs = earningsInputs({
      ...period,
      nowMs,
      depositPercent: Number(rows.clinic.deposit_percent ?? 30),
      patients: rows.patients,
      treatments: rows.treatments as never,
      appointments: rows.appointments as never,
    });
    const stats = buildStats(
      staff,
      inputs.treatments as never,
      inputs.appointments as never,
      inputs.yearTreatments as never,
      inputs.firstSeen,
      period,
      inputs.money,
    );
    const sum = (key: "earned" | "collected" | "outstanding" | "bookedAhead") =>
      Math.round(stats.reduce((acc, s) => acc + s[key], 0) * 100) / 100;
    expect(sum("earned")).toBe(snap.performance.earned);
    expect(sum("collected")).toBe(snap.performance.collected);
    expect(sum("outstanding")).toBe(snap.performance.outstanding);
    expect(sum("bookedAhead")).toBe(snap.performance.bookedAhead);
    for (const s of stats) {
      const expected = snap.performance.perPractitioner[s.userId]!;
      expect(s.earned).toBe(expected.earned);
      expect(s.collected).toBe(expected.collected);
      expect(s.treatments).toBe(expected.treatmentsCompleted);
      expect(s.earnedShare).toBe(expected.share.earned);
      expect(s.collectedShare).toBe(expected.share.collected);
    }
  });

  it("offers cohorts: stageCounts equal the snapshot", () => {
    const activePlans = fixture["treatmentPlans"]!.filter((p) => p["status"] === "active");
    const planIds = new Set(activePlans.map((p) => p["id"]));
    const members = buildStageCohorts({
      patients: fixture["patients"] as never,
      appointments: fixture["appointments"] as never,
      treatments: fixture["treatments"] as never,
      catalogue: fixture["catalogue"] as never,
      plans: activePlans as never,
      milestones: fixture["planMilestones"]!.filter((m) => planIds.has(m["plan_id"])) as never,
      offers: fixture["patientOffers"] as never,
      now: new Date(nowMs),
    });
    expect(stageCounts(members)).toEqual(snap.offers.stages);
  });

  // getDashboard and listPatients are server functions; e2e/metrics/rendered.spec.ts
  // (`npm run test:metrics`) compares what they render — the KPI cards and
  // chips, the Patients list filter counts — with /api/demo/metrics, which
  // serves this same snapshot at the server's clock.

  // ---- UI-wired: asserted against the rendered pages in e2e/patients.spec.ts
  // ("record: what the list promises, the record shows"): the list's open-items
  // pill = the record's Recall tasks card, the Treatments badge = the Upcoming
  // appointments list, and the portal's plan progress = the record's plan card.
});
