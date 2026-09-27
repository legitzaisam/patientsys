// Build a website-only preview that can be hosted as a claude.ai Artifact.
//
//   node scripts/artifact-build.mjs        -> writes website/artifact/
//
// Differences from the normal build:
// - PUBLIC_PREVIEW_MODE=true: demo buttons open a note (no app behind it).
// - Asset URLs are made relative, and index.html is reduced to head + body
//   content because the Artifact host adds its own document skeleton.
// - /login becomes login.html (a full document, served as-is).
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const build = path.join(root, "dist-preview");
const out = path.join(root, "artifact");

execSync(`npx astro build --outDir ${build}`, {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, PUBLIC_PREVIEW_MODE: "true" },
});

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
// The Artifact host reserves names starting with "_", so _astro/ becomes assets/.
fs.cpSync(path.join(build, "_astro"), path.join(out, "assets"), { recursive: true });
fs.cpSync(path.join(build, "img"), path.join(out, "img"), { recursive: true });
fs.copyFileSync(path.join(build, "favicon.svg"), path.join(out, "favicon.svg"));

function relativise(html) {
  return html
    .replace(/(["'\s,(])\/_astro\//g, "$1assets/")
    .replace(/(["'\s,(])\/img\//g, "$1img/")
    .replace(/href="\/favicon\.svg"/g, 'href="favicon.svg"')
    .replace(/<link rel="manifest"[^>]*>/g, "")
    .replace(/<link rel="canonical"[^>]*>/g, "")
    .replace(/<meta property="og:url"[^>]*>/g, "")
    .replace(/href="\/login"/g, 'href="login.html"')
    .replace(/href="\/#/g, 'href="#')
    .replace(/href="\/"/g, 'href="./"');
}

// index.html -> skeleton-free page content with its <title> first.
const index = relativise(fs.readFileSync(path.join(build, "index.html"), "utf8"));
const head = index.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = index.match(/<body[^>]*>([\s\S]*?)<\/body>/)[1];
const headRest = head
  .replace(/<title>[\s\S]*?<\/title>/, "")
  .replace(/<meta charset="[^"]*"\s*\/?>/, "")
  .replace(/<meta name="viewport"[^>]*>/, "");
fs.writeFileSync(
  path.join(out, "index.html"),
  `<title>Aetheria Website</title>\n${headRest}\n${body}\n`,
);

// login.html stays a full document.
fs.writeFileSync(
  path.join(out, "login.html"),
  relativise(fs.readFileSync(path.join(build, "login", "index.html"), "utf8")),
);

// CSS: fonts sit next to the stylesheet, so strip the absolute prefix.
for (const f of fs.readdirSync(path.join(out, "assets"))) {
  if (!f.endsWith(".css")) continue;
  const p = path.join(out, "assets", f);
  fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/url\(\/_astro\//g, "url("));
}

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else files.push(path.relative(out, p));
  }
})(out);
console.log(`artifact/ ready: ${files.length} files`);
