import { expect, test } from "./fixtures";

test.describe("owner first-login setup", () => {
  test.use({ role: "owner" });

  test("asks whether the clinic has a separate manager", async ({ page, context, baseURL }) => {
    await context.addCookies([
      { name: "demo_owner_setup", value: "pending", url: baseURL ?? "http://localhost:8091" },
    ]);
    await page.goto("/dashboard");
    const gate = page.locator('[data-qc="owner-setup-gate"]');
    await expect(gate).toBeVisible();
    await expect(page.getByRole("heading", { name: "Set up your clinic" })).toBeVisible();
    await expect(page.getByText("patient portal", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Yes — I will invite a clinic manager" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(gate).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Clinic overview" })).toBeVisible();
  });
});

test.describe("named roles and manager invites", () => {
  test.use({ role: "owner" });

  test("owner can add a named role that starts generic", async ({ page }) => {
    await page.goto("/team");
    await page.getByRole("button", { name: /Invite/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("radio", { name: "Manager" })).toBeVisible();
    await expect(dialog.getByRole("radio", { checked: true })).toHaveCount(1);
    await dialog.getByRole("button", { name: "Add a role" }).click();
    await dialog.getByLabel("Name the role").fill("Plastic surgeon");
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await expect(dialog.getByText(/generic floor access/i)).toBeVisible();
    await expect(dialog.getByRole("radio", { name: "Plastic surgeon" })).toBeVisible();
    await expect(dialog.getByRole("radio", { checked: true })).toHaveCount(1);
    await expect(dialog.getByRole("radio", { name: "Plastic surgeon" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Staff access" })).toBeVisible();
    await expect(page.getByText("Plastic surgeon").first()).toBeVisible();
  });
});

test.describe("as manager", () => {
  test("can invite but cannot see owner, manager or the access grid", async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([{ name: "demo_role", value: "manager", url: baseURL ?? "http://localhost:8091" }]);
    await page.goto("/team");
    await page.getByRole("button", { name: /Invite/ }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("radio", { name: "Receptionist" })).toBeVisible();
    await expect(dialog.getByRole("radio", { name: "Practitioner" })).toBeVisible();
    await expect(dialog.getByRole("radio", { name: "Manager" })).toHaveCount(0);
    await expect(dialog.getByRole("radio", { name: "Clinic owner" })).toHaveCount(0);
    await expect(dialog.getByRole("radio", { checked: true })).toHaveCount(1);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Staff access" })).toHaveCount(0);
  });
});
