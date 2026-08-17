# Realtime patient-clinic messaging

## Goal
Turn the existing secure message thread into a live chat experience, so staff and patients see new messages instantly without refreshing. Add lightweight read receipts so staff know when a patient has seen their message.

## Current state
- A single `messages` table stores every patient-clinic thread.
- Staff write from the patient record page; patients write from `/my-record`.
- Messages are fetched once on page load and only refresh after a send or a manual reload.
- The `read_at` column exists but is not used.

## Proposed changes

### 1. Database — enable realtime for messages
- Add the `messages` table to the Supabase realtime publication so inserts/updates are broadcast.
- No schema changes are required; `read_at` is already present.

### 2. Backend — mark messages as read
- New server function `markMessagesRead({ patient_id })`:
  - Patients mark staff messages as read for their own thread.
  - Staff mark patient messages as read for that patient.
  - Updates `read_at` only on unread messages where the caller is the recipient.

### 3. Staff patient-record page (`patients/$id.tsx`)
- Subscribe to realtime changes on `public.messages` filtered to the current `patient_id`.
- On a new/updated message, merge it into the cached thread and scroll the panel to the bottom.
- Call `markMessagesRead` when the message panel mounts and when a new patient message arrives.
- Render a small "Read" indicator under staff messages that have `read_at` set.
- Keep the existing send form and optimistic UI.

### 4. Patient portal (`my-record.tsx`)
- Subscribe to realtime changes on `public.messages` filtered to the logged-in patient's `patient_id`.
- Merge incoming staff messages into the thread immediately.
- Call `markMessagesRead` on mount and when a new staff message arrives.
- Show a "Read" indicator under patient messages when `read_at` is set.

### 5. Cleanup
- Unsubscribe from the realtime channel on unmount to avoid connection leaks and unexpected bills.
- Guard subscriptions behind `typeof window !== "undefined"` / `useEffect` so they never run during SSR.

## Out of scope for this plan
- Email, SMS or push notifications (can be added later).
- File attachments in messages.
- Group or multi-patient broadcasts.

## Success criteria
- A staff member and patient can message each other in two open windows and see messages appear within a second on both sides.
- Read receipts update when the recipient opens or returns to the thread.
- No duplicate subscriptions appear in browser dev tools after navigating between pages.
