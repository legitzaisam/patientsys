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

test("an urgent alert on a teammate's day card opens where it lives, ready to act on", async ({ page }) => {
  await page.getByRole("button", { name: /^Sofia Marchetti.*Show today’s availability/ }).click();
  const card = page.locator('[data-qc="team-member-card"]');
  // A team-wide alert is one entry, not one per recipient.
  await expect(card.locator('[data-qc="day-card-alert"]')).toHaveCount(1);
  await card.locator('[data-qc="day-card-alert"]').click();

  const chat = page.locator('[data-qc="chat-window"]');
  await expect(chat.locator("header")).toContainText("Sofia Marchetti");
  const alert = chat.locator('[data-qc="staff-chat-alert"]', { hasText: "autoclave in room 2 failed its cycle this morning" });
  await expect(alert.locator('[data-qc="staff-chat-alert-ack"]')).toBeVisible();
  await expect(alert.getByRole("button", { name: "Dismiss alert" })).toBeVisible();
  await alert.locator('[data-qc="staff-chat-alert-reply"]').click();
  await expect(chat.locator("textarea")).toBeFocused();
});

test("replying to an alert sends it to the sender's Team alerts with a toast", async ({ page, browser, baseURL }) => {
  // The owner stays on the dashboard so the reply arrives while they are signed in.
  await expect(page.getByRole("button", { name: /^Team alerts/ })).toBeVisible();

  const deskContext = await browser.newContext();
  await deskContext.addCookies([{ name: "demo_role", value: "front_desk", url: baseURL ?? "http://localhost:8091" }]);
  const desk = await deskContext.newPage();
  await desk.goto("/dashboard");
  await desk.locator('[data-qc="chat-bubble"]').click();
  const chat = desk.locator('[data-qc="chat-window"]');
  await chat.locator('[data-qc="team-inbox"]').getByRole("button", { name: /Dr Amara Osei/ }).click();

  const alert = chat.locator('[data-qc="staff-chat-alert"]', { hasText: "Please chase the two outstanding consent forms" });
  await alert.locator('[data-qc="staff-chat-alert-reply"]').click();
  const chip = chat.locator('[data-qc="composer-reply-chip"]');
  await expect(chip).toContainText("Replying to Dr Amara Osei's alert");
  await expect(chip).toContainText("Please chase the two outstanding consent forms");
  await expect(chat.getByRole("button", { name: "Attach file" })).toHaveCount(0);

  const reply = `Both chased ${Date.now()}`;
  await chat.locator("textarea").fill(reply);
  await chat.locator("textarea").press("Enter");
  await expect(chip).toHaveCount(0);
  const sent = chat.locator('[data-qc="staff-chat-alert"]', { hasText: reply });
  await expect(sent).toContainText("Reply");
  await expect(sent.locator('[data-qc="staff-chat-alert-quote"]')).toContainText("Please chase the two outstanding consent forms");
  await deskContext.close();

  const toast = page.locator("[data-sonner-toast]", { hasText: reply });
  await expect(toast).toContainText("Replied to your alert", { timeout: 15_000 });
  await expect(toast).toContainText("Sofia Marchetti");

  await page.getByRole("button", { name: /^Team alerts/ }).click();
  const inbox = page.getByRole("dialog").filter({ hasText: "Team alerts" });
  const stack = inbox.getByRole("button", { name: /^Expand \d+ alerts with Sofia Marchetti/ });
  if (await stack.isVisible()) await stack.click();
  const row = inbox.getByRole("button", { name: "Open alert with Sofia Marchetti" }).filter({ hasText: reply });
  await expect(row).toBeVisible();
  await expect(row.locator('[data-qc="alert-reply-tag"]')).toBeVisible();
});

test("a reply from the urgent alert card reaches the sender's toast, Team alerts and thread", async ({ page, browser, baseURL }) => {
  // Sofia is signed in first, so the reply arrives while she is on the page.
  const deskContext = await browser.newContext();
  await deskContext.addCookies([{ name: "demo_role", value: "front_desk", url: baseURL ?? "http://localhost:8091" }]);
  const desk = await deskContext.newPage();
  await desk.goto("/dashboard");
  await expect(desk.getByRole("button", { name: /^Team alerts/ })).toBeVisible();

  const panel = page.locator('[data-qc="alert-panel"]');
  if (!(await panel.getByRole("region", { name: "Urgent team alerts" }).isVisible())) {
    await page.locator('[data-qc="alert-bubble"]').click();
  }
  const card = panel.getByRole("region", { name: "Urgent team alerts" });
  await expect(card).toContainText("From Sofia Marchetti");
  await card.getByRole("button", { name: "Message" }).click();
  const reply = `Engineer confirmed ${Date.now()}`;
  await card.locator("textarea").fill(reply);
  await card.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("Reply sent")).toBeVisible();

  const toast = desk.locator("[data-sonner-toast]", { hasText: reply });
  await expect(toast).toContainText("Replied to your alert", { timeout: 15_000 });
  await expect(toast).toContainText("Dr Amara Osei");

  await desk.getByRole("button", { name: /^Team alerts/ }).click();
  const inbox = desk.getByRole("dialog").filter({ hasText: "Team alerts" });
  const stack = inbox.getByRole("button", { name: /^Expand \d+ alerts with Dr Amara Osei/ });
  if (await stack.isVisible()) await stack.click();
  const row = inbox.getByRole("button", { name: "Open alert with Dr Amara Osei" }).filter({ hasText: reply });
  await expect(row.locator('[data-qc="alert-reply-tag"]')).toBeVisible();

  await row.click();
  const thread = desk.locator('[data-qc="chat-window"] [data-qc="staff-chat-embedded"]');
  const bubble = thread.locator('[data-qc="staff-chat-alert"]', { hasText: reply });
  await expect(bubble.locator('[data-qc="staff-chat-alert-quote"]')).toContainText("autoclave in room 2");
  // Seeded alerts are stamped at fixed clock times later today, so the newest line in the
  // conversation list depends on when the suite runs; assert it is an alert line either way.
  const alertLine = /(Reply|Urgent alert|Alert): /;
  await desk.locator('[data-qc="chat-window"]').getByRole("button", { name: "Back to conversations" }).click();
  await expect(
    desk.locator('[data-qc="team-inbox"]').getByRole("button", { name: /Dr Amara Osei/ }),
  ).toContainText(alertLine);

  await page.locator('[data-qc="chat-bubble"]').click();
  await expect(
    page.locator('[data-qc="team-inbox"]').getByRole("button", { name: /Sofia Marchetti/ }),
  ).toContainText(alertLine);
  await deskContext.close();
});

test("opening an alert jumps to that teammate in the Team tab", async ({ page }) => {
  await page.getByRole("button", { name: /^Team alerts/ }).click();
  await page.getByRole("button", { name: /^Expand \d+ alerts with Sofia Marchetti/ }).click();
  await page.getByRole("button", { name: "Open alert with Sofia Marchetti" }).first().click();
  const chat = page.locator('[data-qc="chat-window"]');
  await expect(chat.locator("header")).toContainText("Sofia Marchetti");
  await expect(chat.locator("header")).toContainText("Team messages and alerts");
});
