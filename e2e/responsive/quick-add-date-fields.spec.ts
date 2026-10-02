import { become, expect, settle, test } from "./fixtures";

/**
 * Quick add carries a leading icon inside its Date and Time fields and keeps
 * the value clear of it with padding-left. iOS Safari lays a native date
 * control out itself and ignores that padding unless the native appearance is
 * dropped, which is how the date ended up printed under the icon on iPad.
 * This guards both halves of that contract on every device in the matrix.
 */
test("Quick add keeps the date and time values clear of their icons", async ({ page }, info) => {
  await become(page, "owner");
  await page.goto("/schedule");
  await settle(page, "[data-diary-col]");

  const slots = page.locator("[data-diary-col] > button");
  const empty = await slots.evaluateAll((els) =>
    els.findIndex((el) => !el.textContent?.trim() && el.getBoundingClientRect().height >= 20),
  );
  if (empty < 0) test.skip(true, "this layout has no empty day-planner slot to open Quick add on");

  const slot = slots.nth(empty);
  if (info.project.use.hasTouch) await slot.tap();
  else await slot.click();

  const quickAdd = page
    .getByRole("dialog")
    .filter({ has: page.locator('input[type="time"]') })
    .first();
  await expect(quickAdd).toBeVisible();

  for (const type of ["date", "time"]) {
    const input = quickAdd.locator(`input[type="${type}"]`).first();
    const field = await input.evaluate((el: HTMLInputElement) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      // The shell renders zoomed on iPad, so rects are in visual pixels while
      // computed lengths are not: scale the padding before comparing them.
      const zoom = rect.width / el.offsetWidth;
      const icon = el.parentElement?.querySelector("svg")?.getBoundingClientRect();
      return {
        appearance: style.appearance,
        iconRight: icon ? icon.right : null,
        valueStart:
          rect.left + (parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth)) * zoom,
      };
    });

    expect(field.appearance, `${type} field must drop the native appearance`).toBe("none");
    expect(field.iconRight, `${type} field should have a leading icon`).not.toBeNull();
    expect(
      Math.round(field.valueStart),
      `${type} value starts right of its icon`,
    ).toBeGreaterThanOrEqual(Math.round(field.iconRight!));
  }
});
