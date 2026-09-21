import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Heart,
  Info,
  Layers,
  ShieldCheck,
  Sun,
  TriangleAlert,
  Upload,
  User,
} from "lucide-react";
import { getPortalPlan, submitRecoveryCheckin, toggleChecklistItem } from "@/lib/clinic.functions";
import { PlanTabs } from "@/components/portal/plan-tabs";
import {
  PortalCard,
  PortalCheck,
  PortalHead,
  PortalLink,
  PortalNote,
  PortalPhoto,
  PortalRing,
  PortalSlider,
  formatPortalDate,
} from "@/components/portal/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/my-record/plan/")({
  component: PlanOverview,
});

function PlanOverview() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchPlan = useServerFn(getPortalPlan);
  const { data, isLoading } = useQuery({ queryKey: ["portal-plan"], queryFn: () => fetchPlan() });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["portal-plan"] });
  const toggle = useMutation({
    mutationFn: useServerFn(toggleChecklistItem),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
  const checkin = useMutation({
    mutationFn: useServerFn(submitRecoveryCheckin),
    onSuccess: () => {
      toast.success("Thanks — your clinic can see this");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading your plan…</p>;
  if (!data?.plan) {
    return (
      <>
        <div className="page-header">
          <div>
            <h1 className="page-title">Skin Plan & Journey</h1>
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

  const { plan, clinician, nextAppointment, todayAction, checkIn, beforeAfter, improvements } = data;

  return (
    <div data-qc="portal-plan-overview">
      <div className="page-header">
        <div>
          <p className="eyebrow">Your plan</p>
          <h1 className="page-title">{plan.name}</h1>
          {plan.strapline && <p className="page-subtitle">{plan.strapline}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="glass-card flex items-center gap-2 rounded-[22px] px-3 py-2">
            <PortalRing pct={plan.completion} size={36} stroke={4.5} />
            <span>
              <span className="block text-xs font-semibold">Plan completion</span>
              <span className="text-xs text-muted-foreground">
                {plan.milestonesDone} of {plan.milestonesTotal} milestones
              </span>
            </span>
          </div>
          {clinician && (
            <div className="glass-card flex items-center gap-2 rounded-[22px] px-3 py-2">
              <span className="grid h-[26px] w-[26px] place-items-center rounded-[10px] bg-rose-bg text-rose-ink">
                <User className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span>
                <span className="block text-xs text-muted-foreground">Your clinician</span>
                <span className="text-xs font-semibold">{clinician.name}</span>
              </span>
            </div>
          )}
          {nextAppointment && (
            <div className="glass-card flex items-center gap-2 rounded-[22px] px-3 py-2">
              <span className="grid h-[26px] w-[26px] place-items-center rounded-[10px] bg-sky-bg text-sky-ink">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span>
                <span className="block text-xs text-muted-foreground">Next appointment</span>
                <span className="text-xs font-semibold">{nextAppointment.date}</span>
              </span>
            </div>
          )}
          <div className="glass-card flex items-center gap-2 rounded-[22px] px-3 py-2">
            <span className="grid h-[26px] w-[26px] place-items-center rounded-[10px] bg-accent-soft text-accent-ink">
              <Layers className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span>
              <span className="block text-xs text-muted-foreground">Current phase</span>
              <span className="text-xs font-semibold capitalize">{plan.phase}</span>
            </span>
          </div>
        </div>
      </div>

      <PlanTabs />

      <div className="grid items-start gap-3.5 xl:grid-cols-[1.05fr_1fr_1fr]">
        <PortalCard>
          <PortalHead
            icon={Sun}
            title="Today / Next action"
            action={
              plan.day ? (
                <span className="text-xs tabular-nums text-muted-foreground">
                  Day {plan.day} of {plan.days}
                </span>
              ) : null
            }
          />
          {todayAction ? (
            <div className="flex gap-2.5 rounded-[16px] border border-edge-2 bg-glass-2 p-3 shadow-inset-hi">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent-ink">
                <FileText className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold">{todayAction.title}</p>
                {todayAction.detail && <p className="mt-1 text-xs text-muted-foreground">{todayAction.detail}</p>}
                <div className="mt-2.5 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/my-record/records" })}
                    className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-accent px-3 text-xs font-semibold text-accent-foreground shadow-bloom hover:brightness-105"
                  >
                    <Upload className="h-3 w-3" aria-hidden /> Upload result
                  </button>
                  <PortalLink onClick={() => navigate({ to: "/my-record/plan/timeline" })}>View the step</PortalLink>
                </div>
              </div>
            </div>
          ) : (
            <p className="py-4 text-xs text-muted-foreground">Nothing outstanding — enjoy the break.</p>
          )}
        </PortalCard>

        <PortalCard>
          <PortalHead
            icon={Heart}
            title="Recovery Check-in"
            sub="How are you feeling today?"
            action={checkIn ? <span className="text-xs text-muted-foreground">{formatPortalDate(checkIn.date)}</span> : null}
          />
          {checkIn ? (
            <div className="grid gap-2.5">
              {checkIn.rows.map((r: any) => (
                <PortalSlider key={r.label} label={r.label} value={r.value} reading={r.reading} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No reading yet today.</p>
          )}
          <button
            type="button"
            data-qc="checkin-submit"
            disabled={checkin.isPending}
            onClick={() =>
              checkin.mutate({
                data: {
                  redness: checkIn?.rows[0]?.value ?? 20,
                  sensitivity: checkIn?.rows[1]?.value ?? 20,
                  dryness: checkIn?.rows[2]?.value ?? 20,
                  note: "Submitted from the portal",
                },
              })
            }
            className="mt-3 inline-flex h-7 cursor-pointer items-center gap-1 text-xs font-semibold text-accent-ink hover:underline disabled:opacity-50"
          >
            Add a note if you're experiencing increased symptoms
          </button>
          {checkIn?.needsAttention && (
            <div className="mt-2.5">
              <PortalNote tone="danger" icon={TriangleAlert}>
                Your response suggests higher irritation. Please add a note so we can track this in your journal.
              </PortalNote>
            </div>
          )}
        </PortalCard>

        <PortalCard>
          <PortalHead
            icon={BarChart3}
            title="Before & After Progress"
            action={<PortalLink onClick={() => navigate({ to: "/my-record/records" })}>See all</PortalLink>}
          />
          <div className="relative grid grid-cols-2 gap-2">
            {[
              { photo: beforeAfter.before, label: "Before" },
              { photo: beforeAfter.after, label: "After" },
            ].map((p) => (
              <div key={p.label}>
                {p.photo?.url ? (
                  <img src={p.photo.url} alt="" className="h-24 w-full rounded-xl object-cover" />
                ) : (
                  <PortalPhoto icon={BarChart3} height={96} />
                )}
                <p className="mt-1.5 text-xs font-semibold">{p.label}</p>
                <p className="text-xs text-muted-foreground">{formatPortalDate(p.photo?.taken_at) || "—"}</p>
              </div>
            ))}
            <span className="pointer-events-none absolute left-1/2 top-12 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white shadow-glass">
              <ChevronLeft className="h-2.5 w-2.5" aria-hidden />
              <ChevronRight className="-ml-1 h-2.5 w-2.5" aria-hidden />
            </span>
          </div>
          {improvements.length > 0 && (
            <div className="mt-3 rounded-[16px] bg-success-bg px-3 py-2.5">
              <p className="text-xs font-semibold text-success-ink">Visible improvements</p>
              <div className="mt-1.5 grid gap-1">
                {improvements.map((i: string) => (
                  <p key={i} className="flex items-center gap-1.5 text-xs text-success-ink">
                    <Check className="h-3 w-3" strokeWidth={2.6} aria-hidden />
                    {i}
                  </p>
                ))}
              </div>
            </div>
          )}
        </PortalCard>
      </div>

      <div className="mt-3.5 grid items-start gap-3.5 xl:grid-cols-[2.1fr_1fr]">
        <PortalCard>
          <PortalHead
            icon={Layers}
            title="Your Journey Snapshot"
            action={<PortalLink onClick={() => navigate({ to: "/my-record/plan/timeline" })}>View full timeline</PortalLink>}
          />
          <div className="grid gap-3.5 md:grid-cols-3">
            {data.journeySnapshot.map((m: any) => (
              <div key={m.month}>
                <p className="text-xs text-muted-foreground">{m.month}</p>
                <p className="text-xs font-semibold">{m.title}</p>
                <div className="my-2.5 flex items-center gap-1.5">
                  {m.steps.map((s: any, si: number) => (
                    <span key={s.label} className="flex flex-1 items-center">
                      <span
                        className={cn(
                          "grid h-[13px] w-[13px] shrink-0 place-items-center rounded-full text-white",
                          s.done ? "bg-success" : "bg-glass-2 shadow-[inset_0_0_0_1.5px_var(--bar)]",
                        )}
                      >
                        {s.done && <Check className="h-2 w-2" strokeWidth={3} aria-hidden />}
                      </span>
                      {si < m.steps.length - 1 && (
                        <span className={cn("h-0.5 flex-1", s.done ? "bg-success" : "bg-bar")} />
                      )}
                    </span>
                  ))}
                </div>
                <div className="grid gap-1">
                  {m.steps.map((s: any) => (
                    <p key={s.label} className="flex items-center gap-1.5 text-xs">
                      <PortalCheck on={s.done} className="h-[13px] w-[13px] rounded" />
                      <span className={s.done ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </PortalCard>

        <PortalCard>
          <PortalHead icon={ShieldCheck} title="Safe to Proceed?" sub="Complete these steps before your next session." />
          {data.safeToProceed.length === 0 && (
            <p className="py-3 text-xs text-muted-foreground">Nothing to confirm right now.</p>
          )}
          {data.safeToProceed.map((item: any) => (
            <button
              key={item.id}
              type="button"
              data-qc="safe-item"
              data-done={item.done ? "1" : "0"}
              disabled={item.byClinic || toggle.isPending}
              onClick={() => toggle.mutate({ data: { id: item.id, done: !item.done } })}
              className="flex w-full cursor-pointer items-center gap-2.5 py-1.5 text-left disabled:cursor-not-allowed"
            >
              <PortalCheck on={item.done} />
              <span className="text-xs">{item.label}</span>
              {item.byClinic && <span className="ml-auto text-2xs text-ink-3">Clinic</span>}
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate({ to: "/my-record/plan/timeline" })}
            className="mt-2.5 flex w-full cursor-pointer items-center justify-between rounded-full bg-glass-2 px-3 py-1.5 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--edge-2)] hover:bg-[rgba(47,63,102,0.08)]"
          >
            <span className="flex items-center gap-1.5">
              <Info className="h-3 w-3" aria-hidden /> View checklist
            </span>
            <ChevronRight className="h-3 w-3" aria-hidden />
          </button>
        </PortalCard>
      </div>
    </div>
  );
}
