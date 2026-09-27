import { expect, test } from "./fixtures";

/**
 * Clinic-portal corrections from the feedback round: the diary carousel no
 * longer moves on hover, the KPI cards say whose numbers they show, retention
 * has a period picker, insight tiles open their detail, pause requests carry a
 * Contact button, comms live in a tab, the journey card explains itself and
 * notes on upcoming appointments read as the practitioner's pre-read.
 */

test.describe("as the owner", () => {
  test.use({ role: "owner" });

  test("diary carousel: plain arrow buttons, no hover glide, cards clickable", async ({ page }) => {
    await page.goto("/dashboard");
    const scroller = page.locator(".diary-carousel-scroller");
    await scroller.waitFor();
    await page.locator("[data-diary-slide]").first().waitFor();

    // The arrows are the size of the circle you see, not full-height zones.
    const next = page.getByRole("button", { name: "Next appointments" });
    await expect(next).toBeVisible();
    const box = await next.boundingBox();
    expect(box && box.height <= 40 && box.width <= 40).toBeTruthy();

    // Hovering the edge of the row must not move it.
    const before = await scroller.evaluate((el) => el.scrollLeft);
    const rowBox = await scroller.boundingBox();
    if (rowBox) {
      await page.mouse.move(rowBox.x + rowBox.width - 10, rowBox.y + rowBox.height / 2);
      await page.waitForTimeout(900);
    }
    expect(await scroller.evaluate((el) => el.scrollLeft)).toBe(before);

    // Clicking the arrow pages; clicking a card's patient link opens the record.
    await next.click();
    await page.waitForTimeout(700);
    expect(await scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(before);

    const patientLink = page.locator("[data-diary-slide] a[href^='/patients/']").first();
    await patientLink.click();
    await expect(page).toHaveURL(/\/patients\/[^/]+/);
  });

  test("KPI cards name the clinic and agree with the retention page", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Total clients")).toBeVisible();
    await expect(
      page.getByText("Whole clinic · overdue or due in 30 days, nothing booked"),
    ).toBeVisible();
    await expect(page.getByText(/% vs last month/).first()).toBeVisible();

    // The retention KPI and the retention page read from the same source.
    const seen = /\d+ of \d+ seen in the last 12 months/;
    const kpiHint = (await page.getByText(seen).first().textContent())?.match(seen)?.[0];
    expect(kpiHint).toBeTruthy();
    await page.goto("/retention");
    await expect(page.getByText(seen).first()).toContainText(kpiHint ?? "");
  });

  test("retention: the period picker drives every card and the trend", async ({ page }) => {
    await page.goto("/retention");
    // Presets are rolling windows and every card names its window.
    await expect(page.getByRole("tab", { name: "12 months", selected: true })).toBeVisible();
    await expect(page.getByText("Monthly return rate in the last 12 months.")).toBeVisible();
    await expect(page.getByText(/repeat patients seen in the last 12 months/)).toBeVisible();

    await page.getByRole("tab", { name: "1 month" }).click();
    await expect(page.getByRole("tab", { name: "1 month", selected: true })).toBeVisible();
    await expect(page.getByText("Weekly return rate in the last month.")).toBeVisible();
    await expect(page.getByText(/repeat patients seen in the last month/)).toBeVisible();
    await expect(page.getByText(/whose last visit was in the last month/)).toBeVisible();

    // The trend card carries no picker of its own any more.
    await expect(page.getByRole("tab", { name: "5 years" })).toHaveCount(0);
  });

  test("insights: pipeline tiles open and highlight their detail", async ({ page }) => {
    await page.goto("/insights");
    const booked = page.getByRole("button", { name: "Booked: show details" });
    await booked.waitFor();
    await booked.click();
    const target = page.locator("#insights-waiting");
    await expect(target).toHaveClass(/focus-flash/);
    await expect(target).toBeInViewport();

    // Book tab tiles do the same.
    await page.goto("/insights?tab=book");
    await page.getByRole("button", { name: "Dormant: show details" }).click();
    await expect(page.locator("#book-status")).toHaveClass(/focus-flash/);
  });

  test("patient record: comms live on a Contact tab", async ({ page }) => {
    await page.goto("/patients?q=Bennett");
    await page.getByRole("link", { name: /Bennett, .*Olivia/ }).click();
    // Not above the tabs any more.
    await expect(page.getByRole("heading", { name: "Contact preferences" })).toHaveCount(0);
    await page.getByRole("tab", { name: "Contact" }).click();
    await expect(page.getByRole("heading", { name: "Contact preferences" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Email and text" })).toBeVisible();

    // ?chat=1 opens the floating chat window on this patient (the fixture hides
    // the dock to keep corners clear; show it for this check).
    const url = new URL(page.url());
    await page.goto(`${url.pathname}?chat=1`);
    await page.addStyleTag({ content: '[data-qc="floating-dock"] { display: flex !important; }' });
    await expect(page.locator('[data-qc="chat-window"]')).toBeVisible();
    await expect(page.locator('[data-qc="chat-window"] header')).toContainText("Olivia Bennett");
    await expect(page.locator("#patient-chat")).toHaveCount(0);

    await expect(page.getByRole("tab", { name: "Visit notes" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Upcoming appointments" })).toBeVisible();
  });

  test("journey card: steps counter, next step, plan kind and a bounded height", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    const consult = page.locator('[data-qc="journey-consult"]');
    await consult.scrollIntoViewIfNeeded();
    await expect(consult).toContainText("Not yet in treatment");
    await expect(consult).toContainText("steps done");
    await expect(consult).toContainText("Next:");
    await expect(consult.getByText("Win-back track")).toBeVisible();

    // Columns keep a consistent minimum height instead of stretching to the tallest.
    const heights = await Promise.all(
      (await page.locator('[data-qc^="journey-"]').all()).map(
        async (c) => (await c.boundingBox())?.height ?? 0,
      ),
    );
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(240);
  });

  test("owner dashboard: numbers, Attention summary, diary, journeys, then the lists; week strip; linked numbers", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.locator('[data-qc="attention-summary"]').waitFor();
    // Order of the sections for an owner.
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('[data-qc="attention-summary"], h2.section-title')].map(
        (e) => e.getAttribute("data-qc") ?? e.textContent?.trim() ?? "",
      ),
    );
    expect(order[0]).toBe("attention-summary");
    expect(order.findIndex((t) => t.startsWith("Active treatment journeys"))).toBeLessThan(
      order.findIndex((t) => t.startsWith("Attention needed")),
    );
    expect(order.findIndex((t) => t.startsWith("Attention needed"))).toBeLessThan(
      order.findIndex((t) => t.startsWith("My tasks")),
    );
    await expect(page.locator('[data-qc="attention-summary"]')).toContainText(
      /\d+ urgent · \d+ this week/,
    );

    // The deposit rule reads the lead days from Settings (3 in the demo).
    await expect(page.locator('[data-qc="attention-deposit-rule"]')).toContainText(
      "at least 3 days before the appointment",
    );

    // Chips link to their lists; the overdue-steps chip opens the board on at-risk cards.
    await expect(page.locator('a[data-qc="kpi-chip-treatments-overdue"]')).toHaveAttribute(
      "href",
      /view=due/,
    );
    await expect(page.locator('a[data-qc="kpi-chip-patients-to-chase"]')).toHaveAttribute(
      "href",
      "/retention",
    );
    await expect(page.locator('a[data-qc="kpi-chip-plans-overdue"]')).toHaveAttribute(
      "href",
      /tab=board.*risk/,
    );
    // Journey cards deep-link to the record's plan card.
    await expect(page.locator('[data-qc="plan-link"]').first()).toHaveAttribute(
      "href",
      /\/patients\/[^?]+\?tab=treatments#plan/,
    );
    // Tasks carry a due date and an assignee.
    await expect(page.locator('[data-qc="task-meta"]').first()).toBeVisible();

    // Week view: the summary strip sits above the cards.
    await page.getByRole("button", { name: "week" }).click();
    const strip = page.locator('[data-qc="week-summary"]');
    await expect(strip).toBeVisible();
    await expect(strip).toContainText("Bookings this week");
    await expect(strip).toContainText("Booked value");
    await expect(strip.locator('[data-qc="week-fullness"]').first()).toBeVisible();
    await page.getByRole("button", { name: "day" }).click();
  });

  test("performance: one period, both series, retail share and What sold; the trend hint names the window", async ({
    page,
  }) => {
    await page.goto("/performance");
    await expect(page.getByRole("heading", { level: 1, name: "Performance" })).toBeVisible();
    // The trend section no longer carries its own period pills.
    await expect(page.getByRole("tablist", { name: "Trend period" })).toHaveCount(0);
    await expect(page.locator('[data-qc="trends-hint"]')).toContainText("in the last 12 months");
    await page.getByRole("tab", { name: "1 month" }).click();
    await expect(page.locator('[data-qc="trends-hint"]')).toContainText("in the last month");
    // Both series are drawn on the earnings chart.
    const earnings = page.locator(".recharts-wrapper").first();
    await expect(earnings.locator(".recharts-area-area")).toHaveCount(1);
    await expect(earnings.locator(".recharts-line-curve")).toHaveCount(1);
    // Retail's share and What sold live here now.
    await expect(page.locator('[data-qc="performance-retail-share"]')).toContainText(
      /Retail £[\d,]+ \(\d+(\.\d+)?% of/,
    );
    await expect(page.locator('[data-qc="performance-what-sold"]')).toContainText(
      "ranked by revenue",
    );
    await expect(page.locator('[data-qc="performance-table"]')).toHaveAttribute(
      "data-money",
      "shown",
    );
  });

  test("my profile: tabs above the heading, registration dropdown and expiry fields, earnings summary", async ({
    page,
  }) => {
    await page.goto("/profile");
    const tabs = page.getByRole("tablist", { name: "My profile sections" });
    await expect(tabs.getByRole("tab", { name: "Profile" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.locator('[data-qc="registration-body"] option')).toHaveCount(7);
    await expect(page.getByLabel("Registration expiry")).toBeVisible();
    await expect(page.getByLabel("Insurance provider")).toBeVisible();
    await expect(page.getByLabel("Qualifications")).toBeVisible();
    // The performance block is a one-line summary that points at My earnings.
    await expect(page.locator('[data-qc="profile-earnings-summary"]')).toContainText(
      "Your share, last month",
    );
    await expect(page.locator('[data-qc="see-my-earnings"]')).toHaveAttribute("href", "/earnings");
    await tabs.getByRole("tab", { name: "Security" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Security" })).toBeVisible();
    await tabs.getByRole("tab", { name: "Documents" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Documents" })).toBeVisible();
  });

  test("diary notes on upcoming appointments read as the pre-read", async ({ page }) => {
    await page.goto("/dashboard");
    const pre = page.getByRole("button", { name: "Open pre-appointment note" }).first();
    await pre.waitFor();
    await pre.hover();
    await expect(page.getByText("Pre-appointment note").first()).toBeVisible();
    await expect(page.getByText("To consider before treating")).toBeVisible();
    // Notes on visits under way keep the visit-note wording.
    expect(await page.getByRole("button", { name: "Open visit note" }).count()).toBeGreaterThan(0);
  });
});

test.describe("as a practitioner", () => {
  test.use({ role: "practitioner" });

  test("My earnings reads in share terms with rate, payout status and export", async ({ page }) => {
    await page.goto("/earnings");
    await expect(page.getByRole("heading", { level: 1, name: "My earnings" })).toBeVisible();
    await expect(page.getByText("Your share", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Earned", { exact: true })).toHaveCount(0);
    await expect(page.locator('[data-qc="earnings-rate"]')).toContainText(/your rate is \d+%/);
    await expect(page.locator('[data-qc="payout-summary"]')).toContainText(
      /\d+ paid · \d+ pending/,
    );
    await expect(page.locator('[data-qc="earnings-export-csv"]')).toBeEnabled();
    await expect(page.locator('[data-qc="earnings-print"]')).toBeVisible();
    // Every card in the two rows carries its own icon.
    expect(await page.locator(".glass-card svg.lucide").count()).toBeGreaterThanOrEqual(8);
  });

  test("KPI cards are scoped to their own book and say so", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Your clients")).toBeVisible();
    await expect(page.getByText(/Clinic total \d+/)).toBeVisible();
    await expect(
      page.getByText("Your patients · overdue or due in 30 days, nothing booked"),
    ).toBeVisible();

    // Their retention numbers match their own retention page.
    const seen = /\d+ of \d+ seen in the last 12 months/;
    const kpiHint = (await page.getByText(seen).first().textContent())?.match(seen)?.[0];
    expect(kpiHint).toBeTruthy();
    await page.goto("/retention");
    await expect(page.getByText(seen).first()).toContainText(kpiHint ?? "");
  });
});

test.describe("pause requests", () => {
  test("carry a Contact button that opens the patient's chat", async ({
    page,
    context,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8091";
    // Raise a request as the patient if none is waiting.
    await context.addCookies([{ name: "demo_role", value: "patient", url: base }]);
    await page.goto("/my-record/plan/timeline");
    const pause = page.locator('[data-qc="pause-plan"]');
    await pause.waitFor();
    if ((await pause.textContent())?.includes("Pause plan")) {
      await pause.click();
      await page.locator('[data-qc="pause-reason"]').selectOption("Going on holiday");
      await page.locator('[data-qc="pause-submit"]').click();
      await expect(page.getByText(/Pause request sent/i)).toBeVisible();
    }

    await context.addCookies([{ name: "demo_role", value: "owner", url: base }]);
    await page.goto("/dashboard");
    const card = page.locator('[data-qc="pause-requests"]');
    await card.waitFor();
    await expect(card.getByRole("button", { name: "Approve pause" }).first()).toBeVisible();
    await card.getByRole("link", { name: "Contact" }).first().click();
    await expect(page).toHaveURL(/\/patients\/[^/]+\?chat=/);
    await page.addStyleTag({ content: '[data-qc="floating-dock"] { display: flex !important; }' });
    await expect(page.locator('[data-qc="chat-window"]')).toBeVisible();

    // Decline it so the plan is not left with an open request for later specs.
    await page.goto("/dashboard");
    await card.waitFor();
    await card.getByRole("button", { name: "Decline" }).first().click();
    await expect(page.getByText("Request declined")).toBeVisible();
  });
});
