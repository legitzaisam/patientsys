import { MONTHS_LONG, addDays, daysInMonth, parseDayKey } from "@/lib/staff-schedule";

/**
 * The practitioner's monthly invoice as one plain model, rendered the same way
 * in the dialog preview (React), the print sheet (React) and the email (HTML
 * string). No I/O here so the server and the client share it.
 */

export type InvoiceParty = { name: string; line1?: string | null; line2?: string | null };

export type InvoiceDocument = {
  number: string;
  /** YYYY-MM-DD */
  issuedOn: string;
  /** YYYY-MM-DD */
  dueOn: string;
  from: InvoiceParty;
  billTo: InvoiceParty;
  /** "1–30 September 2026" */
  periodLabel: string;
  qty: number;
  amount: number;
  note?: string | null;
  status: "draft" | "scheduled" | "sent" | "paid";
};

const MONTHS_SHORT = MONTHS_LONG.map((m) => m.slice(0, 3));

export function invoiceMoney(n: number): string {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "1 Oct 2026" */
export function invoiceDate(key: string): string {
  const { year, month, day } = parseDayKey(key);
  return `${day} ${MONTHS_SHORT[month - 1]} ${year}`;
}

/** "1–30 September 2026" */
export function invoicePeriodRange(year: number, month: number): string {
  return `1–${daysInMonth(year, month)} ${MONTHS_LONG[month - 1]} ${year}`;
}

export const INVOICE_TERMS_DAYS = 14;

export function buildInvoiceDocument(input: {
  number: string;
  issuedOn: string;
  year: number;
  month: number;
  from: InvoiceParty;
  billTo: InvoiceParty;
  qty: number;
  amount: number;
  note?: string | null;
  status: InvoiceDocument["status"];
  dueOn?: string;
}): InvoiceDocument {
  return {
    number: input.number,
    issuedOn: input.issuedOn,
    dueOn: input.dueOn ?? addDays(input.issuedOn, INVOICE_TERMS_DAYS),
    from: input.from,
    billTo: input.billTo,
    periodLabel: invoicePeriodRange(input.year, input.month),
    qty: input.qty,
    amount: input.amount,
    note: input.note ?? null,
    status: input.status,
  };
}

function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const INK = "#2f3f66";
const MUTED = "#6b7190";
const RULE = "#ece7dc";

/**
 * The document as self-contained HTML (inline styles, no scripts, no external
 * assets except the data-URI mark) — the email's HTML alternative.
 */
export function invoiceDocumentHtml(doc: InvoiceDocument): string {
  const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="28" height="28" aria-hidden="true"><circle cx="46" cy="46" r="32" fill="none" stroke="${INK}" stroke-width="10"/><path d="M78 62C78 62 62 76 62 84a12 12 0 0 0 24 0C86 76 78 62 78 62Z" fill="#e2c46b" transform="rotate(-38 74 80)"/></svg>`;
  const label = (t: string) =>
    `<div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:${MUTED};margin-bottom:4px">${t}</div>`;
  const party = (p: InvoiceParty) =>
    `<div style="font-weight:600">${esc(p.name)}</div>${p.line1 ? `<div style="color:${MUTED}">${esc(p.line1)}</div>` : ""}${p.line2 ? `<div style="color:${MUTED}">${esc(p.line2)}</div>` : ""}`;
  const th = (t: string, right = false) =>
    `<th style="padding:8px 0;font-size:11px;letter-spacing:.06em;text-transform:uppercase;text-align:${right ? "right" : "left"};border-bottom:2px solid ${INK}">${t}</th>`;
  const td = (t: string, right = false, bold = false) =>
    `<td style="padding:12px 0;text-align:${right ? "right" : "left"};border-bottom:1px solid ${RULE};${bold ? "font-weight:600" : ""}">${t}</td>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(doc.number)}</title></head>
<body style="margin:0;padding:24px;background:#f6f1e6;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${INK}">
<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;padding:36px;font-size:14px;line-height:1.5">
  <table role="presentation" style="width:100%;border-collapse:collapse"><tr>
    <td style="vertical-align:top"><div style="display:flex;align-items:center;gap:10px">${mark}<span style="font-size:24px;font-weight:700;letter-spacing:.12em">INVOICE</span></div>
      <div style="margin-top:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:${MUTED}">${esc(doc.number)}</div></td>
    <td style="vertical-align:top;text-align:right;font-size:13px;line-height:1.7;color:${MUTED}">
      <div>Issued <strong style="color:${INK}">${invoiceDate(doc.issuedOn)}</strong></div>
      <div>Due <strong style="color:${INK}">${invoiceDate(doc.dueOn)}</strong></div></td>
  </tr></table>
  <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:24px"><tr>
    <td style="vertical-align:top;width:50%">${label("From")}${party(doc.from)}</td>
    <td style="vertical-align:top;width:50%">${label("Bill to")}${party(doc.billTo)}</td>
  </tr></table>
  <table style="width:100%;border-collapse:collapse;margin-top:24px">
    <thead><tr>${th("Description")}${th("Qty", true)}${th("Amount", true)}</tr></thead>
    <tbody>
      <tr>${td(`<div style="font-weight:600">Treatments delivered, practitioner share</div><div style="font-size:13px;color:${MUTED}">${esc(doc.periodLabel)}</div>`)}${td(String(doc.qty), true)}${td(invoiceMoney(doc.amount), true)}</tr>
      <tr>${td(`<div style="font-weight:600">Adjustments</div><div style="font-size:13px;color:${MUTED}">Refunds, product charges</div>`)}${td("—", true)}${td("£0.00", true)}</tr>
    </tbody>
  </table>
  <table role="presentation" style="width:100%;border-collapse:collapse;margin-top:16px"><tr>
    <td></td><td style="width:260px"><div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-weight:600">Total due</span><span style="font-size:22px;font-weight:700">${invoiceMoney(doc.amount)}</span></div></td>
  </tr></table>
  ${doc.note ? `<div style="margin-top:20px;padding:12px 14px;border-radius:12px;background:#faf7f1;font-size:13px"><strong>Note</strong> · ${esc(doc.note)}</div>` : ""}
  <div style="margin-top:28px;padding-top:12px;border-top:1px solid ${RULE};font-size:12px;color:${MUTED}">Generated by SQINOS from completed treatments in the diary.</div>
</div></body></html>`;
}
