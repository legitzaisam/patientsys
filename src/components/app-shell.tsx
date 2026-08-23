import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard,
  Users,
  HeartPulse,
  LogOut,
  CalendarDays,
  UserCog,
  Settings as SettingsIcon,
  TrendingUp,
  Wallet,
  IdCard,
  ChevronDown,
  Repeat,
  Megaphone,
  PanelLeft,
  PanelLeftClose,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrivalAlerts } from "@/components/arrival-alerts";
import { AlertAckToaster } from "@/components/alert-ack-toaster";
import { UrgentStaffAlerts } from "@/components/urgent-staff-alerts";
import { SentStaffAlerts } from "@/components/sent-staff-alerts";
import { BrandLockup } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NotificationBell } from "@/components/notification-bell";
import { StaffAlertDialog } from "@/components/staff-alert-dialog";
import { DemoRoleSwitcher } from "@/components/demo/role-switcher";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { listAppointments, listTeam } from "@/lib/clinic.functions";
import { clinicDayRange } from "@/lib/clinic-time";
import { useAuthSessionReady } from "@/lib/use-auth-session-ready";
import { can } from "@/lib/permissions";
import { initialsOf, laneFor } from "@/lib/practitioner-colours";
import { useStaffPresence } from "@/lib/use-staff-presence";
import { cn } from "@/lib/utils";

type Identity = {
  userId?: string;
  email: string;
  isStaff: boolean;
  isOwner?: boolean;
  isManager?: boolean;
  roles: string[];
  permissions?: string[];
  profile: { full_name?: string | null; job_title?: string | null } | null;
  patient: { first_name: string; last_name: string } | null;
};

type NavLink = { to: string; label: string; icon: typeof LayoutDashboard; badge?: number };

function NavItem({
  item,
  active,
  onNavigate,
}: {
  item: NavLink;
  active: boolean;
  onNavigate?: (() => void) | undefined;
}) {
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-[11px] px-2.5 py-2.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-[linear-gradient(96deg,var(--accent-soft),transparent_96%)] font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge),inset_0_1px_0_var(--edge-hi)]"
          : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.12)]",
      )}
    >
      <span
        className={cn(
          "grid h-5 w-5 shrink-0 place-items-center rounded-[6px] border",
          active
            ? "border-transparent bg-[linear-gradient(140deg,var(--accent-hi),var(--accent))] text-accent-foreground shadow-bloom"
            : "border-edge bg-glass-2 text-ink-2",
        )}
      >
        <item.icon className="h-3 w-3" />
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge != null && item.badge > 0 && (
        <span className="text-[11px] font-medium tabular-nums text-ink-3">{item.badge}</span>
      )}
    </Link>
  );
}

function NavGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="px-1.5 pb-2 pt-1 text-sm font-semibold tracking-[0.02em] text-ink-3">{label}</p>
      {children}
    </div>
  );
}

function ToolbarAlerts({
  identity,
  scrolled,
}: {
  identity: Identity;
  scrolled: boolean;
}) {
  const iconHover =
    "hover:border-edge-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground hover:shadow-lift active:bg-[rgba(47,63,102,0.14)]";
  return (
    <>
      {identity.isStaff && (
        <StaffAlertDialog>
          <Button
            variant={scrolled ? "outline" : "ghost"}
            size="icon"
            className={cn("relative h-9 w-9", iconHover, !scrolled && "border border-transparent")}
            aria-label="Alert team"
          >
            <Megaphone className="h-4 w-4" />
          </Button>
        </StaffAlertDialog>
      )}
      {identity.isStaff && (
        <SentStaffAlerts scrolled={scrolled} className={iconHover} />
      )}
      <NotificationBell isStaff={identity.isStaff} scrolled={scrolled} />
    </>
  );
}

function AccountMenu({
  identity,
  displayName,
  roleLabel,
  canTeam,
  canSettings,
  signOut,
}: {
  identity: Identity;
  displayName: string;
  roleLabel: string;
  canTeam: boolean;
  canSettings: boolean;
  signOut: () => void;
}) {
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex max-w-[220px] cursor-pointer items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-left hover:bg-[rgba(47,63,102,0.08)] active:bg-[rgba(47,63,102,0.14)]"
          aria-label="Account menu"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-foreground shadow-bloom">
            {initialsOf(displayName)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12.5px] font-semibold leading-tight text-foreground">{displayName}</span>
            <span className="block truncate text-[11px] capitalize text-ink-2">{roleLabel}</span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {identity.isStaff ? (
          <>
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
          </>
        ) : (
          <DropdownMenuItem onClick={() => navigate({ to: "/my-record" })}>
            <HeartPulse className="h-4 w-4" />
            My record
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarChrome({
  identity,
  pathname,
  clinicLinks,
  reportLinks,
  extraLinks,
  teamMembers,
  onlineIds,
  canTeam,
  query,
  setQuery,
  searchRef,
  onSearch,
  onNavigate,
  onCollapse,
}: {
  identity: Identity;
  pathname: string;
  clinicLinks: NavLink[];
  reportLinks: NavLink[];
  extraLinks: NavLink[];
  teamMembers: { id: string; fullName: string }[];
  onlineIds: Set<string>;
  canTeam: boolean;
  query: string;
  setQuery: (value: string) => void;
  searchRef?: RefObject<HTMLInputElement | null> | undefined;
  onSearch: (e?: FormEvent) => void;
  onNavigate?: (() => void) | undefined;
  onCollapse: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-5 px-4 py-5">
      <div className="flex items-center gap-1">
        <BrandLockup to={identity.isStaff ? "/dashboard" : "/my-record"} className="min-w-0 flex-1 px-1.5" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-ink-3 hover:text-foreground"
          onClick={onCollapse}
          aria-label="Close sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      {identity.isStaff && (
        <form onSubmit={onSearch} className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patients"
            aria-label="Search patients"
            className="h-auto rounded-[11px] border-edge bg-glass-2 py-2 pl-[34px] pr-3 text-[12.5px]"
          />
        </form>
      )}

      <nav className="mt-1 min-h-0 flex-1 space-y-6 overflow-y-auto pb-5">
        <NavGroup label={identity.isStaff ? "Clinic" : "Care"}>
          {clinicLinks.map((item) => (
            <NavItem key={item.to} item={item} active={pathname.startsWith(item.to)} onNavigate={onNavigate} />
          ))}
        </NavGroup>

        {reportLinks.length > 0 && (
          <NavGroup label="Reports">
            {reportLinks.map((item) => (
              <NavItem key={item.to} item={item} active={pathname.startsWith(item.to)} onNavigate={onNavigate} />
            ))}
          </NavGroup>
        )}

        {extraLinks.length > 0 && (
          <NavGroup label="You">
            {extraLinks.map((item) => (
              <NavItem key={item.to} item={item} active={pathname.startsWith(item.to)} onNavigate={onNavigate} />
            ))}
          </NavGroup>
        )}

        {identity.isStaff && teamMembers.length > 0 && (
          <NavGroup label="Team">
            {teamMembers.map((member) => {
              const name = member.fullName || "Team member";
              const tone = laneFor(member.id);
              const active = pathname === `/team/${member.id}`;
              const online = onlineIds.has(member.id);
              const className = cn(
                "flex items-center gap-2.5 rounded-[11px] px-2.5 py-2.5 text-[13px] font-medium transition-colors",
                active
                  ? "bg-[linear-gradient(96deg,var(--accent-soft),transparent_96%)] font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge),inset_0_1px_0_var(--edge-hi)]"
                  : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.12)]",
              );
              return (
                <Link
                  key={member.id}
                  to="/team/$id"
                  search={{}}
                  params={{ id: member.id }}
                  onClick={onNavigate}
                  className={className}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-accent-foreground",
                      tone.edge,
                      online && "ring-2 ring-[#4a9d75] ring-offset-2 ring-offset-[var(--sidebar)]",
                    )}
                    title={online ? "Online" : undefined}
                    aria-label={online ? `${name}, online` : name}
                  >
                    {initialsOf(name)}
                  </span>
                  <span className="truncate">{name}</span>
                </Link>
              );
            })}
          </NavGroup>
        )}
      </nav>
    </div>
  );
}

const SIDEBAR_KEY = "aetheria.sidebar";
const SIDEBAR_WIDTH_KEY = "aetheria.sidebarWidth";
const SIDEBAR_DEFAULT = 238;
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 420;

function clampSidebarWidth(value: number) {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(value)));
}

function readStoredWidth() {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed)) return clampSidebarWidth(parsed);
  } catch {
    /* ignore */
  }
  return SIDEBAR_DEFAULT;
}

export function AppShell({ identity, children }: { identity: Identity; children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sessionReady = useAuthSessionReady();
  const searchRef = useRef<HTMLInputElement>(null);
  const mainScrollRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [scrolled, setScrolled] = useState(false);
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    const main = mainScrollRef.current;
    if (!main) return;
    main.scrollTo({ top: 0, left: 0, behavior: "instant" });
    setScrolled(false);
  }, [pathname]);

  const fetchTeam = useServerFn(listTeam);
  const fetchAppointments = useServerFn(listAppointments);
  const { startISO, endISO } = clinicDayRange();

  const { data: team } = useQuery({
    queryKey: ["team"],
    queryFn: () => fetchTeam(),
    enabled: identity.isStaff && sessionReady,
  });

  const teamMembers = useMemo(() => {
    const rows = team ?? [];
    const byId = new Map<string, { id: string; fullName: string }>();
    for (const row of rows) {
      if (byId.has(row.userId)) continue;
      byId.set(row.userId, {
        id: row.userId,
        fullName: row.fullName?.trim() || row.email || "Team member",
      });
    }
    return [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [team]);

  const onlineIds = useStaffPresence(Boolean(identity.isStaff && sessionReady), identity.userId);

  const { data: todayAppointments } = useQuery({
    queryKey: ["sidebar-diary-count", startISO],
    queryFn: () => fetchAppointments({ data: { from: startISO, to: endISO } }),
    refetchInterval: 60_000,
    enabled: identity.isStaff && sessionReady,
  });
  const diaryCount = (todayAppointments ?? []).length;

  const canRetention = can(identity, "reports.retention");
  const canPerformance = can(identity, "reports.performance");
  const canTeam = can(identity, "team.view");
  const canSettings = can(identity, "settings.treatments");
  const isPractitioner = identity.roles.includes("practitioner");

  const clinicLinks: NavLink[] = identity.isStaff
    ? [
        { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
        { to: "/schedule", label: "Diary", icon: CalendarDays, badge: diaryCount },
        { to: "/patients", label: "Patients", icon: Users },
      ]
    : [{ to: "/my-record", label: "My record", icon: HeartPulse }];

  const reportLinks: NavLink[] = [
    ...(canRetention ? [{ to: "/retention", label: "Retention", icon: Repeat }] : []),
    ...(canPerformance ? [{ to: "/performance", label: "Performance", icon: TrendingUp }] : []),
  ];

  const extraLinks: NavLink[] =
    identity.isStaff && isPractitioner && !identity.isManager
      ? [{ to: "/earnings", label: "My earnings", icon: Wallet }]
      : [];

  const displayName =
    identity.profile?.full_name ||
    (identity.patient ? `${identity.patient.first_name} ${identity.patient.last_name}` : identity.email);
  const roleLabel = identity.isStaff
    ? identity.isOwner
      ? "Clinic owner"
      : identity.roles.includes("manager")
        ? "Manager"
        : identity.profile?.job_title || identity.roles[0]?.replace("_", " ") || "Staff"
    : "Patient";

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function setOpen(next: boolean) {
    setSidebarOpen(next);
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? "open" : "closed");
    } catch {
      /* ignore quota / private mode */
    }
  }

  function submitSearch(e?: FormEvent) {
    e?.preventDefault();
    if (!identity.isStaff) return;
    const q = query.trim();
    void navigate({
      to: "/patients",
      search: q ? { view: "all", q } : { view: "all" },
    });
  }

  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_KEY) === "closed") setSidebarOpen(false);
      setSidebarWidth(readStoredWidth());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setScrolled(false);
  }, [pathname]);

  function persistWidth(next: number) {
    const width = clampSidebarWidth(next);
    setSidebarWidth(width);
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(width));
    } catch {
      /* ignore */
    }
  }

  function onResizePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    dragRef.current = { startX: event.clientX, startWidth: sidebarWidth };
    document.body.classList.add("select-none", "cursor-col-resize");

    function onMove(moveEvent: globalThis.PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      persistWidth(drag.startWidth + (moveEvent.clientX - drag.startX));
    }

    function onUp() {
      dragRef.current = null;
      document.body.classList.remove("select-none", "cursor-col-resize");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "[" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
          return;
        }
        event.preventDefault();
        setOpen(!sidebarOpen);
        return;
      }
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      event.preventDefault();
      if (!sidebarOpen) setOpen(true);
      requestAnimationFrame(() => searchRef.current?.focus());
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  const chrome = {
    identity,
    pathname,
    clinicLinks,
    reportLinks,
    extraLinks,
    teamMembers,
    onlineIds,
    canTeam,
    query,
    setQuery,
    onSearch: submitSearch,
    onCollapse: () => setOpen(false),
  };

  return (
    <div className="flex h-dvh overflow-hidden">
      {sidebarOpen && (
        <aside
          className="relative flex h-dvh shrink-0 flex-col border-r border-edge bg-sidebar shadow-[inset_-1px_0_0_var(--edge-hi)] backdrop-blur-glass"
          style={{ width: sidebarWidth }}
        >
          <SidebarChrome {...chrome} searchRef={searchRef} />
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            aria-valuemin={SIDEBAR_MIN}
            aria-valuemax={SIDEBAR_MAX}
            aria-valuenow={sidebarWidth}
            tabIndex={0}
            onPointerDown={onResizePointerDown}
            onDoubleClick={() => persistWidth(SIDEBAR_DEFAULT)}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                persistWidth(sidebarWidth - 16);
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                persistWidth(sidebarWidth + 16);
              }
            }}
            className="absolute inset-y-0 right-0 z-10 w-1 cursor-col-resize touch-none hover:bg-accent-soft"
          />
        </aside>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <main
          id="app-main-scroll"
          ref={mainScrollRef}
          className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-5 pb-5 sm:px-[26px]"
          onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 8)}
        >
          <div className="pointer-events-none sticky top-0 z-20 -mx-5 flex h-[3.25rem] shrink-0 items-center gap-3 px-5 pt-1.5 sm:-mx-[26px] sm:px-7">
            {!sidebarOpen && (
              <Button
                variant="outline"
                size="icon"
                className="pointer-events-auto h-9 w-9"
                onClick={() => setOpen(true)}
                aria-label="Open sidebar"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="pointer-events-auto ml-auto flex items-center gap-2">
              <ToolbarAlerts identity={identity} scrolled={scrolled} />
              <AccountMenu
                identity={identity}
                displayName={displayName}
                roleLabel={roleLabel}
                canTeam={canTeam}
                canSettings={canSettings}
                signOut={signOut}
              />
            </div>
          </div>
          <div className="mx-auto -mt-1 flex w-full max-w-[1400px] flex-1 shrink-0 flex-col">
            {children}
          </div>
        </main>
      </div>

      {identity.isStaff && (
        <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(18rem,calc(100vw-2.5rem))] flex-col-reverse items-end gap-3">
          <div className="pointer-events-auto flex w-full justify-end">
            <ArrivalAlerts roles={identity.roles} />
          </div>
          <div className="pointer-events-auto flex w-full justify-end">
            <UrgentStaffAlerts />
          </div>
        </div>
      )}
      {identity.isStaff && <AlertAckToaster />}
      {DEMO_MODE && <DemoRoleSwitcher />}
    </div>
  );
}
