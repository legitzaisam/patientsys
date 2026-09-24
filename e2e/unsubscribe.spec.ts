import { createHmac } from "node:crypto";
import { expect, test } from "./fixtures";

/**
 * The public one-click unsubscribe route (/u/$token). Tokens are
 * HMAC(patient_id, secret); demo mode uses a fixed key so the flow is
 * walkable end to end. Runs last (alphabetically) so opting Olivia out
 * cannot affect the reminder and recall specs.
 */

const DEMO_SECRET = "demo-unsubscribe-secret";

function tokenFor(patientId: string) {
  const mac = createHmac("sha256", DEMO_SECRET).update(patientId).digest("hex").slice(0, 32);
  return `${patientId}.${mac}`;
}

test("a patient can unsubscribe from the email footer link", async ({ page, context, baseURL }) => {
  // Find Olivia's patient id from the staff list, then act with no session.
  await context.addCookies([{ name: "demo_role", value: "owner", url: baseURL! }]);
  await page.goto("/patients");
  const href = await page.getByRole("link", { name: /Bennett, .*Olivia/ }).getAttribute("href");
  const patientId = href!.split("/").pop()!;

  await context.clearCookies();
  await page.goto(`/u/${tokenFor(patientId)}`);
  await expect(page.getByRole("heading", { name: "Stop clinic messages?" })).toBeVisible();
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page.getByRole("heading", { name: "You're unsubscribed" })).toBeVisible();

  // Staff side reflects it: reminders and marketing are now off.
  await context.addCookies([{ name: "demo_role", value: "owner", url: baseURL! }]);
  await page.goto(`/patients/${patientId}?tab=contact`);
  await expect(page.getByRole("heading", { name: "Contact preferences" })).toBeVisible();
  // Switch order: reminders, marketing, marketing email, marketing text.
  await expect(page.getByRole("switch").nth(0)).toHaveAttribute("aria-checked", "false");
  await expect(page.getByRole("switch").nth(1)).toHaveAttribute("aria-checked", "false");
});

test("a tampered token cannot unsubscribe anyone", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/u/d10000-0000-4000-8000-000000000054.ffffffffffffffffffffffffffffffff");
  await page.getByRole("button", { name: "Unsubscribe" }).click();
  await expect(page.getByRole("heading", { name: "This link isn't available" })).toBeVisible();
});
