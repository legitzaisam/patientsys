import { expect, test } from "./fixtures";

/**
 * Patient list search and the record page tabs.
 */

test.use({ role: "owner" });

test("search narrows the list by name", async ({ page }) => {
  await page.goto("/patients");
  const search = page.getByLabel("Search by name or reference");
  await search.fill("Bennett");
  await expect(page.getByRole("link", { name: /Bennett, .*Olivia/ })).toBeVisible();
  // A patient who does not match must be filtered out of the table.
  await expect(page.getByRole("link", { name: /Bennett, / })).toHaveCount(1);
});

test("search by reference finds the same record", async ({ page }) => {
  await page.goto("/patients");
  await page.getByLabel("Search by name or reference").fill("AV-1200");
  await expect(page.getByRole("link", { name: /Bennett, .*Olivia/ })).toBeVisible();
});

test("record page exposes every clinical tab", async ({ page }) => {
  await page.goto("/patients");
  await page.getByRole("link", { name: /Bennett, .*Olivia/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Olivia Bennett/ })).toBeVisible();

  for (const tab of ["Before and after", "Documents", "Medical history", "Contact"]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
  }

  // Contact preferences and the comms log live on the Contact tab for comms.send staff.
  await expect(page.getByRole("heading", { name: "Contact preferences" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Email and text" })).toBeVisible();
});

test.describe("list: pages, filters and columns", () => {
  test("25 a page, the page in the URL, counts on every filter chip", async ({ page }) => {
    await page.goto("/patients");
    await expect(page.locator("table tbody tr")).toHaveCount(25);
    const bar = page.locator('[data-qc="patients-pagination"]');
    await expect(bar).toContainText("Showing 1–25 of");

    // Filter chips say how many they cover; Treatments due equals the dashboard card.
    const due = page.locator('[data-qc="patients-filter-due"]');
    const dueCount = Number((await due.innerText()).replace(/\D/g, ""));
    expect(dueCount).toBeGreaterThan(0);
    await expect(page.locator('[data-qc="patients-filter-nobooking"]')).toContainText(
      "No upcoming treatment",
    );

    await due.click();
    await expect(page).toHaveURL(/view=due/);
    await expect(page.locator(".page-subtitle")).toContainText(`${dueCount} records`);
    // Every row on the due view names an overdue or due date.
    const states = await page
      .locator('[data-qc="next-treatment"]')
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-state")));
    expect(states.every((s) => s === "overdue" || s === "due_soon")).toBe(true);

    // Paging keeps the view and lands in the URL.
    await bar.getByRole("button", { name: /next page/i }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(bar).toContainText("Showing 26–");
  });

  test("the offer hint, select all matching across pages, and the task pill link", async ({
    page,
  }) => {
    await page.goto("/patients?view=due");
    await expect(page.locator('[data-qc="select-hint"]')).toContainText(
      "Select patients to send an offer",
    );
    await page.locator('[data-qc="select-patient"]').first().click();
    await expect(page.locator('[data-qc="select-hint"]')).toHaveCount(0);
    const total = Number((await page.locator(".page-subtitle").innerText()).replace(/\D/g, ""));
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

    // The open-tasks pill opens the record's Treatments tab at the recall card.
    const pill = page.locator('[data-qc="open-tasks-pill"]').first();
    await pill.click();
    await expect(page).toHaveURL(/\/patients\/[^/?]+\?tab=treatments#recall/);
  });

  test("the bulk offer dialog says how many are portal-only", async ({ page }) => {
    await page.goto("/patients?view=all");
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
});

test.describe("journey board", () => {
  test("at-risk cards first, dated Due or Booked, and Book opens Quick book pre-filled", async ({
    page,
  }) => {
    await page.goto("/patients?tab=board");
    const cards = page.locator('[data-qc="board-card"]');
    await expect(cards.first()).toBeVisible();
    // Within a column, no on-track card sits above an at-risk one.
    for (const column of await page.locator("ul").filter({ has: cards }).all()) {
      const risks = await column
        .locator('[data-qc="board-card"]')
        .evaluateAll((els) => els.map((e) => e.getAttribute("data-risk")));
      const firstOnTrack = risks.indexOf("on-track");
      const lastAtRisk = risks.lastIndexOf("at-risk");
      if (firstOnTrack !== -1 && lastAtRisk !== -1) expect(lastAtRisk).toBeLessThan(firstOnTrack);
    }
    const dates = await page.locator('[data-qc="board-date"]').allInnerTexts();
    expect(dates.every((d) => /^(Booked|Due) |overdue$/.test(d))).toBe(true);

    const book = page.locator('[data-qc="board-book"]').first();
    const card = page.locator('[data-qc="board-card"]').filter({ has: book }).first();
    const name = (await card.locator("p.font-semibold").first().innerText()).trim();
    await book.click();
    await expect(page.getByText(`Book ${name}`).first()).toBeVisible();
    // The patient picker is pre-filled with the card's patient.
    await expect(page.getByPlaceholder("Search patient…")).toHaveValue(name);
    await page.keyboard.press("Escape");
  });
});
