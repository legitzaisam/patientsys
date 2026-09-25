import { can, type PermissionKey } from "@/lib/permissions";

export type GrantRole = "manager" | "practitioner" | "front_desk" | "patient";
export type CatalogueKind = "page" | "tab" | "component";
export type SwitchRole = "practitioner" | "front_desk" | "patient";

export type CatalogueDefaults = Record<GrantRole, boolean>;

export type CatalogueNode = {
  id: string;
  parentId: string | null;
  kind: CatalogueKind;
  label: string;
  route: string;
  permission: PermissionKey;
  /** Roles that get a switch. Clinic owner is always on and is not listed. */
  columns: SwitchRole[];
  defaults: CatalogueDefaults;
};

const staffColumns: SwitchRole[] = ["practitioner", "front_desk"];
const patientColumns: SwitchRole[] = ["patient"];

const staffOn: CatalogueDefaults = {
  manager: true,
  practitioner: true,
  front_desk: true,
  patient: false,
};
const patientOn: CatalogueDefaults = {
  manager: false,
  practitioner: false,
  front_desk: false,
  patient: true,
};

function staff(overrides: Partial<CatalogueDefaults> = {}): CatalogueDefaults {
  return { ...staffOn, ...overrides };
}

function node(
  partial: Omit<CatalogueNode, "columns" | "defaults"> & {
    columns?: SwitchRole[];
    defaults?: CatalogueDefaults;
  },
): CatalogueNode {
  const portal = partial.permission.startsWith("view.portal.");
  return {
    ...partial,
    columns: partial.columns ?? (portal ? patientColumns : staffColumns),
    defaults: partial.defaults ?? (portal ? patientOn : staffOn),
  };
}

/**
 * Pages, tabs and major components a role can be shown.
 * The access editor is not a node: it cannot be granted from this list.
 */
export const ACCESS_CATALOGUE: CatalogueNode[] = [
  node({ id: "dashboard", parentId: null, kind: "page", label: "Dashboard", route: "/dashboard", permission: "view.dashboard" }),
  node({ id: "dashboard-diary", parentId: "dashboard", kind: "component", label: "Today's diary", route: "/dashboard", permission: "view.dashboard.diary" }),
  node({ id: "dashboard-attention", parentId: "dashboard", kind: "component", label: "Attention needed", route: "/dashboard", permission: "view.dashboard.attention" }),
  node({ id: "dashboard-followups", parentId: "dashboard", kind: "component", label: "Follow-up tasks", route: "/dashboard", permission: "view.dashboard.followups" }),
  node({
    id: "dashboard-delete-tasks",
    parentId: "dashboard-followups",
    kind: "component",
    label: "Delete follow-up tasks",
    route: "/dashboard",
    permission: "tasks.delete",
    defaults: staff({ manager: true, practitioner: false, front_desk: false }),
  }),
  node({ id: "dashboard-pauses", parentId: "dashboard", kind: "component", label: "Pause requests", route: "/dashboard", permission: "view.dashboard.pauses" }),
  node({ id: "dashboard-journeys", parentId: "dashboard", kind: "component", label: "Treatment journeys", route: "/dashboard", permission: "view.dashboard.journeys" }),
  node({
    id: "dashboard-revenue",
    parentId: "dashboard",
    kind: "component",
    label: "Revenue",
    route: "/dashboard",
    permission: "reports.performance",
    defaults: staff({ manager: true, practitioner: false, front_desk: false }),
  }),
  node({
    id: "dashboard-retention",
    parentId: "dashboard",
    kind: "component",
    label: "Retention figure",
    route: "/dashboard",
    permission: "reports.retention",
    defaults: staff({ manager: true, practitioner: true, front_desk: true }),
  }),

  node({ id: "schedule", parentId: null, kind: "page", label: "Diary", route: "/schedule", permission: "view.schedule" }),
  node({
    id: "schedule-book",
    parentId: "schedule",
    kind: "component",
    label: "Book and edit appointments",
    route: "/schedule",
    permission: "appointments.edit",
    defaults: staff(),
  }),

  node({ id: "patients", parentId: null, kind: "page", label: "Patients", route: "/patients", permission: "view.patients" }),
  node({ id: "patients-records", parentId: "patients", kind: "tab", label: "Records", route: "/patients", permission: "view.patients.records" }),
  node({ id: "patients-board", parentId: "patients", kind: "tab", label: "Journey board", route: "/patients", permission: "view.patients.board" }),
  node({
    id: "patients-add",
    parentId: "patients",
    kind: "component",
    label: "New patient",
    route: "/patients",
    permission: "patients.edit",
    defaults: staff(),
  }),
  node({
    id: "patients-offer",
    parentId: "patients",
    kind: "component",
    label: "Send an offer",
    route: "/patients",
    permission: "comms.send",
    defaults: staff(),
  }),
  node({ id: "patient-record", parentId: "patients", kind: "page", label: "Patient record", route: "/patients/$id", permission: "view.patients.record" }),
  node({ id: "patient-treatments", parentId: "patient-record", kind: "tab", label: "Treatments", route: "/patients/$id", permission: "view.patients.treatments" }),
  node({
    id: "patient-record-treatment",
    parentId: "patient-treatments",
    kind: "component",
    label: "Record a treatment",
    route: "/patients/$id",
    permission: "treatments.record",
    defaults: staff({ front_desk: false }),
  }),
  node({ id: "patient-photos", parentId: "patient-record", kind: "tab", label: "Before and after", route: "/patients/$id", permission: "view.patients.photos" }),
  node({
    id: "patient-upload-photos",
    parentId: "patient-photos",
    kind: "component",
    label: "Upload clinical photos",
    route: "/patients/$id",
    permission: "photos.manage",
    defaults: staff({ front_desk: false }),
  }),
  node({ id: "patient-documents", parentId: "patient-record", kind: "tab", label: "Documents", route: "/patients/$id", permission: "view.patients.documents" }),
  node({
    id: "patient-send-documents",
    parentId: "patient-documents",
    kind: "component",
    label: "Send documents",
    route: "/patients/$id",
    permission: "documents.send",
    defaults: staff(),
  }),
  node({ id: "patient-history", parentId: "patient-record", kind: "tab", label: "History updates", route: "/patients/$id", permission: "view.patients.history" }),
  node({ id: "patient-from-patient", parentId: "patient-record", kind: "tab", label: "From the patient", route: "/patients/$id", permission: "view.patients.from_patient" }),
  node({ id: "patient-contact", parentId: "patient-record", kind: "tab", label: "Contact", route: "/patients/$id", permission: "view.patients.contact" }),

  node({
    id: "team",
    parentId: null,
    kind: "page",
    label: "Team",
    route: "/team",
    permission: "team.view",
    defaults: staff(),
  }),
  node({ id: "team-current", parentId: "team", kind: "tab", label: "Current staff", route: "/team", permission: "view.team.current" }),
  node({ id: "team-former", parentId: "team", kind: "tab", label: "Former staff", route: "/team", permission: "view.team.former" }),
  node({
    id: "team-approve",
    parentId: "team",
    kind: "component",
    label: "Approve profile changes",
    route: "/team",
    permission: "team.approve_changes",
    defaults: staff({ manager: true, practitioner: false, front_desk: false }),
  }),

  node({ id: "profile", parentId: null, kind: "page", label: "My profile", route: "/profile", permission: "view.profile" }),

  node({ id: "settings", parentId: null, kind: "page", label: "Settings", route: "/settings", permission: "view.settings" }),
  node({
    id: "settings-edit",
    parentId: "settings",
    kind: "component",
    label: "Edit treatments and clinic details",
    route: "/settings",
    permission: "settings.treatments",
    defaults: staff({ practitioner: false, front_desk: true }),
  }),

  node({
    id: "insights",
    parentId: null,
    kind: "page",
    label: "Insights",
    route: "/insights",
    permission: "reports.insights",
    defaults: staff({ practitioner: false, front_desk: true }),
  }),
  node({
    id: "insights-pipeline",
    parentId: "insights",
    kind: "tab",
    label: "Pipeline",
    route: "/insights",
    permission: "view.insights.pipeline",
    defaults: staff({ practitioner: false, front_desk: true }),
  }),
  node({
    id: "insights-book",
    parentId: "insights",
    kind: "tab",
    label: "Book",
    route: "/insights",
    permission: "view.insights.book",
    defaults: staff({ practitioner: false, front_desk: true }),
  }),

  node({
    id: "retention",
    parentId: null,
    kind: "page",
    label: "Retention",
    route: "/retention",
    permission: "reports.retention",
    defaults: staff(),
  }),
  node({
    id: "performance",
    parentId: null,
    kind: "page",
    label: "Performance",
    route: "/performance",
    permission: "reports.performance",
    defaults: staff({ manager: true, practitioner: false, front_desk: false }),
  }),
  node({
    id: "earnings",
    parentId: null,
    kind: "page",
    label: "My earnings",
    route: "/earnings",
    permission: "view.earnings",
    defaults: staff({ manager: false, practitioner: true, front_desk: false }),
  }),
  node({
    id: "offers",
    parentId: null,
    kind: "page",
    label: "Offers",
    route: "/offers",
    permission: "offers.manage",
    defaults: staff({ manager: false, practitioner: false, front_desk: false }),
  }),

  node({ id: "shell", parentId: null, kind: "page", label: "Clinic chrome", route: "/dashboard", permission: "view.shell" }),
  node({ id: "shell-search", parentId: "shell", kind: "component", label: "Patient search", route: "/dashboard", permission: "view.shell.search" }),
  node({ id: "shell-alerts", parentId: "shell", kind: "component", label: "Alert toolbar", route: "/dashboard", permission: "view.shell.alerts" }),
  node({ id: "shell-dock", parentId: "shell", kind: "component", label: "Staff dock", route: "/dashboard", permission: "view.shell.dock" }),
  node({
    id: "shell-clear-notifications",
    parentId: "shell",
    kind: "component",
    label: "Clear notifications",
    route: "/dashboard",
    permission: "notifications.delete",
    defaults: staff({ manager: true, practitioner: true, front_desk: false }),
  }),

  node({ id: "portal-home", parentId: null, kind: "page", label: "Home", route: "/my-record", permission: "view.portal.home" }),
  node({ id: "portal-plan", parentId: null, kind: "page", label: "Skin plan", route: "/my-record/plan", permission: "view.portal.plan" }),
  node({ id: "portal-plan-overview", parentId: "portal-plan", kind: "tab", label: "Overview", route: "/my-record/plan", permission: "view.portal.plan.overview" }),
  node({ id: "portal-plan-timeline", parentId: "portal-plan", kind: "page", label: "Timeline", route: "/my-record/plan/timeline", permission: "view.portal.plan.timeline" }),
  node({ id: "portal-plan-journal", parentId: "portal-plan", kind: "page", label: "Journal", route: "/my-record/plan/journal", permission: "view.portal.plan.journal" }),
  node({ id: "portal-plan-routine", parentId: "portal-plan", kind: "page", label: "Skincare routine", route: "/my-record/plan/routine", permission: "view.portal.plan.routine" }),
  node({ id: "portal-clinic", parentId: null, kind: "page", label: "My clinic", route: "/my-record/clinic", permission: "view.portal.clinic" }),
  node({ id: "portal-records", parentId: null, kind: "page", label: "My records", route: "/my-record/records", permission: "view.portal.records" }),
  node({ id: "portal-appointments", parentId: null, kind: "page", label: "Appointments", route: "/my-record/appointments", permission: "view.portal.appointments" }),
  node({ id: "portal-resources", parentId: null, kind: "page", label: "Resources", route: "/my-record/resources", permission: "view.portal.resources" }),
  node({ id: "portal-billing", parentId: null, kind: "page", label: "Billing", route: "/my-record/billing", permission: "view.portal.billing" }),
  node({ id: "portal-settings", parentId: null, kind: "page", label: "Portal settings", route: "/my-record/settings", permission: "view.portal.settings" }),
  node({ id: "portal-chat", parentId: null, kind: "component", label: "Portal chat", route: "/my-record", permission: "view.portal.chat" }),
];

const byId = new Map(ACCESS_CATALOGUE.map((node) => [node.id, node]));

export function catalogueNode(id: string) {
  return byId.get(id);
}

export function catalogueChildren(parentId: string | null) {
  return ACCESS_CATALOGUE.filter((node) => node.parentId === parentId);
}

type SeeIdentity =
  | { isOwner?: boolean; permissions?: string[] }
  | null
  | undefined;

/** True when this node and every ancestor grant is held. */
export function canSee(identity: SeeIdentity, nodeId: string) {
  let current = byId.get(nodeId);
  if (!current) return false;
  while (current) {
    if (!can(identity, current.permission)) return false;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return true;
}

/** Software-developer admin. Clinic owners edit staff access on Team, not on /access. */
export function isAccessAdmin(identity: { isOwner?: boolean; isAdmin?: boolean } | null | undefined) {
  return Boolean(identity?.isAdmin && !identity?.isOwner);
}

function routeScore(route: string, pathname: string) {
  if (route.includes("$")) {
    const pattern = new RegExp(`^${route.replace(/\$[^/]+/g, "[^/]+")}$`);
    return pattern.test(pathname) ? route.length : null;
  }
  if (pathname === route) return route.length + 1000;
  if (route !== "/" && pathname.startsWith(`${route}/`)) return route.length;
  return null;
}

/** The most specific page node for a URL, if the catalogue covers it. */
export function pageNodeForPath(pathname: string) {
  const path = pathname.replace(/\/+$/, "") || "/";
  let best: CatalogueNode | undefined;
  let bestScore = -1;
  for (const node of ACCESS_CATALOGUE) {
    if (node.kind !== "page") continue;
    const score = routeScore(node.route, path);
    if (score != null && score > bestScore) {
      best = node;
      bestScore = score;
    }
  }
  return best;
}

export function firstVisibleStaffPath(identity: SeeIdentity) {
  const page = ACCESS_CATALOGUE.find(
    (node) =>
      node.kind === "page" &&
      node.columns.includes("practitioner") &&
      !node.route.includes("$") &&
      node.id !== "shell" &&
      canSee(identity, node.id),
  );
  return page?.route ?? "/profile";
}

export function firstVisiblePortalPath(identity: SeeIdentity) {
  const page = ACCESS_CATALOGUE.find(
    (node) => node.kind === "page" && node.columns.includes("patient") && canSee(identity, node.id),
  );
  return page?.route ?? null;
}

/** Rows to seed. One row per role and permission; shared keys keep the first default. */
export function catalogueGrantRows(): { role: GrantRole; permission: PermissionKey; enabled: boolean }[] {
  const seen = new Set<string>();
  const rows: { role: GrantRole; permission: PermissionKey; enabled: boolean }[] = [];
  for (const entry of ACCESS_CATALOGUE) {
    for (const role of ["manager", "practitioner", "front_desk", "patient"] as const) {
      const stamp = `${role}:${entry.permission}`;
      if (seen.has(stamp)) continue;
      seen.add(stamp);
      rows.push({ role, permission: entry.permission, enabled: entry.defaults[role] });
    }
  }
  return rows;
}

export function viewGrantRows() {
  return catalogueGrantRows().filter((row) => row.permission.startsWith("view."));
}
