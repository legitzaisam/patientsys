import { expect, test } from "./fixtures";

/**
 * Retention: the at-risk table and the recall dialog (whose email/sms
 * channels Phase 9c moves onto the outbox). Handing a recall to the team
 * creates tasks; those live on the Tasks page, not here.
 */

test.use({ role: "owner" });

test("retention page renders the at-risk table; task lists live on the Tasks page", async ({
  page,
}) => {
  await page.goto("/retention");
  await expect(page.getByRole("heading", { level: 1, name: "Retention" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send recall" }).first()).toBeVisible();
  await expect(page.locator('[data-qc="task-row"], [data-qc="recall-tasks"]')).toHaveCount(0);
});

test("sends a portal recall message from the dialog", async ({ page }) => {
  await page.goto("/retention");
  await page.getByRole("button", { name: "Send recall" }).first().click();

  const dialog = page.getByRole("dialog", { name: /Send recall to / });
  await expect(dialog).toBeVisible();

  // Default channel is the in-app portal message; the body is prefilled.
  await dialog.getByRole("button", { name: "Send recall" }).click();
  await expect(page.getByText("Recall message sent")).toBeVisible();
});

test("a recall email respects the patient's marketing opt-out", async ({ page }) => {
  await page.goto("/retention");
  await page.getByRole("button", { name: "Send recall" }).first().click();

  const dialog = page.getByRole("dialog", { name: /Send recall to / });
  await dialog.getByRole("tab", { name: "Email" }).click();
  // Recall promotes a repeat treatment, so it is a marketing send under PECR.
  // Every fixture patient is opted out, so the outbox must refuse — no more
  // mailto: side door around the patient's preferences.
  await dialog.getByRole("button", { name: "Send email" }).click();
  await expect(page.getByText("has not opted in to marketing messages")).toBeVisible();
});

test("the at-risk table pins the patient column, drops practitioner, and the dialog can hand the recall to the team", async ({
  page,
}) => {
  await page.goto("/retention");
  await expect(page.getByRole("button", { name: "Sort by Practitioner" })).toHaveCount(0);
  const patientHeader = page.getByRole("button", { name: "Sort by Patient" });
  await expect(patientHeader).toBeVisible();
  const sticky = await patientHeader.evaluate((el) => getComputedStyle(el.closest("th")!).position);
  expect(sticky).toBe("sticky");

  await page.getByRole("button", { name: "Send recall" }).first().click();
  const dialog = page.getByRole("dialog", { name: /Send recall to / });
  await expect(dialog.locator('[data-qc="recall-assign-section"]')).toContainText(
    "hand it to the team",
  );
  const patientName = (await dialog.getByRole("heading").first().innerText())
    .replace(/^Send recall to /, "")
    .trim();
  await dialog.locator('[data-qc="recall-assign-to"]').click();
  await expect(page.getByText("Ask the team to recall")).toBeVisible();
  const card = page.getByText("Ask the team to recall").locator("..").locator("..");
  await card.getByRole("checkbox").first().click();
  await card.getByRole("button", { name: "Send recall task" }).click();
  await expect(page.getByText("Recall task assigned to the team")).toBeVisible();

  // The hand-off is a recall task on the Tasks page, marked as assigned by the sender.
  await page.goto("/tasks?view=team&types=recall");
  const row = page.locator('[data-qc="task-row"][data-type="recall"]', {
    hasText: patientName.split(" ")[0]!,
  });
  // Ten a page: walk the pages until the row turns up.
  await expect(page.locator('[data-qc="task-row"]').first()).toBeVisible();
  for (let guard = 0; guard < 10 && (await row.count()) === 0; guard++) {
    const next = page.locator('[data-qc="tasks-pagination"]').getByRole("button", {
      name: /next page/i,
    });
    if ((await next.count()) === 0 || (await next.isDisabled())) break;
    await next.click();
    await expect(page.locator('[data-qc="task-row"]').first()).toBeVisible();
  }
  await expect(row.first()).toBeVisible();
  await expect(row.first()).toHaveAttribute("data-source", "manual");
  await expect(row.first().locator('[data-qc="task-patient-type"]')).toBeVisible();
});

test("cohorts read Too early for this month and 'so far' while young; the trend axis is in %", async ({
  page,
}) => {
  await page.goto("/retention");
  await expect(page.locator('[data-qc="cohort-too-early"]').first()).toBeVisible();
  // Young cohorts say the rate is provisional; matured ones read as final.
  expect(await page.locator('[data-qc="cohort-so-far"]').count()).toBeGreaterThan(0);
  await expect(page.locator('[data-qc="cohort-so-far"]').first()).toContainText("so far");
  await expect(page.locator("#retention-trend").getByText("100%")).toBeVisible();
});
