import { expect, test, type Page } from "./fixtures";

/**
 * The treatment workflow, arrival to complete.
 *
 * Fixtures for today (see TODAY_PLAN in src/lib/demo/data.ts):
 *   - Freya Sundqvist, 15:30 Chemical Peel, booked, consent SIGNED, Dr Nadia Rahman
 *   - Olivia Bennett, 15:00 Anti-Wrinkle, booked, consent NONE, Dr Nadia Rahman
 *   - Rebecca Lindqvist, 14:00 Cheek Filler, booked, consent SENT (known token), Dr Amara Osei
 *   - Nadia Petrova, 13:00 Profhilo, already WAITING, Dr Nadia Rahman
 *
 * Tests run in order on one in-memory fixture set, so each one builds on the
 * state the previous one left.
 */

const TODAY_TOKEN = "e2ec0deba5e00001e2ec0deba5e00001e2ec0deba5e00001";
const BASE = "http://localhost:8091";

async function become(page: Page, role: "owner" | "practitioner" | "front_desk" | "patient") {
  await page.context().addCookies([{ name: "demo_role", value: role, url: BASE }]);
}

function diaryCard(page: Page, name: string) {
  return page.locator("[data-diary-slide]", { hasText: name }).first();
}

async function openStageMenu(page: Page, name: string) {
  const badge = diaryCard(page, name).getByRole("button", { name: /Booked|Arrived|Waiting|In treatment|Aftercare|Complete/ }).first();
  await badge.hover();
  await page.waitForTimeout(500);
  await expect(page.getByText("Patient journey")).toBeVisible();
}

function stageOf(page: Page, name: string) {
  return diaryCard(page, name).getByRole("button", { name: /Booked|Arrived|Waiting|In treatment|Aftercare|Complete|No show/ }).first();
}

test.describe.configure({ mode: "serial" });

test("arrived with signed consent goes straight to waiting, and the practitioner is nudged", async ({ page }) => {
  await become(page, "owner");
  await page.goto("/dashboard");
  await diaryCard(page, "Freya Sundqvist").waitFor();
  await expect(stageOf(page, "Freya Sundqvist")).toHaveText(/Booked/);

  await openStageMenu(page, "Freya Sundqvist");
  await page.locator('[data-stage-option="arrived"]').first().click();
  await expect(stageOf(page, "Freya Sundqvist")).toHaveText(/Waiting/, { timeout: 10_000 });

  // Her practitioner sees it in the bell and the dock.
  await become(page, "practitioner");
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await expect(page.getByText("Freya Sundqvist is waiting").first()).toBeVisible();
  await page.keyboard.press("Escape");
  // The dock shows one waiting card at a time (Nadia Petrova was already
  // waiting in the fixtures), with a 1/2 counter over both.
  await expect(page.locator('[data-qc="dock-card-waiting"]')).toHaveCount(1);
  await expect(page.locator('[data-qc="dock-card-waiting"]')).toContainText(/is waiting/);
  await expect(page.locator('[data-qc="dock-start-treatment"]')).toHaveCount(1);
});

test("arrived without consent stays arrived; the menu says why; signing in clinic moves them on", async ({ page }) => {
  await become(page, "owner");
  await page.goto("/dashboard");
  await diaryCard(page, "Olivia Bennett").waitFor();

  await openStageMenu(page, "Olivia Bennett");
  await page.locator('[data-stage-option="arrived"]').first().click();
  await expect(stageOf(page, "Olivia Bennett")).toHaveText(/Arrived/, { timeout: 10_000 });

  // Guided menu: Waiting is disabled with a reason; In treatment opens the form.
  await page.mouse.move(10, 10);
  await page.waitForTimeout(400);
  await openStageMenu(page, "Olivia Bennett");
  const waiting = page.locator('[data-stage-option="waiting"]').first();
  await expect(waiting).toBeDisabled();
  await expect(waiting).toContainText(/Consent is outstanding/);
  await expect(page.locator('[data-stage-option="in_treatment"]').first()).toContainText(/opens the form/);
  await page.mouse.move(10, 10);
  await page.waitForTimeout(400);

  // The card dialog offers to complete consent (the dock carries the same
  // card behind the waiting ones the owner also sees).
  await diaryCard(page, "Olivia Bennett").getByText(/Anti-Wrinkle/).click();
  await page.locator('[data-qc="complete-consent"]').click();
  const dialog = page.locator('[data-qc="consent-in-clinic"]');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/I confirm the risks/)).toBeVisible();
  await expect(dialog.locator('[data-qc="consent-sign"]')).toBeDisabled();
  const questions = dialog.locator('[data-qc^="contraindication-"]');
  const questionCount = await questions.count();
  for (let i = 0; i < questionCount; i++) await questions.nth(i).getByRole("radio", { name: "No" }).click();
  await dialog.locator('[data-qc="consent-understood"]').click();
  const pad = dialog.locator('[data-qc="consent-signature"]');
  const box = await pad.boundingBox();
  if (!box) throw new Error("signature pad missing");
  await page.mouse.move(box.x + 24, box.y + 40);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 40, box.y + 50, { steps: 8 });
  await page.mouse.up();
  await expect(dialog.getByText(/Witnessed by Dr Amara Osei/)).toBeVisible();
  await expect(dialog.locator('[data-qc="consent-sign"]')).toBeEnabled();
  await dialog.locator('[data-qc="consent-sign"]').click();
  await expect(page.getByText("Consent signed — Olivia is now waiting")).toBeVisible();
  // The card's detail dialog is still open and now reads Waiting, with the form on offer.
  const detail = page.getByRole("dialog", { name: /Olivia Bennett/ });
  await expect(detail.getByRole("button", { name: /^Waiting/ })).toBeVisible({ timeout: 10_000 });
  await expect(detail.locator('[data-qc="start-treatment"]')).toBeVisible();
  await detail.getByRole("button", { name: "Close" }).click();
  await expect(stageOf(page, "Olivia Bennett")).toHaveText(/Waiting/, { timeout: 10_000 });

  // The signature is on the record with the witness.
  await page.goto("/patients?q=Bennett");
  await page.getByRole("link", { name: /Bennett, .*Olivia/ }).click();
  await page.getByRole("tab", { name: "Documents" }).click();
  await expect(page.getByText(/Anti-Wrinkle Injections — consent form/).first()).toBeVisible();
  await expect(page.getByText(/signed .* by Olivia Bennett/).first()).toBeVisible();
});

test("signing through the public link moves an arrived patient to waiting", async ({ page, request }) => {
  await become(page, "owner");
  await page.goto("/dashboard");
  await diaryCard(page, "Rebecca Lindqvist").waitFor();
  await openStageMenu(page, "Rebecca Lindqvist");
  await page.locator('[data-stage-option="arrived"]').first().click();
  await expect(stageOf(page, "Rebecca Lindqvist")).toHaveText(/Arrived/, { timeout: 10_000 });

  // The patient signs from their phone (the emailed link).
  const res = await request.post(`/api/documents/access/${TODAY_TOKEN}`, { data: { signed_name: "Rebecca Lindqvist" } });
  expect(res.status()).toBe(200);

  await page.reload();
  await expect(stageOf(page, "Rebecca Lindqvist")).toHaveText(/Waiting/, { timeout: 10_000 });
});

test("the three-page form drives the stage and fans out into the record", async ({ page }) => {
  await become(page, "practitioner");
  await page.goto("/dashboard");
  // Start from the bell's nudge for Freya: it opens the form directly.
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await page.getByText("Freya Sundqvist is waiting").first().click();
  await page.waitForURL(/\/patients\/[^/]+\?treat=/);
  const form = page.locator('[data-qc="treatment-form"]');
  await expect(form).toBeVisible();
  await expect(form.locator('[data-qc="form-stage"]')).toHaveText("Waiting");

  // Page 1: consent shows as signed; every question must be answered. Yes is a contraindication and needs a note.
  await expect(form.getByText(/Signed by Freya Sundqvist/)).toBeVisible();
  await expect(form.locator('[data-qc="start-treatment-btn"]')).toBeDisabled();
  await expect(form.getByRole("heading", { name: "Confirm before starting" })).toBeVisible();
  const checks = ["changes_since_last", "anything_today", "reason_to_wait"];
  for (const key of checks) {
    const answer = key === "changes_since_last" ? 0 : 1;
    await form.locator(`[data-qc="pre-check-${key}"] [role=radio]`).nth(answer).click();
  }
  await expect(form.locator('[data-qc="start-treatment-btn"]')).toBeDisabled();
  await form.getByLabel(/Note for Any change in health/).fill("Started a new blood thinner since the last visit. Bruising risk discussed.");
  await form.locator('[data-qc="start-treatment-btn"]').click();
  await expect(page.getByText(/Treatment started/)).toBeVisible();
  await expect(form.locator('[data-qc="form-stage"]')).toHaveText("In treatment");

  // Page 2: results, both notes, then aftercare.
  await form.locator('[data-qc="tf-area"]').fill("Full face");
  await form.locator('[data-qc="tf-product"]').fill("Glycolic 20%, lot GP-2201");
  await form.locator('[data-qc="tf-strength"]').fill("20%");
  await form.locator('[data-qc="tf-time_applied"]').fill("3 minutes");
  await form.locator('[data-qc="form-page2"] textarea').first().fill("Two passes of 20% glycolic. Endpoint reached at 3 minutes, neutralised. Peel #2 done. Strict SPF, no actives for five days. Next sitting in four weeks.");
  await form.locator('[data-qc="move-to-aftercare-btn"]').click();
  await expect(page.getByText(/Moved to aftercare/)).toBeVisible();
  await expect(form.locator('[data-qc="form-stage"]')).toHaveText("Aftercare");

  // Page 3: the catalogue's own Chemical Peel points, ticked, plus a custom line.
  await expect(form.getByText(/Do not pick or peel flaking skin/)).toBeVisible();
  const points = form.locator('[data-qc="aftercare-point"]');
  const n = await points.count();
  for (let i = 0; i < n; i++) await points.nth(i).click();
  await form.locator('[data-qc="aftercare-custom"]').fill("Book the four-week sitting before leaving.");
  await form.getByRole("button", { name: "Add" }).click();
  await form.locator('[data-qc="complete-treatment-btn"]').click();
  await expect(form.locator('[data-qc="form-done"]')).toBeVisible();

  // The record viewer shows all three pages.
  await form.locator('[data-qc="view-record"]').click();
  const record = page.locator('[data-qc="treatment-record-body"]');
  await expect(record).toBeVisible();
  await expect(record).toContainText("Glycolic 20%, lot GP-2201");
  await expect(record).toContainText("Peel #2 done");
  await expect(record).toContainText("Book the four-week sitting before leaving.");
  await expect(record.getByText(/^Signed/)).toBeVisible();
  await page.keyboard.press("Escape");

  // Fan-out on the record page.
  await expect(page.locator('[data-qc="today-visit"]')).toHaveCount(0);
  const historyRow = page.locator("main li", { hasText: "Chemical Peel" }).first();
  await expect(historyRow).toContainText("Full face");
  await expect(historyRow.locator('[data-qc="view-treatment-record"]')).toBeVisible();
  await page.getByRole("tab", { name: "Visit notes" }).click();
  await expect(page.getByText(/Peel #2 done/).first()).toBeVisible();
  await page.getByRole("tab", { name: "Documents" }).click();
  await expect(page.locator('[data-qc="treatment-records"]')).toContainText("Chemical Peel — treatment record");

  // And the diary card reads Complete.
  await page.goto("/dashboard");
  await expect(stageOf(page, "Freya Sundqvist")).toHaveText(/Complete/);
  await expect(page.locator('[data-qc="dock-card-waiting"]', { hasText: "Freya" })).toHaveCount(0);
});

test("a completed session lands on the patient's timeline and the journey card", async ({ page }) => {
  // Olivia is waiting (signed in clinic above). Run her session quickly.
  await become(page, "practitioner");
  await page.goto("/patients?q=Bennett");
  await page.getByRole("link", { name: /Bennett, .*Olivia/ }).click();
  await page.locator('[data-qc="open-treatment-form"]').click();
  const form = page.locator('[data-qc="treatment-form"]');
  await expect(form).toBeVisible();
  await expect(form.getByText(/witnessed in clinic/)).toBeVisible();
  for (const key of ["changes_since_last", "anything_today", "reason_to_wait"]) {
    await form.locator(`[data-qc="pre-check-${key}"] [role=radio]`).nth(1).click();
  }
  await form.locator('[data-qc="start-treatment-btn"]').click();
  await expect(form.locator('[data-qc="form-stage"]')).toHaveText("In treatment");
  await form.locator('[data-qc="tf-area"]').fill("Glabella and frontalis");
  await form.locator('[data-qc="form-page2"] textarea').nth(1).fill("Session three delivered. Review at two weeks.");
  await form.locator('[data-qc="move-to-aftercare-btn"]').click();
  await expect(form.locator('[data-qc="form-stage"]')).toHaveText("Aftercare");
  await form.locator('[data-qc="complete-treatment-btn"]').click();
  await expect(form.locator('[data-qc="form-done"]')).toBeVisible();
  await page.keyboard.press("Escape");

  // The plan step this visit fulfilled is done on the journey card.
  await page.goto("/dashboard");
  const journey = page.locator('[data-qc^="journey-"]', { hasText: "Olivia Bennett" }).first();
  await journey.scrollIntoViewIfNeeded();
  await expect(journey).toContainText("Olivia Bennett");

  // Her portal timeline shows the completed session card from the form.
  await become(page, "patient");
  await page.goto("/my-record/plan/timeline");
  const doneRows = page.locator('[data-qc="step-row"][data-step-status="done"]', { hasText: /Treatment session 3/ });
  await expect(doneRows).toHaveCount(1);
  await doneRows.first().click();
  const details = page.locator('[data-qc="step-details"]');
  await expect(details.getByRole("heading", { name: "Treatment details" })).toBeVisible();
  await expect(details.locator('[data-qc="step-pills"]')).toContainText("Consent");
  await expect(details.locator('[data-qc="step-visit-note"]')).toContainText("Session three delivered");
});
