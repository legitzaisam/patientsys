import type { Page } from "@playwright/test";
import { become, expect, settle, shotPath, test } from "./fixtures";

/**
 * Diary drag-to-reschedule on every device in playwright.responsive.config.ts
 * (iPhone/iPad in WebKit — Safari's engine — and laptops/desktop in Chromium).
 *
 * Touch devices: Playwright cannot drive a real finger drag in WebKit, so the
 * touch checks dispatch the same PointerEvents iPad Safari sends
 * (pointerType "touch") and assert what the diary does with them. The iOS-only
 * long-press behaviours (selection, link preview) are checked through the CSS
 * that disables them. Mouse devices use Playwright's real mouse.
 *
 * Every drag is cancelled at the confirm dialog ("Keep as it was"), so the run
 * writes nothing and projects can share the one demo server.
 *
 *   npm run test:ipad            iPad portrait + landscape only
 *   npm run test:drag            diary + panel drag checks, every device
 *   npm run test:responsive      the whole device matrix
 */

const CARD = "[data-diary-event]";
const MOVE_DIALOG = /Move this appointment\?/;

type Box = { x: number; y: number; width: number; height: number };
type FingerWindow = Window & { __finger?: Element };

async function openDiary(page: Page) {
  await become(page, "owner");
  await page.goto("/schedule");
  await settle(page, CARD);
}

/** The first card whose grab point is on screen and not under floating chrome. */
async function pickCard(page: Page) {
  const ids = await page
    .locator(CARD)
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-diary-event")!));
  for (const id of ids) {
    const card = page.locator(`[data-diary-event="${id}"]`);
    await card.scrollIntoViewIfNeeded();
    const ok = await card.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height * 0.7;
      const hit = document.elementFromPoint(x, y);
      return (
        r.height > 30 &&
        y < window.innerHeight - 140 &&
        !!hit &&
        el.contains(hit) &&
        !hit.closest("button")
      );
    });
    if (ok) return { id, card };
  }
  throw new Error("No diary card reachable on screen.");
}

const rectOf = (page: Page, selector: string): Promise<Box> =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    });

/**
 * A finger gesture as iPad Safari reports it: pointerdown, an optional
 * hold, moves, then pointerup — all with pointerType "touch".
 */
async function fingerGesture(
  page: Page,
  start: { x: number; y: number },
  path: { x: number; y: number }[],
  holdMs: number,
) {
  await page.evaluate(
    async ({ start, path, holdMs }) => {
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const target = document.elementFromPoint(start.x, start.y)!;
      const fire = (type: string, p: { x: number; y: number }, buttons: number) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId: 41,
            pointerType: "touch",
            isPrimary: true,
            button: type === "pointermove" ? -1 : 0,
            buttons,
            clientX: p.x,
            clientY: p.y,
            width: 20,
            height: 20,
            pressure: buttons ? 0.5 : 0,
          }),
        );
      fire("pointerdown", start, 1);
      await wait(holdMs);
      for (const p of path) {
        fire("pointermove", p, 1);
        await wait(16);
      }
      fire("pointerup", path.at(-1) ?? start, 0);
      await wait(50);
    },
    { start, path, holdMs },
  );
}

function steps(from: { x: number; y: number }, to: { x: number; y: number }, n = 10) {
  return Array.from({ length: n }, (_, i) => ({
    x: from.x + ((to.x - from.x) * (i + 1)) / n,
    y: from.y + ((to.y - from.y) * (i + 1)) / n,
  }));
}

async function keepAsItWas(page: Page) {
  const dialog = page.getByRole("dialog").filter({ hasText: MOVE_DIALOG });
  await dialog.getByRole("button", { name: "Keep as it was" }).click();
  await expect(dialog).toBeHidden();
}

test.describe("diary drag-to-reschedule", () => {
  test.beforeEach(async ({ page }) => {
    await openDiary(page);
  });

  test("touch: a quick tap neither moves the card nor asks to move it", async ({ page }, info) => {
    test.skip(!info.project.use.hasTouch, "Touch devices only.");
    const { id } = await pickCard(page);
    const before = await rectOf(page, `[data-diary-event="${id}"]`);
    const at = { x: before.x + before.width / 2, y: before.y + before.height * 0.7 };
    await fingerGesture(page, at, [], 80);
    await page.waitForTimeout(300);
    expect(await rectOf(page, `[data-diary-event="${id}"]`)).toEqual(before);
    await expect(page.getByText(MOVE_DIALOG)).toHaveCount(0);
  });

  test("touch: swiping straight away is a scroll, not a move", async ({ page }, info) => {
    test.skip(!info.project.use.hasTouch, "Touch devices only.");
    const { id } = await pickCard(page);
    const before = await rectOf(page, `[data-diary-event="${id}"]`);
    const at = { x: before.x + before.width / 2, y: before.y + before.height * 0.7 };
    await fingerGesture(page, at, steps(at, { x: at.x, y: at.y + 120 }), 0);
    await page.waitForTimeout(300);
    expect(await rectOf(page, `[data-diary-event="${id}"]`)).toEqual(before);
    await expect(page.getByText(MOVE_DIALOG)).toHaveCount(0);
  });

  test("touch: press-and-hold then drag moves the card with the finger and asks to confirm", async ({
    page,
  }, info) => {
    test.skip(!info.project.use.hasTouch, "Touch devices only.");
    const { id } = await pickCard(page);
    const sel = `[data-diary-event="${id}"]`;
    const before = await rectOf(page, sel);
    const at = { x: before.x + before.width / 2, y: before.y + before.height * 0.7 };
    const to = { x: at.x, y: at.y + 80 };

    // Hold, then check the card has not jumped to the finger.
    const timeBefore = await page.locator(sel).locator("span").first().innerText();
    await page.evaluate(
      ({ at }) => {
        const target = document.elementFromPoint(at.x, at.y)!;
        (window as FingerWindow).__finger = target;
        target.dispatchEvent(
          new PointerEvent("pointerdown", {
            bubbles: true,
            cancelable: true,
            pointerId: 41,
            pointerType: "touch",
            isPrimary: true,
            button: 0,
            buttons: 1,
            clientX: at.x,
            clientY: at.y,
          }),
        );
      },
      { at },
    );
    await page.waitForTimeout(400);
    expect(await rectOf(page, sel)).toEqual(before);
    await expect(page.locator("html")).toHaveClass(/diary-dragging/);

    for (const p of steps(at, to)) {
      await page.evaluate(
        ({ p }) =>
          (window as FingerWindow).__finger!.dispatchEvent(
            new PointerEvent("pointermove", {
              bubbles: true,
              cancelable: true,
              pointerId: 41,
              pointerType: "touch",
              isPrimary: true,
              button: -1,
              buttons: 1,
              clientX: p.x,
              clientY: p.y,
            }),
          ),
        { p },
      );
    }
    const during = await rectOf(page, sel);
    // The card follows the finger (to the 5-minute grid), it does not leap.
    expect(Math.abs(during.y - before.y - 80)).toBeLessThan(20);
    await page.screenshot({
      path: shotPath(info.project.name, "diary-drag--touch-during"),
      animations: "disabled",
    });

    await page.evaluate(
      ({ to }) =>
        (window as FingerWindow).__finger!.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            cancelable: true,
            pointerId: 41,
            pointerType: "touch",
            isPrimary: true,
            button: 0,
            buttons: 0,
            clientX: to.x,
            clientY: to.y,
          }),
        ),
      { to },
    );
    const dialog = page.getByRole("dialog").filter({ hasText: MOVE_DIALOG });
    await expect(dialog).toBeVisible();
    await page.screenshot({
      path: shotPath(info.project.name, "diary-drag--touch-confirm"),
      animations: "disabled",
    });
    expect(await page.evaluate(() => String(window.getSelection()))).toBe("");
    await keepAsItWas(page);
    await expect(page.locator(sel).locator("span").first()).toHaveText(timeBefore);
  });

  test("touch: holding on the patient name drags the card instead of opening the patient", async ({
    page,
  }, info) => {
    test.skip(!info.project.use.hasTouch, "Touch devices only.");
    const { id } = await pickCard(page);
    const link = await rectOf(page, `[data-diary-event="${id}"] a`);
    const at = { x: link.x + Math.min(20, link.width / 2), y: link.y + link.height / 2 };
    const url = page.url();
    await fingerGesture(page, at, steps(at, { x: at.x, y: at.y + 80 }), 400);
    await expect(page.getByRole("dialog").filter({ hasText: MOVE_DIALOG })).toBeVisible();
    expect(page.url()).toBe(url);
    await keepAsItWas(page);
  });

  test("touch: drag across to another practitioner", async ({ page }, info) => {
    test.skip(!info.project.use.hasTouch, "Touch devices only.");
    const { id } = await pickCard(page);
    const sel = `[data-diary-event="${id}"]`;
    const cols = await page.locator("[data-diary-col]").evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return { id: el.getAttribute("data-diary-col")!, x: r.left, width: r.width };
      }),
    );
    test.skip(cols.length < 2, "Only one practitioner column.");
    const card = await rectOf(page, sel);
    const at = { x: card.x + card.width / 2, y: card.y + card.height * 0.7 };
    const here = cols.findIndex((c) => at.x >= c.x && at.x <= c.x + c.width);
    const other = cols[here + 1 < cols.length ? here + 1 : here - 1]!;
    const to = { x: other.x + other.width / 2, y: at.y };
    test.skip(
      to.x < 0 || to.x > page.viewportSize()!.width - 10,
      "Next column is off screen at this width.",
    );
    await fingerGesture(page, at, steps(at, to, 14), 400);
    const dialog = page.getByRole("dialog").filter({ hasText: MOVE_DIALOG });
    await expect(dialog).toBeVisible();
    await keepAsItWas(page);
  });

  test("touch: long-press selection and link preview are switched off on cards", async ({
    page,
  }, info) => {
    test.skip(!info.project.use.hasTouch, "Touch devices only.");
    const { id } = await pickCard(page);
    const css = await page.locator(`[data-diary-event="${id}"] a`).evaluate((el) => {
      const s = getComputedStyle(el) as CSSStyleDeclaration & Record<string, string>;
      return {
        userSelect: s.userSelect || s.webkitUserSelect,
        callout: s.getPropertyValue("-webkit-touch-callout") || "unsupported",
      };
    });
    expect(css.userSelect).toBe("none");
    // -webkit-touch-callout exists only in iOS Safari; desktop WebKit (what
    // Playwright runs) reports it as unsupported, so it can only be checked there.
    if (
      css.callout !== "unsupported" &&
      (info.project.use.browserName === "webkit" ||
        info.project.use.defaultBrowserType === "webkit")
    ) {
      expect(css.callout).toBe("none");
    }
  });

  test("mouse: a click never moves a card; a drag keeps the grab point and asks to confirm", async ({
    page,
  }, info) => {
    test.skip(Boolean(info.project.use.hasTouch), "Mouse devices only.");
    const { id } = await pickCard(page);
    const sel = `[data-diary-event="${id}"]`;
    const before = await rectOf(page, sel);
    const at = { x: before.x + before.width / 2, y: before.y + before.height * 0.7 };

    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 2, at.y + 2);
    expect(await rectOf(page, sel)).toEqual(before);

    await page.mouse.move(at.x, at.y + 80, { steps: 10 });
    const during = await rectOf(page, sel);
    expect(Math.abs(during.y - before.y - 80)).toBeLessThan(20);
    await page.mouse.up();
    await expect(page.getByRole("dialog").filter({ hasText: MOVE_DIALOG })).toBeVisible();
    expect(await page.evaluate(() => String(window.getSelection()))).toBe("");
    await keepAsItWas(page);
    expect(await rectOf(page, sel)).toEqual(before);
  });
});
