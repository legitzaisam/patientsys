import type { EffectiveCapabilities } from "@/components/effective-permissions";
import type { PatternRow } from "@/lib/staff-schedule";

/**
 * self      — your own page (/profile): everything, including Security.
 * manage    — a colleague's page for the owner, admin, or a manager holding
 *             Edit staff profiles: the same layout plus Access level,
 *             Commission (with Set staff commission) and the Access tab.
 * frontdesk — a colleague's page for everyone else: name, role, what they can
 *             be booked for, hours and unavailability. Nothing private.
 */
export type ProfileMode = "self" | "manage" | "frontdesk";

export type ProfileTabKey =
  "overview" | "earnings" | "schedule" | "documents" | "security" | "access";

export type BookableTreatment = { catalogueId: string; name: string; category: string | null };

export type ChangeRequest = {
  id: string;
  status: string;
  created_at: string;
  full_name?: string | null;
  job_title?: string | null;
  registration_body?: string | null;
  registration_number?: string | null;
  registration_expiry?: string | null;
  work_email?: string | null;
  working_arrangement?: string | null;
  note?: string | null;
  reviewer_note?: string | null;
  requires_owner?: boolean;
};

export type StaffDocumentRow = {
  id: string;
  title: string;
  category: string;
  path: string;
  file_name: string;
  file_type?: string | null;
  file_size?: number | null;
  created_at: string;
};

/** Everything the profile page renders about one person, whichever route loaded it. */
export type ProfileSubject = {
  userId: string;
  fullName: string;
  email: string;
  jobTitle: string;
  role: string;
  registrationBody: string;
  registrationNumber: string;
  registrationExpiry: string;
  insuranceProvider: string;
  insuranceExpiry: string;
  qualifications: string;
  workingArrangement: string;
  avatarPath: string | null;
  commissionRate: number | null;
  pattern: PatternRow[];
  patternSummary: string;
  bookable: BookableTreatment[];
  upcomingUnavailable: { starts_on: string; ends_on: string }[];
  requests: ChangeRequest[];
  documents: StaffDocumentRow[];
  presentCategories: string[];
  capabilities: EffectiveCapabilities | null;
  revoked: boolean;
  daysRemaining: number;
};

export type ProfileViewer = {
  userId: string;
  email?: string | null;
  isOwner?: boolean;
  isAdmin?: boolean;
  isManager?: boolean;
  mfaRequired?: boolean;
  roles: string[];
  /** Owner or admin on their own page: identity changes apply straight away. */
  canSelfApply: boolean;
  /** A manager on their own page must wait for the owner. */
  requiresOwner: boolean;
  /** Manage mode with Set staff commission: commission field and earnings tab. */
  canCommission: boolean;
  /** The subject treats patients (practitioner role, or an owner with treatments), so earnings apply. */
  treats: boolean;
};

/** One treatment line from getMyEarnings — the practitioner's share only. */
export type EarningsLine = {
  id: string;
  performedAt: string;
  name: string;
  patient: string;
  patientId?: string | undefined;
  share: number;
  /** Paid once the linked booking is settled in full; pending until then. */
  payout?: "paid" | "pending" | undefined;
};

/** A practitioner_invoices row as the list function returns it. */
export type InvoiceRowLike = {
  id: string;
  number: string;
  period_start: string;
  period_end: string;
  recipient: string;
  note?: string | null;
  status: string;
  scheduled_for?: string | null;
  sent_at?: string | null;
  paid_at?: string | null;
  amount: number;
  treatments: number;
};
