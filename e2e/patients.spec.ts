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
    expect(
      dates.every((d) => /^((Booked|Due) .+|\d+d overdue)( · Booked .+)?$/.test(d.trim())),
    ).toBe(true);

    // An overdue card names the step that slipped instead of a bare reason.
    await expect(cards.filter({ hasText: "Next step overdue" })).toHaveCount(0);
    const overdue = cards.filter({ hasText: /Overdue:/ }).first();
    if ((await overdue.count()) > 0) {
      await expect(overdue.locator('[data-qc="board-step"]')).toHaveText(/^Overdue: \S.+/);
      await expect(overdue.locator('[data-qc="board-date"]')).toContainText(/overdue|Due today/);
    }

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

test.describe("record: what the list promises, the record shows", () => {
  test("header actions, Open chat, the open-items pill and the Treatments badge agree with the record", async ({
    page,
  }) => {
    await page.goto("/patients?view=all");
    // A row with open items: the pill count must equal the record's Recall tasks card.
    const pill = page.locator('[data-qc="open-tasks-pill"]').first();
    const pillCount = Number((await pill.innerText()).replace(/\D/g, ""));
    await pill.click();
    await expect(page).toHaveURL(/tab=treatments#recall/);
    const recall = page.locator('[data-qc="recall-tasks"]');
    await expect(recall).toBeVisible();
    await expect(recall).toHaveAttribute("data-open", String(pillCount));
    await expect(recall).not.toContainText("Retention page");

    // Record treatment and Open chat sit on the header; the rest live in ⋯.
    await expect(page.getByRole("button", { name: "Record treatment" })).toBeVisible();
    await expect(page.locator('[data-qc="open-chat"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Send form" })).toHaveCount(0);
    await page.locator('[data-qc="record-more"]').click();
    for (const item of ["Send form", "Send offer", "Archive"]) {
      await expect(page.getByRole("menuitem", { name: item })).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    // Owners see lifetime spend on the header.
    await expect(page.locator('[data-qc="record-lifetime-spend"]')).toContainText(
      /£[\d,]+ lifetime spend/,
    );

    // The Treatments badge counts the bookings still to chase, listed below.
    const badge = page.locator('[data-qc="treatments-badge"]');
    if ((await badge.count()) > 0) {
      const n = Number(await badge.innerText());
      await expect(badge).toHaveAttribute("title", /still need/);
      await expect(page.locator('[data-qc="booking-chase-item"]')).toHaveCount(n);
    }

    // Open chat opens the floating window on this patient; no docked panel remains.
    // (The fixture hides the dock to keep corners clear; show it for this check.)
    await expect(page.locator("#patient-chat")).toHaveCount(0);
    await page.addStyleTag({ content: '[data-qc="floating-dock"] { display: flex !important; }' });
    await page.locator('[data-qc="open-chat"]').click();
    const chat = page.locator('[data-qc="chat-window"]');
    await expect(chat).toBeVisible();
    await expect(chat.locator("header")).toContainText("Private messages with this patient");
  });

  test("the plan card matches the journey board and the patient's portal", async ({
    page,
    context,
    baseURL,
  }) => {
    await page.goto("/patients");
    await page.getByRole("link", { name: /Bennett, .*Olivia/ }).click();
    const progress = page.locator('[data-qc="plan-progress"]').first();
    await expect(progress).toBeVisible();
    const [done, total] = (await progress.innerText()).match(/\d+/g)!.map(Number);

    // Same figures on the journey board card for Olivia.
    await page.goto("/patients?tab=board");
    const card = page
      .locator('[data-qc="board-card"]')
      .filter({ hasText: "Olivia Bennett" })
      .first();
    await expect(card).toContainText(`${done}/${total}`);

    // And in the patient's own portal.
    await context.addCookies([
      { name: "demo_role", value: "patient", url: baseURL ?? "http://localhost:8091" },
    ]);
    await page.goto("/my-record/plan");
    await expect(page.locator('[data-qc="portal-plan-overview"]')).toContainText(
      `${done} of ${total} milestones`,
    );
  });
});

test.describe("insights", () => {
  test("Patient base follows the period picker and shows patients by last visit; next-step lists paginate", async ({
    page,
  }) => {
    await page.goto("/insights?tab=book");
    await expect(page.locator(".page-subtitle")).toContainText("Last 12 months.");
    const buckets = page.locator('[data-qc="last-visit-bucket"]');
    await expect(buckets).toHaveCount(5);
    await expect(buckets.first()).toContainText("Under 3 months");
    await expect(page.getByText("Active vs inactive")).toHaveCount(0);
    await page.getByRole("tab", { name: "1 month" }).click();
    await expect(page.locator(".page-subtitle")).toContainText("Last month.");

    await page.goto("/insights");
    await expect(page.getByText("What sold")).toHaveCount(0);
    // Whichever next-step list runs past ten rows paginates; the consulted list
    // offers Schedule and the same "days waiting" wording as the waiting list.
    await expect(page.locator('[data-qc$="-pagination"]').first()).toContainText("Showing 1–10 of");
    const consulted = page.locator("#insights-consulted");
    await expect(consulted.locator('[data-qc="insights-schedule"]').first()).toBeVisible();
    await expect(consulted.getByText(/\d+d waiting · consulted/).first()).toBeVisible();
  });
});
