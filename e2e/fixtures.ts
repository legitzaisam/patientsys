import { test as base } from "@playwright/test";

/**
 * The demo fixtures generate relative to the server's real clock, and the
 * server handlers use the real clock too (reminder scheduling, drain, "today"
 * ranges). Pinning only part of that stack desynchronises it, so tests run on
 * real time and compute any date they assert. DEMO_NOW (vite define) remains
 * available for date-frozen screenshot work outside this suite.
 */

/** datetime-local value for `days` from now at a fixed local time. */
export function localDateTime(daysAhead: number, hour: number, minute: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(hour)}:${pad(minute)}`;
}

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
    // Keep the page corners clear of chrome that would intercept clicks:
    // the demo persona switcher (bottom-left) and the staff floating dock.
    // The patient portal's own dock stays visible — its two bubbles are
    // under test.
    await context.addInitScript(() => {
      const hide = () => {
        const style = document.createElement("style");
        style.textContent =
          '.fixed.bottom-5.left-5, [data-qc="floating-dock"] { display: none !important; }';
        document.head.appendChild(style);
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", hide);
      } else {
        hide();
      }
    });
    await use(page);
  },
});

export { expect } from "@playwright/test";
