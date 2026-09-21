import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  Clock,
  Droplet,
  FileText,
  Heart,
  Mail,
  MapPin,
  Megaphone,
  PenLine,
  Sparkles,
  Tag,
  User,
} from "lucide-react";
import { getPortalHome } from "@/lib/clinic.functions";
import {
  PortalBanner,
  PortalCard,
  PortalHead,
  PortalLink,
  PortalPhoto,
  PortalRing,
  PortalTile,
} from "@/components/portal/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/my-record/")({
  component: PortalHome,
});

function greeting(now = new Date()) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function PortalHome() {
  const navigate = useNavigate();
  const fetchHome = useServerFn(getPortalHome);
  const { data, isLoading } = useQuery({ queryKey: ["portal-home"], queryFn: () => fetchHome() });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading your care…</p>;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">No record linked yet.</p>;

  const { plan, clinician, nextAppointment, news, offer, latestMessage, progressSteps } = data;

  return (
    <div data-qc="portal-home">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {greeting()}, {data.patient.firstName}
          </h1>
          <p className="page-subtitle">A simple view of your skin journey, clinic updates and what's next.</p>
        </div>
        <p className="hidden -rotate-6 text-center font-[Caveat,cursive] text-[17px] leading-tight text-accent-ink lg:block">
          <span className="block">Progress</span>
          <span className="block">looks good</span>
          <span className="block">on you.</span>
        </p>
      </div>

      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        <PortalTile
          icon={FileText}
          label="Current skin plan"
          value={plan?.name ?? "No active plan"}
          sub={plan?.strapline ?? "Your clinic will set one up with you."}
          onClick={() => navigate({ to: "/my-record/plan" })}
        />
        <PortalTile
          lead={<PortalRing pct={plan?.completion ?? 0} size={44} stroke={5} />}
          value="Plan completion"
          sub={plan ? `${plan.milestonesDone} of ${plan.milestonesTotal} milestones` : "—"}
          onClick={() => navigate({ to: "/my-record/plan" })}
        />
        <PortalTile
          icon={CalendarDays}
          iconClass="bg-sky-bg text-sky-ink"
          label="Next appointment"
          value={nextAppointment?.date ?? "Nothing booked"}
          sub={nextAppointment?.time ?? "Message your clinic to book"}
          onClick={() => navigate({ to: "/my-record/appointments" })}
        />
        <PortalTile
          icon={User}
          iconClass="bg-rose-bg text-rose-ink"
          label="Your clinician"
          value={clinician?.name ?? "Your care team"}
          sub={clinician?.title ?? "Aetheria Skin Clinic"}
          onClick={() => navigate({ to: "/my-record/clinic" })}
        />
      </div>

      <div className="mt-3.5 grid items-start gap-3.5 xl:grid-cols-3">
        {/* ------------------------------------------------- column 1 */}
        <div className="grid gap-3.5">
          <PortalCard>
            <PortalHead
              icon={Megaphone}
              title="Clinic news"
              action={<PortalLink onClick={() => navigate({ to: "/my-record/resources" })}>See all</PortalLink>}
            />
            {news ? (
              <>
                <PortalPhoto icon={Building2} height={96} label="Clinic" />
                <p className="mt-2.5 text-[13px] font-semibold">{news.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{news.body}</p>
                {news.cta_label && (
                  <button
                    type="button"
                    onClick={() => navigate({ to: "/my-record/resources" })}
                    className="mt-2.5 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-glass-2 px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--edge-2)] hover:bg-[rgba(47,63,102,0.08)]"
                  >
                    {news.cta_label}
                    <ArrowRight className="h-3 w-3" aria-hidden />
                  </button>
                )}
              </>
            ) : (
              <p className="py-4 text-xs text-muted-foreground">No clinic updates right now.</p>
            )}
          </PortalCard>

          <PortalCard>
            <PortalHead
              icon={BarChart3}
              title="Your plan progress"
              action={<PortalLink onClick={() => navigate({ to: "/my-record/plan/timeline" })}>View full plan</PortalLink>}
            />
            {plan ? (
              <>
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-semibold">{plan.name}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {plan.milestonesDone} of {plan.milestonesTotal} milestones
                  </p>
                </div>
                <div className="mt-3.5 flex">
                  {progressSteps.map((s: any, i: number) => (
                    <div key={`${s.label}-${i}`} className="relative min-w-0 flex-1 text-center">
                      {i > 0 && (
                        <span
                          className={cn(
                            "absolute left-[-50%] right-1/2 top-2 h-0.5",
                            s.state === "upcoming" ? "bg-bar" : "bg-success",
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "relative mx-auto grid h-[17px] w-[17px] place-items-center rounded-full text-white",
                          s.state === "done" && "bg-success",
                          s.state === "current" && "bg-accent text-accent-foreground",
                          s.state === "upcoming" && "bg-glass-2 shadow-[inset_0_0_0_1.5px_var(--bar)]",
                        )}
                      >
                        {s.state === "done" && <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />}
                        {s.state === "current" && <span className="h-1.5 w-1.5 rounded-full bg-accent-ink" />}
                      </span>
                      <p className="mt-1.5 line-clamp-2 text-[9.5px] leading-tight text-ink-2">{s.label}</p>
                      {s.note && <p className="text-[8.5px] text-ink-3">{s.note}</p>}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="py-4 text-xs text-muted-foreground">No plan yet.</p>
            )}
          </PortalCard>
        </div>

        {/* ------------------------------------------------- column 2 */}
        <div className="grid gap-3.5">
          <PortalCard>
            <PortalHead
              icon={Tag}
              title="Special offers"
              action={<PortalLink onClick={() => navigate({ to: "/my-record/resources" })}>See all</PortalLink>}
            />
            {offer ? (
              <div className="flex items-center gap-2.5 rounded-[14px] bg-rose-bg px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  {offer.flag && (
                    <span className="inline-flex items-center rounded-full bg-rose-bg px-2 py-0.5 text-[9px] font-semibold text-rose-ink shadow-[inset_0_0_0_1px_rgba(168,80,117,0.25)]">
                      {offer.flag}
                    </span>
                  )}
                  <p className="mt-1.5 text-[13.5px] font-semibold">{offer.title}</p>
                  {offer.body && <p className="mt-1 text-xs text-muted-foreground">{offer.body}</p>}
                  {offer.cta_label && (
                    <button
                      type="button"
                      onClick={() => navigate({ to: "/my-record/resources" })}
                      className="mt-2 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-white px-3 text-xs font-semibold shadow-glass"
                    >
                      {offer.cta_label}
                      <ArrowRight className="h-3 w-3" aria-hidden />
                    </button>
                  )}
                </div>
                <PortalPhoto icon={Droplet} height={92} className="w-[70px] shrink-0" />
              </div>
            ) : (
              <p className="py-4 text-xs text-muted-foreground">No offers right now.</p>
            )}
          </PortalCard>

          <PortalCard>
            <PortalHead
              icon={Mail}
              title="Latest message from your clinic"
              action={<PortalLink onClick={() => navigate({ to: "/my-record/messages" })}>See all</PortalLink>}
            />
            {latestMessage ? (
              <>
                <div className="flex gap-2.5">
                  <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-accent-soft text-2xs font-semibold text-accent-ink">
                    {(latestMessage.from ?? "Clinic")
                      .split(/\s+/)
                      .slice(0, 2)
                      .map((w: string) => w[0]?.toUpperCase() ?? "")
                      .join("")}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">{latestMessage.from ?? "Your clinic"}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(latestMessage.createdAt).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <p className="mt-2.5 text-xs leading-relaxed text-ink-2">{latestMessage.body}</p>
                <Link
                  to="/my-record/messages"
                  className="mt-2.5 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-glass-2 px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--edge-2)] hover:bg-[rgba(47,63,102,0.08)]"
                >
                  Reply
                  <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </>
            ) : (
              <p className="py-4 text-xs text-muted-foreground">No messages yet.</p>
            )}
          </PortalCard>
        </div>

        {/* ------------------------------------------------- column 3 */}
        <div className="grid gap-3.5">
          <PortalCard>
            <PortalHead icon={CalendarDays} title="Your next appointment" />
            {nextAppointment ? (
              <>
                <div className="flex gap-3">
                  <div className="shrink-0 rounded-[16px] bg-accent-wash px-3 py-2.5 text-center shadow-inset-hi">
                    <p className="text-xs font-semibold text-muted-foreground">{nextAppointment.weekday}</p>
                    <p className="text-[22px] font-semibold leading-tight tabular-nums">{nextAppointment.day}</p>
                    <p className="text-xs text-muted-foreground">{nextAppointment.monthYear}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold">{nextAppointment.treatment}</p>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" aria-hidden /> {nextAppointment.time}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" aria-hidden /> Aetheria Skin Clinic
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link
                    to="/my-record/appointments"
                    className="inline-flex h-7 flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-full bg-accent px-3 text-xs font-semibold text-accent-foreground shadow-bloom hover:brightness-105"
                  >
                    Confirm appointment
                  </Link>
                  <Link
                    to="/my-record/messages"
                    className="inline-flex h-7 flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-full bg-glass-2 px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--edge-2)] hover:bg-[rgba(47,63,102,0.08)]"
                  >
                    Reschedule
                  </Link>
                </div>
              </>
            ) : (
              <p className="py-4 text-xs text-muted-foreground">Nothing booked yet.</p>
            )}
          </PortalCard>

          <PortalCard>
            <PortalHead icon={Sparkles} title="Quick actions" />
            <div>
              {[
                { icon: FileText, label: "Upload a result", to: "/my-record/records" as const },
                { icon: Mail, label: "Message your clinic", to: "/my-record/messages" as const },
                { icon: PenLine, label: "Complete your daily journal", to: "/my-record/plan/journal" as const },
                { icon: Droplet, label: "View your skincare routine", to: "/my-record/plan/routine" as const },
              ].map((a) => (
                <Link
                  key={a.label}
                  to={a.to}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[rgba(47,63,102,0.08)]"
                >
                  <a.icon className="h-4 w-4 shrink-0 text-accent-ink" aria-hidden />
                  <span className="text-xs">{a.label}</span>
                  <ArrowRight className="ml-auto h-3 w-3 shrink-0 text-ink-3" aria-hidden />
                </Link>
              ))}
            </div>
          </PortalCard>
        </div>
      </div>

      <div className="mt-3.5">
        <PortalBanner
          icon={Heart}
          title="You're doing great"
          body="Consistency brings real results. Keep going — your skin journey matters."
          cta="View your journey"
          onCta={() => navigate({ to: "/my-record/plan" })}
        />
      </div>
    </div>
  );
}
