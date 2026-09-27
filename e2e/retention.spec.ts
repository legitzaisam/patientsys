import { expect, test } from "./fixtures";

/**
 * Retention: the at-risk table, the recall dialog (whose email/sms channels
 * Phase 9c moves onto the outbox) and the recall tasks panel.
 */

test.use({ role: "owner" });

test("retention page renders the at-risk table and tasks panel", async ({ page }) => {
  await page.goto("/retention");
  await expect(page.getByRole("heading", { level: 1, name: "Retention" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send recall" }).first()).toBeVisible();
});

test("sends a portal recall message from the dialog", async ({ page }) => {
  await page.goto("/retention");
  await page.getByRole("button", { name: "Send recall" }).first().click();

  const dialog = page.getByRole("dialog", { name: /Send recall to / });
  await expect(dialog).toBeVisible();

  // Default channel is the in-app portal message; the body is prefilled.
  await dialog.getByRole("button", { name: "Send recall" }).click();
  await expect(page.getByText("Recall message sent")).toBeVisible();
});

test("a recall email respects the patient's marketing opt-out", async ({ page }) => {
  await page.goto("/retention");
  await page.getByRole("button", { name: "Send recall" }).first().click();

  const dialog = page.getByRole("dialog", { name: /Send recall to / });
  await dialog.getByRole("tab", { name: "Email" }).click();
  // Recall promotes a repeat treatment, so it is a marketing send under PECR.
  // Every fixture patient is opted out, so the outbox must refuse — no more
  // mailto: side door around the patient's preferences.
  await dialog.getByRole("button", { name: "Send email" }).click();
  await expect(page.getByText("has not opted in to marketing messages")).toBeVisible();
});

test("the at-risk table pins the patient column, drops practitioner, and the dialog can hand the recall to the team", async ({
  page,
}) => {
  await page.goto("/retention");
  await expect(page.getByRole("button", { name: "Sort by Practitioner" })).toHaveCount(0);
  const patientHeader = page.getByRole("button", { name: "Sort by Patient" });
  await expect(patientHeader).toBeVisible();
  const sticky = await patientHeader.evaluate((el) => getComputedStyle(el.closest("th")!).position);
  expect(sticky).toBe("sticky");

  await page.getByRole("button", { name: "Send recall" }).first().click();
  const dialog = page.getByRole("dialog", { name: /Send recall to / });
  await expect(dialog.locator('[data-qc="recall-assign-section"]')).toContainText(
    "hand it to the team",
  );
  await dialog.locator('[data-qc="recall-assign-to"]').click();
  await expect(page.getByText("Ask the team to recall")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send recall task" })).toBeVisible();
  await page.keyboard.press("Escape");
});

test("cohorts read Too early for this month and 'so far' while young; the trend axis is in %", async ({
  page,
}) => {
  await page.goto("/retention");
  await expect(page.locator('[data-qc="cohort-too-early"]').first()).toBeVisible();
  // Young cohorts say the rate is provisional; matured ones read as final.
  expect(await page.locator('[data-qc="cohort-so-far"]').count()).toBeGreaterThan(0);
  await expect(page.locator('[data-qc="cohort-so-far"]').first()).toContainText("so far");
  await expect(page.locator("#retention-trend").getByText("100%")).toBeVisible();
});
