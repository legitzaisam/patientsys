import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Camera,
  ClipboardList,
  FileText,
  Heart,
  Printer,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getTreatmentRecord } from "@/lib/clinic.functions";
import { fieldsFor } from "@/lib/treatment-results";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * A completed treatment as a document: the three pages of the form, the
 * photos and the consent, laid out to read and to print. Opened from the
 * Treatments tab, the Documents tab and the form's done state.
 */
export function TreatmentRecordDialog({
  treatmentId,
  open,
  onOpenChange,
}: {
  treatmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const fetchRecord = useServerFn(getTreatmentRecord);
  const { data, isLoading, error } = useQuery({
    queryKey: ["treatment-record", treatmentId],
    queryFn: () => fetchRecord({ data: { treatment_id: treatmentId! } }),
    enabled: open && Boolean(treatmentId),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[92vh] w-[min(860px,calc(100vw-2rem))] max-w-none overflow-hidden p-0 print:max-h-none print:w-full print:overflow-visible print:shadow-none sm:rounded-[26px]"
        data-qc="treatment-record"
      >
        <DialogHeader className="border-b border-edge-2 px-6 pb-4 pt-5 print:hidden">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent-ink" aria-hidden />
                Treatment record
              </DialogTitle>
              <DialogDescription>
                {data
                  ? `${data.treatment.name} · ${data.patient.name} · ${formatDate(data.treatment.performedAt)}`
                  : isLoading
                    ? "Loading the record…"
                    : "The saved treatment form for this visit."}
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="print:hidden"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden /> Print
            </Button>
          </div>
        </DialogHeader>
        <div className="max-h-[calc(92vh-6rem)] overflow-y-auto px-6 py-5 print:max-h-none print:overflow-visible">
          {error ? (
            <p className="rounded-xl bg-destructive-bg px-3 py-2 text-sm text-destructive-ink">
              {(error as Error).message}
            </p>
          ) : !data ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <TreatmentRecordView data={data} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Block({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof FileText;
  children: React.ReactNode;
}) {
  return (
    <section className="break-inside-avoid rounded-2xl bg-glass-2 p-4 shadow-inset-hi print:bg-white print:shadow-none print:ring-1 print:ring-black/10">
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-accent-ink" aria-hidden />
        <h3 className="text-xs font-semibold tracking-[0.02em] text-foreground">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-[0.06em] text-ink-3">{label}</p>
      <p className="text-sm text-foreground">{value?.trim() || "—"}</p>
    </div>
  );
}

export function TreatmentRecordView({ data }: { data: any }) {
  const s = data.session;
  const answered = s
    ? Object.entries(s.preChecks as Record<string, { answer: string; note?: string }>)
    : [];
  return (
    <article className="space-y-4 text-foreground" data-qc="treatment-record-body">
      <header className="print:mb-4">
        <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-ink-3">
          Aetheria Skin Clinic · Treatment record
        </p>
        <h2 className="mt-1 text-lg font-semibold">
          {data.treatment.name}
          {data.treatment.treatmentNumber ? (
            <span className="text-muted-foreground"> · #{data.treatment.treatmentNumber}</span>
          ) : null}
        </h2>
        <p className="text-sm text-muted-foreground">
          {data.patient.name}
          {data.patient.reference ? ` · ${data.patient.reference}` : ""}
          {data.patient.dateOfBirth ? ` · DOB ${formatDate(data.patient.dateOfBirth)}` : ""}
        </p>
        <p className="text-sm text-muted-foreground">
          {formatDateTime(data.treatment.performedAt)}
          {data.treatment.practitionerName ? ` · ${data.treatment.practitionerName}` : ""}
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Block title="Consent" icon={ShieldCheck}>
          {data.consent ? (
            <p className="text-sm">
              {data.consent.status === "signed" ? (
                <>
                  <span className="font-semibold text-success-ink">Signed</span>
                  {data.consent.signedName ? ` by ${data.consent.signedName}` : ""}
                  {data.consent.signedAt ? ` on ${formatDateTime(data.consent.signedAt)}` : ""}
                  {data.consent.witnessed ? " · witnessed in clinic" : ""}
                </>
              ) : (
                <span className="text-muted-foreground">
                  {data.consent.title} · {data.consent.status}
                </span>
              )}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              No consent document linked to this treatment.
            </p>
          )}
        </Block>
        <Block title="Results" icon={Sparkles}>
          <ResultRows
            name={data.treatment.name}
            template={data.treatment.resultTemplate}
            stored={s?.results ?? {}}
            fallback={{
              area: data.treatment.area,
              product: data.treatment.product,
              dose: data.treatment.dose,
            }}
          />
          {data.treatment.nextDueAt ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Next due {formatDate(data.treatment.nextDueAt)}
            </p>
          ) : null}
        </Block>
      </div>

      {s ? (
        <Block title="Confirm before starting" icon={ClipboardList}>
          {answered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No checks recorded.</p>
          ) : (
            <ul className="space-y-1.5">
              {(data.checks as { key: string; label: string }[]).map((c) => {
                const a = s.preChecks[c.key];
                if (!a) return null;
                return (
                  <li key={c.key} className="flex items-start gap-2 text-sm">
                    <span
                      className={cn(
                        "mt-0.5 inline-flex h-5 min-w-[2.4rem] shrink-0 items-center justify-center rounded-full px-1.5 text-2xs font-semibold",
                        a.answer === "yes"
                          ? "bg-destructive-bg text-destructive-ink"
                          : "bg-success-bg text-success-ink",
                      )}
                    >
                      {a.answer === "yes" ? "Yes" : a.answer === "no" ? "No" : "N/A"}
                    </span>
                    <span className="min-w-0">
                      {c.label}
                      {a.note ? (
                        <span className="block text-xs text-muted-foreground">{a.note}</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Block>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Block title="Treatment notes" icon={FileText}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {s?.treatmentNotes ?? data.treatment.notes ?? "—"}
          </p>
        </Block>
        <Block title="Visit notes" icon={FileText}>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{s?.visitNotes ?? "—"}</p>
        </Block>
      </div>

      {data.photos.length > 0 ? (
        <Block title="Before and after" icon={Camera}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {data.photos.map((p: any) => (
              <figure key={p.id}>
                {p.url ? (
                  <img src={p.url} alt="" className="h-28 w-full rounded-xl object-cover" />
                ) : (
                  <div className="h-28 rounded-xl bg-glass-hi" />
                )}
                <figcaption className="mt-1 text-2xs text-muted-foreground">
                  <span className="font-semibold capitalize text-foreground">{p.kind}</span> ·{" "}
                  {formatDate(p.takenAt)}
                  {p.caption ? ` · ${p.caption}` : ""}
                </figcaption>
              </figure>
            ))}
          </div>
        </Block>
      ) : null}

      {s ? (
        <Block title="Aftercare read out" icon={Heart}>
          {s.aftercarePoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No aftercare recorded.</p>
          ) : (
            <ul className="space-y-1.5">
              {s.aftercarePoints.map((p: { label: string }, i: number) => (
                <li key={i} className="text-sm leading-relaxed">
                  {p.label}
                </li>
              ))}
            </ul>
          )}
          {s.aftercareExtra ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{s.aftercareExtra}</p>
          ) : null}
          {s.completedAt ? (
            <p className="mt-3 text-2xs text-ink-3">
              Completed {formatDateTime(s.completedAt)}
              {s.startedAt ? ` · started ${formatDateTime(s.startedAt)}` : ""}
            </p>
          ) : null}
        </Block>
      ) : (
        <p className="text-xs text-muted-foreground">
          This treatment was recorded directly, without the treatment form.
        </p>
      )}
    </article>
  );
}

function ResultRows({
  name,
  template,
  stored,
  fallback,
}: {
  name: string;
  template?: string | null;
  stored: Record<string, string | undefined>;
  fallback: { area?: string | null; product?: string | null; dose?: string | null };
}) {
  const fields = fieldsFor(name, template);
  const specific = fields.filter(
    (f) => f.key !== "area" && f.key !== "product" && f.key !== "dose",
  );
  const hasSpecific = specific.some((f) => stored[f.key]?.trim());
  if (!hasSpecific) {
    return (
      <div className="grid grid-cols-3 gap-3">
        <Row label="Area" value={fallback.area ?? null} />
        <Row label="Product" value={fallback.product ?? null} />
        <Row label="Dose" value={fallback.dose ?? null} />
      </div>
    );
  }
  const filled = fields.filter((f) => stored[f.key]?.trim());
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {filled.map((f) => (
        <Row key={f.key} label={f.label} value={stored[f.key] ?? null} />
      ))}
    </div>
  );
}
