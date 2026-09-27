/**
 * Display formatting shared by both portals. Keep the rules here so a figure
 * reads the same on every page.
 */

const GBP_WHOLE = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const GBP_LOOSE = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/**
 * Money for totals and KPIs: no pence at or above £1,000 (£27,100, not
 * £27,100.00) and no trailing ".00" below it. Individual payments and prices
 * keep `money()` from the period picker, which always shows pence.
 */
export function moneyWhole(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return Math.abs(n) >= 1000 ? GBP_WHOLE.format(n) : GBP_LOOSE.format(n);
}

/** "14 Sep 2026, 10:32" — never seconds. */
export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "today", "yesterday", "3 days ago". */
export function daysAgoLabel(days: number | null | undefined): string {
  if (days == null || Number.isNaN(days)) return "";
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

type NameParts = {
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
};

/**
 * One name format across the clinic portal: "Grace Adeyemi" in prose and on
 * cards. `surnameFirst` ("Adeyemi, Grace") is for the sortable Patients table
 * only; `withTitle` ("Miss Grace Adeyemi") is for the record header only.
 */
export function displayName(
  p: NameParts | null | undefined,
  opts: { surnameFirst?: boolean; withTitle?: boolean } = {},
): string {
  const first = (p?.first_name ?? "").trim();
  const last = (p?.last_name ?? "").trim();
  const title = opts.withTitle ? (p?.title ?? "").trim() : "";
  if (opts.surnameFirst) {
    const given = [title, first].filter(Boolean).join(" ");
    return [last, given].filter(Boolean).join(", ");
  }
  return [title, first, last].filter(Boolean).join(" ");
}
