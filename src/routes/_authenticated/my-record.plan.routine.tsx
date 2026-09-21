import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Clock,
  Droplet,
  Heart,
  MessageSquare,
  Moon,
  Smile,
  Sparkles,
  Sun,
} from "lucide-react";
import { getPortalRoutine, markRoutineComplete, snoozeRoutineReminder } from "@/lib/clinic.functions";
import { PlanTabs } from "@/components/portal/plan-tabs";
import {
  PortalBanner,
  PortalCard,
  PortalHead,
  PortalLink,
  PortalPhoto,
  PortalRing,
} from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/my-record/plan/routine")({
  component: PlanRoutine,
});

function PlanRoutine() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchRoutine = useServerFn(getPortalRoutine);
  const { data, isLoading } = useQuery({ queryKey: ["portal-routine"], queryFn: () => fetchRoutine() });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["portal-routine"] });
  const complete = useMutation({
    mutationFn: useServerFn(markRoutineComplete),
    onSuccess: () => {
      toast.success("Nice one — logged for today");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const snooze = useMutation({
    mutationFn: useServerFn(snoozeRoutineReminder),
    onSuccess: () => {
      toast.success("Reminder snoozed for an hour");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading your routine…</p>;

  const clinician = data?.clinician;
  const reminder = data?.reminder;

  return (
    <div data-qc="portal-routine">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Skin Plan & Journey</h1>
          <p className="page-subtitle">Practitioner-guided care, personalised for lasting results.</p>
        </div>
        <p className="hidden -rotate-6 text-center font-[Caveat,cursive] text-[17px] leading-tight text-accent-ink lg:block">
          <span className="block">Progress</span>
          <span className="block">looks good</span>
          <span className="block">on you.</span>
        </p>
      </div>

      <PlanTabs />

      {data?.routine && (
        <PortalCard className="bg-sky-bg">
          <div className="flex items-center gap-3.5">
            {clinician?.avatarUrl ? (
              <img src={clinician.avatarUrl} alt="" className="h-[62px] w-[62px] shrink-0 rounded-full object-cover" />
            ) : (
              <span className="grid h-[62px] w-[62px] shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-accent-ink">
                {clinician?.initials ?? "AC"}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{data.routine.headline}</p>
              {data.routine.body && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{data.routine.body}</p>
              )}
            </div>
            <div className="hidden shrink-0 items-center gap-2.5 border-l border-edge pl-3.5 md:flex">
              <div className="text-right">
                <p className="text-2xs text-muted-foreground">From your care team</p>
                <p className="text-xs font-semibold">{clinician?.name ?? "Your care team"}</p>
                <p className="text-2xs text-muted-foreground">{clinician?.title ?? ""}</p>
              </div>
              <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-accent-soft text-2xs font-semibold text-accent-ink">
                {clinician?.initials ?? "AC"}
              </span>
            </div>
          </div>
        </PortalCard>
      )}

      <div className="mt-3.5 grid items-start gap-3.5 xl:grid-cols-[1fr_1fr_0.78fr]">
        <RoutineColumn
          icon={Sun}
          title="Morning routine"
          sub="Protect, hydrate and prepare for the day."
          items={data?.morning ?? []}
          addLabel="Add product to morning routine"
        />
        <RoutineColumn
          icon={Moon}
          title="Evening routine"
          sub="Cleanse, treat and renew overnight."
          items={data?.evening ?? []}
          addLabel="Add product to evening routine"
        />

        <div className="grid gap-3.5">
          <PortalCard>
            <PortalHead icon={BarChart3} title="Routine adherence" />
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">
                  {(data?.adherence.pct ?? 0) >= 70 ? "You're doing great!" : "Keep going"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  You've completed your morning routine on {data?.adherence.morning.done ?? 0} of 7 days and your
                  evening routine on {data?.adherence.evening.done ?? 0} of 7 this week.
                </p>
              </div>
              <PortalRing pct={data?.adherence.pct ?? 0} size={56} stroke={6} />
            </div>
            <div className="mt-2.5">
              <PortalLink onClick={() => navigate({ to: "/my-record/plan/journal" })}>View details</PortalLink>
            </div>
          </PortalCard>

          <PortalCard>
            <PortalHead icon={Bell} title="Upcoming reminder" />
            <div className="flex gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden />
              <div className="min-w-0">
                <p className="text-xs font-semibold">{reminder?.title}</p>
                <p className="text-xs text-muted-foreground">
                  {reminder?.done
                    ? "Completed for today"
                    : reminder?.snoozedUntil
                      ? `Snoozed until ${new Date(reminder.snoozedUntil).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
                      : reminder?.when}
                </p>
              </div>
            </div>
            <button
              type="button"
              data-qc="routine-complete"
              disabled={complete.isPending || reminder?.done}
              onClick={() => reminder && complete.mutate({ data: { period: reminder.period } })}
              className="mt-3 inline-flex h-[34px] w-full cursor-pointer items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground shadow-bloom hover:brightness-105 disabled:opacity-50"
            >
              {reminder?.done ? "Completed" : "Mark as complete"}
            </button>
            <button
              type="button"
              data-qc="routine-snooze"
              disabled={snooze.isPending}
              onClick={() => reminder && snooze.mutate({ data: { period: reminder.period, minutes: 60 } })}
              className="mt-1.5 inline-flex h-7 w-full cursor-pointer items-center justify-center rounded-full bg-glass-2 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--edge-2)] hover:bg-[rgba(47,63,102,0.08)] disabled:opacity-50"
            >
              Snooze for 1 hour
            </button>
          </PortalCard>
        </div>
      </div>

      <div className="mt-3 grid items-start gap-3.5 xl:grid-cols-3">
        <PortalCard>
          <PortalHead icon={BarChart3} title="Skin response" sub="Track how your skin is responding to your routine." />
          <div className="flex gap-2.5 rounded-[16px] bg-success-bg px-3 py-2.5">
            <Smile className="mt-0.5 h-4 w-4 shrink-0 text-success-ink" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-success-ink">Your skin is showing positive progress</p>
              <p className="mt-0.5 text-xs leading-relaxed text-success-ink">
                Keep logging how you feel — your clinic reviews this before each session.
              </p>
            </div>
          </div>
          <div className="mt-2.5">
            <PortalLink onClick={() => navigate({ to: "/my-record/plan/journal" })}>View skin journal</PortalLink>
          </div>
        </PortalCard>

        <PortalCard>
          <PortalHead
            icon={MessageSquare}
            title="Practitioner note"
            action={
              data?.routine?.noteDatedOn ? (
                <span className="text-xs text-muted-foreground">
                  {new Date(data.routine.noteDatedOn).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              ) : null
            }
          />
          <div className="flex gap-2.5">
            <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-accent-soft text-2xs font-semibold text-accent-ink">
              {clinician?.initials ?? "AC"}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold">{clinician?.name ?? "Your care team"}</p>
              <p className="text-2xs text-muted-foreground">{clinician?.title ?? ""}</p>
            </div>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
            {data?.routine?.practitionerNote ?? "Your practitioner will add a note after your next review."}
          </p>
        </PortalCard>

        <PortalCard>
          <PortalHead icon={BookOpen} title="Product guide" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Learn more about your products, how they work and tips for the best results.
          </p>
          <div className="my-2.5 flex gap-1.5">
            {[Droplet, Sparkles, Moon].map((Icon, i) => (
              <PortalPhoto key={i} icon={Icon} height={42} className="flex-1" />
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate({ to: "/my-record/resources" })}
            className="inline-flex h-[34px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-full bg-glass-2 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--edge-2)] hover:bg-[rgba(47,63,102,0.08)]"
          >
            View product guide
            <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        </PortalCard>
      </div>

      <div className="mt-3.5">
        <PortalBanner
          icon={Heart}
          title="Consistency brings real results."
          body="Stick with your routine, track your progress and reach out anytime — we're here to support you."
          cta="View your journey"
          onCta={() => navigate({ to: "/my-record/plan" })}
        />
      </div>
    </div>
  );
}

function RoutineColumn({
  icon: Icon,
  title,
  sub,
  items,
  addLabel,
}: {
  icon: typeof Sun;
  title: string;
  sub: string;
  items: any[];
  addLabel: string;
}) {
  return (
    <PortalCard>
      <PortalHead icon={Icon} title={title} sub={sub} />
      <div className="grid">
        {items.length === 0 && (
          <p className="py-4 text-xs text-muted-foreground">Your clinic has not set this routine yet.</p>
        )}
        {items.map((p) => (
          <div key={p.id} className="flex items-center gap-2.5 rounded-xl px-2.5 py-1.5">
            <PortalPhoto icon={Droplet} height={30} className="w-[25px] shrink-0 rounded-lg" />
            <div className="w-[42%] shrink-0">
              <p className="text-[9.5px] leading-tight text-muted-foreground">{p.step}</p>
              <p className="text-xs font-semibold leading-tight">{p.product_name}</p>
            </div>
            <p className="min-w-0 flex-1 text-[10.5px] leading-snug text-muted-foreground">{p.how_to}</p>
          </div>
        ))}
      </div>
      <button
        type="button"
        className="mt-1.5 inline-flex h-[31px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-[13px] bg-glass-2 text-xs font-semibold text-muted-foreground shadow-[inset_0_0_0_1px_var(--edge-2)]"
        disabled
        title="Your clinic sets your routine"
      >
        {addLabel} — set by your clinic
      </button>
    </PortalCard>
  );
}
