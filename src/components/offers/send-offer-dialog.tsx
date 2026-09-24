import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getClinicDetails, listOfferTemplates, sendOffer } from "@/lib/clinic.functions";
import type { OfferTemplateRow } from "@/lib/offers/shape";
import { describeOfferChannels, type SendResult } from "@/lib/offers/send";
import { STAGE_LABEL, offerExpiry, renderOffer, type OfferSource } from "@/lib/offers/stages";
import { OfferCardPreview } from "./offer-preview";

export type SendOfferPatient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  marketing_opt_in?: boolean | null;
  email_opt_in?: boolean | null;
  sms_opt_in?: boolean | null;
  reminders_opt_in?: boolean | null;
  unsubscribed_at?: string | null;
};

function hasConsentFields(p: SendOfferPatient) {
  return typeof p.marketing_opt_in === "boolean";
}

/**
 * Put an offer in front of one patient or many. Used from the patient record
 * (one_off), the patient list (bulk) and the Insights lists (insights). The
 * PECR position is stated before you press Send; the result lists who was
 * sent, who got a portal-only card and who was skipped, with the reason.
 */
export function SendOfferDialog({
  open,
  onOpenChange,
  patients,
  source,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patients: SendOfferPatient[];
  source: Exclude<OfferSource, "automation">;
  onSent?: ((result: SendResult) => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const fetchTemplates = useServerFn(listOfferTemplates);
  const fetchClinic = useServerFn(getClinicDetails);
  const { data: templates } = useQuery({
    queryKey: ["offer-templates"],
    queryFn: async () => (await fetchTemplates()) as OfferTemplateRow[],
    enabled: open,
  });
  const { data: clinic } = useQuery({ queryKey: ["clinic-details"], queryFn: () => fetchClinic(), enabled: open });
  const clinicName = (clinic as { name?: string } | null)?.name ?? "Your clinic";

  const [templateId, setTemplateId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<SendResult | null>(null);

  useEffect(() => {
    if (open) {
      setResult(null);
      setMessage("");
    }
  }, [open]);
  useEffect(() => {
    if (templates && templates.length > 0 && !templates.some((t) => t.id === templateId)) {
      setTemplateId((templates.find((t) => t.stage === "custom") ?? templates[0]!).id);
    }
  }, [templates, templateId]);

  const template = (templates ?? []).find((t) => t.id === templateId) ?? null;
  const single = patients.length === 1 ? patients[0]! : null;

  const rendered = useMemo(() => {
    if (!template) return null;
    const expiresAt = offerExpiry(new Date(), template.valid_days);
    return {
      expiresAt,
      ...renderOffer(template, single ?? { first_name: "there" }, {
        clinicName,
        claimUrl: "#",
        personalLine: message || null,
        expiresAt,
      }),
    };
  }, [template, single, clinicName, message]);

  const pecr = useMemo(() => {
    if (!template) return null;
    if (single && hasConsentFields(single)) return describeOfferChannels(single, template);
    return null;
  }, [template, single]);

  const send = useMutation({
    mutationFn: useServerFn(sendOffer),
    onSuccess: (raw) => {
      const r = raw as SendResult;
      setResult(r);
      onSent?.(r);
      for (const p of patients) {
        queryClient.invalidateQueries({ queryKey: ["patient-offers", p.id] });
        queryClient.invalidateQueries({ queryKey: ["communications", p.id] });
      }
      queryClient.invalidateQueries({ queryKey: ["offer-templates"] });
      const portalOnly = r.sent.filter((s) => s.channels.length === 0).length;
      if (r.sent.length === 0) toast.error(r.skipped[0]?.reason ?? "Nothing was sent.");
      else if (r.skipped.length === 0 && portalOnly === 0) toast.success(r.sent.length === 1 ? "Offer sent" : `Offer sent to ${r.sent.length} patients`);
      else toast.success(`Offer sent to ${r.sent.length}; ${r.skipped.length} skipped${portalOnly ? `, ${portalOnly} portal only` : ""}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const firstName = single ? (single.first_name ?? "").trim() || "This patient" : null;
  const who =
    single
      ? `${single.first_name ?? ""} ${single.last_name ?? ""}`.trim() || "this patient"
      : `${patients.length} patients`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-xl" data-qc="send-offer">
        <DialogHeader>
          <DialogTitle>
            {result
              ? result.sent.length === 0
                ? "Nothing was sent"
                : `Offer sent to ${result.sent.length === 1 ? result.sent[0]!.name : `${result.sent.length} patients`}`
              : `Send an offer to ${who}`}
          </DialogTitle>
          <DialogDescription>
            {result
              ? "Each patient's record shows this under Offers on the Contact tab."
              : "Marketing email goes only to patients who have opted in; everyone selected still gets the card on their portal home."}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <SendResultView result={result} />
        ) : (
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
            <div className="space-y-4">
              <div className="field-stack">
                <Label htmlFor="offer-template">Offer</Label>
                <select
                  id="offer-template"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-edge-2 bg-glass-2 px-3 text-sm shadow-inset-hi"
                  data-qc="send-offer-template"
                >
                  {(templates ?? []).length === 0 ? <option value="">No templates yet</option> : null}
                  {(templates ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {STAGE_LABEL[t.stage]}
                      {t.value_text ? ` · ${t.value_text}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field-stack">
                <Label htmlFor="offer-message">A personal line (optional)</Label>
                <Textarea
                  id="offer-message"
                  rows={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 600))}
                  placeholder={single ? `Lovely to see you last week, ${firstName}.` : "Added above the offer in every email."}
                />
              </div>

              {template ? (
                <div
                  className="flex items-start gap-2 rounded-2xl border border-edge bg-glass-2 p-3 text-sm shadow-inset-hi"
                  data-qc="send-offer-pecr"
                >
                  {pecr?.blocked ? (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  ) : (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" />
                  )}
                  <div className="min-w-0">
                    {pecr ? (
                      pecr.blocked ? (
                        pecr.portalOnly ? (
                          <p>
                            <span className="font-semibold text-foreground">{pecr.blocked.replace(/^This patient/, firstName ?? "This patient")}</span>{" "}
                            This offer can only go to {firstName}'s portal home.
                          </p>
                        ) : pecr.channels.length === 0 ? (
                          <p className="text-foreground">
                            Nothing can be sent: {pecr.blocked} and this template does not show on the portal.
                          </p>
                        ) : (
                          <p>
                            Goes by <span className="font-semibold text-foreground">{pecr.channels.join(" and ")}</span>.{" "}
                            <span className="text-muted-foreground">{pecr.blocked}</span>
                          </p>
                        )
                      ) : (
                        <p>
                          Goes by <span className="font-semibold text-foreground">{pecr.channels.join(", ")}</span>.
                        </p>
                      )
                    ) : (
                      <p className="text-ink-2">
                        {[
                          template.send_email ? "email to those opted in" : null,
                          template.send_sms ? "SMS to those opted in" : null,
                          template.show_in_portal ? "a card on every selected patient's portal home" : null,
                        ]
                          .filter(Boolean)
                          .join(", ")
                          .replace(/^./, (c) => c.toUpperCase())}
                        . Anyone who cannot receive it is listed afterwards.
                      </p>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {rendered && template ? (
              <OfferCardPreview card={rendered.card} expiresAt={rendered.expiresAt} clinicName={clinicName} status="new" />
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {result ? "Done" : "Cancel"}
          </Button>
          {!result ? (
            <Button
              type="button"
              disabled={!template || send.isPending || patients.length === 0 || (pecr ? pecr.channels.length === 0 : false)}
              onClick={() =>
                send.mutate({
                  data: {
                    template_id: templateId,
                    patient_ids: patients.map((p) => p.id),
                    message,
                    source,
                    app_origin: typeof window !== "undefined" ? window.location.origin : "",
                  },
                })
              }
              data-qc="send-offer-submit"
            >
              <Send className="h-4 w-4" />
              {send.isPending ? "Sending…" : patients.length > 1 ? `Send to ${patients.length}` : "Send offer"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SendResultView({ result }: { result: SendResult }) {
  return (
    <div className="space-y-3" data-qc="send-offer-result">
      <div className="rounded-2xl border border-edge bg-glass-2 shadow-inset-hi">
        <p className="border-b border-edge px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Sent · {result.sent.length}
        </p>
        {result.sent.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">Nobody.</p>
        ) : (
          <ul className="max-h-[220px] divide-y divide-edge overflow-y-auto">
            {result.sent.map((s) => (
              <li key={s.patient_id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 truncate font-medium text-foreground">{s.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {s.channels.length > 0 ? `${s.channels.map((c) => (c === "sms" ? "SMS" : c)).join(" + ")} + portal` : s.note ?? "Portal only"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {result.skipped.length > 0 ? (
        <div className="rounded-2xl border border-edge">
          <p className="border-b border-edge px-4 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Skipped · {result.skipped.length}
          </p>
          <ul className="max-h-[180px] divide-y divide-edge overflow-y-auto">
            {result.skipped.map((s) => (
              <li key={s.patient_id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="min-w-0 truncate text-ink-2">{s.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{s.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
