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
 *
 * Contact sheet (no server needed): lays each tab's captures beside the
 * hand-off mockup and writes <dir>/contact-sheet.png.
 *
 *   node scripts/capture-patient-record.mjs --sheet docs/patient-record/captures/10-final
 *                                           [--mockups "Claude outputs/export/mockup-screenshots"]
 *                                           [--role owner]
 */
import { chromium, devices, webkit } from "@playwright/test";
import { existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
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

/** Which mockup screenshots each tab answers to. */
const SHEET_ROWS = [
  { tab: "overview", title: "Overview", mockups: ["01-", "02-"] },
  { tab: "treatments", title: "Treatments", mockups: ["03-", "04-"] },
  { tab: "portal", title: "From the patient", mockups: ["05-"] },
  { tab: "history", title: "Medical history", mockups: ["06-"] },
];

const SHEET = arg("sheet", "");
if (SHEET) {
  const dir = resolve(SHEET);
  const mockupDir = resolve(arg("mockups", "Claude outputs/export/mockup-screenshots"));
  const role = arg("role", "owner");
  const mockupFiles = existsSync(mockupDir) ? readdirSync(mockupDir) : [];
  // Inline the images: a page set from a string has no origin, so file:// would not load.
  const img = (file, cls = "") =>
    existsSync(file)
      ? `<img class="${cls}" src="data:image/png;base64,${readFileSync(file).toString("base64")}" alt="">`
      : `<div class="${cls} missing">missing<br>${file.split("/").pop()}</div>`;
  const rows = SHEET_ROWS.map((row) => {
    const mockups = row.mockups
      .map((prefix) => mockupFiles.find((f) => f.startsWith(prefix)))
      .filter(Boolean)
      .map((f) => img(`${mockupDir}/${f}`, "mock"))
      .join("");
    const shot = (device) => img(`${dir}/${role}--${device}--${row.tab}.png`, "shot");
    return `<section>
      <h2>${row.title}<span>${row.mockups.join(" + ").replaceAll("-", "")} · ${role}</span></h2>
      <div class="row">
        <figure><figcaption>Mockup</figcaption><div class="stack">${mockups}</div></figure>
        <figure><figcaption>Chromium · laptop 1440</figcaption>${shot("laptop-1440")}</figure>
        <figure><figcaption>WebKit · iPad Pro 11 landscape</figcaption>${shot("ipad-pro-landscape")}</figure>
        <figure><figcaption>WebKit · iPad Mini portrait</figcaption>${shot("ipad-mini")}</figure>
      </div>
    </section>`;
  }).join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;padding:28px 32px;background:#f6f4ef;font:13px/1.4 -apple-system,Inter,sans-serif;color:#1f2a44}
    h1{margin:0 0 4px;font-size:22px;font-weight:600}
    p.lede{margin:0 0 22px;color:#46557a}
    section{margin-bottom:28px}
    h2{margin:0 0 10px;font-size:16px;font-weight:600}
    h2 span{margin-left:10px;font-size:12px;font-weight:500;color:#46557a}
    .row{display:grid;grid-template-columns:1.1fr 1.6fr 1.3fr 0.9fr;gap:16px;align-items:start}
    figure{margin:0;background:#fff;border:1px solid rgba(47,63,102,.1);border-radius:14px;padding:10px;box-shadow:0 8px 24px -14px rgba(47,63,102,.25)}
    figcaption{font-size:11.5px;font-weight:600;color:#46557a;margin-bottom:8px;letter-spacing:.02em}
    img{display:block;width:100%;height:auto;border-radius:8px;border:1px solid rgba(47,63,102,.08)}
    .stack img+img{margin-top:8px}
    .missing{border:1px dashed rgba(47,63,102,.3);border-radius:8px;padding:24px;text-align:center;color:#a3456e;font-size:12px}
  </style></head><body>
    <h1>Patient record redesign · contact sheet</h1>
    <p class="lede">Hand-off mockups beside the built record on Grace Adeyemi (${role}). Captured ${new Date().toISOString().slice(0, 10)} from ${dir.split("/").slice(-3).join("/")}.</p>
    ${rows}
  </body></html>`;
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 2200, height: 1200 },
    deviceScaleFactor: 1,
  });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() =>
    Promise.all(
      [...document.images].map((i) =>
        i.complete ? null : new Promise((r) => (i.onload = i.onerror = r)),
      ),
    ),
  );
  const file = `${dir}/contact-sheet.png`;
  await page.screenshot({ path: file, fullPage: true });
  await browser.close();
  console.log(`Contact sheet written to ${file}`);
  process.exit(0);
}

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

/**
 * The shell scrolls inside #app-main-scroll, so a full-page capture would be
 * just the viewport. Let the shell grow for the shot (same as the responsive
 * suite's expandShell), then put it back.
 */
async function expandShell(page) {
  await page.evaluate(() => {
    const shell = document.querySelector(".flex.h-app-screen, .flex.h-dvh");
    const main = document.getElementById("app-main-scroll");
    const grow = (el, extra = {}) => {
      if (!el) return;
      el.dataset.captureStyle = el.getAttribute("style") ?? "";
      Object.assign(el.style, { height: "auto", overflow: "visible", ...extra });
    };
    grow(shell, { minHeight: "100vh" });
    grow(main, { maxHeight: "none", flex: "none" });
    grow(document.body);
    grow(document.documentElement);
  });
  await page.waitForTimeout(250);
}

async function restoreShell(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll("[data-capture-style]")) {
      el.setAttribute("style", el.dataset.captureStyle);
      delete el.dataset.captureStyle;
    }
  });
}

async function findPatientPath(page) {
  await page.goto(`${BASE}/patients?q=${encodeURIComponent(PATIENT)}`, {
    waitUntil: "domcontentloaded",
  });
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
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      const vw = await page.evaluate(() => window.innerWidth);
      await expandShell(page);
      await page.screenshot({ path: file, fullPage: true });
      await restoreShell(page);
      console.log(
        `${role.padEnd(12)} ${device.slug.padEnd(19)} ${slug.padEnd(11)} captured${width > vw ? `  OVERFLOW ${width}>${vw}` : ""}`,
      );
    }
    if (errors.length)
      console.log(`  errors (${role} ${device.slug}):\n    ${errors.join("\n    ")}`);
    await browser.close();
  }
}
console.log(`\nSaved under ${OUT}`);
