import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Archive, Clock3, History, Megaphone, Pencil, Plus, Users } from "lucide-react";
import { archiveOfferTemplate, getClinicDetails, listOfferTemplates, previewOfferStage } from "@/lib/clinic.functions";
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
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2" data-qc="offer-customs">
            {customs.map((t) => (
              <Card key={t.id} className="flex flex-col gap-3 p-5" data-qc="offer-template">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{t.value_text ?? t.headline}</p>
                  </div>
                  <Counts template={t} />
                </div>
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

function Counts({ template }: { template: OfferTemplateRow }) {
  const c = template.counts ?? {};
  const total = (c["sent"] ?? 0) + (c["viewed"] ?? 0) + (c["claimed"] ?? 0) + (c["expired"] ?? 0);
  return (
    <div className="shrink-0 text-right text-xs text-muted-foreground">
      <p>
        <span className="font-semibold text-foreground">{total}</span> sent
      </p>
      <p>
        <span className="font-semibold text-accent-ink">{c["claimed"] ?? 0}</span> claimed
      </p>
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
  return (
    <div className="flex flex-wrap gap-2">
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
        onClick={() => {
          if (window.confirm(`Archive "${template.name}"? Offers already sent stay as they are.`)) onArchive();
        }}
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
          <div>
            <p className="text-sm font-semibold text-foreground" data-qc="offer-stage-count">
              {preview ? preview.counts[stage] : "—"} <span className="font-normal text-muted-foreground">in stage</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {preview ? `${preview.willSend.length} would receive it today` : "Counting…"}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {template ? `${template.automation_delay_days} ${template.automation_delay_days === 1 ? "day" : "days"}` : `${meta.defaultDelayDays} days`}{" "}
              <span className="font-normal text-muted-foreground">wait</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {template?.last_automation_at ? `Last run ${shortDate(template.last_automation_at)}` : "Not run yet"}
            </p>
          </div>
        </div>
      </div>

      {template ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{template.name}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{template.value_text ?? template.headline}</p>
            </div>
            <Counts template={template} />
          </div>
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
