import type { AuthSurface } from "@/lib/auth/constants";

type SurfaceIdentity = {
  isStaff: boolean;
  patient: { id?: string } | null;
};

export function staffHomePath() {
  return "/dashboard" as const;
}

export function patientHomePath() {
  return "/my-record" as const;
}

export function wrongSurfaceMessage(surface: AuthSurface) {
  return surface === "staff"
    ? "This sign-in is for clinic staff. Patients use the patient portal."
    : "This sign-in is for patients. Clinic staff use the staff sign-in.";
}

/** True when getMe failed because this account must not stay signed in here. */
export function isSessionEndingIdentityError(message: string) {
  return (
    message.includes("clinic access has been removed") ||
    message.includes("Patients use the patient portal") ||
    message.includes("Clinic staff use the staff sign-in") ||
    message.includes("No patient record is linked")
  );
}

/**
 * After a session exists, decide whether this identity may stay on this surface.
 * Throws when the account does not belong on that surface.
 */
export function destinationFor(surface: AuthSurface, identity: SurfaceIdentity): "/dashboard" | "/my-record" {
  if (surface === "staff") {
    if (!identity.isStaff) throw new Error(wrongSurfaceMessage("staff"));
    return staffHomePath();
  }
  if (identity.isStaff && !identity.patient) return staffHomePath();
  if (!identity.patient && !identity.isStaff) {
    throw new Error("No patient record is linked to this account. Contact your clinic.");
  }
  return patientHomePath();
}
