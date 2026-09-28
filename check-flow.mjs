import { chromium } from "@playwright/test";

const BASE = "http://localhost:8080";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
await ctx.addCookies([{ name: "demo_role", value: "owner", domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

const today = new Date();
const ymd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
const planCard = () => page.locator('[data-qc="treatment-plan-card"]').first();

async function hrefFor(name) {
  await page.goto(`${BASE}/patients?tab=board`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2200);
  const card = page.locator('[data-qc="board-card"]', { hasText: name }).first();
  return (await card.locator("a").first().getAttribute("href")).split("?")[0];
}
async function dump(tag, href) {
  await page.goto(`${BASE}${href}?tab=treatments`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  console.log(`${tag} ${(await planCard().innerText()).split("\n").filter(Boolean).slice(2).join(" | ")}`);
}
async function bookStep({ treatmentMatch, time }) {
  await page.locator('[data-qc="plan-book"]').first().click();
  await page.waitForTimeout(900);
  const d = page.locator('[role="dialog"]').first();
  const sel = d.locator("select").first();
  const opts = (await sel.locator("option").allTextContents()).slice(1);
  const label = opts.find((o) => treatmentMatch.test(o)) ?? opts[0];
  await sel.selectOption({ label });
  await d.locator('input[type="date"]').first().fill(ymd);
  await d.locator('input[type="time"]').first().fill(time);
  await d.getByRole("button", { name: /Book appointment/i }).click();
  await page.waitForTimeout(2500);
  return label;
}
/** The dashboard diary is a horizontal carousel; page to the card we want. */
async function diaryCard(patient) {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const card = page.getByLabel(`View appointment for ${patient}`).last();
  for (let i = 0; i < 15; i++) {
    const box = await card.boundingBox().catch(() => null);
    if (box && box.x >= 0 && box.x + box.width <= 1500) return card;
    const next = page.getByRole("button", { name: "Next appointments" });
    if (!(await next.count())) break;
    await next.click();
    await page.waitForTimeout(600);
  }
  return card;
}
async function setStageToday({ patient, stage }) {
  const card = await diaryCard(patient);
  await card.getByRole("button", { name: /^(Booked|Arrived|Waiting|Complete|No show)$/ }).first().click();
  await page.waitForTimeout(900);
  await page.getByRole("button", { name: stage, exact: true }).last().click();
  await page.waitForTimeout(1500);
}

// ================= A. explicit link beats treatment match =================
const rossi = await hrefFor("Isabella Rossi");
await dump("A1 before          ", rossi);
await page.goto(`${BASE}${rossi}?tab=treatments`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const bookedAs = await bookStep({ treatmentMatch: /^Hydrafacial$/i, time: "18:30" });
console.log(`   booked a deliberately different treatment: "${bookedAs}"`);
await dump("A2 after booking   ", rossi);

// ---- no show on that booking
await setStageToday({ patient: "Isabella Rossi", stage: "No show" });
const later = page.getByRole("button", { name: /follow up later/i });
if (await later.count()) {
  await later.click();
  await page.waitForTimeout(700);
  const add = page.getByRole("button", { name: /^(Add|Create|Save)/i }).last();
  if (await add.count()) await add.click();
  await page.waitForTimeout(1200);
}
await page.keyboard.press("Escape");
await dump("A3 after no show   ", rossi);

// ================= B. cancelling brings overdue back =================
const harriet = await hrefFor("Harriet Blackwood");
await dump("B1 before          ", harriet);
await page.goto(`${BASE}${harriet}?tab=treatments`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await bookStep({ treatmentMatch: /consult/i, time: "19:15" });
await dump("B2 after booking   ", harriet);

const hrow = await diaryCard("Harriet Blackwood");
await hrow.click();
await page.waitForTimeout(1200);
const cancelBtn = page.getByRole("button", { name: /^Cancel appointment$/i }).first();
if (await cancelBtn.count()) {
  await cancelBtn.click();
  await page.waitForTimeout(700);
  await page.getByLabel(/Reason for cancelling/i).fill("Patient asked to move it");
  await page.getByRole("button", { name: /^Confirm cancel$/i }).click();
  await page.waitForTimeout(1800);
} else {
  console.log("   !! cancel control not found:", await page.locator('[role="dialog"]').last().innerText());
}
await page.keyboard.press("Escape");
await dump("B3 after cancel    ", harriet);

// ================= attention =================
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(2800);
for (const kind of ["no_show", "treatment_due"]) {
  const h = page.locator(`[data-qc="attention-kind-${kind}"]`);
  if (!(await h.count())) { console.log(`\n== ${kind}: absent`); continue; }
  const group = h.locator("xpath=ancestor::section[1]");
  if ((await group.locator("ul").count()) === 0) await h.click();
  await page.waitForTimeout(400);
  const more = group.getByRole("button", { name: /Show \d+ more/ });
  if (await more.count()) await more.click();
  await page.waitForTimeout(400);
  console.log(`\n== ${kind}\n   ${(await group.innerText()).split("\n").filter(Boolean).slice(2).join("\n   ")}`);
}

await browser.close();
