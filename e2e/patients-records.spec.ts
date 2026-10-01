import { expect, test } from "./fixtures";

/**
 * Patients › Records: the paged table, practitioner chips and views, the
 * drawer that follows the selected row, its action pills (Book, Assign task),
 * Select mode with the bulk offer, and the deep links the board and the
 * dashboard land on. The demo server is shared; the one write here (an
 * assigned task) is checked on the Tasks page and left for the owner.
 */

const NADIA = "10000000-0000-4000-8000-000000000002";

test.describe("owner", () => {
  test.use({ role: "owner" });

  test("25 a page, the page in the URL, the practitioner filter and a deep-linked view", async ({
    page,
  }) => {
    await page.goto("/patients");
    await expect(page.locator("table tbody tr")).toHaveCount(25);
    const bar = page.locator('[data-qc="patients-pagination"]');
    await expect(bar).toContainText("Showing 1–25 of");

    // Practitioner chips carry a count; picking one narrows the list and lands in the URL.
    const chip = page.locator('[data-qc^="records-prac-"]').first();
    const chipCount = Number((await chip.innerText()).replace(/\D/g, ""));
    expect(chipCount).toBeGreaterThan(0);
    await chip.click();
    await expect(page).toHaveURL(/prac=/);
    await expect(page.locator('[data-qc="records-summary"]')).toContainText(
      `${chipCount} patients`,
    );
    await page.locator('[data-qc="records-show-everyone"]').click();
    await expect(page).not.toHaveURL(/prac=/);

    // The dashboard's "Treatments due" link still narrows the list, shown as a removable token.
    await page.goto("/patients?view=due");
    await expect(page.locator('[data-qc="records-view-due"]')).toContainText("Treatments due");
    const states = await page
      .locator('[data-qc="next-treatment"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-state")));
    expect(states.every((s) => s === "overdue" || s === "due")).toBe(true);

    // Paging keeps the view and lands in the URL.
    await bar.getByRole("button", { name: /next page/i }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page).toHaveURL(/view=due/);
    await expect(bar).toContainText("Showing 26–");
  });

  test("column headers sort Patient A–Z / Z–A and Tasks most first", async ({ page }) => {
    await page.goto("/patients");
    const names = page.locator('[data-qc="records-name"]');
    const firstAsc = (await names.first().innerText()).trim();
    await page.locator('[data-qc="records-sort-patient"]').click();
    await expect(page).toHaveURL(/dir=desc/);
    const firstDesc = (await names.first().innerText()).trim();
    expect(firstDesc.localeCompare(firstAsc, "en-GB")).toBeGreaterThan(0);
    await page.locator('[data-qc="records-sort-tasks"]').click();
    await expect(page).toHaveURL(/sort=tasks/);
    const firstTasks = page.locator('[data-qc="records-row"]').first().locator('[data-qc="open-tasks-pill"]');
    await expect(firstTasks).toBeVisible();
    const count = Number((await firstTasks.innerText()).replace(/\D/g, ""));
    expect(count).toBeGreaterThan(0);
  });

  test("every row shows a patient type and a next-treatment state; the name opens the record", async ({
    page,
  }) => {
    await page.goto("/patients");
    const rows = page.locator('[data-qc="records-row"]');
    await expect(rows).toHaveCount(25);
    const types = await page
      .locator('[data-qc="records-type"]')
      .evaluateAll((els) => [...new Set(els.map((e) => e.textContent?.trim()))]);
    expect(types.length).toBeGreaterThan(1);
    for (const t of types)
      expect(t).toMatch(/^(Skin plan( · \d+\/\d+)?|Regular|New patient)( · Inactive)?$/);
    const nextStates = await page
      .locator('[data-qc="next-treatment"]')
      .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-state")))]);
    const kinds = [
      "booked",
      "due",
      "overdue",
      "later",
      "none",
      "quiet",
      "form_incomplete",
      "opened_link",
      "photos_uploaded",
      "replied",
      "urgent_question",
    ];
    for (const s of nextStates) expect(kinds).toContain(s);
    // No status column; the list is about what happens next.
    await expect(page.getByRole("columnheader", { name: /^Status$/ })).toHaveCount(0);

    const first = rows.first().locator('[data-qc="records-name"]');
    const [last, firstName] = (await first.innerText()).split(", ");
    await first.click();
    await expect(page).toHaveURL(/\/patients\/[0-9a-f-]+/);
    await expect(
      page.getByRole("heading", { level: 1, name: new RegExp(`${firstName} .*${last}`) }),
    ).toBeVisible();
  });

  test("clicking a row fills the drawer; its open tasks match the pill", async ({ page }) => {
    await page.goto("/patients");
    const rows = page.locator('[data-qc="records-row"]');
    await rows.nth(1).click();
    await expect(page).toHaveURL(/sel=/);
    const name = (await rows.nth(1).locator('[data-qc="records-name"]').innerText()).split(", ");
    await expect(page.locator('[data-qc="drawer-name"]')).toContainText(name[0]!);
    await expect(page.locator('[data-qc="drawer-suggestion"]')).toBeVisible();

    // A row with a Tasks pill: the drawer lists the same number of open tasks.
    const withPill = page.locator('[data-qc="records-row"]', {
      has: page.locator('[data-qc="open-tasks-pill"]'),
    });
    if ((await withPill.count()) > 0) {
      const pill = withPill.first().locator('[data-qc="open-tasks-pill"]');
      const n = Number((await pill.innerText()).replace(/\D/g, ""));
      await withPill.first().click();
      await expect(page.locator('[data-qc="drawer-task"]')).toHaveCount(n);
    }
  });

  test("a deep link to a patient on a later page lands on that page with the drawer open", async ({
    page,
  }) => {
    await page.goto("/patients?page=2");
    const row = page.locator('[data-qc="records-row"]').nth(3);
    const name = (await row.locator('[data-qc="records-name"]').innerText()).split(", ");
    await row.click();
    const sel = new URL(page.url()).searchParams.get("sel")!;
    expect(sel).toBeTruthy();

    await page.goto(`/patients?sel=${sel}`);
    await expect(page.locator('[data-qc="patients-pagination"]')).toContainText("Showing 26–");
    await expect(page.locator('[data-qc="drawer-name"]')).toContainText(name[0]!);
    await expect(page.locator(`[data-qc="records-row"][data-selected="true"]`)).toContainText(
      name[0]!,
    );
  });

  test("drawer pills: Book opens the quick booking; Assign task creates one for the suggested teammate", async ({
    page,
  }) => {
    await page.goto("/patients?q=Bennett");
    const row = page.locator('[data-qc="records-row"]', { hasText: /Bennett, .*Olivia/ });
    await row.click();
    const drawer = page.locator('[data-qc="patient-drawer"]');
    await expect(drawer.locator('[data-qc="drawer-name"]')).toHaveText(/Olivia Bennett/);

    const book = drawer.locator('[data-qc="drawer-action-book"]');
    if ((await book.count()) > 0) {
      await book.click();
      await expect(page.getByRole("dialog", { name: /Book Olivia Bennett/ })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    }

    const before = await drawer.locator('[data-qc="drawer-task"]').count();
    await drawer.locator('[data-qc="drawer-assign-task"]').click();
    const dialog = page.locator('[data-qc="assign-task-dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Assign a task: Olivia Bennett");
    await dialog.locator('[data-qc="assign-type-plan_support"]').click();
    await expect(dialog.locator('[data-qc="assign-template"]')).toContainText(
      "Check in with Olivia on how they're finding the plan so far.",
    );
    // The suggested teammate is first and pre-selected; the rule preview reads back the choice.
    const suggested = dialog.locator('[data-qc^="assign-who-"]').first();
    await expect(suggested).toHaveAttribute("aria-checked", "true");
    await dialog.locator(`[data-qc="assign-who-${NADIA}"]`).click();
    await dialog.locator('[data-qc="assign-due-tomorrow"]').click();
    await dialog.locator('[data-qc="assign-rule"]').click();
    await expect(dialog.locator('[data-qc="assign-rule-preview"]')).toContainText(
      /Plan support → Nadia R\. → due tomorrow/,
    );
    await dialog.locator('[data-qc="assign-submit"]').click();
    await expect(
      page.locator("[data-sonner-toast]", { hasText: /Olivia assigned to Nadia R\./ }),
    ).toBeVisible();
    await expect(dialog).toHaveCount(0);

    // The drawer and the Tasks page both list it.
    await expect(drawer.locator('[data-qc="drawer-task"]')).toHaveCount(before + 1);
    // The drawer row reads type · who · when; opening it lands on the task.
    const created = drawer.locator('[data-qc="drawer-task"]', { hasText: "Plan support" }).filter({
      hasText: /Nadia/,
    });
    await expect(created.first()).toContainText(/Tomorrow|tomorrow|18:00/);
    await created.first().click();
    await expect(page).toHaveURL(/\/tasks\?.*task=/);
    await expect(
      page.locator('[data-qc="task-row"]', { hasText: "Plan support: Olivia" }).first(),
    ).toBeVisible();
  });

  test("Select reveals checkboxes; select all matching across pages; the bulk offer dialog", async ({
    page,
  }) => {
    await page.goto("/patients?view=due");
    await expect(page.locator('[data-qc="select-patient"]')).toHaveCount(0);
    await page.locator('[data-qc="records-select-toggle"]').click();
    await expect(page.locator('[data-qc="select-hint"]')).toContainText(
      "Select patients to send an offer",
    );
    await page.locator('[data-qc="select-patient"]').first().click();
    await expect(page.locator('[data-qc="select-hint"]')).toHaveCount(0);
    const total = Number(
      (await page.locator('[data-qc="records-summary"]').innerText()).replace(/\D/g, ""),
    );
    const selectAll = page.locator('[data-qc="select-all-matching"]');
    await expect(selectAll).toContainText(`Select all ${total} matching`);
    await selectAll.click();
    await expect(page.locator('[data-qc="bulk-send-offer"]')).toContainText(String(total));
    // Selection survives paging.
    await page
      .locator('[data-qc="patients-pagination"]')
      .getByRole("button", { name: /next page/i })
      .click();
    await expect(page.locator('[data-qc="bulk-send-offer"]')).toContainText(String(total));
    await expect(
      page.locator('[data-qc="select-patient"][data-state="checked"]').first(),
    ).toBeVisible();
    // Leaving Select mode clears the selection and hides the checkboxes again.
    await page.locator('[data-qc="records-select-toggle"]').click();
    await expect(page.locator('[data-qc="select-patient"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="bulk-send-offer"]')).toHaveCount(0);
  });

  test("the bulk offer dialog says how many are portal-only", async ({ page }) => {
    await page.goto("/patients?view=all");
    await page.locator('[data-qc="records-select-toggle"]').click();
    for (const n of [0, 1, 2, 3, 4])
      await page.locator('[data-qc="select-patient"]').nth(n).click();
    await page.locator('[data-qc="bulk-send-offer"]').click();
    const dialog = page.locator('[data-qc="send-offer"]');
    await expect(
      dialog.getByRole("heading", { name: "Send an offer to 5 patients" }),
    ).toBeVisible();
    // Either everyone selected is opted in, or the dialog says who is not.
    const warning = dialog.locator('[data-qc="offer-portal-only-warning"]');
    if ((await warning.count()) > 0) {
      await expect(warning).toContainText(/\d+ of 5 haven't opted into marketing/);
    }
  });

  test("below the xl breakpoint the drawer is a sheet that opens from the row", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/patients");
    await expect(page.locator('[data-qc="records-row"]').first()).toBeVisible();
    // One drawer at a time: none in the column while the sheet is closed.
    await expect(page.locator('[data-qc="patient-drawer"]')).toHaveCount(0);
    const row = page.locator('[data-qc="records-row"]').nth(2);
    const name = (await row.locator('[data-qc="records-name"]').innerText()).split(", ");
    await row.click();
    const sheet = page.locator('[data-qc="records-drawer-sheet"]');
    await expect(sheet).toBeVisible();
    await expect(sheet.locator('[data-qc="drawer-name"]')).toContainText(name[0]!);
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
  });
});

test.describe("practitioner", () => {
  test.use({ role: "practitioner" });

  test("Records opens on her own book; Show everyone widens it and the URL says so", async ({
    page,
  }) => {
    await page.goto("/patients");
    await expect(page.locator('[data-qc="records-row"]').first()).toBeVisible();
    const mine = page.locator('[data-qc="records-mine"]');
    await expect(mine).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-qc="records-summary"]')).toContainText(
      /Nadia R\. · \d+ patients/,
    );
    const ownCount = Number(
      (await page.locator('[data-qc="records-summary"]').innerText()).replace(/\D/g, ""),
    );

    await page.locator('[data-qc="records-show-everyone"]').click();
    await expect(page).toHaveURL(/prac=all/);
    await expect(page.locator('[data-qc="records-summary"]')).toContainText(/All practitioners/);
    const allCount = Number(
      (await page.locator('[data-qc="records-summary"]').innerText()).replace(/\D/g, ""),
    );
    expect(allCount).toBeGreaterThan(ownCount);

    // Back to her book from the pill.
    await mine.click();
    await expect(page).not.toHaveURL(/prac=all/);
    await expect(page.locator('[data-qc="records-summary"]')).toContainText(`${ownCount} patients`);
  });
});
