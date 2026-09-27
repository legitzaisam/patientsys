import { expect, test } from "./fixtures";

/**
 * Team chat lives in the chat window's Team tab; the toolbar inbox holds
 * team alerts only.
 */
test.use({ role: "owner" });

test.beforeEach(async ({ page }) => {
  await page.goto("/dashboard");
  // The fixture hides the dock to keep page corners clear; this spec needs it.
  await page.addStyleTag({ content: '[data-qc="floating-dock"] { display: flex !important; }' });
});

test("the toolbar inbox lists team alerts, not team chat", async ({ page }) => {
  await page.getByRole("button", { name: /^Team alerts/ }).click();
  const popover = page.getByRole("dialog").filter({ hasText: "Team alerts" });
  await expect(popover).toBeVisible();
  await expect(popover.getByText(/autoclave in room 2 failed its cycle this morning/i).first()).toBeVisible();
  // A chat line from the seeded Sofia thread stays out of the alerts inbox.
  await expect(popover.getByText("Done. Also chasing the two outstanding consent forms now.")).toHaveCount(0);
});

test("the chat window opens on Team, and Patients holds the patient threads", async ({ page }) => {
  await page.locator('[data-qc="chat-bubble"]').click();
  const chat = page.locator('[data-qc="chat-window"]');
  await expect(chat.locator('[data-qc="chat-tab-team"]')).toHaveAttribute("aria-selected", "true");

  await chat.getByRole("button", { name: /Sofia Marchetti/ }).click();
  const thread = chat.locator('[data-qc="staff-chat-embedded"]');
  await expect(thread.getByText("Done. Also chasing the two outstanding consent forms now.")).toBeVisible();

  const probe = `Team dock ${Date.now()}`;
  await thread.locator("textarea").fill(probe);
  await thread.locator("textarea").press("Enter");
  await expect(thread.getByText(probe)).toBeVisible();

  await chat.getByRole("button", { name: "Back to conversations" }).click();
  await chat.locator('[data-qc="chat-tab-patients"]').click();
  await expect(chat.getByText("Leila Farouk")).toBeVisible();
});

test("opening an alert jumps to that teammate in the Team tab", async ({ page }) => {
  await page.getByRole("button", { name: /^Team alerts/ }).click();
  await page.getByRole("button", { name: /^Expand \d+ alerts with Sofia Marchetti/ }).click();
  await page.getByRole("button", { name: "Open alert with Sofia Marchetti" }).first().click();
  const chat = page.locator('[data-qc="chat-window"]');
  await expect(chat.locator("header")).toContainText("Sofia Marchetti");
  await expect(chat.locator("header")).toContainText("Team messages and alerts");
});
