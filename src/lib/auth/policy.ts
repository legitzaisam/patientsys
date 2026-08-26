import type { PermissionKey } from "@/lib/permissions";

/**
 * Every server function's access rule, in one reviewable table.
 *
 * Authorization used to be read out of 88 handler bodies, which is how six
 * clinical writers (`savePatient`, `addTreatment`, `saveAppointment`,
 * `sendDocument`, `reviewHistory`, `saveAppointmentNote`) shipped with no check
 * at all: any signed-in patient could rewrite another patient's allergies or
 * stamp a medical history as clinically reviewed. A handler that is missing here
 * fails the completeness check in `policy.assert.ts` at startup, so the same
 * hole cannot open silently again.
 *
 * Capabilities describe staff only. Patients hold no capabilities — they are
 * governed by ownership (`patientSelf`, `staffOrOwnPatient`), because a patient
 * has no row in `role_permissions` and would otherwise be refused everywhere.
 */
export type Access =
  /** Any clinic staff member. No specific capability needed. */
  | { kind: "staff" }
  /** Staff who hold the capability, or the clinic owner. */
  | { kind: "capability"; key: PermissionKey }
  /** Owner or manager. */
  | { kind: "manager" }
  /** Clinic owner only. */
  | { kind: "owner" }
  /**
   * Staff, or the patient the row belongs to. `staffKey` is the capability a
   * staff caller additionally needs; the patient side is never capability-gated.
   */
  | { kind: "staffOrOwnPatient"; staffKey?: PermissionKey }
  /** The patient whose record this is, and nobody else — not even staff. */
  | { kind: "patientSelf" }
  /**
   * Any signed-in user. The handler reads and writes only its own caller's rows,
   * so it is safe by construction rather than by a role check.
   */
  | { kind: "self" };

export const POLICY = {
  /* Session */
  getMe: { kind: "self" },
  changeOwnPassword: { kind: "self" },
  acknowledgeWelcome: { kind: "self" },

  /* Dashboard and patient reads */
  getDashboard: { kind: "staff" },
  listPatients: { kind: "staff" },
  getPatient: { kind: "staffOrOwnPatient" },
  getCatalogue: { kind: "staff" },
  listPractitioners: { kind: "staff" },

  /* Diary */
  listAppointments: { kind: "staff" },
  getPractitionerDay: { kind: "staff" },
  saveAppointment: { kind: "capability", key: "appointments.edit" },
  updateAppointmentState: { kind: "capability", key: "appointments.edit" },
  rescheduleAppointment: { kind: "capability", key: "appointments.edit" },
  getAppointmentNote: { kind: "staff" },
  saveAppointmentNote: { kind: "capability", key: "treatments.record" },

  /* Clinical record */
  savePatient: { kind: "capability", key: "patients.edit" },
  // Owner only: archiving starts an 8-year retention clock and hides the record
  // from every clinical view, which is not a capability worth delegating.
  archivePatient: { kind: "owner" },
  addTreatment: { kind: "capability", key: "treatments.record" },
  reviewHistory: { kind: "capability", key: "treatments.record" },
  addPhoto: { kind: "capability", key: "photos.manage" },
  sendDocument: { kind: "capability", key: "documents.send" },
  resendDocument: { kind: "capability", key: "documents.send" },

  /* Patient messaging. The portal composer calls sendMessage as the patient, so
     the capability applies to the staff side only. */
  sendMessage: { kind: "staffOrOwnPatient", staffKey: "comms.send" },
  getUnreadMessages: { kind: "self" },
  markMessagesRead: { kind: "staffOrOwnPatient" },
  listMessageTemplates: { kind: "staff" },
  saveMessageTemplate: { kind: "staff" },
  deleteMessageTemplate: { kind: "owner" },

  /* Patient portal */
  getMyRecord: { kind: "self" },
  submitHistoryUpdate: { kind: "self" },
  signDocument: { kind: "patientSelf" },

  /* Staff notifications and alerts */
  listStaffNotifications: { kind: "staff" },
  listStaffDirectory: { kind: "staff" },
  sendStaffAlert: { kind: "capability", key: "comms.send" },
  listSentStaffAlerts: { kind: "staff" },
  listIncomingTeamAlerts: { kind: "staff" },
  /* Marking read is not clearing: the bell marks items read for every staff
     role, so gating it on notifications.delete would break the bell. */
  markStaffNotificationRead: { kind: "staff" },
  dismissStaffInboxItem: { kind: "capability", key: "notifications.delete" },
  dismissStaffInboxItems: { kind: "capability", key: "notifications.delete" },

  /* Staff chat */
  getStaffChat: { kind: "staff" },
  sendStaffChatMessage: { kind: "staff" },
  markStaffChatRead: { kind: "staff" },

  /* Team directory and administration */
  listTeam: { kind: "staff" },
  getStaffProfile: { kind: "staff" },
  listExTeamMembers: { kind: "capability", key: "team.view" },
  createStaffAccount: { kind: "owner" },
  inviteStaffMember: { kind: "owner" },
  updateStaffMember: { kind: "manager" },
  revokeStaffAccess: { kind: "owner" },
  restoreExTeamMember: { kind: "owner" },
  setStaffPassword: { kind: "owner" },
  setStaffEmail: { kind: "owner" },
  setPatientEmail: { kind: "owner" },
  setCommissionRate: { kind: "owner" },
  listAccountsMissingEmail: { kind: "owner" },

  /* Own staff profile */
  getMyProfile: { kind: "staff" },
  saveMyProfile: { kind: "staff" },
  setMyAvatar: { kind: "staff" },
  submitProfileChange: { kind: "staff" },
  listProfileChangeRequests: { kind: "capability", key: "team.approve_changes" },
  reviewProfileChange: { kind: "capability", key: "team.approve_changes" },
  listMyDocuments: { kind: "staff" },
  addMyDocument: { kind: "staff" },
  deleteMyDocument: { kind: "staff" },
  getMyNote: { kind: "self" },
  saveMyNote: { kind: "self" },

  /* Reports */
  getPractitionerPerformance: { kind: "capability", key: "reports.performance" },
  getMyEarnings: { kind: "staff" },
  getRetention: { kind: "capability", key: "reports.retention" },
  logRetentionOutreach: { kind: "staff" },

  /* Recall tasks */
  createRecallTask: { kind: "staff" },
  updateRecallTask: { kind: "manager" },
  setRecallTaskStatus: { kind: "staff" },
  deleteRecallTask: { kind: "capability", key: "tasks.delete" },
  listRecallTasks: { kind: "staff" },
  listOpenRecallTasks: { kind: "staff" },

  /* Clinic settings */
  listTreatmentColours: { kind: "staff" },
  saveTreatmentColour: { kind: "capability", key: "settings.treatments" },
  listColourThemes: { kind: "capability", key: "settings.treatments" },
  saveColourTheme: { kind: "capability", key: "settings.treatments" },
  applyColourTheme: { kind: "capability", key: "settings.treatments" },
  deleteColourTheme: { kind: "capability", key: "settings.treatments" },
  listCatalogueItems: { kind: "capability", key: "settings.treatments" },
  saveCatalogueItem: { kind: "capability", key: "settings.treatments" },
  setCatalogueItemActive: { kind: "capability", key: "settings.treatments" },
  getClinicDetails: { kind: "staff" },
  updateClinicDetails: { kind: "capability", key: "settings.treatments" },
  listRolePermissions: { kind: "staff" },
  setRolePermission: { kind: "owner" },
} as const satisfies Record<string, Access>;

export type HandlerName = keyof typeof POLICY;

/**
 * Which rows a handler returns for this caller.
 *
 * Phase 3 declares the scoping that already existed rather than changing it, so
 * nobody's data view moves. Listing the rules together is what makes visible
 * that they disagree: retention narrows a practitioner but not front desk,
 * while open tasks narrow anyone who is not a manager, front desk included.
 * Reconciling them is a product decision, not a refactor.
 */
type ScopeRule =
  /** Everything in the clinic. */
  | "clinic"
  /** A practitioner sees their own book; managers and non-practitioners see the clinic. */
  | "practitionerOwnBook"
  /** Anyone below manager sees only rows assigned to them. */
  | "nonManagerOwnAssignments";

const SCOPE: Partial<Record<HandlerName, ScopeRule>> = {
  getDashboard: "practitionerOwnBook",
  getRetention: "practitionerOwnBook",
  listOpenRecallTasks: "nonManagerOwnAssignments",
};

type ScopedIdentity = { userId: string; isManager: boolean; roles: string[] };

/**
 * `null` means clinic-wide; a user id means narrow to that person's rows.
 * Every handler without a SCOPE entry is clinic-wide.
 */
export function resolveScope(identity: ScopedIdentity, name: HandlerName): string | null {
  switch (SCOPE[name]) {
    case "practitionerOwnBook":
      return identity.isManager || !identity.roles.includes("practitioner") ? null : identity.userId;
    case "nonManagerOwnAssignments":
      return identity.isManager ? null : identity.userId;
    default:
      return null;
  }
}
