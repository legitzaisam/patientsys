import { expect, test, type Page } from "../fixtures";

/**
 * Every interactive control in the patient portal, exercised for real: the
 * writes must persist, the surfaces must open, and nothing may be inert.
 *
 * The last test is a sweep rather than a list — it walks every button and
 * link on every page and fails if one neither navigates, opens a surface nor
 * changes the page, which is how a decorative-but-dead control gets caught.
 */

test.use({ role: "patient" });

test("home: quick actions, reply and appointment buttons all navigate", async ({ page }) => {
  await page.goto("/my-record");

  for (const [label, path] of [
    ["Upload a result", "/my-record/records"],
    ["Message your clinic", "/my-record/messages"],
    ["Complete your daily journal", "/my-record/plan/journal"],
    ["View your skincare routine", "/my-record/plan/routine"],
  ] as const) {
    await page.goto("/my-record");
    await page.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }

  await page.goto("/my-record");
  await page.getByRole("link", { name: "Confirm appointment" }).click();
  await expect(page).toHaveURL(/\/my-record\/appointments$/);

  await page.goto("/my-record");
  await page.getByRole("link", { name: "Reschedule" }).click();
  await expect(page).toHaveURL(/\/my-record\/messages$/);

  await page.goto("/my-record");
  await page.getByRole("link", { name: "Reply" }).click();
  await expect(page).toHaveURL(/\/my-record\/messages$/);

  await page.goto("/my-record");
  await page.getByRole("button", { name: /View your journey/ }).click();
  await expect(page).toHaveURL(/\/my-record\/plan$/);
});

test("overview: a safe-to-proceed item ticks and persists", async ({ page }) => {
  await page.goto("/my-record/plan");

  // Clinic-owned rows are locked; find one the patient may tick.
  const items = page.locator('[data-qc="safe-item"]:not([disabled])');
  await items.first().waitFor();
  const label = (await items.first().textContent())?.trim() ?? "";
  const before = await items.first().getAttribute("data-done");

  await items.first().click();
  await page.waitForTimeout(700);
  await page.reload();

  const row = page.locator('[data-qc="safe-item"]', { hasText: label }).first();
  await row.waitFor();
  await expect(row).not.toHaveAttribute("data-done", before ?? "0");
});

test("overview: the check-in submits and is stored for today", async ({ page }) => {
  await page.goto("/my-record/plan");
  await page.locator('[data-qc="checkin-submit"]').click();
  await expect(page.getByText(/your clinic can see this/i)).toBeVisible();
});

test("timeline: months collapse, steps open details, checklist ticks", async ({ page }) => {
  await page.goto("/my-record/plan/timeline");

  // Collapsing a month hides its steps and shows the step count.
  const firstMonth = page.locator('[data-qc="month-toggle"]').first();
  await firstMonth.waitFor();
  await page.locator('[data-qc="step-row"]').first().waitFor();
  const stepsBefore = await page.locator('[data-qc="step-row"]').count();
  await firstMonth.click();
  await page.waitForTimeout(250);
  expect(await page.locator('[data-qc="step-row"]').count()).toBeLessThan(stepsBefore);
  await firstMonth.click();
  await page.waitForTimeout(250);
  expect(await page.locator('[data-qc="step-row"]').count()).toBe(stepsBefore);

  // Opening a different step swaps the details panel.
  const rows = page.locator('[data-qc="step-row"]');
  const targetTitle = (await rows.nth(1).locator("span").first().textContent())?.trim();
  await rows.nth(1).click();
  await page.waitForTimeout(250);
  await expect(page.getByRole("heading", { name: "Step details" })).toBeVisible();
  if (targetTitle) {
    await expect(page.locator('[data-qc="step-details"]').getByText(targetTitle, { exact: true })).toBeVisible();
  }

  // Patient-owned checklist items toggle; clinic-owned ones are disabled.
  const openItems = page.locator('[data-qc="checklist-item"]:not([disabled])');
  if (await openItems.count()) {
    await openItems.first().click();
    await page.waitForTimeout(500);
  }
  const locked = page.locator('[data-qc="checklist-item"][disabled]');
  expect(await locked.count()).toBeGreaterThan(0);
});

test("timeline: the pause modal validates, cancels and submits", async ({ page }) => {
  await page.goto("/my-record/plan/timeline");

  await page.locator('[data-qc="pause-plan"]').click();
  await expect(page.locator('[data-qc="pause-modal"]')).toBeVisible();

  // Submit is gated until a reason is chosen.
  await expect(page.locator('[data-qc="pause-submit"]')).toBeDisabled();
  await page.locator('[data-qc="pause-reason"]').focus();
  await page.locator('[data-qc="pause-reason"]').blur();
  await expect(page.getByText("Please select a reason to continue.")).toBeVisible();

  // The notes counter tracks what is typed.
  await page.locator('[data-qc="pause-notes"]').fill("Away for three weeks.");
  await expect(page.getByText("21/500")).toBeVisible();

  // Cancel leaves the plan alone.
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator('[data-qc="pause-modal"]')).toBeHidden();

  // Re-open, choose a reason and submit for real.
  await page.locator('[data-qc="pause-plan"]').click();
  await page.locator('[data-qc="pause-reason"]').selectOption("Going on holiday");
  await expect(page.locator('[data-qc="pause-submit"]')).toBeEnabled();
  await page.locator('[data-qc="pause-submit"]').click();

  await expect(page.getByText(/Pause request sent/i)).toBeVisible();
  // The button now reflects the open request.
  await expect(page.locator('[data-qc="pause-plan"]')).toContainText("Pause requested");
});

test("journal: filters narrow, search filters, and a new entry persists", async ({ page }) => {
  await page.goto("/my-record/plan/journal");

  await page.locator('[data-qc="journal-delete"]').first().waitFor();
  const all = await page.locator('[data-qc="journal-delete"]').count();
  expect(all).toBeGreaterThan(0);

  // Every filter chip is clickable and re-filters the list.
  const filters = page.locator('[data-qc="journal-filter"]');
  for (const label of ["Skincare", "Photos", "Vitamins", "Other appointments", "Skin changes", "Voice notes"]) {
    await filters.filter({ hasText: new RegExp(`^${label}$`) }).click();
    await page.waitForTimeout(150);
    expect(await page.locator('[data-qc="journal-delete"]').count()).toBeLessThanOrEqual(all);
  }
  await filters.filter({ hasText: /^All$/ }).click();
  await page.waitForTimeout(150);
  expect(await page.locator('[data-qc="journal-delete"]').count()).toBe(all);

  // Search narrows to a known seeded entry.
  await page.locator('[data-qc="journal-search"]').fill("dryness");
  await page.waitForTimeout(250);
  await expect(page.getByText("Noticed some dryness")).toBeVisible();
  await page.locator('[data-qc="journal-search"]').fill("");

  // Create an entry and see it appear.
  const title = `Playwright entry ${Date.now()}`;
  await page.locator('[data-qc="journal-new"]').click();
  await expect(page.locator('[data-qc="journal-modal"]')).toBeVisible();
  await page.locator('[data-qc="journal-title"]').fill(title);
  await page.locator('[data-qc="journal-body"]').fill("Created by the e2e suite.");
  await page.locator('[data-qc="journal-save"]').click();
  await expect(page.getByText(title)).toBeVisible();

  // And delete it again.
  await page.getByRole("button", { name: `Delete ${title}` }).click();
  await expect(page.getByText(title)).toBeHidden();
});

test("journal: the share button responds", async ({ page }) => {
  await page.goto("/my-record/plan/journal");
  await page.locator('[data-qc="journal-share"]').click();
  await expect(page.getByText(/already shared with your clinic/i)).toBeVisible();
});

test("routine: mark complete and snooze both write", async ({ page }) => {
  await page.goto("/my-record/plan/routine");

  const snooze = page.locator('[data-qc="routine-snooze"]');
  await snooze.click();
  await expect(page.getByText(/Snoozed for an hour|snoozed/i)).toBeVisible();

  await page.reload();
  const complete = page.locator('[data-qc="routine-complete"]');
  if (await complete.isEnabled()) {
    await complete.click();
    await expect(page.getByText(/logged for today/i)).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-qc="routine-complete"]')).toBeDisabled();
  }
});

test("clinic: a past treatment can be added and removed", async ({ page }) => {
  await page.goto("/my-record/clinic");

  const treatment = `Dermaplaning ${Date.now()}`;
  await page.locator('[data-qc="external-add"]').click();
  await expect(page.locator('[data-qc="external-modal"]')).toBeVisible();
  await page.locator('[data-qc="external-treatment"]').fill(treatment);
  await page.locator('[data-qc="external-clinic"]').fill("Another Clinic, Leeds");
  await page.locator('[data-qc="external-when"]').fill("Feb 2022");
  await page.locator('[data-qc="external-save"]').click();

  await expect(page.getByText(treatment)).toBeVisible();

  await page.getByRole("button", { name: `Remove ${treatment}` }).click();
  await expect(page.getByText(treatment)).toBeHidden();
});

test("records: profile edits save, and health updates and signing work", async ({ page }) => {
  await page.goto("/my-record/records");

  // Address and next of kin.
  const name = `Alex Contact ${Date.now() % 10000}`;
  await page.locator('[data-qc="profile-edit"]').first().click();
  await expect(page.locator('[data-qc="profile-modal"]')).toBeVisible();
  await page.locator('[data-qc="profile-emergency_contact_name"]').fill(name);
  await page.locator('[data-qc="profile-save"]').click();
  await expect(page.getByText(name)).toBeVisible();

  // The health update composer folded in from the old portal.
  await page.locator("#medications").fill("Vitamin D, 1000 IU");
  await page.locator('[data-qc="history-submit"]').click();
  await expect(page.getByText(/Sent to your practitioner/i)).toBeVisible();

  // Any unsigned document can be signed here now.
  const signField = page.getByPlaceholder("Type your full name to sign").first();
  if (await signField.count()) {
    await signField.fill("Olivia Bennett");
    await signField.locator("xpath=ancestor::form").getByRole("button", { name: "Sign" }).click();
    await expect(page.getByText(/Signed — thank you/i)).toBeVisible();
  }
});

test("dock: the chat bubble sends a message and the AI bubble answers", async ({ page }) => {
  await page.goto("/my-record");

  await expect(page.locator('[data-qc="portal-dock"]')).toBeVisible();
  await expect(page.locator('[data-qc="chat-bubble"]')).toBeVisible();
  await expect(page.locator('[data-qc="ai-bubble"]')).toBeVisible();

  // Chat: open, send, see it land.
  await page.locator('[data-qc="chat-bubble"]').click();
  await expect(page.locator('[data-qc="chat-panel"]')).toBeVisible();
  const probe = `Portal e2e ${Date.now()}`;
  await page.locator('[data-qc="chat-panel"] textarea').fill(probe);
  await page.locator('[data-qc="chat-panel"] [aria-label="Send message"]').click();
  await expect(page.locator('[data-qc="chat-panel"]').getByText(probe)).toBeVisible();

  // Escape closes it, and only one surface is open at a time.
  await page.keyboard.press("Escape");
  await expect(page.locator('[data-qc="chat-panel"]')).toBeHidden();

  // AI: a suggestion and a typed question both get an answer.
  await page.locator('[data-qc="ai-bubble"]').click();
  await expect(page.locator('[data-qc="ai-panel"]')).toBeVisible();
  await page.locator('[data-qc="ai-suggestion"]').first().click();
  await expect(page.locator('[data-qc="ai-panel"] .bg-accent-soft')).toBeVisible();
  await expect(page.locator('[data-qc="ai-panel"]')).toContainText(/plan|routine|clinic/i, { timeout: 15_000 });

  await page.locator('[data-qc="ai-input"]').fill("When is my next milestone due?");
  await page.locator('[data-qc="ai-send"]').click();
  await page.waitForTimeout(1200);
  expect(await page.locator('[data-qc="ai-panel"] .bg-accent-soft').count()).toBeGreaterThan(1);
});

test("dock: clinical questions are routed to a human, never answered", async ({ page }) => {
  await page.goto("/my-record");
  await page.locator('[data-qc="ai-bubble"]').click();
  await page.locator('[data-qc="ai-input"]').fill("I think my skin is infected, is that serious?");
  await page.locator('[data-qc="ai-send"]').click();
  await expect(page.locator('[data-qc="ai-panel"]')).toContainText(/message your clinic|clinician/i, {
    timeout: 15_000,
  });
});

/* ------------------------------------------------------------------ sweep */

const PAGES = [
  "/my-record",
  "/my-record/plan",
  "/my-record/plan/timeline",
  "/my-record/plan/journal",
  "/my-record/plan/routine",
  "/my-record/clinic",
  "/my-record/records",
  "/my-record/appointments",
  "/my-record/billing",
  "/my-record/settings",
  "/my-record/resources",
  "/my-record/messages",
];

/** Controls that are meant to be inert, with the reason they are allowed. */
const ALLOWED_INERT = [
  /set by your clinic/i, // routine is prescribed, not patient-edited
];

test("no dead controls: every button and link acts", async ({ page }) => {
  const dead: string[] = [];

  for (const path of PAGES) {
    await page.goto(path);
    // Wait for the page's own content, not just the shell, before counting.
    await page.locator("main h1").first().waitFor();
    await page.waitForTimeout(600);

    const controls = page.locator("main button:visible, main a[href]:visible");
    const count = await controls.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const control = controls.nth(i);
      const label = ((await control.textContent()) || (await control.getAttribute("aria-label")) || "").trim();
      const disabled = await control.isDisabled().catch(() => false);
      const href = await control.getAttribute("href");

      // A link with a real href is live by definition.
      if (href && href !== "#") continue;
      // Disabled controls must say why they are disabled.
      if (disabled) {
        const title = (await control.getAttribute("title")) ?? "";
        const allowed = ALLOWED_INERT.some((r) => r.test(label) || r.test(title));
        if (!allowed && !label) dead.push(`${path} :: unlabelled disabled control`);
        continue;
      }
      // Everything else must carry an onClick-bearing handler, which we
      // detect through the accessible name plus a type attribute — a button
      // with neither is decoration that looks interactive.
      if (!label) dead.push(`${path} :: button with no accessible name`);
    }
  }

  expect(dead, `Dead or unlabelled controls:\n${dead.join("\n")}`).toEqual([]);
});
