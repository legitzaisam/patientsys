import { expect, test } from "../fixtures";

/**
 * Every patient portal page renders the sections the V4 wireframes specify,
 * from real demo data, with no console or page errors.
 */

test.use({ role: "patient" });

/** Fails the test if the page logged an error while we were on it. */
function watchErrors(page: import("@playwright/test").Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (text.includes("favicon") || text.includes("React DevTools")) return;
    errors.push(`console: ${text}`);
  });
  return errors;
}

test("home shows the greeting, four tiles, news, offer, appointment and quick actions", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/my-record");

  await expect(page.getByRole("heading", { level: 1, name: /Good (morning|afternoon|evening), Olivia/ })).toBeVisible();
  await expect(page.getByText("A simple view of your skin journey, clinic updates and what's next.")).toBeVisible();

  await expect(page.getByText("Current skin plan")).toBeVisible();
  await expect(page.getByText("Plan completion")).toBeVisible();
  await expect(page.getByText("Next appointment", { exact: true })).toBeVisible();
  await expect(page.getByText("Your clinician", { exact: true })).toBeVisible();

  await expect(page.getByRole("heading", { name: "Clinic news" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Special offers" })).toBeVisible();
  // The appointment card presents itself as "your next appointment" only once
  // confirmed; the seeded booking starts unconfirmed.
  await expect(page.getByRole("heading", { name: /Please confirm your appointment|Your next appointment/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Quick actions" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your plan progress" })).toBeVisible();
  // Completed steps in the progress track carry green ticks under their labels.
  expect(await page.locator('[data-qc="step-tick"]').count()).toBeGreaterThan(0);
  await expect(page.getByRole("heading", { name: "Latest message from your clinic" })).toBeVisible();
  // The encouragement banner was removed.
  await expect(page.getByText("You're doing great")).toHaveCount(0);

  expect(errors).toEqual([]);
});

test("plan overview shows the KPI strip and all six cards", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/my-record/plan");

  await expect(page.locator('[data-qc="portal-plan-overview"]')).toBeVisible();
  await expect(page.getByText("Plan completion")).toBeVisible();
  await expect(page.getByText("Current phase")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Today / Next action" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recovery Check-in" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Before & After Progress" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your Journey Snapshot" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Safe to Proceed?" })).toBeVisible();

  // Three month columns in the snapshot.
  await expect(page.getByText("Month 1", { exact: true })).toBeVisible();
  await expect(page.getByText("Month 3", { exact: true })).toBeVisible();

  expect(errors).toEqual([]);
});

test("timeline shows the roadmap, month groups and the step details panel", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/my-record/plan/timeline");

  await expect(page.getByRole("heading", { name: "Your plan roadmap" })).toBeVisible();
  await expect(page.getByText(/milestones completed/)).toBeVisible();

  const months = page.locator('[data-qc="month-toggle"]');
  expect(await months.count()).toBeGreaterThan(0);

  const steps = page.locator('[data-qc="step-row"]');
  expect(await steps.count()).toBeGreaterThan(0);

  // The current step opens the details panel by default.
  await expect(page.getByRole("heading", { name: "Step details" })).toBeVisible();
  await expect(page.getByText("Due date")).toBeVisible();
  await expect(page.getByText("Your checklist")).toBeVisible();
  await expect(
    page.getByText("This step is managed by your clinic. Dates, requirements and progression cannot be edited by patients."),
  ).toBeVisible();

  expect(errors).toEqual([]);
});

test("journal shows filters, entries and the calendar", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/my-record/plan/journal");

  await expect(page.getByRole("heading", { level: 1, name: "Your Journal" })).toBeVisible();
  // A single Tags button replaces the chip row; the menu lists every tag.
  await expect(page.locator('[data-qc="journal-tags"]')).toBeVisible();
  await page.locator('[data-qc="journal-tags"]').click();
  expect(await page.getByRole("menuitem").count()).toBe(7);
  await page.keyboard.press("Escape");
  await expect(page.getByPlaceholder("Search journal...")).toBeVisible();
  await expect(page.getByRole("button", { name: /New entry/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Share your journal" })).toBeVisible();

  // Seeded entries from the demo fixtures.
  await expect(page.getByText("Skincare product change")).toBeVisible();
  await expect(page.getByText("Noticed some dryness")).toBeVisible();

  expect(errors).toEqual([]);
});

test("routine shows the practitioner banner, both routines and adherence", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/my-record/plan/routine");

  await expect(page.getByText("Your Practitioner recommends this skincare routine for you")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Morning routine" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evening routine" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Routine adherence" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming reminder" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Skin response" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Practitioner note" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Product guide" })).toBeVisible();

  // The prescribed products come from the clinic-authored routine.
  await expect(page.getByText("Aetheria Gentle Cleanser").first()).toBeVisible();
  await expect(page.getByText("Aetheria Retinol+ Serum")).toBeVisible();

  expect(errors).toEqual([]);
});

test("my clinic shows the clinician, clinic details and both treatment lists", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/my-record/clinic");

  await expect(page.getByRole("heading", { level: 1, name: "My Clinic" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your clinician" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clinic details" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming treatments" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Completed treatments" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Treatment history (other clinics)" })).toBeVisible();

  // Seeded external history.
  await expect(page.getByText("Lip Filler")).toBeVisible();
  await expect(page.getByText("SkinLab, London")).toBeVisible();

  expect(errors).toEqual([]);
});

test("records shows personal, emergency, medical, labs, documents and the archive", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/my-record/records");

  await expect(page.getByRole("heading", { level: 1, name: "My Profile / Records" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Personal details" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Emergency contact" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Medical history" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Treatment history" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Results & Labs" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clinic documents" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Before & After Archive" })).toBeVisible();

  // Folded in from the old single-page portal.
  await expect(page.getByRole("heading", { name: "Update your health information" })).toBeVisible();

  // An emergency contact is on file. The name itself is asserted in the
  // controls spec, which edits it, so this checks the untouched relationship.
  await expect(page.getByText("Partner", { exact: true })).toBeVisible();

  expect(errors).toEqual([]);
});

test("secondary pages render their own content", async ({ page }) => {
  const errors = watchErrors(page);

  await page.goto("/my-record/appointments");
  await expect(page.getByRole("heading", { level: 1, name: "Appointments" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming" })).toBeVisible();

  await page.goto("/my-record/billing");
  await expect(page.getByRole("heading", { level: 1, name: "Billing" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Treatments billed" })).toBeVisible();

  // Contact preferences and the delivery log were folded in here.
  await page.goto("/my-record/settings");
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "How we contact you" })).toBeVisible();

  // The product shelf was folded in here.
  await page.goto("/my-record/resources");
  await expect(page.getByRole("heading", { level: 1, name: "Resources" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clinic news" })).toBeVisible();

  expect(errors).toEqual([]);
});
