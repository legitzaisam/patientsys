import { describe, expect, it } from "vitest";
import {
  deliverScheduledInvoices,
  dueInvoices,
  invoiceEmail,
  invoiceRecipientEmail,
  type InvoiceRow,
  type InvoiceStore,
} from "@/lib/invoices.server";

const inv = (over: Partial<InvoiceRow>): InvoiceRow => ({
  id: "i1",
  user_id: "u1",
  number: "INV-NR-2026-09",
  period_start: "2026-09-01",
  period_end: "2026-09-30",
  recipient: "payroll",
  status: "scheduled",
  scheduled_for: "2026-10-01",
  amount: 12773.25,
  treatments: 124,
  ...over,
});

describe("scheduled invoices", () => {
  it("picks out the scheduled rows due on or before today", () => {
    const rows = [
      inv({ id: "a", scheduled_for: "2026-10-01" }),
      inv({ id: "b", scheduled_for: "2026-11-01" }),
      inv({ id: "c", status: "sent", scheduled_for: null }),
      inv({ id: "d", scheduled_for: "2026-09-01" }),
    ];
    expect(dueInvoices(rows, "2026-10-01").map((r) => r.id)).toEqual(["a", "d"]);
    expect(dueInvoices(rows, "2026-09-30").map((r) => r.id)).toEqual(["d"]);
  });

  it("emails, notifies the owners and marks each due invoice sent", async () => {
    const sent: string[] = [];
    const notified: string[] = [];
    const store: InvoiceStore = {
      clinicName: "Aetheria Medical",
      clinicEmail: "payroll@aetheria.clinic",
      owners: [{ id: "owner", email: "amara@aetheria.clinic" }],
      async practitioner() {
        return { name: "Dr Nadia Rahman", email: null, jobTitle: "Aesthetic Practitioner" };
      },
      async markSent(id) {
        sent.push(id);
      },
      async notifyOwners(row) {
        notified.push(row.number);
      },
    };
    const n = await deliverScheduledInvoices(
      store,
      [inv({ id: "a" }), inv({ id: "b", scheduled_for: "2027-01-01" })],
      "2026-10-01",
      new Date("2026-10-01T06:00:00Z"),
    );
    expect(n).toBe(1);
    expect(sent).toEqual(["a"]);
    expect(notified).toEqual(["INV-NR-2026-09"]);
  });

  it("writes the email and routes it to payroll or the owner", () => {
    const mail = invoiceEmail(
      inv({}),
      { name: "Dr Nadia Rahman", email: null, jobTitle: "Aesthetic Practitioner" },
      "Aetheria Medical",
    );
    expect(mail.subject).toBe("Invoice INV-NR-2026-09 · September 2026 · £12,773.25");
    expect(mail.body).toContain("Treatments delivered, practitioner share: 124 treatments");
    expect(mail.body).toContain("Total due: £12,773.25");
    expect(invoiceRecipientEmail("payroll", { email: "payroll@x" }, { email: "owner@x" })).toBe(
      "payroll@x",
    );
    expect(invoiceRecipientEmail("owner", { email: "payroll@x" }, { email: "owner@x" })).toBe(
      "owner@x",
    );
  });
});
