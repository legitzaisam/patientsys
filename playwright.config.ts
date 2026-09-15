import { defineConfig, devices } from "@playwright/test";
import { DEMO_NOW } from "./e2e/fixtures";

/**
 * The regression suite runs against demo mode: the fixture data layer replaces
 * Supabase, identity comes from the demo_role cookie, and the fixture clock is
 * pinned with DEMO_NOW so diary dates never drift under the assertions.
 *
 * Port 8091 is dedicated to tests so a normal `npm run dev` on 8080 is never
 * mistaken for the demo server.
 */
export default defineConfig({
  testDir: "./e2e",
  // The demo data layer is one shared in-memory fixture set on the dev server,
  // so parallel workers would race each other's mutations. Run serially.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  reporter: process.env["CI"] ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL: "http://localhost:8091",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx vite dev --port 8091",
    url: "http://localhost:8091",
    // Always boot a fresh server: the demo fixtures are mutable in-memory
    // state, so reusing a server would leak one run's writes into the next.
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      DEMO: "1",
      DEMO_NOW,
    },
  },
});
