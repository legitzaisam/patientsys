import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listOfferSends } from "@/lib/clinic.functions";
import {
  OFFER_SOURCE_LABEL,
  OFFER_STATUS_LABEL,
  shortDate,
  type OfferTemplateRow,
  type PatientOfferView,
} from "@/lib/offers/shape";

type SendRow = PatientOfferView & { patient_name: string };
import { OfferStatusBadge } from "./offer-status-badge";

/** Who a template went to and what happened, newest first. */
export function OfferSendHistoryDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: OfferTemplateRow | null;
}) {
  const fetchSends = useServerFn(listOfferSends);
  const { data, isLoading } = useQuery({
    queryKey: ["offer-sends", template?.id],
    queryFn: async () => (await fetchSends({ data: { template_id: template!.id } })) as SendRow[],
    enabled: open && Boolean(template),
  });
  if (!template) return null;
  const counts = template.counts ?? {};
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto rounded-xl" data-qc="offer-history">
        <DialogHeader>
          <DialogTitle>{template.name}: who received it</DialogTitle>
          <DialogDescription>
            {(["sent", "viewed", "claimed", "expired"] as const)
              .map((k) => `${counts[k] ?? 0} ${OFFER_STATUS_LABEL[k].toLowerCase()}`)
              .join(" · ")}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-edge">
          {isLoading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (data ?? []).length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Not sent to anyone yet.</p>
          ) : (
            <ul className="divide-y divide-edge">
              {(data ?? []).map((row) => (
                <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <Link
                      to="/patients/$id"
                      params={{ id: row.patient_id }}
                      search={{ tab: "contact" } as never}
                      className="truncate font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      {row.patient_name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {OFFER_SOURCE_LABEL[row.source]} · {shortDate(row.sent_at)}
                      {row.claimed_at ? ` · claimed ${shortDate(row.claimed_at)}` : row.viewed_at ? ` · viewed ${shortDate(row.viewed_at)}` : ""}
                    </p>
                  </div>
                  <OfferStatusBadge status={row.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
