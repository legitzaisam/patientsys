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
    expect(dates.every((d) => /^(Booked|Due) /.test(d.trim()))).toBe(true);

    // An overdue card names the step that slipped and how late it is, once.
    await expect(cards.filter({ hasText: "Next step overdue" })).toHaveCount(0);
    const overdue = cards.filter({ has: page.locator('[data-qc="board-late"]') }).first();
    if ((await overdue.count()) > 0) {
      await expect(overdue.locator('[data-qc="board-step"]')).toHaveText(
        /^\S.+, \d+ days? overdue$/,
      );
      // Once on the chip, once on the step line.
      expect((await overdue.innerText()).match(/overdue/gi)).toHaveLength(2);
      // Late means unbooked, so it carries no date and still asks to be booked.
      await expect(overdue.locator('[data-qc="board-date"]')).toHaveCount(0);
      await expect(overdue.locator('[data-qc="board-book"]')).toHaveCount(1);
    }

    // A step with its own booking is settled: a date, no chase, nothing late.
    const booked = cards
      .filter({ has: page.locator('[data-qc="board-date"]').filter({ hasText: /^Booked/ }) })
      .first();
    await expect(booked.locator('[data-qc="board-book"]')).toHaveCount(0);
    await expect(booked).not.toContainText("overdue");

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

test.describe("attention treatment due", () => {
  async function treatmentDueNames(page: import("@playwright/test").Page) {
    await expect(page.locator('[data-qc="attention-deposit-rule"]')).toBeVisible();
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="attention-kind-message"]')).toHaveCount(0);
    const kind = page.locator('[data-qc="attention-kind-treatment_due"]');
    await expect(kind).toBeVisible({ timeout: 15_000 });
    await expect(kind).toHaveText("Skin-plan treatment due");
    await kind.click();
    const more = page.getByRole("button", { name: /Show \d+ more/ });
    if ((await more.count()) > 0) await more.click();
    return page
      .locator('[data-qc="attention-treatment-due"]')
      .evaluateAll((els) =>
        els
          .map((e) => e.querySelector(".font-semibold")?.textContent?.trim() ?? "")
          .filter(Boolean),
      );
  }

  test("owner: every Skin-plan treatment due name has a Book button on the journey board", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    const names = await treatmentDueNames(page);
    expect(names.length).toBeGreaterThan(0);

    await page.goto("/patients?tab=board");
    await expect(page.locator('[data-qc="board-card"]').first()).toBeVisible();
    const bookNames = await page.locator('[data-qc="board-card"]').evaluateAll((els) =>
      els
        .filter((e) => e.querySelector('[data-qc="board-book"]'))
        .map((e) => e.querySelector("p.font-semibold")?.textContent?.trim() ?? "")
        .filter(Boolean),
    );
    for (const name of names) expect(bookNames).toContain(name);

    await page.goto("/dashboard");
    await page.locator('[data-qc="attention-kind-treatment_due"]').click();
    await page.locator('[data-qc="attention-treatment-due"] a').first().click();
    await expect(page).toHaveURL(/\/patients\/.+[?&]tab=treatments/);
    await expect(page.locator('[data-qc="treatment-plan-card"]')).toBeVisible();
  });
});

test.describe("a booking only counts when it is for the step", () => {
  test("a booking for another treatment is named on the plan card and the chase stays", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="attention-deposit-rule"]')).toBeVisible();
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    const kind = page.locator('[data-qc="attention-kind-treatment_due"]');
    await expect(kind).toBeVisible({ timeout: 15_000 });
    await kind.click();
    const more = page.getByRole("button", { name: /Show \d+ more/ });
    if ((await more.count()) > 0) await more.click();

    const row = page
      .locator('[data-qc="attention-treatment-due"]')
      .filter({ hasText: "not this step" })
      .first();
    await expect(row).toBeVisible();
    await row.locator("a").first().click();
    await expect(page).toHaveURL(/\/patients\/.+[?&]tab=treatments/);

    await expect(page.locator('[data-qc="treatment-plan-card"]')).toBeVisible();
    await expect(page.locator('[data-qc="plan-booking-note"]').first()).toHaveText(
      /^\d{1,2} \w+ booking is for .+, not this step$/,
    );
    // Unsettled, so the step keeps its Book button and no "Booked" date.
    await expect(page.locator('[data-qc="plan-book"]').first()).toBeVisible();
    await expect(page.locator('[data-qc="plan-step"]').first()).not.toContainText("Booked");
  });

  test("a missed step is tagged No show and keeps its place on Attention needed", async ({
    page,
  }) => {
    await page.goto("/patients?tab=board");
    const card = page.locator('[data-qc="board-card"]').filter({ hasText: "No show" }).first();
    await expect(card).toBeVisible();
    const name = (await card.locator("p.font-semibold").first().innerText()).trim();
    const href = (await card.locator("a").first().getAttribute("href"))!.split("?")[0];

    await page.goto(`${href}?tab=treatments`);
    const plan = page.locator('[data-qc="treatment-plan-card"]');
    await expect(plan).toContainText("No show");
    await expect(plan.locator('[data-qc="plan-booking-note"]').first()).toHaveText(
      /^Did not attend \d{1,2} \w+$/,
    );
    await expect(page.locator('[data-qc="plan-book"]').first()).toBeVisible();

    // It outlives today's diary, and is chased as a no show rather than twice.
    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    const noShow = page.locator('[data-qc="attention-kind-no_show"]');
    await expect(noShow).toBeVisible({ timeout: 15_000 });
    await noShow.click();
    await expect(
      page.locator('[data-qc="attention-no-show"]').filter({ hasText: name }),
    ).toHaveCount(1);
    await expect(
      page.locator('[data-qc="attention-treatment-due"]').filter({ hasText: name }),
    ).toHaveCount(0);
  });
});

test.describe("attention treatment due as practitioner", () => {
  test.use({ role: "practitioner" });

  test("Nadia only sees her unbooked plan patients", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="attention-deposit-rule"]')).toBeVisible();
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="attention-kind-message"]')).toHaveCount(0);
    const kind = page.locator('[data-qc="attention-kind-treatment_due"]');
    await expect(kind).toBeVisible({ timeout: 15_000 });
    await expect(kind).toHaveText("Skin-plan treatment due");
    await kind.click();
    const more = page.getByRole("button", { name: /Show \d+ more/ });
    if ((await more.count()) > 0) await more.click();
    const names = await page
      .locator('[data-qc="attention-treatment-due"]')
      .evaluateAll((els) =>
        els
          .map((e) => e.querySelector(".font-semibold")?.textContent?.trim() ?? "")
          .filter(Boolean),
      );
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toContain("Marcus Delaney");

    await page.goto("/patients?tab=board");
    await expect(page.locator('[data-qc="board-card"]').first()).toBeVisible();
    const bookNames = await page.locator('[data-qc="board-card"]').evaluateAll((els) =>
      els
        .filter((e) => e.querySelector('[data-qc="board-book"]'))
        .map((e) => e.querySelector("p.font-semibold")?.textContent?.trim() ?? "")
        .filter(Boolean),
    );
    for (const name of names) expect(bookNames).toContain(name);
  });
});

test.describe("attention treatment due as front desk", () => {
  test.use({ role: "front_desk" });

  test("Sofia sees the clinic-wide skin-plan dues in the window", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="attention-deposit-rule"]')).toBeVisible();
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="attention-kind-message"]')).toHaveCount(0);
    const kind = page.locator('[data-qc="attention-kind-treatment_due"]');
    await expect(kind).toBeVisible({ timeout: 15_000 });
    await expect(kind).toHaveText("Skin-plan treatment due");
    await kind.click();
    const more = page.getByRole("button", { name: /Show \d+ more/ });
    if ((await more.count()) > 0) await more.click();
    const names = await page
      .locator('[data-qc="attention-treatment-due"]')
      .evaluateAll((els) =>
        els
          .map((e) => e.querySelector(".font-semibold")?.textContent?.trim() ?? "")
          .filter(Boolean),
      );
    // Clinic-wide: Nadia's patient and another practitioner's patient.
    expect(names).toContain("Harriet Blackwood");
    expect(names).toContain("Marcus Delaney");
  });
});

test("a patient on urgent Deposit due is not repeated under This week", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.locator('[data-qc="attention-deposit-rule"]')).toBeVisible();
  await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);

  const urgent = page.locator('[data-qc="attention-urgent"]');
  const week = page.locator('[data-qc="attention-this-week"]');

  async function depositNames(card: import("@playwright/test").Locator) {
    const kind = card.locator('[data-qc="attention-kind-deposit_due"]');
    if ((await kind.count()) === 0) return [];
    await kind.click();
    const more = card.getByRole("button", { name: /Show \d+ more/ });
    if ((await more.count()) > 0) await more.click();
    return card.locator('[data-qc="attention-deposit-due"] .font-semibold').evaluateAll((els) =>
      els.map((e) => e.textContent?.trim() ?? "").filter(Boolean),
    );
  }

  const urgentNames = await depositNames(urgent);
  const weekNames = await depositNames(week);
  expect(urgentNames.length).toBeGreaterThan(0);
  for (const name of urgentNames) expect(weekNames).not.toContain(name);
});
