import fs from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { check, DEMO_ROLES, isWebsitePath, record, ROOT, ROUTES, SITE_DIST, SITE_SRC } from "./lib";

/**
 * Static consistency between the three places that must agree: the website's
 * pages, the gateway's route table and the demo personas. No browser needed.
 */

// Website pages that are in routes.json on purpose but not built yet.
const PLACEHOLDERS = new Set(["/about", "/investors", "/sitemap.xml"]);

function websitePagePaths() {
  return fs
    .readdirSync(path.join(SITE_SRC, "pages"))
    .filter((f) => f.endsWith(".astro"))
    .map((f) => f.replace(/\.astro$/, ""))
    .map((name) => (name === "index" ? "/" : `/${name}`));
}

function readAll(dir: string, exts: string[]): string {
  let out = "";
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out += readAll(p, exts);
    else if (exts.some((e) => entry.name.endsWith(e))) out += fs.readFileSync(p, "utf8");
  }
  return out;
}

/** Top-level URL segments the app owns, from its file-based routes. */
function appSegments() {
  const routesDir = path.join(ROOT, "src/routes");
  const segs = new Set<string>();
  const add = (name: string) => {
    const first = name.split(".")[0]!;
    if (!first || first.startsWith("_") || first === "index") return;
    segs.add(first.replace(/^\$.*/, ""));
  };
  for (const f of fs.readdirSync(routesDir)) {
    if (f.endsWith(".tsx") || f.endsWith(".ts")) add(f);
  }
  for (const f of fs.readdirSync(path.join(routesDir, "_authenticated"))) add(f);
  segs.delete("");
  return segs;
}

test("every website page is routed to the website by the gateway", async () => {
  const testInfo = test.info();
  for (const p of websitePagePaths()) {
    const routed = isWebsitePath(p);
    check(testInfo, `page ${p} is in routes.json`, routed, routed ? "" : "add it to website.exact");
  }
});

test("every gateway website path has a built page or is a known placeholder", async () => {
  const testInfo = test.info();
  for (const p of ROUTES.website.exact) {
    const candidates = [
      path.join(SITE_DIST, p),
      path.join(SITE_DIST, p, "index.html"),
      path.join(SITE_DIST, `${p}.html`),
    ];
    const built = candidates.some((c) => fs.existsSync(c) && fs.statSync(c).isFile());
    if (built) record(testInfo, { check: `routes.json ${p} resolves in dist`, result: "pass" });
    else if (PLACEHOLDERS.has(p))
      record(testInfo, {
        check: `routes.json ${p}`,
        result: "info",
        note: "placeholder: no page yet, serves the website 404",
      });
    else
      check(
        testInfo,
        `routes.json ${p} resolves in dist`,
        false,
        "listed but not built and not a known placeholder",
      );
  }
});

test("website personas and gateway demo roles agree", async () => {
  const testInfo = test.info();
  const src = readAll(SITE_SRC, [".astro", ".ts"]);
  const referenced = new Set([...src.matchAll(/\/demo\/enter\?role=([a-z_]+)/g)].map((m) => m[1]!));
  for (const role of referenced) {
    check(
      testInfo,
      `website role "${role}" exists in gateway demoRoles`,
      DEMO_ROLES.includes(role),
    );
  }
  for (const role of DEMO_ROLES) {
    check(
      testInfo,
      `gateway role "${role}" is reachable from the website`,
      referenced.has(role),
      referenced.has(role) ? "" : "no website link uses it",
    );
  }
  // The persona pill in the app knows these too (Receptionist = front_desk).
  const switcher = fs.readFileSync(
    path.join(ROOT, "src/components/demo/role-switcher.tsx"),
    "utf8",
  );
  for (const role of DEMO_ROLES) {
    check(testInfo, `app Demo pill knows "${role}"`, switcher.includes(`value: "${role}"`));
  }
});

test("no website path collides with an app route", async () => {
  const testInfo = test.info();
  const segs = appSegments();
  const websitePaths = [...ROUTES.website.exact, ...ROUTES.website.prefixes].filter(
    (p) => p !== "/",
  );
  for (const p of websitePaths) {
    const first = p.split("/")[1]!.replace(/\/$/, "");
    check(
      testInfo,
      `website path ${p} does not shadow an app route`,
      !segs.has(first),
      segs.has(first) ? `app owns /${first}` : "",
    );
  }
  record(testInfo, {
    check: "app top-level segments",
    result: "info",
    note: [...segs].sort().join(", "),
  });
});

test("the sign-in redirect table only names exact app sign-in paths", async () => {
  const testInfo = test.info();
  const entries = Object.entries(ROUTES.signIn).filter(([k]) => !k.startsWith("$"));
  check(
    testInfo,
    "signIn maps /auth and /portal",
    entries.some(([k]) => k === "/auth") && entries.some(([k]) => k === "/portal"),
  );
  for (const [from, to] of entries) {
    check(
      testInfo,
      `signIn ${from} → ${to} lands on a website page`,
      isWebsitePath(to.split("#")[0]!.split("?")[0]!),
    );
  }
});
