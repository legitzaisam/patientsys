export const PERMISSION_KEYS = [
  "patients.edit",
  "treatments.record",
  "documents.send",
  "photos.manage",
  "appointments.edit",
  "comms.send",
  "notifications.delete",
  "reports.retention",
  "reports.performance",
  "team.view",
  "team.approve_changes",
  "settings.treatments",
  "tasks.delete",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const PERMISSION_META: Record<PermissionKey, { label: string; description: string }> = {
  "patients.edit": {
    label: "Patient records",
    description: "Create patients and keep their contact details and clinical summary current.",
  },
  "treatments.record": {
    label: "Record treatments & notes",
    description: "Log treatments, write visit notes and sign off medical history reviews.",
  },
  "documents.send": {
    label: "Send documents",
    description: "Issue consent forms, treatment plans and aftercare to patients.",
  },
  "photos.manage": {
    label: "Clinical photos",
    description: "Upload before and after photographs to a patient's record.",
  },
  "appointments.edit": {
    label: "Manage the diary",
    description: "Book, edit, reschedule and cancel appointments.",
  },
  "comms.send": {
    label: "Send messages",
    description: "Message patients from the clinic and raise alerts to the team.",
  },
  "notifications.delete": {
    label: "Clear notifications",
    description: "Dismiss and complete alerts in the notification bell.",
  },
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
      "Open the team page and staff profiles. Everyone can view profile details and chat; document files stay with managers. Only managers can edit profiles.",
  },
  "team.approve_changes": {
    label: "Approve profile changes",
    description: "Review and approve profile change requests from staff.",
  },
  "settings.treatments": {
    label: "Treatments & colours",
    description: "Add or edit treatments, treatment colours and clinic details.",
  },
  "tasks.delete": {
    label: "Delete tasks",
    description: "Remove recall and follow-up tasks from the task lists.",
  },
};

/** Display grouping for the owner's access grid and the effective-permissions panel. */
export const PERMISSION_GROUPS: { label: string; keys: PermissionKey[] }[] = [
  {
    label: "Clinical record",
    keys: ["patients.edit", "treatments.record", "documents.send", "photos.manage"],
  },
  { label: "Diary", keys: ["appointments.edit"] },
  { label: "Communication", keys: ["comms.send", "notifications.delete"] },
  { label: "Reports", keys: ["reports.retention", "reports.performance"] },
  { label: "Team", keys: ["team.view", "team.approve_changes"] },
  { label: "Clinic settings", keys: ["settings.treatments", "tasks.delete"] },
];

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
