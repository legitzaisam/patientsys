export const PERMISSION_KEYS = [
  "reports.retention",
  "reports.performance",
  "team.view",
  "team.approve_changes",
  "settings.treatments",
  "notifications.delete",
  "tasks.delete",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_META: Record<PermissionKey, { label: string; description: string }> = {
  "reports.retention": {
    label: "Retention report",
    description: "See the retention dashboard, at-risk patients and recall tools.",
  },
  "reports.performance": {
    label: "Performance & earnings",
    description: "See practitioner KPIs, clinic earnings and the commission split.",
  },
  "team.view": {
    label: "Team & staff details",
    description:
      "Open the team page and staff profiles. Reception sees public details, chat and missing essential documents — private HR fields and file contents stay with managers.",
  },
  "team.approve_changes": {
    label: "Approve profile changes",
    description: "Review and approve profile change requests from staff.",
  },
  "settings.treatments": {
    label: "Treatments & colours",
    description: "Add or edit treatments, treatment colours and clinic details.",
  },
  "notifications.delete": {
    label: "Clear notifications",
    description: "Dismiss and complete alerts in the notification bell.",
  },
  "tasks.delete": {
    label: "Delete tasks",
    description: "Remove recall and follow-up tasks from the task lists.",
  },
};

type IdentityLike =
  | { isOwner?: boolean; isManager?: boolean; permissions?: string[] }
  | null
  | undefined;

/** Clinic owners always hold every capability; other staff need an explicit grant. */
export function can(identity: IdentityLike, key: PermissionKey) {
  if (!identity) return false;
  if (identity.isOwner) return true;
  return (identity.permissions ?? []).includes(key);
}
