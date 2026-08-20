import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  Users,
  Repeat,
  TrendingUp,
  Wallet,
  UserCog,
  Settings as SettingsIcon,
  IdCard,
  type LucideIcon,
} from "lucide-react";
import { can, type PermissionKey } from "@/lib/permissions";
import { Card } from "@/components/ui/card";

type Identity = { isManager?: boolean; permissions?: string[]; roles: string[] };

type Shortcut = {
  to: string;
  label: string;
  blurb: string;
  icon: LucideIcon;
  permission?: PermissionKey;
  roles?: string[];
};

const SHORTCUTS: Shortcut[] = [
  { to: "/schedule", label: "Diary", blurb: "Today's planner, bookings and arrivals", icon: CalendarDays },
  { to: "/patients", label: "Patients", blurb: "Records, photos, consent and messaging", icon: Users },
  {
    to: "/retention",
    label: "Retention",
    blurb: "At-risk patients and recall tasks",
    icon: Repeat,
    permission: "reports.retention",
  },
  {
    to: "/performance",
    label: "Performance",
    blurb: "Clinic KPIs and the earnings split",
    icon: TrendingUp,
    permission: "reports.performance",
  },
  {
    to: "/earnings",
    label: "My earnings",
    blurb: "Your treatments delivered and total earned",
    icon: Wallet,
    roles: ["practitioner"],
  },
  { to: "/team", label: "Team", blurb: "Staff profiles and documents", icon: UserCog, permission: "team.view" },
  {
    to: "/settings",
    label: "Settings",
    blurb: "Treatments, colours and clinic details",
    icon: SettingsIcon,
    permission: "settings.treatments",
  },
  { to: "/profile", label: "My profile", blurb: "Your details, documents and change requests", icon: IdCard },
];

/** Home shortcuts filtered to the modules this member is actually allowed to open. */
export function RoleShortcuts({ identity }: { identity: Identity }) {
  const items = SHORTCUTS.filter((s) => {
    if (s.permission && !can(identity, s.permission)) return false;
    if (s.roles && !s.roles.some((r) => identity.roles.includes(r))) return false;
    if (s.to === "/earnings" && identity.isManager) return false;
    return true;
  });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Link key={item.to} to={item.to}>
          <Card className="h-full p-4 transition-colors hover:border-accent-line">
            <item.icon className="h-4 w-4 text-ink-3" aria-hidden />
            <p className="mt-3 text-sm font-medium text-foreground">{item.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{item.blurb}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}
