#!/usr/bin/env node
/**
 * Visual parity check for the live patient portal.
 *
 * Captures every portal page at 1672x941 — the reference mockups' exact
 * pixel size — and composites it beside the V4 wireframe capture of the same
 * screen, so any layout drift between the design and the integration is
 * visible at a glance.
 *
 *   npm run dev:demo            (in one terminal)
 *   node scripts/qc-patient-portal.mjs [baseURL]
 */
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:8080";
const V4_SHOTS = resolve("docs/patient-portal/v4/comparisons/shots");
const OUT = resolve("docs/patient-portal/v4/comparisons/live");
const SHOTS = resolve(OUT, "shots");
mkdirSync(SHOTS, { recursive: true });

const VIEWPORT = { width: 1672, height: 941 };

const PAGES = [
  { slug: "home", path: "/my-record", v4: "home", title: "Home" },
  { slug: "overview", path: "/my-record/plan", v4: "overview", title: "Plan — Overview" },
  { slug: "timeline", path: "/my-record/plan/timeline", v4: "timeline", title: "Plan — Timeline" },
  { slug: "journal", path: "/my-record/plan/journal", v4: "journal", title: "Plan — Journal" },
  { slug: "routine", path: "/my-record/plan/routine", v4: "routine", title: "Plan — Skincare Routine" },
  { slug: "clinic", path: "/my-record/clinic", v4: "clinic", title: "My Clinic" },
  { slug: "records", path: "/my-record/records", v4: "records", title: "My Profile / Records" },
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1.5 });
await context.addCookies([{ name: "demo_role", value: "patient", url: BASE }]);
const page = await context.newPage();

const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 160)}`));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon")) errors.push(`console: ${m.text().slice(0, 160)}`);
});

for (const p of PAGES) {
  await page.goto(`${BASE}${p.path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/${p.slug}.png` });
  const height = await page.evaluate(() => document.body.scrollHeight);
  console.log(`${p.slug.padEnd(10)} captured  (${height}px ${height <= VIEWPORT.height ? "fits" : "scrolls"})`);
}

/* --------------------------------------------------- comparison sheets */
const b64 = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
const sheet = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1.5 });

for (const p of PAGES) {
  const wireframe = `${V4_SHOTS}/${p.v4}.png`;
  if (!existsSync(wireframe)) {
    console.log(`skip sheet ${p.slug}: no V4 capture`);
    continue;
  }
  const html = `<!doctype html><html><head><style>
    body { margin:0; padding:26px; background:#f6f3ee; font-family:-apple-system,system-ui,sans-serif; }
    h1 { font-size:16px; margin:0 0 4px; color:#2f3f66; }
    p.s { font-size:11.5px; margin:0 0 16px; color:#6a7390; }
    .g { display:flex; gap:22px; align-items:flex-start; }
    .c { flex:1; min-width:0; }
    .c h2 { font-size:10.5px; letter-spacing:.09em; text-transform:uppercase; color:#6a7390; margin:0 0 7px; }
    img { width:100%; border-radius:10px; box-shadow:0 10px 30px -12px rgba(47,63,102,.35); display:block; }
  </style></head><body>
    <h1>${p.title}</h1>
    <p class="s">V4 wireframe (left) vs the live patient portal on real data (right)</p>
    <div class="g">
      <div class="c"><h2>V4 wireframe</h2><img src="${b64(wireframe)}"></div>
      <div class="c"><h2>Live portal</h2><img src="${b64(`${SHOTS}/${p.slug}.png`)}"></div>
    </div>
  </body></html>`;
  await sheet.setContent(html, { waitUntil: "networkidle" });
  await sheet.waitForTimeout(200);
  await sheet.screenshot({ path: `${OUT}/compare-${p.slug}.png`, fullPage: true });
  console.log(`sheet compare-${p.slug}.png`);
}

console.log(errors.length ? `PAGE ERRORS:\n${errors.join("\n")}` : "zero console/page errors");
await browser.close();
process.exit(errors.length ? 1 : 0);
