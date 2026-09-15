import { expect, test, type DemoRole } from "./fixtures";

/**
 * Every route renders real content for every persona allowed to see it:
 * no error boundary, no indefinite "Loading" placeholder.
 */

const STAFF_PAGES: { path: string; heading: string | RegExp }[] = [
  { path: "/schedule", heading: "Clinic diary" },
  { path: "/patients", heading: "Patients" },
  { path: "/team", heading: "Team & access" },
  { path: "/settings", heading: "Settings" },
  { path: "/profile", heading: "My profile" },
];

const ROLE_PAGES: Record<DemoRole, { path: string; heading: string | RegExp }[]> = {
  owner: [
    ...STAFF_PAGES,
    { path: "/retention", heading: "Retention" },
    { path: "/performance", heading: "Performance" },
  ],
  practitioner: [
    ...STAFF_PAGES,
    { path: "/retention", heading: "Retention" },
    { path: "/earnings", heading: "My earnings" },
  ],
  front_desk: [...STAFF_PAGES, { path: "/retention", heading: "Retention" }],
  patient: [{ path: "/my-record", heading: /Hello / }],
};

for (const role of ["owner", "practitioner", "front_desk", "patient"] as const) {
  test.describe(`as ${role}`, () => {
    test.use({ role });

    if (role !== "patient") {
      test("dashboard renders with content", async ({ page }) => {
        await page.goto("/dashboard");
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        // The today panel is fixture-driven; it must not be an error state.
        await expect(page.getByText("Something went wrong")).toHaveCount(0);
      });
    }

    for (const { path, heading } of ROLE_PAGES[role]) {
      test(`${path} renders`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
        await expect(page.getByText("Something went wrong")).toHaveCount(0);
      });
    }
  });
}

test.describe("patient record detail", () => {
  test("opens a patient from the list", async ({ page }) => {
    await page.goto("/patients");
    await expect(page.getByRole("heading", { level: 1, name: "Patients" })).toBeVisible();
    // The fixture set always includes Olivia Bennett (the demo patient persona);
    // the list renders names as "Bennett, Ms Olivia".
    await page.getByRole("link", { name: /Bennett, .*Olivia/ }).click();
    await expect(page).toHaveURL(/\/patients\/.+/);
    await expect(page.getByRole("heading", { level: 1, name: /Bennett, .*Olivia/ })).toBeVisible();
  });
});
