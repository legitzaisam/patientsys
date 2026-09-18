#!/usr/bin/env node
/**
 * QC for the voice call button + AI patient responder (demo).
 *
 * Two servers:
 *   node scripts/qc-voice-ai.mjs [plainURL] [voiceURL]
 * - plainURL (default http://localhost:8080): normal `npm run dev:demo`,
 *   no Twilio vars, no COHERE_API_KEY — asserts the disabled call button and
 *   the canned AI reply with its typing bubble.
 * - voiceURL (default http://localhost:8083): dev:demo started with dummy
 *   TWILIO_* vars — asserts the enabled button, the call strip appearing,
 *   and a graceful error (dummy credentials can never connect).
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const PLAIN = process.argv[2] ?? "http://localhost:8080";
const VOICE = process.argv[3] ?? "http://localhost:8083";
const SHOT_DIR = "/tmp/qc-voice-ai";
mkdirSync(SHOT_DIR, { recursive: true });

const results = [];
const pass = (name, note = "") => {
  results.push({ ok: true });
  console.log(`  PASS  ${name}${note ? ` — ${note}` : ""}`);
};
const fail = (name, note = "") => {
  results.push({ ok: false });
  console.log(`  FAIL  ${name}${note ? ` — ${note}` : ""}`);
};

async function openFirstThread(page, base) {
  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-qc="chat-bubble"]', { timeout: 20000 });
  await page.click('[data-qc="chat-bubble"]');
  await page.waitForSelector('[data-qc="chat-window"]', { timeout: 5000 });
  const first = page.locator('[data-qc="chat-window"] ul button').first();
  await first.waitFor({ timeout: 10000 });
  await first.click();
  await page.waitForSelector('[data-qc="chat-window"] textarea', { timeout: 8000 });
}

const browser = await chromium.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});

console.log(`\nQC: voice call + AI patient — plain=${PLAIN} voice=${VOICE}\n`);

/* 1 ── Unconfigured: call button disabled with explanatory tooltip */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await openFirstThread(page, PLAIN);
    const btn = page.locator('[data-qc="call-button"]');
    if (await btn.isVisible()) pass("call button present in the thread header");
    else fail("call button present in the thread header");
    if (await btn.isDisabled()) pass("unconfigured env — call button disabled");
    else fail("unconfigured env — call button disabled");
    const title = (await btn.getAttribute("title")) ?? "";
    if (title.includes("voice-call-setup")) pass("disabled tooltip points at docs/voice-call-setup.md");
    else fail("disabled tooltip points at docs/voice-call-setup.md", title);

    /* 2 ── AI patient: send -> typing bubble -> canned reply */
    const probe = `Hello! Quick QC check ${Date.now()}`;
    await page.fill('[data-qc="chat-window"] textarea', probe);
    await page.click('[data-qc="chat-window"] [aria-label="Send message"]');
    await page.waitForSelector(`.staff-chat-bubble--out:has-text("QC check")`, { timeout: 8000 });
    pass("staff message sends");

    const typing = await page
      .waitForSelector('[data-qc="typing-bubble"]', { timeout: 12000 })
      .then(() => true)
      .catch(() => false);
    if (typing) pass("typing bubble appears while the AI patient composes");
    else fail("typing bubble appears while the AI patient composes");
    await page.screenshot({ path: `${SHOT_DIR}/1-typing.png` });

    // Reply lands (canned fallback without COHERE_API_KEY), typing clears.
    const beforeCount = await page.locator(".staff-chat-bubble--in").count();
    const replied = await page
      .waitForFunction(
        (prev) => document.querySelectorAll(".staff-chat-bubble--in").length > prev,
        beforeCount - (typing ? 1 : 0),
        { timeout: 20000 },
      )
      .then(() => true)
      .catch(() => false);
    // typing bubble also uses --in styling; wait for it to be replaced by a real reply
    await page.waitForSelector('[data-qc="typing-bubble"]', { state: "detached", timeout: 20000 }).catch(() => {});
    const replyVisible = replied && (await page.locator('[data-qc="typing-bubble"]').count()) === 0;
    if (replyVisible) pass("AI patient reply lands and the typing bubble clears");
    else fail("AI patient reply lands and the typing bubble clears");
    await page.screenshot({ path: `${SHOT_DIR}/2-reply.png` });

    if (errors.length === 0) pass("plain server: zero page errors");
    else fail("plain server: zero page errors", errors.join(" | ").slice(0, 300));
  } catch (err) {
    fail("plain-server scenario", String(err.message).split("\n")[0]);
    await page.screenshot({ path: `${SHOT_DIR}/plain-error.png` }).catch(() => {});
  } finally {
    await context.close();
  }
}

/* 3 ── Configured (dummy creds): button enabled, strip appears, fails gracefully */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await openFirstThread(page, VOICE);
    const btn = page.locator('[data-qc="call-button"]');
    if (await btn.isEnabled()) pass("configured env — call button enabled");
    else fail("configured env — call button enabled");

    await btn.click();
    const strip = await page
      .waitForSelector('[data-qc="call-strip"]', { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    if (strip) pass("call strip appears after clicking Call");
    else fail("call strip appears after clicking Call");
    await page.screenshot({ path: `${SHOT_DIR}/3-call-strip.png` });

    // Dummy credentials can never reach Twilio: expect a graceful error state
    // (strip shows the failure, window keeps working, no page crash).
    await page
      .waitForFunction(
        () => {
          const el = document.querySelector('[data-qc="call-strip"]');
          return !el || /failed|error|ended|not configured|denied|token|connect/i.test(el.textContent ?? "");
        },
        undefined,
        { timeout: 25000 },
      )
      .catch(() => {});
    const stripText = ((await page.locator('[data-qc="call-strip"]').textContent().catch(() => "")) ?? "").trim();
    const composerAlive = await page.locator('[data-qc="chat-window"] textarea').isVisible();
    if (composerAlive) pass("chat window survives the failed call", stripText.slice(0, 60));
    else fail("chat window survives the failed call");
    await page.screenshot({ path: `${SHOT_DIR}/4-call-error.png` });

    if (errors.length === 0) pass("voice server: zero page errors (graceful failure)");
    else fail("voice server: zero page errors (graceful failure)", errors.join(" | ").slice(0, 300));
  } catch (err) {
    fail("voice-server scenario", String(err.message).split("\n")[0]);
    await page.screenshot({ path: `${SHOT_DIR}/voice-error.png` }).catch(() => {});
  } finally {
    await context.close();
  }
}

await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed. Screenshots: ${SHOT_DIR}\n`);
process.exit(failed ? 1 : 0);
