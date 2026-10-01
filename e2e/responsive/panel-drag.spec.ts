import type { Locator, Page } from "@playwright/test";
import { become, expect, settle, shotPath, test } from "./fixtures";

/**
 * Draggable panels (Quick book, My notes) on every device in
 * playwright.responsive.config.ts — iPhone/iPad in WebKit, laptops in Chromium.
 *
 * The iPad bug: Safari took a drag on the panel header over as a page scroll,
 * sent pointercancel instead of pointerup, and the old drag code never
 * stopped — every later touch on the page moved the panel. These checks send
 * the same pointer sequence Safari does (including the pointercancel) and
 * assert the panel follows the finger and then stays put.
 *
 *   npm run test:ipad   ·   npm run test:responsive
 */

type FingerWindow = Window & { __finger?: Element };

async function box(locator: Locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.left), y: Math.round(r.top) };
  });
}

/** Drag a handle the way the device would: touch on tablets/phones, mouse on laptops. */
async function dragHandle(
  page: Page,
  handle: Locator,
  dx: number,
  dy: number,
  touch: boolean,
  end: "up" | "cancel" = "up",
) {
  const r = await handle.evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { x: b.left + 24, y: b.top + b.height / 2 };
  });
  if (!touch) {
    await page.mouse.move(r.x, r.y);
    await page.mouse.down();
    await page.mouse.move(r.x + dx, r.y + dy, { steps: 10 });
    await page.mouse.up();
    return;
  }
  await page.evaluate(
    async ({ r, dx, dy, end }) => {
      const target = document.elementFromPoint(r.x, r.y)!;
      (window as FingerWindow).__finger = target;
      const fire = (type: string, x: number, y: number, buttons: number) =>
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId: 52,
            pointerType: "touch",
            isPrimary: true,
            button: type === "pointermove" ? -1 : 0,
            buttons,
            clientX: x,
            clientY: y,
          }),
        );
      fire("pointerdown", r.x, r.y, 1);
      for (let i = 1; i <= 10; i++) {
        fire("pointermove", r.x + (dx * i) / 10, r.y + (dy * i) / 10, 1);
        await new Promise((res) => setTimeout(res, 16));
      }
      fire(end === "up" ? "pointerup" : "pointercancel", r.x + dx, r.y + dy, 0);
    },
    { r, dx, dy, end },
  );
}

/** A later, unrelated finger movement elsewhere on the page. */
async function strayTouch(page: Page) {
  await page.evaluate(() => {
    const fire = (type: string, y: number) =>
      document.body.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          pointerId: 52,
          pointerType: "touch",
          isPrimary: true,
          buttons: type === "pointerup" ? 0 : 1,
          clientX: 40,
          clientY: y,
        }),
      );
    fire("pointerdown", 600);
    for (let y = 590; y > 300; y -= 30) fire("pointermove", y);
    fire("pointerup", 300);
  });
}

async function checkPanel(
  page: Page,
  panel: Locator,
  handle: Locator,
  touch: boolean,
  shot: string,
) {
  await expect(panel).toBeVisible();
  // Let the open animation (fade + zoom-in-95) finish: measuring mid-scale
  // shifts the panel's edges by several pixels.
  await panel.evaluate((el) =>
    Promise.all(
      [el, ...Array.from(el.querySelectorAll("*"))]
        .flatMap((n) => n.getAnimations())
        .map((a) => a.finished.catch(() => {})),
    ),
  );
  await page.waitForTimeout(100);
  const css = await handle.evaluate((el) => getComputedStyle(el).touchAction);
  expect(css).toBe("none");

  // Measure the handle: the panel may move by a transform on an inner element.
  // Drag towards the roomier side so the on-screen clamp does not interfere.
  const start = await box(handle);
  const room = await handle.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      // On a phone the panel fills the width, so it can only move vertically.
      dx:
        r.width > window.innerWidth - 150
          ? 0
          : r.left + r.width / 2 > window.innerWidth / 2
            ? -60
            : 60,
      dy: r.top + r.height / 2 > window.innerHeight / 2 ? -80 : 80,
    };
  });
  await dragHandle(page, handle, room.dx, room.dy, touch);
  const moved = await box(handle);
  expect(Math.abs(moved.x - start.x - room.dx)).toBeLessThanOrEqual(4);
  expect(Math.abs(moved.y - start.y - room.dy)).toBeLessThanOrEqual(4);
  await page.screenshot({ path: shot, animations: "disabled" });

  if (touch) {
    // Safari taking the gesture over must still end the drag.
    await dragHandle(page, handle, -room.dx / 2, -room.dy / 2, true, "cancel");
    const afterCancel = await box(handle);
    await strayTouch(page);
    expect(await box(handle)).toEqual(afterCancel);
  }
  await expect(page.locator("html")).not.toHaveClass(/app-dragging/);
  expect(await page.evaluate(() => String(window.getSelection()))).toBe("");
}

test.describe("draggable panels", () => {
  test("Quick book drags with the finger and never jumps", async ({ page }, info) => {
    await become(page, "owner");
    await page.goto("/dashboard");
    await settle(page, ".page-title");
    await page.getByRole("button", { name: "Quick book" }).first().click();
    const handle = page.locator(".drag-handle", { hasText: "Quick book" }).first();
    const panel = page
      .locator("[data-radix-popper-content-wrapper], [role='dialog']")
      .filter({ has: handle })
      .first();
    await checkPanel(
      page,
      panel,
      handle,
      Boolean(info.project.use.hasTouch),
      shotPath(info.project.name, "panel-drag--quick-book"),
    );
  });

  test("My notes drags with the finger and never jumps", async ({ page }, info) => {
    await become(page, "owner");
    await page.goto("/dashboard");
    await settle(page, ".page-title");
    await page.getByRole("button", { name: "My notes" }).first().click();
    const panel = page.getByRole("dialog", { name: "My notes" });
    const handle = panel.locator(".drag-handle", { hasText: "My notes" }).first();
    await checkPanel(
      page,
      panel,
      handle,
      Boolean(info.project.use.hasTouch),
      shotPath(info.project.name, "panel-drag--my-notes"),
    );
  });
});
