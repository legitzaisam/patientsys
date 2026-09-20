import { createFileRoute } from "@tanstack/react-router";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { hashInsightsIngestKey, parseInsightsEvent } from "@/lib/insights-ingest.server";

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function bearer(request: Request) {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export const Route = createFileRoute("/api/insights/events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = bearer(request);
        if (!token) return unauthorized();
        const hash = hashInsightsIngestKey(token);

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        let event;
        try {
          event = parseInsightsEvent(body);
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Invalid event" }, { status: 400 });
        }

        if (DEMO_MODE) {
          return ingestDemo(hash, event);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: clinic } = await supabaseAdmin
          .from("clinics")
          .select("id")
          .eq("insights_ingest_key_hash", hash)
          .maybeSingle();
        if (!clinic) return unauthorized();

        const email = event.person.email!.toLowerCase();
        const { data: matched } = await supabaseAdmin
          .from("patients")
          .select("id")
          .eq("clinic_id", clinic.id)
          .is("deleted_at", null)
          .ilike("email", email)
          .limit(1)
          .maybeSingle();

        if (event.type === "lead") {
          const row = {
            clinic_id: clinic.id,
            patient_id: matched?.id ?? null,
            external_id: event.external_id,
            first_name: event.person.first_name || null,
            last_name: event.person.last_name || null,
            email: event.person.email,
            phone: event.person.phone ?? null,
            source: event.source,
            campaign: event.campaign ?? null,
            interest: event.interest ?? null,
            occurred_at: event.occurred_at,
            updated_at: new Date().toISOString(),
          };
          const { error } = await supabaseAdmin.from("website_leads").upsert(row, { onConflict: "clinic_id,external_id" });
          if (error) return Response.json({ error: error.message }, { status: 500 });
          return Response.json({ ok: true, type: "lead", patient_id: matched?.id ?? null });
        }

        let productId: string | null = null;
        const sku = event.product?.sku ?? null;
        if (sku) {
          const { data: product } = await supabaseAdmin
            .from("retail_products")
            .select("id")
            .eq("clinic_id", clinic.id)
            .eq("sku", sku)
            .maybeSingle();
          productId = product?.id ?? null;
        }
        if (!productId && event.product?.name) {
          const { data: created, error } = await supabaseAdmin
            .from("retail_products")
            .insert({
              clinic_id: clinic.id,
              name: event.product.name,
              sku,
              price: event.product.amount ?? null,
              active: true,
              featured_on_portal: false,
            })
            .select("id")
            .single();
          if (error) return Response.json({ error: error.message }, { status: 500 });
          productId = created?.id ?? null;
        }

        const { error } = await supabaseAdmin.from("product_sales").upsert(
          {
            clinic_id: clinic.id,
            product_id: productId,
            patient_id: matched?.id ?? null,
            external_id: event.external_id,
            source: event.source,
            qty: event.product?.qty ?? 1,
            amount: event.product?.amount ?? 0,
            occurred_at: event.occurred_at,
          },
          { onConflict: "clinic_id,external_id" },
        );
        if (error) return Response.json({ error: error.message }, { status: 500 });
        return Response.json({ ok: true, type: "product_sale", patient_id: matched?.id ?? null });
      },
    },
  },
});

async function ingestDemo(hash: string, event: ReturnType<typeof parseInsightsEvent>) {
  const { CLINIC_ID, db, newId } = await import("@/lib/demo/data");
  if (hash !== db.clinic["insights_ingest_key_hash"]) return unauthorized();
  const leads = db.websiteLeads as any[];
  const products = db.retailProducts as any[];
  const sales = db.productSales as any[];
  const people = db.patients as any[];
  const email = event.person.email!.toLowerCase();
  const matched = people.find((p) => String(p.email ?? "").toLowerCase() === email) ?? null;

  if (event.type === "lead") {
    const existing = leads.find((l) => l.external_id === event.external_id);
    const row = {
      clinic_id: CLINIC_ID,
      patient_id: matched?.id ?? null,
      external_id: event.external_id,
      first_name: event.person.first_name || null,
      last_name: event.person.last_name || null,
      email: event.person.email,
      phone: event.person.phone ?? null,
      source: event.source,
      campaign: event.campaign ?? null,
      interest: event.interest ?? null,
      occurred_at: event.occurred_at,
      updated_at: new Date().toISOString(),
    };
    if (existing) Object.assign(existing, row);
    else leads.push({ id: newId("w9"), created_at: event.occurred_at, ...row });
    return Response.json({ ok: true, type: "lead", patient_id: matched?.id ?? null });
  }

  let product = event.product?.sku ? products.find((p) => p.sku === event.product?.sku) : null;
  if (!product && event.product?.name) {
    product = {
      id: newId("r9"),
      clinic_id: CLINIC_ID,
      name: event.product.name,
      sku: event.product.sku ?? null,
      price: event.product.amount ?? null,
      active: true,
      featured_on_portal: false,
      image_url: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    products.push(product);
  }
  const existing = sales.find((s) => s.external_id === event.external_id);
  const row = {
    clinic_id: CLINIC_ID,
    product_id: product?.id ?? null,
    patient_id: matched?.id ?? null,
    external_id: event.external_id,
    source: event.source,
    qty: event.product?.qty ?? 1,
    amount: event.product?.amount ?? 0,
    occurred_at: event.occurred_at,
  };
  if (existing) Object.assign(existing, row);
  else sales.push({ id: newId("s9"), created_at: event.occurred_at, ...row });
  return Response.json({ ok: true, type: "product_sale", patient_id: matched?.id ?? null });
}
