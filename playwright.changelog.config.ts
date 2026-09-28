import { defineConfig, devices } from "@playwright/test";

/**
 * Per-commit changelog captures. Unlike the other configs this one owns no
 * web server: scripts/changelog/walk-commits.mjs checks a commit out in a
 * worktree, starts the demo app on a port, and points this config at it.
 *
 *   CHANGELOG_BASE_URL=http://127.0.0.1:8093 \
 *   CHANGELOG_OUT=test-results/changelog-states/<sha> \
 *   CHANGELOG_SCENES=team,team-access \
 *   npx playwright test --config playwright.changelog.config.ts
 *
 * Three devices: the laptop view (Chromium, 1440 wide and tall enough for a
 * scroll-contained page), and an iPad Mini in landscape and portrait (WebKit).
 */
export default defineConfig({
  testDir: "./e2e/changelog",
  outputDir: `${process.env["CHANGELOG_OUT"] ?? "./test-results/changelog-states/adhoc"}/.pw`,
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  // One retry absorbs Vite's "outdated optimize dep" reloads on a fresh checkout.
  retries: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env["CHANGELOG_BASE_URL"] ?? "http://127.0.0.1:8093",
    actionTimeout: 8_000,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    {
      name: "chromium-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1400 } },
    },
    { name: "ipad-landscape", use: { ...devices["iPad Mini landscape"] } },
    { name: "ipad-portrait", use: { ...devices["iPad Mini"] } },
  ],
});
