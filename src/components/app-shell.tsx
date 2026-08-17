import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Users,
  HeartPulse,
  LogOut,
  ShieldCheck,
  CalendarDays,
  UserCog,
  Settings as SettingsIcon,
  TrendingUp,
  Wallet,
  IdCard,
  ChevronDown,
  Repeat,
  Megaphone,
  BarChart3,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrivalAlerts } from "@/components/arrival-alerts";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/notification-bell";
import { StaffAlertDialog } from "@/components/staff-alert-dialog";
import { DemoRoleSwitcher } from "@/components/demo/role-switcher";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { listStaffNotifications } from "@/lib/clinic.functions";
import { useAuthSessionReady } from "@/lib/use-auth-session-ready";
import { can } from "@/lib/permissions";
import { initialsOf } from "@/lib/practitioner-colours";
import { cn } from "@/lib/utils";

type Identity = {
  email: string;
  isStaff: boolean;
  isManager?: boolean;
  roles: string[];
  permissions?: string[];
  profile: { full_name?: string | null; job_title?: string | null } | null;
  patient: { first_name: string; last_name: string } | null;
};

export function AppShell({ identity, children }: { identity: Identity; children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionReady = useAuthSessionReady();
  const fetchAlerts = useServerFn(listStaffNotifications);
  const { data: staffAlerts } = useQuery({
    queryKey: ["staff-notifications"],
    queryFn: () => fetchAlerts(),
    refetchInterval: 60_000,
    enabled: identity.isStaff && sessionReady,
  });
  const urgentUnread = (staffAlerts ?? []).filter((a) => a.urgent).length;

  const canRetention = can(identity, "reports.retention");
  const canPerformance = can(identity, "reports.performance");
  const canTeam = can(identity, "team.view");
  const canSettings = can(identity, "settings.treatments");
  const isPractitioner = identity.roles.includes("practitioner");

  const reportLinks = [
    ...(canRetention ? [{ to: "/retention", label: "Retention", icon: Repeat }] : []),
    ...(canPerformance ? [{ to: "/performance", label: "Performance", icon: TrendingUp }] : []),
  ];

  const nav = identity.isStaff
    ? [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/schedule", label: "Diary", icon: CalendarDays },
        { to: "/patients", label: "Patients", icon: Users },
        ...(reportLinks.length > 1
          ? [{ label: "Reports", icon: BarChart3, children: reportLinks }]
          : reportLinks),
        ...(isPractitioner && !identity.isManager
          ? [{ to: "/earnings", label: "My earnings", icon: Wallet }]
          : []),
      ]
    : [{ to: "/my-record", label: "My record", icon: HeartPulse }];

  const displayName =
    identity.profile?.full_name ||
    (identity.patient ? `${identity.patient.first_name} ${identity.patient.last_name}` : identity.email);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-edge bg-sidebar shadow-inset-hi backdrop-blur-glass backdrop-saturate-150">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-8 px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-gradient-to-br from-accent-hi to-accent to-70% text-accent-foreground shadow-bloom">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="text-lg font-semibold tracking-[-0.016em] text-foreground">Aetheria</span>
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map((item) => {
              if ("children" in item) {
                const active = item.children.some((c) => pathname.startsWith(c.to));
                return (
                  <DropdownMenu key={item.label}>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-gradient-to-r from-accent-soft to-96% to-transparent font-semibold text-foreground shadow-inset-hi ring-1 ring-inset ring-edge"
                            : "text-muted-foreground hover:bg-glass-2 hover:text-foreground",
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="rounded-xl">
                      {item.children.map((child) => (
                        <DropdownMenuItem key={child.to} asChild>
                          <Link
                            to={child.to}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm"
                          >
                            <child.icon className="h-4 w-4" />
                            {child.label}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-gradient-to-r from-accent-soft to-96% to-transparent font-semibold text-foreground shadow-inset-hi ring-1 ring-inset ring-edge"
                      : "text-muted-foreground hover:bg-glass-2 hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {identity.isStaff && (
              <StaffAlertDialog>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 hover:bg-transparent hover:text-foreground"
                  aria-label={`Alert team${urgentUnread ? `, ${urgentUnread} urgent unread` : ""}`}
                >
                  <Megaphone className="h-4 w-4" />
                  {urgentUnread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-medium text-destructive-foreground">
                      {urgentUnread > 9 ? "9+" : urgentUnread}
                    </span>
                  )}
                </Button>
              </StaffAlertDialog>
            )}
            <NotificationBell isStaff={identity.isStaff} />
            {identity.isStaff ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="flex h-auto items-center gap-2.5 rounded-lg border border-edge bg-glass-2 px-2.5 py-1.5 shadow-inset-hi hover:bg-glass hover:text-foreground"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-2xs font-semibold text-accent-foreground shadow-bloom">
                      {initialsOf(displayName)}
                    </span>
                    <span className="hidden text-left sm:block">
                      <span className="block text-sm font-semibold leading-tight text-foreground">
                        {displayName}
                      </span>
                      <span className="block text-xs capitalize text-muted-foreground">
                        {identity.isManager
                          ? "Manager"
                          : identity.profile?.job_title ||
                            identity.roles[0]?.replace("_", " ") ||
                            "Staff"}
                      </span>
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate({ to: "/profile" })}>
                    <IdCard className="h-4 w-4" />
                    My profile
                  </DropdownMenuItem>
                  {canTeam && (
                    <DropdownMenuItem onClick={() => navigate({ to: "/team" })}>
                      <UserCog className="h-4 w-4" />
                      Team
                    </DropdownMenuItem>
                  )}
                  {(identity.isManager || canSettings) && (
                    <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                      <SettingsIcon className="h-4 w-4" />
                      Settings
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <div className="hidden items-center gap-2.5 rounded-lg border border-edge bg-glass-2 px-2.5 py-1.5 shadow-inset-hi sm:flex">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-2xs font-semibold text-accent-foreground shadow-bloom">
                    {initialsOf(displayName)}
                  </span>
                  <span className="text-left">
                    <span className="block text-sm font-semibold leading-tight text-foreground">
                      {displayName}
                    </span>
                    <span className="block text-xs text-muted-foreground">Patient</span>
                  </span>
                </div>
                <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-8">{children}</main>
      {identity.isStaff && <ArrivalAlerts roles={identity.roles} />}
      {DEMO_MODE && <DemoRoleSwitcher />}
    </div>
  );
}