import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Info, Receipt } from "lucide-react";
import { getPortalClinic } from "@/lib/clinic.functions";
import { openPortalChat } from "@/components/portal/portal-dock";
import { PortalCard, PortalHead, PortalNote, formatPortalDate } from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/my-record/billing")({
  component: Billing,
});

function Billing() {
  const fetchClinic = useServerFn(getPortalClinic);
  const { data } = useQuery({ queryKey: ["portal-clinic"], queryFn: () => fetchClinic() });

  return (
    <div data-qc="portal-billing">
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing</h1>
          <p className="page-subtitle">What you have paid for, and who to ask about anything unexpected.</p>
        </div>
      </div>

      <PortalCard>
        <PortalHead icon={Receipt} title="Treatments billed" />
        {(data?.completed ?? []).length === 0 && (
          <p className="py-3 text-xs text-muted-foreground">Nothing billed yet.</p>
        )}
        {(data?.completed ?? []).map((t: any) => (
          <div key={t.id} className="flex items-center justify-between border-b border-edge-2 py-2.5 last:border-b-0">
            <div className="min-w-0">
              <p className="text-xs font-semibold">{t.name}</p>
              <p className="text-xs text-muted-foreground">{formatPortalDate(t.performedAt)}</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-success-bg px-2.5 py-0.5 text-2xs font-semibold text-success-ink">
              Settled at the clinic
            </span>
          </div>
        ))}
        <div className="mt-3">
          <PortalNote icon={Info}>
            Payments are taken at the clinic. For an invoice or a question about a charge,{" "}
            <button
              type="button"
              onClick={() => openPortalChat("Hi, could you send me an invoice for my recent treatment?")}
              className="cursor-pointer font-semibold underline"
            >
              message your clinic
            </button>
            .
          </PortalNote>
        </div>
      </PortalCard>
    </div>
  );
}
