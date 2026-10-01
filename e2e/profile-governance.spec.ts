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
    await expect(inbox.getByText("Maya Chen").first()).toBeVisible();
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

test.describe("staff requests on Attention needed", () => {
  test("profile changes sit under Requests to approve; the owner always, a manager only once granted", async ({
    page,
    context,
    baseURL,
  }) => {
    const base = baseURL ?? "http://localhost:8091";
    const grantName = "Approve staff requests for Manager";

    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    const week = page.locator("#attention .glass-card").filter({ hasText: "This week" });
    // One accordion for every staff request: profile changes, time off, working patterns.
    await expect(week.locator('[data-qc="attention-kind-profile_change"]')).toHaveCount(0);
    const kind = week.locator('[data-qc="attention-kind-staff_request"]');
    await expect(kind).toHaveText("Requests to approve");
    await kind.click();
    const showAll = async (card: typeof week) => {
      const more = card.getByRole("button", { name: /^Show \d+ more$/ });
      if ((await more.count()) > 0) await more.first().click();
    };
    await showAll(week);
    const rows = week.locator('[data-qc="attention-staff-request"]');
    await expect(rows.filter({ hasText: /Sofia Marchetti.*Profile change/ })).toHaveCount(1);
    await expect(rows.filter({ hasText: /Dr Nadia Rahman.*Profile change/ })).toHaveCount(1);
    await rows.filter({ hasText: /Sofia Marchetti.*Profile change/ }).getByRole("link").click();
    await expect(page).toHaveURL(/\/team/);
    await expect(page.locator("#profile-change-requests")).toBeVisible();

    // The manager's grant starts off, so no accordion for them.
    await context.addCookies([{ name: "demo_role", value: "manager", url: base }]);
    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    await expect(page.locator("#attention")).toBeVisible();
    await expect(page.locator('[data-qc="attention-kind-staff_request"]')).toHaveCount(0);

    // The owner hands it over under Staff access …
    await context.addCookies([{ name: "demo_role", value: "owner", url: base }]);
    await page.goto("/team");
    const grant = page.getByRole("switch", { name: grantName });
    await grant.scrollIntoViewIfNeeded();
    await expect(grant).not.toBeChecked();
    await grant.click();
    await expect(page.getByRole("switch", { name: grantName })).toBeChecked();

    // … and the manager now sees the same queue.
    await context.addCookies([{ name: "demo_role", value: "manager", url: base }]);
    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    const managerKind = page.locator('[data-qc="attention-kind-staff_request"]');
    await expect(managerKind).toHaveText("Requests to approve");
    await managerKind.click();
    await showAll(page.locator('[data-qc="attention-this-week"]'));
    await expect(
      page
        .locator('[data-qc="attention-staff-request"]')
        .filter({ hasText: /Sofia Marchetti.*Profile change/ }),
    ).toHaveCount(1);

    // Put the grant back so the other specs see the fixture default.
    await context.addCookies([{ name: "demo_role", value: "owner", url: base }]);
    await page.goto("/team");
    await page.getByRole("switch", { name: grantName }).scrollIntoViewIfNeeded();
    await page.getByRole("switch", { name: grantName }).click();
    await expect(page.getByRole("switch", { name: grantName })).not.toBeChecked();

    await context.addCookies([{ name: "demo_role", value: "practitioner", url: base }]);
    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="attention-loading"]')).toHaveCount(0);
    await expect(page.locator('[data-qc="attention-kind-staff_request"]')).toHaveCount(0);
  });
});
