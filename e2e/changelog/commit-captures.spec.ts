import { mkdirSync, writeFileSync } from "node:fs";
import { test, type Locator, type Page } from "@playwright/test";

/**
 * Scene catalogue for the per-commit changelog. Each scene is one page, or one
 * opened state on a page, captured per device into
 * `${CHANGELOG_OUT}/<scene>--<device>.jpg`, plus a small JSON record of what
 * could and could not be opened at that commit.
 *
 * The same scene runs against the commit before and the commit after, so the
 * open steps are tolerant: a control that does not exist yet is recorded as
 * missing and the page is captured as it is, instead of failing the run.
 *
 * CHANGELOG_SCENES=a,b,c limits a run to those scenes (the walker sets it).
 */

const OUT = process.env["CHANGELOG_OUT"] ?? "test-results/changelog-states/adhoc";
const ONLY = (process.env["CHANGELOG_SCENES"] ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

type Persona = "owner" | "practitioner" | "front_desk" | "patient";

type Ctx = {
  page: Page;
  /** Record a control that was not on the page at this commit. */
  missing: (what: string) => void;
  /** Click when visible; false (and recorded) when not. */
  click: (locator: Locator, what: string, opts?: { timeout?: number }) => Promise<boolean>;
  waitFor: (locator: Locator, what: string, timeout?: number) => Promise<boolean>;
  wait: (ms: number) => Promise<void>;
};

export type Scene = {
  id: string;
  persona: Persona;
  path: string;
  /** Any of these becoming visible means the page has loaded. */
  settle: string;
  /** Optional state to open before the capture. */
  open?: (c: Ctx) => Promise<void>;
  /** Keep the floating dock and persona switcher visible (dock scenes). */
  keepDock?: boolean;
  /** Capture the viewport instead of the full page (fixed panels, dialogs). */
  viewport?: boolean;
  /** One line for the documentation. */
  what: string;
};

async function openOlivia(c: Ctx) {
  await c.page.getByLabel("Search by name or reference").fill("Bennett");
  const link = c.page.getByRole("link", { name: /Bennett, .*Olivia/ }).first();
  if (await c.click(link, "Olivia Bennett in the patients list")) {
    await c.waitFor(c.page.getByRole("heading", { level: 1, name: /Olivia Bennett/ }), "patient record heading");
    await c.wait(600);
  }
}

async function openChat(c: Ctx) {
  if (await c.click(c.page.locator('[data-qc="chat-bubble"]').first(), "chat bubble")) {
    await c.waitFor(c.page.locator('[data-qc="chat-window"]'), "chat window");
    await c.wait(500);
  }
}

async function openTeamTab(c: Ctx) {
  const tab = c.page.locator('[data-qc="chat-window"] [role="tab"]', { hasText: /^Team/ }).first();
  if (await c.click(tab, "Team tab in the chat window")) {
    await c.waitFor(c.page.locator('[data-qc="team-inbox"]'), "team inbox");
    await c.wait(400);
  }
}

export const SCENES: Scene[] = [
  // Dashboards
  { id: "dashboard-owner", persona: "owner", path: "/dashboard", settle: '[data-qc="kpi-total-clients"], h1', what: "Owner dashboard" },
  { id: "dashboard-practitioner", persona: "practitioner", path: "/dashboard", settle: '[data-qc="kpi-your-clients"], h1', what: "Practitioner dashboard" },
  { id: "dashboard-front-desk", persona: "front_desk", path: "/dashboard", settle: "h1", what: "Front desk dashboard" },

  // Diary
  { id: "diary-day", persona: "owner", path: "/schedule", settle: '[data-qc="needs-action"], h1', what: "Diary, day view" },
  {
    id: "quick-add",
    persona: "front_desk",
    path: "/schedule",
    settle: "h1",
    viewport: true,
    what: "New booking dialog from the diary",
    open: async (c) => {
      if (await c.click(c.page.getByRole("button", { name: /^New booking$/ }).first(), "New booking button")) {
        await c.waitFor(c.page.getByRole("dialog"), "New booking dialog");
        await c.wait(500);
      }
    },
  },

  // Patients
  { id: "patients-list", persona: "owner", path: "/patients", settle: '[data-qc="patients-filter-all"], h1', what: "Patients list" },
  { id: "journey-board", persona: "owner", path: "/patients?tab=board", settle: '[data-qc="board-book"], .page-title, h1', what: "Journey board" },
  { id: "patient-record", persona: "owner", path: "/patients", settle: "h1", open: openOlivia, what: "Patient record (Olivia Bennett), overview" },
  {
    id: "patient-record-treatments",
    persona: "owner",
    path: "/patients",
    settle: "h1",
    what: "Patient record, Treatments tab",
    open: async (c) => {
      await openOlivia(c);
      if (await c.click(c.page.getByRole("tab", { name: "Treatments" }), "Treatments tab")) await c.wait(600);
    },
  },

  // Patient portal
  { id: "portal-home", persona: "patient", path: "/my-record", settle: '[data-qc="portal-home"], h1', what: "Patient portal home" },
  { id: "portal-records", persona: "patient", path: "/my-record/records", settle: "h1, h2", what: "Patient portal, Records" },

  // Team and access
  { id: "team", persona: "owner", path: "/team", settle: '[data-qc="team-member"], h1', what: "Team page (owner)" },
  {
    id: "team-access",
    persona: "owner",
    path: "/team",
    settle: '[data-qc="team-member"], h1',
    what: "Team page with every access panel expanded",
    open: async (c) => {
      // Expand every collapsed panel below the first heading that mentions access.
      const opened = await c.page.evaluate(() => {
        const headings = [...document.querySelectorAll("main h2, main h3")];
        const anchor = headings.find((h) => /access/i.test(h.textContent ?? ""));
        if (!anchor) return -1;
        const top = anchor.getBoundingClientRect().top + window.scrollY;
        let n = 0;
        document.querySelectorAll<HTMLButtonElement>('main button[aria-expanded="false"]').forEach((b) => {
          if (b.getBoundingClientRect().top + window.scrollY > top) {
            b.click();
            n++;
          }
        });
        // The page scrolls inside <main>, so bring the panel to the top of the frame.
        anchor.scrollIntoView({ block: "start" });
        return n;
      });
      if (opened < 0) c.missing("an Access heading on the team page");
      await c.wait(700);
    },
  },
  {
    id: "team-member",
    persona: "owner",
    path: "/team",
    settle: '[data-qc="team-member"], h1',
    what: "A team member's page",
    open: async (c) => {
      const link = c.page.locator('[data-qc="team-member"] a[href^="/team/"]').first();
      if (await c.click(link, "first team member link")) {
        await c.waitFor(c.page.locator("h1"), "team member heading");
        await c.page.waitForLoadState("networkidle").catch(() => {});
        await c.wait(600);
      }
    },
  },
  {
    id: "invite-staff",
    persona: "owner",
    path: "/team",
    settle: '[data-qc="team-member"], h1',
    viewport: true,
    what: "Invite staff dialog",
    open: async (c) => {
      if (await c.click(c.page.getByRole("button", { name: /Invite staff/ }).first(), "Invite staff button")) {
        await c.waitFor(c.page.getByRole("dialog"), "Invite staff dialog");
        await c.wait(500);
      }
    },
  },

  // Profile, earnings, performance
  {
    id: "profile",
    persona: "practitioner",
    path: "/profile",
    settle: '[data-qc="profile-tab-overview"], h1',
    what: "My profile (practitioner)",
  },
  {
    id: "profile-performance",
    persona: "practitioner",
    path: "/profile",
    settle: '[data-qc="profile-tab-overview"], h1',
    what: "My profile, Performance & earnings tab",
    open: async (c) => {
      if (
        await c.click(
          c.page.locator('[data-qc="profile-tab-earnings"]'),
          "Performance & earnings tab on My profile",
        )
      )
        await c.wait(800);
    },
  },
  {
    id: "profile-schedule",
    persona: "practitioner",
    path: "/profile",
    settle: '[data-qc="profile-tab-overview"], h1',
    what: "My profile, Schedule & time off tab",
    open: async (c) => {
      if (
        await c.click(
          c.page.locator('[data-qc="profile-tab-schedule"]'),
          "Schedule tab on My profile",
        )
      )
        await c.wait(800);
    },
  },
  {
    id: "profile-pattern-request",
    persona: "practitioner",
    path: "/profile?tab=schedule",
    settle: '[data-qc="working-pattern"], h1',
    what: "My profile, proposing new hours (round 2)",
    open: async (c) => {
      if (
        await c.click(
          c.page.locator('[data-qc="pattern-request-change"]'),
          "Request a change on the Working pattern card",
        )
      )
        await c.wait(600);
    },
  },
  {
    id: "profile-security",
    persona: "practitioner",
    path: "/profile",
    settle: '[data-qc="profile-tab-overview"], h1',
    what: "My profile, Security tab",
    open: async (c) => {
      if (await c.click(c.page.locator('[data-qc="profile-tab-security"]'), "Security tab on My profile")) await c.wait(600);
    },
  },
  {
    id: "earnings",
    persona: "practitioner",
    path: "/earnings",
    settle: '[data-qc="profile-tab-overview"], h1',
    what: "/earnings redirects to My profile",
  },
  { id: "performance", persona: "owner", path: "/performance", settle: '[data-qc="metric:performance.earned"], h1', what: "Performance (owner)" },
  { id: "performance-practitioner", persona: "practitioner", path: "/performance", settle: "h1", what: "Performance as a practitioner" },

  // Insights, retention, offers, settings
  { id: "insights-marketing", persona: "owner", path: "/insights", settle: ".page-title, h1", what: "Insights, Marketing" },
  { id: "insights-book", persona: "owner", path: "/insights?tab=book", settle: '[data-qc="metric:insights.composition.once"], h1', what: "Insights, Patient base" },
  { id: "retention", persona: "owner", path: "/retention", settle: '[data-qc="metric:retention.oneVisitOnly"], h1', what: "Retention" },
  { id: "offers", persona: "owner", path: "/offers", settle: '[data-qc="offer-stage-count"], h1', what: "Offers" },
  { id: "settings", persona: "owner", path: "/settings", settle: '[data-qc="settings-tabs"], h1', what: "Settings, Clinic" },
  { id: "settings-payments", persona: "owner", path: "/settings?tab=payments", settle: '[data-qc="settings-tabs"], h1', what: "Settings, Payments and deposits" },

  // Floating dock, alerts, bell, sidebar
  { id: "dock-chat", persona: "owner", path: "/dashboard", settle: "h1", keepDock: true, viewport: true, what: "Floating dock, chat window", open: openChat },
  {
    id: "dock-chat-team",
    persona: "owner",
    path: "/dashboard",
    settle: "h1",
    keepDock: true,
    viewport: true,
    what: "Chat window, Team tab",
    open: async (c) => {
      await openChat(c);
      await openTeamTab(c);
    },
  },
  {
    id: "dock-chat-thread",
    persona: "owner",
    path: "/dashboard",
    settle: "h1",
    keepDock: true,
    viewport: true,
    what: "Chat window, a team conversation open",
    open: async (c) => {
      await openChat(c);
      await openTeamTab(c);
      const first = c.page.locator('[data-qc="team-inbox"] button, [data-qc="team-inbox"] [role="button"], [data-qc="team-inbox"] a').first();
      if (await c.click(first, "first team conversation")) await c.wait(700);
    },
  },
  {
    id: "alerts",
    persona: "owner",
    path: "/dashboard",
    settle: "h1",
    keepDock: true,
    viewport: true,
    what: "Clinic alerts panel",
    open: async (c) => {
      // On wide screens the panel peeks open by itself for a moment, and the
      // pill click toggles it; if the first click closed the peek, click again.
      const bubble = c.page.locator('[data-qc="alert-bubble"]').first();
      const panel = c.page.locator('[data-qc="alert-panel"]');
      if (await c.click(bubble, "alert bubble")) {
        await c.wait(400);
        if (!(await panel.isVisible().catch(() => false))) await bubble.click().catch(() => {});
        await c.waitFor(panel, "alert panel");
        await c.wait(500);
      }
    },
  },
  {
    id: "bell",
    persona: "owner",
    path: "/dashboard",
    settle: "h1",
    viewport: true,
    what: "Notification bell open",
    open: async (c) => {
      if (await c.click(c.page.locator('button[aria-label^="Notifications"]').first(), "notification bell")) {
        await c.waitFor(c.page.locator('[data-radix-popper-content-wrapper], [role="dialog"]').first(), "notifications popover");
        await c.wait(500);
      }
    },
  },
  {
    id: "sidebar-hovercard",
    persona: "owner",
    path: "/dashboard",
    settle: "h1",
    viewport: true,
    what: "Practitioner card from the sidebar avatar",
    open: async (c) => {
      const avatar = c.page.locator('[data-qc="team-member-avatar"]').first();
      if (!(await avatar.isVisible().catch(() => false))) {
        // Tablet: the sidebar lives in a drawer.
        const menu = c.page.getByRole("button", { name: /menu|navigation|sidebar/i }).first();
        if (await menu.isVisible().catch(() => false)) {
          await menu.click();
          await c.wait(500);
        }
      }
      if (await c.click(avatar, "sidebar practitioner avatar")) {
        await c.waitFor(c.page.locator('[data-qc="team-member-card"]'), "practitioner card");
        await c.wait(500);
      }
    },
  },
];

const selected = ONLY.length ? SCENES.filter((s) => ONLY.includes(s.id)) : SCENES;
const unknown = ONLY.filter((id) => !SCENES.some((s) => s.id === id));
if (unknown.length) throw new Error(`Unknown CHANGELOG_SCENES: ${unknown.join(", ")}`);

test.beforeAll(() => {
  mkdirSync(`${OUT}/manifest`, { recursive: true });
});

for (const scene of selected) {
  test(`capture ${scene.id}`, async ({ page, context, baseURL }, testInfo) => {
    const missing: string[] = [];
    const ctx: Ctx = {
      page,
      missing: (what) => missing.push(what),
      wait: (ms) => page.waitForTimeout(ms),
      waitFor: async (locator, what, timeout = 6_000) => {
        try {
          await locator.first().waitFor({ state: "visible", timeout });
          return true;
        } catch {
          missing.push(what);
          return false;
        }
      },
      click: async (locator, what, opts) => {
        try {
          await locator.waitFor({ state: "visible", timeout: opts?.timeout ?? 4_000 });
          await locator.click();
          return true;
        } catch {
          missing.push(what);
          return false;
        }
      },
    };

    await context.addCookies([{ name: "demo_role", value: scene.persona, url: baseURL! }]);
    if (!scene.keepDock) {
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
    } else {
      await page.addInitScript(() => {
        const hide = () => {
          const style = document.createElement("style");
          style.textContent = '[data-qc="demo-role-switcher"] { display: none !important; }';
          document.head.appendChild(style);
        };
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", hide);
        else hide();
      });
    }

    let error: string | undefined;
    try {
      await page.goto(scene.path);
      await page.locator(scene.settle).first().waitFor({ state: "visible", timeout: 30_000 });
      await page.waitForLoadState("networkidle").catch(() => {});
      if (scene.open) await scene.open(ctx);
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(600);
    } catch (e) {
      error = e instanceof Error ? e.message.split("\n")[0] : String(e);
    }

    const file = `${OUT}/${scene.id}--${testInfo.project.name}.jpg`;
    await page.screenshot({ path: file, type: "jpeg", quality: 60, fullPage: !scene.viewport });
    writeFileSync(
      `${OUT}/manifest/${scene.id}--${testInfo.project.name}.json`,
      JSON.stringify(
        {
          scene: scene.id,
          device: testInfo.project.name,
          persona: scene.persona,
          path: scene.path,
          what: scene.what,
          url: page.url(),
          missing,
          error: error ?? null,
          capturedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    if (error) throw new Error(error);
  });
}
