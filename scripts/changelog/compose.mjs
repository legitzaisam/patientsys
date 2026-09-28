#!/usr/bin/env node
// Side-by-side composites for the per-commit changelog.
//
// Reads docs/changelog/<set>/manifest.json (written by walk-commits.mjs) and,
// for every scene and device, renders before and after next to each other into
// commits/NN-<sha>/compare/<scene>--<device>.jpg using Playwright's Chromium.
// No extra dependencies: a small HTML page with two <img> columns.
//
//   node scripts/changelog/compose.mjs            all commits
//   node scripts/changelog/compose.mjs 3b3d678    one commit

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SET = "2026-09-28-e2e-live";
const DOCS_DIR = path.join(ROOT, "docs/changelog", SET);
const COLUMN = 720; // each shot is scaled to this width
const onlySha = process.argv[2];

const manifest = JSON.parse(fs.readFileSync(path.join(DOCS_DIR, "manifest.json"), "utf8"));
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

function html({ title, beforeLabel, afterLabel, before, after, missingBefore, missingAfter }) {
  const panel = (label, file, missing) => `
    <figure>
      <figcaption>${esc(label)}${missing.length ? `<small>Not on this page yet: ${esc(missing.join("; "))}</small>` : ""}</figcaption>
      ${file ? `<img src="${file}" alt="">` : `<div class="none">No capture at this commit</div>`}
    </figure>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 16px; background: #eef0f4; font: 13px/1.4 -apple-system, "Helvetica Neue", Arial, sans-serif; color: #2f3f66; }
    h1 { margin: 0 0 12px; font-size: 15px; font-weight: 600; }
    .row { display: grid; grid-template-columns: ${COLUMN}px ${COLUMN}px; gap: 16px; align-items: start; }
    figure { margin: 0; }
    figcaption { padding: 6px 10px; border-radius: 8px 8px 0 0; background: #2f3f66; color: #fff; font-weight: 600; }
    figcaption small { display: block; margin-top: 2px; font-weight: 400; opacity: .85; }
    img { display: block; width: ${COLUMN}px; height: auto; border: 1px solid rgba(47,63,102,.15); border-top: 0; border-radius: 0 0 8px 8px; background: #fff; }
    .none { display: grid; place-items: center; height: 240px; width: ${COLUMN}px; border: 1px dashed rgba(47,63,102,.3); border-radius: 0 0 8px 8px; color: #6a7390; background: #fff; }
  </style></head><body>
    <h1>${esc(title)}</h1>
    <div class="row">${panel(beforeLabel, before, missingBefore)}${panel(afterLabel, after, missingAfter)}</div>
  </body></html>`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: COLUMN * 2 + 48, height: 900 }, deviceScaleFactor: 1 });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "changelog-compose-"));
let made = 0;

for (const commit of manifest.commits) {
  if (onlySha && commit.sha !== onlySha) continue;
  const dir = path.join(ROOT, commit.dir);
  const compareDir = path.join(dir, "compare");
  fs.mkdirSync(compareDir, { recursive: true });
  for (const [scene, devices] of Object.entries(commit.scenes)) {
    for (const [device, rec] of Object.entries(devices)) {
      if (!rec.before && !rec.after) continue;
      const doc = html({
        title: `${commit.sha} · ${rec.what ?? scene} · ${device}`,
        beforeLabel: `Before · ${commit.parent}`,
        afterLabel: `After · ${commit.sha}`,
        // rec.before / rec.after are relative to the set folder (states/<sha>/...).
        before: rec.before ? `file://${path.join(DOCS_DIR, rec.before)}` : null,
        after: rec.after ? `file://${path.join(DOCS_DIR, rec.after)}` : null,
        missingBefore: rec.missingBefore ?? [],
        missingAfter: rec.missingAfter ?? [],
      });
      const file = path.join(tmp, `${commit.sha}-${scene}-${device}.html`);
      fs.writeFileSync(file, doc);
      await page.goto(`file://${file}`);
      await page.waitForLoadState("load");
      await page.evaluate(() => Promise.all([...document.images].map((img) => (img.complete ? null : new Promise((r) => (img.onload = img.onerror = r))))));
      await page.screenshot({ path: path.join(compareDir, `${scene}--${device}.jpg`), fullPage: true, type: "jpeg", quality: 60 });
      made++;
    }
  }
}

await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`composed ${made} comparisons under ${path.relative(ROOT, DOCS_DIR)}`);
