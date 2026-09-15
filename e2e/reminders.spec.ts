import { expect, localDateTime, test } from "./fixtures";

/**
 * Scheduled appointment reminders: booking queues rows with a future
 * scheduled_for; moving the appointment cancels them and queues fresh ones.
 */

test.use({ role: "owner" });

test("booking ahead queues reminders and a reschedule supersedes them", async ({ page }) => {
  // Book Olivia 35 days out at 14:00. The demo fixtures only book up to 30
  // days ahead, so the slot is free by construction, and both reminder
  // offsets (168h and 24h) are in the future — email + SMS each, 4 rows.
  await page.goto("/schedule");
  await page.getByRole("button", { name: "New booking" }).click();
  const dialog = page.getByRole("dialog", { name: "New booking" });
  await dialog.locator('select[name="patient_id"]').selectOption({ label: "Olivia Bennett" });
  await dialog.locator('select[name="practitioner_id"]').selectOption({ index: 1 });
  await dialog.locator('select[name="catalogue_id"]').selectOption({ index: 1 });
  await dialog.getByLabel("Date & time").fill(localDateTime(35, 14, 0));
  await dialog.getByRole("button", { name: "Book appointment" }).click();
  await expect(page.getByText("Appointment booked")).toBeVisible();

  // The reminder rows are visible on her record, queued for later.
  await page.goto("/patients");
  await page.getByRole("link", { name: /Bennett, .*Olivia/ }).click();
  // "· appointment reminder ·" is the template tag in the row description,
  // which the seeded fixture reminder does not carry.
  const queuedReminders = page
    .locator("li", { hasText: "· appointment reminder ·" })
    .filter({ has: page.getByText("queued", { exact: true }) });
  await expect(queuedReminders).toHaveCount(4);

  // Move the appointment 15 minutes via the week diary's time chip.
  await page.goto("/schedule");
  await page.getByRole("button", { name: "week" }).click();
  for (let i = 0; i < 5; i += 1) {
    await page.getByRole("button", { name: "Next" }).click();
  }
  const timeChip = page.getByRole("button", { name: "14:00", exact: true }).first();
  await timeChip.hover();
  await page.getByRole("button", { name: "+15 min" }).click();
  await expect(page.getByText("Appointment time updated")).toBeVisible();

  // The old reminders are cancelled — still in the trail — and new ones queued.
  await page.goto("/patients");
  await page.getByRole("link", { name: /Bennett, .*Olivia/ }).click();
  await expect(
    page
      .locator("li", { hasText: "· appointment reminder ·" })
      .filter({ has: page.getByText("cancelled", { exact: true }) }),
  ).toHaveCount(4);
  await expect(
    page
      .locator("li", { hasText: "· appointment reminder ·" })
      .filter({ has: page.getByText("queued", { exact: true }) }),
  ).toHaveCount(4);

  // The reschedule notice itself went out as a transactional send.
  await expect(
    page.locator("li", { hasText: "Your appointment has been rescheduled" }).first(),
  ).toBeVisible();
});
