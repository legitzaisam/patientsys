import { expect, test } from "@playwright/test";
import { check, demoCookie, expectPersona, head, isAppHtml, isWebsiteHtml, record } from "./lib";

/**
 * Every way back out of the app lands on the website, not on the app's own
 * sign-in or landing pages: full loads (gateway redirects) and client-side
 * navigations (the app's demo hand-off).
 */

test("full loads of the app's sign-in pages are redirected to the website login", async ({
  request,
}, testInfo) => {
  const cases: [string, string][] = [
    ["/auth", "/login"],
    ["/portal", "/login#patient"],
    ["/auth?idle=1", "/login?idle=1"],
    ["/portal?idle=1", "/login?idle=1#patient"],
  ];
  for (const [from, to] of cases) {
    const r = await head(request, from);
    check(
      testInfo,
      `GET ${from}`,
      r.status === 302 && r.location === to,
      `${r.status} → ${r.location}`,
    );
  }
  for (const p of ["/auth/callback", "/auth/reset"]) {
    const r = await head(request, p);
    check(
      testInfo,
      `GET ${p} still reaches the app`,
      r.status === 200 && isAppHtml(r.body),
      `status ${r.status}, ${isWebsiteHtml(r.body) ? "website html" : "app html"}`,
    );
  }
});

test("the idle sign-out lands on the website login with the notice", async ({ page }, testInfo) => {
  await page.goto("/auth?idle=1");
  await page.waitForURL((u) => u.pathname === "/login", { timeout: 20_000 });
  const notice = page.locator("[data-login-notice]");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("inactivity");
  check(
    testInfo,
    "/auth?idle=1 → /login?idle=1 with the notice",
    true,
    (await notice.textContent()) ?? "",
  );
});

test("/login#patient scrolls to the patient door", async ({ page }, testInfo) => {
  await page.goto("/login#patient");
  const patient = page.locator("#patient");
  await expect(patient).toBeVisible();
  check(testInfo, "#patient exists on /login", true);
});

test("Sign out in the app returns to the website login and forgets the persona", async ({
  page,
}, testInfo) => {
  await page.context().clearCookies();
  await page.goto("/demo/enter?role=owner");
  await page.waitForURL((u) => u.pathname === "/dashboard", { timeout: 30_000 });
  await expectPersona(page, "owner");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await page.waitForURL((u) => u.pathname === "/login", { timeout: 30_000 });
  const html = await page.content();
  const cookie = await demoCookie(page);
  check(testInfo, "Sign out → website /login", isWebsiteHtml(html), page.url());
  check(
    testInfo,
    "Sign out clears the demo_role cookie",
    cookie === undefined,
    `cookie: ${cookie ?? "none"}`,
  );
});

test("the app's 404 page hands its Go home back to the website", async ({ page }, testInfo) => {
  await page.context().clearCookies();
  await page.goto("/no-such-page-qc");
  await expect(page.getByText("Page not found")).toBeVisible({ timeout: 30_000 });
  record(testInfo, {
    check: "a typo path shows the app 404",
    result: "info",
    note: "expected: paths outside the website table are proxied to the app",
  });
  await page.getByRole("link", { name: "Go home" }).click();
  // Go home is a client-side navigation to the app landing, which then hands
  // off with a full load of the website; wait for that second step.
  await page.waitForURL((u) => u.pathname === "/", { timeout: 30_000 });
  await expect
    .poll(async () => isWebsiteHtml(await page.content()), {
      timeout: 30_000,
      message: "app landing hands off to the website",
    })
    .toBe(true);
  check(testInfo, "404 Go home → website home", isWebsiteHtml(await page.content()), page.url());
});

test("a direct visit to the app landing is handed to the website home", async ({
  page,
}, testInfo) => {
  // The gateway serves the website at "/", so the app landing is only reachable
  // client-side; reproduce that with a client navigation from the app 404.
  record(testInfo, {
    check: "app landing hand-off",
    result: "info",
    note: "covered by the 404 Go home check above; a full load of / is the website by routing",
  });
  const r = await head(page.request, "/");
  check(testInfo, "GET / is the website", r.status === 200 && isWebsiteHtml(r.body));
});
