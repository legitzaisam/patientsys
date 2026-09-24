import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Send } from "lucide-react";
import { PatientAvatar } from "@/components/patient-avatar";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { SOURCE_LABEL, type InsightsListRow } from "@/lib/insights.server";
import { SendOfferDialog, type SendOfferPatient } from "@/components/offers/send-offer-dialog";

const CHIP =
  "shrink-0 rounded-full border border-edge bg-glass-2 px-2.5 py-1 text-[11px] font-medium text-ink-2 shadow-inset-hi hover:border-accent-line hover:bg-accent-wash hover:text-foreground";

export function ActionList({
  title,
  subtitle,
  rows,
  empty,
  kind,
  canSendOffers = false,
}: {
  title: string;
  subtitle: string;
  rows: InsightsListRow[];
  empty: string;
  kind: "waiting" | "consulted";
  /** Shows Send offer per row and the multi-select bulk send. */
  canSendOffers?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [offerFor, setOfferFor] = useState<SendOfferPatient[] | null>(null);

  const patientRows = rows.filter((r) => r.patientId);
  const toPatient = (row: InsightsListRow): SendOfferPatient => ({
    id: row.patientId!,
    first_name: row.firstName,
    last_name: row.lastName,
    email: row.email ?? null,
  });
  const allSelected = patientRows.length > 0 && patientRows.every((r) => selected.has(r.patientId!));

  return (
    <Card id={kind === "waiting" ? "insights-waiting" : "insights-consulted"} className="scroll-mt-20 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="section-title">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        {canSendOffers && patientRows.length > 0 ? (
          <div className="flex shrink-0 items-center gap-2">
            {selected.size > 0 ? (
              <button
                type="button"
                className={`${CHIP} inline-flex items-center gap-1`}
                onClick={() => setOfferFor(patientRows.filter((r) => selected.has(r.patientId!)).map(toPatient))}
                data-qc="insights-bulk-send-offer"
              >
                <Send className="h-3 w-3" />
                Send offer · {selected.size}
              </button>
            ) : null}
            <label className="flex items-center gap-1.5 text-2xs text-muted-foreground">
              <Checkbox
                aria-label={`Select everyone in ${title}`}
                checked={allSelected}
                onCheckedChange={(checked) =>
                  setSelected(checked ? new Set(patientRows.map((r) => r.patientId!)) : new Set())
                }
              />
              All
            </label>
          </div>
        ) : null}
      </div>
      <ul className="mt-3">
        {rows.map((row) => {
          const name = `${row.lastName}, ${row.title ? `${row.title} ` : ""}${row.firstName}`.trim();
          const meta =
            kind === "waiting"
              ? `${row.daysWaiting ?? 0}d waiting · ${SOURCE_LABEL[row.source]}${row.interest ? ` · ${row.interest}` : ""}`
              : `${row.lastConsultAt ? new Date(row.lastConsultAt).toLocaleDateString("en-GB") : "Consulted"} · ${SOURCE_LABEL[row.source]}`;
          return (
            <li key={`${row.patientId ?? row.leadId}-${row.email ?? row.firstName}`}>
              <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[rgba(47,63,102,0.08)]">
                {canSendOffers ? (
                  row.patientId ? (
                    <Checkbox
                      aria-label={`Select ${row.firstName} ${row.lastName}`}
                      checked={selected.has(row.patientId)}
                      onCheckedChange={(checked) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (checked) next.add(row.patientId!);
                          else next.delete(row.patientId!);
                          return next;
                        })
                      }
                    />
                  ) : (
                    <span className="h-4 w-4 shrink-0" aria-hidden />
                  )
                ) : null}
                <PatientAvatar
                  patientId={row.patientId ?? row.leadId ?? row.email ?? row.firstName}
                  name={`${row.firstName} ${row.lastName}`}
                  photoUrl={row.avatarUrl}
                  size="sm"
                />
                <div className="min-w-0 flex-1">
                  {row.patientId ? (
                    <Link
                      to="/patients/$id"
                      params={{ id: row.patientId }}
                      className="truncate text-sm font-medium text-foreground hover:text-accent-ink"
                    >
                      {name}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium text-foreground">{name}</p>
                  )}
                  <p className="truncate text-2xs text-muted-foreground">
                    {meta}
                    {!row.patientId && canSendOffers ? " · needs a patient record before an offer can go" : ""}
                  </p>
                </div>
                {row.patientId && canSendOffers ? (
                  <button
                    type="button"
                    className={CHIP}
                    onClick={() => setOfferFor([toPatient(row)])}
                    data-qc="insights-send-offer"
                  >
                    Send offer
                  </button>
                ) : null}
                {row.patientId &&
                  (kind === "waiting" ? (
                    <Link to="/schedule" className={CHIP}>
                      Schedule
                    </Link>
                  ) : (
                    <Link to="/patients/$id" params={{ id: row.patientId }} className={CHIP}>
                      Open
                    </Link>
                  ))}
              </div>
            </li>
          );
        })}
        {rows.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">{empty}</li>}
      </ul>
      {canSendOffers ? (
        <SendOfferDialog
          open={Boolean(offerFor)}
          onOpenChange={(o) => !o && setOfferFor(null)}
          patients={offerFor ?? []}
          source="insights"
          onSent={() => setSelected(new Set())}
        />
      ) : null}
    </Card>
  );
}
