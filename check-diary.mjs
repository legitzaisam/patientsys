import { chromium } from "@playwright/test";
const BASE = "http://localhost:8080";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
await ctx.addCookies([{ name: "demo_role", value: "owner", domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
const hits = page.getByText("Isabella Rossi");
console.log("Isabella mentions on dashboard:", await hits.count());
for (let i = 0; i < (await hits.count()); i++) {
  const el = hits.nth(i);
  const box = el.locator("xpath=ancestor::li[1]");
  console.log(`--- ${i} (li? ${await box.count()})`);
  console.log((await (await box.count() ? box : el).first().innerText()).replace(/\n/g, " | "));
}
await page.screenshot({ path: "/tmp/diary.png", fullPage: true });
await browser.close();
