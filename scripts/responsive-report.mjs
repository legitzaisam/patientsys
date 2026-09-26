/**
 * Turn the responsive matrix output into docs/responsive/REPORT.md.
 *
 *   node scripts/responsive-report.mjs            build the report
 *   node scripts/responsive-report.mjs --captures also copy a curated set of
 *                                               phone and tablet screenshots
 *                                               into docs/responsive/captures
 *                                               (JPEG via sips when available)
 *
 * Reads test-results/responsive/findings/<project>/<role>--<page>--<state>.json
 * and test-results/responsive/interactions/<project>/*.json. Findings are
 * grouped by probe, page and state so one row lists every device it affects.
 * docs/responsive/REVIEW.md, if present, is inlined as the manual review.
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { join, relative, basename } from "node:path";

const ROOT = process.cwd();
const RESULTS = join(ROOT, "test-results", "responsive");
const FINDINGS = join(RESULTS, "findings");
const INTERACTIONS = join(RESULTS, "interactions");
const DOCS = join(ROOT, "docs", "responsive");
const CAPTURES = join(DOCS, "captures");
const REPORT = join(DOCS, "REPORT.md");
const REVIEW = join(DOCS, "REVIEW.md");
const copyCaptures = process.argv.includes("--captures");

const PROJECT_ORDER = [
  "iphone-se",
  "iphone-15",
  "ipad-mini-portrait",
  "ipad-pro-landscape",
  "laptop-1366",
  "laptop-1440",
  "desktop-1920",
];
const PROJECT_LABEL = {
  "iphone-se": "iPhone SE 375",
  "iphone-15": "iPhone 15 393",
  "ipad-mini-portrait": "iPad Mini 768",
  "ipad-pro-landscape": "iPad Pro 1194",
  "laptop-1366": "Laptop 1366",
  "laptop-1440": "Laptop 1440",
  "desktop-1920": "Desktop 1920",
};
const SEVERITY_ORDER = { blocker: 0, major: 1, minor: 2, info: 3 };
const TIER = { blocker: "Tier 1", major: "Tier 2", minor: "Tier 3", info: "—" };

/** What each probe usually means and how it is normally fixed. */
const FIX_HINT = {
  "overflow.main":
    "The content column is narrower than its content. On phones the sidebar must become a drawer and the toolbar must compact; inside pages, replace fixed widths with min-w-0 / flex-wrap / grid-cols-1 under sm.",
  "overflow.document":
    "Something escapes the root: check fixed-width containers, long unbroken strings and negative margins.",
  "overflow.elements":
    "Elements run past the right edge: wrap the toolbar, let cards shrink (min-w-0), stack grids under sm, or give wide tables an explicit horizontal scroller with a fade affordance.",
  "reachability.last":
    "Content cannot be scrolled into view: the clipped shell (h-dvh overflow-hidden with a wide sidebar) or an overlay panel anchored off screen.",
  "text.clipped":
    "Add truncate (ellipsis), allow wrapping (whitespace-normal / break-words), or give the box room.",
  "overlay.overlap":
    "Two floating overlays share a corner: on phones move the demo switcher to the top or into the account menu, stack the dock bubbles vertically, and keep toasts above them.",
  "overlay.covers-action":
    "A floating overlay sits over a control: add bottom padding to the scroller equal to the dock height (pb-24 is not enough when cards are tall) or shrink the dock on phones.",
  "tap.small":
    "Icon controls under 24px: raise to h-9 w-9 (36) or at least h-6 (24) with padding; chips that act as buttons need min-h-6.",
  "tap.small-link":
    "Text links shorter than 24px: add py-1 or line-height so the hit area reaches 24px.",
  "tap.under-44":
    "Advisory: Apple recommends 44px. Raise primary actions on phones (h-11) and leave secondary controls as they are.",
  "type.tiny":
    "Text under 10px is unreadable on a phone: raise to at least 11px (text-[11px]) and reflow the container.",
  "type.small": "10-11px meta text: acceptable for labels, raise anything the user must read.",
  "ios.input-zoom":
    "Inputs under 16px zoom the page on focus in iOS Safari: set text-base (16px) on inputs under md, or use font-size: 16px with a scale transform.",
  "dialog.out-of-viewport":
    "Dialog or panel anchored outside the screen: on phones use inset-x-4 / w-[calc(100vw-2rem)] and anchor panels to the viewport, not the bubble.",
  "overlay.covers-dialog-action":
    "The staff dock (z-60) and demo switcher are drawn above dialogs and sheets (z-50) and sit on their footer buttons on phones: hide the dock while a dialog is open, or lower it beneath dialogs and keep dialog footers above the safe-area bottom.",
  "dialog.unscrollable":
    "Dialog taller than the screen with nothing scrolling: add max-h-[90dvh] overflow-y-auto to the content.",
  "dialog.close-unreachable":
    "The close button is off screen: keep the header sticky inside the dialog.",
  "dialog.narrow":
    "A sheet or dialog narrower than 80% of a phone screen: use w-full under sm (the Sheet is w-3/4 by default).",
  "header.control-dropped":
    "The pill control fell under the title at a width where the rule says same row: the title block needs flex-1 min-w-0.",
  "header.control-overflow":
    "The header control runs off screen: allow it to wrap or shrink under sm.",
  "runtime.console": "Console errors during the visit: investigate individually.",
  "runtime.page": "Uncaught exceptions during the visit: investigate individually.",
  "runtime.requests": "Failed network requests during the visit.",
};

function readJsonFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const project of readdirSync(dir)) {
    const pdir = join(dir, project);
    if (!statSync(pdir).isDirectory()) continue;
    for (const file of readdirSync(pdir)) {
      if (!file.endsWith(".json")) continue;
      try {
        out.push(JSON.parse(readFileSync(join(pdir, file), "utf8")));
      } catch {
        /* skip unreadable */
      }
    }
  }
  return out;
}

const captures = readJsonFiles(FINDINGS);
const interactions = readJsonFiles(INTERACTIONS).flat();

if (captures.length === 0) {
  console.error(`No findings under ${FINDINGS}. Run npm run test:responsive first.`);
  process.exit(1);
}

const projects = PROJECT_ORDER.filter((p) => captures.some((c) => c.project === p));
const deviceOf = (project) =>
  project.startsWith("iphone")
    ? "phone"
    : project.startsWith("ipad")
      ? "tablet"
      : project.startsWith("laptop")
        ? "laptop"
        : "desktop";

/* ------------------------------------------------------------------ */
/* aggregate                                                          */
/* ------------------------------------------------------------------ */

/** key → { probe, page, state, role, severity, byProject: Map<project, finding>, shots } */
const groups = new Map();
const runtimeIssues = [];
const skipped = [];
const redirected = [];

for (const cap of captures) {
  if (cap.error && !cap.opened) {
    skipped.push(cap);
  }
  if (cap.state === "redirected") {
    redirected.push(cap);
    continue;
  }
  if (!cap.probe) continue;
  for (const f of cap.probe.findings) {
    const key = `${f.probe}|${cap.role}|${cap.page}|${cap.state}`;
    const g = groups.get(key) ?? {
      probe: f.probe,
      role: cap.role,
      page: cap.page,
      path: cap.path,
      state: cap.state,
      severity: f.severity,
      byProject: new Map(),
      shots: new Map(),
    };
    g.byProject.set(cap.project, f);
    if (cap.shots?.viewport) g.shots.set(cap.project, cap.shots.viewport);
    groups.set(key, g);
  }
  const rt = cap.runtime ?? {};
  for (const [kind, list] of [
    ["console", rt.console ?? []],
    ["page", rt.page ?? []],
    ["requests", rt.requests ?? []],
  ]) {
    if (list.length > 0 && cap.state === "base") {
      runtimeIssues.push({
        project: cap.project,
        role: cap.role,
        page: cap.page,
        kind,
        messages: [...new Set(list)].slice(0, 3),
      });
    }
  }
}

const rows = [...groups.values()].sort((a, b) => {
  const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  if (s !== 0) return s;
  const d = b.byProject.size - a.byProject.size;
  if (d !== 0) return d;
  return `${a.page}${a.state}${a.probe}`.localeCompare(`${b.page}${b.state}${b.probe}`);
});

/* ------------------------------------------------------------------ */
/* curated captures                                                   */
/* ------------------------------------------------------------------ */

function hasSips() {
  try {
    execFileSync("which", ["sips"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

const capturedIndex = new Map(); // source png → docs-relative path
if (copyCaptures) {
  mkdirSync(CAPTURES, { recursive: true });
  const sips = hasSips();
  const wanted = captures.filter(
    (c) =>
      (c.project === "iphone-se" || c.project === "ipad-mini-portrait") &&
      c.state === "base" &&
      (c.role === "owner" || c.role === "patient" || c.role === "public") &&
      c.shots?.viewport,
  );
  for (const c of wanted) {
    const src = c.shots.viewport;
    if (!existsSync(src)) continue;
    const dir = join(CAPTURES, c.project);
    mkdirSync(dir, { recursive: true });
    const name = basename(src, ".png");
    if (sips) {
      const dest = join(dir, `${name}.jpg`);
      try {
        // Downsample the 2x/3x device captures to ~1000px so the curated set stays small in git.
        execFileSync(
          "sips",
          ["-s", "format", "jpeg", "-s", "formatOptions", "70", "-Z", "1000", src, "--out", dest],
          { stdio: "ignore" },
        );
        capturedIndex.set(src, relative(DOCS, dest));
        continue;
      } catch {
        /* fall back to a copy */
      }
    }
    const dest = join(dir, `${name}.png`);
    copyFileSync(src, dest);
    capturedIndex.set(src, relative(DOCS, dest));
  }
}

function shotLink(png) {
  if (!png) return "";
  const curated = capturedIndex.get(png);
  if (curated) return `[shot](${curated.split("\\").join("/")})`;
  if (existsSync(join(DOCS, "captures"))) {
    // A curated version may exist from an earlier run with the same name.
    for (const ext of [".jpg", ".png"]) {
      const guess = join(CAPTURES, basename(join(png, "..")), `${basename(png, ".png")}${ext}`);
      if (existsSync(guess)) return `[shot](${relative(DOCS, guess).split("\\").join("/")})`;
    }
  }
  return `[local](${relative(DOCS, png).split("\\").join("/")})`;
}

/* ------------------------------------------------------------------ */
/* render                                                             */
/* ------------------------------------------------------------------ */

const md = [];
const now = new Date();
md.push(`# Responsive QC report`);
md.push("");
md.push(
  `Generated ${now.toISOString().slice(0, 16).replace("T", " ")} from ${captures.length} captures across ${projects.length} device projects (${projects.map((p) => PROJECT_LABEL[p]).join(", ")}). iPhone and iPad ran in WebKit; laptop and desktop in Chromium. Demo mode, port 8091.`,
);
md.push("");
md.push(
  `Findings are grouped by probe, page and state; one row lists every device it affects. Severity → tier: blocker → Tier 1, major → Tier 2, minor → Tier 3. Nothing here fails the build yet; Stage 2 turns the probes into gates tier by tier.`,
);
md.push("");

/* summary by device */
md.push(`## Summary by device`);
md.push("");
md.push(
  `| Device | Pages captured | States captured | Blockers | Majors | Minors | Runtime errors |`,
);
md.push(`| --- | --- | --- | --- | --- | --- | --- |`);
for (const p of projects) {
  const caps = captures.filter((c) => c.project === p && c.probe);
  const pages = new Set(caps.filter((c) => c.state === "base").map((c) => `${c.role}/${c.page}`))
    .size;
  const sev = { blocker: 0, major: 0, minor: 0 };
  for (const g of rows) if (g.byProject.has(p)) sev[g.severity] = (sev[g.severity] ?? 0) + 1;
  const rt = runtimeIssues.filter((r) => r.project === p).length;
  md.push(
    `| ${PROJECT_LABEL[p]} | ${pages} | ${caps.length} | ${sev.blocker} | ${sev.major} | ${sev.minor} | ${rt} |`,
  );
}
md.push("");

/* summary by probe */
md.push(`## Summary by probe`);
md.push("");
md.push(`| Probe | Severity | Rows | Phone | Tablet | Laptop | Desktop | What it means |`);
md.push(`| --- | --- | --- | --- | --- | --- | --- | --- |`);
const byProbe = new Map();
for (const g of rows) {
  const e = byProbe.get(g.probe) ?? {
    severity: g.severity,
    rows: 0,
    phone: 0,
    tablet: 0,
    laptop: 0,
    desktop: 0,
  };
  e.rows += 1;
  const classes = new Set([...g.byProject.keys()].map(deviceOf));
  for (const c of classes) e[c] += 1;
  byProbe.set(g.probe, e);
}
for (const [probe, e] of [...byProbe.entries()].sort(
  (a, b) => SEVERITY_ORDER[a[1].severity] - SEVERITY_ORDER[b[1].severity] || b[1].rows - a[1].rows,
)) {
  md.push(
    `| \`${probe}\` | ${e.severity} | ${e.rows} | ${e.phone} | ${e.tablet} | ${e.laptop} | ${e.desktop} | ${FIX_HINT[probe] ?? ""} |`,
  );
}
md.push("");

/* headline blockers: pages with blockers on phones */
const phoneBlockers = rows.filter(
  (g) => g.severity === "blocker" && [...g.byProject.keys()].some((p) => deviceOf(p) === "phone"),
);
const tabletBlockers = rows.filter(
  (g) => g.severity === "blocker" && [...g.byProject.keys()].some((p) => deviceOf(p) === "tablet"),
);
const laptopBlockers = rows.filter(
  (g) =>
    g.severity === "blocker" &&
    [...g.byProject.keys()].some((p) => deviceOf(p) === "laptop" || deviceOf(p) === "desktop"),
);
md.push(`## Headline`);
md.push("");
md.push(
  `- Phones: ${phoneBlockers.length} blocker rows over ${new Set(phoneBlockers.map((g) => `${g.role}/${g.page}`)).size} pages.`,
);
md.push(
  `- Tablets: ${tabletBlockers.length} blocker rows over ${new Set(tabletBlockers.map((g) => `${g.role}/${g.page}`)).size} pages.`,
);
md.push(
  `- Laptop and desktop: ${laptopBlockers.length} blocker rows over ${new Set(laptopBlockers.map((g) => `${g.role}/${g.page}`)).size} pages.`,
);
md.push("");

/* per-page scorecard: worst severity per device, base state and sidebar-closed */
md.push(`## Scorecard by page`);
md.push("");
md.push(
  `Worst finding on the page across its states. B = blocker, M = major, m = minor, ok = clean, — = not visited (redirected or not in that role's set). The second symbol, after the slash, is the page with the sidebar closed, which is how a phone user would actually hold it.`,
);
md.push("");
md.push(`| Page | ${projects.map((p) => PROJECT_LABEL[p]).join(" | ")} |`);
md.push(`| --- | ${projects.map(() => "---").join(" | ")} |`);
const pageKeys = [
  ...new Set(captures.filter((c) => c.probe).map((c) => `${c.role}/${c.page}`)),
].sort((a, b) => {
  const order = (k) =>
    k.startsWith("public") ? 0 : k.startsWith("owner") ? 1 : k.startsWith("patient/") ? 3 : 2;
  return order(a) - order(b) || a.localeCompare(b);
});
function worst(caps) {
  let w = "ok";
  for (const c of caps) {
    for (const f of c.probe?.findings ?? []) {
      if (f.severity === "blocker") return "B";
      if (f.severity === "major") w = "M";
      else if (f.severity === "minor" && w === "ok") w = "m";
    }
  }
  return w;
}
for (const key of pageKeys) {
  const [role, pageId] = key.split("/");
  const cells = projects.map((p) => {
    const caps = captures.filter(
      (c) =>
        c.project === p &&
        c.role === role &&
        c.page === pageId &&
        c.probe &&
        c.state !== "redirected",
    );
    if (caps.length === 0) return "—";
    const base = caps.filter((c) => c.state === "base");
    const closed = caps.filter((c) => c.state === "sidebar-closed");
    const all = worst(caps);
    const b = base.length ? worst(base) : "—";
    const s = closed.length ? worst(closed) : "—";
    return `${b}/${s}${all !== b && all !== s ? ` (${all} in a state)` : ""}`;
  });
  md.push(`| ${key} | ${cells.join(" | ")} |`);
}
md.push("");

/* manual review */
if (existsSync(REVIEW)) {
  md.push(readFileSync(REVIEW, "utf8").trim());
  md.push("");
}

/* findings tables */
function deviceCell(g) {
  return projects
    .filter((p) => g.byProject.has(p))
    .map(
      (p) =>
        PROJECT_LABEL[p].replace(/ .*$/, "") +
        (PROJECT_LABEL[p].match(/\d+$/)?.[0] ? ` ${PROJECT_LABEL[p].match(/\d+$/)[0]}` : ""),
    )
    .join(", ");
}
function detailCell(g) {
  const phoneFirst = projects.find((p) => g.byProject.has(p));
  const f = g.byProject.get(phoneFirst);
  const sample = f.samples?.[0] ? ` — e.g. ${f.samples[0]}` : "";
  return `${f.message}${sample}`.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
function shotCell(g) {
  const p = projects.find((p) => g.shots.has(p));
  return p ? shotLink(g.shots.get(p)) : "";
}

for (const severity of ["blocker", "major", "minor"]) {
  const list = rows.filter((g) => g.severity === severity);
  md.push(`## ${TIER[severity]} — ${severity}s (${list.length} rows)`);
  md.push("");
  if (list.length === 0) {
    md.push("None.");
    md.push("");
    continue;
  }
  // Base and sidebar-closed rows first, then the overlay states, so the
  // page-level problems read before the dialog-level ones.
  const primary = list.filter((g) => g.state === "base" || g.state === "sidebar-closed");
  const secondary = list.filter((g) => !(g.state === "base" || g.state === "sidebar-closed"));
  for (const [label, subset] of [
    ["Pages", primary],
    ["Overlays, dialogs and tabs", secondary],
  ]) {
    if (subset.length === 0) continue;
    md.push(
      `<details${severity === "blocker" && label === "Pages" ? " open" : ""}><summary>${label} (${subset.length})</summary>`,
    );
    md.push("");
    md.push(`| Probe | Where | Devices | Detail | Shot |`);
    md.push(`| --- | --- | --- | --- | --- |`);
    for (const g of subset) {
      md.push(
        `| \`${g.probe}\` | ${g.role} · ${g.page} · ${g.state} | ${deviceCell(g)} | ${detailCell(g)} | ${shotCell(g)} |`,
      );
    }
    md.push("");
    md.push(`</details>`);
    md.push("");
  }
}

/* touch interactions */
md.push(`## Touch interactions (WebKit projects)`);
md.push("");
if (interactions.length === 0) {
  md.push("Not run in this pass.");
} else {
  md.push(`| Check | Page | Device | Outcome | Note |`);
  md.push(`| --- | --- | --- | --- | --- |`);
  const byCheck = new Map();
  for (const r of interactions) {
    const key = `${r.check}|${r.page}`;
    const e = byCheck.get(key) ?? { check: r.check, page: r.page, outcomes: new Map() };
    e.outcomes.set(r.project, r);
    byCheck.set(key, e);
  }
  for (const e of byCheck.values()) {
    for (const p of PROJECT_ORDER) {
      const r = e.outcomes.get(p);
      if (!r) continue;
      md.push(
        `| \`${r.check}\` | ${r.page} | ${PROJECT_LABEL[p]} | **${r.outcome}** | ${r.note.replace(/\|/g, "\\|")} |`,
      );
    }
  }
}
md.push("");

/* runtime */
md.push(`## Runtime errors during the visit`);
md.push("");
if (runtimeIssues.length === 0) {
  md.push("None recorded on any base capture.");
} else {
  md.push(`| Device | Page | Kind | Messages |`);
  md.push(`| --- | --- | --- | --- |`);
  for (const r of runtimeIssues) {
    md.push(
      `| ${PROJECT_LABEL[r.project]} | ${r.role} · ${r.page} | ${r.kind} | ${r.messages.join("<br>").replace(/\|/g, "\\|")} |`,
    );
  }
}
md.push("");

/* redirects and skips */
md.push(`## Redirects and skipped states`);
md.push("");
if (redirected.length > 0) {
  md.push(
    `Pages a role could not open (redirected by the access gate): ${[...new Set(redirected.map((c) => `${c.role} → ${c.page}`))].join("; ")}.`,
  );
  md.push("");
}
const skippedStates = captures.filter((c) => !c.opened && c.state !== "redirected");
if (skippedStates.length > 0) {
  const byState = new Map();
  for (const c of skippedStates) {
    const key = `${c.role} · ${c.page} · ${c.state}`;
    const e = byState.get(key) ?? { key, projects: new Set(), error: c.error };
    e.projects.add(c.project);
    byState.set(key, e);
  }
  md.push(`States whose trigger was not on screen (recorded, not failed):`);
  md.push("");
  for (const e of byState.values()) {
    md.push(
      `- ${e.key} — ${[...e.projects].map((p) => PROJECT_LABEL[p]).join(", ")}${e.error ? ` — ${e.error}` : ""}`,
    );
  }
}
md.push("");

md.push(`## How to re-run`);
md.push("");
md.push("```");
md.push("npm run test:responsive            # all 7 projects, matrix + touch checks");
md.push(
  'npx playwright test --config playwright.responsive.config.ts --project iphone-se -g "owner · dashboard"',
);
md.push(
  "node scripts/responsive-report.mjs --captures   # rebuild this report and refresh docs/responsive/captures",
);
md.push("```");
md.push("");

mkdirSync(DOCS, { recursive: true });
writeFileSync(REPORT, md.join("\n"));
console.log(
  `report: ${relative(ROOT, REPORT)} — ${rows.length} finding rows (${rows.filter((g) => g.severity === "blocker").length} blocker, ${rows.filter((g) => g.severity === "major").length} major, ${rows.filter((g) => g.severity === "minor").length} minor), ${interactions.length} touch checks${copyCaptures ? `, ${capturedIndex.size} captures curated` : ""}`,
);
