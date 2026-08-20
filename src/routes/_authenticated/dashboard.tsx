import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { getDashboard, getRetention, getCatalogue, listAccountsMissingEmail, listAppointments, listPatients, listPractitioners } from "@/lib/clinic.functions";
import { clinicWeekRange } from "@/lib/clinic-time";
import { useIdentity } from "@/lib/use-identity";
import { can } from "@/lib/permissions";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { QuickAddAppointment } from "@/components/quick-add-appointment";
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
  const [diarySpan, setDiarySpan] = useState<"day" | "week">(() =>
    typeof window !== "undefined" && localStorage.getItem("aetheria.dashboard-diary-span") === "week"
      ? "week"
      : "day",
  );
  const weekRange = useMemo(() => clinicWeekRange(), []);
  const fetchDashboard = useServerFn(getDashboard);
  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
    enabled: !!identity?.isStaff,
  });
  const fetchRetention = useServerFn(getRetention);
  const { data: retention } = useQuery({
    queryKey: ["retention"],
    queryFn: () => fetchRetention(),
    enabled: !!identity?.isStaff && can(identity, "reports.retention"),
  });
  const fetchIncomplete = useServerFn(listAccountsMissingEmail);
  const { data: incomplete } = useQuery({
    queryKey: ["accounts-missing-email"],
    queryFn: () => fetchIncomplete(),
    enabled: !!identity?.isManager,
  });
  const fetchPatients = useServerFn(listPatients);
  const fetchPractitioners = useServerFn(listPractitioners);
  const fetchCatalogue = useServerFn(getCatalogue);
  const staffEnabled = !!identity?.isStaff;
  const { data: patients } = useQuery({
    queryKey: ["patients"],
    queryFn: () => fetchPatients(),
    enabled: staffEnabled,
  });
  const { data: practitioners } = useQuery({
    queryKey: ["practitioners"],
    queryFn: () => fetchPractitioners(),
    enabled: staffEnabled,
  });
  const { data: catalogue } = useQuery({
    queryKey: ["catalogue"],
    queryFn: () => fetchCatalogue(),
    enabled: staffEnabled,
  });
  const fetchWeek = useServerFn(listAppointments);
  const { data: weekAppointments } = useQuery({
    queryKey: ["dashboard-week", weekRange.startISO, weekRange.endISO],
    queryFn: () => fetchWeek({ data: { from: weekRange.startISO, to: weekRange.endISO } }),
    enabled: staffEnabled && diarySpan === "week",
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

  const diaryHeading =
    diarySpan === "week"
      ? `${formatDiaryDay(weekRange.startKey)} – ${formatDiaryDay(weekRange.endKey)}`
      : new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const isPractitioner = identity.roles.includes("practitioner");
  const diaryAppointments =
    diarySpan === "week"
      ? ((weekAppointments ?? []) as any[]).filter(
          (a) => isManager || !isPractitioner || a.practitioner_id === identity.userId,
        )
      : (data?.todayAppointments ?? []);

  function chooseDiarySpan(next: "day" | "week") {
    setDiarySpan(next);
    localStorage.setItem("aetheria.dashboard-diary-span", next);
  }

  return (
    <AppShell identity={identity}>
      <div className="page-header">
        <div>
          <h1 className="page-title">{heading}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subheading}</p>
        </div>
      </div>

      <section className="mb-8">
            <KpiGrid
              kpis={{
                ...data?.kpis,
                revenueAtRisk: retention?.summary?.revenueAtRisk ?? 0,
                patientsToChase: retention?.atRisk?.length ?? 0,
              }}
              canRetention={canRetention}
              canRevenue={canRevenue}
            />
      </section>

      <section className="mb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">{diaryHeading}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-[34px] items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi">
              {(["day", "week"] as const).map((span) => (
                <button
                  key={span}
                  type="button"
                  onClick={() => chooseDiarySpan(span)}
                  className={`h-7 cursor-pointer rounded-full px-3.5 text-xs capitalize tracking-[0.02em] transition-colors ${
                    diarySpan === span
                      ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                      : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]"
                  }`}
                >
                  {span}
                </button>
              ))}
            </div>
            <QuickAddAppointment
              patients={patients ?? []}
              practitioners={practitioners ?? []}
              catalogue={catalogue ?? []}
              date={new Date()}
              align="end"
              title="Quick book"
            >
              <Button>Quick book</Button>
            </QuickAddAppointment>
          </div>
        </div>
        <TodaySnapshot appointments={diaryAppointments} isManager={isManager} span={diarySpan} />
      </section>

      <div className="flex flex-1 flex-col gap-6 lg:flex-row">
        <section className="flex min-w-0 flex-1 flex-col gap-6">
          <div>
            <div className="mb-4">
              <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">Attention needed</h2>
              <p className="text-xs text-muted-foreground">Outstanding items that need action today or this week.</p>
            </div>
            <AttentionList items={[...(data?.attentionItems ?? []), ...incompleteItems]} />
          </div>
          <FollowUpTasks />
        </section>
        <NotesPanel />
      </div>
    </AppShell>
  );
}

function formatDiaryDay(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 12)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
