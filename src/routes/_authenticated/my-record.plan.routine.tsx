import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  Clock,
  Droplet,
  Link2,
  MessageSquare,
  Moon,
  Pencil,
  Smile,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import {
  clearRoutineOverride,
  extractProductFromLink,
  getPortalRoutine,
  markRoutineComplete,
  saveRoutineOverride,
  snoozeRoutineReminder,
} from "@/lib/clinic.functions";
import { cn } from "@/lib/utils";
import { PlanTabs } from "@/components/portal/plan-tabs";
import {
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

      <div className="mt-3.5 grid items-stretch gap-3.5 xl:grid-cols-[1fr_1fr_0.78fr]">
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

      <div className="mt-3 grid items-stretch gap-3.5 xl:grid-cols-3">
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
  const [editingId, setEditingId] = useState<string | null>(null);
  return (
    <PortalCard>
      <PortalHead icon={Icon} title={title} sub={sub} />
      <div className="grid">
        {items.length === 0 && (
          <p className="py-4 text-xs text-muted-foreground">Your clinic has not set this routine yet.</p>
        )}
        {items.map((p) =>
          editingId === p.id ? (
            <ProductEditor key={p.id} item={p} onClose={() => setEditingId(null)} />
          ) : (
            <ProductRow key={p.id} item={p} onEdit={() => setEditingId(p.id)} />
          ),
        )}
      </div>
      <button
        type="button"
        className="mt-1.5 inline-flex h-[31px] w-full cursor-not-allowed items-center justify-center gap-2 rounded-[13px] bg-glass-2 text-xs font-semibold text-muted-foreground shadow-[inset_0_0_0_1px_var(--edge-2)]"
        disabled
        title="Your clinic sets the steps; you can swap the product on any step"
      >
        {addLabel} — set by your clinic
      </button>
    </PortalCard>
  );
}

/**
 * One step of the routine. When the patient has swapped in their own product
 * it leads, marked "Your product", with the clinic's recommendation kept
 * underneath so neither is lost.
 */
function ProductRow({ item: p, onEdit }: { item: any; onEdit: () => void }) {
  const own = p.override;
  return (
    <div className="group flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 hover:bg-[rgba(47,63,102,0.04)]" data-qc="routine-item">
      <PortalPhoto icon={Droplet} height={30} className="w-[25px] shrink-0 rounded-lg" />
      <div className="w-[42%] shrink-0">
        <p className="flex items-center gap-1 text-[11px] leading-tight text-muted-foreground">
          {p.step}
          {own ? (
            <span className="rounded-full bg-accent-soft px-1.5 text-[10px] font-semibold text-accent-ink" data-qc="routine-own">
              Your product
            </span>
          ) : null}
        </p>
        <p className="text-xs font-semibold leading-tight">{own ? own.product_name : p.product_name}</p>
        {own ? <p className="text-[11px] leading-tight text-ink-3">Clinic suggested {p.product_name}</p> : null}
      </div>
      <p className="min-w-0 flex-1 text-[10.5px] leading-snug text-muted-foreground">{own ? (own.how_to ?? p.how_to) : p.how_to}</p>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${p.step} product`}
        data-qc="routine-edit"
        className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full text-ink-3 opacity-70 transition-opacity hover:bg-glass-2 hover:text-foreground group-hover:opacity-100"
      >
        <Pencil className="h-3 w-3" aria-hidden />
      </button>
    </div>
  );
}

/**
 * Swap the product on a step: paste a link and the server reads the page for
 * the name and directions (falling back to the AI helper, then to typing it
 * in), then save. "Use clinic's recommendation" removes the swap.
 */
function ProductEditor({ item: p, onClose }: { item: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["portal-routine"] });
  const [url, setUrl] = useState<string>(p.override?.product_url ?? "");
  const [name, setName] = useState<string>(p.override?.product_name ?? "");
  const [howTo, setHowTo] = useState<string>(p.override?.how_to ?? "");
  const [source, setSource] = useState<"link" | "ai" | "manual">(p.override?.source ?? "manual");
  const [fetched, setFetched] = useState<null | "found" | "partial" | "none">(null);

  const extract = useMutation({
    mutationFn: useServerFn(extractProductFromLink),
    onSuccess: (res: any) => {
      if (res.name) setName(res.name);
      if (res.howTo) setHowTo(res.howTo);
      setSource(res.source);
      setFetched(res.name && res.howTo ? "found" : res.name ? "partial" : "none");
    },
    onError: (e: Error) => {
      setFetched("none");
      toast.error(e.message);
    },
  });
  const save = useMutation({
    mutationFn: useServerFn(saveRoutineOverride),
    onSuccess: () => {
      toast.success("Saved — your routine shows your product");
      void invalidate();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const clear = useMutation({
    mutationFn: useServerFn(clearRoutineOverride),
    onSuccess: () => {
      toast.success("Back to your clinic's recommendation");
      void invalidate();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      data-qc="routine-editor"
      className="my-1 rounded-[16px] border border-edge-2 bg-glass-2 p-3 shadow-inset-hi"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        save.mutate({
          data: {
            routine_item_id: p.id,
            product_name: name.trim(),
            ...(howTo.trim() ? { how_to: howTo.trim() } : {}),
            ...(url.trim() ? { product_url: url.trim() } : {}),
            source,
          },
        });
      }}
    >
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold">
          {p.step} <span className="font-normal text-muted-foreground">· clinic suggested {p.product_name}</span>
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close editor"
          className="ml-auto grid h-6 w-6 cursor-pointer place-items-center rounded-full text-ink-3 hover:bg-glass-hi hover:text-foreground"
        >
          <X className="h-3 w-3" aria-hidden />
        </button>
      </div>

      <label className="mt-2 block">
        <span className="text-2xs font-semibold text-muted-foreground">Paste a product link</span>
        <span className="mt-1 flex gap-1.5">
          <span className="relative min-w-0 flex-1">
            <Link2 className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              type="url"
              value={url}
              data-qc="routine-url"
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="h-8 w-full rounded-[10px] border border-edge-2 bg-glass-hi pl-7 pr-2 text-xs shadow-inset-hi outline-none focus:border-edge"
            />
          </span>
          <button
            type="button"
            data-qc="routine-fetch"
            disabled={!url.trim() || extract.isPending}
            onClick={() => extract.mutate({ data: { url: url.trim() } })}
            className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-full bg-glass-hi px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--edge-2)] hover:bg-[rgba(47,63,102,0.08)] disabled:cursor-default disabled:opacity-50"
          >
            {extract.isPending ? "Reading…" : "Fetch details"}
          </button>
        </span>
      </label>
      {fetched ? (
        <p className={cn("mt-1 text-2xs", fetched === "none" ? "text-destructive-ink" : "text-muted-foreground")} data-qc="routine-fetch-result">
          {fetched === "found"
            ? source === "ai"
              ? "Read by the assistant — check the details below, then save."
              : "Found on the page — check the details below, then save."
            : fetched === "partial"
              ? "Found the name; add how you use it below."
              : "Could not read that page. Type the product in below."}
        </p>
      ) : null}

      <label className="mt-2 block">
        <span className="text-2xs font-semibold text-muted-foreground">Product name</span>
        <input
          value={name}
          data-qc="routine-name"
          onChange={(e) => {
            setName(e.target.value);
            setSource("manual");
          }}
          maxLength={200}
          required
          placeholder="e.g. CeraVe Hydrating Cleanser"
          className="mt-1 h-8 w-full rounded-[10px] border border-edge-2 bg-glass-hi px-2.5 text-xs shadow-inset-hi outline-none focus:border-edge"
        />
      </label>
      <label className="mt-2 block">
        <span className="text-2xs font-semibold text-muted-foreground">How you use it</span>
        <textarea
          value={howTo}
          data-qc="routine-howto"
          onChange={(e) => setHowTo(e.target.value)}
          rows={2}
          maxLength={600}
          placeholder={p.how_to ?? "e.g. A pea-sized amount on damp skin, morning and evening."}
          className="mt-1 w-full resize-none rounded-[10px] border border-edge-2 bg-glass-hi px-2.5 py-1.5 text-xs leading-relaxed shadow-inset-hi outline-none focus:border-edge"
        />
      </label>

      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="submit"
          data-qc="routine-save"
          disabled={!name.trim() || save.isPending}
          className="inline-flex h-7 cursor-pointer items-center rounded-full bg-accent px-3 text-xs font-semibold text-accent-foreground shadow-bloom hover:brightness-105 disabled:opacity-60"
        >
          {save.isPending ? "Saving…" : "Save my product"}
        </button>
        {p.override ? (
          <button
            type="button"
            data-qc="routine-clear"
            disabled={clear.isPending}
            onClick={() => clear.mutate({ data: { routine_item_id: p.id } })}
            className="inline-flex h-7 cursor-pointer items-center rounded-full px-3 text-xs font-semibold text-ink-2 hover:bg-[rgba(47,63,102,0.08)]"
          >
            Use clinic's recommendation
          </button>
        ) : null}
      </div>
    </form>
  );
}
