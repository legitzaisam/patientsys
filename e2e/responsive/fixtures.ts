import { test as base, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Shared plumbing for the responsive matrix.
 *
 * Unlike e2e/fixtures.ts, nothing is hidden: the demo role switcher and the
 * staff dock are part of the surface under test, because on a phone they
 * are exactly what collides with the content.
 */

export type DemoRole = "owner" | "practitioner" | "front_desk" | "patient" | "admin" | "public";

export const BASE = "http://localhost:8091";
export const OUT_DIR = join(process.cwd(), "test-results", "responsive");

export type DeviceClass = "phone" | "tablet" | "laptop" | "desktop";

export function deviceClassFor(project: string): DeviceClass {
  if (project.startsWith("iphone")) return "phone";
  if (project.startsWith("ipad")) return "tablet";
  if (project.startsWith("laptop")) return "laptop";
  return "desktop";
}

export async function become(page: Page, role: DemoRole) {
  const context = page.context();
  await context.clearCookies();
  if (role !== "public") {
    await context.addCookies([{ name: "demo_role", value: role, url: BASE }]);
  }
}

export type RuntimeErrors = { console: string[]; page: string[]; requests: string[] };

/** Collect console errors, page errors and failed requests for the life of the page. */
export function watchRuntime(page: Page): RuntimeErrors {
  const errors: RuntimeErrors = { console: [], page: [], requests: [] };
  page.on("console", (message) => {
    if (message.type() === "error") errors.console.push(message.text().slice(0, 300));
  });
  page.on("pageerror", (error) => errors.page.push(error.message.slice(0, 300)));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "";
    // Aborted requests are navigation churn, not failures.
    if (/aborted|cancelled/i.test(failure)) return;
    errors.requests.push(`${request.method()} ${request.url()} ${failure}`.slice(0, 300));
  });
  return errors;
}

export function writeJson(relPath: string, data: unknown) {
  const full = join(OUT_DIR, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, JSON.stringify(data, null, 2));
  return full;
}

export function shotPath(project: string, slug: string) {
  const full = join(OUT_DIR, "shots", project, `${slug}.png`);
  mkdirSync(dirname(full), { recursive: true });
  return full;
}

/**
 * The shell scrolls inside #app-main-scroll, so a document full-page capture
 * is just the viewport. Let the shell grow so the whole page can be shot.
 * Only used right before a full-page screenshot; the page is reloaded after.
 */
export async function expandShell(page: Page) {
  await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".flex.h-dvh");
    const main = document.getElementById("app-main-scroll");
    if (shell) {
      shell.style.height = "auto";
      shell.style.minHeight = "100vh";
      shell.style.overflow = "visible";
    }
    if (main) {
      main.style.overflow = "visible";
      main.style.height = "auto";
      main.style.maxHeight = "none";
      main.style.flex = "none";
    }
    document.body.style.height = "auto";
    document.body.style.overflow = "visible";
    document.documentElement.style.height = "auto";
    document.documentElement.style.overflow = "visible";
  });
  await page.waitForTimeout(250);
}

export async function settle(page: Page, selector: string, timeout = 25_000) {
  await page.waitForSelector(selector, { timeout, state: "attached" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(600);
}

export const test = base;
export { expect } from "@playwright/test";
