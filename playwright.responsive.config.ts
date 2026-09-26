import { defineConfig, devices } from "@playwright/test";

/**
 * Device-matrix QC for responsiveness. Separate from playwright.config.ts so
 * `npm run test:e2e` stays the fast Chromium regression suite.
 *
 * iPhone and iPad run in WebKit (Safari's engine), laptop and desktop in
 * Chromium. The matrix spec only reads; the interactions spec taps and
 * drags but every write it makes is idempotent, so projects can share the
 * one demo server in parallel. RESPONSIVE_WORKERS overrides the worker count.
 */
const workers = Number(process.env["RESPONSIVE_WORKERS"] ?? "3") || 3;

export default defineConfig({
  testDir: "./e2e/responsive",
  outputDir: "./test-results/responsive/artifacts",
  fullyParallel: false,
  workers,
  timeout: 120_000,
  forbidOnly: !!process.env["CI"],
  retries: 0,
  reporter: [["list"], ["json", { outputFile: "test-results/responsive/playwright.json" }]],
  use: {
    baseURL: "http://localhost:8091",
    // A control hidden under floating chrome makes tap() wait; fail it fast
    // so the interaction check can record "covered" instead of timing out.
    actionTimeout: 8_000,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "iphone-se",
      use: { ...devices["iPhone SE"], viewport: { width: 375, height: 667 } },
    },
    {
      name: "iphone-15",
      use: { ...devices["iPhone 15"] },
    },
    {
      name: "ipad-mini-portrait",
      use: { ...devices["iPad Mini"] },
    },
    {
      name: "ipad-pro-landscape",
      use: { ...devices["iPad Pro 11 landscape"] },
    },
    {
      name: "laptop-1366",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1366, height: 768 } },
    },
    {
      name: "laptop-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "desktop-1920",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1920, height: 1080 } },
    },
  ],
  webServer: {
    command: "npx vite dev --port 8091",
    url: "http://localhost:8091",
    reuseExistingServer: !!process.env["RESPONSIVE_REUSE_SERVER"],
    timeout: 60_000,
    env: { DEMO: "1" },
  },
});
