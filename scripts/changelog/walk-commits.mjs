#!/usr/bin/env node
// Per-commit changelog captures.
//
// Walks a git worktree through a list of commits. At every state it starts the
// demo app on one port, runs e2e/changelog/commit-captures.spec.ts for the
// scenes that state must show (the scenes of the commit just reached, plus the
// scenes of the next one, which needs this state as its "before"), then stops
// the server. Afterwards it assembles docs/changelog/<set>/commits/NN-<sha>/
// {before,after}/ from the captured states.
//
//   node scripts/changelog/walk-commits.mjs               capture every state, then assemble
//   node scripts/changelog/walk-commits.mjs --only 3b3d678,d15817d   recapture the states those commits need
//   node scripts/changelog/walk-commits.mjs --assemble    only assemble from what is on disk
//   node scripts/changelog/walk-commits.mjs --from 5      start at state index 5 (0 = base)
//
// Environment: CHANGELOG_WORKTREE (default ~/aetheria-worktrees/stepper),
// CHANGELOG_PORT (8093), DEMO_NOW (pinned clock for every state).

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORKTREE = process.env["CHANGELOG_WORKTREE"] ?? path.join(os.homedir(), "aetheria-worktrees/stepper");
const PORT = Number(process.env["CHANGELOG_PORT"] ?? 8093);
const DEMO_NOW = process.env["DEMO_NOW"] ?? "2026-09-28T09:30:00Z";
const SET = "2026-09-28-e2e-live";
const STATES_DIR = path.join(ROOT, "test-results/changelog-states");
const DOCS_DIR = path.join(ROOT, "docs/changelog", SET);
const DEVICES = ["chromium-1440", "ipad-landscape", "ipad-portrait"];

/** The state every commit below builds on: the last merge before Zaisam's work. */
const BASE = { sha: "d5a5789", subject: "Merge branch 'e2e_live' (base: e956bfd plus mock-up files)" };

/** Commits in order, each with the scenes that show its change. */
export const COMMITS = [
  {
    sha: "a9913cc",
    subject: "Refactor profile and earnings components",
    scenes: ["profile", "profile-performance", "profile-security", "earnings", "performance", "performance-practitioner", "team-member", "quick-add", "portal-records", "diary-day", "dashboard-owner", "settings", "insights-marketing", "patients-list"],
  },
  { sha: "3b3d678", subject: "Enhance access control and role management", scenes: ["team", "team-access", "invite-staff", "dashboard-owner"] },
  { sha: "d15817d", subject: "Implement profile change request approval system", scenes: ["team", "team-access", "invite-staff"] },
  { sha: "20a1e58", subject: "Enhance access control settings and UI", scenes: ["team", "team-access"] },
  { sha: "142563a", subject: "Enhance UI and functionality in various components", scenes: ["team", "team-access", "bell", "portal-home"] },
  { sha: "46dff1a", subject: "Implement team chat functionality and enhance chat UI", scenes: ["dock-chat", "dock-chat-team", "dock-chat-thread", "bell", "alerts"] },
  { sha: "d625c36", subject: "Enhance practitioner hovercard and chat functionalities", scenes: ["sidebar-hovercard", "dock-chat", "dock-chat-team", "bell", "team-member", "dashboard-owner"] },
  { sha: "765c1cc", subject: "Enhance team chat and alert functionalities", scenes: ["sidebar-hovercard", "dashboard-owner", "alerts"] },
  { sha: "a4c6f6d", subject: "Refactor schedule and chat components", scenes: ["diary-day", "sidebar-hovercard", "dashboard-owner", "quick-add"] },
  { sha: "971c04c", subject: "Enhance chat and alert functionalities (reply to alerts)", scenes: ["dock-chat-thread", "alerts", "bell", "journey-board", "patient-record", "dashboard-owner"] },
  { sha: "8a89a91", subject: "Refactor journey board and treatment plan components (overdue)", scenes: ["journey-board", "patient-record", "dock-chat-team"] },
  { sha: "789f666", subject: "Add treatment due tests for various roles", scenes: ["dashboard-owner", "dashboard-practitioner", "dashboard-front-desk", "bell", "journey-board", "alerts", "portal-home", "patients-list"] },
  { sha: "9202460", subject: "Enhance treatment plan and dashboard functionalities", scenes: ["patient-record", "patient-record-treatments", "journey-board", "dashboard-owner", "quick-add", "team"] },
  { sha: "58d3dbe", subject: "Update insights data and recalculate logic", scenes: ["settings-payments", "dashboard-owner", "insights-book", "insights-marketing", "patients-list"] },
  { sha: "21dee87", subject: "Remove obsolete check scripts; metrics refactor", scenes: ["insights-marketing", "insights-book", "earnings", "performance", "performance-practitioner", "retention", "dashboard-owner", "patients-list"] },
];

const STATES = [BASE, ...COMMITS];

/** Scenes a state must capture: after-shots of its own commit, before-shots of the next. */
function scenesForState(i) {
  const own = STATES[i].scenes ?? [];
  const next = STATES[i + 1]?.scenes ?? [];
  return [...new Set([...own, ...next])];
}

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const assembleOnly = args.includes("--assemble");
const only = flag("--only")?.split(",").map((s) => s.trim()).filter(Boolean);
const from = Number(flag("--from") ?? 0);
/** --scenes a,b limits a recapture to those scenes (existing captures for other scenes are kept). */
const sceneFilter = flag("--scenes")?.split(",").map((s) => s.trim()).filter(Boolean);

const log = (msg) => console.log(`[walk ${new Date().toISOString().slice(11, 19)}] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function git(...a) {
  const r = spawnSync("git", ["-C", WORKTREE, ...a], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${a.join(" ")} failed: ${r.stderr}`);
  return r.stdout.trim();
}

async function httpStatus(url, cookie) {
  try {
    const res = await fetch(url, { headers: cookie ? { cookie } : {}, redirect: "manual", signal: AbortSignal.timeout(30_000) });
    return res.status;
  } catch {
    return 0;
  }
}

async function waitForPortFree(timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if ((await httpStatus(`http://127.0.0.1:${PORT}/auth`)) === 0) return true;
    await sleep(500);
  }
  return false;
}

async function startServer(logFile) {
  const out = fs.openSync(logFile, "w");
  const child = spawn(
    process.execPath,
    [path.join(WORKTREE, "node_modules/vite/bin/vite.js"), "dev", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"],
    {
      cwd: WORKTREE,
      detached: true,
      stdio: ["ignore", out, out],
      env: {
        ...process.env,
        DEMO: "1",
        DEMO_NOW,
        VITE_SUPABASE_URL: "https://demo.invalid",
        VITE_SUPABASE_PUBLISHABLE_KEY: "demo-placeholder-key",
        VITE_SUPABASE_PROJECT_ID: "demo",
        SUPABASE_URL: "https://demo.invalid",
        SUPABASE_PUBLISHABLE_KEY: "demo-placeholder-key",
      },
    },
  );
  child.unref();
  const end = Date.now() + 120_000;
  while (Date.now() < end) {
    if (child.exitCode !== null) throw new Error(`vite exited early (${child.exitCode}), see ${logFile}`);
    if ((await httpStatus(`http://127.0.0.1:${PORT}/auth`)) === 200) break;
    await sleep(1000);
  }
  // Warm the SSR compile for the heavy pages so the first capture is not a cold start.
  for (const p of ["/dashboard", "/schedule", "/patients", "/team"]) {
    await httpStatus(`http://127.0.0.1:${PORT}${p}`, "demo_role=owner");
  }
  return child;
}

async function stopServer(child) {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    /* already gone */
  }
  if (!(await waitForPortFree(10_000))) {
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      /* already gone */
    }
    await waitForPortFree(5_000);
  }
}

function runPlaywright(outDir, scenes) {
  const r = spawnSync("npx", ["playwright", "test", "--config", "playwright.changelog.config.ts"], {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      CHANGELOG_BASE_URL: `http://127.0.0.1:${PORT}`,
      CHANGELOG_OUT: outDir,
      CHANGELOG_SCENES: scenes.join(","),
    },
  });
  return r.status ?? 1;
}

async function captureState(i) {
  const state = STATES[i];
  const scenes = scenesForState(i).filter((s) => !sceneFilter || sceneFilter.includes(s));
  if (!scenes.length) return;
  const outDir = path.join(STATES_DIR, state.sha);
  fs.mkdirSync(outDir, { recursive: true });
  log(`state ${i}/${STATES.length - 1} ${state.sha}: ${scenes.length} scenes`);
  const full = git("rev-parse", state.sha);
  git("checkout", "--detach", "-f", "-q", full);
  if (!(await waitForPortFree(15_000))) throw new Error(`port ${PORT} is busy`);
  const started = Date.now();
  const server = await startServer(path.join(outDir, "server.log"));
  let status = 1;
  try {
    status = runPlaywright(outDir, scenes);
  } finally {
    await stopServer(server);
  }
  const stateFile = path.join(outDir, "state.json");
  const previous = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : null;
  fs.writeFileSync(
    stateFile,
    JSON.stringify(
      {
        index: i,
        sha: state.sha,
        full,
        subject: state.subject,
        scenes: [...new Set([...(previous?.scenes ?? []), ...scenes])],
        playwrightExit: status,
        seconds: Math.round((Date.now() - started) / 1000),
        capturedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  log(`state ${state.sha} done in ${Math.round((Date.now() - started) / 1000)}s (playwright exit ${status})`);
}

function readManifest(sha, scene, device) {
  const file = path.join(STATES_DIR, sha, "manifest", `${scene}--${device}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

function assemble() {
  const summary = { set: SET, generatedAt: new Date().toISOString(), demoNow: DEMO_NOW, devices: DEVICES, base: BASE.sha, commits: [] };
  // Each state's captures are stored once under states/<sha>/ and referenced
  // from both the commit they are the "after" of and the one they are the
  // "before" of, instead of being copied twice.
  const copied = new Set();
  const stateCopy = (sha, name) => {
    const src = path.join(STATES_DIR, sha, name);
    if (!fs.existsSync(src)) return null;
    const rel = path.join("states", sha, name);
    if (!copied.has(rel)) {
      fs.mkdirSync(path.join(DOCS_DIR, "states", sha), { recursive: true });
      const dest = path.join(DOCS_DIR, rel);
      fs.copyFileSync(src, dest);
      // The iPad devices capture at 2x; the doc copy only needs 1x (macOS sips).
      if (/--ipad-/.test(name) && process.platform === "darwin") {
        spawnSync("sips", ["-Z", "1024", "-s", "format", "jpeg", "-s", "formatOptions", "60", dest], { stdio: "ignore" });
      }
      copied.add(rel);
    }
    return rel; // relative to DOCS_DIR
  };
  COMMITS.forEach((commit, k) => {
    const before = STATES[k].sha; // state k is the parent of commit k (index k+1)
    const after = commit.sha;
    const nn = String(k + 1).padStart(2, "0");
    const dir = path.join(DOCS_DIR, "commits", `${nn}-${after}`);
    const entry = { index: k + 1, sha: after, parent: before, subject: commit.subject, dir: path.relative(ROOT, dir), scenes: {} };
    for (const scene of commit.scenes) {
      entry.scenes[scene] = {};
      for (const device of DEVICES) {
        const name = `${scene}--${device}.jpg`;
        const rec = { before: null, after: null, missingBefore: [], missingAfter: [], errorBefore: null, errorAfter: null, what: null };
        for (const [side, sha] of [["before", before], ["after", after]]) {
          rec[side] = stateCopy(sha, name);
          const m = readManifest(sha, scene, device);
          if (m) {
            rec[side === "before" ? "missingBefore" : "missingAfter"] = m.missing ?? [];
            rec[side === "before" ? "errorBefore" : "errorAfter"] = m.error ?? null;
            rec.what = m.what ?? rec.what;
          }
        }
        entry.scenes[scene][device] = rec;
      }
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(entry, null, 2));
    summary.commits.push(entry);
  });
  fs.mkdirSync(DOCS_DIR, { recursive: true });
  fs.writeFileSync(path.join(DOCS_DIR, "manifest.json"), JSON.stringify(summary, null, 2));
  const pairs = summary.commits.reduce((n, c) => n + Object.values(c.scenes).reduce((m, d) => m + Object.values(d).filter((r) => r.before && r.after).length, 0), 0);
  log(`assembled ${summary.commits.length} commits, ${pairs} before/after pairs into ${path.relative(ROOT, DOCS_DIR)}`);
}

async function main() {
  if (!fs.existsSync(WORKTREE)) throw new Error(`worktree not found: ${WORKTREE}`);
  if (!assembleOnly) {
    let indices = STATES.map((_, i) => i).filter((i) => i >= from);
    if (only?.length) {
      // A commit needs its own state and its parent's state.
      const wanted = new Set();
      for (const sha of only) {
        const i = STATES.findIndex((s) => s.sha === sha);
        if (i < 0) throw new Error(`unknown commit ${sha}`);
        wanted.add(i);
        if (i > 0) wanted.add(i - 1);
      }
      indices = [...wanted].sort((a, b) => a - b);
    }
    for (const i of indices) await captureState(i);
  }
  assemble();
}

// Run only when executed directly; write-docs.mjs imports COMMITS from here.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
