# Clinic & Medspa Patient Records Platform

A practitioner workspace for a single clinic, built in the "Luxe clinical aesthetic" direction: ivory/slate surfaces, navy ink, teal accent, IBM Plex Serif headings with Inter body, flat bordered cards, left rail navigation.

## What gets built

**1. Backend and accounts (Lovable Cloud)**
- Staff sign-in (email/password + Google) with roles: owner, practitioner, front desk.
- Separate patient sign-in for the patient portal.
- Row-level security so patients only ever see their own record, and staff only see clinic data.

**2. Practitioner dashboard**
- KPI band across the top: Total clients (with active / inactive split), Retention rate, Treatments due, Pending consents, Revenue this month.
- Today's schedule and a follow-up list of patients whose treatments are due.

**3. Patient record (the core screen)**
Left patient list with search, right record pane containing:
- Header: photo, ID, DOB, allergy and medication alerts, consent status, next treatment due.
- Before/after photo pairs per treatment, shown as a side-by-side comparison.
- Clinical treatment history: product, dose/units, area, practitioner, date, notes.
- Treatments due with intervals (e.g. toxin at 12 weeks) driving the dashboard follow-up list.
- Document ledger: consent forms, treatment plans, consultation forms, aftercare — each with sent / viewed / signed status and a resend action.
- **Messaging panel visible on the record screen**, so comms sit alongside the clinical notes rather than in a separate inbox.

**4. Forms, consent and sending to patients**
- Form builder-lite: consultation form, medical history, consent templates per treatment type.
- Send a form to a patient by secure link; patient completes and e-signs; signature, timestamp and IP are stored immutably as a compliance record.
- Aftercare and treatment plan documents sent the same way.

**5. Patient portal**
- Patients log in to view their treatments, photos (only those they are allowed to see), documents and messages.
- Patients can update their own medical history: medication, diet, pregnancy, allergies, lifestyle. Any change raises a flag on the practitioner dashboard and is version-history recorded rather than overwriting the old answer.

**6. Compliance and safety (JCCP / GDPR aligned)**
- Practitioner registration details recorded per staff member, with the treating practitioner logged on every treatment entry.
- Cooling-off period tracking between consultation and treatment, and consent captured before treatment can be marked complete.
- Immutable audit log: who viewed or changed which patient record and when.
- Consent expiry and medical-history re-confirmation prompts.
- Photo storage in a private bucket with signed short-lived URLs and per-photo patient consent for use.
- Data retention, export and erasure-request handling for the patient's own data.
- Note: JCCP is a voluntary UK register, not a certifying body for software. The build follows its practice standards and UK GDPR; it will not claim certification anywhere in the UI.

**7. Sales and growth surfaces**
- Recall list: patients overdue for a treatment, one-click message.
- Treatment plans with recommended follow-up packages.
- Payment links: reserved as a placeholder action for now, wired up once you choose a provider.

## Technical notes
- TanStack Start with file routes: `/` (staff dashboard), `/patients`, `/patients/$id`, `/schedule`, `/forms`, `/analytics`, `/portal/*` for patients.
- Postgres tables: patients, practitioners, treatments, treatment_catalogue, treatment_photos, documents, document_signatures, messages, medical_history_versions, audit_log, kpi views.
- All reads/writes through authenticated server functions; photos and signed PDFs in private storage.
- Design tokens ported verbatim from the chosen direction into `src/styles.css`.

## Build order
1. Cloud + auth + schema + RLS + audit logging
2. Dashboard shell, left rail, KPI band
3. Patient list and patient record with treatment history
4. Photos (upload, pairing, comparison view)
5. Documents, consent, e-signature and sending
6. Messaging panel
7. Patient portal and self-service medical history updates
8. Analytics and recall lists

## Deliberately deferred
- Payments and clinic subscription billing (you chose to decide later)
- Multi-clinic tenancy — schema will carry a clinic_id from day one so this is an extension, not a rewrite
- Inventory/stock control, and calendar sync with external booking systems
