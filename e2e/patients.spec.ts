import { expect, test } from "./fixtures";

/**
 * Patient list search and the record page tabs.
 */

test.use({ role: "owner" });

test("search narrows the list by name", async ({ page }) => {
  await page.goto("/patients");
  const search = page.getByLabel("Search by name or reference");
  await search.fill("Bennett");
  await expect(page).toHaveURL(/q=Bennett/);
  await expect(
    page.locator('[data-qc="records-name"]', { hasText: /Bennett, .*Olivia/ }),
  ).toBeVisible();
  // A patient who does not match must be filtered out of the table.
  await expect(page.locator('[data-qc="records-name"]', { hasText: /Bennett, / })).toHaveCount(1);
  // The drawer follows the first visible row.
  await expect(page.locator('[data-qc="drawer-name"]')).toHaveText(/Olivia Bennett/);
});

test("search by reference finds the same record", async ({ page }) => {
  await page.goto("/patients");
  await page.getByLabel("Search by name or reference").fill("AV-1200");
  await expect(
    page.locator('[data-qc="records-name"]', { hasText: /Bennett, .*Olivia/ }),
  ).toBeVisible();
});

test("record page exposes every clinical tab", async ({ page }) => {
  await page.goto("/patients?q=Bennett");
  await page.locator('[data-qc="records-row"]', { hasText: /Bennett, .*Olivia/ }).click();
  await page.locator('[data-qc="drawer-name"]', { hasText: /Olivia Bennett/ }).click();
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
});

test.describe("journey board", () => {
  test("tiles count and highlight, faces scope the map, a pill opens the drawer", async ({
    page,
  }) => {
    await page.goto("/patients?tab=board");
    const pills = page.locator('[data-qc="board-pill"]');
    await expect(pills.first()).toBeVisible();
    // Six tiles; their counts add up over the risk states (Due this week overlaps No booking).
    for (const tile of ["overdue", "noshow", "mismatch", "nobook", "due_this_week", "ontrack"]) {
      await expect(page.locator(`[data-qc="board-tile-${tile}"]`)).toBeVisible();
    }
    const risks = await pills.evaluateAll((els) => els.map((e) => e.getAttribute("data-risk")));
    for (const tile of ["overdue", "noshow", "mismatch", "nobook", "ontrack"]) {
      const count = Number(
        await page.locator(`[data-qc="board-tile-${tile}"]`).getAttribute("data-count"),
      );
      expect(count).toBe(risks.filter((r) => r === tile).length);
    }

    // Picking tiles lights the matching pills and fades the rest; the URL keeps the choice.
    await page.locator('[data-qc="board-tile-overdue"]').click();
    await page.locator('[data-qc="board-tile-noshow"]').click();
    await expect(page).toHaveURL(/tiles=overdue(%2C|,)noshow/);
    const overdue = Number(
      await page.locator('[data-qc="board-tile-overdue"]').getAttribute("data-count"),
    );
    const noshow = Number(
      await page.locator('[data-qc="board-tile-noshow"]').getAttribute("data-count"),
    );
    await expect(page.locator('[data-qc="board-pill"][data-hit]')).toHaveCount(overdue + noshow);
    await expect(page.locator('[data-qc="board-legend"]')).toContainText(
      `${overdue + noshow} of ${risks.length} plans highlighted`,
    );

    // A practitioner face fades the other rows and scopes the tile counts.
    const face = page.locator('[data-qc^="board-prac-"]').first();
    const faceId = (await face.getAttribute("data-qc"))!.replace("board-prac-", "");
    await face.click();
    await expect(page).toHaveURL(new RegExp(`prac=${faceId}`));
    const others = page.locator(
      `[data-qc="board-row"]:not([data-practitioner="${faceId}"]) [role="rowheader"]`,
    );
    if ((await others.count()) > 0) {
      await expect(others.first()).toHaveCSS("opacity", "0.3");
    }
    await page.locator('[data-qc="board-clear"]').click();
    await expect(page).not.toHaveURL(/tiles=/);

    // No action buttons on the board; a pill opens that patient in the Records drawer.
    await expect(page.locator('[data-qc="board-book"]')).toHaveCount(0);
    const pill = pills.first();
    const name = (await pill.getAttribute("data-name"))!;
    await pill.click();
    await expect(page).toHaveURL(/\/patients\?.*sel=/);
    await expect(page.locator('[data-qc="drawer-name"]')).toHaveText(name);
  });

  test("the dashboard's overdue-steps link opens the three needs-a-human tiles", async ({
    page,
  }) => {
    await page.goto("/patients?tab=board&risk=1");
    await expect(page.locator('[data-qc="board-pill"]').first()).toBeVisible();
    for (const tile of ["overdue", "noshow", "nobook"]) {
      await expect(page.locator(`[data-qc="board-tile-${tile}"]`)).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    await expect(page.locator('[data-qc="board-tile-ontrack"]')).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

test.describe("record: what the list promises, the record shows", () => {
  test("header actions, Open chat, the open-items pill and the Treatments badge agree with the record", async ({
    page,
  }) => {
    await page.goto("/patients?view=all");
    // A row with open items: the pill count equals the drawer's open tasks, and the
    // record's tasks card lists at least that many.
    const withPill = page.locator('[data-qc="records-row"]', {
      has: page.locator('[data-qc="open-tasks-pill"]'),
    });
    const pill = withPill.first().locator('[data-qc="open-tasks-pill"]');
    const pillCount = Number((await pill.innerText()).replace(/\D/g, ""));
    await withPill.first().click();
    await expect(page.locator('[data-qc="drawer-task"]')).toHaveCount(pillCount);
    await page.locator('[data-qc="drawer-name"]').click();
    await expect(page).toHaveURL(/\/patients\/[^/?]+/);
    await page.getByRole("tab", { name: "Treatments" }).click();
    const panel = page.locator('[data-qc="patient-tasks"]');
    await expect(panel).toBeVisible();
    await expect.poll(async () => Number(await panel.getAttribute("data-open"))).toBe(pillCount);
    await expect(panel.locator('[data-qc="patient-task"][data-status="open"]')).toHaveCount(
      pillCount,
    );

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
    await page.goto("/patients?q=Bennett");
    await page.locator('[data-qc="records-row"]', { hasText: /Bennett, .*Olivia/ }).click();
    await page.locator('[data-qc="drawer-name"]', { hasText: /Olivia Bennett/ }).click();
    const progress = page.locator('[data-qc="plan-progress"]').first();
    await expect(progress).toBeVisible();
    const [done, total] = (await progress.innerText()).match(/\d+/g)!.map(Number);

    // Same figures in Olivia's pill tooltip on the journey board.
    await page.goto("/patients?tab=board");
    const pill = page.locator('[data-qc="board-pill"][data-name="Olivia Bennett"]').first();
    await expect(pill).toBeVisible();
    await pill.hover();
    await expect(page.getByRole("tooltip")).toContainText(`${done}/${total}`);

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

test.describe("attention needed aggregates tasks", () => {
  async function tasksAggregate(page: import("@playwright/test").Page) {
    await expect(page.locator('[data-qc="attention-deposit-rule"]')).toBeVisible();
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="attention-kind-message"]')).toHaveCount(0);
    // Plan steps no longer appear one by one; tasks do, as two aggregate rows at most.
    await expect(page.locator('[data-qc="attention-kind-treatment_due"]')).toHaveCount(0);
    const kind = page.locator('[data-qc="attention-kind-tasks"]').first();
    await expect(kind).toBeVisible({ timeout: 15_000 });
    await expect(kind).toHaveText("Tasks");
    await kind.click();
    const rows = page.locator('[data-qc="attention-tasks"]');
    await expect(rows.first()).toBeVisible();
    return rows.allInnerTexts();
  }

  test("owner: the overdue aggregate matches the Tasks page and links to it", async ({ page }) => {
    await page.goto("/dashboard");
    const rows = await tasksAggregate(page);
    expect(
      rows.some((r) => /\d+ (chases|rebooks|questions|recalls|offers|check-ins)/.test(r)),
    ).toBe(true);
    const urgent = page.locator('[data-qc="attention-urgent"] [data-qc="attention-tasks"]').first();
    const n = Number(((await urgent.innerText()).match(/(\d+) overdue/) ?? [])[1] ?? 0);
    await urgent.locator("a").first().click();
    await expect(page).toHaveURL(/\/tasks/);
    await expect(page.locator('[data-qc="tasks-main"]')).toHaveAttribute("data-view", "team");
    if (n > 0) {
      await expect(page.locator('[data-qc="tasks-group-overdue"] h3')).toContainText(
        `Overdue · ${n}`,
      );
    }
  });
});

test.describe("a booking only counts when it is for the step", () => {
  test("a booking for another treatment is named on the plan card and the chase stays", async ({
    page,
  }) => {
    await page.goto("/patients?tab=board");
    const pill = page.locator('[data-qc="board-pill"][data-risk="mismatch"]').first();
    await expect(pill).toBeVisible();
    const patientId = (await pill.getAttribute("data-patient"))!;

    await page.goto(`/patients/${patientId}?tab=treatments`);
    await expect(page.locator('[data-qc="treatment-plan-card"]')).toBeVisible();
    await expect(page.locator('[data-qc="plan-booking-note"]').first()).toHaveText(
      /^\d{1,2} \w+ booking is for .+, not this step$/,
    );
    // Unsettled, so the step keeps its Book button and no "Booked" date.
    await expect(page.locator('[data-qc="plan-book"]').first()).toBeVisible();
    await expect(page.locator('[data-qc="plan-step"]').first()).not.toContainText("Booked");
  });

  test("a missed step is tagged No show and becomes a rebook task", async ({ page }) => {
    await page.goto("/patients?tab=board");
    const pill = page.locator('[data-qc="board-pill"][data-risk="noshow"]').first();
    await expect(pill).toBeVisible();
    const name = (await pill.getAttribute("data-name"))!;
    const patientId = (await pill.getAttribute("data-patient"))!;

    await page.goto(`/patients/${patientId}?tab=treatments`);
    const plan = page.locator('[data-qc="treatment-plan-card"]');
    await expect(plan).toContainText("No show");
    await expect(plan.locator('[data-qc="plan-booking-note"]').first()).toHaveText(
      /^Did not attend \d{1,2} \w+$/,
    );
    await expect(page.locator('[data-qc="plan-book"]').first()).toBeVisible();
    // The record's tasks card carries the rebook task the rule created.
    const rebook = page.locator('[data-qc="patient-task"][data-status="open"]', {
      hasText: "Rebook missed",
    });
    await expect(rebook.first()).toBeVisible();

    // And it is one rebook task on the Tasks page, not a chase as well.
    await page.goto("/tasks?view=team&types=rebook_no_show");
    const row = page.locator('[data-qc="task-row"][data-type="rebook_no_show"]', { hasText: name });
    await expect(row.first()).toBeVisible();
    await page.goto("/tasks?view=team&types=chase_booking");
    await expect(page.locator('[data-qc="tasks-main"]')).toBeVisible();
    await expect(
      page.locator('[data-qc="task-row"][data-type="chase_booking"]', { hasText: name }),
    ).toHaveCount(0);
  });
});

test.describe("tasks aggregate as practitioner", () => {
  test.use({ role: "practitioner" });

  test("Nadia sees the Tasks aggregate and her own Tasks page", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="attention-deposit-rule"]')).toBeVisible();
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="attention-kind-message"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="attention-kind-treatment_due"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="attention-kind-tasks"]').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-qc="tasks-summary-stats"]')).toBeVisible();

    await page.goto("/tasks");
    await expect(page.locator('[data-qc="tasks-main"]')).toHaveAttribute("data-view", "assigned");
    await expect(page.locator('[data-qc="your-day-panel"]')).toBeVisible();
    await expect(page.locator('[data-qc="team-panel"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="task-select"]')).toHaveCount(0);
    // Everything on her list is hers.
    const assignees = await page
      .locator('[data-qc="task-assignee"]')
      .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-assignee")))]);
    expect(assignees.length).toBeLessThanOrEqual(1);
  });
});

test.describe("tasks aggregate as front desk", () => {
  test.use({ role: "front_desk" });

  test("Sofia sees the Tasks aggregate; clinical questions never reach her", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="attention-deposit-rule"]')).toBeVisible();
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="attention-kind-message"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="attention-kind-tasks"]').first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator('[data-qc="tasks-summary-stats"]')).toBeVisible();

    await page.goto("/tasks?view=pool");
    await expect(page.locator('[data-qc="todays-calls-panel"]')).toBeVisible();
    await expect(page.locator('[data-qc="tasks-type-question"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="task-row"]').first()).toBeVisible();
    await expect(page.locator('[data-qc="task-row"][data-type="question"]')).toHaveCount(0);
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
    return card
      .locator('[data-qc="attention-deposit-due"] .font-semibold')
      .evaluateAll((els) => els.map((e) => e.textContent?.trim() ?? "").filter(Boolean));
  }

  const urgentNames = await depositNames(urgent);
  const weekNames = await depositNames(week);
  expect(urgentNames.length).toBeGreaterThan(0);
  for (const name of urgentNames) expect(weekNames).not.toContain(name);
});
