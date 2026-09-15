import { expect, test } from "./fixtures";

/**
 * Role-based access as the user experiences it: which navigation exists,
 * and what happens on a direct URL to a page the role cannot see.
 * The demo permission fixtures mirror the production seed defaults.
 */

test.describe("owner", () => {
  test.use({ role: "owner" });

  test("sees the full staff navigation", async ({ page }) => {
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation").first();
    // /team and /settings live in the account menu, not the sidebar.
    for (const label of ["Dashboard", "Diary", "Patients", "Retention", "Performance"]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
    // The Team group lists colleagues with presence.
    await expect(nav.getByRole("link", { name: /Nadia Rahman/ })).toBeVisible();
  });
});

test.describe("practitioner", () => {
  test.use({ role: "practitioner" });

  test("sees earnings but not clinic performance", async ({ page }) => {
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation").first();
    await expect(nav.getByRole("link", { name: "My earnings" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Retention" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Performance" })).toHaveCount(0);
  });

  test("a direct URL to /performance bounces to the dashboard", async ({ page }) => {
    await page.goto("/performance");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe("front desk", () => {
  test.use({ role: "front_desk" });

  test("sees no performance or earnings navigation", async ({ page }) => {
    await page.goto("/dashboard");
    const nav = page.getByRole("navigation").first();
    await expect(nav.getByRole("link", { name: "Patients" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Performance" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "My earnings" })).toHaveCount(0);
  });

  test("a direct URL to /performance bounces to the dashboard", async ({ page }) => {
    await page.goto("/performance");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});

test.describe("patient", () => {
  test.use({ role: "patient" });

  test("navigation offers only their own record", async ({ page }) => {
    await page.goto("/my-record");
    const nav = page.getByRole("navigation").first();
    await expect(nav.getByRole("link", { name: "My record" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Patients" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Diary" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Team" })).toHaveCount(0);
  });
});
