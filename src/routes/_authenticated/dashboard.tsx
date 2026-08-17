import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getDashboard, listAccountsMissingEmail } from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { can } from "@/lib/permissions";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { TodaySnapshot } from "@/components/dashboard/today-snapshot";
import { AttentionList } from "@/components/dashboard/attention-list";
import { FollowUpTasks } from "@/components/dashboard/follow-up-tasks";
import { NotesPanel } from "@/components/dashboard/notes-panel";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Clinic dashboard — Aetheria" },
      { name: "description", content: "Today's diary, outstanding actions and clinic KPIs at a glance." },
      { property: "og:title", content: "Clinic dashboard — Aetheria" },
      { property: "og:description", content: "Today's diary, outstanding actions and clinic KPIs at a glance." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const navigate = useNavigate();
  const { data: identity } = useIdentity();
  const fetchDashboard = useServerFn(getDashboard);
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
    enabled: !!identity?.isStaff,
  });
  const fetchIncomplete = useServerFn(listAccountsMissingEmail);
  const { data: incomplete } = useQuery({
    queryKey: ["accounts-missing-email"],
    queryFn: () => fetchIncomplete(),
    enabled: !!identity?.isManager,
  });

  useEffect(() => {
    if (identity && !identity.isStaff) navigate({ to: "/my-record", replace: true });
  }, [identity, navigate]);

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!identity.isStaff) return null;

  const isManager = identity.isManager;
  const incompleteItems = [
    ...(incomplete?.staff ?? []).map((s) => ({
      id: `staff-${s.userId}`,
      kind: "incomplete_profile",
      urgency: "this_week",
      title: `${s.fullName} — no email on file`,
      subtitle: `${s.jobTitle || s.role.replace("_", " ")} · add an email so they can be contacted`,
      href: `/team/${s.userId}`,
    })),
    ...(incomplete?.patients ?? []).map((p) => ({
      id: `patient-${p.id}`,
      kind: "incomplete_profile",
      urgency: "this_week",
      title: `${p.name} — incomplete profile`,
      subtitle: `Missing ${p.gaps.join(", ")} · complete the record`,
      href: `/patients/${p.id}`,
    })),
  ];
  const isFrontDesk = identity.roles.includes("front_desk");
  const canRetention = can(identity, "reports.retention");
  const canRevenue = can(identity, "reports.performance");
  const heading = isManager ? "Clinic overview" : isFrontDesk ? "Front desk" : "My day";
  const subheading = isManager
    ? "Live picture of today's diary, what needs attention and clinic performance."
    : isFrontDesk
      ? "Today's arrivals, bookings and paperwork to chase."
      : "Your appointments, follow-ups and messages for today.";

  return (
    <AppShell identity={identity}>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.016em] text-foreground">{heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subheading}</p>
        </div>
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link to="/patients">Open patient list</Link>
        </Button>
      </div>

      <section className="mb-8">
        <KpiGrid kpis={data?.kpis} canRetention={canRetention} canRevenue={canRevenue} />
      </section>

      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          <Button asChild variant="ghost" className="text-xs">
            <Link to="/schedule">Open diary</Link>
          </Button>
        </div>
        <TodaySnapshot appointments={data?.todayAppointments ?? []} isManager={isManager} />
      </section>

      <section className="grid gap-6 sm:grid-cols-3 sm:items-start">
        <div>
          <div className="mb-4">
            <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">Attention needed</h2>
            <p className="text-xs text-muted-foreground">Outstanding items that need action today or this week.</p>
          </div>
          <AttentionList items={[...(data?.attentionItems ?? []), ...incompleteItems]} />
        </div>
        <FollowUpTasks />
        <div>
          <NotesPanel />
        </div>
      </section>
    </AppShell>
  );
}
