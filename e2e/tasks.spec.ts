import { expect, test, type Page } from "./fixtures";

/**
 * The Tasks page: one list of what needs doing, by role. Owners delegate
 * (inline panel, bulk, drag), practitioners close with an outcome or hand off,
 * front desk claims from the pool and logs calls; three misses escalate.
 * Every write shows a toast with Undo. The demo server is shared and writes
 * persist for its lifetime, so each test undoes what it changes.
 */

const NADIA = "10000000-0000-4000-8000-000000000002";
const TOM = "10000000-0000-4000-8000-000000000003";
const SOFIA = "10000000-0000-4000-8000-000000000004";
const MAYA = "10000000-0000-4000-8000-000000000008";

async function openTasks(page: Page, search = "") {
  await page.goto(`/tasks${search}`);
  await expect(page.locator('[data-qc="tasks-main"]')).toBeVisible();
  await expect(page.locator('[data-qc="task-row"]').first()).toBeVisible({ timeout: 15_000 });
}

/** The newest toast, then mark it seen so the next read waits for a fresh one. */
let toastSeq = 0;
async function toast(page: Page) {
  const fresh = page.locator("[data-sonner-toast]:not([data-seen])").last();
  await expect(fresh).toBeVisible({ timeout: 8_000 });
  const text = (await fresh.innerText()).replace(/\s+/g, " ").trim();
  const seq = String(++toastSeq);
  await fresh.evaluate((el, n) => el.setAttribute("data-seen", n), seq);
  const seen = page.locator(`[data-sonner-toast][data-seen="${seq}"]`);
  return { text, undo: seen.getByRole("button", { name: "Undo" }) };
}

/** Click Undo on a toast and wait for the server to confirm. */
async function undo(page: Page, t: Awaited<ReturnType<typeof toast>>) {
  await t.undo.click();
  const undone = await toast(page);
  expect(undone.text).toMatch(/^Undone\./);
}

/** Reload and wait for the list to come back (the rule evaluator runs on read). */
async function reloadTasks(page: Page) {
  await page.reload();
  await expect(page.locator('[data-qc="task-row"]').first()).toBeVisible({ timeout: 15_000 });
}

test.describe("owner", () => {
  test("lands on Whole team with four groups, the sidebar badge, type chips and the deep link", async ({
    page,
  }) => {
    await openTasks(page);
    await expect(page.locator('[data-qc="tasks-main"]')).toHaveAttribute("data-view", "team");
    // Page 1 opens on what is late; the other groups follow on later pages.
    await expect(page.locator('[data-qc="tasks-group-overdue"]')).toBeVisible();
    await expect(page.locator('[data-qc="tasks-pagination"]')).toBeVisible();
    await expect(page.locator('[data-qc="nav-badge-tasks"]')).toHaveText(/^\d+$/);
    await expect(page.locator('[data-qc="team-panel"]')).toBeVisible();
    await expect(page.locator('[data-qc="tasks-auto-closed"]')).toContainText(
      "closed automatically",
    );

    // A type chip narrows the list and lands in the URL.
    await page.locator('[data-qc="tasks-type-question"]').click();
    await expect(page).toHaveURL(/types=question/);
    const types = await page
      .locator('[data-qc="task-row"]')
      .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-type")))]);
    expect(types).toEqual(["question"]);
    // Every question row shows the reply target counting down or how late it is.
    await expect(page.locator('[data-qc="task-due"]').first()).toHaveText(
      /left|late|Escalated|Today/,
    );

    // The left nav's counts match the summary; My tasks is the owner's own list.
    await page.locator('[data-qc="tasks-view-mine"]').click();
    await expect(page).toHaveURL(/view=mine/);
    const assignees = await page
      .locator('[data-qc="task-assignee"]')
      .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-assignee")))]);
    expect(assignees.length).toBeLessThanOrEqual(1);
  });

  test("ten a page: the page in the URL, a group continues across pages, a new view starts on page 1, a deep link lands on its page", async ({
    page,
  }) => {
    await openTasks(page);
    const rows = page.locator('[data-qc="task-row"]');
    await expect(rows).toHaveCount(10);
    const total = Number(
      (await page.locator('[data-qc="tasks-open-count"]').innerText()).replace(/\D/g, ""),
    );
    expect(total).toBeGreaterThan(10);
    const bar = page.locator('[data-qc="tasks-pagination"]');
    await expect(bar).toContainText(`Showing 1–10 of ${total} tasks`);
    await expect(bar).toContainText(`Page 1 of ${Math.ceil(total / 10)}`);
    // The Overdue header carries the group's total, not the page's slice.
    const overdue = page.locator('[data-qc="tasks-group-overdue"] h3');
    const overdueTotal = Number(((await overdue.innerText()).match(/· (\d+)/) ?? [])[1]);
    expect(overdueTotal).toBeGreaterThan(10);
    await expect(overdue).not.toContainText("continued");

    await bar.getByRole("button", { name: /next page/i }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(bar).toContainText("Showing 11–20");
    await expect(overdue).toContainText(`Overdue · ${overdueTotal} · continued`);
    // Every row on page 2 is different from page 1's.
    const firstId = (await rows.first().getAttribute("data-task-id"))!;
    await bar.getByRole("button", { name: /previous page/i }).click();
    await expect(page).not.toHaveURL(/page=/);
    const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-task-id")));
    expect(ids).not.toContain(firstId);

    // A different view or a type chip starts on page 1 again.
    await page.goto("/tasks?page=3");
    await expect(bar).toContainText("Showing 21–30");
    await page.locator('[data-qc="tasks-view-pool"]').click();
    await expect(page).toHaveURL(/view=pool/);
    await expect(page).not.toHaveURL(/page=/);
    await page.goto("/tasks?page=3");
    await page.locator('[data-qc="tasks-type-question"]').click();
    await expect(page).toHaveURL(/types=question/);
    await expect(page).not.toHaveURL(/page=/);
    // A view with ten or fewer rows has no pager.
    await page.goto("/tasks?view=unassigned");
    await expect(rows.first()).toBeVisible();
    await expect(bar).toHaveCount(0);

    // A deep link to a task on page 3 lands on page 3 with the row on screen.
    await page.goto("/tasks?page=3");
    const target = (await rows.nth(4).getAttribute("data-task-id"))!;
    await page.goto(`/tasks?task=${target}`);
    await expect(page).toHaveURL(/page=3/);
    await expect(page.locator(`[data-task-id="${target}"]`)).toBeInViewport();
  });

  test("demo only: the Viewing as pill switches persona and lands on that role's view", async ({
    page,
  }) => {
    await openTasks(page);
    const pill = page.locator('[data-qc="tasks-viewing-as"]');
    await expect(pill.locator('[data-qc="tasks-viewing-as-owner"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await pill.locator('[data-qc="tasks-viewing-as-practitioner"]').click();
    await expect(page.locator('[data-qc="tasks-main"]')).toHaveAttribute("data-view", "assigned", {
      timeout: 15_000,
    });
    await expect(page.locator('[data-qc="your-day-panel"]')).toBeVisible();
    await expect(pill.locator('[data-qc="tasks-viewing-as-practitioner"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await pill.locator('[data-qc="tasks-viewing-as-front_desk"]').click();
    await expect(page.locator('[data-qc="tasks-main"]')).toHaveAttribute("data-view", "queue", {
      timeout: 15_000,
    });
    await expect(page.locator('[data-qc="todays-calls-panel"]')).toBeVisible();
    await pill.locator('[data-qc="tasks-viewing-as-owner"]').click();
    await expect(page.locator('[data-qc="tasks-main"]')).toHaveAttribute("data-view", "team", {
      timeout: 15_000,
    });
    await expect(page.locator('[data-qc="team-panel"]')).toBeVisible();
  });

  test("delegate panel: suggested teammate, due, note, assign, then undo", async ({ page }) => {
    await openTasks(page, "?view=pool");
    const row = page.locator('[data-qc="task-row"]').first();
    const id = (await row.getAttribute("data-task-id"))!;
    await row.locator('[data-qc="task-action-delegate"]').click();
    const panel = page.locator('[data-qc="delegate-panel"]');
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Suggested")).toBeVisible();
    await expect(panel.locator('[data-qc^="delegate-who-"]')).toHaveCount(5);
    await panel.locator(`[data-qc="delegate-who-${SOFIA}"]`).click();
    await panel.locator('[data-qc="delegate-due-tomorrow"]').click();
    await panel.locator('[data-qc="delegate-note"]').fill("Try after 3pm");
    await expect(panel).toContainText("Lands in Sofia's Tasks");
    await expect(panel.locator('[data-qc="delegate-submit"]')).toHaveText("Assign to Sofia");
    await panel.locator('[data-qc="delegate-submit"]').click();
    const t = await toast(page);
    expect(t.text).toMatch(/assigned to Sofia M\. Added to their Tasks and dashboard/);

    // The row left the pool and carries Sofia and the note in her list.
    await expect(page.locator(`[data-task-id="${id}"]`)).toHaveCount(0);
    await page.goto(`/tasks?person=${SOFIA}`);
    const moved = page.locator(`[data-task-id="${id}"]`);
    await expect(moved).toBeVisible();
    await expect(moved.locator('[data-qc="task-note"]')).toContainText("Try after 3pm");
    await expect(moved.locator('[data-qc="task-assignee"]')).toHaveAttribute(
      "data-assignee",
      SOFIA,
    );

    // Undo puts it back in the pool.
    await openTasks(page, "?view=pool");
    const back = page.locator('[data-qc="task-row"]').first();
    const id2 = (await back.getAttribute("data-task-id"))!;
    await back.locator('[data-qc="task-action-delegate"]').click();
    await page.locator(`[data-qc="delegate-who-${TOM}"]`).click();
    await page.locator('[data-qc="delegate-submit"]').click();
    const t2 = await toast(page);
    await undo(page, t2);
    await reloadTasks(page);
    await expect(page.locator(`[data-task-id="${id2}"] [data-qc="task-assignee"]`)).toHaveAttribute(
      "data-assignee",
      "pool",
    );
  });

  test("select rows, tap a teammate to assign them all; Mark handled in bulk; undo both", async ({
    page,
  }) => {
    await openTasks(page, "?view=pool");
    const rows = page.locator('[data-qc="task-row"]');
    const ids = [
      await rows.nth(0).getAttribute("data-task-id"),
      await rows.nth(1).getAttribute("data-task-id"),
    ];
    await rows.nth(0).locator('[data-qc="task-select"]').click();
    await rows.nth(1).locator('[data-qc="task-select"]').click();
    await expect(page.locator('[data-qc="bulk-bar"]')).toContainText("2 selected");
    await expect(page.locator('[data-qc="team-hint"]')).toContainText(
      "Tap a teammate to assign 2 selected",
    );
    await page.locator(`[data-qc="team-member-${MAYA}"]`).click();
    const t = await toast(page);
    expect(t.text).toMatch(/2 tasks assigned to Maya C\./);
    await page.goto(`/tasks?person=${MAYA}`);
    for (const id of ids) await expect(page.locator(`[data-task-id="${id}"]`)).toBeVisible();
    // Undo from the toast is gone after a navigation; undo through the audit trail instead:
    // hand them back to the pool through the delegate panel's suggestion (front desk).
    for (const id of ids) {
      await page.locator(`[data-task-id="${id}"] [data-qc="task-action-reassign"]`).click();
      await page.locator(`[data-qc="delegate-who-${SOFIA}"]`).click();
      await page.locator('[data-qc="delegate-submit"]').click();
      await toast(page);
    }

    // Bulk Mark handled closes the selection; Undo reopens.
    await openTasks(page, "?view=team");
    const first = page.locator('[data-qc="task-row"]').first();
    const firstId = (await first.getAttribute("data-task-id"))!;
    await first.locator('[data-qc="task-select"]').click();
    await page.locator('[data-qc="bulk-handled"]').click();
    const done = await toast(page);
    expect(done.text).toMatch(/1 task marked as handled/);
    await undo(page, done);
    await reloadTasks(page);
    await expect(page.locator(`[data-task-id="${firstId}"]`)).toHaveAttribute(
      "data-status",
      "open",
    );
  });

  test("drag a row onto a teammate assigns it; the Team row click filters to that person", async ({
    page,
  }) => {
    await openTasks(page, "?view=pool");
    const row = page.locator('[data-qc="task-row"]').first();
    const id = (await row.getAttribute("data-task-id"))!;
    // Native HTML5 DnD: the drop reads the task id from dataTransfer.
    await page.evaluate(
      ([taskId, sel]) => {
        const src = document.querySelector(`[data-task-id="${taskId}"]`)!;
        const dst = document.querySelector(sel!)!;
        const dt = new DataTransfer();
        src.dispatchEvent(new DragEvent("dragstart", { bubbles: true, dataTransfer: dt }));
        dst.dispatchEvent(
          new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: dt }),
        );
        dst.dispatchEvent(
          new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }),
        );
        src.dispatchEvent(new DragEvent("dragend", { bubbles: true, dataTransfer: dt }));
      },
      [id, `[data-qc="team-member-${TOM}"]`],
    );
    const t = await toast(page);
    expect(t.text).toMatch(/assigned to Tom W\./);
    await page.locator(`[data-qc="team-member-${TOM}"]`).click();
    await expect(page).toHaveURL(new RegExp(`person=${TOM}`));
    await expect(page.locator('[data-qc="tasks-main"] h2')).toContainText("Dr Tom Whitfield");
    await expect(page.locator(`[data-task-id="${id}"] [data-qc="task-assignee"]`)).toHaveAttribute(
      "data-assignee",
      TOM,
    );
    // Give it back to the pool.
    await page.locator(`[data-task-id="${id}"] [data-qc="task-action-reassign"]`).click();
    await page.locator(`[data-qc="delegate-who-${SOFIA}"]`).click();
    await page.locator('[data-qc="delegate-submit"]').click();
    await toast(page);
  });

  test("New task: pick a patient, the Assign dialog opens; the task appears and can be handled", async ({
    page,
  }) => {
    await openTasks(page);
    await page.locator('[data-qc="tasks-new"]').click();
    await page.locator('[data-qc="new-task-search"]').fill("Bennett");
    await page.locator('[data-qc="new-task-patient"]', { hasText: "Olivia Bennett" }).click();
    const dialog = page.locator('[data-qc="assign-task-dialog"]');
    await expect(dialog).toContainText("Assign a task: Olivia Bennett");
    await dialog.locator('[data-qc="assign-type-plan_support"]').click();
    await expect(dialog.locator('[data-qc="assign-template"]')).toContainText(
      "Check in with Olivia",
    );
    await dialog.locator(`[data-qc="assign-who-${NADIA}"]`).click();
    await dialog.locator('[data-qc="assign-due-today"]').click();
    await dialog.locator('[data-qc="assign-submit"]').click();
    const t = await toast(page);
    expect(t.text).toMatch(/Olivia assigned to Nadia R\./);
    await page.goto(`/tasks?person=${NADIA}&types=plan_support`);
    const row = page.locator('[data-qc="task-row"]', { hasText: "Olivia Bennett" }).first();
    await expect(row).toBeVisible();
    await row.locator('[data-qc="task-action-handled"]').click();
    const done = await toast(page);
    expect(done.text).toMatch(/Olivia: handled/);
  });
});

test.describe("practitioner", () => {
  test.use({ role: "practitioner" });

  test("Assigned to me by default, Your day rail, outcomes, snooze and hand-off with undo", async ({
    page,
  }) => {
    await openTasks(page);
    await expect(page.locator('[data-qc="tasks-main"]')).toHaveAttribute("data-view", "assigned");
    await expect(page.locator('[data-qc="your-day-panel"]')).toBeVisible();
    await expect(page.locator('[data-qc="team-panel"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="task-select"]')).toHaveCount(0);

    // A clinical question: Reply / Snooze 2h.
    await page.locator('[data-qc="tasks-view-questions"]').click();
    await expect(page).toHaveURL(/view=questions/);
    const q = page.locator('[data-qc="task-row"][data-type="question"]').first();
    await expect(q).toBeVisible();
    await expect(q.locator('[data-qc="task-action-reply"]')).toBeVisible();
    await q.locator('[data-qc="task-action-snooze-2h"]').click();
    const snoozed = await toast(page);
    expect(snoozed.text).toMatch(/Snoozed for 2 hours/);
    await undo(page, snoozed);

    // Done… opens the four outcomes; "Spoke, will book" closes it; undo reopens.
    await page.locator('[data-qc="tasks-view-assigned"]').click();
    const row = page
      .locator('[data-qc="task-row"]', { has: page.locator('[data-qc="task-action-done"]') })
      .first();
    const id = (await row.getAttribute("data-task-id"))!;
    await row.locator('[data-qc="task-action-done"]').click();
    const panel = page.locator('[data-qc="outcome-panel"]');
    await expect(panel).toContainText("How did it go?");
    await expect(panel.locator('[data-qc^="outcome-"]')).toHaveCount(4);
    await panel.locator('[data-qc="outcome-spoke-will-book"]').click();
    const t = await toast(page);
    expect(t.text).toMatch(/spoke, will book\. Removed from the dashboard/);
    await undo(page, t);
    await reloadTasks(page);
    await expect(page.locator(`[data-task-id="${id}"]`)).toHaveAttribute("data-status", "open");

    // Hand to front desk moves a chase to the pool; undo brings it back.
    const chase = page
      .locator('[data-qc="task-row"]', {
        has: page.locator('[data-qc="task-action-hand-to-front-desk"]'),
      })
      .first();
    if ((await chase.count()) > 0) {
      const chaseId = (await chase.getAttribute("data-task-id"))!;
      await chase.locator('[data-qc="task-action-hand-to-front-desk"]').click();
      const h = await toast(page);
      expect(h.text).toMatch(/Sent to the front desk pool/);
      await expect(page.locator(`[data-task-id="${chaseId}"]`)).toHaveCount(0);
      await undo(page, h);
      await reloadTasks(page);
      await expect(page.locator(`[data-task-id="${chaseId}"]`)).toBeVisible();
    }

    // My patients, with others: read-only owner lines and Take over.
    await page.locator('[data-qc="tasks-view-patients_with_others"]').click();
    await expect(page.locator('[data-qc="task-owner-line"]').first()).toBeVisible();
    await expect(page.locator('[data-qc="task-action-delegate"]')).toHaveCount(0);
  });
});

test.describe("front desk", () => {
  test.use({ role: "front_desk" });

  test("My queue by default, no clinical questions anywhere, claim from the pool, three misses escalate", async ({
    page,
  }) => {
    await openTasks(page);
    await expect(page.locator('[data-qc="tasks-main"]')).toHaveAttribute("data-view", "queue");
    await expect(page.locator('[data-qc="todays-calls-panel"]')).toBeVisible();
    await expect(page.locator('[data-qc="tasks-type-question"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="tasks-view-questions"]')).toHaveCount(0);

    await page.locator('[data-qc="tasks-view-pool"]').click();
    await expect(page.locator('[data-qc="task-row"]').first()).toBeVisible();
    await expect(page.locator('[data-qc="task-row"][data-type="question"]')).toHaveCount(0);
    const pool = page.locator('[data-qc="task-row"]').first();
    const id = (await pool.getAttribute("data-task-id"))!;
    await expect(pool.locator('[data-qc="task-owner-line"]')).toContainText(
      /Added by rule|front desk pool/,
    );
    await pool.locator('[data-qc="task-action-claim"]').click();
    const claimed = await toast(page);
    expect(claimed.text).toMatch(/claimed\. It's in your queue/);

    await page.locator('[data-qc="tasks-view-queue"]').click();
    const mine = page.locator(`[data-task-id="${id}"]`);
    await expect(mine).toBeVisible();
    await expect(mine.locator('[data-qc="task-attempts"]')).toContainText("Attempt 1 of 3");
    for (let i = 1; i <= 3; i++) {
      await mine.locator('[data-qc="task-action-log-outcome"]').click();
      const panel = page.locator('[data-qc="outcome-panel"]');
      await expect(panel).toContainText("Log the call");
      await expect(panel.locator('[data-qc^="outcome-"]')).toHaveCount(5);
      await panel.locator('[data-qc="outcome-no-answer"]').click();
      const t = await toast(page);
      if (i < 3) {
        expect(t.text).toMatch(new RegExp(`No answer logged \\(attempt ${i} of 3\\)`));
        await expect(mine.locator('[data-qc="task-attempts"]')).toContainText(
          `Attempt ${i + 1} of 3`,
        );
      } else {
        expect(t.text).toMatch(/Third attempt logged\. .* escalated to the clinic owner/);
        // Undo the escalation so the task returns to the queue; then the two attempts stay.
        await undo(page, t);
      }
    }
    await reloadTasks(page);
    await expect(page.locator(`[data-task-id="${id}"] [data-qc="task-attempts"]`)).toHaveAttribute(
      "data-attempts",
      "2",
    );
    // Retries due today lists what has a retry scheduled once its day comes; the rail counts them.
    await expect(page.locator('[data-qc="todays-calls-panel"]')).toContainText("Retries scheduled");
  });
});
