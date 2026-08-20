import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:8081";
const OUT = __dirname;

const shots = [
  { name: "01-landing", path: "/", fullPage: true },
  { name: "02-auth", path: "/auth", fullPage: true },
  { name: "03-dashboard-sidebar", path: "/dashboard", fullPage: false },
  { name: "05-schedule", path: "/schedule", fullPage: false },
  { name: "06-patients", path: "/patients", fullPage: false },
  { name: "07-retention", path: "/retention", fullPage: true },
  { name: "08-settings", path: "/settings", fullPage: true },
  { name: "09-team", path: "/team", fullPage: false },
];

async function waitForApp(page) {
  await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  // Demo identity / data settle
  await page.waitForTimeout(1200);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  await context.addCookies([
    { name: "demo_role", value: "owner", url: BASE },
  ]);
  const page = await context.newPage();

  for (const shot of shots) {
    const url = `${BASE}${shot.path}`;
    process.stdout.write(`Capturing ${shot.name} ← ${url}\n`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await waitForApp(page);
    // Hide demo role switcher so screenshots stay product-focused
    await page.addStyleTag({
      content: ".fixed.bottom-5.right-5 { display: none !important; }",
    });
    const file = path.join(OUT, `${shot.name}.png`);
    await page.screenshot({ path: file, fullPage: shot.fullPage });
  }

  // Collapsed sidebar view
  process.stdout.write("Capturing 10-sidebar-collapsed\n");
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await waitForApp(page);
  await page.addStyleTag({
    content: ".fixed.bottom-5.right-5 { display: none !important; }",
  });
  const collapse = page.getByRole("button", { name: "Close sidebar" });
  if (await collapse.count()) {
    await collapse.click();
    await page.waitForTimeout(400);
  }
  await page.screenshot({
    path: path.join(OUT, "10-sidebar-collapsed.png"),
    fullPage: false,
  });

  await browser.close();
  process.stdout.write("Done.\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
