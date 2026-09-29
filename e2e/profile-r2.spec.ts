import { expect, test, type Page } from "./fixtures";

/**
 * Profile review round 2: the themed pickers, the earnings tab order, the
 * working-pattern approval flow (staff propose, owner / manager decide, the
 * dashboard lists what is waiting), raising a colleague's invoice, and the
 * invoice that prints on its own. Demo server, real clock.
 */

const NADIA = "10000000-0000-4000-8000-000000000002";
const TOM = "10000000-0000-4000-8000-000000000003";

async function openSchedule(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator('[data-qc="working-pattern"]')).toBeVisible();
}

test.describe("pickers", () => {
  test("the time field types, normalises and picks from the glass popover", async ({ page }) => {
    await openSchedule(page, `/team/${NADIA}?tab=schedule`);
    await page.locator('[data-qc="pattern-edit"]').click();
    const start = page.locator('[data-qc="pattern-start-0"]');
    await start.fill("930");
    await start.press("Enter");
    await expect(start).toHaveValue("09:30");
    await start.fill("99:99");
    await start.press("Tab");
    await expect(start).toHaveAttribute("aria-invalid", "true");
    await start.fill("09:00");
    await start.press("Enter");

    await page.locator('[data-qc="pattern-end-3-open"]').click();
    const picker = page.locator('[data-qc="time-picker"]');
    await expect(picker).toBeVisible();
    await picker.locator('[data-qc="time-hour-17"]').click();
    await expect(page.locator('[data-qc="pattern-end-3"]')).toHaveValue("17:00");
    await picker.locator('[data-qc="time-minute-30"]').click();
    await expect(picker).toBeHidden();
    await expect(page.locator('[data-qc="pattern-end-3"]')).toHaveValue("17:30");
  });

  test("the date field on I've renewed opens a Monday-first calendar", async ({ page }) => {
    await page
      .context()
      .addCookies([{ name: "demo_role", value: "practitioner", url: "http://localhost:8091" }]);
    await page.goto("/profile");
    await page.locator('[data-qc="registration-renewed"]').click();
    const field = page.locator('[data-qc="registration-renew-date"]');
    await field.fill("2027-11-13");
    await field.press("Enter");
    await expect(field).toHaveValue("13/11/2027");
    await page.locator('[data-qc="registration-renew-date-open"]').click();
    const cal = page.locator('[data-qc="date-picker"]');
    await expect(cal).toBeVisible();
    await expect(cal.getByText("November 2027")).toBeVisible();
    await expect(cal.locator("th").first()).toHaveText("Mo");
    await cal.locator('button[data-day="2027-11-20"]').click();
    await expect(cal).toBeHidden();
    await expect(field).toHaveValue("20/11/2027");
  });
});

test.describe("earnings tab", () => {
  test.use({ role: "practitioner" });

  test("the people tiles sit above Daily earnings, and Download PDF prints only the invoice", async ({
    page,
  }) => {
    await page.goto("/profile?tab=earnings");
    await expect(page.locator('[data-qc="earnings-row"]').first()).toBeVisible();
    const order = await page
      .locator('[data-qc="profile-earnings-tab"] > *')
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-qc")));
    expect(order.indexOf("earnings-tiles")).toBeGreaterThan(-1);
    expect(order.indexOf("earnings-tiles")).toBeLessThan(order.indexOf("earnings-daily"));
    expect(order.indexOf("earnings-daily")).toBeLessThan(order.indexOf("earnings-table"));

    await page.locator('[data-qc="earnings-invoice"]').click();
    const dialog = page.locator('[data-qc="invoice-dialog"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-qc="invoice-number"]')).toHaveText(/^INV-NR-\d{4}-\d{2}$/);
    await expect(dialog.locator('[data-qc="invoice-issued"]')).toHaveText(/\d{1,2} \w{3} \d{4}/);
    await expect(dialog.locator('[data-qc="invoice-total"]')).toContainText("£");

    await page.evaluate(() => {
      (window as unknown as { __printed: number }).__printed = 0;
      window.print = () => {
        (window as unknown as { __printed: number }).__printed += 1;
      };
    });
    const number = (await dialog.locator('[data-qc="invoice-number"]').textContent())?.trim();
    await dialog.locator('[data-qc="invoice-download"]').first().click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __printed: number }).__printed))
      .toBe(1);
    await expect(page.locator("body")).toHaveAttribute("data-printing", "invoice");
    await expect(page).toHaveTitle(number!);

    await page.emulateMedia({ media: "print" });
    const visible = await page.evaluate(() => {
      const shown = (el: Element) => getComputedStyle(el).display !== "none";
      const sheet = document.querySelector("[data-print-sheet]");
      return {
        sheet: sheet ? shown(sheet) : null,
        others: [...document.body.children].filter((el) => el !== sheet && shown(el)).length,
      };
    });
    expect(visible).toEqual({ sheet: true, others: 0 });
    await page.emulateMedia({ media: "screen" });
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect(page.locator("body")).not.toHaveAttribute("data-printing", /.+/);
  });
});

test.describe("working-pattern approval", () => {
  test("a practitioner proposes hours, the owner sees the request and approves it", async ({
    page,
    context,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8091";

    await context.addCookies([{ name: "demo_role", value: "practitioner", url: base }]);
    await openSchedule(page, "/profile?tab=schedule");
    await page.locator('[data-qc="pattern-request-change"]').click();
    const send = page.locator('[data-qc="pattern-request-send"]');
    await expect(send).toBeDisabled();
    const thu = page.locator('[data-qc="pattern-end-3"]');
    await thu.fill("17:00");
    await thu.press("Enter");
    await page.locator('[data-qc="pattern-note"]').fill("Earlier Thursdays from November");
    await send.click();
    const pending = page.locator('[data-qc="pattern-pending"]');
    await expect(pending).toContainText("awaiting your manager");
    await expect(pending.locator('[data-qc="pattern-change-row"]')).toHaveCount(1);
    await expect(pending.locator('[data-qc="pattern-change-row"]')).toContainText("Thu");
    await expect(page.locator('[data-qc="pattern-change-requested"]')).toBeVisible();
    await expect(page.locator('[data-qc="pattern-request-row"]')).toContainText("Working pattern");
    // The bars still show today's hours until someone approves.
    await expect(page.locator('[data-qc="pattern-row"]').nth(3)).toContainText("12:00–20:00");

    // No approval chip on the practitioner's own dashboard.
    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="attention-kind-staff_request"]')).toHaveCount(0);

    // The owner's dashboard lists it, and the row leads to the Schedule tab.
    await context.addCookies([{ name: "demo_role", value: "owner", url: base }]);
    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    const chip = page.locator('[data-qc="attention-kind-staff_request"]');
    await expect(chip).toHaveText("Requests to approve");
    await chip.click();
    const rows = page.locator('[data-qc="attention-staff-request"]');
    await expect(rows.filter({ hasText: "Dr Nadia Rahman" }).first()).toBeVisible();
    await expect(rows.filter({ hasText: "Dr Tom Whitfield" })).toHaveCount(1);
    await rows
      .filter({ hasText: /Dr Nadia Rahman.*Thu/ })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/team/${NADIA}\\?tab=schedule`));

    const proposal = page.locator('[data-qc="pattern-proposal"]');
    await expect(proposal).toContainText("Proposed change from Nadia");
    await expect(proposal.locator('[data-qc="pattern-request-note"]')).toContainText(
      "Earlier Thursdays",
    );
    await proposal.locator('[data-qc="pattern-approve"]').click();
    await expect(proposal).toBeHidden();
    await expect(page.locator('[data-qc="pattern-row"]').nth(3)).toContainText("12:00–17:00");

    // Back as the practitioner: applied, and a fresh request can be withdrawn.
    await context.addCookies([{ name: "demo_role", value: "practitioner", url: base }]);
    await openSchedule(page, "/profile?tab=schedule");
    await expect(page.locator('[data-qc="pattern-row"]').nth(3)).toContainText("12:00–17:00");
    await page.locator('[data-qc="pattern-request-change"]').click();
    await page.locator('[data-qc="pattern-toggle-1"]').click();
    await page.locator('[data-qc="pattern-request-send"]').click();
    await expect(page.locator('[data-qc="pattern-pending"]')).toBeVisible();
    await page.locator('[data-qc="pattern-request-withdraw"]').click();
    await expect(page.locator('[data-qc="pattern-pending"]')).toBeHidden();
    await expect(page.locator('[data-qc="pattern-request-change"]')).toBeVisible();

    // Put Thursday back to the fixture's 12:00–20:00 so the other specs see the
    // hours they expect (the demo is one shared in-memory clinic).
    await context.addCookies([{ name: "demo_role", value: "owner", url: base }]);
    await openSchedule(page, `/team/${NADIA}?tab=schedule`);
    await page.locator('[data-qc="pattern-edit"]').click();
    const restore = page.locator('[data-qc="pattern-end-3"]');
    await restore.fill("20:00");
    await restore.press("Enter");
    await page.locator('[data-qc="pattern-save"]').click();
    await expect(page.locator('[data-qc="pattern-row"]').nth(3)).toContainText("12:00–20:00");
  });

  test("the owner declines Tom's fixture request with a reason", async ({ page }) => {
    await openSchedule(page, `/team/${TOM}?tab=schedule`);
    const proposal = page.locator('[data-qc="pattern-proposal"]');
    await expect(proposal).toContainText("Proposed change from Tom");
    await expect(proposal.locator('[data-qc="pattern-change-row"]')).toHaveCount(2);
    await proposal.locator('[data-qc="pattern-decline"]').click();
    await page
      .locator('[data-qc="pattern-decline-note"]')
      .fill("Saturdays covered until December.");
    await page.locator('[data-qc="pattern-decline-confirm"]').click();
    await expect(proposal).toBeHidden();
    await expect(page.locator('[data-qc="pattern-row"]').nth(5)).toContainText("09:00–14:00");
  });

  test("a manager's own change needs the owner", async ({ page, context, baseURL }) => {
    const base = baseURL ?? "http://localhost:8091";
    await context.addCookies([{ name: "demo_role", value: "manager", url: base }]);
    await openSchedule(page, "/profile?tab=schedule");
    await page.locator('[data-qc="pattern-request-change"]').click();
    await page.locator('[data-qc="pattern-toggle-4"]').click();
    await page.locator('[data-qc="pattern-request-send"]').click();
    await expect(page.locator('[data-qc="pattern-pending"]')).toContainText(
      "awaiting the clinic owner",
    );
    await page.locator('[data-qc="pattern-request-withdraw"]').click();
    await expect(page.locator('[data-qc="pattern-pending"]')).toBeHidden();
  });

  test("the front desk sees none of it", async ({ page, context, baseURL }) => {
    const base = baseURL ?? "http://localhost:8091";
    await context.addCookies([{ name: "demo_role", value: "front_desk", url: base }]);
    await page.goto(`/team/${NADIA}`);
    await expect(page.locator('[data-qc="profile-page-frontdesk"]')).toBeVisible();
    await expect(page.locator('[data-qc="working-pattern"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="hero-invoice"]')).toHaveCount(0);
    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="attention-kind-staff_request"]')).toHaveCount(0);
  });
});

test.describe("invoice on behalf", () => {
  test("the owner raises Nadia's invoice from the Month-so-far card", async ({ page }) => {
    await page.goto(`/team/${NADIA}`);
    await expect(page.locator('[data-qc="profile-page-manage"]')).toBeVisible();
    await expect(page.locator('[data-qc="hero-invoice"]')).toBeVisible();
    const button = page.locator('[data-qc="month-invoice"]');
    await expect(button).toContainText(/Create \w+ invoice/);
    await button.click();
    const dialog = page.locator('[data-qc="invoice-dialog"]');
    await expect(dialog).toContainText("Built from Nadia’s completed treatments.");
    await expect(dialog.locator('[data-qc="invoice-from"]')).toHaveText("Dr Nadia Rahman");
    await expect(dialog.locator('[data-qc="invoice-number"]')).toHaveText(/^INV-NR-/);
    await dialog.locator('[data-qc="invoice-schedule"]').click();
    await expect(dialog.locator('[data-qc="invoice-done"]')).toContainText("Nadia has been told");
    await dialog.locator('[data-qc="invoice-done-close"]').click();
    await page.locator('[data-qc="profile-tab-earnings"]').click();
    await expect(page.locator('[data-qc="earnings-month-note"]')).toBeVisible();
    await expect(page.locator('[data-qc="earnings-invoice"]')).toBeVisible();
  });
});
