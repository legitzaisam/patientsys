import { expect, test } from "./fixtures";

/**
 * The patient portal's core promises, at their new homes.
 *
 * The portal used to be a single /my-record page; it is now a subtree, and
 * signing, the health-update composer and contact preferences moved onto
 * Records and Settings. Page-by-page and control-by-control coverage lives
 * in e2e/patient-portal/ — this file keeps the original guarantees pinned to
 * wherever they now live, so a future reshuffle that loses one is caught.
 */

test.use({ role: "patient" });

test("greets the patient on the portal home", async ({ page }) => {
  await page.goto("/my-record");
  await expect(page.getByRole("heading", { level: 1, name: /Good (morning|afternoon|evening), Olivia/ })).toBeVisible();
});

test("lists their forms on the records page", async ({ page }) => {
  await page.goto("/my-record/records");
  await expect(page.getByRole("heading", { name: "Clinic documents" })).toBeVisible();
});

test("signs an outstanding form with a typed name", async ({ page }) => {
  await page.goto("/my-record/records");

  const signName = page.getByPlaceholder("Type your full name to sign").first();
  await expect(signName).toBeVisible();
  const form = signName.locator("xpath=ancestor::form");
  const nos = form.getByRole("radio", { name: "No" });
  const questionCount = await nos.count();
  for (let i = 0; i < questionCount; i++) await nos.nth(i).click();
  await signName.fill("Olivia Bennett");
  await signName.locator("xpath=ancestor::form").getByRole("button", { name: "Sign" }).click();

  // The signed badge replaces that form's signature input.
  await expect(page.getByText("signed", { exact: true }).first()).toBeVisible();
});

test("shows the health information update composer", async ({ page }) => {
  await page.goto("/my-record/records");
  await expect(page.getByRole("heading", { name: "Update your health information" })).toBeVisible();
});

test("shows how the clinic contacts them", async ({ page }) => {
  await page.goto("/my-record/settings");
  await expect(page.getByRole("heading", { name: "How we contact you" })).toBeVisible();
});

test("keeps their clinic conversation reachable", async ({ page }) => {
  await page.goto("/my-record");
  await page.locator('[data-qc="chat-bubble"]').click();
  await expect(page.locator('[data-qc="chat-panel"]')).toBeVisible();
});
