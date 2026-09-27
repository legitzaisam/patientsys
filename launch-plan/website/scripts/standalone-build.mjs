// Build self-contained HTML files of the website: one file per page, with CSS,
// JavaScript, fonts and images inlined, so each opens on its own (for example
// in a design canvas or straight from a folder) with no server and no build.
//
//   node scripts/standalone-build.mjs [outDir]     (default: website/standalone/)
//
// Uses preview mode: demo buttons open a short note instead of the app.
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.resolve(process.argv[2] || path.join(root, "standalone"));
const build = fs.mkdtempSync(path.join(os.tmpdir(), "site-standalone-"));

execSync(`npx astro build --outDir ${build}`, {
  cwd: root,
  stdio: "ignore",
  env: { ...process.env, PUBLIC_PREVIEW_MODE: "true" },
});

const mime = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const dataUri = (file) =>
  `data:${mime[path.extname(file)]};base64,${fs.readFileSync(file).toString("base64")}`;
const fromSite = (url) => path.join(build, url.replace(/^\//, ""));

function inlineCss(css) {
  return (
    css
      // Keep Latin fonts only; drop Vietnamese / Latin-ext subsets and woff fallbacks.
      .replace(/@font-face\{[^}]*(vietnamese|latin-ext)[^}]*\}/g, "")
      .replace(/,url\([^)]*\.woff\) format\("woff"\)/g, "")
      .replace(/url\((\/_astro\/[^)]+\.woff2)\)/g, (_, u) => `url(${dataUri(fromSite(u))})`)
  );
}

function standalone(pageFile, links, isHome) {
  let html = fs.readFileSync(path.join(build, pageFile), "utf8");

  // Stylesheets -> <style>.
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, href) => {
    return `<style>${inlineCss(fs.readFileSync(fromSite(href), "utf8"))}</style>`;
  });

  // All module scripts, in document order, bundled into one inline module at
  // the end of <body> so the shared motion module has a single instance.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "entry-"));
  const imports = [];
  let n = 0;
  html = html.replace(
    /<script type="module"(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g,
    (_, src, code) => {
      if (src) {
        imports.push(fromSite(src));
      } else {
        const f = path.join(tmp, `inline-${n++}.js`);
        fs.writeFileSync(f, code);
        imports.push(f);
      }
      return "";
    },
  );
  const entry = path.join(tmp, "entry.js");
  fs.writeFileSync(entry, imports.map((f) => `import ${JSON.stringify(f)};`).join("\n"));
  const bundle = path.join(tmp, "bundle.js");
  execSync(`npx esbuild ${entry} --bundle --format=esm --minify --outfile=${bundle}`, {
    cwd: root,
    stdio: "ignore",
  });
  const js = fs.readFileSync(bundle, "utf8").replace(/<\/script/gi, "<\\/script");
  // A function replacement, so "$" sequences in the bundle are not special.
  html = html.replace("</body>", () => `<script type="module">${js}</script></body>`);

  // Images -> data URIs (srcset dropped; src keeps the size chosen per use).
  html = html
    .replace(/\s(?:srcset|sizes)="[^"]*"/g, "")
    .replace(/(["'(])\/(img\/[^"')\s]+)/g, (_, q, u) => `${q}${dataUri(fromSite(u))}`)
    .replace(/href="\/favicon\.svg"/g, `href="${dataUri(fromSite("favicon.svg"))}"`)
    .replace(/<link rel="manifest"[^>]*>/g, "")
    .replace(/<link rel="canonical"[^>]*>/g, "")
    .replace(/<meta property="og:url"[^>]*>/g, "");

  // Page links.
  html = html
    .replace(/href="\/login"/g, `href="${links.login}"`)
    .replace(/href="\/#/g, isHome ? 'href="#' : `href="${links.home}#`)
    .replace(/href="\/"/g, `href="${links.home}"`);
  return html;
}

fs.mkdirSync(out, { recursive: true });
const pages = { home: "home.html", login: "login.html" };
fs.writeFileSync(path.join(out, pages.home), standalone("index.html", pages, true));
fs.writeFileSync(path.join(out, pages.login), standalone("login/index.html", pages, false));
fs.rmSync(build, { recursive: true, force: true });
for (const f of Object.values(pages)) {
  console.log(
    `${path.join(out, f)}  ${(fs.statSync(path.join(out, f)).size / 1024).toFixed(0)} KB`,
  );
}
