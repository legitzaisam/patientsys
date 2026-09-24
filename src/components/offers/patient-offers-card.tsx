import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift } from "lucide-react";
import { Card } from "@/components/ui/card";
import { listPatientOffers } from "@/lib/clinic.functions";
import { OFFER_SOURCE_LABEL, shortDate, type PatientOfferView } from "@/lib/offers/shape";
import { OfferStatusBadge } from "./offer-status-badge";

type Row = PatientOfferView & { template_name: string | null };

/** Offers this patient has been sent, on the record's Contact tab. */
export function PatientOffersCard({ patientId, action }: { patientId: string; action?: React.ReactNode }) {
  const fetchOffers = useServerFn(listPatientOffers);
  const { data } = useQuery({
    queryKey: ["patient-offers", patientId],
    queryFn: async () => (await fetchOffers({ data: { patient_id: patientId } })) as Row[],
  });
  const rows = data ?? [];
  return (
    <Card className="p-5" data-qc="patient-offers">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gift className="h-4 w-4 text-ink-3" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">Offers</h2>
            <p className="text-xs text-muted-foreground">
              {rows.length === 0 ? "No offers sent yet." : `${rows.length} sent · ${rows.filter((r) => r.status === "claimed").length} claimed`}
            </p>
          </div>
        </div>
        {action}
      </div>
      {rows.length > 0 ? (
        <ul className="mt-4 divide-y divide-edge rounded-2xl border border-edge">
          {rows.map((r) => (
            <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm" data-qc="patient-offer-row">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {r.headline}
                  {r.code ? <span className="ml-2 rounded bg-glass-2 px-1.5 py-0.5 text-[11px] font-semibold text-ink-2 shadow-inset-hi">{r.code}</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.value_text ? `${r.value_text} · ` : ""}
                  {OFFER_SOURCE_LABEL[r.source]} · sent {shortDate(r.sent_at)}
                  {r.claimed_at ? ` · claimed ${shortDate(r.claimed_at)}` : r.viewed_at ? ` · viewed ${shortDate(r.viewed_at)}` : ""}
                  {r.expires_at && r.live ? ` · valid until ${shortDate(r.expires_at)}` : ""}
                </p>
              </div>
              <OfferStatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
