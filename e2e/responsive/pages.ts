import type { Page } from "@playwright/test";
import type { DemoRole } from "./fixtures";

/**
 * Every screen the matrix visits, per role, with the overlay states each one
 * can open. `open` returns false when the trigger is not on screen for that
 * role or device, and the state is recorded as skipped rather than failed.
 */

export type PageCtx = {
  /** Olivia Bennett, the portal patient, as seen from the staff side. */
  oliviaId: string | null;
  /** Any current team member, for /team/$id. */
  teamMemberId: string | null;
  /** Record path of a patient whose booking is already Waiting; its Today's visit card opens the treatment form. */
  treatPath: string | null;
};

export type StateOpener = (page: Page, ctx: PageCtx) => Promise<boolean>;

export type PageState = {
  id: string;
  open: StateOpener;
  /** Defaults to pressing Escape twice. */
  close?: (page: Page) => Promise<void>;
  /** Only capture on these device classes (default: all). */
  devices?: ("phone" | "tablet" | "laptop" | "desktop")[];
};

export type PageEntry = {
  id: string;
  path: string | ((ctx: PageCtx) => string | null);
  /** Roles that visit this page. Owner gets every state; other roles get the base capture plus `coreStates`. */
  roles: DemoRole[];
  settle: string;
  states?: PageState[];
  /** States that also run for non-owner roles. */
  coreStates?: string[];
  /** A state to enter before the base capture (the page's "base" is that state). */
  enterState?: string;
};

const wait = (page: Page, ms: number) => page.waitForTimeout(ms);

async function clickIfVisible(page: Page, selector: string, timeout = 3_000) {
  const el = page.locator(selector).first();
  try {
    await el.waitFor({ state: "visible", timeout });
  } catch {
    return false;
  }
  await el.click({ timeout: 5_000 });
  return true;
}

async function clickRoleIfVisible(
  page: Page,
  role: Parameters<Page["getByRole"]>[0],
  name: string | RegExp,
  timeout = 3_000,
) {
  const el = page.getByRole(role, { name }).first();
  try {
    await el.waitFor({ state: "visible", timeout });
  } catch {
    return false;
  }
  await el.click({ timeout: 5_000 });
  return true;
}

async function waitDialog(page: Page, selector = '[role="dialog"]') {
  try {
    await page.locator(selector).first().waitFor({ state: "visible", timeout: 6_000 });
    await wait(page, 500);
    return true;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------- */
/* shared states                                                     */
/* ---------------------------------------------------------------- */

const sidebarClosed: PageState = {
  id: "sidebar-closed",
  open: async (page) => {
    if (!(await clickIfVisible(page, 'button[aria-label="Close sidebar"]', 2_000))) return false;
    await wait(page, 400);
    return true;
  },
  close: async (page) => {
    await clickIfVisible(page, 'button[aria-label="Open sidebar"]', 2_000);
    await wait(page, 300);
  },
};

const accountMenu: PageState = {
  id: "account-menu",
  open: async (page) => {
    if (!(await clickIfVisible(page, 'button[aria-label="Account menu"]'))) return false;
    await wait(page, 400);
    return true;
  },
};

const bell: PageState = {
  id: "bell",
  open: async (page) => {
    if (!(await clickRoleIfVisible(page, "button", /^Notifications/))) return false;
    await wait(page, 600);
    return true;
  },
};

const alertTeam: PageState = {
  id: "alert-team",
  open: async (page) => {
    if (!(await clickIfVisible(page, 'button[aria-label="Alert team"]'))) return false;
    return waitDialog(page);
  },
};

const notes: PageState = {
  id: "notes",
  open: async (page) => {
    if (!(await clickIfVisible(page, 'button[aria-label="My notes"]'))) return false;
    await wait(page, 500);
    return true;
  },
  close: async (page) => {
    await clickIfVisible(page, 'button[aria-label="Close notes"]', 2_000);
    await wait(page, 300);
  },
};

const dockAlerts: PageState = {
  id: "dock-alerts",
  open: async (page) => {
    // The alert bubble shows a card; the panel lists them all.
    const toggle = page.locator('[data-qc="floating-dock"] button[aria-label^="Show"]').first();
    try {
      await toggle.waitFor({ state: "visible", timeout: 3_000 });
    } catch {
      return page.locator('[data-qc="alert-bubble"]').first().isVisible();
    }
    await toggle.click();
    await wait(page, 500);
    return true;
  },
  close: async (page) => {
    await clickIfVisible(page, '[data-qc="floating-dock"] button[aria-label^="Hide"]', 1_500);
    await wait(page, 200);
  },
};

const dockChat: PageState = {
  id: "dock-chat",
  open: async (page) => {
    if (!(await clickIfVisible(page, '[data-qc="chat-bubble"]'))) return false;
    await wait(page, 700);
    return true;
  },
  close: async (page) => {
    if (!(await clickIfVisible(page, 'button[aria-label="Close chat window"]', 1_500))) {
      await clickIfVisible(page, '[data-qc="chat-bubble"]', 1_500);
    }
    await wait(page, 300);
  },
};

const staffShellStates: PageState[] = [
  sidebarClosed,
  accountMenu,
  bell,
  alertTeam,
  notes,
  dockAlerts,
  dockChat,
];

/* ---------------------------------------------------------------- */
/* portal states                                                     */
/* ---------------------------------------------------------------- */

const portalChat: PageState = {
  id: "portal-chat",
  open: async (page) => {
    if (
      !(await clickIfVisible(
        page,
        '[data-qc="portal-dock"] button[aria-label^="Message your clinic"]',
      ))
    )
      return false;
    await wait(page, 700);
    return true;
  },
  close: async (page) => {
    await clickIfVisible(
      page,
      '[data-qc="portal-dock"] button[aria-label^="Message your clinic"]',
      1_500,
    );
    await wait(page, 300);
  },
};

const portalAi: PageState = {
  id: "portal-ai",
  open: async (page) => {
    if (!(await clickIfVisible(page, '[data-qc="ai-bubble"]'))) return false;
    await wait(page, 700);
    return true;
  },
  close: async (page) => {
    await clickIfVisible(page, '[data-qc="ai-bubble"]', 1_500);
    await wait(page, 300);
  },
};

const portalStates: PageState[] = [sidebarClosed, accountMenu, bell, portalChat, portalAi];

/* ---------------------------------------------------------------- */
/* page-specific states                                              */
/* ---------------------------------------------------------------- */

const quickBook: PageState = {
  id: "quick-book",
  open: async (page) => {
    if (!(await clickRoleIfVisible(page, "button", "Quick book"))) return false;
    return waitDialog(page);
  },
};

const todayCardDetail: PageState = {
  id: "today-card-detail",
  open: async (page) => {
    const card = page.locator("[data-diary-slide]").first();
    try {
      await card.waitFor({ state: "visible", timeout: 4_000 });
    } catch {
      return false;
    }
    await card.locator('[role="button"][aria-label^="View appointment"]').first().click();
    return waitDialog(page);
  },
};

const consentInClinic: PageState = {
  id: "consent-in-clinic",
  open: async (page) => {
    const card = page.locator("[data-diary-slide]", { hasText: "Olivia Bennett" }).first();
    try {
      await card.waitFor({ state: "visible", timeout: 4_000 });
    } catch {
      return false;
    }
    await card.locator('[role="button"][aria-label^="View appointment"]').first().click();
    if (!(await waitDialog(page))) return false;
    if (!(await clickIfVisible(page, '[data-qc="complete-consent"]', 2_500))) {
      await page.keyboard.press("Escape");
      return false;
    }
    return waitDialog(page, '[data-qc="consent-in-clinic"]');
  },
};

/** The diary keeps its view in state, so week and month are reached by the pill. */
function diaryView(view: "week" | "month"): PageState {
  return {
    id: `view-${view}`,
    open: async (page) => {
      if (!(await clickRoleIfVisible(page, "button", new RegExp(`^${view}$`, "i")))) return false;
      await wait(page, 800);
      return true;
    },
    close: async () => {},
  };
}

const newBooking: PageState = {
  id: "new-booking",
  open: async (page) => {
    if (!(await clickRoleIfVisible(page, "button", "New booking"))) return false;
    return waitDialog(page);
  },
};

const treatmentForm: PageState = {
  id: "treatment-form",
  open: async (page, ctx) => {
    if (!ctx.treatPath) return false;
    await page.goto(ctx.treatPath);
    if (!(await clickIfVisible(page, '[data-qc="open-treatment-form"]', 10_000))) return false;
    return waitDialog(page, '[data-qc="treatment-form"]');
  },
};

const recordTreatment: PageState = {
  id: "record-treatment",
  open: async (page) => {
    if (!(await clickRoleIfVisible(page, "button", "Record treatment"))) return false;
    return waitDialog(page);
  },
};

const sendForm: PageState = {
  id: "send-form",
  open: async (page) => {
    if (!(await clickRoleIfVisible(page, "button", "Send form"))) return false;
    return waitDialog(page);
  },
};

const sendOffer: PageState = {
  id: "send-offer",
  open: async (page) => {
    if (!(await clickIfVisible(page, '[data-qc="send-offer-open"]'))) return false;
    return waitDialog(page, '[data-qc="send-offer"]');
  },
};

function recordTab(value: string, label: string | RegExp): PageState {
  return {
    id: `tab-${value}`,
    open: async (page) => {
      if (!(await clickRoleIfVisible(page, "tab", label))) return false;
      await wait(page, 700);
      return true;
    },
    close: async () => {},
  };
}

const offerEditor: PageState = {
  id: "offer-editor",
  open: async (page) => {
    if (
      !(await clickIfVisible(
        page,
        '[data-qc="offer-stage-pre_consultation"] [data-qc="offer-edit"]',
      ))
    )
      return false;
    return waitDialog(page, '[data-qc="offer-editor"]');
  },
};

const offerAutomation: PageState = {
  id: "offer-automation",
  open: async (page) => {
    if (
      !(await clickIfVisible(
        page,
        '[data-qc="offer-stage-single_treatment"] [data-qc="offer-automation-switch"]',
      ))
    )
      return false;
    return waitDialog(page, '[data-qc="offer-automation"]');
  },
};

const inviteStaff: PageState = {
  id: "invite-staff",
  open: async (page) => {
    if (!(await clickRoleIfVisible(page, "button", /Invite/))) return false;
    return waitDialog(page);
  },
};

const teamFormer: PageState = {
  id: "tab-former",
  open: async (page) => {
    if (!(await clickRoleIfVisible(page, "tab", /Former/))) return false;
    await wait(page, 600);
    return true;
  },
  close: async () => {},
};

const bulkSelect: PageState = {
  id: "bulk-select",
  open: async (page) => {
    const boxes = page.locator('[data-qc="select-patient"]');
    if ((await boxes.count()) < 2) return false;
    await boxes.nth(0).click();
    await boxes.nth(1).click();
    await wait(page, 300);
    return true;
  },
  close: async (page) => {
    await clickIfVisible(page, '[data-qc="select-all-patients"]', 1_000);
    await clickIfVisible(page, '[data-qc="select-all-patients"]', 1_000);
  },
};

const pauseModal: PageState = {
  id: "pause-modal",
  open: async (page) => {
    if (!(await clickIfVisible(page, '[data-qc="pause-plan"]'))) return false;
    return waitDialog(page, '[data-qc="pause-modal"]');
  },
};

const journalNew: PageState = {
  id: "journal-new",
  open: async (page) => {
    if (!(await clickIfVisible(page, '[data-qc="journal-new"]'))) return false;
    await wait(page, 600);
    return true;
  },
};

/* ---------------------------------------------------------------- */
/* inventory                                                         */
/* ---------------------------------------------------------------- */

const STAFF: DemoRole[] = ["owner", "practitioner", "front_desk", "admin"];

export const PAGES: PageEntry[] = [
  /* Public */
  { id: "landing", path: "/", roles: ["public"], settle: "main, h1" },
  { id: "auth", path: "/auth", roles: ["public"], settle: "form" },
  { id: "auth-reset", path: "/auth/reset", roles: ["public"], settle: "form, h1" },
  { id: "portal-login", path: "/portal", roles: ["public"], settle: "form" },
  {
    id: "consent-link",
    path: "/d/e2ec0deba5e00001e2ec0deba5e00001e2ec0deba5e00001",
    roles: ["public"],
    settle: "h1, main",
  },
  { id: "unsubscribe-link", path: "/u/__UNSUB_TOKEN__", roles: ["public"], settle: "h1, main" },

  /* Staff */
  {
    id: "dashboard",
    path: "/dashboard",
    roles: STAFF,
    settle: ".page-title",
    states: [...staffShellStates, quickBook, todayCardDetail, consentInClinic],
    coreStates: ["sidebar-closed", "account-menu", "bell", "today-card-detail"],
  },
  {
    id: "schedule-day",
    path: "/schedule",
    roles: STAFF,
    settle: '[data-qc="day-planner-scroll"], .page-title',
    states: [sidebarClosed, newBooking],
    coreStates: ["sidebar-closed"],
  },
  {
    id: "schedule-week",
    path: "/schedule",
    roles: ["owner"],
    settle: ".page-title",
    states: [diaryView("week"), sidebarClosed],
    enterState: "view-week",
  },
  {
    id: "schedule-month",
    path: "/schedule",
    roles: ["owner"],
    settle: ".page-title",
    states: [diaryView("month"), sidebarClosed],
    enterState: "view-month",
  },
  {
    id: "patients",
    path: "/patients",
    roles: STAFF,
    settle: "table, .page-title",
    states: [sidebarClosed, bulkSelect],
    coreStates: ["sidebar-closed"],
  },
  {
    id: "patients-board",
    path: "/patients?tab=board",
    roles: ["owner"],
    settle: ".page-title",
    states: [sidebarClosed],
  },
  {
    id: "patient-record",
    path: (ctx) => (ctx.oliviaId ? `/patients/${ctx.oliviaId}` : null),
    roles: STAFF,
    settle: "h1",
    states: [
      sidebarClosed,
      recordTab("photos", "Before and after"),
      recordTab("documents", "Documents"),
      recordTab("history", "History updates"),
      recordTab("portal", "From the patient"),
      recordTab("contact", "Contact"),
      recordTreatment,
      sendForm,
      sendOffer,
      treatmentForm,
    ],
    coreStates: ["sidebar-closed", "tab-contact", "tab-documents"],
  },
  {
    id: "insights",
    path: "/insights",
    roles: ["owner", "front_desk", "admin"],
    settle: ".page-title",
    states: [sidebarClosed],
  },
  {
    id: "insights-book",
    path: "/insights?tab=book",
    roles: ["owner"],
    settle: ".page-title",
    states: [sidebarClosed],
  },
  {
    id: "retention",
    path: "/retention",
    roles: ["owner", "practitioner", "front_desk"],
    settle: ".page-title",
    states: [sidebarClosed],
  },
  {
    id: "performance",
    path: "/performance",
    roles: ["owner", "admin"],
    settle: ".page-title",
    states: [sidebarClosed],
  },
  {
    id: "earnings",
    path: "/earnings",
    roles: ["practitioner"],
    settle: ".page-title",
    states: [sidebarClosed],
  },
  {
    id: "offers",
    path: "/offers",
    roles: ["owner", "admin"],
    settle: '[data-qc="offer-stages"]',
    states: [sidebarClosed, offerEditor, offerAutomation],
  },
  {
    id: "team",
    path: "/team",
    roles: STAFF,
    settle: ".page-title",
    states: [sidebarClosed, teamFormer, inviteStaff],
    coreStates: ["sidebar-closed"],
  },
  {
    id: "team-member",
    path: (ctx) => (ctx.teamMemberId ? `/team/${ctx.teamMemberId}` : null),
    roles: ["owner", "practitioner"],
    settle: ".page-title",
    states: [sidebarClosed],
  },
  {
    id: "settings",
    path: "/settings",
    roles: ["owner", "front_desk", "admin"],
    settle: ".page-title",
    states: [sidebarClosed],
  },
  {
    id: "profile",
    path: "/profile",
    roles: STAFF,
    settle: ".page-title",
    states: [sidebarClosed],
    coreStates: ["sidebar-closed"],
  },
  {
    id: "access",
    path: "/access",
    roles: ["admin"],
    settle: ".page-title",
    states: [sidebarClosed],
  },

  /* Patient portal */
  {
    id: "portal-home",
    path: "/my-record",
    roles: ["patient"],
    settle: '[data-qc="portal-home"]',
    states: portalStates,
  },
  {
    id: "portal-plan",
    path: "/my-record/plan",
    roles: ["patient"],
    settle: ".page-title",
    states: [sidebarClosed],
  },
  {
    id: "portal-timeline",
    path: "/my-record/plan/timeline",
    roles: ["patient"],
    settle: ".page-title",
    states: [sidebarClosed, pauseModal],
  },
  {
    id: "portal-journal",
    path: "/my-record/plan/journal",
    roles: ["patient"],
    settle: ".page-title",
    states: [sidebarClosed, journalNew],
  },
  {
    id: "portal-routine",
    path: "/my-record/plan/routine",
    roles: ["patient"],
    settle: ".page-title",
    states: [sidebarClosed],
  },
  {
    id: "portal-clinic",
    path: "/my-record/clinic",
    roles: ["patient"],
    settle: ".page-title",
    states: [sidebarClosed],
  },
  {
    id: "portal-records",
    path: "/my-record/records",
    roles: ["patient"],
    settle: ".page-title",
    states: [sidebarClosed],
  },
  {
    id: "portal-appointments",
    path: "/my-record/appointments",
    roles: ["patient"],
    settle: ".page-title",
    states: [sidebarClosed],
  },
  {
    id: "portal-billing",
    path: "/my-record/billing",
    roles: ["patient"],
    settle: ".page-title",
    states: [sidebarClosed],
  },
  {
    id: "portal-settings",
    path: "/my-record/settings",
    roles: ["patient"],
    settle: ".page-title",
    states: [sidebarClosed],
  },
  {
    id: "portal-resources",
    path: "/my-record/resources",
    roles: ["patient"],
    settle: '[data-qc="portal-resources"]',
    states: [sidebarClosed],
  },
];
