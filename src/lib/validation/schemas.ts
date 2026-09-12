/**
 * One schema per server function that takes input — 62 in total, matching the
 * 62 `.validator(...)` calls in clinic.functions.ts and its demo twin.
 *
 * Two rules kept these faithful to today's behaviour rather than stricter:
 *
 * 1. Where a handler already truncates a field (`body.trim().slice(0, 2000)` in
 *    sendMessage, for example) the ceiling here is deliberately looser than the
 *    handler's cap. Tightening it to the exact cap would turn a message that is
 *    silently shortened today into one that is rejected outright.
 * 2. A field is only `requiredText` when nothing downstream tolerates an empty
 *    value. Message and note bodies stay `text()` because an attachment-only
 *    message is valid and clearing a note is how you delete it — those handlers
 *    raise their own, more specific errors.
 */
import { z } from "zod";
import {
  appointmentStage,
  appointmentStatus,
  assignableRole,
  attachments,
  dateString,
  documentKind,
  durationMinutes,
  email,
  id,
  money,
  nullableEmail,
  nullableMoney,
  nullableText,
  optionalDateString,
  optionalDurationMinutes,
  optionalEmail,
  optionalId,
  optionalMoney,
  optionalText,
  password,
  paymentLinkKind,
  paymentStatus,
  recipients,
  requiredText,
  staffRole,
  text,
} from "./primitives";

const optionalCount = z.number().int().min(0).max(100_000).nullable().optional();
/** Commission and similar shares, expressed as a percentage. */
const percentage = z.number().min(0).max(100);

/* Patients and appointments */

export const GetPatient = z.object({ id });

export const ListAppointments = z.object({ from: dateString, to: dateString });

export const SaveAppointment = z.object({
  id: optionalId,
  patient_id: id,
  practitioner_id: optionalId,
  catalogue_id: optionalId,
  treatment_name: requiredText(200),
  treatment_number: z.number().int().min(0).max(10_000),
  starts_at: dateString,
  duration_minutes: durationMinutes,
  price: optionalMoney,
  payment_status: paymentStatus.optional(),
  consent_document_id: optionalId,
  notes: optionalText(20_000),
  app_origin: optionalText(500),
  pay_kind: paymentLinkKind.optional(),
});

export const UpdateAppointmentState = z.object({
  id,
  status: appointmentStatus.optional(),
  payment_status: paymentStatus.optional(),
  stage: appointmentStage.optional(),
  cancel_reason: optionalText(8_000),
});

export const SavePatient = z.object({
  id: optionalId,
  first_name: requiredText(100),
  last_name: requiredText(100),
  title: optionalText(50),
  email: optionalEmail,
  phone: optionalText(50),
  date_of_birth: optionalDateString,
  status: z.enum(["active", "inactive", "archived"]).optional(),
  allergies: optionalText(20_000),
  medications: optionalText(20_000),
  conditions: optionalText(20_000),
  notes: optionalText(20_000),
});

export const ArchivePatient = z.object({
  id,
  archived: z.boolean(),
  reason: optionalText(500),
});

export const AddTreatment = z.object({
  patient_id: id,
  catalogue_id: optionalId,
  name: requiredText(200),
  product: optionalText(200),
  dose: optionalText(120),
  area: optionalText(200),
  notes: optionalText(20_000),
  price: optionalMoney,
  performed_at: dateString,
  next_due_at: optionalDateString,
});

export const AddPhoto = z.object({
  patient_id: id,
  treatment_id: optionalId,
  storage_path: requiredText(500),
  kind: z.enum(["before", "after"]),
  caption: optionalText(500),
  marketing_consent: z.boolean().optional(),
});

export const RescheduleAppointment = z.object({
  id,
  starts_at: dateString,
  duration_minutes: optionalDurationMinutes,
  practitioner_id: optionalId,
});

/* Documents and messaging */

export const SendDocument = z.object({
  patient_id: id,
  kind: documentKind,
  title: requiredText(240),
  body: optionalText(100_000),
  treatment_id: optionalId,
});

export const ResendDocument = z.object({ id, patient_id: id });

export const SignDocument = z.object({ id, signed_name: text(240) });

export const SendMessage = z.object({
  patient_id: id,
  body: text(10_000),
  as: z.enum(["staff", "patient"]),
  attachments,
});

export const MarkMessagesRead = z.object({ patient_id: id });

export const SendStaffAlert = z.object({
  audience: z.enum(["managers", "practitioners", "front_desk", "all", "user"]),
  recipientId: optionalId,
  body: text(10_000),
  urgent: z.boolean().optional(),
});

export const MarkStaffNotificationRead = z.object({
  id: optionalId,
  all: z.boolean().optional(),
});

export const DismissStaffInboxItem = z.object({ id });

export const DismissStaffInboxItems = z.object({ ids: z.array(id).max(500) });

export const SaveMessageTemplate = z.object({
  id: optionalId,
  title: text(240),
  body: text(20_000),
  category: optionalText(100),
});

export const DeleteMessageTemplate = z.object({ id });

export const GetStaffChat = z.object({ peerUserId: id });

export const SendStaffChatMessage = z.object({
  peerUserId: id,
  body: text(20_000),
  attachments,
});

export const MarkStaffChatRead = z.object({ peerUserId: id });

/* Medical history */

export const ReviewHistory = z.object({ id, patient_id: id });

export const SubmitHistoryUpdate = z.object({
  medications: text(20_000),
  allergies: text(20_000),
  conditions: text(20_000),
  diet: text(20_000),
  pregnancy: text(20_000),
  other: text(20_000),
});

/* Team and accounts */

export const CreateStaffAccount = z.object({
  email,
  password,
  fullName: requiredText(200),
  jobTitle: optionalText(200),
  role: staffRole,
  registrationBody: optionalText(200),
  registrationNumber: optionalText(100),
});

export const UpdateStaffMember = z.object({
  userId: id,
  role: staffRole,
  fullName: requiredText(200),
  jobTitle: optionalText(200),
  registrationBody: optionalText(200),
  registrationNumber: optionalText(100),
  commissionRate: percentage.optional(),
});

export const InviteStaffMember = z.object({
  email,
  fullName: requiredText(200),
  jobTitle: optionalText(200),
  role: staffRole,
  registrationBody: optionalText(200),
  registrationNumber: optionalText(100),
});

export const RevokeStaffAccess = z.object({ userId: id });

export const RestoreExTeamMember = z.object({ userId: id });

export const SetStaffPassword = z.object({ userId: id, password });

export const ChangeOwnPassword = z.object({ password });

export const ConfirmStepUp = z.object({ password });

export const SetPatientEmail = z.object({ patientId: id, email });

export const SetStaffEmail = z.object({ userId: id, email });

export const GetStaffProfile = z.object({ userId: id });

export const SetCommissionRate = z.object({ userId: id, rate: percentage });

export const GetPractitionerDay = z.object({ practitionerId: id, date: dateString });

export const GetPractitionerPerformance = z.object({ from: dateString, to: dateString });

export const GetMyEarnings = z.object({ from: dateString, to: dateString });

/* Profile, avatar and personal documents */

export const SubmitProfileChange = z.object({
  fullName: requiredText(200),
  jobTitle: optionalText(200),
  registrationBody: optionalText(200),
  registrationNumber: optionalText(100),
  note: optionalText(4_000),
});

export const SaveMyProfile = z.object({
  fullName: requiredText(200),
  jobTitle: optionalText(200),
  registrationBody: optionalText(200),
  registrationNumber: optionalText(100),
});

export const ReviewProfileChange = z.object({
  id,
  approve: z.boolean(),
  reviewerNote: optionalText(4_000),
});

export const SetMyAvatar = z.object({
  path: text(500).nullable(),
  targetUserId: optionalId,
});

export const ListMyDocuments = z.object({ targetUserId: optionalId });

export const AddMyDocument = z.object({
  title: requiredText(240),
  category: requiredText(100),
  path: requiredText(500),
  file_name: requiredText(300),
  file_type: optionalText(150),
  file_size: z
    .number()
    .int()
    .min(0)
    .max(100 * 1024 * 1024)
    .optional(),
});

export const DeleteMyDocument = z.object({ id });

/* Retention and recall */

export const LogRetentionOutreach = z.object({
  patient_id: id,
  channel: optionalText(50),
  note: optionalText(4_000),
});

export const CreateRecallTask = z.object({
  patient_id: id,
  note: optionalText(4_000),
  recipients,
});

export const UpdateRecallTask = z.object({
  task_id: id,
  recipients,
  note: optionalText(4_000),
});

export const SetRecallTaskStatus = z.object({
  task_id: id,
  status: z.enum(["open", "contacted", "completed"]),
});

export const EnqueueCommunication = z.object({
  patient_id: id,
  channel: z.enum(["email", "sms"]),
  purpose: z.enum(["transactional", "reminder", "marketing"]),
  body: requiredText(20_000),
  subject: optionalText(300),
  template_key: optionalText(120),
  to_address: optionalText(320),
  scheduled_for: optionalDateString,
  related_entity: optionalText(80),
  related_id: optionalId,
});

export const ListCommunications = z.object({ patient_id: id });

export const SaveCommsPreferences = z.object({
  patient_id: id,
  email_opt_in: z.boolean(),
  sms_opt_in: z.boolean(),
  reminders_opt_in: z.boolean(),
  marketing_opt_in: z.boolean(),
});

export const DeleteRecallTask = z.object({
  task_id: id,
  assignee_ids: z.array(id).max(200).optional(),
});

export const ListRecallTasks = z.object({ patient_id: id });

/* Clinic settings */

export const SaveTreatmentColour = z.object({
  treatment_name: requiredText(200),
  lane: z.number().int().min(0).max(100).nullable(),
  hex: nullableText(32),
});

export const SaveColourTheme = z.object({ name: requiredText(120) });

export const ApplyColourTheme = z.object({ id });

export const DeleteColourTheme = z.object({ id });

export const SaveCatalogueItem = z.object({
  id: id.nullable().optional(),
  name: requiredText(200),
  category: nullableText(120),
  description: nullableText(4_000),
  price: nullableMoney,
  interval_days: optionalCount,
  duration_minutes: durationMinutes.nullable().optional(),
  cooling_off_hours: optionalCount,
  requires_consent: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const SetCatalogueItemActive = z.object({ id, active: z.boolean() });

export const UpdateClinicDetails = z.object({
  name: requiredText(200),
  address: nullableText(500),
  phone: nullableText(50),
  email: nullableEmail,
});

export const SetRolePermission = z.object({
  role: assignableRole,
  /** The handler checks this against PERMISSION_KEYS and names the bad key. */
  permission: requiredText(100),
  enabled: z.boolean(),
});

/* Notes */

export const SaveMyNote = z.object({ body: text(100_000) });

export const GetAppointmentNote = z.object({ appointment_id: id });

export const SaveAppointmentNote = z.object({
  appointment_id: id,
  body: text(100_000),
});

/** Kept for the `money` re-export used by callers building numeric form fields. */
export { money };
