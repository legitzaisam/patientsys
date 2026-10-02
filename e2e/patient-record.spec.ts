import type { Locator, Page } from "@playwright/test";
import { expect, test } from "./fixtures";

/**
 * The redesigned patient record (Overview, Treatments, From the patient,
 * Medical history) on Grace Adeyemi, the hand-off's example patient: the
 * layout promises first, then every link, button and deep link. Specs that
 * write (tick a task, review a check-in, accept an update, edit a step, book a
 * step) run last so the read-only checks see the fixtures as seeded.
 */

test.use({ role: "owner" });

const GRACE = /Adeyemi, .*Grace/;

async function graceHref(page: Page) {
  await page.goto("/patients?q=Adeyemi");
  const href = await page
    .locator('[data-qc="records-name"]', { hasText: GRACE })
    .first()
    .getAttribute("href");
  if (!href) throw new Error("Grace Adeyemi's record link not found");
  return href;
}

async function openGrace(page: Page, search = "") {
  const href = await graceHref(page);
  await page.goto(`${href}${search}`);
  await expect(page.getByRole("heading", { level: 1, name: /Grace Adeyemi/ })).toBeVisible();
  return href;
}

const tab = (page: Page, name: RegExp) => page.getByRole("tab", { name });

async function expectTab(page: Page, name: RegExp) {
  await expect(tab(page, name)).toHaveAttribute("aria-selected", "true");
}

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("element has no box");
  return b;
}

/* ------------------------------------------------------------------ */
/* Alignment                                                           */
/* ------------------------------------------------------------------ */

test.describe("alignment", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the four Overview cards share a height per row and pin their footers", async ({ page }) => {
    await openGrace(page);
    const cards = [
      page.locator('[data-qc="skin-plan-card"]'),
      page.locator('[data-qc="upcoming-card"]'),
      page.locator('[data-qc="patient-tasks"]'),
      page.locator('[data-qc="latest-journal-card"]'),
    ];
    for (const card of cards) await expect(card).toBeVisible();
    const boxes = await Promise.all(cards.map(box));
    // Two by two: rows 0-1 and 2-3 line up and match in height.
    expect(Math.abs(boxes[0]!.y - boxes[1]!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[2]!.y - boxes[3]!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[0]!.height - boxes[1]!.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(boxes[2]!.height - boxes[3]!.height)).toBeLessThanOrEqual(1);
    expect(boxes[0]!.x).toBeLessThan(boxes[1]!.x);
    // Each footer sits on the card's bottom edge (16px padding), not under the body.
    for (const [i, card] of cards.entries()) {
      const footer = card.locator("footer");
      await expect(footer).toBeVisible();
      const f = await box(footer);
      const gap = boxes[i]!.y + boxes[i]!.height - (f.y + f.height);
      expect(gap).toBeGreaterThanOrEqual(12);
      expect(gap).toBeLessThanOrEqual(20);
    }
  });

  test("readiness links are text only and the whole row is the target", async ({ page }) => {
    await openGrace(page);
    const rows = page.locator('[data-qc="readiness-item"]');
    await expect(rows.first()).toBeVisible();
    const links = page.locator('[data-qc="readiness-item"] span.font-medium.text-accent-ink');
    const n = await links.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const style = await links.nth(i).evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          bg: s.backgroundColor,
          border: s.borderTopWidth,
          decoration: s.textDecorationLine,
        };
      });
      expect(style.bg).toBe("rgba(0, 0, 0, 0)");
      expect(style.border).toBe("0px");
      expect(style.decoration).not.toContain("underline");
    }
    // The clickable rows are buttons in their own right.
    await expect(
      page.locator('[data-qc="readiness-item"][data-kind="checkin"][role="button"]'),
    ).toHaveCount(1);
  });

  test("badges show only above zero", async ({ page }) => {
    await openGrace(page);
    // Grace has three bookings to chase, one flagged check-in and one pending update.
    await expect(page.locator('[data-qc="treatments-badge"]')).toHaveText(/^\d+$/);
    await expect(page.locator('[data-qc="portal-badge"]')).toHaveText("1");
    await expect(page.locator('[data-qc="history-badge"]')).toHaveText("1");
    // A badge never reads "0": at zero it is not rendered (the writes below
    // watch each one disappear as its count drops).
    await expect(page.locator('[data-qc$="-badge"]', { hasText: /^0$/ })).toHaveCount(0);
    await page.goto("/patients?q=Bennett");
    const href = await page
      .locator('[data-qc="records-name"]', { hasText: /Bennett, .*Olivia/ })
      .first()
      .getAttribute("href");
    await page.goto(href!);
    await expect(page.getByRole("heading", { level: 1, name: /Olivia Bennett/ })).toBeVisible();
    await expect(page.locator('[data-qc$="-badge"]', { hasText: /^0$/ })).toHaveCount(0);
  });
});

for (const device of [
  { name: "iPad Pro landscape", viewport: { width: 1194, height: 834 } },
  { name: "iPad Mini portrait", viewport: { width: 768, height: 1024 } },
]) {
  test.describe(`no horizontal overflow on ${device.name}`, () => {
    test.use({ viewport: device.viewport, hasTouch: true, isMobile: true });

    test("every redesigned tab fits the viewport", async ({ page }) => {
      const href = await openGrace(page);
      for (const t of ["overview", "treatments", "portal", "history"]) {
        await page.goto(`${href}?tab=${t}`);
        await expect(page.getByRole("heading", { level: 1, name: /Grace Adeyemi/ })).toBeVisible();
        await page.waitForTimeout(400);
        const overflow = await page.evaluate(() => {
          const main = document.getElementById("app-main-scroll");
          return {
            doc: document.documentElement.scrollWidth - window.innerWidth,
            main: main ? main.scrollWidth - main.clientWidth : 0,
          };
        });
        expect(overflow.doc, `${t}: document overflow`).toBeLessThanOrEqual(0);
        expect(overflow.main, `${t}: main overflow`).toBeLessThanOrEqual(0);
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

test.describe("navigation", () => {
  test("opens on Overview, keeps the tab in the address and comes back to it", async ({ page }) => {
    const href = await openGrace(page);
    await expectTab(page, /^Overview/);
    await expect(page).not.toHaveURL(/tab=/);

    await tab(page, /^Medical history/).click();
    await expectTab(page, /^Medical history/);
    await expect(page).toHaveURL(/tab=history/);
    await page.reload();
    await expectTab(page, /^Medical history/);

    // Leaving and coming back lands on the same tab.
    await page.goto("/tasks");
    await expect(page.locator('[data-qc="tasks-main"]')).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${href}\\?tab=history`));
    await expectTab(page, /^Medical history/);

    // Overview is the default, so it is written without a tab.
    await tab(page, /^Overview/).click();
    await expect(page).not.toHaveURL(/tab=/);
  });

  test("deep links: chase=1, #plan, tab=photos and tab=contact", async ({ page }) => {
    const href = await openGrace(page, "?tab=overview&chase=1");
    await expectTab(page, /^Overview/);
    await expect(page.locator('[data-qc="upcoming-card"]')).toContainText(
      "These visits still need chasing",
    );
    // The card is scrolled to the top of the pane once the plan has landed.
    await expect
      .poll(async () => (await box(page.locator('[data-qc="upcoming-card"]'))).y, {
        timeout: 8_000,
      })
      .toBeLessThan(200);

    await page.goto(`${href}#plan`);
    await expectTab(page, /^Treatments/);
    await expect(page.locator('[data-qc="treatment-plan-card"]')).toBeVisible();

    await page.goto(`${href}?tab=photos`);
    await expectTab(page, /^Before and after/);
    await page.goto(`${href}?tab=contact`);
    await expectTab(page, /^Contact/);
    await expect(page.getByRole("heading", { name: "Contact preferences" })).toBeVisible();
  });
});

/* ------------------------------------------------------------------ */
/* Overview                                                            */
/* ------------------------------------------------------------------ */

test.describe("overview", () => {
  test("Review rows open From the patient and Medical history", async ({ page }) => {
    await openGrace(page);
    await page.locator('[data-qc="readiness-item"][data-kind="checkin"]').click();
    await expectTab(page, /^From the patient/);
    await expect(page).toHaveURL(/tab=portal/);
    await expect(page.locator('[data-qc="urgent-checkins"]')).toBeVisible();

    await tab(page, /^Overview/).click();
    await page.locator('[data-qc="readiness-item"][data-kind="history"]').click();
    await expectTab(page, /^Medical history/);
    await expect(page.locator('[data-qc="patient-updates"]')).toBeVisible();
  });

  test("Take payment opens the payment chip on today's visit", async ({ page }) => {
    await openGrace(page);
    const row = page.locator('[data-qc="readiness-item"][data-kind="payment"]');
    await expect(row).toContainText("Balance");
    await row.getByRole("button", { name: "Take payment" }).hover();
    const card = page.locator('[data-qc="payment-card"]');
    await expect(card).toBeVisible();
    await expect(card).toContainText("Deposit");
    await expect(card).toContainText("Full amount");
    await expect(card.getByRole("button", { name: /Email/ })).toBeVisible();
  });

  test("Continue treatment form opens the form for today's visit", async ({ page }) => {
    await openGrace(page);
    await page.locator('[data-qc="open-treatment-form"]').click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/Microneedling with PRP/);
    await expect(dialog).toContainText(/Grace Adeyemi/);
    await page.keyboard.press("Escape");
  });

  test("the Upcoming card marks only bookings no plan step claims", async ({ page }) => {
    await openGrace(page);
    const rows = page.locator('[data-qc="booking-chase-item"], [data-qc="upcoming-row"]');
    const n = await rows.count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) {
      const row = rows.nth(i);
      const onPlan = (await row.getAttribute("data-on-plan")) === "true";
      await expect(row.getByText("Not on skin plan")).toHaveCount(onPlan ? 0 : 1);
    }
    await expect(page.locator('[data-qc="upcoming-open-diary"]')).toHaveAttribute(
      "href",
      "/schedule",
    );
    await expect(page.locator('[data-qc="patient-tasks-open"]')).toHaveAttribute("href", "/tasks");
  });

  test("Send consent forms opens the sender on a consent form for the visit", async ({ page }) => {
    await openGrace(page);
    await page.locator('[data-qc="upcoming-send-consent"]').click();
    const dialog = page.getByRole("dialog", { name: "Send to patient" });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#kind")).toHaveValue("consent");
    await expect(dialog.locator("#title")).toHaveValue(/consent form$/);
    await page.keyboard.press("Escape");
  });

  test("Open roadmap, All entries and Reply in chat go where they say", async ({ page }) => {
    await openGrace(page);
    await page.locator('[data-qc="skin-plan-roadmap"]').click();
    await expectTab(page, /^Treatments/);
    await expect(page.locator('[data-qc="step-details"]')).toBeVisible();

    await tab(page, /^Overview/).click();
    await page.locator('[data-qc="journal-all"]').click();
    await expectTab(page, /^From the patient/);
    await expect(page.locator('[data-qc="journal-list"]')).toBeVisible();

    await tab(page, /^Overview/).click();
    await page.addStyleTag({ content: '[data-qc="floating-dock"] { display: flex !important; }' });
    await page.locator('[data-qc="journal-reply"]').click();
    await expect(page.locator('[data-qc="chat-window"]')).toBeVisible();
    await expect(page.locator('[data-qc="chat-window"] header')).toContainText(
      "Private messages with this patient",
    );
  });
});

/* ------------------------------------------------------------------ */
/* Treatments                                                          */
/* ------------------------------------------------------------------ */

test.describe("treatments", () => {
  test("the roadmap shows every step, the current one selected, and clicking a row opens it", async ({
    page,
  }) => {
    await openGrace(page, "?tab=treatments");
    const plan = page.locator('[data-qc="treatment-plan-card"]');
    await expect(plan).toBeVisible();
    await expect(plan.locator('[data-qc="plan-progress"]')).toHaveText(/^\d+ of \d+ milestones$/);
    const [done, total] = (await plan.locator('[data-qc="plan-progress"]').innerText())
      .match(/\d+/g)!
      .map(Number);
    await expect(plan.locator('[data-qc="roadmap-step"], [data-qc="plan-step"]')).toHaveCount(
      total!,
    );
    await expect(plan.locator('[data-status="done"], [data-status="skipped"]')).toHaveCount(done!);

    // The current step opens in Step details by default, Not booked in pink.
    const current = plan.locator('[data-qc="plan-step"]');
    await expect(current).toHaveAttribute("aria-pressed", "true");
    await expect(current).toContainText("Not booked");
    await expect(current).toContainText("In progress");
    const details = page.locator('[data-qc="step-details"]');
    await expect(details).toContainText(
      await current.locator(".font-semibold").first().innerText(),
    );
    await expect(details.locator('[data-qc="step-booked-for"]')).toHaveAttribute(
      "data-booked",
      "false",
    );
    await expect(details.locator('[data-qc="step-booked-for"]')).toContainText("Not booked");
    await expect(details.locator('[data-qc="plan-book"]')).toBeVisible();

    // Clicking a finished step swaps the panel and drops the Book button.
    const first = plan.locator('[data-qc="roadmap-step"][data-status="done"]').first();
    await first.click();
    await expect(first).toHaveAttribute("aria-pressed", "true");
    await expect(details).toContainText(await first.locator(".font-semibold").first().innerText());
    await expect(details).toContainText("Completed");
    await expect(details.locator('[data-qc="plan-book"]')).toHaveCount(0);
  });

  test("treatment history filters and View record", async ({ page }) => {
    await openGrace(page, "?tab=treatments");
    const history = page.locator('[data-qc="treatment-history"]');
    const all = await history.locator('[data-qc="history-row"]').count();
    expect(all).toBeGreaterThan(1);
    await expect(history.locator('[data-qc="history-row"]').first()).toContainText("✓ Consent");

    await history.locator('[data-qc="history-filter"][data-value="prp"]').click();
    const prp = history.locator('[data-qc="history-row"]');
    expect(await prp.count()).toBeLessThan(all);
    for (const t of await prp.allInnerTexts()) expect(t).toMatch(/PRP/);

    await history.locator('[data-qc="history-filter"][data-value="missing"]').click();
    await expect(history.locator('[data-qc="history-row"]').first()).toContainText(
      "Depth not recorded",
    );

    await history.locator('[data-qc="history-filter"][data-value="all"]').click();
    await expect(history.locator('[data-qc="history-row"]')).toHaveCount(all);
    await history.locator('[data-qc="view-treatment-record"]').first().click();
    await expect(page.locator('[data-qc="treatment-record-body"]')).toBeVisible();
    await page.keyboard.press("Escape");
  });
});

/* ------------------------------------------------------------------ */
/* Writes: each leaves the fixtures as it found them where it can     */
/* ------------------------------------------------------------------ */

test.describe("writes", () => {
  test("ticking a task closes it with Undo", async ({ page }) => {
    await openGrace(page);
    const panel = page.locator('[data-qc="patient-tasks"]');
    const before = Number(await panel.getAttribute("data-open"));
    expect(before).toBeGreaterThan(0);
    const row = panel.locator('[data-qc="patient-task"][data-status="open"]').first();
    const title = await row.locator("a").innerText();
    await row.locator('[data-qc="patient-task-tick"]').click();
    await expect(panel.locator('[data-qc="patient-task"]', { hasText: title })).toHaveAttribute(
      "data-status",
      /done|auto_closed/,
    );
    await expect.poll(async () => Number(await panel.getAttribute("data-open"))).toBe(before - 1);
    const toast = page.locator("[data-sonner-toast]", { hasText: "handled" }).last();
    await expect(toast).toBeVisible();
    await toast.getByRole("button", { name: "Undo" }).click();
    await expect(page.locator("[data-sonner-toast]").last()).toContainText("Undone.");
    await expect.poll(async () => Number(await panel.getAttribute("data-open"))).toBe(before);
    await expect(
      panel.locator('[data-qc="patient-task"][data-status="open"]', { hasText: title }),
    ).toHaveCount(1);
  });

  test("Edit step saves and the roadmap updates straight away", async ({ page }) => {
    await openGrace(page, "?tab=treatments");
    const current = page.locator('[data-qc="plan-step"]');
    const title = await current.locator(".font-semibold").first().innerText();
    await page.locator('[data-qc="step-edit"]').click();
    const form = page.locator('[data-qc="edit-step-form"]');
    await expect(form.locator("#edit-step-title")).toHaveValue(title);
    await form.locator("#edit-step-title").fill(`${title} (edited)`);
    await page.locator('[data-qc="edit-step-save"]').click();
    await expect(page.locator("[data-sonner-toast]").last()).toContainText("Step updated");
    await expect(current).toContainText(`${title} (edited)`);
    await expect(page.locator('[data-qc="step-details"]')).toContainText(`${title} (edited)`);
    // And the Overview's Up next box reads the same.
    await tab(page, /^Overview/).click();
    await expect(page.locator('[data-qc="skin-plan-next"]')).toContainText(`${title} (edited)`);
    // Put it back.
    await tab(page, /^Treatments/).click();
    await page.locator('[data-qc="step-edit"]').click();
    await form.locator("#edit-step-title").fill(title);
    await page.locator('[data-qc="edit-step-save"]').click();
    await expect(current).not.toContainText("(edited)");
  });

  test("the clinic ticks its own checklist item on the step", async ({ page }) => {
    await openGrace(page, "?tab=treatments");
    const item = page.locator('[data-qc="step-checklist-item"][data-owner="clinic"]').first();
    await expect(item).toContainText("You can tick");
    await item.locator('[data-qc="step-checklist-tick"]').click();
    await expect(item).toHaveAttribute("data-done", "true");
    await expect(item).toContainText(/clinic · \d{1,2} \w{3}/);
    // Untick to leave the fixture as found.
    await item.locator('[data-qc="step-checklist-tick"]').click();
    await expect(item).toHaveAttribute("data-done", "false");
  });

  test("Mark reviewed takes the check-in off the urgent list and clears the pink badge", async ({
    page,
  }) => {
    await openGrace(page, "?tab=portal");
    await expect(page.locator('[data-qc="portal-badge"]')).toHaveText("1");
    const urgent = page.locator('[data-qc="urgent-checkins"]');
    await expect(urgent).toHaveAttribute("data-open", "1");
    await expect(page.locator('[data-qc="checkin-call"]')).toHaveAttribute("href", /^tel:\d+$/);
    await page.locator('[data-qc="checkin-review"]').click();
    await expect(urgent).toHaveAttribute("data-open", "0");
    await expect(page.locator('[data-qc="portal-badge"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="checkin-row"][data-status="open"]')).toHaveCount(0);
    await expect(
      page.locator('[data-qc="checkin-row"][data-status="reviewed"]').first(),
    ).toBeVisible();
  });

  test("Accept into record writes the allergy and medication onto the header", async ({ page }) => {
    await openGrace(page, "?tab=history");
    const allergies = page.locator('[data-qc="record-detail"][data-field="allergies"]');
    await expect(allergies).not.toContainText("Lidocaine");
    await expect(page.locator('[data-qc="history-badge"]')).toHaveText("1");
    const update = page.locator('[data-qc="patient-update"]').first();
    await expect(update).toContainText("New allergy");
    await update.locator('[data-qc="patient-update-accept"]').click();
    await expect(update.locator('[data-qc="patient-update-accepted"]')).toHaveText("✓ Accepted");
    await expect(allergies).toContainText("Lidocaine");
    await expect(page.locator('[data-qc="record-detail"][data-field="medication"]')).toContainText(
      "Tretinoin",
    );
    await expect(page.locator('[data-qc="history-badge"]')).toHaveCount(0);
    await page.locator('[data-qc="patient-updates-back"]').click();
    await expectTab(page, /^Overview/);
  });

  test("Book on the Up next step opens QuickAdd and the booking lands on the step", async ({
    page,
  }) => {
    await openGrace(page);
    const next = page.locator('[data-qc="skin-plan-next"]');
    await expect(next.locator('[data-qc="skin-plan-not-booked"]')).toBeVisible();
    await next.locator('[data-qc="skin-plan-book"]').click();
    const dialog = page.getByRole("dialog", { name: "Book this step" });
    await expect(dialog).toBeVisible();
    // Treatment, then a slot a week out; patient and practitioner are preselected.
    await dialog.locator("select").first().selectOption({ label: "Microneedling" });
    await expect(dialog.locator("select").nth(1)).toHaveValue(/.+/);
    // The next weekday at least a week out, so the slot is inside clinic hours.
    const when = new Date();
    when.setDate(when.getDate() + 7);
    while (when.getDay() === 0 || when.getDay() === 6) when.setDate(when.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    await dialog
      .locator('input[type="date"]')
      .fill(`${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`);
    // The diary is busy in the fixtures; walk the day until a slot is free.
    let booked = false;
    for (const time of [
      "09:00",
      "09:45",
      "10:30",
      "11:15",
      "12:00",
      "13:30",
      "14:15",
      "15:00",
      "15:45",
      "16:30",
    ]) {
      await dialog.locator('input[type="time"]').fill(time);
      await dialog.getByRole("button", { name: "Book appointment" }).click();
      const clash = page.locator("[data-sonner-toast]", { hasText: /overlaps|outside|closed/ });
      await Promise.race([
        dialog.waitFor({ state: "hidden", timeout: 4_000 }).catch(() => {}),
        clash
          .last()
          .waitFor({ state: "visible", timeout: 4_000 })
          .catch(() => {}),
      ]);
      if (await dialog.isHidden()) {
        booked = true;
        break;
      }
      await expect(clash.last()).toBeVisible();
      // Let the toast go so the next attempt reads its own.
      await clash.last().evaluate((el) => el.remove());
    }
    expect(booked, "found a free slot for the step").toBe(true);
    // The step is booked: the Overview chip and the roadmap row both say so.
    await expect(next.locator('[data-qc="skin-plan-not-booked"]')).toHaveCount(0);
    await expect(next).toContainText("Booked");
    await tab(page, /^Treatments/).click();
    await expect(page.locator('[data-qc="plan-step"]')).toContainText("Booked");
    await expect(page.locator('[data-qc="step-booked-for"]')).toHaveAttribute(
      "data-booked",
      "true",
    );
  });
});
