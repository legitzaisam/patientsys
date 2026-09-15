import { test as base } from "@playwright/test";

/**
 * One pinned instant shared by the fixture data layer (via the DEMO_NOW env
 * var in playwright.config.ts) and the browser clock, so "today" agrees
 * everywhere. Local time on purpose: the demo fixtures build days in the
 * machine's timezone. 1 June 2026 is a Monday.
 */
export const DEMO_NOW = "2026-06-01T09:00:00";

export type DemoRole = "owner" | "practitioner" | "front_desk" | "patient";

type Options = {
  /** Demo persona for the test file. Override with `test.use({ role: ... })`. */
  role: DemoRole;
};

export const test = base.extend<Options>({
  role: ["owner", { option: true }],

  page: async ({ page, context, baseURL, role }, use) => {
    await context.addCookies([
      { name: "demo_role", value: role, url: baseURL ?? "http://localhost:8091" },
    ]);
    // Hide the demo persona switcher: it floats bottom-right and would
    // otherwise intercept clicks on controls near the page corner.
    await context.addInitScript(() => {
      const hide = () => {
        const style = document.createElement("style");
        style.textContent = ".fixed.bottom-5.right-5 { display: none !important; }";
        document.head.appendChild(style);
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", hide);
      } else {
        hide();
      }
    });
    // Keep the browser's idea of "now" on the same instant as the fixtures.
    await page.clock.install({ time: new Date(DEMO_NOW) });
    await use(page);
  },
});

export { expect } from "@playwright/test";
