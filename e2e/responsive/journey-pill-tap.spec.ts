import { become, expect, settle, test } from "./fixtures";

/**
 * Journey board → Records on every device in playwright.responsive.config.ts.
 * Tapping a patient pill must land on Records with *that* patient's row
 * selected and on screen. On iPad the tap used to leave :hover stuck on
 * whichever row ended up under the finger, which looked like the wrong
 * patient was highlighted.
 */
test("tapping a journey board patient highlights that patient in Records", async ({
  page,
}, info) => {
  await become(page, "owner");
  await page.goto("/patients?tab=board");
  await settle(page, '[data-qc="board-pill"]');

  // A pill further down the board, so the tap point overlaps other rows after navigating.
  const pills = page.locator('[data-qc="board-pill"]');
  const pill = pills.nth(Math.min(4, (await pills.count()) - 1));
  const name = (await pill.getAttribute("data-name"))!;
  const [first] = name.split(" ");

  if (info.project.use.hasTouch) await pill.tap();
  else await pill.click();

  await expect(page).toHaveURL(/\/patients\?.*sel=/);
  const selectedRow = page.locator('[data-qc="records-row"][data-selected="true"]');
  await expect(selectedRow).toHaveCount(1);
  await expect(selectedRow.locator('[data-qc="records-name"]')).toContainText(first!);
  // Let the page settle (data, scroll restoration) before judging.
  await page.waitForTimeout(1000);
  // If this fails, the message carries the geometry needed to see why.
  const geometry = await selectedRow.evaluate((row) => {
    const r = row.getBoundingClientRect();
    const main = document.getElementById("app-main-scroll");
    return JSON.stringify({
      row: {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        left: Math.round(r.left),
        width: Math.round(r.width),
      },
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      visual: window.visualViewport
        ? {
            top: Math.round(window.visualViewport.offsetTop),
            height: Math.round(window.visualViewport.height),
            scale: window.visualViewport.scale,
          }
        : null,
      windowScrollY: Math.round(window.scrollY),
      main: main
        ? {
            scrollTop: Math.round(main.scrollTop),
            clientHeight: main.clientHeight,
            scrollHeight: main.scrollHeight,
          }
        : null,
      docWidth: document.documentElement.scrollWidth,
    });
  });
  await expect(selectedRow, `selected row should be on screen — ${geometry}`).toBeInViewport();

  // No other row may look highlighted (stuck hover) on a touch screen.
  if (info.project.use.hasTouch) {
    const tinted = await page.locator('[data-qc="records-row"]:not([data-selected])').evaluateAll(
      (rows) =>
        rows.filter((r) => {
          const bg = getComputedStyle(r).backgroundColor;
          return bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent";
        }).length,
    );
    expect(tinted).toBe(0);
  }
});
