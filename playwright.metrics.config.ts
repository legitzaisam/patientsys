import { defineConfig, devices } from "@playwright/test";

/**
 * Rendered-number check: every `data-qc="metric:*"` (or `data-metric`) number
 * on the clinic and patient portals equals the metrics snapshot the demo
 * server computes from the same fixture (`/api/demo/metrics`).
 *
 * The fixture clock is pinned (DEMO_NOW) so the dataset is the same on every
 * run; the pages and the snapshot both use the server's real clock, so they
 * agree on every window. Port 8093 keeps it apart from the regression suite.
 *
 *   npm run test:metrics
 *   DEMO_NOW=2026-10-01T09:00:00Z npm run test:metrics
 */
export const METRICS_NOW = process.env["DEMO_NOW"] ?? "2026-09-20T12:00:00.000Z";

export default defineConfig({
  testDir: "./e2e/metrics",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env["CI"],
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8093",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx vite dev --port 8093",
    url: "http://localhost:8093",
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DEMO: "1",
      DEMO_NOW: METRICS_NOW,
    },
  },
});
