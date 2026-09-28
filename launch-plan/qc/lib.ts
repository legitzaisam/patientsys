import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

export const QC_DIR = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(QC_DIR, "../..");
export const SITE_SRC = path.join(ROOT, "launch-plan/website/src");
export const SITE_DIST = path.join(ROOT, "launch-plan/website/dist");
export const ROUTES = JSON.parse(
  fs.readFileSync(path.join(ROOT, "launch-plan/gateway/routes.json"), "utf8"),
) as {
  website: { exact: string[]; prefixes: string[] };
  demoRoles: Record<string, string>;
  signIn: Record<string, string>;
};

/** Roles the gateway accepts (the $comment key is not a role). */
export const DEMO_ROLES = Object.keys(ROUTES.demoRoles).filter((k) => !k.startsWith("$"));

/** What the in-app Demo pill shows for each persona. */
export const PILL_LABEL: Record<string, string> = {
  owner: "Clinic owner",
  manager: "Manager",
  practitioner: "Practitioner",
  front_desk: "Receptionist",
  patient: "Patient",
};

/** A website page carries Astro's scoped-style attributes; the app never does. */
export const isWebsiteHtml = (html: string) => /data-astro-cid-/.test(html);
export const isAppHtml = (html: string) =>
  !isWebsiteHtml(html) && /<div id="root"|__TSR|tanstack|Aetheria/i.test(html);

export type Check = { check: string; result: "pass" | "fail" | "skip" | "info"; note?: string };

/** Record one line for REPORT.md on the current test. */
export function record(testInfo: TestInfo, entry: Check) {
  testInfo.annotations.push({ type: "qc", description: JSON.stringify(entry) });
}

/** Record and assert in one go: a failed expectation is still written to the report. */
export function check(testInfo: TestInfo, name: string, ok: boolean, note?: string) {
  record(testInfo, { check: name, result: ok ? "pass" : "fail", ...(note ? { note } : {}) });
  expect(ok, `${name}${note ? ` — ${note}` : ""}`).toBe(true);
}

/** GET without following redirects. */
export async function head(request: APIRequestContext, url: string) {
  const res = await request.get(url, { maxRedirects: 0, failOnStatusCode: false });
  return {
    status: res.status(),
    location: res.headers()["location"] ?? "",
    headers: res.headers(),
    body: await res.text(),
  };
}

/** Is this path one the website answers (per routes.json)? */
export function isWebsitePath(pathname: string) {
  const clean = pathname.replace(/\/$/, "") || "/";
  if (ROUTES.website.exact.includes(clean)) return true;
  return ROUTES.website.prefixes.some((p) => {
    const base = p.replace(/\/$/, "");
    return clean === base || clean.startsWith(`${base}/`);
  });
}

/** Wait until the Demo pill shows the expected persona. */
export async function expectPersona(page: Page, role: string) {
  const pill = page.locator('[data-qc="demo-role-switcher"]');
  await expect(pill).toBeVisible({ timeout: 20_000 });
  await expect(pill).toContainText(PILL_LABEL[role]!, { timeout: 20_000 });
}

/** The demo persona cookie in this context, or undefined. */
export async function demoCookie(page: Page) {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === "demo_role")?.value;
}
