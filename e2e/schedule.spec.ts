import { expect, test } from "./fixtures";

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
    // Tomorrow relative to the pinned demo clock (Mon 1 Jun 2026).
    await dialog.getByLabel("Date & time").fill("2026-06-02T14:00");

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

test.describe("as front desk", () => {
  test.use({ role: "front_desk" });

  test("can open the booking dialog (appointments.edit is granted)", async ({ page }) => {
    await page.goto("/schedule");
    await page.getByRole("button", { name: "New booking" }).click();
    await expect(page.getByRole("dialog", { name: "New booking" })).toBeVisible();
  });
});
