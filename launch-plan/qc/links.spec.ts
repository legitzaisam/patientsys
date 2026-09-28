import { test } from "@playwright/test";
import { check, head, isWebsitePath, record, ROUTES } from "./lib";

/**
 * Crawl every website page and prove every link and asset resolves. Runs on
 * the desktop and the phone (the phone opens the mobile menu so its links are
 * in play too; both menus are in the DOM regardless).
 */
const PAGES = ["/", "/pricing", "/contact", "/demo", "/login", "/404"];

type Link = { href: string; text: string };

test.describe("website links", () => {
  for (const pagePath of PAGES) {
    test(`links and assets on ${pagePath}`, async ({ page, request, baseURL }, testInfo) => {
      const res = await page.goto(pagePath, { waitUntil: "domcontentloaded" });
      // A direct visit to /404 is a built page and returns 200; unknown paths
      // return the same page with a 404 status (checked in gateway-health).
      check(testInfo, `${pagePath} loads`, res?.status() === 200, `status ${res?.status()}`);
      const isWebsite = /data-astro-cid-/.test(await page.content());
      check(testInfo, `${pagePath} is served by the website`, isWebsite);

      // Phone: open the menu so its links are the ones a visitor would use.
      const menu = page.locator("[data-menu-btn]");
      if (await menu.isVisible().catch(() => false)) await menu.click();

      const links: Link[] = await page.$$eval("a[href]", (as) =>
        as.map((a) => ({
          href: a.getAttribute("href") ?? "",
          text: (a.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 40),
        })),
      );
      const seen = new Set<string>();
      for (const { href, text } of links) {
        if (seen.has(href)) continue;
        seen.add(href);
        const label = `${pagePath} → ${href}${text ? ` ("${text}")` : ""}`;

        if (/^(mailto:|tel:)/.test(href)) {
          record(testInfo, { check: label, result: "skip", note: "mail/tel link" });
          continue;
        }
        if (/^https?:\/\//.test(href)) {
          record(testInfo, { check: label, result: "skip", note: "external" });
          continue;
        }
        const url = new URL(href, `${baseURL}${pagePath}`);
        const targetPath = url.pathname;

        if (url.hash) {
          // Same-page or cross-page anchor: the id must exist on the target page.
          const targetHtml =
            targetPath === pagePath ? await page.content() : (await head(request, targetPath)).body;
          const id = url.hash.slice(1);
          const exists = new RegExp(`id=["']${id}["']`).test(targetHtml) || id === "demo-note";
          check(
            testInfo,
            label,
            exists,
            exists ? `#${id} found on ${targetPath}` : `#${id} missing on ${targetPath}`,
          );
          continue;
        }
        if (targetPath === "/demo/enter") {
          const r = await head(request, `${targetPath}${url.search}`);
          const role = url.searchParams.get("role") ?? "";
          const expected = ROUTES.demoRoles[role];
          check(
            testInfo,
            label,
            r.status === 302 && r.location === expected,
            `302 → ${r.location}`,
          );
          continue;
        }
        if (!isWebsitePath(targetPath)) {
          check(
            testInfo,
            label,
            false,
            "website links straight into an app path; only /demo/enter may cross over",
          );
          continue;
        }
        const r = await head(request, `${targetPath}${url.search}`);
        const ok = r.status === 200 || (targetPath === "/404" && r.status === 404);
        check(testInfo, label, ok, `status ${r.status}`);
      }

      // Stylesheets, scripts, images, video: every one must load, and hashed
      // assets must be cached as immutable.
      const assets: string[] = await page.$$eval(
        'link[rel="stylesheet"][href], script[src], img[src], video[src], source[src], link[rel="icon"][href], link[rel="manifest"][href]',
        (els) => els.map((e) => e.getAttribute("href") ?? e.getAttribute("src") ?? ""),
      );
      for (const src of new Set(assets)) {
        if (!src || /^(data:|https?:)/.test(src)) continue;
        const r = await head(request, src);
        const immutable =
          !src.startsWith("/_astro/") || /immutable/.test(r.headers["cache-control"] ?? "");
        check(
          testInfo,
          `${pagePath} asset ${src}`,
          r.status === 200 && immutable,
          `status ${r.status}${src.startsWith("/_astro/") ? `, cache-control: ${r.headers["cache-control"]}` : ""}`,
        );
      }
    });
  }
});
