import type { RecordsSummary } from "@/lib/patients/records-rows";

/** One row of `listPatients`, as the Records tab reads it. */
export type PatientRow = {
  id: string;
  first_name: string;
  last_name: string;
  title?: string | null;
  date_of_birth?: string | null;
  status?: string | null;
  reference?: string | null;
  avatar_url?: string | null;
  email?: string | null;
  phone?: string | null;
  marketing_opt_in?: boolean | null;
  email_opt_in?: boolean | null;
  sms_opt_in?: boolean | null;
  reminders_opt_in?: boolean | null;
  unsubscribed_at?: string | null;
  lastTreatment: { name: string; performed_at: string; next_due_at?: string | null } | null;
  nextDue: { name: string; performed_at?: string; next_due_at: string | null } | null;
  nextAppointment: {
    treatment_name: string;
    treatment_number?: number | null;
    starts_at: string;
    status?: string | null;
  } | null;
  outstandingDocuments: number;
  practitioners: string[];
  practitionerIds: string[];
  openTasks: { id: string; label: string; kind: string }[];
  dueState: string;
  summary: RecordsSummary | null;
};

export type PatientView = "all" | "mine" | "active" | "inactive" | "due" | "nobooking";
export const PATIENT_VIEWS: PatientView[] = [
  "all",
  "mine",
  "active",
  "inactive",
  "due",
  "nobooking",
];

export const VIEW_LABEL: Record<PatientView, string> = {
  all: "All",
  mine: "My patients",
  active: "Active",
  inactive: "Inactive",
  due: "Treatments due",
  nobooking: "No upcoming treatment",
};

export function isInactive(p: Pick<PatientRow, "status">) {
  return String(p.status ?? "active").toLowerCase() !== "active";
}
