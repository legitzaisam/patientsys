import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  check,
  DEMO_ROLES,
  demoCookie,
  expectPersona,
  head,
  PILL_LABEL,
  QC_DIR,
  record,
  ROUTES,
} from "./lib";

const CAPTURES = path.join(QC_DIR, "captures");

/**
 * Every way into the demo from the website lands in the right portal as the
 * right persona: the gateway entry itself, then each button a visitor can click.
 */

test("gateway /demo/enter sets the persona and lands on the right portal", async ({
  request,
}, testInfo) => {
  for (const role of DEMO_ROLES) {
    const r = await head(request, `/demo/enter?role=${role}`);
    const cookie = r.headers["set-cookie"] ?? "";
    const ok =
      r.status === 302 &&
      r.location === ROUTES.demoRoles[role] &&
      cookie.includes(`demo_role=${role}`);
    check(
      testInfo,
      `/demo/enter?role=${role}`,
      ok,
      `302 → ${r.location}, cookie ${cookie.includes(`demo_role=${role}`) ? "set" : "missing"}`,
    );
  }
  const unknown = await head(request, "/demo/enter?role=nurse");
  check(
    testInfo,
    "/demo/enter with an unknown role",
    unknown.status === 302 && unknown.location === "/login?role=unknown",
    `302 → ${unknown.location}`,
  );
  const deep = await head(
    request,
    `/demo/enter?role=owner&next=${encodeURIComponent("/patients?tab=board")}`,
  );
  check(
    testInfo,
    "/demo/enter with a same-origin next",
    deep.location === "/patients?tab=board",
    `→ ${deep.location}`,
  );
  const bad = await head(
    request,
    `/demo/enter?role=owner&next=${encodeURIComponent("//evil.example.com")}`,
  );
  check(
    testInfo,
    "/demo/enter ignores an off-site next",
    bad.location === "/dashboard",
    `→ ${bad.location}`,
  );
});

async function enterAndVerify(
  page: import("@playwright/test").Page,
  testInfo: import("@playwright/test").TestInfo,
  label: string,
  click: () => Promise<void>,
  role: string,
) {
  await page.context().clearCookies();
  await click();
  const landing = ROUTES.demoRoles[role]!;
  await page.waitForURL((u) => u.pathname === landing, { timeout: 30_000 });
  await expectPersona(page, role);
  await expect(page.locator("h1").first()).toBeVisible({ timeout: 20_000 });
  const cookie = await demoCookie(page);
  const ok = cookie === role && new URL(page.url()).pathname === landing;
  // Landing capture for the report reader (gitignored).
  const file = `${label
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()}--${testInfo.project.name}.png`;
  await page.screenshot({ path: path.join(CAPTURES, file), fullPage: false }).catch(() => {});
  check(
    testInfo,
    label,
    ok,
    `landed on ${new URL(page.url()).pathname} as ${PILL_LABEL[role]}, cookie ${cookie}; capture captures/${file}`,
  );
}

test("every persona button on /login enters the demo as that persona", async ({
  page,
}, testInfo) => {
  const buttons: [string, string][] = [
    ["Clinic owner", "owner"],
    ["Manager", "manager"],
    ["Practitioner", "practitioner"],
    ["Front desk", "front_desk"],
  ];
  for (const [label, role] of buttons) {
    await page.goto("/login");
    await enterAndVerify(
      page,
      testInfo,
      `/login → ${label}`,
      () => page.getByRole("link", { name: label, exact: true }).click(),
      role,
    );
  }
  await page.goto("/login");
  await enterAndVerify(
    page,
    testInfo,
    "/login → Open the patient portal",
    () => page.getByRole("link", { name: /Open the patient portal/ }).click(),
    "patient",
  );
});

test("the Sign in panel rows on the home page enter the right portals", async ({
  page,
}, testInfo) => {
  const signIn = page.locator("[data-signin-btn]");
  for (const [row, role] of [
    ["Clinic team", "owner"],
    ["Patients", "patient"],
  ] as const) {
    await page.goto("/");
    if (!(await signIn.isVisible().catch(() => false))) {
      record(testInfo, {
        check: `home Sign in panel → ${row}`,
        result: "skip",
        note: "the Sign in menu is not shown at this width; the mobile menu links to /login instead",
      });
      return;
    }
    await enterAndVerify(
      page,
      testInfo,
      `home Sign in panel → ${row}`,
      async () => {
        await signIn.click();
        await page
          .locator("[data-signin-panel]")
          .getByRole("link", { name: new RegExp(row) })
          .click();
      },
      role,
    );
  }
});

test('every "Try this view" card on the home page enters the demo', async ({ page }, testInfo) => {
  const cards: [string, string][] = [
    ["Clinic owner", "owner"],
    ["Practitioner", "practitioner"],
    ["Front desk", "front_desk"],
    ["Patient", "patient"],
  ];
  for (const [name, role] of cards) {
    await page.goto("/");
    // Match on the card's title element; the anchor's own text is whitespace-padded.
    const card = page
      .locator("a.role")
      .filter({ has: page.locator("h3", { hasText: new RegExp(`^${name}$`) }) })
      .first();
    await card.scrollIntoViewIfNeeded();
    await enterAndVerify(page, testInfo, `home role card → ${role}`, () => card.click(), role);
  }
});

test("every persona card on /demo enters the demo", async ({ page }, testInfo) => {
  const cards: [string, string][] = [
    ["Clinic owner", "owner"],
    ["Manager", "manager"],
    ["Practitioner", "practitioner"],
    ["Front desk", "front_desk"],
    ["Patient", "patient"],
  ];
  for (const [name, role] of cards) {
    await page.goto("/demo");
    const card = page
      .locator("a.persona")
      .filter({ has: page.locator(".persona__who", { hasText: new RegExp(`^${name}$`) }) })
      .first();
    await card.scrollIntoViewIfNeeded();
    await enterAndVerify(page, testInfo, `/demo card → ${role}`, () => card.click(), role);
  }
});

test("a deep link through /demo/enter lands on the requested page", async ({ page }, testInfo) => {
  await page.context().clearCookies();
  await page.goto(`/demo/enter?role=owner&next=${encodeURIComponent("/patients?tab=board")}`);
  await page.waitForURL(
    (u) => u.pathname === "/patients" && u.searchParams.get("tab") === "board",
    { timeout: 30_000 },
  );
  await expectPersona(page, "owner");
  await expect(page.locator('[data-qc="board-book"], .page-title, h1').first()).toBeVisible({
    timeout: 20_000,
  });
  check(
    testInfo,
    "next=/patients?tab=board opens the journey board as the owner",
    true,
    page.url(),
  );
});

test("an unknown role is sent back to the website login with a notice", async ({
  page,
}, testInfo) => {
  await page.goto("/demo/enter?role=nurse");
  await page.waitForURL((u) => u.pathname === "/login", { timeout: 20_000 });
  const notice = page.locator("[data-login-notice]");
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("does not exist");
  check(
    testInfo,
    "/demo/enter?role=nurse → /login with the notice",
    true,
    (await notice.textContent()) ?? "",
  );
});
