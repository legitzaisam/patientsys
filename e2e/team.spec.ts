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
      .locator('[data-qc="team-member"]')
      .filter({ hasText: "Nadia Rahman" })
      .getByRole("link")
      .click();
    await expect(page).toHaveURL(/\/team\/.+/);
    await expect(page.getByRole("heading", { level: 1, name: "Staff profile" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Performance" })).toBeVisible();
    await expect(page.getByText("Their share", { exact: true }).first()).toBeVisible();
  });

  test("each member shows last active, compliance status and, for the owner, commission; access changes are logged", async ({
    page,
  }) => {
    await page.goto("/team");
    const nadia = page.locator('[data-qc="team-member"]', { hasText: "Dr Nadia Rahman" });
    await expect(nadia.locator('[data-qc="member-last-active"]')).toHaveText("Last active today");
    await expect(nadia.locator('[data-qc="member-compliance"]')).toHaveText(
      /Registration expires in \d+ days/,
    );
    await expect(nadia.locator('[data-qc="member-compliance"]')).toHaveAttribute(
      "data-tone",
      "warn",
    );
    await expect(nadia.locator('[data-qc="member-commission"]')).toHaveText("45% commission");

    const tom = page.locator('[data-qc="team-member"]', { hasText: "Dr Tom Whitfield" });
    await expect(tom.locator('[data-qc="member-last-active"]')).toHaveText(
      "Last active 2 days ago",
    );
    await expect(tom.locator('[data-qc="member-compliance"]')).toHaveText(
      /Insurance expires in \d+ days/,
    );
    await expect(tom.locator('[data-qc="member-changed-by"]')).toContainText(
      "Access set by Dr Amara Osei",
    );

    // The receptionist has no clinical registration; her line is about documents, and no commission is shown.
    const sofia = page.locator('[data-qc="team-member"]', { hasText: "Sofia Marchetti" });
    await expect(sofia.locator('[data-qc="member-compliance"]')).toHaveText(
      /\d+ documents? missing/,
    );
    await expect(sofia.locator('[data-qc="member-commission"]')).toHaveCount(0);

    // Who changed which permission and when, from the Staff access header.
    await expect(page.getByRole("heading", { name: "Staff access" })).toBeVisible();
    await expect(page.getByRole("switch").first()).toBeVisible();
    await page.getByRole("button", { name: "Recent changes" }).click();
    const changes = page.locator('[data-qc="access-changes"]');
    await expect(changes).toBeVisible();
    await expect(changes.locator("li").first()).toContainText(
      /turned .+ (on|off) for (managers|receptionists|practitioners)/,
    );
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Collapse all" }).click();
    await expect(page.getByRole("switch", { name: "Patient records for Manager" })).toBeHidden();
    await page.getByRole("button", { name: "Clinical record" }).click();
    await expect(page.getByRole("switch", { name: "Patient records for Manager" })).toBeVisible();
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

  test("sees compliance status but no commission rates", async ({ page }) => {
    await page.goto("/team");
    await expect(page.locator('[data-qc="member-compliance"]').first()).toBeVisible();
    await expect(page.locator('[data-qc="member-commission"]')).toHaveCount(0);
  });
});
