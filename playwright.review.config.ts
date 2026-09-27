import { defineConfig, devices } from "@playwright/test";

/**
 * Review capture pack: one JPEG per scene per device under
 * docs/portal-feedback/captures/, plus docs/portal-feedback/REVIEW.md mapping
 * every feedback bullet to its status and captures. Chromium at 1440 for the
 * laptop view; iPad Mini and iPhone 15 in WebKit for the tablet and phone.
 *
 *   npm run review:captures
 */
export default defineConfig({
  testDir: "./e2e/review",
  outputDir: "./test-results-review",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  forbidOnly: !!process.env["CI"],
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:8092",
    actionTimeout: 10_000,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    { name: "iphone-15", use: { ...devices["iPhone 15"] } },
    { name: "ipad-mini", use: { ...devices["iPad Mini"] } },
    {
      name: "chromium-1440",
      // Tall, so a scroll-contained page shows more than one screen of content.
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1400 } },
    },
  ],
  webServer: {
    command: "npx vite dev --port 8092",
    url: "http://localhost:8092",
    reuseExistingServer: false,
    timeout: 60_000,
    env: { DEMO: "1" },
  },
});
