import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { draftOfferTemplate, saveOfferTemplate } from "@/lib/clinic.functions";
import { DEMO_MODE } from "@/lib/demo/enabled";
import type { DraftResult } from "@/lib/offers/draft.server";
import type { OfferImagePlacement } from "@/lib/offers/picture";
import type { OfferTemplateRow } from "@/lib/offers/shape";
import {
  OFFER_STAGES,
  STAGE_DEFAULT_DRAFT,
  STAGE_LABEL,
  STAGE_META,
  offerExpiry,
  renderOffer,
  type TemplateStage,
} from "@/lib/offers/stages";
import { OfferCardPreview, OfferEmailPreview } from "./offer-preview";
import { OfferImageField } from "./offer-image-field";

type Form = {
  name: string;
  stage: TemplateStage;
  subject: string;
  headline: string;
  body: string;
  value_text: string;
  code: string;
  cta_label: string;
  valid_days: number;
  send_email: boolean;
  send_sms: boolean;
  show_in_portal: boolean;
  image_url: string | null;
  image_placement: OfferImagePlacement;
};

function formFor(template: OfferTemplateRow | null, stage: TemplateStage): Form {
  if (template) {
    return {
      name: template.name,
      stage: template.stage,
      subject: template.subject,
      headline: template.headline,
      body: template.body,
      value_text: template.value_text ?? "",
      code: template.code ?? "",
      cta_label: template.cta_label,
      valid_days: template.valid_days,
      send_email: template.send_email,
      send_sms: template.send_sms,
      show_in_portal: template.show_in_portal,
      image_url: template.image_url ?? null,
      image_placement: template.image_placement ?? "top",
    };
  }
  const d = STAGE_DEFAULT_DRAFT[stage];
  return {
    name: d.name,
    stage,
    subject: d.subject,
    headline: d.headline,
    body: d.body,
    value_text: d.value_text,
    code: "",
    cta_label: d.cta_label,
    valid_days: 30,
    send_email: true,
    send_sms: false,
    show_in_portal: true,
    image_url: null,
    image_placement: "top",
  };
}

const TONES = [
  { key: "warm" as const, label: "Warm" },
  { key: "playful" as const, label: "Playful" },
  { key: "clinical" as const, label: "Clinical" },
];

/**
 * Design one offer: the fields on the left, what the patient receives on the
 * right, updating as you type. Draft with AI fills the fields; nothing is
 * sent from here.
 */
export function OfferTemplateEditor({
  open,
  onOpenChange,
  template,
  stage,
  stagesTaken,
  clinicName,
  previewName = "Olivia",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing an existing template, or null for a new one. */
  template: OfferTemplateRow | null;
  /** The stage a new template is for. */
  stage: TemplateStage;
  /** Stages that already have a live template (new templates cannot pick them). */
  stagesTaken: TemplateStage[];
  clinicName: string;
  previewName?: string;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() => formFor(template, stage));
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState<"warm" | "playful" | "clinical">("warm");
  const [previewTab, setPreviewTab] = useState<"email" | "portal">("email");

  useEffect(() => {
    if (open) {
      setForm(formFor(template, stage));
      setBrief("");
    }
  }, [open, template, stage]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = useMutation({
    mutationFn: useServerFn(saveOfferTemplate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offer-templates"] });
      toast.success(template ? "Template saved" : "Template created");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const draft = useMutation({
    mutationFn: useServerFn(draftOfferTemplate),
    onSuccess: (raw) => {
      const result = raw as DraftResult;
      setForm((f) => ({
        ...f,
        name: template ? f.name : result.name,
        subject: result.subject,
        headline: result.headline,
        body: result.body,
        value_text: result.value_text,
        cta_label: result.cta_label,
      }));
      toast.success(
        result.source === "model" ? "Draft ready — edit anything before you save" : "Draft ready from the stage default — edit anything before you save",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rendered = useMemo(() => {
    const expiresAt = offerExpiry(new Date(), form.valid_days);
    return {
      expiresAt,
      ...renderOffer(
        {
          subject: form.subject,
          headline: form.headline,
          body: form.body,
          value_text: form.value_text || null,
          code: form.code || null,
          cta_label: form.cta_label,
          valid_days: form.valid_days,
          image_url: form.image_url,
          image_placement: form.image_placement,
        },
        { first_name: previewName, last_name: "" },
        { clinicName, claimUrl: "https://example.invalid/portal?next=%2Fmy-record%3Foffer%3Dpreview", expiresAt },
      ),
    };
  }, [form, clinicName, previewName]);

  const canPickStage = !template;
  const stageOptions: TemplateStage[] = [...OFFER_STAGES, "custom"];

  async function persistImage(url: string | null) {
    if (!url || DEMO_MODE || !url.startsWith("data:")) return url;
    try {
      const blob = await (await fetch(url)).blob();
      const path = `offers/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage.from("offer-images").upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (error) return url;
      return supabase.storage.from("offer-images").getPublicUrl(path).data.publicUrl;
    } catch {
      return url;
    }
  }

  async function submit() {
    if (!form.name.trim() || !form.subject.trim() || !form.headline.trim() || !form.body.trim()) {
      toast.error("Name, subject, headline and body are needed.");
      return;
    }
    if (!form.send_email && !form.send_sms && !form.show_in_portal) {
      toast.error("Choose at least one way to deliver the offer.");
      return;
    }
    const imageUrl = await persistImage(form.image_url);
    save.mutate({
      data: {
        ...(template ? { id: template.id } : {}),
        name: form.name.trim(),
        stage: form.stage,
        subject: form.subject.trim(),
        headline: form.headline.trim(),
        body: form.body.trim(),
        value_text: form.value_text.trim(),
        code: form.code.trim(),
        cta_label: form.cta_label.trim(),
        valid_days: form.valid_days,
        send_email: form.send_email,
        send_sms: form.send_sms,
        show_in_portal: form.show_in_portal,
        image_url: imageUrl,
        image_placement: imageUrl ? form.image_placement : null,
      },
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[1040px]" data-qc="offer-editor">
        <SheetHeader className="border-b border-edge px-6 py-4 text-left">
          <SheetTitle>{template ? `Edit ${template.name}` : "Design your offer"}</SheetTitle>
          <SheetDescription>
            {form.stage === "custom"
              ? "A one-off offer you send by hand from a patient's record, the patient list or Insights."
              : `${STAGE_LABEL[form.stage]}: ${STAGE_META[form.stage].meaning}`}
          </SheetDescription>
        </SheetHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Fields */}
          <div className="space-y-5 border-edge px-6 py-5 lg:border-r">
            <div className="rounded-2xl border border-edge bg-glass-2 p-4 shadow-inset-hi">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent-ink" />
                <p className="text-sm font-semibold text-foreground">Draft with AI</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Tell it the offer in a sentence. It fills the fields below; you edit before saving.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="e.g. 20% off a course of three peels booked before the end of October"
                  aria-label="Brief for the AI draft"
                  className="flex-1"
                />
                <div className="flex h-[34px] shrink-0 items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi">
                  {TONES.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTone(t.key)}
                      className={
                        "h-7 cursor-pointer rounded-full px-3.5 text-xs tracking-[0.02em] transition-colors " +
                        (tone === t.key
                          ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                          : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]")
                      }
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3"
                disabled={draft.isPending}
                onClick={() => draft.mutate({ data: { stage: form.stage, brief, tone } })}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {draft.isPending ? "Drafting…" : "Draft with AI"}
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field-stack">
                <Label htmlFor="offer-name">Template name</Label>
                <Input id="offer-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
              </div>
              <div className="field-stack">
                <Label htmlFor="offer-stage">Stage</Label>
                <select
                  id="offer-stage"
                  value={form.stage}
                  disabled={!canPickStage}
                  onChange={(e) => {
                    const next = e.target.value as TemplateStage;
                    setForm((f) => ({
                      ...formFor(null, next),
                      name: f.name === STAGE_DEFAULT_DRAFT[f.stage].name ? STAGE_DEFAULT_DRAFT[next].name : f.name,
                      image_url: f.image_url,
                      image_placement: f.image_placement,
                    }));
                  }}
                  className="h-10 w-full rounded-xl border border-edge-2 bg-glass-2 px-3 text-sm shadow-inset-hi disabled:opacity-70"
                >
                  {stageOptions.map((s) => (
                    <option key={s} value={s} disabled={s !== "custom" && s !== form.stage && stagesTaken.includes(s)}>
                      {STAGE_LABEL[s]}
                      {s !== "custom" && s !== form.stage && stagesTaken.includes(s) ? " (has a template)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field-stack">
              <Label htmlFor="offer-subject">Email subject</Label>
              <Input id="offer-subject" value={form.subject} onChange={(e) => set("subject", e.target.value)} />
              <p className="text-xs text-muted-foreground">
                You can use <code className="rounded bg-glass-2 px-1">{"{{first_name}}"}</code>,{" "}
                <code className="rounded bg-glass-2 px-1">{"{{clinic}}"}</code> and{" "}
                <code className="rounded bg-glass-2 px-1">{"{{offer}}"}</code>.
              </p>
            </div>
            <div className="field-stack">
              <Label htmlFor="offer-headline">Headline</Label>
              <Input id="offer-headline" value={form.headline} onChange={(e) => set("headline", e.target.value)} />
            </div>
            <div className="field-stack">
              <Label htmlFor="offer-body">Body</Label>
              <Textarea id="offer-body" rows={6} value={form.body} onChange={(e) => set("body", e.target.value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field-stack">
                <Label htmlFor="offer-value">The offer, in one line</Label>
                <Input
                  id="offer-value"
                  value={form.value_text}
                  onChange={(e) => set("value_text", e.target.value)}
                  placeholder="10% off your next session"
                />
              </div>
              <div className="field-stack">
                <Label htmlFor="offer-code">Code (optional)</Label>
                <Input
                  id="offer-code"
                  value={form.code}
                  onChange={(e) => set("code", e.target.value.toUpperCase())}
                  placeholder="NEXT10"
                />
              </div>
              <div className="field-stack">
                <Label htmlFor="offer-cta">Button label</Label>
                <Input id="offer-cta" value={form.cta_label} onChange={(e) => set("cta_label", e.target.value)} />
              </div>
              <div className="field-stack">
                <Label htmlFor="offer-valid">Valid for (days)</Label>
                <Input
                  id="offer-valid"
                  type="number"
                  min={1}
                  max={365}
                  value={form.valid_days}
                  onChange={(e) => set("valid_days", Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
                />
              </div>
            </div>

            <OfferImageField
              imageUrl={form.image_url}
              placement={form.image_placement}
              onChange={({ imageUrl, placement }) =>
                setForm((f) => ({ ...f, image_url: imageUrl, image_placement: placement }))
              }
            />

            <div className="rounded-2xl border border-edge bg-glass-2 p-4 shadow-inset-hi">
              <p className="text-sm font-semibold text-foreground">How it reaches the patient</p>
              <div className="mt-3 space-y-3">
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    Email with a claim button
                    <span className="block text-xs text-muted-foreground">Only to patients who have opted in to marketing email.</span>
                  </span>
                  <Switch checked={form.send_email} onCheckedChange={(v) => set("send_email", v)} aria-label="Send by email" />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    Text message
                    <span className="block text-xs text-muted-foreground">A short version with the code and link.</span>
                  </span>
                  <Switch checked={form.send_sms} onCheckedChange={(v) => set("send_sms", v)} aria-label="Send by SMS" />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>
                    Card on their portal home
                    <span className="block text-xs text-muted-foreground">Where they claim it. Shows even without email consent.</span>
                  </span>
                  <Switch checked={form.show_in_portal} onCheckedChange={(v) => set("show_in_portal", v)} aria-label="Show on the portal" />
                </label>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-3 px-6 py-5">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-foreground">What {previewName} receives</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Updates as you type.</p>
              </div>
              <div className="flex h-[34px] shrink-0 items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi">
                {(["email", "portal"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPreviewTab(k)}
                    className={
                      "h-7 cursor-pointer rounded-full px-3.5 text-xs tracking-[0.02em] transition-colors " +
                      (previewTab === k
                        ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                        : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]")
                    }
                  >
                    {k === "email" ? "Email" : "Portal card"}
                  </button>
                ))}
              </div>
            </div>
            {previewTab === "email" ? (
              <OfferEmailPreview html={rendered.html} subject={rendered.subject} />
            ) : (
              <OfferCardPreview card={rendered.card} expiresAt={rendered.expiresAt} clinicName={clinicName} status="new" />
            )}
          </div>
        </div>

        <SheetFooter className="justify-center border-t border-edge px-6 py-4 sm:justify-center">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={save.isPending} data-qc="offer-save">
            {save.isPending ? "Saving…" : template ? "Save changes" : "Create template"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
