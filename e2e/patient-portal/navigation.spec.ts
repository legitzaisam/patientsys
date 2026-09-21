import { expect, test } from "../fixtures";

/**
 * Navigation and the boundary between the two portals: every nav item and tab
 * resolves with the right active state, deep links work, and neither role can
 * wander into the other's surface.
 */

const NAV = [
  { label: "Home", path: "/my-record", heading: /Good (morning|afternoon|evening)/ },
  { label: "Skin Plan & Journey", path: "/my-record/plan", heading: /.+/ },
  { label: "My Clinic", path: "/my-record/clinic", heading: /My Clinic/ },
  { label: "My Profile / Records", path: "/my-record/records", heading: /My Profile \/ Records/ },
  { label: "Appointments", path: "/my-record/appointments", heading: /Appointments/ },
  { label: "Billing", path: "/my-record/billing", heading: /Billing/ },
  { label: "Settings", path: "/my-record/settings", heading: /Settings/ },
  { label: "Resources", path: "/my-record/resources", heading: /Resources/ },
  { label: "Messages", path: "/my-record/messages", heading: /Messages/ },
];

const TABS = [
  { label: "Overview", path: "/my-record/plan" },
  { label: "Timeline", path: "/my-record/plan/timeline" },
  { label: "Journal", path: "/my-record/plan/journal" },
  { label: "Skincare Routine", path: "/my-record/plan/routine" },
];

test.describe("as a patient", () => {
  test.use({ role: "patient" });

  test("every sidebar item navigates and marks itself active", async ({ page }) => {
    await page.goto("/my-record");

    for (const item of NAV) {
      await page.getByRole("navigation").getByRole("link", { name: item.label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${item.path.replace(/\//g, "\\/")}$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(item.heading);

      // The item the patient is on is the one highlighted.
      const active = page.getByRole("navigation").getByRole("link", { name: item.label, exact: true });
      await expect(active).toHaveAttribute("aria-current", "page");
    }
  });

  test("every plan tab navigates and marks itself selected", async ({ page }) => {
    await page.goto("/my-record/plan");

    for (const tab of TABS) {
      await page.getByRole("tab", { name: tab.label, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${tab.path.replace(/\//g, "\\/")}$`));
      await expect(page.getByRole("tab", { name: tab.label, exact: true })).toHaveAttribute("aria-selected", "true");
    }
  });

  test("deep links land directly on the right page", async ({ page }) => {
    for (const path of [...NAV.map((n) => n.path), ...TABS.map((t) => t.path)]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("the brand link returns to the portal home", async ({ page }) => {
    await page.goto("/my-record/records");
    await page.getByRole("link", { name: /Aetheria/i }).first().click();
    await expect(page).toHaveURL(/\/my-record$/);
  });

  test("staff routes are refused and redirect back to the portal", async ({ page }) => {
    for (const staffPath of ["/dashboard", "/patients", "/schedule", "/retention", "/team"]) {
      await page.goto(staffPath);
      await expect(page).toHaveURL(/\/my-record/);
    }
  });

  test("the dock is present on every portal page", async ({ page }) => {
    for (const path of NAV.map((n) => n.path)) {
      await page.goto(path);
      await expect(page.locator('[data-qc="chat-bubble"]')).toBeVisible();
      await expect(page.locator('[data-qc="ai-bubble"]')).toBeVisible();
    }
  });
});

test.describe("as staff", () => {
  test.use({ role: "owner" });

  test("the patient portal is not the staff surface", async ({ page }) => {
    await page.goto("/my-record");
    await expect(page.getByText("This is the patient portal")).toBeVisible();
    // Staff keep their own nav, not the patient's.
    await expect(page.getByRole("navigation").getByRole("link", { name: "Dashboard" })).toBeVisible();
  });

  test("staff never see the patient dock", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="portal-dock"]')).toHaveCount(0);
  });
});
