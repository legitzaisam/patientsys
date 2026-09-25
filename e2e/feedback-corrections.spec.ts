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
    await expect(page.getByText("Whole clinic · next 30 days")).toBeVisible();
    await expect(page.getByText(/% vs last month/)).toBeVisible();

    // The retention KPI and the retention page read from the same source.
    const kpiHint = (await page.getByText(/of \d+ seen in 12 months/).first().textContent())?.trim();
    await page.goto("/retention");
    await expect(page.getByText(/of \d+ seen in 12 months/).first()).toHaveText(kpiHint ?? "");
  });

  test("retention: the period picker drives every card and the trend", async ({ page }) => {
    await page.goto("/retention");
    await expect(page.getByRole("tab", { name: "This year", selected: true })).toBeVisible();
    await expect(page.getByText("Monthly return rate, this year.")).toBeVisible();
    await expect(page.getByText(/repeat patients seen this year/)).toBeVisible();

    await page.getByRole("tab", { name: "This month" }).click();
    await expect(page.getByText("Weekly return rate, this month.")).toBeVisible();
    await expect(page.getByText(/repeat patients seen this month/)).toBeVisible();
    await expect(page.getByText(/Patients who lapsed this month/)).toBeVisible();

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

    // ?chat=1 opens the docked chat with the composer focused.
    const url = new URL(page.url());
    await page.goto(`${url.pathname}?chat=1`);
    await expect(page.locator("#patient-chat")).toBeVisible();
    await expect(page.locator("#patient-chat textarea")).toBeFocused();

    await expect(page.getByRole("tab", { name: "Visit notes" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Upcoming appointments" })).toBeVisible();
  });

  test("journey card: steps counter, next step, plan kind and a bounded height", async ({ page }) => {
    await page.goto("/dashboard");
    const consult = page.locator('[data-qc="journey-consult"]');
    await consult.scrollIntoViewIfNeeded();
    await expect(consult).toContainText("Not yet in treatment");
    await expect(consult).toContainText("steps done");
    await expect(consult).toContainText("Next:");
    await expect(consult.getByText("Win-back track")).toBeVisible();

    // Columns keep a consistent minimum height instead of stretching to the tallest.
    const heights = await Promise.all(
      (await page.locator('[data-qc^="journey-"]').all()).map(async (c) => (await c.boundingBox())?.height ?? 0),
    );
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(240);
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

  test("KPI cards are scoped to their own book and say so", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Your clients")).toBeVisible();
    await expect(page.getByText(/Clinic total \d+/)).toBeVisible();
    await expect(page.getByText("Your patients · next 30 days")).toBeVisible();

    // Their retention numbers match their own retention page.
    const kpiHint = (await page.getByText(/of \d+ seen in 12 months/).first().textContent())?.trim();
    await page.goto("/retention");
    await expect(page.getByText(/of \d+ seen in 12 months/).first()).toHaveText(kpiHint ?? "");
  });
});

test.describe("pause requests", () => {
  test("carry a Contact button that opens the patient's chat", async ({ page, context, baseURL }) => {
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
    await expect(page.locator("#patient-chat textarea")).toBeFocused();

    // Decline it so the plan is not left with an open request for later specs.
    await page.goto("/dashboard");
    await card.waitFor();
    await card.getByRole("button", { name: "Decline" }).first().click();
    await expect(page.getByText("Request declined")).toBeVisible();
  });
});
