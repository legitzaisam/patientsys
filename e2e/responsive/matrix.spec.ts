import { createHmac } from "node:crypto";
import type { Page } from "@playwright/test";
import {
  BASE,
  become,
  deviceClassFor,
  expandShell,
  settle,
  shotPath,
  test,
  watchRuntime,
  writeJson,
  type DemoRole,
  type RuntimeErrors,
} from "./fixtures";
import { PAGES, type PageCtx, type PageEntry, type PageState } from "./pages";
import { runProbes, type Finding, type ProbeResult } from "./probes";

/**
 * Device × role × page × state. Every capture writes a findings JSON and a
 * viewport screenshot; the base state of each page also gets a full-page
 * screenshot. scripts/responsive-report.mjs turns the JSON into REPORT.md.
 *
 * The spec is read-only: dialogs are opened and closed, nothing is saved.
 */

type Capture = {
  project: string;
  device: string;
  role: DemoRole;
  page: string;
  path: string;
  state: string;
  opened: boolean;
  probe: ProbeResult | null;
  runtime: RuntimeErrors;
  shots: { viewport: string | null; full: string | null };
  error?: string;
};

const DEMO_UNSUB_SECRET = "demo-unsubscribe-secret";
function unsubscribeToken(patientId: string) {
  const mac = createHmac("sha256", DEMO_UNSUB_SECRET).update(patientId).digest("hex").slice(0, 32);
  return `${patientId}.${mac}`;
}

const ctxByProject = new Map<string, PageCtx>();

/** Resolve the ids the inventory needs, once per project. */
async function resolveCtx(page: Page, project: string): Promise<PageCtx> {
  const cached = ctxByProject.get(project);
  if (cached) return cached;
  const testViewport = page.viewportSize();
  const ctx: PageCtx = { oliviaId: null, teamMemberId: null, treatPath: null };
  try {
    await become(page, "owner");
    await page.goto("/patients");
    const href = await page
      .getByRole("link", { name: /Bennett, .*Olivia/ })
      .first()
      .getAttribute("href", { timeout: 20_000 });
    ctx.oliviaId = href?.split("/").pop() ?? null;
  } catch {
    /* recorded as skipped pages */
  }
  try {
    await page.goto("/team");
    const href = await page
      .locator('a[href^="/team/"]')
      .first()
      .getAttribute("href", { timeout: 15_000 });
    ctx.teamMemberId = href?.split("/").pop() ?? null;
  } catch {
    /* ignore */
  }
  try {
    // Nadia Petrova is already Waiting in the fixtures; her record's
    // "Today's visit" card carries the Start treatment button that opens the
    // form. The state opener visits the record and presses it.
    await become(page, "owner");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/patients?view=all&q=Petrova");
    const href = await page
      .getByRole("link", { name: /Petrova, .*Nadia/ })
      .first()
      .getAttribute("href", { timeout: 15_000 });
    if (href) ctx.treatPath = href;
  } catch (error) {
    console.log(
      `[responsive] treatment form path not resolved for ${project}: ${(error as Error).message.split("\n")[0]}`,
    );
  } finally {
    const vp = testViewport;
    if (vp) await page.setViewportSize(vp);
  }
  ctxByProject.set(project, ctx);
  return ctx;
}

async function closeState(page: Page, state: PageState) {
  if (state.close) {
    await state.close(page);
    return;
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
}

function slugOf(role: DemoRole, pageId: string, stateId: string) {
  return `${role}--${pageId}--${stateId}`;
}

async function capture(
  page: Page,
  project: string,
  role: DemoRole,
  entry: PageEntry,
  path: string,
  stateId: string,
  opened: boolean,
  runtime: RuntimeErrors,
  touch: boolean,
  webkit: boolean,
  full: boolean,
): Promise<Capture> {
  const device = deviceClassFor(project);
  const slug = slugOf(role, entry.id, stateId);
  const result: Capture = {
    project,
    device,
    role,
    page: entry.id,
    path,
    state: stateId,
    opened,
    probe: null,
    runtime: {
      console: [...runtime.console],
      page: [...runtime.page],
      requests: [...runtime.requests],
    },
    shots: { viewport: null, full: null },
  };
  if (!opened) return result;
  // The staff dock peeks its alert cards for 8s whenever the alert count
  // rises during a session (the two count hooks resolve at different times,
  // so even a seeded "seen" count cannot stop it). That is a transient nudge;
  // probe with it collapsed unless this state opened the cards on purpose.
  if (stateId !== "dock-alerts") {
    const peeking = page.locator('[data-qc="alert-bubble"][aria-expanded="true"]');
    // Clicking the pill would also dismiss an open menu or popover, so leave
    // those states alone.
    const popoverOpen = await page
      .locator(
        '[role="menu"], [role="dialog"][data-state="open"], [data-radix-popper-content-wrapper]',
      )
      .count();
    if (popoverOpen === 0 && (await peeking.isVisible().catch(() => false))) {
      await peeking.click({ timeout: 2_000 }).catch(() => {});
      await page.waitForTimeout(250);
    }
  }
  try {
    result.probe = await page.evaluate(runProbes, { touch, phone: device === "phone", webkit });
  } catch (error) {
    result.error = `probe failed: ${(error as Error).message}`;
  }
  try {
    const vp = shotPath(project, slug);
    await page.screenshot({ path: vp, fullPage: false, animations: "disabled", caret: "hide" });
    result.shots.viewport = vp;
  } catch (error) {
    result.error = `${result.error ?? ""} screenshot failed: ${(error as Error).message}`.trim();
  }
  if (full) {
    try {
      await expandShell(page);
      const fp = shotPath(project, `${slug}--full`);
      await page.screenshot({ path: fp, fullPage: true, animations: "disabled", caret: "hide" });
      result.shots.full = fp;
    } catch (error) {
      result.error =
        `${result.error ?? ""} full screenshot failed: ${(error as Error).message}`.trim();
    }
  }
  return result;
}

for (const entry of PAGES) {
  for (const role of entry.roles) {
    test(`${role} · ${entry.id}`, async ({ page }, testInfo) => {
      const project = testInfo.project.name;
      const touch = Boolean(testInfo.project.use.hasTouch);
      const webkit = testInfo.project.use.defaultBrowserType === "webkit";
      const device = deviceClassFor(project);
      const captures: Capture[] = [];
      const runtime = watchRuntime(page);

      const ctx = await resolveCtx(page, project);
      let path = typeof entry.path === "function" ? entry.path(ctx) : entry.path;
      if (path && path.includes("__UNSUB_TOKEN__")) {
        path = ctx.oliviaId
          ? path.replace("__UNSUB_TOKEN__", unsubscribeToken(ctx.oliviaId))
          : null;
      }
      if (!path) {
        writeJson(`findings/${project}/${slugOf(role, entry.id, "base")}.json`, {
          project,
          device,
          role,
          page: entry.id,
          path: "",
          state: "base",
          opened: false,
          probe: null,
          runtime,
          shots: { viewport: null, full: null },
          error: "page skipped: a required fixture id could not be resolved",
        } satisfies Capture);
        return;
      }

      await become(page, role);
      runtime.console.length = 0;
      runtime.page.length = 0;
      runtime.requests.length = 0;
      await page.goto(path);
      try {
        await settle(page, entry.settle);
      } catch {
        /* capture whatever is on screen */
      }

      // Redirected away (a role that cannot see the page): record and stop.
      const landed = new URL(page.url()).pathname;
      const wanted = new URL(path, BASE).pathname;
      if (
        landed !== wanted &&
        !(wanted.startsWith("/my-record") && landed.startsWith("/my-record"))
      ) {
        const redirected = await capture(
          page,
          project,
          role,
          entry,
          path,
          "redirected",
          true,
          runtime,
          touch,
          webkit,
          false,
        );
        redirected.error = `redirected to ${landed}`;
        writeJson(`findings/${project}/${slugOf(role, entry.id, "redirected")}.json`, redirected);
        return;
      }

      const states = entry.states ?? [];
      if (entry.enterState) {
        const enter = states.find((s) => s.id === entry.enterState);
        if (enter) await enter.open(page, ctx);
      }

      captures.push(
        await capture(page, project, role, entry, path, "base", true, runtime, touch, webkit, true),
      );
      // expandShell changed the layout: reload so the states see the real shell.
      await page.goto(path);
      await settle(page, entry.settle).catch(() => {});
      if (entry.enterState) {
        const enter = states.find((s) => s.id === entry.enterState);
        if (enter) await enter.open(page, ctx);
      }

      const wantedStates = states.filter((s) => {
        if (s.id === entry.enterState) return false;
        if (s.devices && !s.devices.includes(device)) return false;
        if (role !== "owner" && role !== "patient" && role !== "public") {
          return (entry.coreStates ?? []).includes(s.id);
        }
        return true;
      });

      for (const state of wantedStates) {
        let opened = false;
        let error: string | undefined;
        try {
          opened = await state.open(page, ctx);
        } catch (err) {
          error = `open failed: ${(err as Error).message.split("\n")[0]}`;
        }
        const cap = await capture(
          page,
          project,
          role,
          entry,
          path,
          state.id,
          opened,
          runtime,
          touch,
          webkit,
          false,
        );
        if (error) cap.error = error;
        captures.push(cap);
        try {
          await closeState(page, state);
        } catch {
          /* fall through to a reload */
        }
        // Tabs and navigations change the page: make sure the next state starts clean.
        if (
          state.id === "treatment-form" ||
          state.id.startsWith("tab-") ||
          state.id.startsWith("view-")
        ) {
          await page.goto(path);
          await settle(page, entry.settle).catch(() => {});
          if (entry.enterState) {
            const enter = states.find((s) => s.id === entry.enterState);
            if (enter) await enter.open(page, ctx);
          }
        } else {
          const stillOpen = await page.locator('[role="dialog"][data-state="open"]').count();
          if (stillOpen > 0) {
            await page.goto(path);
            await settle(page, entry.settle).catch(() => {});
          }
        }
      }

      for (const cap of captures) {
        writeJson(`findings/${project}/${slugOf(role, entry.id, cap.state)}.json`, cap);
      }

      // By default findings only feed the report; a broken harness (nothing
      // captured) is the only failure. RESPONSIVE_GATE=blocker|major|minor
      // turns findings at that severity or worse into test failures, which is
      // how the matrix becomes a regression gate once a tier is clean.
      const anyProbe = captures.some((c) => c.probe);
      if (!anyProbe) throw new Error(`No probe ran for ${role} ${entry.id} at ${path}`);
      const gate = process.env["RESPONSIVE_GATE"];
      if (gate === "blocker" || gate === "major" || gate === "minor") {
        const rank = { blocker: 0, major: 1, minor: 2, info: 3 } as const;
        const failing = captures.flatMap((c) =>
          (c.probe?.findings ?? [])
            .filter((f) => rank[f.severity] <= rank[gate])
            .map(
              (f) =>
                `${c.state}: ${f.probe} — ${f.message}${f.samples?.[0] ? ` (e.g. ${f.samples[0]})` : ""}`,
            ),
        );
        if (failing.length > 0) {
          throw new Error(
            `${failing.length} ${gate}+ finding${failing.length === 1 ? "" : "s"} for ${role} ${entry.id} on ${project}:\n  ${failing.join("\n  ")}`,
          );
        }
      }
    });
  }
}

export type { Capture, Finding };
