import { expect, test } from "./fixtures";

/**
 * Team directory and the owner-only invite dialog. Phase 9c changes what the
 * invite returns (no more plaintext temporary password), so the baseline
 * asserts the dialog exists rather than the password handoff.
 */

test.describe("as owner", () => {
  test.use({ role: "owner" });

  test("team list renders and a member profile opens", async ({ page }) => {
    await page.goto("/team");
    await expect(page.getByRole("heading", { level: 1, name: "Team & access" })).toBeVisible();
    await page
      .getByRole("link", { name: /Nadia Rahman/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/team\/.+/);
    await expect(page.getByRole("heading", { level: 1, name: "Staff profile" })).toBeVisible();
  });

  test("the invite dialog opens for the owner", async ({ page }) => {
    await page.goto("/team");
    await page.getByRole("button", { name: /Invite/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
  });
});

test.describe("as front desk", () => {
  test.use({ role: "front_desk" });

  test("cannot invite staff", async ({ page }) => {
    await page.goto("/team");
    await expect(page.getByRole("heading", { level: 1, name: "Team & access" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Invite/ })).toHaveCount(0);
  });
});
