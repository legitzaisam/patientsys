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

test("the email channel still hands off to the mail client (baseline)", async ({ page }) => {
  await page.goto("/retention");
  await page.getByRole("button", { name: "Send recall" }).first().click();

  const dialog = page.getByRole("dialog", { name: /Send recall to / });
  await dialog.getByRole("tab", { name: "Email" }).click();
  // Baseline behaviour: the action is a mailto: handoff, not a real send.
  // Phase 9c replaces this button with a real outbox send.
  await expect(dialog.getByRole("button", { name: "Open email" })).toBeVisible();
});
