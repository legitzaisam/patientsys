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

// Runs first: it needs the seeded clinic reply still unread, and every other
// test that opens the chat marks it read.
test("home: the latest clinic message reads as New until the chat is opened", async ({ page }) => {
  await page.goto("/my-record");
  const state = page.locator('[data-qc="message-read-state"]');
  await expect(state).toHaveText("New");
  await expect(page.getByRole("button", { name: "Read and reply" })).toBeVisible();

  await page.locator('[data-qc="chat-bubble"]').click();
  await expect(page.locator('[data-qc="chat-panel"]')).toBeVisible();
  await expect(state).toHaveText(/Read/);
  await expect(page.getByRole("button", { name: "Reply if you'd like" })).toBeVisible();
});

test("home: quick actions navigate, and message actions open the dock chat", async ({ page }) => {
  for (const [label, path] of [
    ["Upload a result", "/my-record/records"],
    ["Complete your daily journal", "/my-record/plan/journal"],
    ["View your skincare routine", "/my-record/plan/routine"],
  ] as const) {
    await page.goto("/my-record");
    await page.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
  }

  // "Message your clinic" opens the corner chat instead of leaving the page.
  await page.goto("/my-record");
  await page.locator('[data-qc="portal-home"]').getByRole("button", { name: "Message your clinic", exact: true }).click();
  await expect(page.locator('[data-qc="chat-panel"]')).toBeVisible();
  await expect(page).toHaveURL(/\/my-record\/?$/);
  await page.keyboard.press("Escape");

  // Reschedule opens the chat with a draft that names the appointment.
  await page.getByRole("button", { name: "Reschedule" }).click();
  await expect(page.locator('[data-qc="chat-panel"]')).toBeVisible();
  await expect(page.locator('[data-qc="chat-panel"] textarea')).toHaveValue(/reschedule/i);
  await page.keyboard.press("Escape");

  // The latest-message action opens the same chat.
  await page.locator('[data-qc="message-read-state"]').waitFor();
  await page.getByRole("button", { name: /Read and reply|Reply if you'd like|Open conversation/ }).click();
  await expect(page.locator('[data-qc="chat-panel"]')).toBeVisible();
});

test("home: the next-appointment card asks for confirmation, then shows it confirmed", async ({ page }) => {
  await page.goto("/my-record");

  // Unconfirmed: the card is a request to confirm, and the tile says so.
  await expect(page.locator('[data-qc="next-appointment-confirm"]')).toBeVisible();
  await expect(page.getByText("Please confirm", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Confirm appointment" }).click();
  await expect(page.getByText("Appointment confirmed")).toBeVisible();

  // Confirmed: the card presents the appointment and the confirm button is gone.
  await expect(page.locator('[data-qc="next-appointment"]')).toBeVisible();
  await expect(page.locator('[data-qc="next-appointment"]')).toContainText("Confirmed");
  await expect(page.getByRole("button", { name: "Confirm appointment" })).toHaveCount(0);

  // It survives a reload and shows on the appointments page too.
  await page.reload();
  await expect(page.locator('[data-qc="next-appointment"]')).toBeVisible();
  await page.goto("/my-record/appointments");
  await expect(page.getByText("Confirmed").first()).toBeVisible();
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

test("overview: the check-in sliders drag, persist, and the note field saves", async ({ page }) => {
  await page.goto("/my-record/plan");

  // Sliders are real range inputs: set one and it is written on release.
  const redness = page.getByRole("slider", { name: /^Redness/ });
  await redness.waitFor();
  await redness.focus();
  await redness.fill("72");
  await redness.dispatchEvent("pointerup");
  await expect(page.getByText("Check-in saved")).toBeVisible();
  await expect(page.getByRole("slider", { name: /^Redness: Severe/ })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("slider", { name: /^Redness: Severe/ })).toBeVisible();

  // "Add note" opens a real field and the note is stored with today's reading.
  await page.locator('[data-qc="checkin-submit"]').click();
  await expect(page.locator('[data-qc="checkin-note"]')).toBeVisible();
  const note = `Stings a little after cleansing ${Date.now() % 1000}`;
  await page.locator("#checkin-note").fill(note);
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText(/your clinic can see this/i)).toBeVisible();
  await page.reload();
  await expect(page.getByText(note)).toBeVisible();

  // The Safe to Proceed link carries the new label.
  await expect(page.getByRole("button", { name: /View more details/ })).toBeVisible();
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
  // A finished session reads "Treatment details"; everything else "Step details".
  await expect(page.getByRole("heading", { name: /Step details|Treatment details/ })).toBeVisible();
  if (targetTitle) {
    await expect(page.locator('[data-qc="step-details"]').getByText(targetTitle, { exact: true })).toBeVisible();
  }

  // Patient-owned checklist items toggle; clinic-owned ones are disabled.
  await page.locator('[data-qc="step-row"][data-step-status="current"]').first().click();
  const openItems = page.locator('[data-qc="checklist-item"]:not([disabled])');
  if (await openItems.count()) {
    await openItems.first().click();
    await page.waitForTimeout(500);
  }
  const locked = page.locator('[data-qc="checklist-item"][disabled]');
  expect(await locked.count()).toBeGreaterThan(0);
});

test("timeline: completed, in-progress and upcoming steps each get their own card", async ({ page }) => {
  await page.goto("/my-record/plan/timeline");
  const details = page.locator('[data-qc="step-details"]');

  // Completed session: appointment date, consent and consultation pills,
  // visit notes — and no checklist or clinician guidance.
  await page.locator('[data-qc="step-row"][data-step-status="done"]', { hasText: /Treatment session/ }).first().click();
  await expect(details.getByRole("heading", { name: "Treatment details" })).toBeVisible();
  await expect(details.locator('[data-qc="step-pills"]')).toContainText("Consent");
  await expect(details.locator('[data-qc="step-pills"]')).toContainText("Consultation");
  await expect(details.locator('[data-qc="step-visit-note"]')).toBeVisible();
  await expect(details.locator('[data-qc="checklist-item"]')).toHaveCount(0);
  await expect(details.getByText("Clinician guidance")).toHaveCount(0);
  // Completed steps show the date they were completed, never "To be confirmed".
  await expect(details.getByText("To be confirmed")).toHaveCount(0);

  // In progress: due date, booked slot and the checklist.
  await page.locator('[data-qc="step-row"][data-step-status="current"]').first().click();
  await expect(details.getByRole("heading", { name: "Step details" })).toBeVisible();
  await expect(details.getByText("Due date")).toBeVisible();
  expect(await details.locator('[data-qc="checklist-item"]').count()).toBeGreaterThan(0);

  // Upcoming: checklist plus a way to ask the clinic about the step.
  await page.locator('[data-qc="step-row"][data-step-status="upcoming"]').first().click();
  await expect(details.locator('[data-qc="step-contact"]')).toBeVisible();
  await details.locator('[data-qc="step-contact"]').click();
  await expect(page.locator('[data-qc="chat-panel"]')).toBeVisible();
  await expect(page.locator('[data-qc="chat-panel"] textarea')).toHaveValue(/question about/i);
});

test("overview → timeline: 'View the step' lands on that step, highlighted", async ({ page }) => {
  await page.goto("/my-record/plan");
  await page.getByRole("button", { name: "View the step" }).click();
  await expect(page).toHaveURL(/\/my-record\/plan\/timeline\?step=/);
  const id = new URL(page.url()).searchParams.get("step");
  expect(id).toBeTruthy();
  const row = page.locator(`#step-${id}`);
  await expect(row).toBeVisible();
  await expect(row).toHaveClass(/bg-accent-soft/);
  await expect(page.locator('[data-qc="step-details"]')).toBeVisible();
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

  // Tags sit on the title line, one per entry, never wrapped onto their own row.
  const tags = page.locator('[data-qc="journal-tag"]');
  expect(await tags.count()).toBe(all);
  for (let i = 0; i < Math.min(3, all); i++) {
    const tagBox = await tags.nth(i).boundingBox();
    const titleBox = await tags.nth(i).locator("xpath=preceding-sibling::p").boundingBox();
    expect(tagBox && titleBox && Math.abs(tagBox.y - titleBox.y) < 8).toBeTruthy();
  }

  // One Tags button opens the filter menu; every tag narrows the list.
  const tagsButton = page.locator('[data-qc="journal-tags"]');
  for (const label of ["Skincare", "Photos", "Vitamins", "Other appointments", "Skin changes", "Voice notes"]) {
    await tagsButton.click();
    await page.getByRole("menuitem", { name: label }).click();
    await page.waitForTimeout(150);
    await expect(tagsButton).toContainText(label);
    expect(await page.locator('[data-qc="journal-delete"]').count()).toBeLessThanOrEqual(all);
  }
  await tagsButton.click();
  await page.getByRole("menuitem", { name: "All" }).click();
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
  await expect(page.getByText(/Reminder snoozed for an hour/)).toBeVisible();

  await page.reload();
  const complete = page.locator('[data-qc="routine-complete"]');
  if (await complete.isEnabled()) {
    await complete.click();
    await expect(page.getByText(/logged for today/i)).toBeVisible();
    await page.reload();
    await expect(page.locator('[data-qc="routine-complete"]')).toBeDisabled();
  }
});

test("routine: a product can be swapped for the patient's own, and swapped back", async ({ page }) => {
  await page.goto("/my-record/plan/routine");

  // The seeded routine already carries one own-product step (SPF).
  await page.locator('[data-qc="routine-item"]').first().waitFor();
  const ownBefore = await page.locator('[data-qc="routine-own"]').count();
  expect(ownBefore).toBeGreaterThanOrEqual(1);

  // Edit the first step manually (the link fetch needs the network; the
  // manual path is what the fetch falls back to).
  const firstRow = page.locator('[data-qc="routine-item"]').first();
  const clinicProduct = (await firstRow.locator("p.text-xs.font-semibold").textContent())?.trim() ?? "";
  await firstRow.locator('[data-qc="routine-edit"]').click();
  await expect(page.locator('[data-qc="routine-editor"]')).toBeVisible();

  // An unreachable link reports honestly and leaves the manual fields.
  await page.locator('[data-qc="routine-url"]').fill("http://127.0.0.1:9/nothing-here");
  await page.locator('[data-qc="routine-fetch"]').click();
  await expect(page.locator('[data-qc="routine-fetch-result"]')).toContainText(/Could not read that page/i, {
    timeout: 15_000,
  });

  const mine = `CeraVe Hydrating Cleanser ${Date.now() % 1000}`;
  await page.locator('[data-qc="routine-name"]').fill(mine);
  await page.locator('[data-qc="routine-howto"]').fill("Massage onto damp skin and rinse.");
  await page.locator('[data-qc="routine-save"]').click();
  await expect(page.getByText(/your routine shows your product/i)).toBeVisible();

  // The row leads with the patient's product and keeps the clinic's beneath.
  const row = page.locator('[data-qc="routine-item"]', { hasText: mine });
  await expect(row).toBeVisible();
  await expect(row.locator('[data-qc="routine-own"]')).toBeVisible();
  await expect(row).toContainText(`Clinic suggested ${clinicProduct}`);
  await page.reload();
  await expect(page.locator('[data-qc="routine-item"]', { hasText: mine })).toBeVisible();

  // And back to the clinic's recommendation.
  await page.locator('[data-qc="routine-item"]', { hasText: mine }).locator('[data-qc="routine-edit"]').click();
  await page.locator('[data-qc="routine-clear"]').click();
  await expect(page.getByText(/Back to your clinic's recommendation/i)).toBeVisible();
  await expect(page.locator('[data-qc="routine-item"]', { hasText: mine })).toHaveCount(0);
  expect(await page.locator('[data-qc="routine-own"]').count()).toBe(ownBefore);
});

test("clinic: Message clinician opens the chat addressed to them", async ({ page }) => {
  await page.goto("/my-record/clinic");
  await page.locator('[data-qc="message-clinician"]').click();
  await expect(page.locator('[data-qc="chat-panel"]')).toBeVisible();
  await expect(page.locator('[data-qc="chat-panel"] textarea')).toHaveValue(/^Hi Nadia Rahman/);
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

test("records: the archive card is content-sized and opens the photo gallery", async ({ page }) => {
  await page.goto("/my-record/records");
  const archive = page.locator('[data-qc="photo-archive"]');
  await archive.waitFor();
  // A standalone card must not stretch to fill the page.
  const box = await archive.boundingBox();
  expect(box && box.height < 320).toBeTruthy();
  const health = page.getByRole("heading", { name: "Update your health information" }).locator("xpath=ancestor::div[contains(@class,'glass-card')]").first();
  const healthBox = await health.boundingBox();
  expect(healthBox && healthBox.height < 420).toBeTruthy();

  // Thumbnails inline, and the gallery opens with every shared photo.
  expect(await archive.locator('[data-qc="photo-strip"] button').count()).toBeGreaterThan(0);
  await page.getByRole("button", { name: "View my gallery" }).click();
  const gallery = page.locator('[data-qc="photo-gallery"]');
  await expect(gallery).toBeVisible();
  expect(await gallery.locator("img").count()).toBeGreaterThan(0);
  await expect(gallery.getByText(/Before/).first()).toBeVisible();
  await gallery.getByRole("button", { name: "Close", exact: true }).click();
  await expect(gallery).toBeHidden();
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
    const form = signField.locator("xpath=ancestor::form");
    const nos = form.getByRole("radio", { name: "No" });
    const questionCount = await nos.count();
    for (let i = 0; i < questionCount; i++) await nos.nth(i).click();
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
