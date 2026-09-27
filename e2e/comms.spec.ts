import { expect, test } from "./fixtures";

/**
 * The Phase 7/8 outbox surface on the patient record: the queued fixture,
 * the staff drain, and the PECR preference toggles.
 */

test.use({ role: "owner" });

/** Open Olivia's record on the Contact tab, where preferences and the outbox live. */
async function openOliviaRecord(page: import("@playwright/test").Page) {
  await page.goto("/patients");
  await page.getByRole("link", { name: /Bennett, .*Olivia/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Olivia Bennett/ })).toBeVisible();
  await page.getByRole("tab", { name: "Contact" }).click();
  await expect(page.getByRole("heading", { name: "Contact preferences" })).toBeVisible();
}

test.describe("outbox drain", () => {
  // "Process queue", the provider and the attempt count are software-admin
  // diagnostics; clinic roles see the plain sent / queued list.
  test.use({ role: "admin" });

  test("processing the queue sends the queued fixture through the sandbox", async ({ page }) => {
    await openOliviaRecord(page);

    // The fixture outbox holds one queued reminder for Olivia.
    const row = page.locator("li", { hasText: "Appointment reminder" }).first();
    await expect(row.getByText("queued", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Process queue" }).click();

    // The demo drain walks the same dispatch code with the sandbox adapters.
    await expect(row.getByText("sent", { exact: true })).toBeVisible();
    await expect(row.getByText(/sandbox/)).toBeVisible();
  });
});

test("clinic roles see the outbox without the developer controls", async ({ page }) => {
  await openOliviaRecord(page);

  const card = page.locator("h2", { hasText: "Email and text" }).locator("..").locator("..");
  await expect(card).toBeVisible();
  await expect(page.getByRole("button", { name: "Process queue" })).toHaveCount(0);
  await expect(card.getByText(/sandbox/)).toHaveCount(0);
  await expect(card.getByText(/attempt/)).toHaveCount(0);
});

test("contact preference toggles persist across a reload", async ({ page }) => {
  await openOliviaRecord(page);

  // Switch order in the card: reminders, marketing, marketing email, marketing text.
  const marketing = page.getByRole("switch").nth(1);
  const before = await marketing.getAttribute("aria-checked");
  await marketing.click();
  await expect(marketing).toHaveAttribute("aria-checked", before === "true" ? "false" : "true");

  await page.reload();
  await page.getByRole("tab", { name: "Contact" }).click();
  await expect(page.getByRole("switch").nth(1)).toHaveAttribute(
    "aria-checked",
    before === "true" ? "false" : "true",
  );

  // Put it back so later specs see the fixture default.
  await page.getByRole("switch").nth(1).click();
  await expect(page.getByRole("switch").nth(1)).toHaveAttribute("aria-checked", before ?? "false");
});
