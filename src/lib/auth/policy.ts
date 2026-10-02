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
 * Capabilities describe staff, plus the patient portal view keys. A patient
 * holds only those view keys. Clinical writes stay on ownership
 * (`patientSelf`, `staffOrOwnPatient`).
 */
export type Access =
  /** Any clinic staff member. No specific capability needed. */
  | { kind: "staff" }
  /** Staff who hold the capability, or the clinic owner. */
  | { kind: "capability"; key: PermissionKey }
  /** Owner or manager. */
  | { kind: "manager" }
  /**
   * The owner, or someone holding the manager role who also holds the key.
   * For the manager-only keys the owner toggles under Staff access; other
   * roles cannot pass even if a named pack grants them the key.
   */
  | { kind: "managerCapability"; key: PermissionKey }
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
   * `view` additionally requires that visibility grant.
   */
  | { kind: "self"; view?: PermissionKey }
  /** Clinic owner (Team staff-access grid) or software-developer admin (/access). Not a catalogue grant. */
  | { kind: "accessAdmin" };

export const POLICY = {
  /* Session */
  getMe: { kind: "self" },
  changeOwnPassword: { kind: "self" },
  sendPasswordEmailCode: { kind: "self" },
  acknowledgeWelcome: { kind: "self" },
  confirmStepUp: { kind: "self" },
  sendLoginEmailCode: { kind: "manager" },
  verifyLoginEmailCode: { kind: "manager" },
  listMySessions: { kind: "self" },
  revokeOtherSessions: { kind: "self" },

  /* Dashboard and patient reads */
  getDashboard: { kind: "capability", key: "view.dashboard" },
  listPatients: { kind: "staff" },
  getPatientMetrics: { kind: "capability", key: "reports.insights" },
  getPatient: { kind: "staffOrOwnPatient", staffKey: "view.patients" },
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
  archivePatient: { kind: "manager" },
  addTreatment: { kind: "capability", key: "treatments.record" },
  reviewHistory: { kind: "capability", key: "treatments.record" },
  // Accepting a patient's portal edit rewrites allergies/medications/conditions:
  // the same clinical capability as reviewing it, since it is review plus merge.
  acceptHistoryUpdate: { kind: "capability", key: "treatments.record" },
  reviewRecoveryCheckin: { kind: "capability", key: "treatments.record" },

  /* Treatment plans (journeys). Reading the board is any-staff; writing a plan
     is clinical work, so it shares the treatments.record capability. */
  listTreatmentPlans: { kind: "staff" },
  // The record's roadmap is the Treatments tab's content, so it follows that tab's grant.
  getPatientPlanDetail: { kind: "capability", key: "view.patients.treatments" },
  createTreatmentPlan: { kind: "capability", key: "treatments.record" },
  updatePlanMilestone: { kind: "capability", key: "treatments.record" },
  updatePlanMilestoneDetails: { kind: "capability", key: "treatments.record" },
  setMilestoneChecklistItem: { kind: "capability", key: "treatments.record" },
  getTreatmentSession: { kind: "staff" },
  startTreatment: { kind: "capability", key: "treatments.record" },
  moveToAftercare: { kind: "capability", key: "treatments.record" },
  completeTreatment: { kind: "capability", key: "treatments.record" },
  saveTreatmentSessionDraft: { kind: "capability", key: "treatments.record" },
  getTreatmentRecord: { kind: "staff" },
  addPhoto: { kind: "capability", key: "photos.manage" },
  deletePhoto: { kind: "capability", key: "photos.manage" },
  sendDocument: { kind: "capability", key: "documents.send" },
  resendDocument: { kind: "capability", key: "documents.send" },
  getAppointmentConsent: { kind: "staff" },
  completeConsentInClinic: { kind: "capability", key: "documents.send" },

  /* Patient messaging. The portal composer calls sendMessage as the patient, so
     the capability applies to the staff side only. */
  sendMessage: { kind: "staffOrOwnPatient", staffKey: "comms.send" },
  listPatientThreads: { kind: "staff" },
  getVoiceCallConfig: { kind: "staff" },
  getVoiceCallToken: { kind: "staff" },
  getVoiceCallTarget: { kind: "staff" },
  getPatientMessages: { kind: "staffOrOwnPatient" },
  sendPaymentRequest: { kind: "capability", key: "comms.send" },
  /* A call log is bookkeeping about the caller's own action, not a send. */
  logCallAttempt: { kind: "staff" },
  getUnreadMessages: { kind: "self" },
  markMessagesRead: { kind: "staffOrOwnPatient" },
  listMessageTemplates: { kind: "staff" },
  saveMessageTemplate: { kind: "staff" },
  deleteMessageTemplate: { kind: "owner" },
  enqueueCommunication: { kind: "capability", key: "comms.send" },
  listCommunications: { kind: "staffOrOwnPatient", staffKey: "comms.send" },
  saveCommsPreferences: { kind: "staffOrOwnPatient" },
  drainCommunications: { kind: "capability", key: "comms.send" },

  /* Patient portal */
  getMyRecord: { kind: "self" },
  /* Patient portal. Reads resolve the caller's own patient row, so "self" is
     the whole boundary — none of them accept a patient_id. */
  getPortalHome: { kind: "self" },
  getPortalPlan: { kind: "self", view: "view.portal.plan" },
  getPortalTimeline: { kind: "self", view: "view.portal.plan.timeline" },
  getPortalJournal: { kind: "self", view: "view.portal.plan.journal" },
  getPortalRoutine: { kind: "self", view: "view.portal.plan.routine" },
  getPortalClinic: { kind: "self" },
  getPortalRecords: { kind: "self" },
  createJournalEntry: { kind: "self" },
  deleteJournalEntry: { kind: "self" },
  submitRecoveryCheckin: { kind: "self" },
  requestPlanPause: { kind: "self" },
  confirmAppointment: { kind: "self" },
  markRoutineComplete: { kind: "self" },
  snoozeRoutineReminder: { kind: "self" },
  extractProductFromLink: { kind: "self" },
  saveRoutineOverride: { kind: "self" },
  clearRoutineOverride: { kind: "self" },
  toggleChecklistItem: { kind: "self" },
  updatePortalProfile: { kind: "self" },
  addExternalTreatment: { kind: "self" },
  deleteExternalTreatment: { kind: "self" },
  askCareAssistant: { kind: "self" },
  listPlanPauseRequests: { kind: "staff" },
  decidePlanPause: { kind: "capability", key: "treatments.record" },
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
  // Only the alert's recipient may reply; the handler checks that against the row.
  replyToStaffAlert: { kind: "staff" },
  dismissStaffInboxItem: { kind: "capability", key: "notifications.delete" },
  dismissStaffInboxItems: { kind: "capability", key: "notifications.delete" },

  /* Staff chat */
  getStaffChat: { kind: "staff" },
  sendStaffChatMessage: { kind: "staff" },
  markStaffChatRead: { kind: "staff" },
  listStaffThreads: { kind: "staff" },

  /* Team directory and administration */
  listTeam: { kind: "staff" },
  getStaffProfile: { kind: "staff" },
  listExTeamMembers: { kind: "capability", key: "team.view" },
  createStaffAccount: { kind: "owner" },
  inviteStaffMember: { kind: "manager" },
  completeOwnerSetup: { kind: "owner" },
  enableSeparateManager: { kind: "owner" },
  createClinicRole: { kind: "manager" },
  setClinicRolePermission: { kind: "accessAdmin" },
  updateStaffMember: { kind: "managerCapability", key: "team.manage_profiles" },
  revokeStaffAccess: { kind: "owner" },
  restoreExTeamMember: { kind: "owner" },
  setStaffPassword: { kind: "owner" },
  setStaffEmail: { kind: "owner" },
  setPatientEmail: { kind: "owner" },
  setCommissionRate: { kind: "managerCapability", key: "team.commission" },
  listAccountsMissingEmail: { kind: "manager" },

  /* Own staff profile */
  getMyProfile: { kind: "capability", key: "view.profile" },
  saveMyProfile: { kind: "staff" },
  saveMyInstantProfile: { kind: "staff" },
  setMyAvatar: { kind: "staff" },
  submitProfileChange: { kind: "staff" },
  listProfileChangeRequests: { kind: "capability", key: "team.approve_changes" },
  reviewProfileChange: { kind: "capability", key: "team.approve_changes" },
  dismissProfileChangeRequest: { kind: "capability", key: "team.approve_changes" },
  listMyDocuments: { kind: "staff" },
  addMyDocument: { kind: "staff" },
  deleteMyDocument: { kind: "staff" },
  getMyNote: { kind: "self" },
  saveMyNote: { kind: "self" },

  /* Staff schedule, time off, bookable treatments, invoices */
  getStaffSchedule: { kind: "staff" },
  setWorkingPattern: { kind: "managerCapability", key: "team.manage_profiles" },
  requestWorkingPatternChange: { kind: "staff" },
  withdrawWorkingPatternChange: { kind: "staff" },
  reviewWorkingPatternChange: { kind: "managerCapability", key: "team.manage_profiles" },
  requestTimeOff: { kind: "staff" },
  withdrawTimeOff: { kind: "staff" },
  reviewTimeOff: { kind: "managerCapability", key: "team.manage_profiles" },
  addTimeOff: { kind: "managerCapability", key: "team.manage_profiles" },
  listBookableTreatments: { kind: "staff" },
  setBookableTreatments: { kind: "managerCapability", key: "team.manage_profiles" },
  listPractitionerInvoices: { kind: "staff" },
  createPractitionerInvoice: { kind: "staff" },
  markInvoicePaid: { kind: "managerCapability", key: "team.commission" },

  /* Reports */
  getInsights: { kind: "capability", key: "reports.insights" },
  getPractitionerPerformance: { kind: "capability", key: "reports.performance" },
  getMyEarnings: { kind: "staff" },
  getRetention: { kind: "capability", key: "reports.retention" },
  logRetentionOutreach: { kind: "staff" },
  sendRecall: { kind: "capability", key: "comms.send" },

  /* Offers and marketing. Designing and automating is its own capability;
     putting an offer in front of a patient is a send like any other. */
  listOfferTemplates: { kind: "staff" },
  saveOfferTemplate: { kind: "capability", key: "offers.manage" },
  archiveOfferTemplate: { kind: "capability", key: "offers.manage" },
  setOfferAutomation: { kind: "capability", key: "offers.manage" },
  draftOfferTemplate: { kind: "capability", key: "offers.manage" },
  previewOfferStage: { kind: "capability", key: "offers.manage" },
  listOfferSends: { kind: "capability", key: "offers.manage" },
  sendOffer: { kind: "capability", key: "comms.send" },
  listPatientOffers: { kind: "staff" },
  markOfferViewed: { kind: "patientSelf" },
  claimOffer: { kind: "patientSelf" },

  /* Tasks (who sees which rows and who may do what is decided in the handlers) */
  listTasks: { kind: "staff" },
  getTasksSummary: { kind: "staff" },
  listPatientTasks: { kind: "staff" },
  createTask: { kind: "staff" },
  assignTasks: { kind: "capability", key: "tasks.assign_any" },
  handOffToPool: { kind: "capability", key: "tasks.handoff" },
  claimTask: { kind: "capability", key: "tasks.claim" },
  logTaskAttempt: { kind: "capability", key: "tasks.complete" },
  completeTask: { kind: "capability", key: "tasks.complete" },
  completeTasks: { kind: "capability", key: "tasks.assign_any" },
  escalateToClinician: { kind: "capability", key: "tasks.complete" },
  snoozeTask: { kind: "capability", key: "tasks.complete" },
  undoTaskEvent: { kind: "staff" },

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
  updateDepositRules: { kind: "capability", key: "settings.treatments" },
  listRolePermissions: { kind: "manager" },
  setRolePermission: { kind: "accessAdmin" },
  listRetailProducts: { kind: "staff" },
  saveRetailProduct: { kind: "capability", key: "settings.treatments" },
  setRetailProductActive: { kind: "capability", key: "settings.treatments" },
  getInsightsIngestKeyStatus: { kind: "accessAdmin" },
  rotateInsightsIngestKey: { kind: "accessAdmin" },
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
  | "practitionerOwnBook";

const SCOPE: Partial<Record<HandlerName, ScopeRule>> = {
  getDashboard: "practitionerOwnBook",
  getRetention: "practitionerOwnBook",
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
    default:
      return null;
  }
}
