import { webkit, devices } from "@playwright/test";

const BASE = process.env.AETHERIA_URL ?? "http://localhost:8080";

async function openPad(device) {
  const browser = await webkit.launch({ headless: false });
  const context = await browser.newContext({ ...device });
  await context.addCookies([{ name: "demo_role", value: "owner", url: BASE }]);
  await context.addInitScript(() => {
    try {
      sessionStorage.setItem("aetheria.dock-alerts-seen", "9999");
    } catch {
      /* ignore */
    }
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".page-title", { timeout: 25_000 });
}

await Promise.all([
  openPad(devices["iPad Mini"]),
  openPad(devices["iPad Mini landscape"]),
]);

await new Promise(() => {});
