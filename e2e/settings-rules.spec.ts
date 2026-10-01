import { expect, test } from "./fixtures";

/**
 * Settings: the subtitle follows the open tab, and the Rules tab (formerly
 * "Payments and deposits") holds the Deposits card.
 */

test.describe("as owner", () => {
  test.use({ role: "owner" });

  test("the subtitle under Settings follows the open tab", async ({ page }) => {
    await page.goto("/settings");
    const subtitle = page.locator('[data-qc="settings-subtitle"]');
    await expect(subtitle).toContainText("consent forms, receipts and patient messages");
    await page.getByRole("tab", { name: "Treatments" }).click();
    await expect(subtitle).toContainText("recall intervals and diary colours");
    await page.getByRole("tab", { name: "Products" }).click();
    await expect(subtitle).toContainText("patient portal and counted in Insights");
    await page.getByRole("tab", { name: "Rules" }).click();
    await expect(page).toHaveURL(/tab=rules/);
    await expect(subtitle).toContainText("Rules your clinic sets once");
    await expect(page.getByRole("tab", { name: "Payments and deposits" })).toHaveCount(0);
  });

  test("old ?tab=payments links open the Rules tab", async ({ page }) => {
    await page.goto("/settings?tab=payments");
    await expect(page.getByRole("tab", { name: "Rules" })).toHaveAttribute("data-state", "active");
    await expect(page.locator('[data-qc="deposit-rules"]')).toBeVisible();
  });

  test("the Deposits card explains itself, validates, and saves", async ({ page }) => {
    await page.goto("/settings?tab=rules");
    const card = page.locator('[data-qc="deposit-rules"]');
    await expect(card.getByRole("heading", { name: "Deposits" })).toBeVisible();
    const amount = card.getByLabel("Deposit amount");
    const due = card.getByLabel("Deposit due");
    const example = card.locator('[data-qc="deposit-rules-example"]');
    const save = card.getByRole("button", { name: "Save deposit rules" });

    await expect(amount).toHaveValue(/\d+/);
    await expect(save).toBeDisabled();

    await amount.fill("50");
    await due.fill("7");
    await expect(example).toHaveText(
      "Example: a £300 treatment needs a £150 deposit, paid at least 7 days before the appointment.",
    );

    // Blank and decimal values are refused before they reach the server.
    await due.fill("");
    await expect(card.locator('[data-qc="deposit-rules-error"]')).toBeVisible();
    await expect(save).toBeDisabled();
    await due.fill("2.5");
    await expect(save).toBeDisabled();
    await due.fill("1");
    await expect(example).toContainText("at least 1 day before");

    await amount.fill("0");
    await expect(example).toContainText("No deposit is taken");

    await amount.fill("40");
    await due.fill("4");
    await save.click();
    await expect(page.getByText("Deposit rules saved")).toBeVisible();
    await expect(save).toBeDisabled();

    // Persisted: a reload shows the saved rule.
    await page.reload();
    await expect(
      page.locator('[data-qc="deposit-rules"]').getByLabel("Deposit amount"),
    ).toHaveValue("40");
    await expect(page.locator('[data-qc="deposit-rules"]').getByLabel("Deposit due")).toHaveValue(
      "4",
    );

    // Put the demo back as it was for other tests.
    await page.locator('[data-qc="deposit-rules"]').getByLabel("Deposit amount").fill("30");
    await page.locator('[data-qc="deposit-rules"]').getByLabel("Deposit due").fill("3");
    await page
      .locator('[data-qc="deposit-rules"]')
      .getByRole("button", { name: "Save deposit rules" })
      .click();
    await expect(page.getByText("Deposit rules saved").first()).toBeVisible();
  });
});

test.describe("as practitioner", () => {
  test.use({ role: "practitioner" });

  test("sees the rules read-only, with the manager note", async ({ page }) => {
    await page.goto("/settings?tab=rules");
    await expect(page.locator('[data-qc="settings-subtitle"]')).toContainText(
      "Set by your manager.",
    );
    const card = page.locator('[data-qc="deposit-rules"]');
    await expect(card.getByLabel("Deposit amount")).toBeDisabled();
    await expect(card.getByRole("button", { name: "Save deposit rules" })).toHaveCount(0);
  });
});
