import { expect, test } from "./fixtures";

/**
 * The patient portal (/my-record) as Olivia Bennett: signing a form,
 * messages from the clinic, and the health update composer.
 */

test.use({ role: "patient" });

test("greets the patient and lists their forms", async ({ page }) => {
  await page.goto("/my-record");
  await expect(page.getByRole("heading", { level: 1, name: /Hello Olivia/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Forms to complete" })).toBeVisible();
});

test("signs an outstanding form with a typed name", async ({ page }) => {
  await page.goto("/my-record");

  const signName = page.getByPlaceholder("Type your full name to sign").first();
  await expect(signName).toBeVisible();
  await signName.fill("Olivia Bennett");
  await signName.locator("xpath=ancestor::form").getByRole("button", { name: "Sign" }).click();

  // The signed badge replaces that form's signature input.
  await expect(page.getByText("signed", { exact: true }).first()).toBeVisible();
});

test("shows the health information update composer", async ({ page }) => {
  await page.goto("/my-record");
  await expect(page.getByRole("heading", { name: "Update your health information" })).toBeVisible();
});

test("shows how the clinic contacts them", async ({ page }) => {
  await page.goto("/my-record");
  await expect(page.getByRole("heading", { name: "How we contact you" })).toBeVisible();
});
