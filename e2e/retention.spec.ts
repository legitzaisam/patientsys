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
