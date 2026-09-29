import { expect, test } from "./fixtures";

/**
 * Patients › Journey board: six triage tiles over a practitioner × phase
 * map. Tiles highlight (multi-select, OR), faces scope the map, both live in
 * the URL; a pill opens that patient in the Records drawer. The board has no
 * action buttons of its own.
 */

const TILES = ["overdue", "noshow", "mismatch", "nobook", "due_this_week", "ontrack"] as const;

test.describe("owner", () => {
  test.use({ role: "owner" });

  test("tiles count and highlight, faces scope the map, a pill opens the drawer", async ({
    page,
  }) => {
    await page.goto("/patients?tab=board");
    const pills = page.locator('[data-qc="board-pill"]');
    await expect(pills.first()).toBeVisible();
    // Six tiles; their counts add up over the risk states (Due this week overlaps No booking).
    for (const tile of TILES) {
      await expect(page.locator(`[data-qc="board-tile-${tile}"]`)).toBeVisible();
    }
    const risks = await pills.evaluateAll((els) => els.map((e) => e.getAttribute("data-risk")));
    for (const tile of ["overdue", "noshow", "mismatch", "nobook", "ontrack"]) {
      const count = Number(
        await page.locator(`[data-qc="board-tile-${tile}"]`).getAttribute("data-count"),
      );
      expect(count).toBe(risks.filter((r) => r === tile).length);
    }
    // Nothing highlighted yet: the legend names the five risks and points follow-ups at Tasks.
    await expect(page.locator('[data-qc="board-legend"]')).toContainText(
      "Follow-ups live on the Tasks page.",
    );

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
    // Tapping a lit tile again turns it off.
    await page.locator('[data-qc="board-tile-noshow"]').click();
    await expect(page).toHaveURL(/tiles=overdue(&|$)/);
    await expect(page.locator('[data-qc="board-pill"][data-hit]')).toHaveCount(overdue);

    // A practitioner face fades the other rows and scopes the tile counts.
    const face = page.locator('[data-qc^="board-prac-"]').first();
    const faceId = (await face.getAttribute("data-qc"))!.replace("board-prac-", "");
    await face.click();
    await expect(page).toHaveURL(new RegExp(`prac=${faceId}`));
    // The label names the chosen practitioner in short form ("Tom W."), not the whole team.
    await expect(page.locator('[data-qc="board-prac-label"]')).toHaveText(/^[A-Z][a-z]+ [A-Z]\.$/);
    const others = page.locator(
      `[data-qc="board-row"]:not([data-practitioner="${faceId}"]) [role="rowheader"]`,
    );
    if ((await others.count()) > 0) {
      await expect(others.first()).toHaveCSS("opacity", "0.3");
    }
    const ownPills = await page
      .locator(`[data-qc="board-row"][data-practitioner="${faceId}"] [data-qc="board-pill"]`)
      .count();
    const scopedTotal = (
      await Promise.all(
        ["overdue", "noshow", "mismatch", "nobook", "ontrack"].map(async (tile) =>
          Number(await page.locator(`[data-qc="board-tile-${tile}"]`).getAttribute("data-count")),
        ),
      )
    ).reduce((a, b) => a + b, 0);
    expect(scopedTotal).toBe(ownPills);

    await page.locator('[data-qc="board-clear"]').click();
    await expect(page).not.toHaveURL(/tiles=/);
    await expect(page).not.toHaveURL(/prac=/);
    await expect(page.locator('[data-qc="board-prac-label"]')).toHaveText("All practitioners");

    // No action buttons on the board; a pill opens that patient in the Records drawer.
    await expect(page.locator('[data-qc="board-book"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="board-map"] button')).toHaveCount(0);
    const pill = pills.first();
    const name = (await pill.getAttribute("data-name"))!;
    await pill.click();
    await expect(page).toHaveURL(/\/patients\?.*sel=/);
    await expect(page.locator('[data-qc="drawer-name"]')).toHaveText(name);
    await expect(page.locator('[data-qc="records-row"][data-selected="true"]')).toHaveCount(1);
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
    for (const tile of ["mismatch", "due_this_week", "ontrack"]) {
      await expect(page.locator(`[data-qc="board-tile-${tile}"]`)).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    }
    // Clearing the highlight from a deep link writes an explicit empty choice.
    await page.locator('[data-qc="board-clear"]').click();
    await expect(page.locator('[data-qc="board-tile-overdue"]')).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("every pill's risk agrees with the plan it stands for", async ({ page }) => {
    await page.goto("/patients?tab=board");
    const pills = page.locator('[data-qc="board-pill"]');
    await expect(pills.first()).toBeVisible();
    const seen = await pills.evaluateAll((els) =>
      els.map((e) => ({
        risk: e.getAttribute("data-risk"),
        patient: e.getAttribute("data-patient"),
        name: e.getAttribute("data-name"),
      })),
    );
    // Every pill names a patient and a known risk; no patient appears twice.
    for (const p of seen) {
      expect(["overdue", "noshow", "mismatch", "nobook", "ontrack"]).toContain(p.risk);
      expect(p.patient).toBeTruthy();
      expect(p.name).toBeTruthy();
    }
    expect(new Set(seen.map((p) => p.patient)).size).toBe(seen.length);
  });
});

test.describe("practitioner", () => {
  test.use({ role: "practitioner" });

  test("the board opens on her own row; Clear widens it to everyone", async ({ page }) => {
    await page.goto("/patients?tab=board");
    await expect(page.locator('[data-qc="board-pill"]').first()).toBeVisible();
    await expect(page.locator('[data-qc="board-prac-label"]')).toContainText("Nadia R.");
    const own = page.locator('[data-qc="board-prac-10000000-0000-4000-8000-000000000002"]');
    await expect(own).toHaveAttribute("aria-pressed", "true");
    const ownRows = await page
      .locator('[data-qc="board-row"] [role="rowheader"]')
      .evaluateAll((els) => els.map((e) => getComputedStyle(e).opacity));
    expect(ownRows.filter((o) => o === "1").length).toBe(1);

    await page.locator('[data-qc="board-clear"]').click();
    await expect(page).toHaveURL(/prac=all/);
    await expect(page.locator('[data-qc="board-prac-label"]')).toHaveText("All practitioners");
    await expect(own).toHaveAttribute("aria-pressed", "false");
  });
});
