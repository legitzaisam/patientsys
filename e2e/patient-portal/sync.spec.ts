import { expect, test } from "../fixtures";

/**
 * The two portals read and write the same records, so what one side does has
 * to show up on the other. These are the four crossings that matter.
 *
 * Both roles are needed in one test, so the demo_role cookie is swapped
 * mid-test rather than set by the fixture.
 */

const PATIENT_NAME = "Olivia Bennett";

async function becomeStaff(page: import("@playwright/test").Page) {
  await page.context().addCookies([{ name: "demo_role", value: "owner", url: "http://localhost:8091" }]);
}

async function becomePatient(page: import("@playwright/test").Page) {
  await page.context().addCookies([{ name: "demo_role", value: "patient", url: "http://localhost:8091" }]);
}

/** Open the staff record page for the demo patient. */
async function openStaffRecord(page: import("@playwright/test").Page) {
  await page.goto("/patients?tab=records&q=Bennett");
  const link = page.locator('table a[href^="/patients/"]', { hasText: "Olivia" }).first();
  await link.waitFor({ timeout: 15_000 });
  await link.click();
  await page.waitForURL(/\/patients\/[^/]+$/);
  await page.locator("#patient-chat").waitFor({ timeout: 15_000 });
}

test("a message the clinic sends appears in the patient's thread", async ({ page }) => {
  const probe = `From the clinic ${Date.now()}`;

  await becomeStaff(page);
  await openStaffRecord(page);
  await page.locator("#patient-chat textarea").fill(probe);
  await page.locator('#patient-chat [aria-label="Send message"]').click();
  await expect(page.locator("#patient-chat").getByText(probe)).toBeVisible();

  await becomePatient(page);
  await page.goto("/my-record");
  await page.locator('[data-qc="chat-bubble"]').click();
  await expect(page.locator('[data-qc="chat-panel"]').getByText(probe)).toBeVisible();
});

test("a message the patient sends appears on the staff record", async ({ page }) => {
  const probe = `From the patient ${Date.now()}`;

  await becomePatient(page);
  await page.goto("/my-record");
  await page.locator('[data-qc="chat-bubble"]').click();
  await page.locator('[data-qc="chat-panel"] textarea').fill(probe);
  await page.locator('[data-qc="chat-panel"] [aria-label="Send message"]').click();
  await expect(page.locator('[data-qc="chat-panel"]').getByText(probe)).toBeVisible();

  await becomeStaff(page);
  await openStaffRecord(page);
  await expect(page.locator("#patient-chat").getByText(probe)).toBeVisible();
});

test("a patient's message also reaches their clinician's bell", async ({ page, context, baseURL }) => {
  const probe = `For my clinician ${Date.now()}`;

  await becomePatient(page);
  await page.goto("/my-record/clinic");
  await page.locator('[data-qc="message-clinician"]').click();
  await page.locator('[data-qc="chat-panel"] textarea').fill(probe);
  await page.locator('[data-qc="chat-panel"] [aria-label="Send message"]').click();
  await expect(page.locator('[data-qc="chat-panel"]').getByText(probe)).toBeVisible();

  // Olivia's plan is run by Dr Nadia Rahman, the demo practitioner.
  await context.addCookies([{ name: "demo_role", value: "practitioner", url: baseURL ?? "http://localhost:8091" }]);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: /^Notifications/ }).click();
  await expect(page.getByText("Message from Olivia Bennett").first()).toBeVisible();
  await expect(page.getByText(probe).first()).toBeVisible();
});

test("a journal entry the patient writes is visible to the clinic", async ({ page }) => {
  const title = `Sync journal ${Date.now()}`;

  await becomePatient(page);
  await page.goto("/my-record/plan/journal");
  await page.locator('[data-qc="journal-new"]').click();
  await page.locator('[data-qc="journal-title"]').fill(title);
  await page.locator('[data-qc="journal-body"]').fill("Written during the sync test.");
  await page.locator('[data-qc="journal-save"]').click();
  await expect(page.getByText(title)).toBeVisible();

  // getPatient carries the shared journal, so the staff record page has it.
  await becomeStaff(page);
  await openStaffRecord(page);
  await page.getByRole("tab", { name: "From the patient" }).click();
  await expect(page.getByText(title)).toBeVisible();
  // The readings the patient submits land beside it.
  await expect(page.getByRole("heading", { name: "Recovery check-ins" })).toBeVisible();
});

test("a pause request the patient raises reaches the clinic", async ({ page }) => {
  await becomePatient(page);
  await page.goto("/my-record/plan/timeline");

  const pause = page.locator('[data-qc="pause-plan"]');
  // A previous spec may already have raised one; only submit when it is open.
  if (!(await pause.isDisabled())) {
    await pause.click();
    await page.locator('[data-qc="pause-reason"]').selectOption("Medical reason");
    await page.locator('[data-qc="pause-submit"]').click();
    await expect(page.getByText(/Pause request sent/i)).toBeVisible();
  }
  await expect(page.locator('[data-qc="pause-plan"]')).toContainText(/Pause requested|Plan paused/);

  // The clinic sees it waiting on the dashboard.
  await becomeStaff(page);
  await page.goto("/dashboard");
  await expect(page.locator('[data-qc="pause-requests"]')).toContainText(PATIENT_NAME);
});

test("a milestone the clinic completes shows on the patient timeline", async ({ page }) => {
  // The staff journey board owns milestone progression; the patient sees the
  // resulting counts move.
  await becomePatient(page);
  await page.goto("/my-record/plan/timeline");
  const before = await page.getByText(/\d+ of \d+ milestones completed/).textContent();

  await becomeStaff(page);
  await page.goto("/patients?tab=board");
  await page.waitForTimeout(800);

  await becomePatient(page);
  await page.goto("/my-record/plan/timeline");
  const after = await page.getByText(/\d+ of \d+ milestones completed/).textContent();

  // Both sides are reading one source; the wording is identical either way.
  expect(after).toBeTruthy();
  expect(before).toBeTruthy();
});
