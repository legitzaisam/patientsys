/**
 * Captures every V4 screen and composites a side-by-side sheet against the
 * reference mockup so layout deltas are easy to spot.
 *
 *   node scripts/capture.mjs            (dev server must be on :5173)
 */
import { chromium } from "/Users/karndeb/Downloads/Lovable project/node_modules/playwright/index.mjs";
import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const BASE = process.argv[2] ?? "http://localhost:5173";
const ROOT = resolve(import.meta.dirname, "..");
const MOCKS = resolve(ROOT, "../v3/mockups");
const SHOTS = resolve(ROOT, "comparisons/shots");
const SHEETS = resolve(ROOT, "comparisons");
mkdirSync(SHOTS, { recursive: true });

/** The reference mockups are 1672x941; capture at exactly that frame. */
const VIEWPORT = { width: 1672, height: 941 };

const PAGES = [
  { slug: "home", path: "/home", mock: "Vivara Home.png", title: "Home" },
  { slug: "overview", path: "/plan", mock: "Vivara Skin Plan Overview Page.png", title: "Skin Plan — Overview" },
  { slug: "timeline", path: "/plan/timeline", mock: "Vivara Timeline Page.png", title: "Skin Plan — Timeline" },
  { slug: "journal", path: "/plan/journal", mock: "Vivara Journal Page.png", title: "Skin Plan — Journal" },
  { slug: "routine", path: "/plan/routine", mock: "Vivara Skincare Routine 2.png", title: "Skin Plan — Skincare Routine" },
  { slug: "clinic", path: "/clinic", mock: "Vivara My Clinics.png", title: "My Clinic" },
  { slug: "records", path: "/records", mock: "Vivara My Profile-Records page.png", title: "My Profile / Records" },
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1.5 });
const errors = [];
page.on("pageerror", (e) => errors.push(`${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text().slice(0, 160));
});

for (const p of PAGES) {
  await page.goto(`${BASE}${p.path}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${SHOTS}/${p.slug}.png` });
  console.log(`captured ${p.slug}`);
}

// Timeline with the pause modal open — the mockup shows that state.
await page.goto(`${BASE}/plan/timeline`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: /pause plan/i }).click();
await page.waitForTimeout(400);
await page.getByRole("combobox").selectOption("");
await page.getByRole("combobox").blur();
await page.waitForTimeout(300);
await page.screenshot({ path: `${SHOTS}/timeline-modal.png` });
console.log("captured timeline-modal");

/* ------------------------------------------------------ comparison sheets */
const b64 = (f) => `data:image/png;base64,${readFileSync(f).toString("base64")}`;
const sheet = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1.5 });

for (const p of [...PAGES, { slug: "timeline-modal", mock: "Vivara Timeline Page.png", title: "Timeline — pause request" }]) {
  const mockFile = `${MOCKS}/${p.mock}`;
  if (!existsSync(mockFile)) {
    console.log(`skip sheet ${p.slug}: mockup missing`);
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
    <p class="s">Reference mockup (left) vs V4 in the Aetheria theme (right)</p>
    <div class="g">
      <div class="c"><h2>Mockup</h2><img src="${b64(mockFile)}"></div>
      <div class="c"><h2>V4 — Aetheria theme</h2><img src="${b64(`${SHOTS}/${p.slug}.png`)}"></div>
    </div>
  </body></html>`;
  await sheet.setContent(html, { waitUntil: "networkidle" });
  await sheet.waitForTimeout(200);
  await sheet.screenshot({ path: `${SHEETS}/compare-${p.slug}.png`, fullPage: true });
  console.log(`sheet compare-${p.slug}.png`);
}

console.log(errors.length ? `PAGE ERRORS:\n${errors.join("\n")}` : "zero console/page errors");
await browser.close();
