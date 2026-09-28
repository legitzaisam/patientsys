import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

/**
 * QC for the website ↔ demo app stitching. Boots the demo app (port 8094) and
 * the launch gateway in front of it (port 8097, serving website/dist), then
 * checks every website link, every demo entry, every return path from the app
 * and the gateway plumbing. Writes launch-plan/qc/REPORT.md.
 *
 *   ./launch-plan/qc/run.sh            (builds the website first)
 *   npx playwright test --config launch-plan/qc/playwright.config.ts
 *
 * Ports 8094 and 8097 are used so nothing collides with `npm run dev` (8080),
 * the e2e suite (8091) or a running public demo (8090 / 8099).
 */
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
export const APP_PORT = 8094;
export const GATEWAY_PORT = 8097;
export const BASE_URL = `http://127.0.0.1:${GATEWAY_PORT}`;
const DEMO_NOW = process.env["DEMO_NOW"] ?? "2026-09-28T09:30:00Z";

export default defineConfig({
  testDir: here,
  testMatch: /.*\.spec\.ts/,
  outputDir: path.join(here, ".pw"),
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  retries: 0,
  reporter: [["list"], [path.join(here, "report.ts")]],
  use: {
    baseURL: BASE_URL,
    actionTimeout: 10_000,
    trace: "retain-on-failure",
    screenshot: "off",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
    // The phone only repeats the link crawl and the demo entries; plumbing checks are device-independent.
    { name: "phone", use: { ...devices["iPhone 15"] }, testMatch: /(links|demo-entry)\.spec\.ts/ },
  ],
  webServer: [
    {
      command: `npx vite dev --port ${APP_PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${APP_PORT}/auth/callback`,
      cwd: root,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { DEMO: "1", DEMO_NOW, DEMO_SIGNIN_URL: "/login" },
    },
    {
      command: `node launch-plan/gateway/server.mjs`,
      url: `${BASE_URL}/healthz`,
      cwd: root,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        GATEWAY_PORT: String(GATEWAY_PORT),
        APP_PORT: String(APP_PORT),
        WEBSITE_DIST: path.join(root, "launch-plan/website/dist"),
        GATEWAY_QUIET: "1",
      },
    },
  ],
});
