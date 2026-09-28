import { chromium } from "@playwright/test";

const BASE = "http://localhost:8080";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
await ctx.addCookies([{ name: "demo_role", value: "owner", domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

// ---- Dashboard attention
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
for (const kind of ["no_show", "treatment_due"]) {
  const h = page.locator(`[data-qc="attention-kind-${kind}"]`);
  if (!(await h.count())) {
    console.log(`\n== ${kind}: absent`);
    continue;
  }
  const group = h.locator("xpath=ancestor::section[1]");
  if ((await group.locator("ul").count()) === 0) await h.click();
  await page.waitForTimeout(400);
  const more = group.getByRole("button", { name: /Show \d+ more/ });
  if (await more.count()) await more.click();
  await page.waitForTimeout(400);
  console.log(`\n== ${kind}`);
  console.log(
    (await group.first().innerText())
      .split("\n")
      .filter(Boolean)
      .map((l) => "   " + l)
      .join("\n"),
  );
}
await page.screenshot({ path: "/tmp/step-dashboard.png", fullPage: false });

// ---- Patient records via the board's links
await page.goto(`${BASE}/patients?tab=board`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const wanted = ["Isabella Rossi", "Oliver Ashworth", "Priya Chandrasekhar"];
const links = {};
const cards = page.locator('[data-qc="board-card"]');
for (let i = 0; i < (await cards.count()); i++) {
  const c = cards.nth(i);
  const t = await c.innerText();
  const name = wanted.find((w) => t.includes(w));
  if (name) links[name] = await c.locator("a").first().getAttribute("href");
}

for (const name of wanted) {
  const href = links[name];
  if (!href) {
    console.log(`\n---- ${name}: not on board`);
    continue;
  }
  await page.goto(`${BASE}${href.split("?")[0]}?tab=treatments`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const card = page.locator('[data-qc="treatment-plan-card"]');
  console.log(`\n---- ${name} ----`);
  console.log(
    (await card.first().innerText())
      .split("\n")
      .filter(Boolean)
      .map((l) => "   " + l)
      .join("\n"),
  );
  await page.screenshot({ path: `/tmp/step-${name.split(" ")[0].toLowerCase()}.png` });
}

await browser.close();
