/**
 * Capture clinic-portal screenshots from the demo app.
 *
 * Usage (Playwright must resolve from cwd):
 *   DEMO=1 npx vite dev --port 5174 --strictPort
 *   AETHERIA_SHOTS=docs/clinic-portal/screenshots node docs/clinic-portal/capture-screens.mjs
 *
 * Patients + Retention stay viewport-sized — the fixture list is hundreds of rows.
 * Other AppShell pages expand #app-main-scroll so fullPage can see below the fold.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.AETHERIA_SHOTS ?? path.join(__dirname, "screenshots");
const BASE = process.env.AETHERIA_URL ?? "http://localhost:5174";

async function hideDemoChrome(page, { keepAlerts = false } = {}) {
  await page.evaluate((keepAlerts) => {
    for (const btn of document.querySelectorAll("button")) {
      if ((btn.textContent ?? "").includes("Demo:")) {
        btn.closest(".fixed")?.remove();
      }
    }
    if (!keepAlerts) {
      document.querySelectorAll(".fixed.bottom-5.right-5").forEach((el) => {
        el.style.display = "none";
      });
    }
    for (const dlg of document.querySelectorAll('[role="dialog"]')) {
      const text = dlg.textContent ?? "";
      if (text.includes("Welcome") || text.includes("welcome to Aetheria")) {
        const close = dlg.querySelector('button[aria-label="Close"], button');
        close?.click();
      }
    }
  }, keepAlerts);
}

/** AppShell scrolls inside #app-main-scroll, so document fullPage is just the viewport. */
async function expandShell(page) {
  await page.evaluate(() => {
    const shell = document.querySelector(".flex.h-dvh");
    const main = document.getElementById("app-main-scroll");
    if (shell) {
      shell.style.height = "auto";
      shell.style.minHeight = "100vh";
      shell.style.overflow = "visible";
    }
    if (main) {
      main.style.overflow = "visible";
      main.style.height = "auto";
      main.style.maxHeight = "none";
      main.style.flex = "none";
    }
    document.body.style.height = "auto";
    document.body.style.overflow = "visible";
    document.documentElement.style.height = "auto";
    document.documentElement.style.overflow = "visible";
  });
  await page.waitForTimeout(250);
}

async function settle(page, selector = ".page-title") {
  await page.waitForSelector(selector, { timeout: 25_000 });
  await page.waitForTimeout(900);
  await hideDemoChrome(page);
  await page.waitForTimeout(200);
}

async function shot(page, name, options = {}) {
  await hideDemoChrome(page, { keepAlerts: options.keepAlerts ?? false });
  if (options.expand !== false && (await page.locator("#app-main-scroll").count())) {
    await expandShell(page);
  }
  const file = path.join(OUT, name);
  await page.screenshot({
    path: file,
    fullPage: options.fullPage ?? true,
    animations: "disabled",
  });
  console.log("wrote", name);
}

async function goto(page, url, selector) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle", timeout: 45_000 });
  await settle(page, selector);
}

async function setRole(context, page, role) {
  await context.addCookies([
    { name: "demo_role", value: role, url: BASE, sameSite: "Lax" },
  ]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await hideDemoChrome(page);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  deviceScaleFactor: 2,
});
await context.addCookies([{ name: "demo_role", value: "owner", url: BASE, sameSite: "Lax" }]);
const page = await context.newPage();
await mkdir(OUT, { recursive: true });

try {
  await goto(page, "/", "h1");
  await shot(page, "00-landing.png", { fullPage: true });

  await goto(page, "/auth", "h2");
  await shot(page, "01-auth-signin.png", { fullPage: false });

  await goto(page, "/dashboard", ".page-title");
  await page.waitForTimeout(500);
  await shot(page, "02-dashboard-live-alerts.png", { expand: false, keepAlerts: true, fullPage: false });
  await shot(page, "02-dashboard-owner.png");

  await goto(page, "/schedule", ".page-title");
  await shot(page, "03-diary-day.png");

  await page.getByRole("button", { name: "week", exact: true }).click();
  await page.waitForTimeout(700);
  await hideDemoChrome(page);
  await shot(page, "04-diary-week.png");

  await page.getByRole("button", { name: "month", exact: true }).click();
  await page.waitForTimeout(700);
  await hideDemoChrome(page);
  await shot(page, "05-diary-month.png");

  await page.getByRole("button", { name: "day", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "New booking" }).click();
  await page.waitForSelector('[role="dialog"]');
  await page.waitForTimeout(400);
  await shot(page, "06-diary-new-booking.png", { fullPage: false, expand: false });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await goto(page, "/patients", ".page-title");
  await shot(page, "07-patients.png");

  await page.getByRole("button", { name: "New patient" }).click();
  await page.waitForSelector('[role="dialog"]');
  await page.waitForTimeout(400);
  await shot(page, "08-patients-new.png", { fullPage: false, expand: false });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);

  await page.locator('table a[href^="/patients/"]').first().click();
  await settle(page, ".page-title");
  await shot(page, "09-patient-record-treatments.png");

  await page.getByRole("tab", { name: "Before and after" }).click();
  await page.waitForTimeout(600);
  await hideDemoChrome(page);
  await shot(page, "10-patient-record-photos.png");

  await page.getByRole("tab", { name: "Documents" }).click();
  await page.waitForTimeout(500);
  await hideDemoChrome(page);
  await shot(page, "11-patient-record-documents.png");

  await page.getByRole("tab", { name: "Visit notes" }).click();
  await page.waitForTimeout(500);
  await hideDemoChrome(page);
  await shot(page, "12-patient-record-visit-notes.png");

  await goto(page, "/retention", ".page-title");
  await page.waitForTimeout(600);
  await shot(page, "13-retention.png");

  await goto(page, "/performance", ".page-title");
  await page.waitForTimeout(800);
  await shot(page, "14-performance.png");

  await goto(page, "/team", ".page-title");
  await shot(page, "15-team.png");

  await page.locator('a[href^="/team/"]').first().click();
  await settle(page, ".page-title");
  await shot(page, "16-staff-profile.png");

  await goto(page, "/settings", ".page-title");
  await shot(page, "17-settings.png");

  await goto(page, "/profile", ".page-title");
  await shot(page, "18-profile.png");

  await setRole(context, page, "practitioner");
  await goto(page, "/dashboard", ".page-title");
  await shot(page, "19-dashboard-practitioner.png");

  await goto(page, "/earnings", ".page-title");
  await shot(page, "20-earnings.png");

  await setRole(context, page, "front_desk");
  await goto(page, "/dashboard", ".page-title");
  await shot(page, "21-dashboard-front-desk.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await setRole(context, page, "owner");
  await goto(page, "/dashboard", ".page-title");
  await shot(page, "22-dashboard-mobile.png");
} catch (error) {
  console.error(error);
  await page.screenshot({ path: path.join(OUT, "_error.png"), fullPage: true }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
