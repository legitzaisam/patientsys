import { createHash, randomBytes } from "node:crypto";
import { INSIGHTS_SOURCES, normalizeSource, type InsightsSource } from "./insights.server";
export { DEMO_INSIGHTS_INGEST_KEY } from "./insights-constants";

export function hashInsightsIngestKey(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function generateInsightsIngestKey() {
  const raw = `ak_${randomBytes(24).toString("hex")}`;
  return { raw, hash: hashInsightsIngestKey(raw), last4: raw.slice(-4) };
}

export type InsightsEventPerson = {
  email?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
};

export type InsightsEvent = {
  type: "lead" | "product_sale";
  external_id: string;
  occurred_at: string;
  source: InsightsSource;
  campaign?: string | null;
  interest?: string | null;
  person: InsightsEventPerson;
  product?: { sku?: string; name?: string; qty?: number; amount?: number } | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function splitName(name: string | undefined, person: InsightsEventPerson) {
  if (person.first_name || person.last_name) {
    return { first: (person.first_name ?? "").trim(), last: (person.last_name ?? "").trim() };
  }
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

export function parseInsightsEvent(body: unknown): InsightsEvent {
  const row = asRecord(body);
  const type = row.type === "product_sale" ? "product_sale" : row.type === "lead" ? "lead" : null;
  if (!type) throw new Error("type must be lead or product_sale");
  const externalId = String(row.external_id ?? "").trim();
  if (!externalId) throw new Error("external_id is required");
  const occurredAt = String(row.occurred_at ?? "").trim();
  if (!occurredAt || Number.isNaN(Date.parse(occurredAt))) throw new Error("occurred_at must be an ISO date");
  const person = asRecord(row.person);
  const email = String(person.email ?? "").trim();
  if (!email || !email.includes("@")) throw new Error("person.email is required");
  const names = splitName(typeof person.name === "string" ? person.name : undefined, {
    first_name: typeof person.first_name === "string" ? person.first_name : undefined,
    last_name: typeof person.last_name === "string" ? person.last_name : undefined,
  });
  const product = row.product ? asRecord(row.product) : null;
  if (type === "product_sale" && !String(product?.sku ?? "").trim() && !String(product?.name ?? "").trim()) {
    throw new Error("product.sku or product.name is required for a sale");
  }
  const source = normalizeSource(typeof row.source === "string" ? row.source : "website");
  if (!(INSIGHTS_SOURCES as readonly string[]).includes(source)) {
    throw new Error("source is not recognised");
  }
  return {
    type,
    external_id: externalId.slice(0, 200),
    occurred_at: new Date(occurredAt).toISOString(),
    source,
    campaign: typeof row.campaign === "string" ? row.campaign.trim().slice(0, 200) || null : null,
    interest: typeof row.interest === "string" ? row.interest.trim().slice(0, 200) || null : null,
    person: {
      email: email.slice(0, 200),
      first_name: names.first.slice(0, 100),
      last_name: names.last.slice(0, 100),
      phone: typeof person.phone === "string" ? person.phone.trim().slice(0, 50) || undefined : undefined,
    },
    product: product
      ? {
          sku: String(product.sku ?? "").trim().slice(0, 80) || undefined,
          name: String(product.name ?? "").trim().slice(0, 200) || undefined,
          qty: Math.max(1, Math.round(Number(product.qty ?? 1)) || 1),
          amount: Number(product.amount ?? 0) || 0,
        }
      : null,
  };
}
