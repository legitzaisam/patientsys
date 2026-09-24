import { expect, test } from "./fixtures";

/**
 * Patient list search and the record page tabs.
 */

test.use({ role: "owner" });

test("search narrows the list by name", async ({ page }) => {
  await page.goto("/patients");
  const search = page.getByLabel("Search by name or reference");
  await search.fill("Bennett");
  await expect(page.getByRole("link", { name: /Bennett, .*Olivia/ })).toBeVisible();
  // A patient who does not match must be filtered out of the table.
  await expect(page.getByRole("link", { name: /Bennett, / })).toHaveCount(1);
});

test("search by reference finds the same record", async ({ page }) => {
  await page.goto("/patients");
  await page.getByLabel("Search by name or reference").fill("AV-1200");
  await expect(page.getByRole("link", { name: /Bennett, .*Olivia/ })).toBeVisible();
});

test("record page exposes every clinical tab", async ({ page }) => {
  await page.goto("/patients");
  await page.getByRole("link", { name: /Bennett, .*Olivia/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Bennett, .*Olivia/ })).toBeVisible();

  for (const tab of ["Visit notes", "Before and after", "Documents", "History updates", "Contact"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
  }

  // Contact preferences and the comms log live on the Contact tab for comms.send staff.
  await expect(page.getByRole("heading", { name: "Contact preferences" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Email and text" })).toBeVisible();
});
