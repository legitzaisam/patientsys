import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Archive, Check, Clock3, History, Megaphone, Pencil, Plus, Users } from "lucide-react";
import {
  archiveOfferTemplate,
  getClinicDetails,
  listOfferTemplates,
  previewOfferStage,
  setOfferAutomation,
} from "@/lib/clinic.functions";
import { moneyWhole } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { useIdentity } from "@/lib/use-identity";
import { can } from "@/lib/permissions";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { RouteErrorBoundary } from "@/components/route-error-boundary";
import { OfferTemplateEditor } from "@/components/offers/offer-template-editor";
import { OfferAutomationDialog } from "@/components/offers/offer-automation-dialog";
import { OfferSendHistoryDialog } from "@/components/offers/offer-send-history";
import { shortDate, type OfferTemplateRow } from "@/lib/offers/shape";
import { OFFER_STAGES, STAGE_LABEL, STAGE_META, type OfferStage, type TemplateStage } from "@/lib/offers/stages";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/offers")({
  head: () => ({
    meta: [
      { title: "Offers — Aetheria" },
      {
        name: "description",
        content: "Design offer templates for each patient stage, switch automation on and see who claimed what.",
      },
      { property: "og:title", content: "Offers — Aetheria" },
      { property: "og:description", content: "Stage-based offers, templates and sends." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OffersPage,
  errorComponent: ({ error, reset }) => <RouteErrorBoundary error={error} reset={reset} area="offers" />,
});

type EditorState = { open: boolean; template: OfferTemplateRow | null; stage: TemplateStage };

function OffersPage() {
  const { data: identity } = useIdentity();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const allowed = Boolean(identity && can(identity, "offers.manage"));

  const fetchTemplates = useServerFn(listOfferTemplates);
  const fetchClinic = useServerFn(getClinicDetails);
  const { data: templates } = useQuery({
    queryKey: ["offer-templates"],
    queryFn: () => fetchTemplates(),
    enabled: allowed,
  });
  const { data: clinic } = useQuery({
    queryKey: ["clinic-details"],
    queryFn: () => fetchClinic(),
    enabled: allowed,
  });

  const [editor, setEditor] = useState<EditorState>({ open: false, template: null, stage: "custom" });
  const [automationFor, setAutomationFor] = useState<OfferTemplateRow | null>(null);
  const [historyFor, setHistoryFor] = useState<OfferTemplateRow | null>(null);

  const archive = useMutation({
    mutationFn: useServerFn(archiveOfferTemplate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offer-templates"] });
      toast.success("Template archived");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (identity && !can(identity, "offers.manage")) navigate({ to: "/dashboard", replace: true });
  }, [identity, navigate]);

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!can(identity, "offers.manage")) return null;

  const rows = (templates ?? []) as OfferTemplateRow[];
  const byStage = new Map<TemplateStage, OfferTemplateRow>();
  for (const t of rows) if (t.stage !== "custom") byStage.set(t.stage, t);
  const customs = rows.filter((t) => t.stage === "custom");
  const clinicName = (clinic as { name?: string } | null)?.name ?? "Your clinic";
  const stagesTaken = [...byStage.keys()];

  return (
    <AppShell identity={identity}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Offers</h1>
          <p className="page-subtitle">
            One offer per stage of a patient's journey, sent automatically when you switch it on, plus one-off offers you send by hand.
          </p>
        </div>
        <Button onClick={() => setEditor({ open: true, template: null, stage: "custom" })} data-qc="offer-new">
          <Plus className="h-4 w-4" />
          New template
        </Button>
      </div>

      <section className="mt-6">
        <div className="mb-3">
          <h2 className="section-title">Stage offers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Patients move through these stages on their own. Each stage can carry one offer; switch it on and it goes out on the daily run, once per patient.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-qc="offer-stages">
          {OFFER_STAGES.map((stage) => (
            <StageCard
              key={stage}
              stage={stage}
              template={byStage.get(stage) ?? null}
              enabled={allowed}
              onCreate={() => setEditor({ open: true, template: null, stage })}
              onEdit={(t) => setEditor({ open: true, template: t, stage })}
              onAutomation={(t) => setAutomationFor(t)}
              onHistory={(t) => setHistoryFor(t)}
              onArchive={(t) => archive.mutate({ data: { id: t.id } })}
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="section-title">One-off templates</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sent by hand from a patient's record, the patient list or the Insights lists. They never run automatically.
            </p>
          </div>
        </div>
        {customs.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No one-off templates yet. Use <span className="font-semibold text-foreground">New template</span> and pick the One-off stage.
          </Card>
        ) : (
          <div
            className={cn("grid grid-cols-1 gap-4", customs.length > 1 && "md:grid-cols-2")}
            data-qc="offer-customs"
            data-cols={customs.length > 1 ? "2" : "1"}
          >
            {customs.map((t) => (
              <Card key={t.id} className="flex flex-col gap-3 p-5" data-qc="offer-template">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.value_text ?? t.headline}</p>
                </div>
                <Results template={t} />
                <TemplateActions
                  template={t}
                  onEdit={() => setEditor({ open: true, template: t, stage: "custom" })}
                  onHistory={() => setHistoryFor(t)}
                  onArchive={() => archive.mutate({ data: { id: t.id } })}
                />
              </Card>
            ))}
          </div>
        )}
      </section>

      <OfferTemplateEditor
        open={editor.open}
        onOpenChange={(open) => setEditor((s) => ({ ...s, open }))}
        template={editor.template}
        stage={editor.stage}
        stagesTaken={stagesTaken}
        clinicName={clinicName}
      />
      <OfferAutomationDialog open={Boolean(automationFor)} onOpenChange={(o) => !o && setAutomationFor(null)} template={automationFor} />
      <OfferSendHistoryDialog open={Boolean(historyFor)} onOpenChange={(o) => !o && setHistoryFor(null)} template={historyFor} />
    </AppShell>
  );
}

/** Results per offer: sent → claimed → booked → £ revenue, from `offerResults`. */
function Results({ template }: { template: OfferTemplateRow }) {
  const r = template.results ?? { sent: 0, claimed: 0, booked: 0, revenue: 0 };
  const steps: { id: string; label: string; value: string }[] = [
    { id: "sent", label: "sent", value: String(r.sent) },
    { id: "claimed", label: "claimed", value: String(r.claimed) },
    { id: "booked", label: "booked", value: String(r.booked) },
    { id: "revenue", label: "revenue", value: moneyWhole(r.revenue) },
  ];
  return (
    <div
      className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-2xl border border-edge bg-glass-2 px-3 py-2 text-xs text-muted-foreground shadow-inset-hi"
      data-qc="offer-results"
      title="Booked: a booking made after claiming. Revenue: treatments performed after the claim, within the offer's validity plus 90 days."
    >
      {steps.map((s, i) => (
        <span key={s.id} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>→</span>}
          <span>
            <span
              className={cn(
                "font-semibold",
                s.id === "revenue" ? "text-accent-ink" : "text-foreground",
              )}
              data-qc={`metric:offers.results.${template.id}.${s.id}`}
            >
              {s.value}
            </span>{" "}
            {s.label}
          </span>
        </span>
      ))}
    </div>
  );
}

/** The wait before the automation sends, editable on the card. */
function StageDelay({
  template,
  fallbackDays,
}: {
  template: OfferTemplateRow | null;
  fallbackDays: number;
}) {
  const queryClient = useQueryClient();
  const current = template?.automation_delay_days ?? fallbackDays;
  const [value, setValue] = useState<number>(current);
  useEffect(() => setValue(current), [current]);
  const save = useMutation({
    mutationFn: useServerFn(setOfferAutomation),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offer-templates"] });
      queryClient.invalidateQueries({ queryKey: ["offer-preview"] });
      toast.success("Wait updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const dirty = template !== null && value !== current;
  // Blur and the tick both commit; one save per edit.
  const inFlight = useRef(false);
  const commit = () => {
    if (!template || !dirty || inFlight.current) return;
    inFlight.current = true;
    save.mutate(
      { data: { id: template.id, enabled: template.automation_enabled, delay_days: value } },
      {
        onSettled: () => {
          inFlight.current = false;
        },
      },
    );
  };
  if (!template) {
    return (
      <p className="text-sm font-semibold text-foreground">
        {fallbackDays} {fallbackDays === 1 ? "day" : "days"}{" "}
        <span className="font-normal text-muted-foreground">wait</span>
      </p>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min={0}
        max={365}
        value={value}
        onChange={(e) => setValue(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
        }}
        aria-label={`${template.name}: days to wait before sending`}
        className="h-8 w-16 px-2 text-sm font-semibold"
        data-qc="offer-stage-delay"
      />
      <span className="text-sm text-muted-foreground">{value === 1 ? "day" : "days"} wait</span>
      {dirty && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label="Save wait"
          disabled={save.isPending}
          onClick={commit}
          data-qc="offer-stage-delay-save"
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function TemplateActions({
  template,
  onEdit,
  onHistory,
  onArchive,
}: {
  template: OfferTemplateRow;
  onEdit: () => void;
  onHistory: () => void;
  onArchive: () => void;
}) {
  const [confirmArchive, setConfirmArchive] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Archive "${template.name}"?`}
        description="It leaves the Offers page and stops sending. Offers already sent stay as they are."
        confirmLabel="Archive"
        destructive
        qc="offer-archive-confirm"
        onConfirm={() => {
          setConfirmArchive(false);
          onArchive();
        }}
      />
      <Button variant="outline" size="sm" onClick={onEdit} data-qc="offer-edit">
        <Pencil className="h-3.5 w-3.5" />
        Edit
      </Button>
      <Button variant="ghost" size="sm" onClick={onHistory}>
        <History className="h-3.5 w-3.5" />
        Who received it
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="ml-auto text-muted-foreground"
        onClick={() => setConfirmArchive(true)}
        data-qc="offer-archive"
      >
        <Archive className="h-3.5 w-3.5" />
        Archive
      </Button>
    </div>
  );
}

function StageCard({
  stage,
  template,
  enabled,
  onCreate,
  onEdit,
  onAutomation,
  onHistory,
  onArchive,
}: {
  stage: OfferStage;
  template: OfferTemplateRow | null;
  enabled: boolean;
  onCreate: () => void;
  onEdit: (t: OfferTemplateRow) => void;
  onAutomation: (t: OfferTemplateRow) => void;
  onHistory: (t: OfferTemplateRow) => void;
  onArchive: (t: OfferTemplateRow) => void;
}) {
  const fetchPreview = useServerFn(previewOfferStage);
  const { data: preview } = useQuery({
    queryKey: ["offer-preview", stage, template?.automation_delay_days ?? STAGE_META[stage].defaultDelayDays],
    queryFn: () =>
      fetchPreview({ data: { stage, delay_days: template?.automation_delay_days ?? STAGE_META[stage].defaultDelayDays } }),
    enabled,
    staleTime: 60_000,
  });
  const meta = STAGE_META[stage];
  const on = Boolean(template?.automation_enabled);
  return (
    <Card className={cn("flex flex-col gap-4 p-5", on && "bg-accent-soft/40")} data-qc={`offer-stage-${stage}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
              <Megaphone className="h-4 w-4" />
            </span>
            <h3 className="text-base font-semibold tracking-[-0.012em] text-foreground">{STAGE_LABEL[stage]}</h3>
          </div>
          <p className="mt-2 text-sm text-ink-2">{meta.meaning}</p>
        </div>
        {template ? (
          <label className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
            <Switch
              checked={on}
              onCheckedChange={() => onAutomation(template)}
              aria-label={`${STAGE_LABEL[stage]} automation`}
              data-qc="offer-automation-switch"
            />
            {on ? "On" : "Off"}
          </label>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-edge bg-glass-2 p-3 shadow-inset-hi">
        <div className="flex items-start gap-2">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground" data-qc="offer-stage-count">
              <span data-qc={`metric:offers.stage.${stage}`}>
                {preview ? preview.counts[stage] : "—"}
              </span>{" "}
              <span className="font-normal text-muted-foreground">in stage</span>
            </p>
            <p className="text-xs text-muted-foreground" data-qc="offer-stage-subset">
              {meta.subset}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {preview
                ? `${preview.willSend.length} would receive it today${preview.portalOnly.length > 0 ? `, ${preview.portalOnly.length} by portal only` : ""}`
                : "Counting…"}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
          <div className="min-w-0">
            <StageDelay template={template} fallbackDays={meta.defaultDelayDays} />
            <p className="mt-1 text-xs text-muted-foreground">
              {template?.last_automation_at ? `Last run ${shortDate(template.last_automation_at)}` : "Not run yet"}
              {template ? " · Sends once the patient has been in the stage this long." : ""}
            </p>
          </div>
        </div>
      </div>

      {template ? (
        <>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{template.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{template.value_text ?? template.headline}</p>
          </div>
          <Results template={template} />
          <TemplateActions
            template={template}
            onEdit={() => onEdit(template)}
            onHistory={() => onHistory(template)}
            onArchive={() => onArchive(template)}
          />
        </>
      ) : (
        <Button variant="outline" size="sm" className="self-start" onClick={onCreate} data-qc="offer-stage-create">
          <Plus className="h-3.5 w-3.5" />
          Design this offer
        </Button>
      )}
    </Card>
  );
}
