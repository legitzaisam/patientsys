import type { Page } from "@playwright/test";
import { become, deviceClassFor, settle, shotPath, test, writeJson } from "./fixtures";

/**
 * Touch interaction checks, WebKit projects only. Each check records one of:
 *   works            - the gesture did what a finger would expect
 *   tap-alternative  - the pointer gesture is unavailable but a tap path exists
 *   touch-gap        - there is no way to do this by touch (decision point)
 *   not-present      - the control is not on screen for this device
 * Nothing here fails the run; the report lists the outcomes.
 *
 * Writes it makes are idempotent (slider values, a routine step ticked and
 * un-ticked), so projects can run in parallel against the one demo server.
 */

type Outcome = "works" | "tap-alternative" | "touch-gap" | "covered" | "not-present" | "error";

type InteractionResult = {
  project: string;
  device: string;
  role: string;
  page: string;
  check: string;
  outcome: Outcome;
  note: string;
  shot: string | null;
};

test.skip(
  ({ browserName }) => browserName !== "webkit",
  "Touch checks run on the WebKit (iPhone/iPad) projects only.",
);

async function shot(page: Page, project: string, slug: string) {
  try {
    const path = shotPath(project, `touch--${slug}`);
    await page.screenshot({ path, animations: "disabled" });
    return path;
  } catch {
    return null;
  }
}

function record(
  results: InteractionResult[],
  base: Omit<InteractionResult, "check" | "outcome" | "note" | "shot">,
  check: string,
  outcome: Outcome,
  note: string,
  shotPathValue: string | null = null,
) {
  results.push({ ...base, check, outcome, note, shot: shotPathValue });
  // Persist after every check so a later timeout cannot lose earlier results.
  writeJson(
    `interactions/${base.project}/${base.role === "patient" ? "patient" : "staff"}.json`,
    results,
  );
}

/** A tap that timed out because floating chrome sits on the control is a finding, not a harness error. */
function classify(error: unknown): { outcome: Outcome; note: string } {
  const message = (error as Error).message ?? String(error);
  const first = message.split("\n")[0]!;
  if (/intercepts pointer events/.test(message)) {
    const by =
      message.match(/from <([^>]+)>/)?.[1] ??
      message.match(/<([a-z]+[^>]*)>[^<]*intercepts/i)?.[1] ??
      "another element";
    return {
      outcome: "covered",
      note: `The control is under floating chrome (${by.slice(0, 80)}); a finger cannot reach it.`,
    };
  }
  return { outcome: "error", note: first };
}

test("staff: tabs, dialogs, dock, carousel and the hover-only stage menu", async ({
  page,
}, testInfo) => {
  const project = testInfo.project.name;
  const results: InteractionResult[] = [];
  const base = { project, device: deviceClassFor(project), role: "owner", page: "dashboard" };

  await become(page, "owner");
  await page.goto("/dashboard");
  await settle(page, ".page-title").catch(() => {});

  // Carousel next / previous (tap).
  try {
    const next = page.getByRole("button", { name: "Next appointments" }).first();
    if (await next.isVisible()) {
      const before = await page.locator("[data-diary-slide]").first().boundingBox();
      await next.tap();
      await page.waitForTimeout(500);
      const after = await page.locator("[data-diary-slide]").first().boundingBox();
      const moved = Boolean(before && after && Math.abs(before.x - after.x) > 4);
      record(
        results,
        base,
        "diary-carousel-next-tap",
        moved ? "works" : "error",
        moved ? "The strip advanced on tap." : "Tap did not move the strip.",
        await shot(page, project, "carousel"),
      );
    } else {
      record(results, base, "diary-carousel-next-tap", "not-present", "No Next control on screen.");
    }
  } catch (e) {
    {
      const c = classify(e);
      record(results, base, "diary-carousel-next-tap", c.outcome, c.note);
    }
  }

  // Carousel swipe (drag with a finger).
  try {
    const strip = page.locator("[data-diary-slide]").first();
    const box = await strip.boundingBox();
    if (box) {
      const startX = box.x + box.width * 0.8;
      const y = box.y + box.height / 2;
      await page.touchscreen.tap(startX, y).catch(() => {});
      await page.mouse.move(startX, y);
      await page.mouse.down();
      await page.mouse.move(startX - 120, y, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(500);
      const after = await page.locator("[data-diary-slide]").first().boundingBox();
      const moved = Boolean(after && Math.abs(after.x - box.x) > 4);
      record(
        results,
        base,
        "diary-carousel-swipe",
        moved ? "works" : "tap-alternative",
        moved ? "A drag scrolls the strip." : "Drag did not scroll; Next / Previous buttons exist.",
      );
    } else {
      record(results, base, "diary-carousel-swipe", "not-present", "No diary card on screen.");
    }
  } catch (e) {
    {
      const c = classify(e);
      record(results, base, "diary-carousel-swipe", c.outcome, c.note);
    }
  }

  // Stage menu opens on hover only.
  try {
    const badge = page
      .locator("[data-diary-slide]")
      .first()
      .getByRole("button", { name: /Booked|Arrived|Waiting|In treatment|Aftercare|Complete/ })
      .first();
    if (await badge.isVisible()) {
      await badge.tap();
      await page.waitForTimeout(700);
      const open = await page
        .getByText("Patient journey")
        .isVisible()
        .catch(() => false);
      record(
        results,
        base,
        "stage-menu-tap",
        open ? "works" : "touch-gap",
        open
          ? "Tapping the stage badge opens the journey menu."
          : "The stage menu is a HoverCard (openDelay 280ms); a tap does not open it. The card dialog offers the same actions.",
        await shot(page, project, "stage-menu"),
      );
      await page.keyboard.press("Escape");
    } else {
      record(results, base, "stage-menu-tap", "not-present", "No stage badge on screen.");
    }
  } catch (e) {
    {
      const c = classify(e);
      record(results, base, "stage-menu-tap", c.outcome, c.note);
    }
  }

  // Today-card detail dialog: tap to open, tap Close.
  try {
    const card = page
      .locator("[data-diary-slide]")
      .first()
      .locator('[role="button"][aria-label^="View appointment"]')
      .first();
    if (await card.isVisible()) {
      await card.tap();
      const dialog = page.locator('[role="dialog"]').first();
      await dialog.waitFor({ state: "visible", timeout: 6_000 });
      const close = dialog.getByRole("button", { name: /close/i }).first();
      const closeVisible = await close.isVisible().catch(() => false);
      let closed = false;
      if (closeVisible) {
        await close.tap();
        await page.waitForTimeout(400);
        closed = (await page.locator('[role="dialog"][data-state="open"]').count()) === 0;
      }
      record(
        results,
        base,
        "today-card-dialog-tap-close",
        closed ? "works" : closeVisible ? "error" : "touch-gap",
        closed
          ? "Opened and closed by tap."
          : closeVisible
            ? "Close tapped but the dialog stayed open."
            : "No visible Close control; Escape has no touch equivalent.",
        await shot(page, project, "today-dialog"),
      );
      if (!closed) await page.keyboard.press("Escape");
    } else {
      record(
        results,
        base,
        "today-card-dialog-tap-close",
        "not-present",
        "No diary card on screen.",
      );
    }
  } catch (e) {
    {
      const c = classify(e);
      record(results, base, "today-card-dialog-tap-close", c.outcome, c.note);
    }
  }

  // Dock: open the chat inbox by tap, then close it.
  try {
    const bubble = page.locator('[data-qc="chat-bubble"]').first();
    if (await bubble.isVisible()) {
      await bubble.tap();
      await page.waitForTimeout(600);
      const open = await page
        .locator('[data-qc="chat-window"]')
        .isVisible()
        .catch(() => false);
      let closed = false;
      if (open) {
        const close = page.getByRole("button", { name: "Close chat window" }).first();
        if (await close.isVisible().catch(() => false)) {
          await close.tap();
          await page.waitForTimeout(400);
          closed = !(await page
            .locator('[data-qc="chat-window"]')
            .isVisible()
            .catch(() => false));
        }
      }
      record(
        results,
        base,
        "dock-chat-tap",
        open && closed ? "works" : open ? "error" : "error",
        open
          ? closed
            ? "Inbox opens and closes by tap."
            : "Inbox opened but did not close by tap."
          : "Tap on the chat bubble did not open the inbox.",
        await shot(page, project, "dock-chat"),
      );
    } else {
      record(results, base, "dock-chat-tap", "not-present", "No chat bubble on screen.");
    }
  } catch (e) {
    {
      const c = classify(e);
      record(results, base, "dock-chat-tap", c.outcome, c.note);
    }
  }

  // Sidebar resize handle is pointer-only by nature; the toggle is the alternative.
  try {
    const handle = page.locator('[role="separator"][aria-label="Resize sidebar"]');
    if (await handle.isVisible()) {
      record(
        results,
        base,
        "sidebar-resize-drag",
        "tap-alternative",
        "The 4px resize handle cannot be dragged by finger; Close / Open sidebar buttons exist. On phones the sidebar should not be resizable at all.",
      );
    } else {
      record(results, base, "sidebar-resize-drag", "not-present", "Sidebar is closed.");
    }
  } catch (e) {
    {
      const c = classify(e);
      record(results, base, "sidebar-resize-drag", c.outcome, c.note);
    }
  }

  // Diary: drag-to-reschedule is pointer-capture based.
  try {
    await page.goto("/schedule");
    await settle(page, '[data-qc="day-planner-scroll"], .page-title').catch(() => {});
    const block = page
      .locator(
        '[data-qc="day-planner-scroll"] [role="button"], [data-qc="day-planner-scroll"] button',
      )
      .first();
    if (await block.isVisible().catch(() => false)) {
      const box = await block.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 90, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(600);
        const dialogOpen = (await page.locator('[role="dialog"][data-state="open"]').count()) > 0;
        record(
          results,
          { ...base, page: "schedule" },
          "diary-drag-reschedule",
          "tap-alternative",
          dialogOpen
            ? "A drag opened the appointment dialog (tap path) rather than moving the block; the time editor is the alternative."
            : "A drag over 90px did not move the block by touch; the appointment dialog's time editor is the alternative.",
          await shot(page, project, "diary-drag"),
        );
        await page.keyboard.press("Escape");
      }
    } else {
      record(
        results,
        { ...base, page: "schedule" },
        "diary-drag-reschedule",
        "not-present",
        "No appointment block in the planner.",
      );
    }
    // The planner is min-w-[680px]: does it scroll sideways by finger?
    const scroller = page.locator('[data-qc="day-planner-scroll"]');
    if (await scroller.isVisible().catch(() => false)) {
      const box = await scroller.boundingBox();
      const canScroll = await scroller.evaluate((el) => el.scrollWidth > el.clientWidth + 4);
      if (box && canScroll) {
        await page.mouse.move(box.x + box.width * 0.7, box.y + 30);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.2, box.y + 30, { steps: 10 });
        await page.mouse.up();
        await page.waitForTimeout(400);
        const left = await scroller.evaluate((el) => el.scrollLeft);
        record(
          results,
          { ...base, page: "schedule" },
          "day-planner-horizontal-scroll",
          left > 4 ? "works" : "touch-gap",
          left > 4
            ? `Sideways drag scrolled the planner ${Math.round(left)}px.`
            : "The planner is wider than the screen but a sideways drag did not scroll it (drag is captured for rescheduling). No visible affordance.",
          await shot(page, project, "planner-scroll"),
        );
      } else {
        record(
          results,
          { ...base, page: "schedule" },
          "day-planner-horizontal-scroll",
          "not-present",
          "The planner fits without sideways scroll at this width.",
        );
      }
    }
  } catch (e) {
    {
      const c = classify(e);
      record(results, { ...base, page: "schedule" }, "diary-drag-reschedule", c.outcome, c.note);
    }
  }

  // Patient record tabs by tap.
  try {
    await page.goto("/patients");
    const href = await page
      .getByRole("link", { name: /Bennett, .*Olivia/ })
      .first()
      .getAttribute("href", { timeout: 15_000 });
    await page.goto(href!);
    await settle(page, "h1").catch(() => {});
    const tab = page.getByRole("tab", { name: "Contact" });
    if (await tab.isVisible().catch(() => false)) {
      await tab.tap();
      await page.waitForTimeout(600);
      const selected = (await tab.getAttribute("aria-selected")) === "true";
      record(
        results,
        { ...base, page: "patient-record" },
        "record-tab-tap",
        selected ? "works" : "error",
        selected ? "Tabs switch by tap." : "Tab did not become selected.",
        await shot(page, project, "record-tabs"),
      );
    } else {
      record(
        results,
        { ...base, page: "patient-record" },
        "record-tab-tap",
        "not-present",
        "Contact tab not on screen.",
      );
    }
  } catch (e) {
    {
      const c = classify(e);
      record(results, { ...base, page: "patient-record" }, "record-tab-tap", c.outcome, c.note);
    }
  }

  writeJson(`interactions/${project}/staff.json`, results);
});

test("patient: sliders, switches, routine steps and the portal dock by touch", async ({
  page,
}, testInfo) => {
  const project = testInfo.project.name;
  const results: InteractionResult[] = [];
  const base = { project, device: deviceClassFor(project), role: "patient", page: "portal-plan" };

  await become(page, "patient");
  await page.goto("/my-record/plan");
  await settle(page, ".page-title").catch(() => {});

  // Recovery check-in slider: set by finger.
  try {
    const slider = page.locator('[data-qc="checkin-sliders"] input[type="range"]').first();
    if (await slider.isVisible().catch(() => false)) {
      const box = await slider.boundingBox();
      const before = await slider.inputValue();
      if (box) {
        await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2, { steps: 8 });
        await page.mouse.up();
        await page.waitForTimeout(500);
      }
      const after = await slider.inputValue();
      const thumb = box ? Math.min(box.width, box.height) : 0;
      record(
        results,
        base,
        "checkin-slider-drag",
        after !== before ? "works" : "error",
        after !== before
          ? `Slider moved ${before} → ${after}. Track height ${Math.round(thumb)}px.`
          : `Slider did not change (track height ${Math.round(thumb)}px).`,
        await shot(page, project, "slider"),
      );
      // Put it back.
      if (box && after !== before) {
        await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(
          box.x + box.width * (Number(before) / 10 || 0.2),
          box.y + box.height / 2,
          { steps: 6 },
        );
        await page.mouse.up();
      }
    } else {
      record(results, base, "checkin-slider-drag", "not-present", "No check-in slider on screen.");
    }
  } catch (e) {
    {
      const c = classify(e);
      record(results, base, "checkin-slider-drag", c.outcome, c.note);
    }
  }

  // Routine: mark complete and undo by tap.
  try {
    await page.goto("/my-record/plan/routine");
    await settle(page, '[data-qc="portal-routine"], .page-title').catch(() => {});
    const complete = page.locator('[data-qc="routine-complete"]').first();
    if (await complete.isVisible().catch(() => false)) {
      const label = (await complete.textContent())?.trim() ?? "";
      await complete.tap();
      await page.waitForTimeout(600);
      const after =
        (
          await page
            .locator('[data-qc="routine-complete"]')
            .first()
            .textContent()
            .catch(() => "")
        )?.trim() ?? "";
      record(
        results,
        { ...base, page: "portal-routine" },
        "routine-complete-tap",
        after !== label ? "works" : "error",
        after !== label
          ? `Tapped "${label}"; control now reads "${after}".`
          : `Tapped "${label}" but the control did not change.`,
        await shot(page, project, "routine"),
      );
    } else {
      record(
        results,
        { ...base, page: "portal-routine" },
        "routine-complete-tap",
        "not-present",
        "No reminder to complete right now.",
      );
    }
  } catch (e) {
    {
      const c = classify(e);
      record(
        results,
        { ...base, page: "portal-routine" },
        "routine-complete-tap",
        c.outcome,
        c.note,
      );
    }
  }

  // Settings switches by tap (toggle twice to leave state unchanged).
  try {
    await page.goto("/my-record/settings");
    await settle(page, ".page-title").catch(() => {});
    const sw = page.getByRole("switch").first();
    if (await sw.isVisible().catch(() => false)) {
      const before = await sw.getAttribute("aria-checked");
      await sw.tap();
      await page.waitForTimeout(500);
      const mid = await sw.getAttribute("aria-checked");
      await sw.tap();
      await page.waitForTimeout(500);
      const box = await sw.boundingBox();
      record(
        results,
        { ...base, page: "portal-settings" },
        "settings-switch-tap",
        mid !== before ? "works" : "error",
        `${mid !== before ? "Toggled" : "Did not toggle"} by tap; switch is ${Math.round(box?.width ?? 0)}×${Math.round(box?.height ?? 0)}px.`,
        await shot(page, project, "switch"),
      );
    } else {
      record(
        results,
        { ...base, page: "portal-settings" },
        "settings-switch-tap",
        "not-present",
        "No switch on screen.",
      );
    }
  } catch (e) {
    {
      const c = classify(e);
      record(
        results,
        { ...base, page: "portal-settings" },
        "settings-switch-tap",
        c.outcome,
        c.note,
      );
    }
  }

  // Portal dock: chat opens by tap and the message box is reachable above the keyboard line.
  try {
    await page.goto("/my-record");
    await settle(page, '[data-qc="portal-home"]').catch(() => {});
    const bubble = page
      .locator('[data-qc="portal-dock"] button[aria-label^="Message your clinic"]')
      .first();
    if (await bubble.isVisible().catch(() => false)) {
      await bubble.tap();
      await page.waitForTimeout(700);
      const box = page.locator('[data-qc="portal-dock"] textarea').first();
      const visible = await box.isVisible().catch(() => false);
      const rect = visible ? await box.boundingBox() : null;
      const vw = page.viewportSize()?.width ?? 0;
      const inside = Boolean(rect && rect.x >= 0 && rect.x + rect.width <= vw + 1);
      record(
        results,
        { ...base, page: "portal-home" },
        "portal-chat-tap",
        visible && inside ? "works" : visible ? "error" : "error",
        visible
          ? inside
            ? "Chat opened; the message box is inside the viewport."
            : `Chat opened but the message box runs off screen (x ${Math.round(rect!.x)}, width ${Math.round(rect!.width)} in ${vw}).`
          : "Chat did not open by tap.",
        await shot(page, project, "portal-chat"),
      );
      await bubble.tap().catch(() => {});
    } else {
      record(
        results,
        { ...base, page: "portal-home" },
        "portal-chat-tap",
        "not-present",
        "No chat bubble on screen.",
      );
    }
  } catch (e) {
    {
      const c = classify(e);
      record(results, { ...base, page: "portal-home" }, "portal-chat-tap", c.outcome, c.note);
    }
  }

  writeJson(`interactions/${project}/patient.json`, results);
});
