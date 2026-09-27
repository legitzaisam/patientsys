import { expect, test } from "./fixtures";

test.describe("my profile field rules", () => {
  test("owner can save identity fields; staff request approval", async ({
    page,
    context,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8091";

    await page.goto("/profile");
    await expect(page.getByRole("heading", { level: 1, name: "My profile" })).toBeVisible();
    await expect(page.getByLabel("Work email")).toBeEnabled();
    await expect(page.locator('[data-qc="working-arrangement"]')).toBeEnabled();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
    await expect(page.locator('[data-qc="profile-request-approval"]')).toHaveCount(0);

    await context.addCookies([{ name: "demo_role", value: "practitioner", url: base }]);
    await page.goto("/profile");
    await expect(page.getByLabel("Full name")).toHaveValue("Nadia Rahman");
    await expect(page.getByLabel("Work email")).toBeDisabled();
    await expect(page.locator('[data-qc="working-arrangement"]')).toBeDisabled();
    await expect(page.locator('[data-qc="profile-request-approval"]')).toBeVisible();
    await expect(page.locator('[data-qc="profile-request-locked"]')).toBeVisible();

    await page.getByLabel("Job title").fill("Lead injector");
    await page.getByLabel("Note for the reviewer (optional)").fill("Promotion from July.");
    await expect(page.locator('[data-qc="profile-request-approval"]')).toBeEnabled();
    await page.locator('[data-qc="profile-request-approval"]').click();
    await expect(page.getByText("Sent for approval")).toBeVisible();
    await expect(page.getByText("Awaiting approval").first()).toBeVisible();

    await context.addCookies([{ name: "demo_role", value: "manager", url: base }]);
    await page.goto("/profile");
    await expect(page.getByLabel("Full name")).toHaveValue("Maya Chen");
    await expect(page.getByLabel("Work email")).toBeDisabled();
    await page.getByLabel("Job title").fill("Operations director");
    await expect(page.locator('[data-qc="profile-request-approval"]')).toBeEnabled();
    await page.locator('[data-qc="profile-request-approval"]').click();
    await expect(page.getByText("Sent for approval")).toBeVisible();
    await expect(page.getByText("Awaiting the clinic owner").first()).toBeVisible();

    await context.addCookies([{ name: "demo_role", value: "owner", url: base }]);
    await page.goto("/team");
    const inbox = page.locator("#profile-change-requests");
    await expect(inbox.getByText("Needs clinic owner")).toBeVisible();
    await expect(inbox.getByText("Maya Chen")).toBeVisible();
  });

  test("qualifications save without a request", async ({ page, context, baseURL }) => {
    const base = baseURL ?? "http://localhost:8091";
    await context.addCookies([{ name: "demo_role", value: "front_desk", url: base }]);
    await page.goto("/profile");
    const quals = page.getByLabel("Qualifications");
    await quals.fill("Level 3 customer service");
    await expect(page.getByText("Saved")).toBeVisible({ timeout: 8_000 });
    await page.reload();
    await expect(quals).toHaveValue("Level 3 customer service");
    await expect(page.getByLabel("Work email")).toBeDisabled();
  });
});
