#!/usr/bin/env node
// Writes the per-commit changelog pages and the set index from three inputs:
// the hand-written notes (notes-<date>.mjs), git (message, author, file list)
// and the capture manifest that walk-commits.mjs assembled. Re-run after any
// of the three changes; it only writes Markdown.
//
//   node scripts/changelog/write-docs.mjs

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMMITS } from "./walk-commits.mjs";
import { NOTES, SET } from "./notes-2026-09-28.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DOCS_DIR = path.join(ROOT, "docs/changelog", SET.id);
const COMMITS_DIR = path.join(DOCS_DIR, "commits");
const DEVICES = [
  { id: "chromium-1440", label: "Desktop 1440" },
  { id: "ipad-landscape", label: "iPad landscape" },
  { id: "ipad-portrait", label: "iPad portrait" },
];

const git = (...a) => spawnSync("git", ["-C", ROOT, ...a], { encoding: "utf8" }).stdout;
const manifest = JSON.parse(fs.readFileSync(path.join(DOCS_DIR, "manifest.json"), "utf8"));

function meta(sha) {
  const [full, author, email, date, parents, ...body] = git("show", "-s", "--format=%H%n%an%n%ae%n%aI%n%P%n%B", sha).split("\n");
  return { full, author, email, date, parents: parents.trim().split(" "), message: body.join("\n").trim() };
}

function files(sha) {
  return git("show", "--numstat", "--format=", sha)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [add, del, file] = line.split("\t");
      return { file, add: add === "-" ? null : Number(add), del: del === "-" ? null : Number(del) };
    });
}

const AREAS = [
  ["Components", (f) => f.startsWith("src/components/")],
  ["Routes (pages)", (f) => f.startsWith("src/routes/")],
  ["Library and server functions", (f) => f.startsWith("src/lib/") || f.startsWith("src/integrations/") || f === "src/styles.css"],
  ["Database migrations", (f) => f.startsWith("supabase/")],
  ["End-to-end tests", (f) => f.startsWith("e2e/")],
  ["Unit tests", (f) => f.startsWith("tests/") || f.endsWith(".test.ts") || f.startsWith("vitest.")],
  ["Docs and scripts", (f) => f.startsWith("docs/") || f.startsWith("scripts/") || f.endsWith(".mjs")],
  ["Marketing site (launch-plan)", (f) => f.startsWith("launch-plan/")],
  ["Claude outputs (design files)", (f) => f.startsWith("Claude outputs/")],
  ["Other", () => true],
];

function filesTable(list) {
  const groups = new Map();
  for (const f of list) {
    const area = AREAS.find(([, test]) => test(f.file))[0];
    if (!groups.has(area)) groups.set(area, []);
    groups.get(area).push(f);
  }
  const out = [];
  for (const [area] of AREAS) {
    const rows = groups.get(area);
    if (!rows) continue;
    const add = rows.reduce((n, r) => n + (r.add ?? 0), 0);
    const del = rows.reduce((n, r) => n + (r.del ?? 0), 0);
    out.push(`<details><summary><strong>${area}</strong> · ${rows.length} file${rows.length === 1 ? "" : "s"}, +${add} / −${del}</summary>`, "", "| File | + | − |", "| ---- | -: | -: |");
    for (const r of rows) out.push(`| \`${r.file}\` | ${r.add ?? "bin"} | ${r.del ?? "bin"} |`);
    out.push("", "</details>", "");
  }
  return out.join("\n");
}

const nn = (i) => String(i).padStart(2, "0");
const short = (sha) => sha.slice(0, 7);
const ghCommit = (sha) => `${SET.repo}/commit/${sha}`;
const fmtDate = (iso) => new Date(iso).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" }) + " (London)";

function sceneSection(entry, dirName, scene, devices) {
  const anyRec = Object.values(devices)[0];
  const lines = [`### ${anyRec?.what ?? scene}`, ""];
  lines.push(`Scene \`${scene}\` · ${personaOf(scene)}`, "");
  for (const d of DEVICES) {
    const rec = devices[d.id];
    if (!rec) continue;
    const compare = `${dirName}/compare/${scene}--${d.id}.jpg`;
    const exists = fs.existsSync(path.join(COMMITS_DIR, compare));
    const notes = [];
    if (rec.missingBefore?.length) notes.push(`Before: not on the page yet — ${rec.missingBefore.join("; ")}.`);
    if (rec.missingAfter?.length) notes.push(`After: not found — ${rec.missingAfter.join("; ")}.`);
    if (rec.errorBefore) notes.push(`Before capture error: ${rec.errorBefore}`);
    if (rec.errorAfter) notes.push(`After capture error: ${rec.errorAfter}`);
    // rec.before / rec.after are relative to the set folder; pages live in commits/.
    const raw = [rec.before ? `[before](../${rec.before})` : "before: none", rec.after ? `[after](../${rec.after})` : "after: none"].join(" · ");
    // Inside <summary> GitHub does not render Markdown links, so use HTML there.
    const rawHtml = [rec.before ? `<a href="../${rec.before}">before</a>` : "before: none", rec.after ? `<a href="../${rec.after}">after</a>` : "after: none"].join(" · ");
    if (d.id === "chromium-1440") {
      lines.push(`**${d.label}** — ${raw}`, "");
      if (exists) lines.push(`![${scene} on ${d.label}: before ${short(entry.parent)} and after ${short(entry.sha)}](${compare})`, "");
    } else {
      lines.push(`<details><summary><strong>${d.label}</strong> — ${rawHtml}</summary>`, "");
      if (exists) lines.push(`![${scene} on ${d.label}](${compare})`, "");
      lines.push("</details>", "");
    }
    if (notes.length) lines.push(...notes.map((n) => `> ${n}`), "");
  }
  return lines.join("\n");
}

// Persona per scene, read from the spec so the page can say who is signed in.
const specSource = fs.readFileSync(path.join(ROOT, "e2e/changelog/commit-captures.spec.ts"), "utf8");
function personaOf(scene) {
  const m = specSource.match(new RegExp(`id: "${scene}"[\\s\\S]*?persona: "([a-z_]+)"`));
  const p = m?.[1] ?? "owner";
  return { owner: "signed in as the clinic owner", practitioner: "signed in as a practitioner", front_desk: "signed in as front desk", patient: "signed in as a patient" }[p] ?? p;
}

function commitPage(entry, i) {
  const note = NOTES[entry.sha];
  if (!note) throw new Error(`no notes for ${entry.sha}`);
  const m = meta(entry.sha);
  const list = files(entry.sha);
  const add = list.reduce((n, r) => n + (r.add ?? 0), 0);
  const del = list.reduce((n, r) => n + (r.del ?? 0), 0);
  const dirName = `${nn(i)}-${entry.sha}`;
  const prev = i > 1 ? `[← ${nn(i - 1)}](${nn(i - 1)}-${COMMITS[i - 2].sha}.md)` : "[← Index](../README.md)";
  const next = i < COMMITS.length ? `[${nn(i + 1)} →](${nn(i + 1)}-${COMMITS[i].sha}.md)` : "[Index →](../README.md)";

  const out = [
    `# ${nn(i)} · ${note.title}`,
    "",
    `${prev} · [Index](../README.md) · ${next}`,
    "",
    "| | |",
    "| --- | --- |",
    `| Commit | \`${m.full}\` · [on GitHub](${ghCommit(m.full)}) |`,
    `| Parent (the "before") | \`${short(m.parents[0])}\` |`,
    `| Author | ${m.author} |`,
    `| Date | ${fmtDate(m.date)} |`,
    `| Size | ${list.length} files, +${add} / −${del} |`,
    "",
    `> **In one line:** ${note.summary}`,
    "",
    "## Commit message",
    "",
    ...m.message.split("\n").map((l) => `> ${l}`),
    "",
    "## What changed, compared with the commit before",
    "",
    note.changes.trim(),
    "",
    ...(note.observed ? ["## Observed in the captures", "", note.observed.trim(), ""] : []),
    "## Before and after",
    "",
    `Left: the app at \`${short(entry.parent)}\`. Right: the app at \`${short(entry.sha)}\`. Both run the demo fixture with the clock pinned to ${SET.demoNow}. Desktop is shown inline; the iPad captures are folded underneath. Where a control did not exist before the commit, the note under the image says so.`,
    "",
  ];
  const scenes = Object.entries(entry.scenes);
  if (!scenes.length) out.push("_No captures for this commit._", "");
  for (const [scene, devices] of scenes) out.push(sceneSection(entry, dirName, scene, devices), "");
  out.push("## Files", "", filesTable(list), "", `${prev} · [Index](../README.md) · ${next}`, "");
  return out.join("\n");
}

function setIndex() {
  const rows = COMMITS.map((c, k) => {
    const i = k + 1;
    const note = NOTES[c.sha];
    const entry = manifest.commits.find((e) => e.sha === c.sha);
    const shots = entry ? Object.keys(entry.scenes).length : 0;
    return `| ${nn(i)} | [\`${c.sha}\`](${ghCommit(meta(c.sha).full)}) | [${note.title}](commits/${nn(i)}-${c.sha}.md) | ${shots} |`;
  });
  return `# ${SET.title}

Everything that arrived on \`${SET.branch}\` between our last push (\`${SET.from}\`) and the remote head (\`${SET.to}\`): what each commit does, and how the app looked before and after it.

## What was pulled

- **19 commits**, a clean fast-forward. \`package.json\` and the lockfile did not change, so the old and new checkouts share one \`node_modules\`.
- **15 app commits**, documented one page each (table below). Every commit is compared with its own parent, so a page touched by several commits shows one step at a time.
- **4 commits without app changes**, not documented further:
${SET.skipped.map((s) => `  - \`${s.sha}\`: ${s.why}`).join("\n")}

## Signing in to the before and after apps

While this set was being made the old app ran on port 8095 (\`${SET.from}\`) and the new one on port 8096 (\`${SET.to}\`): [old clinic portal](http://127.0.0.1:8095/dashboard), [new clinic portal](http://127.0.0.1:8096/dashboard), [old patient portal](http://127.0.0.1:8095/my-record), [new patient portal](http://127.0.0.1:8096/my-record). Go straight to \`/dashboard\` or \`/my-record\`: the root \`/\` is the app's public landing page with a Staff sign in button, and it looks the same in demo and live mode. Both servers are demo mode (\`DEMO=1\`, fixture data, the clock pinned to ${SET.demoNow}), so **no password is checked**: the server trusts a \`demo_role\` cookie. Switch role with the **Demo pill** at the bottom-left of any page, or, behind the launch gateway, open \`/demo/enter?role=owner|practitioner|front_desk|patient\`. Signing in at \`/auth\` with one of the emails maps it onto the persona, but that needs a real Supabase project where the account exists; the passwords are the ones \`scripts/provision-staff.mjs\` creates. The same table lives in the repo [README](../../../README.md#demo-accounts-and-roles).

| Role (\`demo_role\`) | Persona you become | Sign-in email | Password | Lands on |
| ------------------ | ------------------ | ------------- | -------- | -------- |
| \`owner\` (clinic owner) | Dr Amara Osei, Clinic Director | \`amara.osei@aetheria.clinic\` | Set by \`OWNER_PASSWORD\` when the owner was provisioned; not in the repo | \`/dashboard\` |
| \`manager\` | Maya Chen, Clinic manager | \`maya.chen@aetheria.clinic\` | Pill only (no account provisioned) | \`/dashboard\` |
| \`practitioner\` | Dr Nadia Rahman, Aesthetic Practitioner | \`nadia.rahman@aetheria.clinic\` | \`Practitioner1!\` | \`/dashboard\` |
| \`practitioner\` | Dr Tom Whitfield, Aesthetic Doctor | \`tom.whitfield@aetheria.clinic\` | \`Practitioner2!\` | \`/dashboard\` |
| \`front_desk\` (receptionist) | Sofia Marchetti, Patient Coordinator | \`sofia.marchetti@aetheria.clinic\` | \`Reception1!\` | \`/dashboard\` |
| \`patient\` | Olivia Bennett | \`olivia.bennett@example.com\` | Pill only (no account provisioned); \`/portal\` if one is created | \`/my-record\` |
| \`admin\` (software admin) | Software developer | \`developer@aetheria.clinic\` | \`Developer1!\` | \`/access\` |

The **live** project has a different roster (Zaisam Al-Dulimi as owner, a test manager, the three scripted staff, a software admin and one patient); it is listed under [Live accounts and roles](../../../README.md#live-accounts-and-roles) in the repo README.

## Database migrations that arrived

Demo mode runs on fixtures, so none of these were applied here. They matter for the live Supabase project.

| Migration | Commit | What it does |
| --------- | ------ | ------------ |
${SET.migrations.map((m) => `| \`${m.file}\` | \`${m.commit}\` | ${m.what} |`).join("\n")}

## The commits

| # | Commit | Change | Scenes |
| - | ------ | ------ | -----: |
${rows.join("\n")}

## Things worth knowing after this pull

- \`/earnings\` now redirects to \`/profile\`; earnings live on the **Performance** tab of My profile (\`a9913cc\`).
- The staff **notification bell shows new bookings only**; patient and team messages live in the floating chat bubble (\`142563a\`, \`46dff1a\`).
- Attention needed's **Treatment due** rows are exactly the journey board's Book chase, scoped per role (\`789f666\`), and profile change requests appear there for owners and managers (\`9202460\`).
- A booking only counts for a plan step when it was booked from the step or matches the plan's treatment; otherwise the step stays overdue and the other booking is named on the plan card (\`9202460\`).
- Every report reads one window definition in **Europe/London** time and one set of counting rules (\`58d3dbe\`, \`21dee87\`).
- \`a9913cc\` committed a \`launch-plan/website/.tmp-claude/\` folder (zips and temp JSON) that looks accidental, and \`9202460\` added three \`check-*.mjs\` scripts to the repo root that \`21dee87\` removed again.
- **Layout to look at:** on My profile → Performance at iPad landscape width (1024 px), the "Your performance" heading and subtitle are squeezed to a few characters per line beside the period picker and tab row, from \`a9913cc\` through \`21dee87\` (see [01](commits/01-a9913cc.md)).

## How this was made

- **Two worktrees.** The old app stayed alive in \`~/aetheria-worktrees/before\` (detached at \`${SET.from}\`) while the main checkout pulled. A second worktree, \`stepper\`, was checked out at each of the 16 states (\`${SET.base}\` then each commit) and the demo app started on port 8093 for each.
- **Same clock everywhere.** Every server ran with \`DEMO=1 DEMO_NOW=${SET.demoNow}\`, so dates and numbers match between before and after.
- **Devices.** Desktop Chromium at 1440×1400, iPad Mini landscape and iPad Mini portrait (WebKit). Pages are captured full-page where the page scrolls, viewport-only for fixed panels and dialogs.
- **Scenes** are defined in \`e2e/changelog/commit-captures.spec.ts\`; each commit's scenes are listed in \`scripts/changelog/walk-commits.mjs\`. Open steps are tolerant: when a control did not exist at a commit, the page is captured as it was and the fact is recorded in \`manifest.json\` and under the image.
- **Rerun:** \`node scripts/changelog/walk-commits.mjs\` (add \`--only <sha>\` to redo one commit and its parent), then \`node scripts/changelog/compose.mjs\`, then \`node scripts/changelog/write-docs.mjs\`. Notes live in \`scripts/changelog/notes-2026-09-28.mjs\`.

Generated ${new Date().toISOString().slice(0, 10)}.
`;
}

function rollingIndex() {
  const file = path.join(ROOT, "docs/changelog/README.md");
  const sets = fs
    .readdirSync(path.join(ROOT, "docs/changelog"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .reverse();
  const lines = [
    "# Changelog",
    "",
    "One folder per pull from the shared branch. Each folder documents every commit that arrived, with before and after captures of the app.",
    "",
    "| Set | Branch | Range |",
    "| --- | ------ | ----- |",
  ];
  for (const name of sets) {
    const isThis = name === SET.id;
    lines.push(`| [${name}](${name}/README.md) | ${isThis ? SET.branch : ""} | ${isThis ? `\`${SET.from}\` → \`${SET.to}\`` : ""} |`);
  }
  lines.push("", "Regenerate a set with `node scripts/changelog/write-docs.mjs` after `walk-commits.mjs` and `compose.mjs` have run.", "");
  fs.writeFileSync(file, lines.join("\n"));
}

fs.mkdirSync(COMMITS_DIR, { recursive: true });
let written = 0;
for (const entry of manifest.commits) {
  const i = COMMITS.findIndex((c) => c.sha === entry.sha) + 1;
  fs.writeFileSync(path.join(COMMITS_DIR, `${nn(i)}-${entry.sha}.md`), commitPage(entry, i));
  written++;
}
fs.writeFileSync(path.join(DOCS_DIR, "README.md"), setIndex());
rollingIndex();
console.log(`wrote ${written} commit pages, ${path.relative(ROOT, DOCS_DIR)}/README.md and docs/changelog/README.md`);
