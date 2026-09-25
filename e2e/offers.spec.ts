import { expect, test, type Page } from "./fixtures";

/**
 * Offers and marketing: the designer behind offers.manage, stage automation
 * on the outbox run, the three send surfaces, and the patient's claim.
 *
 * Fixtures (src/lib/demo/data.ts, "offers and marketing"):
 *   - Four stage templates; Pre- and Post-consultation switched on, Single
 *     treatment and Plan ending off; one one-off "Autumn skin reset".
 *   - Olivia Bennett holds a claimed "Autumn skin reset" and an open
 *     "Nearly at the end of your plan" offer. Marketing on, marketing email off.
 *   - Isla Hartley and Noor El-Amin are consented sign-ups in Pre-consultation.
 *
 * Tests run in order on one in-memory fixture set.
 */

const BASE = "http://localhost:8091";

async function become(page: Page, role: "owner" | "practitioner" | "front_desk" | "patient") {
  await page.context().addCookies([{ name: "demo_role", value: role, url: BASE }]);
}

async function openOliviaRecord(page: Page) {
  await page.goto("/patients");
  await page.getByRole("link", { name: /Bennett, .*Olivia/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Bennett, .*Olivia/ })).toBeVisible();
}

test.describe("access", () => {
  test("front desk cannot reach the designer until the owner grants offers.manage", async ({ page }) => {
    await become(page, "front_desk");
    await page.goto("/offers");
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByRole("menuitem", { name: "Offers" })).toHaveCount(0);
    await page.keyboard.press("Escape");

    // The owner grants it from the Team access matrix.
    await become(page, "owner");
    await page.goto("/team");
    const grant = page.getByRole("switch", { name: "Design and automate offers for Receptionist" });
    await expect(grant).toHaveAttribute("aria-checked", "false");
    await grant.click();
    await expect(grant).toHaveAttribute("aria-checked", "true");

    await become(page, "front_desk");
    await page.goto("/offers");
    await expect(page.getByRole("heading", { level: 1, name: "Offers" })).toBeVisible();
    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByRole("menuitem", { name: "Offers" })).toBeVisible();
    await page.keyboard.press("Escape");

    // Put it back so the rest of the suite sees the seed default.
    await become(page, "owner");
    await page.goto("/team");
    await page.getByRole("switch", { name: "Design and automate offers for Receptionist" }).click();
    await expect(page.getByRole("switch", { name: "Design and automate offers for Receptionist" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });
});

test.describe("designer", () => {
  test.use({ role: "owner" });

  test("shows the four stage cards with cohort counts and the one-off list", async ({ page }) => {
    await page.goto("/offers");
    for (const stage of ["pre_consultation", "post_consultation", "single_treatment", "plan_ending"]) {
      await expect(page.locator(`[data-qc="offer-stage-${stage}"]`)).toBeVisible();
    }
    await expect(page.locator('[data-qc="offer-stage-pre_consultation"] [data-qc="offer-automation-switch"]')).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.locator('[data-qc="offer-stage-single_treatment"] [data-qc="offer-automation-switch"]')).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expect(page.locator('[data-qc="offer-stage-pre_consultation"] [data-qc="offer-stage-count"]')).toContainText(/\d+ in stage/);
    await expect(page.locator('[data-qc="offer-customs"] [data-qc="offer-template"]', { hasText: "Autumn skin reset" })).toBeVisible();
  });

  test("Draft with AI fills the fields and the live preview follows; saving creates a one-off template", async ({ page }) => {
    await page.goto("/offers");
    await page.locator('[data-qc="offer-new"]').click();
    const editor = page.locator('[data-qc="offer-editor"]');
    await expect(editor).toBeVisible();

    // Fallback path (no COHERE_API_KEY in tests): the brief becomes the offer line.
    await editor.getByLabel("Brief for the AI draft").fill("Free LED add-on with any peel in October");
    await editor.getByRole("button", { name: "Draft with AI" }).click();
    await expect(editor.locator("#offer-value")).toHaveValue("Free LED add-on with any peel in October");

    await editor.locator("#offer-name").fill("October peel add-on");
    await editor.locator("#offer-headline").fill("A brighter October");
    await editor.locator("#offer-code").fill("octled");
    await expect(editor.locator("#offer-code")).toHaveValue("OCTLED");

    // The email preview is an iframe; the portal card is in the DOM.
    await editor.getByRole("button", { name: "Portal card" }).click();
    const card = editor.locator('[data-qc="offer-card-preview"]');
    await expect(card).toContainText("A brighter October");
    await expect(card).toContainText("OCTLED");

    await editor.locator('[data-qc="offer-save"]').click();
    await expect(editor).toBeHidden();
    await expect(page.locator('[data-qc="offer-customs"] [data-qc="offer-template"]', { hasText: "October peel add-on" })).toBeVisible();
  });

  test("the automation dialog previews the cohort; switching on sends on the next Process queue", async ({ page }) => {
    await page.goto("/offers");
    const card = page.locator('[data-qc="offer-stage-single_treatment"]');
    await card.locator('[data-qc="offer-automation-switch"]').click();
    const dialog = page.locator('[data-qc="offer-automation"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-qc="offer-preview-count"]')).toContainText(/\d+ patients? would receive this today/);
    const count = Number((await dialog.locator('[data-qc="offer-preview-count"]').innerText()).match(/^(\d+)/)?.[1] ?? "0");
    expect(count).toBeGreaterThan(0);
    // The first name in the will-send list is who we check afterwards.
    const firstName = (await dialog.locator("ul li").first().innerText()).split("\n")[0]!.trim();

    await dialog.locator('[data-qc="offer-automation-on"]').click();
    await expect(dialog).toBeHidden();
    await expect(card.locator('[data-qc="offer-automation-switch"]')).toHaveAttribute("aria-checked", "true");

    // Process queue runs the automation first, then delivers what it queued.
    await openOliviaRecord(page);
    await page.getByRole("tab", { name: "Contact" }).click();
    await page.getByRole("button", { name: "Process queue" }).click();
    await expect(page.getByText(/sent/).first()).toBeVisible();

    // The stage card now shows the sends, and the patient's record carries the offer and the email.
    await page.goto("/offers");
    await expect(card).toContainText(new RegExp(`${count}\\s+sent`));
    await expect(card).toContainText(/Last run/);

    await page.goto("/patients");
    const [last, first] = firstName.split(" ").length === 2 ? [firstName.split(" ")[1], firstName.split(" ")[0]] : [firstName, ""];
    await page.getByRole("link", { name: new RegExp(`${last}, .*${first}`) }).first().click();
    await page.getByRole("tab", { name: "Contact" }).click();
    const offers = page.locator('[data-qc="patient-offers"]');
    await expect(offers.locator('[data-qc="patient-offer-row"]', { hasText: "Your skin is just getting started" })).toBeVisible();
    await expect(offers.getByText("Automatic", { exact: false }).first()).toBeVisible();
    await expect(page.locator("li", { hasText: /Keep your results going/ }).first()).toContainText(/sent/);

    // Switch it back off so later runs do not keep sending.
    await page.goto("/offers");
    await card.locator('[data-qc="offer-automation-switch"]').click();
    await page.locator('[data-qc="offer-automation-off"]').click();
    await expect(card.locator('[data-qc="offer-automation-switch"]')).toHaveAttribute("aria-checked", "false");
  });
});

test.describe("send surfaces", () => {
  test.use({ role: "owner" });

  test("Send offer on the record states the PECR position and creates a portal-only offer", async ({ page }) => {
    await openOliviaRecord(page);
    await page.locator('[data-qc="send-offer-open"]').click();
    const dialog = page.locator('[data-qc="send-offer"]');
    await expect(dialog).toBeVisible();
    const options = await dialog.locator('[data-qc="send-offer-template"] option').allTextContents();
    await dialog
      .locator('[data-qc="send-offer-template"]')
      .selectOption({ index: options.findIndex((o) => o.includes("Autumn skin reset")) });
    // Olivia has marketing on but marketing email off.
    await expect(dialog.locator('[data-qc="send-offer-pecr"]')).toContainText(/has not opted in to marketing email/);
    await expect(dialog.locator('[data-qc="send-offer-pecr"]')).toContainText(/can only go to Olivia's portal/);
    await dialog.locator("#offer-message").fill("Lovely to see you last week.");
    await dialog.locator('[data-qc="send-offer-submit"]').click();
    const result = dialog.locator('[data-qc="send-offer-result"]');
    await expect(result).toContainText("Sent · 1");
    await expect(result).toContainText(/Portal only/);
    await page.getByRole("button", { name: "Done" }).click();

    await page.getByRole("tab", { name: "Contact" }).click();
    const rows = page.locator('[data-qc="patient-offers"] [data-qc="patient-offer-row"]');
    await expect(rows).toHaveCount(3);
    await expect(rows.first()).toContainText("Autumn skin reset");
    await expect(rows.first()).toContainText("From the record");
  });

  test("the patient table sends to a selection and reports who was skipped", async ({ page }) => {
    await page.goto("/patients");
    await expect(page.locator('[data-qc="bulk-send-offer"]')).toHaveCount(0);
    await page.locator('[data-qc="select-patient"]').nth(1).click();
    await page.locator('[data-qc="select-patient"]').nth(2).click();
    await page.locator('[data-qc="select-patient"]').nth(3).click();
    const bulk = page.locator('[data-qc="bulk-send-offer"]');
    await expect(bulk).toContainText("3");
    await bulk.click();
    const dialog = page.locator('[data-qc="send-offer"]');
    await expect(dialog.getByRole("heading", { name: "Send an offer to 3 patients" })).toBeVisible();
    await dialog.locator('[data-qc="send-offer-submit"]').click();
    const result = dialog.locator('[data-qc="send-offer-result"]');
    await expect(result).toContainText(/Sent · \d/);
    // Every selected patient is accounted for, sent or skipped.
    const text = await result.innerText();
    const sent = Number(text.match(/Sent · (\d+)/i)?.[1] ?? "0");
    const skipped = Number(text.match(/Skipped · (\d+)/i)?.[1] ?? "0");
    expect(sent + skipped).toBe(3);
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.locator('[data-qc="bulk-send-offer"]')).toHaveCount(0);
  });

  test("Insights lists carry Send offer per row", async ({ page }) => {
    await page.goto("/insights");
    const list = page.locator("#insights-waiting");
    await expect(list).toContainText("Maps to the Pre-consultation offer");
    await list.locator('[data-qc="insights-send-offer"]').first().click();
    const dialog = page.locator('[data-qc="send-offer"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-qc="send-offer-submit"]').click();
    await expect(dialog.locator('[data-qc="send-offer-result"]')).toContainText(/Sent · 1|Skipped · 1/);
  });
});

test.describe("patient portal", () => {
  test.use({ role: "patient" });

  test("the deep link marks the offer opened; Claim records it and offers to book", async ({ page }) => {
    await page.goto("/my-record");
    const card = page.locator('[data-qc="portal-offers-card"]');
    await expect(card).toBeVisible();
    const open = card.locator('[data-qc="portal-offer"][data-status="sent"]').first();
    await expect(open).toContainText("New offer");
    const id = (await open.getAttribute("id"))!.replace("offer-", "");

    // Landing from the email button.
    await page.goto(`/my-record?offer=${id}`);
    const landed = page.locator(`#offer-${id}`);
    await expect(landed).toHaveAttribute("data-status", "viewed");
    await expect(landed).toContainText("Offer for you");

    await landed.locator('[data-qc="portal-offer-claim"]').click();
    await expect(landed.locator('[data-qc="portal-offer-claimed"]')).toBeVisible();
    await expect(landed.locator('[data-qc="portal-offer-book"]')).toBeVisible();

    // Resources lists everything, claimed ones marked.
    await page.goto("/my-record/resources");
    const all = page.locator('[data-qc="resources-offers"] [data-qc="portal-offer"]');
    await expect(all.first()).toBeVisible();
    expect(await all.count()).toBeGreaterThanOrEqual(2);
    await expect(all.filter({ has: page.locator('[data-qc="portal-offer-claimed"]') }).first()).toBeVisible();
  });

  test("front desk hears about the claim and sees it on the diary card", async ({ page }) => {
    await become(page, "front_desk");
    await page.goto("/dashboard");
    await page.getByRole("button", { name: /^Notifications/ }).click();
    const alert = page.getByText(/Olivia Bennett claimed/).first();
    await expect(alert).toBeVisible();
    await alert.click();
    await page.waitForURL(/\/patients\/[^/]+\?tab=contact/);
    await expect(page.locator('[data-qc="patient-offers"]')).toContainText("Claimed");

    await page.goto("/dashboard");
    await expect(page.locator('[data-qc="claimed-offer-chip"]').first()).toBeAttached();
  });
});
