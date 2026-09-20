#!/usr/bin/env node
/**
 * QC suite for the two-bubble floating dock (alert bubble + chat bubble).
 *
 * Run against a demo server:   npm run dev:demo   (default http://localhost:8080)
 *   node scripts/qc-floating-dock.mjs [baseURL]
 *
 * Covers: corner ownership (only the dock is fixed bottom-right), alert peek
 * auto-collapse + once-per-session memory, alert panel actions (Arrived /
 * Acknowledge) decrementing the badge, chat inbox -> thread -> send flow,
 * record-page minimise -> bubble -> floating window -> dock-back, patient role
 * seeing neither bubble, no bounding-box overlaps, zero console/page errors.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:8080";
const SHOT_DIR = "/tmp/qc-dock";
mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
const consoleErrors = [];

function pass(name, note = "") {
  results.push({ name, ok: true, note });
  console.log(`  PASS  ${name}${note ? ` — ${note}` : ""}`);
}
function fail(name, note = "") {
  results.push({ name, ok: false, note });
  console.log(`  FAIL  ${name}${note ? ` — ${note}` : ""}`);
}

/** New context per scenario: fresh session/local storage (peek memory, chat dock state). */
async function scenario(browser, name, { role } = {}, fn) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (role) {
    const { hostname } = new URL(BASE);
    await context.addCookies([{ name: "demo_role", value: role, domain: hostname, path: "/" }]);
  }
  const page = await context.newPage();
  page.on("pageerror", (err) => consoleErrors.push(`[${name}] pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (text.includes("favicon") || text.includes("React DevTools")) return;
    consoleErrors.push(`[${name}] console: ${text.slice(0, 300)}`);
  });
  try {
    await fn(page);
  } catch (err) {
    fail(name, String(err.message ?? err).split("\n")[0]);
    await page.screenshot({ path: `${SHOT_DIR}/${name}-error.png`, fullPage: false }).catch(() => {});
  } finally {
    await context.close();
  }
}

const dockSel = '[data-qc="floating-dock"]';
const alertBubble = '[data-qc="alert-bubble"]';
const alertPanel = '[data-qc="alert-panel"]';
const chatBubble = '[data-qc="chat-bubble"]';
const chatWindow = '[data-qc="chat-window"]';

async function badgeCount(page) {
  const bubble = page.locator(alertBubble);
  if (!(await bubble.isVisible().catch(() => false))) return 0;
  const text =
    (await bubble.locator(".tabular-nums").first().textContent().catch(() => null)) ??
    (await bubble.locator("span").first().textContent()) ??
    "0";
  return text.trim() === "9+" ? 10 : Number(text.trim()) || 0;
}

/** Fixed-position elements inside the bottom-right corner region that are not the dock. */
async function cornerIntruders(page) {
  return page.evaluate(() => {
    const out = [];
    const W = window.innerWidth;
    const H = window.innerHeight;
    for (const el of document.querySelectorAll("body *")) {
      const style = getComputedStyle(el);
      if (style.position !== "fixed" || style.display === "none" || style.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Corner region: right 340px x bottom 340px (covers bubbles + open surfaces).
      if (r.right < W - 340 || r.bottom < H - 340) continue;
      if (el.closest('[data-qc="floating-dock"]')) continue;
      if (el.closest("[data-sonner-toaster]")) continue; // transient toasts live above by design
      if (el.closest("[data-radix-popper-content-wrapper], [role=dialog]")) continue; // modals are user-invoked
      out.push(`${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")}`);
    }
    return out;
  });
}

async function boxesOverlap(page, selA, selB) {
  const a = await page.locator(selA).boundingBox().catch(() => null);
  const b = await page.locator(selB).boundingBox().catch(() => null);
  if (!a || !b) return false;
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

const browser = await chromium.launch();

console.log(`\nQC: two-bubble floating dock — ${BASE}\n`);

/* 1 ── Corner ownership + overlap, staff dashboard */
await scenario(browser, "corner-ownership", {}, async (page) => {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForSelector(dockSel, { timeout: 15000 });
  await page.waitForSelector(chatBubble, { timeout: 15000 });
  pass("dock and chat bubble mount on dashboard");

  // Let the initial peek (if any) play out so the corner is at rest.
  await page.waitForTimeout(9500);

  const intruders = await cornerIntruders(page);
  if (intruders.length === 0) pass("only the dock is fixed in the bottom-right corner");
  else fail("only the dock is fixed in the bottom-right corner", intruders.join(", "));

  const launchers =
    (await page.locator(`${dockSel} ${alertBubble}:visible`).count()) +
    (await page.locator(`${dockSel} ${chatBubble}:visible`).count());
  const count = await badgeCount(page);
  if (count > 0 ? launchers === 2 : launchers === 1) {
    pass("exactly two launchers (alert auto-hides at zero)", `alerts=${count}, launchers=${launchers}`);
  } else {
    fail("exactly two launchers (alert auto-hides at zero)", `alerts=${count}, launchers=${launchers}`);
  }

  if (await boxesOverlap(page, alertBubble, chatBubble)) fail("alert and chat bubbles do not overlap");
  else pass("alert and chat bubbles do not overlap");

  const switcher = page.locator("div.fixed.bottom-5.left-5");
  if (await switcher.isVisible().catch(() => false)) {
    const overlaps =
      (await boxesOverlap(page, "div.fixed.bottom-5.left-5", chatBubble)) ||
      (await boxesOverlap(page, "div.fixed.bottom-5.left-5", alertBubble));
    if (overlaps) fail("demo role switcher clear of the dock");
    else pass("demo role switcher sits bottom-left, clear of the dock");
  } else {
    fail("demo role switcher visible bottom-left");
  }
  await page.screenshot({ path: `${SHOT_DIR}/1-dashboard-rest.png` });
});

/* 2 ── Peek: auto-opens on first sight of alerts, collapses ≤8s, no replay */
await scenario(browser, "alert-peek", {}, async (page) => {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(dockSel, { timeout: 15000 });

  let peeked = false;
  try {
    await page.waitForSelector(`${alertPanel}:visible`, { timeout: 12000 });
    peeked = true;
    pass("new alerts peek open automatically");
    await page.screenshot({ path: `${SHOT_DIR}/2-peek-open.png` });
  } catch {
    const count = await badgeCount(page);
    if (count === 0) pass("no alerts in fixture window — peek not applicable", "skipped");
    else fail("new alerts peek open automatically", `badge=${count} but panel never peeked`);
  }

  if (peeked) {
    await page.waitForSelector(`${alertPanel}:visible`, { state: "detached", timeout: 11000 }).catch(() => {});
    const stillOpen = await page.locator(`${alertPanel}:visible`).count();
    if (stillOpen === 0) pass("peek auto-collapses into the bubble within ~8s");
    else fail("peek auto-collapses into the bubble within ~8s");

    await page.reload({ waitUntil: "networkidle" });
    await page.waitForSelector(dockSel, { timeout: 15000 });
    await page.waitForTimeout(4000);
    const reopened = await page.locator(`${alertPanel}:visible`).count();
    if (reopened === 0) pass("peek does not replay for already-seen alerts (session memory)");
    else fail("peek does not replay for already-seen alerts (session memory)");
  }
});

/* 3 ── Alert panel: open via bubble, actions decrement the badge */
await scenario(browser, "alert-actions", {}, async (page) => {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForSelector(dockSel, { timeout: 15000 });
  await page.waitForTimeout(9500); // let peek finish

  const before = await badgeCount(page);
  if (before === 0) {
    pass("alert actions — no alerts in window", "skipped");
    return;
  }
  await page.click(alertBubble);
  await page.waitForSelector(`${alertPanel}:visible`, { timeout: 5000 });
  pass("alert bubble opens the panel", `badge=${before}`);
  await page.screenshot({ path: `${SHOT_DIR}/3-alert-panel.png` });

  const arrived = page.locator(`${alertPanel} button`, { hasText: "Arrived" }).first();
  const acknowledge = page.locator(`${alertPanel} button`, { hasText: "Acknowledge" }).first();
  const action = (await arrived.isVisible().catch(() => false))
    ? { btn: arrived, label: "Arrived" }
    : (await acknowledge.isVisible().catch(() => false))
      ? { btn: acknowledge, label: "Acknowledge" }
      : null;
  if (!action) {
    fail("alert card exposes its actions inside the panel");
    return;
  }
  await action.btn.click();
  await page.waitForFunction(
    ({ sel, prev }) => {
      const el = document.querySelector(sel);
      if (!el) return true; // bubble gone entirely = count hit zero
      const t =
        el.querySelector(".tabular-nums")?.textContent?.trim() ??
        el.querySelector("span")?.textContent?.trim() ??
        "0";
      return (t === "9+" ? 10 : Number(t) || 0) < prev;
    },
    { sel: alertBubble, prev: before },
    { timeout: 8000 },
  );
  pass(`${action.label} action works and the badge decrements`, `was ${before}`);
});

/* 4 ── Chat: bubble -> inbox -> thread -> send -> unread clears */
await scenario(browser, "chat-flow", {}, async (page) => {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForSelector(chatBubble, { timeout: 15000 });
  await page.click(chatBubble);
  await page.waitForSelector(`${chatWindow}:visible`, { timeout: 5000 });
  pass("chat bubble opens the floating window on the dashboard");

  const threads = page.locator(`${chatWindow} ul button`);
  await threads.first().waitFor({ timeout: 8000 });
  const threadCount = await threads.count();
  pass("inbox lists recent patient conversations", `${threadCount} threads`);
  await page.screenshot({ path: `${SHOT_DIR}/4-chat-inbox.png` });

  // Prefer a thread with unread so we can watch it clear.
  let target = threads.first();
  for (let i = 0; i < threadCount; i += 1) {
    const badge = threads.nth(i).locator("span.bg-destructive");
    if (await badge.isVisible().catch(() => false)) {
      target = threads.nth(i);
      break;
    }
  }
  const hadUnread = await target.locator("span.bg-destructive").isVisible().catch(() => false);
  const threadName = (await target.locator("span span span").first().textContent())?.trim();
  await target.click();
  await page.waitForSelector(`${chatWindow} textarea`, { timeout: 8000 });
  pass("thread view opens with a composer", threadName ?? "");

  const probe = `QC dock check ${Date.now()}`;
  await page.fill(`${chatWindow} textarea`, probe);
  await page.click(`${chatWindow} [aria-label="Send message"]`);
  await page.waitForSelector(`${chatWindow} .staff-chat-bubble--out:has-text("${probe}")`, { timeout: 8000 });
  pass("sending a message renders it in the thread");
  await page.screenshot({ path: `${SHOT_DIR}/4-chat-thread.png` });

  await page.click(`${chatWindow} [aria-label="Back to conversations"]`);
  await threads.first().waitFor({ timeout: 8000 });
  if (hadUnread) {
    // The inbox refetches after markMessagesRead — poll instead of a one-shot read.
    const cleared = await page
      .locator(`${chatWindow} ul button`, { hasText: threadName ?? "" })
      .first()
      .locator("span.bg-destructive")
      .waitFor({ state: "detached", timeout: 8000 })
      .then(() => true)
      .catch(() => false);
    if (cleared) pass("opening a thread clears its unread badge");
    else fail("opening a thread clears its unread badge");
  } else {
    pass("unread clearing — no unread thread available", "skipped");
  }

  await page.keyboard.press("Escape");
  await page.waitForSelector(`${chatWindow}:visible`, { state: "detached", timeout: 4000 }).catch(() => {});
  const open = await page.locator(`${chatWindow}:visible`).count();
  if (open === 0) pass("Escape closes the chat window");
  else fail("Escape closes the chat window");
});

/* 5 ── Record page: docked panel <-> bubble <-> floating window <-> dock-back */
await scenario(browser, "record-dock", {}, async (page) => {
  await page.goto(`${BASE}/patients?tab=records`, { waitUntil: "networkidle" });
  const firstPatient = page.locator('table a[href^="/patients/"]').first();
  await firstPatient.waitFor({ timeout: 15000 });
  await firstPatient.click();
  await page.waitForSelector("#patient-chat", { timeout: 15000 });
  pass("record page shows the docked chat panel");

  const bubbleWhileDocked = await page.locator(`${chatBubble}:visible`).count();
  if (bubbleWhileDocked === 0) pass("chat bubble hides while the panel is docked");
  else fail("chat bubble hides while the panel is docked");

  await page.click('[aria-label="Minimise chat"]');
  await page.waitForSelector(`${chatBubble}:visible`, { timeout: 5000 });
  const panelGone = (await page.locator("#patient-chat:visible").count()) === 0;
  if (panelGone) pass("minimise collapses the docked column and shows the bubble");
  else fail("minimise collapses the docked column and shows the bubble");

  await page.click(chatBubble);
  await page.waitForSelector(`${chatWindow}:visible`, { timeout: 5000 });
  const dockBack = page.locator('[aria-label="Dock chat to the page"]');
  const opensOnPatient = await dockBack.isVisible().catch(() => false);
  if (opensOnPatient) pass("bubble opens the floating window directly on this patient");
  else fail("bubble opens the floating window directly on this patient");
  await page.screenshot({ path: `${SHOT_DIR}/5-record-floating.png` });

  await dockBack.click();
  await page.waitForSelector("#patient-chat", { timeout: 5000 });
  const windowGone = (await page.locator(`${chatWindow}:visible`).count()) === 0;
  const bubbleGone = (await page.locator(`${chatBubble}:visible`).count()) === 0;
  if (windowGone && bubbleGone) pass("dock-back restores the side column and hides bubble + window");
  else fail("dock-back restores the side column and hides bubble + window", `windowGone=${windowGone} bubbleGone=${bubbleGone}`);
});

/* 6 ── Staff pages beyond the dashboard get the dock too */
await scenario(browser, "staff-pages", {}, async (page) => {
  for (const path of ["/insights", "/patients?tab=board", "/retention", "/schedule"]) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    const has = await page
      .waitForSelector(`${chatBubble}`, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    if (has) pass(`chat bubble present on ${path}`);
    else fail(`chat bubble present on ${path}`);
  }
});

/* 7 ── Patient role sees neither bubble */
await scenario(browser, "patient-role", { role: "patient" }, async (page) => {
  await page.goto(`${BASE}/my-record`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const dock = await page.locator(dockSel).count();
  const bubbles =
    (await page.locator(`${chatBubble}:visible`).count()) + (await page.locator(`${alertBubble}:visible`).count());
  if (dock === 0 && bubbles === 0) pass("patient role sees no dock and no bubbles");
  else fail("patient role sees no dock and no bubbles", `dock=${dock} bubbles=${bubbles}`);
  await page.screenshot({ path: `${SHOT_DIR}/7-patient-role.png` });
});

await browser.close();

/* ── Console / page errors across all scenarios ── */
if (consoleErrors.length === 0) pass("zero console errors and page errors across all scenarios");
else fail("zero console errors and page errors across all scenarios", `\n    ${consoleErrors.join("\n    ")}`);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed. Screenshots: ${SHOT_DIR}\n`);
process.exit(failed.length ? 1 : 0);
