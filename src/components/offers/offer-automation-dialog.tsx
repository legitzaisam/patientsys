import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { previewOfferStage, setOfferAutomation } from "@/lib/clinic.functions";
import type { OfferTemplateRow } from "@/lib/offers/shape";
import { STAGE_LABEL, STAGE_META, type OfferStage } from "@/lib/offers/stages";
import { cn } from "@/lib/utils";

const REASON_LABEL: Record<string, string> = {
  no_marketing_consent: "No marketing consent",
  already_offered: "Already offered",
  has_live_offer: "Has a live offer",
  no_email: "No email address",
  waiting_for_delay: "Waiting out the delay",
};

/**
 * "Who would receive this today" before the switch goes on. The same
 * function drives the automation itself, so the preview is what will happen
 * on the next outbox run.
 */
export function OfferAutomationDialog({
  open,
  onOpenChange,
  template,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: OfferTemplateRow | null;
}) {
  const queryClient = useQueryClient();
  const stage = (template?.stage ?? "pre_consultation") as OfferStage;
  const [delay, setDelay] = useState<number>(template?.automation_delay_days ?? 0);
  const [showSkipped, setShowSkipped] = useState(false);

  useEffect(() => {
    if (open && template) {
      setDelay(template.automation_delay_days);
      setShowSkipped(false);
    }
  }, [open, template]);

  const fetchPreview = useServerFn(previewOfferStage);
  const { data, isLoading } = useQuery({
    queryKey: ["offer-preview", stage, delay],
    queryFn: () => fetchPreview({ data: { stage, delay_days: delay } }),
    enabled: open && Boolean(template) && template?.stage !== "custom",
  });

  const setAutomation = useServerFn(setOfferAutomation);
  const save = useMutation({
    mutationFn: async (vars: { id: string; enabled: boolean; delay_days: number }) => {
      await setAutomation({ data: vars });
      return vars;
    },
    onSuccess: (vars) => {
      queryClient.invalidateQueries({ queryKey: ["offer-templates"] });
      queryClient.invalidateQueries({ queryKey: ["offer-preview"] });
      toast.success(vars.enabled ? "Automation switched on — sends on the next outbox run" : "Automation switched off");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!template) return null;
  const enabled = template.automation_enabled;
  const willSend = data?.willSend ?? [];
  const portalOnly = data?.portalOnly ?? [];
  const skipped = data?.skipped ?? [];
  const recipients = [
    ...willSend.map((row) => ({ ...row, portalOnly: false })),
    ...portalOnly.map((row) => ({ ...row, portalOnly: true })),
  ];
  const plural = (n: number) => (n === 1 ? "patient" : "patients");
  const summary = enabled
    ? `${willSend.length} ${plural(willSend.length)} would receive this today${portalOnly.length > 0 ? `, ${portalOnly.length} by portal only` : ""}`
    : `${willSend.length} ${plural(willSend.length)} will get this now, ${portalOnly.length} by portal only`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto rounded-xl" data-qc="offer-automation">
        <DialogHeader>
          <DialogTitle>
            {enabled ? "Automation is on" : "Switch on automation"}: {STAGE_LABEL[stage]}
          </DialogTitle>
          <DialogDescription>
            {STAGE_META[stage].meaning} Each patient is offered this once, on the daily outbox run, after the delay below.
            Patients with marketing email on get the email; the rest see the card in their portal only.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <p className="text-sm font-semibold text-foreground" data-qc="offer-preview-count">
              {isLoading ? "Working out who is in this stage…" : summary}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {data ? `${data.counts[stage]} in the stage; ${skipped.length} skipped.` : ""}
            </p>
          </div>
          <div className="field-stack sm:w-40">
            <Label htmlFor="offer-delay">Wait (days in stage)</Label>
            <Input
              id="offer-delay"
              type="number"
              min={0}
              max={365}
              value={delay}
              onChange={(e) => setDelay(Math.max(0, Math.min(365, Number(e.target.value) || 0)))}
            />
          </div>
        </div>

        <div className="max-h-[300px] overflow-y-auto rounded-2xl border border-edge bg-glass-2 shadow-inset-hi">
          {recipients.length === 0 && !isLoading ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nobody is due this offer today.</p>
          ) : (
            <ul className="divide-y divide-edge">
              {recipients.map((row) => (
                <li
                  key={row.patient_id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
                  data-qc={row.portalOnly ? "offer-preview-portal-only" : "offer-preview-now"}
                >
                  <span className="min-w-0 truncate font-medium text-foreground">{row.name}</span>
                  {row.portalOnly ? (
                    <span className="shrink-0 rounded-full bg-glass-2 px-2 py-0.5 text-[11px] text-muted-foreground shadow-inset-hi">
                      Portal only
                    </span>
                  ) : (
                    <span className="shrink-0 truncate text-xs text-muted-foreground">{row.email}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {skipped.length > 0 ? (
          <div>
            <button
              type="button"
              className="text-xs font-semibold text-accent-ink underline-offset-4 hover:underline"
              onClick={() => setShowSkipped((v) => !v)}
            >
              {showSkipped ? "Hide" : "Show"} {skipped.length} skipped
            </button>
            {showSkipped ? (
              <ul className={cn("mt-2 max-h-[200px] divide-y divide-edge overflow-y-auto rounded-2xl border border-edge")}>
                {skipped.map((row) => (
                  <li key={row.patient_id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                    <span className="min-w-0 truncate text-ink-2">{row.name}</span>
                    <span className="shrink-0 rounded-full bg-glass-2 px-2 py-0.5 text-[11px] text-muted-foreground shadow-inset-hi" title={row.detail}>
                      {REASON_LABEL[row.reason] ?? row.reason}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {enabled ? (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={save.isPending}
                onClick={() => save.mutate({ id: template.id, enabled: true, delay_days: delay })}
              >
                Save delay
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={save.isPending}
                onClick={() => save.mutate({ id: template.id, enabled: false, delay_days: delay })}
                data-qc="offer-automation-off"
              >
                Switch off
              </Button>
            </>
          ) : (
            <Button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate({ id: template.id, enabled: true, delay_days: delay })}
              data-qc="offer-automation-on"
            >
              Switch on
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
