import { expect, test } from "./fixtures";

/**
 * The public consent signing route (/d/$token): no session, the token is the
 * credential. The demo fixtures seed a pending consent for Olivia under a
 * known token (DEMO_CONSENT_TOKEN in src/lib/demo/data.ts).
 */

const TOKEN = "e2ec0deba5e00000e2ec0deba5e00000e2ec0deba5e00000";

// No demo_role cookie on these tests: the whole point is that the page works
// with no identity at all. The role fixture still sets one, so clear it.
test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test("issuing a consent form queues the signing-link email", async ({ page, context, baseURL }) => {
  await context.addCookies([{ name: "demo_role", value: "owner", url: baseURL! }]);
  await page.goto("/patients");
  await page.getByRole("link", { name: /Bennett, .*Olivia/ }).click();

  await page.getByRole("button", { name: "Send form" }).click();
  const dialog = page.getByRole("dialog", { name: "Send to patient" });
  await dialog.getByLabel("Title").fill("Chemical peel — consent form (magic link)");
  await dialog.getByRole("button", { name: "Send", exact: true }).click();
  await expect(dialog).toBeHidden();

  // The outbox on the record's Contact tab now holds a queued transactional consent email.
  await page.getByRole("tab", { name: "Contact" }).click();
  const row = page.locator("li", { hasText: "please review and sign" }).first();
  await expect(row.getByText("queued", { exact: true })).toBeVisible();
  await expect(row.getByText(/transactional/)).toBeVisible();
});

test("the emailed link renders the form and takes a signature", async ({ page }) => {
  await page.goto(`/d/${TOKEN}`);
  await expect(page.getByRole("heading", { name: "Lip filler — consent form" })).toBeVisible();
  await expect(page.getByText("I confirm the risks")).toBeVisible();

  await page.getByLabel("Type your full name to sign").fill("Olivia Bennett");
  await page.getByRole("button", { name: "Sign form" }).click();

  await expect(page.getByRole("heading", { name: "Thank you — form signed" })).toBeVisible();
});

test("a replayed link is refused after signing", async ({ page }) => {
  await page.goto(`/d/${TOKEN}`);
  await expect(page.getByRole("heading", { name: "Already completed" })).toBeVisible();
  await expect(page.getByLabel("Type your full name to sign")).toHaveCount(0);
});

test("a garbage token reads exactly like an expired one", async ({ page }) => {
  await page.goto("/d/0000000000000000000000000000000000000000000000ff");
  await expect(page.getByRole("heading", { name: "This link isn't available" })).toBeVisible();

  await page.goto("/d/not-even-a-token");
  await expect(page.getByRole("heading", { name: "This link isn't available" })).toBeVisible();
});
