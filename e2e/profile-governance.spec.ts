import { expect, test } from "./fixtures";

test.describe("my profile field rules", () => {
  test("owner can save identity fields; staff request approval", async ({
    page,
    context,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8091";
    const edit = page.locator('[data-qc="personal-details-edit"]');

    await page.goto("/profile");
    await expect(page.getByRole("heading", { level: 1, name: "My profile" })).toBeVisible();
    await edit.click();
    await expect(page.getByLabel("Work email")).toBeEnabled();
    await expect(page.locator('[data-qc="working-arrangement"]')).toBeEnabled();
    await expect(page.getByRole("button", { name: "Save changes" })).toBeVisible();
    await expect(page.locator('[data-qc="profile-request-approval"]')).toHaveCount(0);

    await context.addCookies([{ name: "demo_role", value: "practitioner", url: base }]);
    await page.goto("/profile");
    await edit.click();
    await expect(page.getByLabel("Full name")).toHaveValue("Nadia Rahman");
    await expect(page.getByLabel("Work email")).toBeDisabled();
    await expect(page.locator('[data-qc="working-arrangement"]')).toBeDisabled();
    await expect(page.locator('[data-qc="profile-request-approval"]')).toBeVisible();
    await expect(page.locator('[data-qc="profile-request-locked"]')).toBeVisible();

    await page.getByLabel("Job title").fill("Lead injector");
    await page.getByLabel("Note for the reviewer (optional)").fill("Promotion from July.");
    await expect(page.locator('[data-qc="profile-request-approval"]')).toBeEnabled();
    await page.locator('[data-qc="profile-request-approval"]').click();
    await expect(page.locator('[data-qc="personal-details-status"]')).toContainText(
      "Sent to your manager",
    );
    await expect(page.locator('[data-qc="pending-job"]')).toContainText(
      "“Lead injector” awaiting approval",
    );

    await context.addCookies([{ name: "demo_role", value: "manager", url: base }]);
    await page.goto("/profile");
    await edit.click();
    await expect(page.getByLabel("Full name")).toHaveValue("Maya Chen");
    await expect(page.getByLabel("Work email")).toBeDisabled();
    await page.getByLabel("Job title").fill("Operations director");
    await expect(page.locator('[data-qc="profile-request-approval"]')).toBeEnabled();
    await page.locator('[data-qc="profile-request-approval"]').click();
    await expect(page.locator('[data-qc="personal-details-status"]')).toContainText(
      "Sent to the clinic owner",
    );
    await expect(page.locator('[data-qc="pending-job"]')).toContainText(
      "awaiting the clinic owner",
    );

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
    await page.locator('[data-qc="qualification-input"]').fill("Level 3 customer service");
    await page.locator('[data-qc="qualification-add"]').click();
    await expect(page.locator('[data-qc="qualifications-saved"]')).toHaveText("Saved", {
      timeout: 8_000,
    });
    await page.reload();
    await expect(
      page.locator('[data-qc="qualification-chip"]', { hasText: "Level 3 customer service" }),
    ).toBeVisible();
    await page.locator('[data-qc="personal-details-edit"]').click();
    await expect(page.getByLabel("Work email")).toBeDisabled();
  });
});

test.describe("profile changes on Attention needed", () => {
  test("owner and manager see pending requests; a practitioner does not", async ({
    page,
    context,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8091";

    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    const week = page.locator("#attention .glass-card").filter({ hasText: "This week" });
    const kind = week.locator('[data-qc="attention-kind-profile_change"]');
    await expect(kind).toHaveText("Profile change request");
    await kind.click();
    await expect(week.getByRole("link", { name: /Dr Nadia Rahman/ })).toHaveCount(1);
    await expect(week.getByRole("link", { name: /Sofia Marchetti/ })).toHaveCount(1);
    await week.getByRole("link", { name: /Dr Nadia Rahman/ }).click();
    await expect(page).toHaveURL(/\/team/);
    await expect(page.locator("#profile-change-requests")).toBeVisible();

    await context.addCookies([{ name: "demo_role", value: "manager", url: base }]);
    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="attention-kind-profile_change"]')).toBeVisible();
    await page.locator('[data-qc="attention-kind-profile_change"]').click();
    await expect(page.getByText("Dr Nadia Rahman").first()).toBeVisible();
    await expect(page.getByText("Sofia Marchetti").first()).toBeVisible();

    await context.addCookies([{ name: "demo_role", value: "practitioner", url: base }]);
    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="attention-kind-profile_change"]')).toHaveCount(0);
  });
});
