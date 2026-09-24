import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Droplet,
  ExternalLink,
  FileText,
  Heart,
  Info,
  Layers,
  Lock,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Image as ImageIcon,
  PauseCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { getPortalTimeline, requestPlanPause, toggleChecklistItem } from "@/lib/clinic.functions";
import { focusSection } from "@/lib/focus-section";
import { openPortalChat } from "@/components/portal/portal-dock";
import { PlanTabs } from "@/components/portal/plan-tabs";
import {
  PortalCard,
  PortalCheck,
  PortalHead,
  PortalNote,
  PortalStatus,
  formatPortalDate,
} from "@/components/portal/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/my-record/plan/timeline")({
  // ?step=<milestone id> opens that step, scrolled into view and highlighted
  // (the overview's "View the step" links here).
  validateSearch: (search: Record<string, unknown>): { step?: string } =>
    typeof search["step"] === "string" && search["step"] ? { step: search["step"] } : {},
  component: PlanTimeline,
});

const STEP_ICONS: Record<string, typeof Droplet> = {
  drop: Droplet,
  cal: CalendarDays,
  shield: ShieldCheck,
  msg: MessageSquare,
  photo: ImageIcon,
  layers: Layers,
  heart: Heart,
  plus: Plus,
};

const PAUSE_REASONS = ["Going on holiday", "Medical reason", "Cost / budget", "Skin is irritated", "Other"];

function PlanTimeline() {
  const queryClient = useQueryClient();
  const { step: stepParam } = Route.useSearch();
  const fetchTimeline = useServerFn(getPortalTimeline);
  const { data, isLoading } = useQuery({ queryKey: ["portal-timeline"], queryFn: () => fetchTimeline() });

  const [openId, setOpenId] = useState<string | null>(stepParam ?? null);
  const [collapsed, setCollapsed] = useState<number[]>([]);
  const [pauseOpen, setPauseOpen] = useState(false);

  // Deep link: once the roadmap has loaded, land on the requested step.
  useEffect(() => {
    if (!stepParam || !data?.roadmap) return;
    setOpenId(stepParam);
    focusSection(`step-${stepParam}`);
    focusSection("step-details");
  }, [stepParam, Boolean(data?.roadmap)]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["portal-timeline"] });
  const toggle = useMutation({
    mutationFn: useServerFn(toggleChecklistItem),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading your roadmap…</p>;
  if (!data?.plan) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Your plan roadmap</h1>
            <p className="page-subtitle">Your clinic will set up a plan with you at your next visit.</p>
          </div>
        </div>
        <PlanTabs />
        <PortalCard>
          <p className="py-6 text-center text-sm text-muted-foreground">No active plan yet.</p>
        </PortalCard>
      </>
    );
  }

  const allSteps = data.roadmap.flatMap((m: any) => m.steps);
  const step = allSteps.find((s: any) => s.id === openId) ?? allSteps.find((s: any) => s.status === "current") ?? null;

  return (
    <div data-qc="portal-timeline">
      <div className="page-header">
        <div>
          <h1 className="page-title">{data.plan.name}</h1>
          {data.plan.strapline && <p className="page-subtitle">{data.plan.strapline}</p>}
        </div>
        <div className="flex items-center gap-2.5">
          <div className="hidden max-w-sm lg:block">
            <PortalNote icon={Info}>
              This roadmap is managed by your clinic. Changes and pauses must be authorised by the clinic.
            </PortalNote>
          </div>
          <button
            type="button"
            data-qc="pause-plan"
            onClick={() => setPauseOpen(true)}
            disabled={Boolean(data.pendingPause) || data.plan.status === "paused"}
            className="inline-flex h-[34px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-destructive-bg px-3.5 text-xs font-semibold text-destructive-ink hover:brightness-95 disabled:opacity-60"
          >
            <PauseCircle className="h-3.5 w-3.5" aria-hidden />
            {data.pendingPause ? "Pause requested" : data.plan.status === "paused" ? "Plan paused" : "Pause plan"}
          </button>
        </div>
      </div>

      <PlanTabs />

      <div className={cn("grid items-stretch gap-3.5", step ? "xl:grid-cols-[1.9fr_1fr]" : "grid-cols-1")}>
        <PortalCard>
          <PortalHead
            icon={Megaphone}
            title="Your plan roadmap"
            sub="Your personalised journey, designed by your clinic. Tap on each step to view more details."
            action={
              <div className="text-right">
                <p className="text-xs tabular-nums text-muted-foreground">
                  {data.plan.milestonesDone} of {data.plan.milestonesTotal} milestones completed
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-bar">
                    <span className="block h-full rounded-full bg-success" style={{ width: `${data.plan.completion}%` }} />
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">{data.plan.completion}%</span>
                </div>
              </div>
            }
          />

          {data.roadmap.map((month: any) => {
            const isCollapsed = collapsed.includes(month.n);
            return (
              <div key={month.n} className="mt-3">
                <button
                  type="button"
                  data-qc="month-toggle"
                  onClick={() =>
                    setCollapsed((c) => (c.includes(month.n) ? c.filter((n) => n !== month.n) : [...c, month.n]))
                  }
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-[16px] border border-edge-2 bg-accent-wash px-3 py-2.5 text-left shadow-inset-hi"
                >
                  <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-success text-xs font-bold text-white">
                    {month.n}
                  </span>
                  <span className="min-w-0">
                    <span className="text-xs">
                      <b>{month.month}</b>&nbsp;&nbsp;{month.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">{month.blurb}</span>
                  </span>
                  <span className="ml-auto flex items-center gap-1.5">
                    {isCollapsed && (
                      <span className="text-xs tabular-nums text-muted-foreground">{month.steps.length} steps</span>
                    )}
                    {isCollapsed ? (
                      <ChevronDown className="h-3.5 w-3.5 text-ink-3" aria-hidden />
                    ) : (
                      <ChevronUp className="h-3.5 w-3.5 text-ink-3" aria-hidden />
                    )}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="relative mt-1 pl-3">
                    <span className="absolute bottom-3.5 left-[10px] top-3 w-0.5 bg-bar" />
                    {month.steps.map((s: any) => {
                      const Icon = STEP_ICONS[s.icon] ?? CalendarDays;
                      const active = s.id === step?.id;
                      return (
                        <div key={s.id} className="relative flex items-center gap-2.5">
                          <span
                            className={cn(
                              "z-[1] h-[11px] w-[11px] shrink-0 rounded-full",
                              s.status === "current" ? "bg-success" : "bg-glass-hi shadow-[inset_0_0_0_2px_var(--bar)]",
                            )}
                          />
                          <button
                            type="button"
                            id={`step-${s.id}`}
                            data-qc="step-row"
                            data-step-status={s.status}
                            onClick={() => setOpenId(s.id)}
                            className={cn(
                              "my-1 flex w-full cursor-pointer scroll-mt-24 items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors",
                              active
                                ? "bg-accent-soft shadow-[inset_0_0_0_1px_var(--accent-line)]"
                                : "bg-glass-2 shadow-[inset_0_0_0_1px_var(--edge-2)] hover:bg-[rgba(47,63,102,0.06)]",
                            )}
                          >
                            <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[10px] bg-glass-hi text-accent-ink">
                              <Icon className="h-3.5 w-3.5" aria-hidden />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold">{s.title}</span>
                              <span className="text-xs text-muted-foreground">
                                {s.status === "done" || s.status === "skipped"
                                  ? formatPortalDate(s.completedAt) && `Completed ${formatPortalDate(s.completedAt)}`
                                  : formatPortalDate(s.date)}
                              </span>
                            </span>
                            <span className="ml-auto flex items-center gap-1.5">
                              <PortalStatus status={s.status} label={s.statusLabel} />
                              <ChevronRight className="h-3.5 w-3.5 text-ink-3" aria-hidden />
                            </span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </PortalCard>

        {step && <StepDetails step={step} pending={toggle.isPending} onToggle={(id, done) => toggle.mutate({ data: { id, done } })} onClose={() => setOpenId("none")} />}
      </div>

      {pauseOpen && <PauseModal planId={data.plan.id} onClose={() => setPauseOpen(false)} />}
    </div>
  );
}

const DONE = new Set(["done", "skipped"]);

/**
 * The step card has three shapes. A completed step is a record of what
 * happened — the appointment, consent and consultation, photos and the
 * treatment note — with no checklist to tick. The step in progress carries
 * its detail and checklist. An upcoming step shows when it is due and booked,
 * its checklist, and a way to ask the clinic about it.
 */
function StepDetails({
  step,
  pending,
  onToggle,
  onClose,
}: {
  step: any;
  pending: boolean;
  onToggle: (id: string, done: boolean) => void;
  onClose: () => void;
}) {
  const done = DONE.has(step.status);
  const upcoming = step.status === "upcoming";
  const isSession = step.kind === "session";
  const title = done && isSession ? "Treatment details" : "Step details";

  return (
    <PortalCard id="step-details" className="scroll-mt-24" data-qc="step-details">
      <div className="mb-2.5 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent-ink" aria-hidden />
        <h2 className="section-title">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close step details"
          className="ml-auto grid h-6 w-6 cursor-pointer place-items-center rounded-full text-ink-3 hover:bg-glass-2 hover:text-foreground"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      </div>

      <div className="flex justify-end">
        <PortalStatus status={step.status} label={step.statusLabel} />
      </div>

      <p className="mt-1 text-[15px] font-semibold">{step.title}</p>

      {/* Dates: what a finished step was completed on; what a coming step is due and booked for. */}
      <div className="mt-2 grid gap-2" data-qc="step-dates">
        {done ? (
          <DateRow
            icon={CalendarCheck}
            label={step.appointment ? "Appointment" : "Completed on"}
            value={
              step.appointment
                ? `${step.appointment.date} · ${step.appointment.time}`
                : formatPortalDate(step.completedAt) || "Marked complete by your clinic"
            }
          />
        ) : (
          <>
            <DateRow icon={CalendarDays} label="Due date" value={formatPortalDate(step.date) || "To be confirmed"} />
            {isSession ? (
              <DateRow
                icon={CalendarCheck}
                label="Booked for"
                value={step.appointment ? `${step.appointment.date} · ${step.appointment.time}` : "Not booked yet"}
                muted={!step.appointment}
              />
            ) : null}
          </>
        )}
      </div>

      {done && isSession ? (
        <>
          <div className="mt-2.5 flex flex-wrap gap-1.5" data-qc="step-pills">
            <Pill on={step.consentSigned === true} label="Consent" off={step.consentSigned === null ? "Not on file" : "Not signed"} />
            <Pill on={step.consultationDone} label="Consultation" off="Not on file" />
          </div>
          {step.photos?.length ? (
            <div className="mt-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold">
                <ImageIcon className="h-3.5 w-3.5 text-accent-ink" aria-hidden /> Before & after
              </p>
              <div className="grid grid-cols-2 gap-2">
                {step.photos.map((p: any) => (
                  <figure key={p.id}>
                    {p.url ? (
                      <img src={p.url} alt="" className="h-24 w-full rounded-xl object-cover" />
                    ) : (
                      <div className="h-24 w-full rounded-xl bg-glass-2 shadow-inset-hi" />
                    )}
                    <figcaption className="mt-1 text-2xs text-muted-foreground">
                      <span className="font-semibold capitalize text-foreground">{p.kind}</span> · {formatPortalDate(p.taken_at)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mt-3 rounded-[16px] border border-edge-2 bg-glass-2 p-2.5 shadow-inset-hi" data-qc="step-visit-note">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <FileText className="h-3.5 w-3.5 text-accent-ink" aria-hidden /> Visit notes
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {step.visitNote ?? "Your clinic's notes from this visit will appear here once they are written up."}
            </p>
          </div>
        </>
      ) : (
        <>
          {step.detail && <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{step.detail}</p>}

          {!done && step.checklist.length > 0 && (
            <div className="mt-3 rounded-[16px] border border-edge-2 bg-glass-2 p-2.5 shadow-inset-hi">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-accent-ink" aria-hidden />
                <span className="text-xs font-semibold">Your checklist</span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {step.checklist.filter((c: any) => c.done).length} of {step.checklist.length} completed
                </span>
              </div>
              <div className="mt-2 grid gap-0.5">
                {step.checklist.map((c: any) => (
                  <button
                    key={c.id}
                    type="button"
                    data-qc="checklist-item"
                    data-done={c.done ? "1" : "0"}
                    disabled={c.byClinic || pending}
                    onClick={() => onToggle(c.id, !c.done)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-[9px] bg-glass-hi px-2 py-1.5 text-left disabled:cursor-not-allowed"
                  >
                    <PortalCheck on={c.done} className="h-3.5 w-3.5" />
                    <span className="min-w-0">
                      <span className="block text-xs">{c.label}</span>
                      {c.byClinic && <span className="text-2xs text-muted-foreground">Completed by clinic</span>}
                    </span>
                    {c.byClinic ? (
                      <Lock className="ml-auto h-3 w-3 text-ink-3" aria-hidden />
                    ) : (
                      <ExternalLink className="ml-auto h-3 w-3 text-accent-ink" aria-hidden />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {upcoming ? (
        <button
          type="button"
          data-qc="step-contact"
          onClick={() =>
            openPortalChat(`Hi, I have a question about "${step.title}" in my plan${step.date ? ` (due ${formatPortalDate(step.date)})` : ""}. `)
          }
          className="mt-3 inline-flex h-8 w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-accent px-3 text-xs font-semibold text-accent-foreground shadow-bloom hover:brightness-105"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Contact clinic about this step
        </button>
      ) : null}

      <div className="mt-2.5 flex gap-2 rounded-[13px] bg-glass-2 px-3 py-2.5">
        <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden />
        <p className="text-xs leading-relaxed text-muted-foreground">
          This step is managed by your clinic. Dates, requirements and progression cannot be edited by patients.
        </p>
      </div>
    </PortalCard>
  );
}

function DateRow({
  icon: Icon,
  label,
  value,
  muted = false,
}: {
  icon: typeof CalendarDays;
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[16px] border border-edge-2 bg-glass-2 px-2.5 py-2 shadow-inset-hi">
      <Icon className="h-3.5 w-3.5 text-ink-3" aria-hidden />
      <span>
        <span className="block text-xs text-muted-foreground">{label}</span>
        <span className={cn("text-xs font-semibold", muted && "font-normal text-muted-foreground")}>{value}</span>
      </span>
    </div>
  );
}

function Pill({ on, label, off }: { on: boolean; label: string; off: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-inset-hi",
        on ? "bg-success-bg text-success-ink" : "bg-glass-2 text-muted-foreground",
      )}
    >
      {on ? <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden /> : null}
      {label}
      {on ? null : <span className="font-normal">· {off}</span>}
    </span>
  );
}

function PauseModal({ planId, onClose }: { planId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const invalid = touched && !reason;

  const submit = useMutation({
    mutationFn: useServerFn(requestPlanPause),
    onSuccess: () => {
      toast.success("Pause request sent to your clinic");
      void queryClient.invalidateQueries({ queryKey: ["portal-timeline"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(47,63,102,0.28)] p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Pause your plan"
        data-qc="pause-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-[min(430px,100%)] rounded-[22px] border border-edge bg-white/95 p-4.5 p-[18px] shadow-popover"
      >
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Pause your plan</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              This will send a pause request to your clinic. Your plan will continue as scheduled until your clinic
              confirms.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-6 w-6 cursor-pointer place-items-center rounded-full text-ink-3 hover:bg-glass-2"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </div>

        <label className="mt-3.5 block">
          <span className="text-xs font-semibold">
            Reason <span className="text-destructive">*</span>
          </span>
          <select
            data-qc="pause-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            className={cn(
              "mt-1.5 h-[34px] w-full rounded-[11px] border bg-glass-2 px-2.5 text-xs shadow-inset-hi",
              invalid ? "border-destructive" : "border-edge-2",
            )}
          >
            <option value="">Select a reason</option>
            {PAUSE_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        {invalid && <p className="mt-1.5 text-xs text-destructive">Please select a reason to continue.</p>}

        <label className="mt-3 block">
          <span className="text-xs font-semibold">
            Notes <span className="text-muted-foreground">(optional)</span>
          </span>
          <textarea
            data-qc="pause-notes"
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any additional information for your clinic..."
            className="mt-1.5 min-h-[74px] w-full rounded-[11px] border border-edge-2 bg-glass-2 px-2.5 py-2 text-xs shadow-inset-hi"
          />
        </label>
        <p className="mt-1 text-right text-xs tabular-nums text-muted-foreground">{notes.length}/500</p>

        <div className="mt-2.5">
          <PortalNote icon={Info}>
            Your clinic will review your request and be in touch via Messages. You'll receive a notification once it's
            been updated.
          </PortalNote>
        </div>

        <div className="mt-3.5 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-[34px] flex-1 cursor-pointer items-center justify-center rounded-full bg-glass-2 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--edge-2)] hover:bg-[rgba(47,63,102,0.08)]"
          >
            Cancel
          </button>
          <button
            type="button"
            data-qc="pause-submit"
            disabled={!reason || submit.isPending}
            onMouseEnter={() => setTouched(true)}
            onClick={() => {
              setTouched(true);
              if (reason) submit.mutate({ data: { plan_id: planId, reason, notes } });
            }}
            className="inline-flex h-[34px] flex-1 cursor-pointer items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground shadow-bloom hover:brightness-105 disabled:opacity-45"
          >
            Submit request
          </button>
        </div>
      </div>
    </div>
  );
}
