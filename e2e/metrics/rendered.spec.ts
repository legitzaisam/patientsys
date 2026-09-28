import { expect, test, type Page } from "@playwright/test";

/**
 * Every number the portals render with `data-qc="metric:<id>"` (or a chip's
 * `data-metric="<id>"`) equals the metrics snapshot the demo server computes
 * from the same fixture at the same clock (`/api/demo/metrics`). One promise
 * per page, per persona: what the page shows is what the definitions say.
 *
 * Runs under playwright.metrics.config.ts (port 8093, pinned DEMO_NOW).
 */

const USERS = {
  practitioner: "10000000-0000-4000-8000-000000000002",
  patient: "10000000-0000-4000-8000-000000000005",
} as const;

type Persona = "owner" | "admin" | "practitioner" | "front_desk" | "patient";

type Snapshot = {
  dashboard: Record<string, number>;
  retention: Record<string, number | { rate: number | null }>;
  insights: {
    book: Record<string, number>;
    funnel: { signUps: number; bookedCount: number; consulted: number; converted: number } | null;
    composition: Record<string, number>;
    neverTreated: number;
    firstToSecond: { rate: number | null };
  };
  performance: {
    earned: number;
    collected: number;
    outstanding: number;
    bookedAhead: number;
    perPractitioner: Record<
      string,
      {
        earned: number;
        collected: number;
        treatmentsCompleted: number;
        share: { earned: number; collected: number };
      }
    >;
  };
  offers: { stages: Record<string, number>; results: Record<string, Record<string, number>> };
  portal: { planDone: number; planTotal: number } | null;
};

/** The number a rendered string carries: "£1,234" → 1234, "12 due" → 12, "—" → 0. */
function numberIn(text: string): number {
  const cleaned = text.replace(/,/g, "");
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  if (!match) return 0;
  return Number(match[0]);
}

/**
 * Expected value for a metric id, or undefined when the snapshot has no such
 * promise. `snap` is scoped to the persona (a practitioner's own book);
 * `clinic` is the whole clinic, which the Patients list always counts.
 */
function expected(id: string, snap: Snapshot, clinic: Snapshot): number | undefined {
  const [area, ...rest] = id.split(".");
  const key = rest.join(".");
  switch (area) {
    case "dashboard":
      return snap.dashboard[key];
    case "patients": {
      const map: Record<string, string> = {
        all: "totalClients",
        active: "activeClients",
        inactive: "inactiveClients",
        due: "treatmentsDue",
        nobooking: "noUpcomingBooking",
      };
      return map[key] ? clinic.dashboard[map[key]] : undefined;
    }
    case "retention": {
      const v = snap.retention[key];
      return typeof v === "number" ? v : undefined;
    }
    case "insights": {
      // Insights is a clinic-wide report; "Never treated" is the whole book's count.
      if (rest[0] === "composition" && rest[1] === "never") return clinic.insights.neverTreated;
      if (rest[0] === "composition") return clinic.insights.composition[rest[1] ?? ""];
      if (rest[0] === "book") return clinic.insights.book[rest[1] ?? ""];
      if (rest[0] === "funnel" && clinic.insights.funnel) {
        const f = clinic.insights.funnel;
        const map: Record<string, number> = {
          signUps: f.signUps,
          booked: f.bookedCount,
          consulted: f.consulted,
          treated: f.converted,
        };
        return map[rest[1] ?? ""];
      }
      return undefined;
    }
    case "performance": {
      if (rest[0] === "practitioner") {
        const row = snap.performance.perPractitioner[rest[1] ?? ""];
        if (!row) return undefined;
        if (rest[2] === "earned") return Math.round(row.earned);
        if (rest[2] === "earnedShare") return Math.round(row.share.earned);
        if (rest[2] === "treatments") return row.treatmentsCompleted;
        return undefined;
      }
      const v = (snap.performance as unknown as Record<string, number>)[key];
      return typeof v === "number" ? Math.round(v) : undefined;
    }
    case "earnings": {
      const mine = snap.performance.perPractitioner[USERS.practitioner];
      if (!mine) return undefined;
      if (key === "share") return Math.round(mine.share.earned);
      if (key === "collected") return Math.round(mine.share.collected);
      if (key === "treatments") return mine.treatmentsCompleted;
      return undefined;
    }
    case "offers": {
      if (rest[0] === "stage") return snap.offers.stages[rest[1] ?? ""];
      if (rest[0] === "results") {
        // A template nobody has been sent yet has no bucket: every step is 0.
        const bucket = snap.offers.results[rest[1] ?? ""] ?? {
          sent: 0,
          claimed: 0,
          booked: 0,
          revenue: 0,
        };
        const v = bucket[rest[2] ?? ""];
        return typeof v === "number" ? Math.round(v) : undefined;
      }
      return undefined;
    }
    case "portal":
      return snap.portal ? snap.portal[key as "planDone" | "planTotal"] : undefined;
    default:
      return undefined;
  }
}

async function renderedMetrics(page: Page) {
  return page.evaluate(() => {
    const out: { id: string; text: string }[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('[data-qc^="metric:"]')) {
      out.push({ id: el.dataset["qc"]!.slice("metric:".length), text: el.innerText.trim() });
    }
    for (const el of document.querySelectorAll<HTMLElement>("[data-metric]")) {
      out.push({ id: el.dataset["metric"]!, text: el.innerText.trim() });
    }
    return out;
  });
}

async function snapshotFor(page: Page, persona: Persona | "clinic"): Promise<Snapshot> {
  const params = new URLSearchParams();
  if (persona === "practitioner") params.set("practitioner", USERS.practitioner);
  if (persona === "patient") params.set("patientUser", USERS.patient);
  const response = await page.request.get(`/api/demo/metrics?${params.toString()}`);
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Snapshot;
}

async function become(page: Page, persona: Persona) {
  await page
    .context()
    .addCookies([{ name: "demo_role", value: persona, url: "http://localhost:8093" }]);
}

const PAGES: Record<Persona, string[]> = {
  owner: [
    "/dashboard",
    "/patients",
    "/retention",
    "/insights",
    "/insights?tab=book",
    "/performance",
    "/offers",
  ],
  admin: ["/dashboard", "/patients", "/performance", "/offers"],
  practitioner: ["/dashboard", "/patients", "/insights?tab=book", "/profile"],
  front_desk: ["/dashboard", "/patients"],
  patient: ["/my-record"],
};

for (const persona of Object.keys(PAGES) as Persona[]) {
  test.describe(`${persona}`, () => {
    for (const path of PAGES[persona]) {
      test(`${path} renders the snapshot's numbers`, async ({ page }) => {
        await become(page, persona);
        await page.goto(path);
        // Wait until the page has finished loading its figures: no skeletons,
        // and at least one hooked number present (the loading grid never
        // renders a "0" placeholder, so a present hook is a settled hook).
        await expect(page.locator('[data-qc="kpi-grid-loading"]')).toHaveCount(0, {
          timeout: 15_000,
        });
        await expect(page.locator('[data-qc^="metric:"], [data-metric]').first()).toBeVisible({
          timeout: 15_000,
        });
        // Give the remaining queries a beat to land; the assertion below re-reads anyway.
        await page.waitForLoadState("networkidle");

        const snap = await snapshotFor(page, persona);
        const clinic = persona === "practitioner" ? await snapshotFor(page, "clinic") : snap;
        const rendered = await renderedMetrics(page);
        expect(rendered.length).toBeGreaterThan(0);

        const unknown = rendered
          .filter((m) => expected(m.id, snap, clinic) === undefined)
          .map((m) => m.id);
        expect(
          unknown,
          `every hooked number needs a snapshot promise: ${unknown.join(", ")}`,
        ).toEqual([]);

        const mismatches = rendered
          .map((m) => ({ ...m, want: expected(m.id, snap, clinic)!, got: numberIn(m.text) }))
          .filter((m) => m.got !== m.want)
          .map((m) => `${m.id}: page ${m.got} ("${m.text}") vs snapshot ${m.want}`);
        expect(mismatches, mismatches.join("\n")).toEqual([]);
      });
    }
  });
}
