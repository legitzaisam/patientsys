#!/usr/bin/env node
/**
 * Captures every tab of the clinic patient record for the redesign work logs.
 *
 * WebKit (Safari's engine) at iPad Mini portrait and iPad Pro 11 landscape,
 * Chromium at a 1440 laptop. Each tab is shot full-height so the whole card
 * stack can be laid beside the mockup. The patient is found by name through
 * the records list, so fixture ids can move without breaking the script.
 *
 *   ./launch-plan/cloudflare/start-local.sh         (or any demo server)
 *   node scripts/capture-patient-record.mjs [--out docs/patient-record/captures/00-before]
 *                                           [--base http://localhost:8199]
 *                                           [--patient "Grace Adeyemi"]
 *                                           [--roles owner,practitioner,front_desk]
 *                                           [--tabs overview,treatments,...]
 */
import { chromium, devices, webkit } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const BASE = arg("base", "http://localhost:8199");
const OUT = resolve(arg("out", "docs/patient-record/captures/00-before"));
const PATIENT = arg("patient", "Grace Adeyemi");
const ROLES = arg("roles", "owner").split(",");
const TABS_ARG = arg("tabs", "");

const DEVICES = [
  { slug: "ipad-mini", engine: webkit, options: { ...devices["iPad Mini"] } },
  { slug: "ipad-pro-landscape", engine: webkit, options: { ...devices["iPad Pro 11 landscape"] } },
  { slug: "laptop-1440", engine: chromium, options: { viewport: { width: 1440, height: 900 } } },
];

mkdirSync(OUT, { recursive: true });

/** The record's tab bar, read live so the script works before and after the redesign. */
async function tabList(page) {
  const tabs = await page.locator('[role="tab"]').evaluateAll((els) =>
    els.map((el) => ({
      // Radix names the trigger `radix-:r:-trigger-<value>`.
      value: (el.getAttribute("id") ?? "").split("-trigger-")[1] ?? el.textContent.trim(),
      label: el.textContent.trim().replace(/\d+$/, "").trim(),
    })),
  );
  return tabs;
}

async function findPatientPath(page) {
  await page.goto(`${BASE}/patients?q=${encodeURIComponent(PATIENT)}`, { waitUntil: "domcontentloaded" });
  const link = page.locator('[data-qc="records-name"]').first();
  await link.waitFor({ timeout: 30_000 });
  const href = await link.getAttribute("href");
  if (!href) throw new Error(`No record link for ${PATIENT}`);
  return href;
}

for (const role of ROLES) {
  for (const device of DEVICES) {
    const browser = await device.engine.launch();
    const context = await browser.newContext(device.options);
    await context.addCookies([{ name: "demo_role", value: role, url: BASE }]);
    await context.addInitScript(() => {
      try {
        sessionStorage.setItem("aetheria.dock-alerts-seen", "9999");
      } catch {
        /* storage unavailable */
      }
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));

    const path = await findPatientPath(page);
    await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("h1", { timeout: 30_000 });
    await page.waitForLoadState("networkidle").catch(() => {});

    const tabs = await tabList(page);
    const wanted = TABS_ARG ? TABS_ARG.split(",") : tabs.map((t) => t.value);
    for (const tab of tabs) {
      if (!wanted.includes(tab.value)) continue;
      await page.getByRole("tab", { name: new RegExp(`^${tab.label}`) }).click();
      await page.waitForTimeout(900);
      const slug = tab.value.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      const file = `${OUT}/${role}--${device.slug}--${slug}.png`;
      await page.screenshot({ path: file, fullPage: true });
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      const vw = await page.evaluate(() => window.innerWidth);
      console.log(
        `${role.padEnd(12)} ${device.slug.padEnd(19)} ${slug.padEnd(11)} captured${width > vw ? `  OVERFLOW ${width}>${vw}` : ""}`,
      );
    }
    if (errors.length) console.log(`  errors (${role} ${device.slug}):\n    ${errors.join("\n    ")}`);
    await browser.close();
  }
}
console.log(`\nSaved under ${OUT}`);
