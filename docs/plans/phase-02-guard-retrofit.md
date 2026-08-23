# Phase 2 Micro-Plan — Retrofit the open handlers

**Parent:** Aetheria Remediation Master Plan, Phase 2
**Depends on:** Phase 1 (the guards module and the decision table)
**Blocks:** Phase 3 (RBAC)

> Written before the work started and left unedited afterwards, per [README.md](README.md).
> What actually happened is in [../WORKLOG.md](../WORKLOG.md).

## What the research changed

Before writing any code I mapped every server function a patient can reach. Two findings reshaped the phase.

**Only 2 of the 22 open handlers are patient-reachable** — `markMessagesRead` and `getUnreadMessages`. The other 20 are staff-UI-only, so `requireStaff` on them cannot break anything a user does today. The retrofit was far safer than the count suggested.

**The two worst vulnerabilities were not in the 22 at all.** Both are patient-reachable and both were exploitable:

- `sendMessage` took `patient_id` and `as: "staff" | "patient"` from the request body with no guard. A patient could write into any patient's thread, and could set `as: "staff"` so the message rendered as if it came from the clinic.
- `signDocument` updated by `.eq("id", data.id)` with no guard and no ownership check, so any authenticated user could sign any consent document by ID.

## Decisions taken

- `signDocument` is restricted to the patient who owns the document. Staff cannot sign on a patient's behalf; no staff page calls it.
- Patients can still reach staff routes. Recorded as audit finding §14.3.1, not fixed here, so Phase 2 stays server-side and independently revertable.

## Tier B — the three exploitable writes

| Handler | Fix |
|---|---|
| `sendMessage` | Author derived from identity; `requireStaffOrOwnPatient(patient_id)` scopes the thread |
| `signDocument` | Load the document's `patient_id`, then `requirePatientSelf` |
| `deleteMyDocument` | `requireStaff` plus `.eq("user_id", identity.userId)` |

## Tier A and C — the 22

- **`requireStaff` (16):** `getDashboard`, `listPatients`, `getCatalogue`, `listPractitioners`, `listAppointments`, `updateAppointmentState`, `addPhoto`, `resendDocument`, `listStaffDirectory`, `getPractitionerDay`, `dismissStaffInboxItem`, `listMessageTemplates`, `rescheduleAppointment`, `listTreatmentColours`, `getClinicDetails`, `getAppointmentNote`.
- **`requireStaffOrOwnPatient(patientId)` (2):** `getPatient`, `markMessagesRead`.
- **`requirePermission("settings.treatments")` (2):** `listColourThemes`, `listCatalogueItems`.
- **Branch guard (1):** `getUnreadMessages` — guarded after the patient branch returns, never at entry.
- **Ownership predicate (1):** `deleteMyDocument`, above.

`getUnreadMessages` is the one handler where the obvious move is wrong. Its patient branch is polled by `NotificationBell` on every portal page; a guard at function entry breaks the bell for every patient.

## Verification

Two test accounts made this the first phase verifiable by attack rather than by reading.

1. **Prove the vulnerability first.** Run each attack before the fix. An attack that was never seen to succeed proves nothing when it later fails.
2. **Attack, expect refusal.** Five attacks from a patient session: impersonate staff, write into another thread, sign another patient's consent, read the patient directory, read another patient's record.
3. **Positive paths.** The patient can still read their record, poll the bell, message their own thread, mark it read, sign their **own** form and submit a health update.
4. **Staff paths.** Owner and manager both retain the patient directory, records, dashboard, catalogue and both settings reads.
5. **Route sweeps.** Owner, manager and patient, zero console errors.
6. `npx tsc --noEmit` at or below 52.
7. **Restore everything.** The attacks write real rows to a live project; capture prior state and put it back.

## Commit

One commit at the end covering the whole phase, then push. That push also carries the unpushed phases 0 and 1.

## Out of scope

No route-level redirects. No demo twin changes. No new permission keys (Phase 3), no zod (Phase 4), no schema (Phase 5). §4.1 — the service-role client bypassing RLS — is architectural and untouched.
