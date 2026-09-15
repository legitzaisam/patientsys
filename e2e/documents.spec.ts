import { expect, test } from "./fixtures";

/**
 * Consent documents from the staff side: issue and remind.
 * Phase 9b adds the outbox enqueue behind these same controls.
 */

test.use({ role: "owner" });

async function openOliviaDocuments(page: import("@playwright/test").Page) {
  await page.goto("/patients");
  await page.getByRole("link", { name: /Bennett, .*Olivia/ }).click();
  await page.getByRole("tab", { name: "Documents" }).click();
}

test("issues a consent form to the patient", async ({ page }) => {
  await openOliviaDocuments(page);

  await page.getByRole("button", { name: "Send form" }).click();
  const dialog = page.getByRole("dialog", { name: "Send to patient" });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Type").selectOption("consent");
  await dialog.getByLabel("Title").fill("Dermal filler — consent form (e2e)");
  await dialog.getByLabel("Content").fill("Please read and sign before your appointment.");
  await dialog.getByRole("button", { name: "Send", exact: true }).click();

  // Olivia has an email on file, so the signing link goes out for real.
  await expect(
    page.getByText("Form sent — signing link emailed and added to their portal"),
  ).toBeVisible();
  // exact: the title also appears inside the portal chat notification text.
  await expect(page.getByText("Dermal filler — consent form (e2e)", { exact: true })).toBeVisible();
});

test("reminds the patient about an unsigned form", async ({ page }) => {
  await openOliviaDocuments(page);

  await page.getByRole("button", { name: "Remind" }).first().click();
  await expect(
    page.getByText("Reminder emailed with the signing link, and posted to their portal"),
  ).toBeVisible();
});
