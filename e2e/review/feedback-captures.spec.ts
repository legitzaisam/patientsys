import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

/**
 * Review pack for the clinic-portal feedback document. Each scene is one
 * page (or one opened state) captured per device into
 * docs/portal-feedback/captures/<scene>--<device>.jpg; the last test writes
 * docs/portal-feedback/REVIEW.md, which maps every bullet of the document to
 * its status (from README.md) and the captures that show it.
 *
 * Runs under playwright.review.config.ts (port 8092, three devices).
 */

const CAPTURES_DIR = "docs/portal-feedback/captures";
const README = "docs/portal-feedback/README.md";
const REVIEW = "docs/portal-feedback/REVIEW.md";

type Persona = "owner" | "practitioner" | "front_desk" | "patient";

type Scene = {
  id: string;
  persona: Persona;
  path: string;
  /** Something that proves the page has loaded. */
  settle: string;
  /** Optional state to open before the capture. */
  open?: (page: Page) => Promise<void>;
  /** Sections of the feedback document this scene shows. */
  sections: string[];
};

const wait = (page: Page, ms: number) => page.waitForTimeout(ms);

async function openOlivia(page: Page) {
  await page.goto("/patients");
  await page.getByLabel("Search by name or reference").fill("Bennett");
  await page
    .getByRole("link", { name: /Bennett, .*Olivia/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1, name: /Olivia Bennett/ })).toBeVisible();
}

const SCENES: Scene[] = [
  {
    id: "dashboard-owner",
    persona: "owner",
    path: "/dashboard",
    settle: '[data-qc="kpi-total-clients"]',
    sections: ["Before 2 October", "Across the whole portal", "Dashboard"],
  },
  {
    id: "dashboard-practitioner",
    persona: "practitioner",
    path: "/dashboard",
    settle: '[data-qc="kpi-your-clients"]',
    sections: ["Dashboard"],
  },
  {
    id: "dashboard-receptionist",
    persona: "front_desk",
    path: "/dashboard",
    settle: '[data-qc="kpi-total-clients"]',
    sections: ["Dashboard", "Roles and security, for the engineer"],
  },
  {
    id: "diary-day",
    persona: "owner",
    path: "/schedule",
    settle: '[data-qc="needs-action"]',
    sections: ["Diary"],
  },
  {
    id: "diary-needs-action",
    persona: "owner",
    path: "/schedule",
    settle: '[data-qc="needs-action"]',
    open: async (page) => {
      const main = page.locator('[data-qc="needs-action-main"]');
      if (!(await main.isVisible())) return;
      await main.click();
      await wait(page, 300);
      const caret = page.locator('[data-qc="needs-action-caret"]');
      if (await caret.isVisible()) {
        await caret.click();
        await page.locator('[data-qc="needs-action-menu"]').waitFor({ state: "visible" });
      }
      await wait(page, 300);
    },
    sections: ["Diary"],
  },
  {
    id: "diary-week",
    persona: "owner",
    path: "/schedule",
    settle: '[data-qc="needs-action"]',
    open: async (page) => {
      await page.getByRole("button", { name: /^week$/i }).click();
      await wait(page, 800);
    },
    sections: ["Diary"],
  },
  {
    id: "patients-list",
    persona: "owner",
    path: "/patients",
    settle: '[data-qc="patients-filter-all"]',
    sections: ["Before 2 October", "Across the whole portal", "Patients list and journey board"],
  },
  {
    id: "patients-board",
    persona: "owner",
    path: "/patients?tab=board",
    settle: '[data-qc="board-book"], .page-title',
    sections: ["Patients list and journey board"],
  },
  {
    id: "patient-record",
    persona: "owner",
    path: "/patients",
    settle: "h1",
    open: openOlivia,
    sections: ["Patient record", "Across the whole portal"],
  },
  {
    id: "patient-record-treatments",
    persona: "owner",
    path: "/patients",
    settle: "h1",
    open: async (page) => {
      await openOlivia(page);
      await page.getByRole("tab", { name: "Treatments" }).click();
      await wait(page, 600);
    },
    sections: ["Patient record"],
  },
  {
    id: "retention",
    persona: "owner",
    path: "/retention",
    settle: '[data-qc="metric:retention.oneVisitOnly"]',
    sections: ["Before 2 October", "Retention"],
  },
  {
    id: "insights-marketing",
    persona: "owner",
    path: "/insights",
    settle: ".page-title",
    sections: ["Insights"],
  },
  {
    id: "insights-book",
    persona: "owner",
    path: "/insights?tab=book",
    settle: '[data-qc="metric:insights.composition.once"]',
    sections: ["Insights"],
  },
  {
    id: "performance",
    persona: "owner",
    path: "/performance",
    settle: '[data-qc="metric:performance.earned"]',
    sections: ["Before 2 October", "Performance"],
  },
  {
    id: "earnings",
    persona: "practitioner",
    path: "/earnings",
    settle: '[data-qc="metric:earnings.share"]',
    sections: ["My earnings and My profile"],
  },
  {
    id: "profile",
    persona: "practitioner",
    path: "/profile",
    settle: '[data-qc="profile-tab-profile"]',
    sections: ["My earnings and My profile"],
  },
  {
    id: "offers",
    persona: "owner",
    path: "/offers",
    settle: '[data-qc="offer-stage-count"]',
    sections: ["Offers"],
  },
  {
    id: "offers-automation",
    persona: "owner",
    path: "/offers",
    settle: '[data-qc="offer-stage-count"]',
    open: async (page) => {
      await page
        .locator('[data-qc="offer-stage-single_treatment"] [data-qc="offer-automation-switch"]')
        .click();
      await page.locator('[data-qc="offer-preview-count"]').waitFor({ state: "visible" });
      await expect(page.locator('[data-qc="offer-preview-count"]')).not.toContainText(
        "Working out",
      );
    },
    sections: ["Offers"],
  },
  {
    id: "team",
    persona: "owner",
    path: "/team",
    settle: '[data-qc="member-compliance"]',
    sections: ["Team and access", "Roles and security, for the engineer"],
  },
  {
    id: "settings",
    persona: "owner",
    path: "/settings",
    settle: ".page-title",
    sections: ["Settings"],
  },
  {
    id: "portal-home",
    persona: "patient",
    path: "/my-record",
    settle: '[data-qc="portal-home"]',
    sections: ["Patient record"],
  },
];

const SCENES_BY_SECTION = new Map<string, string[]>();
for (const scene of SCENES) {
  for (const section of scene.sections) {
    SCENES_BY_SECTION.set(section, [...(SCENES_BY_SECTION.get(section) ?? []), scene.id]);
  }
}

const DEVICES = ["chromium-1440", "ipad-mini", "iphone-15"] as const;

test.beforeAll(() => {
  mkdirSync(CAPTURES_DIR, { recursive: true });
});

for (const scene of SCENES) {
  test(`capture ${scene.id}`, async ({ page, context }, testInfo) => {
    await context.addCookies([
      { name: "demo_role", value: scene.persona, url: "http://localhost:8092" },
    ]);
    // The demo persona switcher (bottom-left) and the staff floating dock sit
    // over the content; keep them out of the frame so the page itself shows.
    await page.addInitScript(() => {
      const hide = () => {
        const style = document.createElement("style");
        style.textContent =
          '[data-qc="demo-role-switcher"], [data-qc="floating-dock"] { display: none !important; }';
        document.head.appendChild(style);
      };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hide);
      else hide();
    });
    await page.goto(scene.path);
    await page.locator(scene.settle).first().waitFor({ state: "visible", timeout: 20_000 });
    if (scene.open) await scene.open(page);
    await page.waitForLoadState("networkidle");
    await wait(page, 500);
    await page.screenshot({
      path: `${CAPTURES_DIR}/${scene.id}--${testInfo.project.name}.jpg`,
      type: "jpeg",
      quality: 60,
      fullPage: true,
    });
  });
}

/**
 * REVIEW.md: every bullet of the document with its status (from the README
 * index) and the captures for its section. Written once, by the last project.
 */
test("write REVIEW.md", async ({ page: _page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-1440", "one writer");
  const lines = readFileSync(README, "utf8").split("\n");
  const rows = lines
    .map((line) => line.split("|").map((c) => c.trim()))
    .filter((cells) => cells.length > 8 && /^\d{3}$/.test(cells[1] ?? ""))
    .map((cells) => ({
      id: cells[1]!,
      section: cells[2]!,
      group: cells[3]!,
      item: cells[4]!,
      phase: cells[5]!,
      status: cells[7]!,
      note: cells[8]!,
    }));
  const captureLinks = (section: string) =>
    (SCENES_BY_SECTION.get(section) ?? [])
      .flatMap((id) => DEVICES.map((d) => `[${id} · ${d}](captures/${id}--${d}.jpg)`))
      .join(" · ");
  const tally = rows.reduce<Record<string, number>>((acc, r) => {
    const key = r.status.replace(/ \(.*$/, "");
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const out: string[] = [
    "# Clinic portal feedback: review pack",
    "",
    `Generated by \`e2e/review/feedback-captures.spec.ts\` on ${new Date().toISOString().slice(0, 10)} from the demo fixture. Every bullet of \`Claude outputs/Aetheria clinic portal owner view to-do.md\` with its status from [README.md](README.md) and the captures that show it (Chromium 1440, iPad Mini, iPhone 15).`,
    "",
    `Status tally: ${Object.entries(tally)
      .sort()
      .map(([k, v]) => `${k} ${v}`)
      .join(" · ")}.`,
    "",
    "## Scenes",
    "",
    "| Scene | Persona | Page | Sections |",
    "| ----- | ------- | ---- | -------- |",
    ...SCENES.map(
      (s) =>
        `| ${DEVICES.map((d) => `[${d}](captures/${s.id}--${d}.jpg)`).join(" · ")} (\`${s.id}\`) | ${s.persona} | \`${s.path}\` | ${s.sections.join(", ")} |`,
    ),
    "",
    "## Bullets",
    "",
    "| # | Section | Item | Phase | Status | Note | Captures |",
    "| - | ------- | ---- | ----- | ------ | ---- | -------- |",
    ...rows.map(
      (r) =>
        `| ${r.id} | ${r.section} | ${r.item} | ${r.phase} | ${r.status} | ${r.note} | ${captureLinks(r.section)} |`,
    ),
    "",
  ];
  writeFileSync(REVIEW, out.join("\n"));
  expect(rows.length).toBe(145);
});
