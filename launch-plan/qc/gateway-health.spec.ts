import { expect, test } from "@playwright/test";
import { check, expectPersona, head, isAppHtml, isWebsiteHtml, record } from "./lib";

/**
 * The plumbing between the website and the app: health, proxying, the
 * server-function round trip (which proves the CSRF origin mapping), and the
 * two 404 behaviours.
 */

test("gateway health and proxying", async ({ request }, testInfo) => {
  const health = await head(request, "/healthz");
  check(testInfo, "/healthz", health.status === 200 && health.body === "ok");

  const dash = await request.get("/dashboard", { headers: { cookie: "demo_role=owner" } });
  const dashHtml = await dash.text();
  check(
    testInfo,
    "/dashboard is proxied to the app",
    dash.status() === 200 && isAppHtml(dashHtml),
    `status ${dash.status()}`,
  );

  const metrics = await request.get("/api/demo/metrics", { failOnStatusCode: false });
  check(
    testInfo,
    "/api/demo/metrics is proxied (demo endpoint answers)",
    metrics.status() < 500,
    `status ${metrics.status()}`,
  );

  const site404 = await head(request, "/journal/nothing-here");
  check(
    testInfo,
    "/journal/… (website prefix) → website 404",
    site404.status === 404 && isWebsiteHtml(site404.body),
    `status ${site404.status}`,
  );

  const typo = await head(request, "/pricng");
  record(testInfo, {
    check: "/pricng (not a website path) → app",
    result: "info",
    note: `status ${typo.status}, ${isWebsiteHtml(typo.body) ? "website" : "app"} html; the app shows its 404 whose Go home returns to the website`,
  });
});

test("a server-function round trip works through the gateway (CSRF origin mapping)", async ({
  page,
}, testInfo) => {
  await page.context().clearCookies();
  await page.goto("/demo/enter?role=owner");
  await page.waitForURL((u) => u.pathname === "/dashboard", { timeout: 30_000 });
  await expectPersona(page, "owner");
  await page.goto("/offers");
  const stage = page.locator('[data-qc="offer-stage-single_treatment"]');
  await expect(stage).toBeVisible({ timeout: 30_000 });
  const toggle = stage.locator('[data-qc="offer-automation-switch"]');
  const before = await toggle.getAttribute("aria-checked");
  await toggle.click();
  const preview = page.locator('[data-qc="offer-preview-count"]');
  await expect(preview).toBeVisible({ timeout: 20_000 });
  await expect(preview).not.toContainText("Working out", { timeout: 20_000 });
  const forbidden = await page.getByText(/forbidden|csrf|origin/i).count();
  check(
    testInfo,
    "toggling an offer's automation through the gateway succeeds",
    forbidden === 0,
    `switch ${before} → ${await toggle.getAttribute("aria-checked")}, preview: ${(await preview.textContent())?.trim()}`,
  );
  // Leave the fixture as we found it (the demo server is fresh per run anyway).
  if ((await toggle.getAttribute("aria-checked")) !== before) await toggle.click();
});

test("website and app never answer each other's paths", async ({ request }, testInfo) => {
  for (const p of ["/", "/pricing", "/contact", "/demo", "/login"]) {
    const r = await head(request, p);
    check(testInfo, `${p} is website html`, r.status === 200 && isWebsiteHtml(r.body));
  }
  for (const p of ["/dashboard", "/patients", "/my-record", "/offers"]) {
    const r = await request.get(p, { headers: { cookie: "demo_role=owner" } });
    check(testInfo, `${p} is app html`, r.status() === 200 && isAppHtml(await r.text()));
  }
});
