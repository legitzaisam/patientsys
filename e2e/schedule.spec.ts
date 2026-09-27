import { expect, localDateTime, test } from "./fixtures";

/**
 * The diary: booking through the dialog is the highest-traffic write in the
 * app, and the flow Phase 9 wires to real confirmations.
 */

test.describe("booking", () => {
  test.use({ role: "owner" });

  test("books an appointment for an existing patient", async ({ page }) => {
    await page.goto("/schedule");
    await expect(page.getByRole("heading", { level: 1, name: "Clinic diary" })).toBeVisible();

    await page.getByRole("button", { name: "New booking" }).click();
    const dialog = page.getByRole("dialog", { name: "New booking" });
    await expect(dialog).toBeVisible();

    await dialog.locator('select[name="patient_id"]').selectOption({ label: "Olivia Bennett" });
    await dialog.locator('select[name="practitioner_id"]').selectOption({ index: 1 });
    await dialog.locator('select[name="catalogue_id"]').selectOption({ index: 1 });
    // Three days out at 20:15 — a slot no fixture appointment occupies.
    await dialog.getByLabel("Date & time").fill(localDateTime(3, 20, 15));

    await dialog.getByRole("button", { name: "Book appointment" }).click();

    await expect(page.getByText("Appointment booked")).toBeVisible();
    await expect(dialog).toBeHidden();
  });

  test("the diary grid offers per-slot booking for practitioners' columns", async ({ page }) => {
    await page.goto("/schedule");
    // Slot buttons carry "Add appointment at <time> with <practitioner>" labels.
    await expect(page.getByRole("button", { name: /^Add appointment at/ }).first()).toBeAttached();
  });
});

test.describe("needs action", () => {
  test.use({ role: "owner" });

  test("one control highlights what is outstanding and the menu narrows it by type", async ({
    page,
  }) => {
    await page.goto("/schedule");
    await page.locator('[data-qc="day-planner-scroll"]').waitFor();

    const control = page.locator('[data-qc="needs-action"]');
    const allClear = page.locator('[data-qc="needs-action-all-clear"]');
    // The fixture day always has something outstanding; guard so the spec
    // reads clearly if that ever changes.
    if (await allClear.isVisible()) {
      await expect(control).toHaveCount(0);
      return;
    }

    const total = Number(await page.locator('[data-qc="needs-action-count"]').textContent());
    expect(total).toBeGreaterThan(0);
    await expect(page.locator('[data-qc="needs-action-hint"]')).toContainText("need something");

    // Main button: everything outstanding rings, the rest fade but stay in place.
    await page.locator('[data-qc="needs-action-main"]').click();
    await expect(control).toHaveAttribute("data-state", "on");
    await expect(page.locator('[data-needs-action="match"]')).toHaveCount(total);
    expect(await page.locator('[data-needs-action="faded"]').count()).toBeGreaterThan(0);
    await expect(page.locator('[data-qc="needs-action-tags"]').first()).toBeVisible();
    await expect(page.locator('[data-qc="needs-action-hint"]')).toContainText(
      "faded but still in place",
    );

    // The caret menu lists each type with its count and the dashboard pointer.
    await page.locator('[data-qc="needs-action-caret"]').click();
    const menu = page.locator('[data-qc="needs-action-menu"]');
    await expect(menu).toBeVisible();
    await expect(menu.locator('[data-qc="needs-action-item-any"]')).toContainText(
      "Everything outstanding",
    );
    await expect(menu.locator('[data-qc="needs-action-item-any"]')).toContainText(String(total));
    for (const key of [
      "unpaid",
      "deposit_due",
      "consent_due",
      "running_late",
      "details_incomplete",
    ]) {
      await expect(menu.locator(`[data-qc="needs-action-item-${key}"]`)).toBeVisible();
    }
    await expect(menu.getByText("To chase these, open")).toBeVisible();

    // Picking a type narrows the highlight to that count and renames the pill.
    const consent = menu.locator('[data-qc="needs-action-item-consent_due"]');
    const consentCount = Number((await consent.locator("span").nth(2).textContent()) ?? "0");
    if (consentCount > 0) {
      await consent.click();
      await expect(page.locator('[data-qc="needs-action-main"]')).toContainText("Consent due");
      await expect(page.locator('[data-needs-action="match"]')).toHaveCount(consentCount);
    } else {
      await page.keyboard.press("Escape");
    }

    // Clear puts everything back.
    await page.locator('[data-qc="needs-action-clear"]').click();
    await expect(control).toHaveAttribute("data-state", "off");
    await expect(page.locator("[data-needs-action]")).toHaveCount(0);

    // The colour key names every treatment in view.
    await expect(page.locator('[data-qc="colour-key"]')).toContainText("Colours");
  });

  test("the week view carries the same control and the month view only counts", async ({
    page,
  }) => {
    await page.goto("/schedule");
    await page.getByRole("button", { name: /^week$/i }).click();
    await expect(page.getByText("Week planner")).toBeVisible();
    const control = page.locator('[data-qc="needs-action"], [data-qc="needs-action-all-clear"]');
    await expect(control.first()).toBeVisible();

    await page.getByRole("button", { name: /^month$/i }).click();
    await expect(page.getByText("Month planner")).toBeVisible();
    await expect(page.locator('[data-qc="needs-action"]')).toHaveCount(0);
    // The month's bookings load after the switch; the rose count badge follows.
    await expect(page.locator('[data-qc="month-needs-action-count"]').first()).toBeVisible();
  });
});

test.describe("as a practitioner", () => {
  test.use({ role: "practitioner" });

  test("the diary opens on their own column with All practitioners a click away", async ({
    page,
  }) => {
    await page.goto("/schedule");
    await page.locator('[data-qc="day-planner-scroll"], .page-title').first().waitFor();
    // The View by pill names them rather than "All practitioners".
    await expect(page.getByText("All practitioners")).toHaveCount(0);
    await expect(page.getByText("Dr Nadia Rahman").first()).toBeVisible();
  });
});

test.describe("as front desk", () => {
  test.use({ role: "front_desk" });

  test("can open the booking dialog (appointments.edit is granted)", async ({ page }) => {
    await page.goto("/schedule");
    await page.getByRole("button", { name: "New booking" }).click();
    await expect(page.getByRole("dialog", { name: "New booking" })).toBeVisible();
  });
});
