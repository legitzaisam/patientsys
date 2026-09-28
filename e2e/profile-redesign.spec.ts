import { expect, test, type Page } from "./fixtures";

/**
 * The redesigned staff profile: one layout for yourself (Me), the same layout
 * for the management tier viewing a colleague, and the Front desk layout for
 * everyone else. Runs on the demo server (in-memory fixture, real clock), so
 * every date is computed rather than hard-coded.
 */

const NADIA = "10000000-0000-4000-8000-000000000002";
const TOM = "10000000-0000-4000-8000-000000000003";

const pad = (n: number) => String(n).padStart(2, "0");
function dayKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** The Monday of the week after next, as YYYY-MM-DD — always a working day for Nadia. */
function upcomingMonday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14 - ((d.getDay() + 6) % 7));
  return dayKey(d);
}
function daysAfter(key: string, n: number): string {
  const d = new Date(`${key}T12:00:00`);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

async function openTab(page: Page, key: string) {
  await page.locator(`[data-qc="profile-tab-${key}"]`).click();
  await expect(page).toHaveURL(new RegExp(`tab=${key}`));
}

test.describe("practitioner on their own profile", () => {
  test.use({ role: "practitioner" });

  test("hero, tabs and the Overview cards", async ({ page }) => {
    await page.goto("/profile");
    await expect(page.locator('[data-qc="profile-page-self"]')).toBeVisible();
    await expect(page.locator('[data-qc="profile-name"]')).toHaveText("Dr Nadia Rahman");
    await expect(page.locator('[data-qc="profile-meta"]')).toContainText("NMC 18C4471E");
    await expect(page.locator('[data-qc="profile-chip-registration"]')).toContainText(/NMC/);
    await expect(page.locator('[data-qc="profile-chip-insurance"]')).toContainText(/Insured to/);
    await expect(page.locator('[data-qc="profile-chip-documents"]')).toContainText(
      /documents? to upload/,
    );
    await expect(page.locator('[data-qc="hero-invoice"]')).toBeVisible();
    await expect(page.locator('[data-qc="hero-time-off"]')).toBeVisible();

    const tabs = page.locator('[data-qc^="profile-tab-"]');
    await expect(tabs).toHaveCount(5);
    await expect(page.locator('[data-qc="profile-tab-security"]')).toBeVisible();
    await expect(page.locator('[data-qc="profile-tab-access"]')).toHaveCount(0);

    await expect(page.locator('[data-qc="tile-commission"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="registration-block"]')).toContainText("NMC registration");
    await expect(page.locator('[data-qc="insurance-block"]')).toContainText("Cosmetic Insure");
    await expect(page.locator('[data-qc="metric:earnings.month.share"]')).toContainText("£");
    await expect(page.locator('[data-qc="week-day"]')).toHaveCount(4);
    await expect(page.locator('[data-qc="documents-count"]')).toContainText(/\d+ of 10/);
    await expect(page.locator('[data-qc="bookable-chip"]')).toHaveCount(5);
  });

  test("qualification chips add and remove, and the documents chip opens the tab", async ({
    page,
  }) => {
    await page.goto("/profile");
    const chips = page.locator('[data-qc="qualification-chip"]');
    await expect(chips.first()).toBeVisible();
    const before = await chips.count();
    await page.locator('[data-qc="qualification-input"]').fill("Level 4 Chemical Peels");
    await page.locator('[data-qc="qualification-add"]').click();
    await expect(chips).toHaveCount(before + 1);
    await expect(page.locator('[data-qc="qualifications-saved"]')).toHaveText("Saved");
    await chips.filter({ hasText: "Level 4 Chemical Peels" }).getByRole("button").click();
    await expect(chips).toHaveCount(before);

    await page.locator('[data-qc="profile-chip-documents"]').click();
    await expect(page).toHaveURL(/tab=documents/);
    await expect(page.locator('[data-qc="documents-headline"]')).toContainText(/required document/);
    await expect(page.locator('[data-qc="document-upload"]').first()).toBeVisible();
    await expect(page.locator('[data-qc="documents-add-other"]')).toBeVisible();
  });

  test("I've renewed sends the new expiry for approval", async ({ page }) => {
    await page.goto("/profile");
    await page.locator('[data-qc="registration-renewed"]').click();
    const next = new Date();
    next.setFullYear(next.getFullYear() + 1);
    await page.locator('[data-qc="registration-renew-form"] input[type="date"]').fill(dayKey(next));
    await page.locator('[data-qc="registration-renew-save"]').click();
    await expect(page.locator('[data-qc="registration-renew-sent"]')).toBeVisible();
  });

  test("earnings: month stepper, groupings, CSV and the invoice dialog", async ({ page }) => {
    await page.goto("/profile?tab=earnings");
    await expect(page.locator('[data-qc="earnings-month-note"]')).toContainText(
      "month in progress",
    );
    await expect(page.locator('[data-qc="metric:earnings.share"]')).toContainText("£");
    await expect(page.locator('[data-qc="metric:earnings.treatments"]')).not.toHaveText("0");
    await expect(page.locator('[data-qc="earnings-bar"]').first()).toBeVisible();
    await expect(page.locator('[data-qc="earnings-row"]').first()).toBeVisible();

    await page.locator('[data-qc="earnings-group-treatment"]').click();
    await expect(page.locator('[data-qc="earnings-table"] th').first()).toHaveText("Treatment");
    await page.locator('[data-qc="earnings-group-month"]').click();
    await expect(page.locator('[data-qc="earnings-table"] th').first()).toHaveText("Month");
    await expect(page.locator('[data-qc="earnings-row"]').first()).toBeVisible();

    await page.locator('[data-qc="earnings-prev-month"]').click();
    await expect(page.locator('[data-qc="earnings-month-note"]')).toContainText(
      /Invoice sent · paid/,
    );
    await expect(page.locator('[data-qc="earnings-next-month"]')).toBeEnabled();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator('[data-qc="earnings-export-csv"]').click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^earnings-\d{4}-\d{2}\.csv$/);

    await page.locator('[data-qc="earnings-invoice"]').click();
    const dialog = page.locator('[data-qc="invoice-dialog"]');
    await expect(dialog).toBeVisible();
    // Last month was already invoiced: download only.
    await expect(dialog.locator('[data-qc="invoice-note-sent"]')).toBeVisible();
    await expect(dialog.locator('[data-qc="invoice-schedule"]')).toHaveCount(0);
    // This month can be scheduled for the 1st.
    await dialog.locator('[data-qc^="invoice-period-"]').first().click();
    await expect(dialog.locator('[data-qc="invoice-note-progress"]')).toBeVisible();
    await expect(dialog.locator('[data-qc="invoice-number"]')).toHaveText(/^INV-NR-\d{4}-\d{2}$/);
    await dialog.locator('[data-qc="invoice-recipient-owner"]').click();
    await dialog.locator('[data-qc="invoice-schedule"]').click();
    await expect(dialog.locator('[data-qc="invoice-done"]')).toContainText("Scheduled for");
    await dialog.locator('[data-qc="invoice-done-close"]').click();
    await expect(dialog).toBeHidden();
  });

  test("schedule: request time off, see it pending, withdraw it", async ({ page }) => {
    await page.goto("/profile?tab=schedule");
    await expect(page.locator('[data-qc="pattern-row"]')).toHaveCount(7);
    await expect(page.locator('[data-qc="pattern-weekly-hours"]')).toContainText("39 hours");
    await expect(page.locator('[data-qc="bank-holiday"]')).toHaveCount(3);

    const pendingBefore = await page
      .locator('[data-qc="timeoff-row"][data-status="pending"]')
      .count();
    const monday = upcomingMonday();
    const wednesday = daysAfter(monday, 2);

    await page.locator('[data-qc="timeoff-request"]').click();
    const sheet = page.locator('[data-qc="timeoff-sheet"]');
    await expect(sheet).toBeVisible();
    // Step the picker to the month the Monday falls in.
    const monthName = new Date(`${monday}T12:00:00`).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
    for (let i = 0; i < 2; i++) {
      if ((await sheet.locator('[data-qc="timeoff-month"]').textContent())?.trim() === monthName)
        break;
      await sheet.locator('[data-qc="timeoff-next-month"]').click();
    }
    await sheet.locator(`[data-qc="timeoff-day-${monday}"]`).click();
    await expect(sheet.locator('[data-qc="timeoff-hint"]')).toHaveText("Now tap the last day");
    await sheet.locator(`[data-qc="timeoff-day-${wednesday}"]`).click();
    await expect(sheet.locator('[data-qc="timeoff-working-days"]')).toContainText(/working days/);
    await sheet.locator('[data-qc="timeoff-note"]').fill("Family trip.");
    await sheet.locator('[data-qc="timeoff-submit"]').click();
    await expect(sheet.locator('[data-qc="timeoff-done"]')).toContainText("Request sent");
    await sheet.locator('[data-qc="timeoff-done-close"]').click();

    const pending = page.locator('[data-qc="timeoff-row"][data-status="pending"]');
    await expect(pending).toHaveCount(pendingBefore + 1);
    const mine = pending.filter({ hasText: "Family trip." });
    await expect(mine).toHaveCount(1);
    await mine.locator('[data-qc="timeoff-withdraw"]').click();
    await expect(pending).toHaveCount(pendingBefore);
  });

  test("a colleague's page is the Front desk layout", async ({ page }) => {
    await page.goto(`/team/${TOM}`);
    await expect(page.locator('[data-qc="profile-page-frontdesk"]')).toBeVisible();
    await expect(page.locator('[data-qc="profile-name"]')).toHaveText("Dr Tom Whitfield");
    await expect(page.locator('[data-qc="frontdesk-book"]')).toHaveText("Book with Tom");
    await expect(page.locator('[data-qc^="profile-tab-"]')).toHaveCount(0);
    await expect(page.getByText(/Commission/)).toHaveCount(0);
  });
});

test.describe("owner on Nadia", () => {
  test("commission, pattern edit, bookable treatments and time-off approval", async ({ page }) => {
    await page.goto(`/team/${NADIA}`);
    await expect(page.locator('[data-qc="profile-page-manage"]')).toBeVisible();
    await expect(page.locator('[data-qc="tile-commission"]')).toContainText("45%");
    await expect(page.locator('[data-qc="tile-role"]')).toContainText("Practitioner");
    await expect(page.locator('[data-qc="profile-tab-access"]')).toBeVisible();
    await expect(page.locator('[data-qc="profile-tab-security"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="hero-time-off"]')).toHaveText("Add time off");

    // Bookable treatments are set here.
    await page.locator('[data-qc="bookable-edit"]').click();
    const editor = page.locator('[data-qc="bookable-editor"]');
    await expect(editor).toBeVisible();
    await editor.getByRole("checkbox").first().click();
    await page.locator('[data-qc="bookable-save"]').click();
    await expect(editor).toBeHidden();

    // Working pattern edits save in place.
    await openTab(page, "schedule");
    await page.locator('[data-qc="pattern-edit"]').click();
    await page.locator('[data-qc="pattern-toggle-1"]').click();
    await page.locator('[data-qc="pattern-start-1"]').fill("10:00");
    await page.locator('[data-qc="pattern-end-1"]').fill("14:00");
    await page.locator('[data-qc="pattern-save"]').click();
    await expect(page.locator('[data-qc="pattern-row"]').nth(1)).toContainText("10:00–14:00");

    // Pending requests are approved from the right column.
    const pending = page.locator('[data-qc="timeoff-row"][data-status="pending"]');
    const n = await pending.count();
    if (n > 0) {
      await pending.first().locator('[data-qc="timeoff-approve"]').click();
      await expect(pending).toHaveCount(n - 1);
    }
    await expect(
      page.locator('[data-qc="timeoff-row"][data-status="approved"]').first(),
    ).toBeVisible();

    // The earnings tab opens for the owner, without the invoice button.
    await openTab(page, "earnings");
    await expect(page.locator('[data-qc="metric:earnings.share"]')).toContainText("£");
    await expect(page.locator('[data-qc="earnings-invoice"]')).toHaveCount(0);
  });
});

test.describe("manager on Nadia", () => {
  test("Edit staff profiles on gives the Me layout; off gives the Front desk layout", async ({
    page,
    context,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8091";
    const grant = () => page.getByRole("switch", { name: "Edit staff profiles for Manager" });

    await context.addCookies([{ name: "demo_role", value: "manager", url: base }]);
    await page.goto(`/team/${NADIA}`);
    await expect(page.locator('[data-qc="profile-page-manage"]')).toBeVisible();
    await expect(page.locator('[data-qc="tile-commission"]')).toContainText("45%");

    await context.addCookies([{ name: "demo_role", value: "owner", url: base }]);
    await page.goto("/team");
    await expect(grant()).toHaveAttribute("aria-checked", "true");
    await grant().click();
    await expect(grant()).toHaveAttribute("aria-checked", "false");

    await context.addCookies([{ name: "demo_role", value: "manager", url: base }]);
    await page.goto(`/team/${NADIA}`);
    await expect(page.locator('[data-qc="profile-page-frontdesk"]')).toBeVisible();
    await expect(page.locator('[data-qc="tile-commission"]')).toHaveCount(0);

    await context.addCookies([{ name: "demo_role", value: "owner", url: base }]);
    await page.goto("/team");
    await grant().click();
    await expect(grant()).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("front desk on Nadia", () => {
  test.use({ role: "front_desk" });

  test("sees what can be booked and when, nothing private", async ({ page }) => {
    await page.goto(`/team/${NADIA}`);
    await expect(page.locator('[data-qc="profile-page-frontdesk"]')).toBeVisible();
    await expect(page.locator('[data-qc="frontdesk-prescriber"]')).toBeVisible();
    await expect(page.locator('[data-qc="frontdesk-compliance"]')).toBeVisible();
    await expect(page.locator('[data-qc="frontdesk-pattern"]')).toContainText("Thu 12–8");
    await expect(page.locator('[data-qc="frontdesk-unavailable"]').first()).toContainText(
      "Unavailable",
    );
    await expect(page.locator('[data-qc="bookable-chip"]').first()).toBeVisible();
    await expect(page.getByText("NMC 18C4471E")).toHaveCount(0);
    await expect(page.getByText("Cosmetic Insure")).toHaveCount(0);
    await expect(page.getByText(/Commission/)).toHaveCount(0);

    await page.locator('[data-qc="frontdesk-book"]').click();
    await expect(page.getByRole("dialog")).toContainText("Book with Nadia");
  });
});
