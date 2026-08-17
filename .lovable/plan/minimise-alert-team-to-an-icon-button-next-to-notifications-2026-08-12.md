# Minimise "Alert team" to an icon button next to notifications

## Goal
Move the staff alert trigger from a labelled text button to a compact icon-only button positioned directly beside the notification bell in the top-right header.

## Why
- Reduces header clutter and balances the right-hand icon cluster.
- Keeps the alert action one tap away for staff.
- Matches the existing icon-only pattern used for the notification bell.

## What will change
1. In `src/components/app-shell.tsx`:
   - Replace the current "Alert team" text button with an icon-only `Button` (megaphone icon).
   - Place it immediately to the left of the `NotificationBell`.
   - Keep the existing `StaffAlertDialog` wrapper so the click behaviour is unchanged.
   - Add an `aria-label` for accessibility.

2. Optional follow-up:
   - Add a small dot or badge on the megaphone icon if there is a pending urgent alert from the current user. (Deferred unless requested.)

## Out of scope
- No changes to `StaffAlertDialog` functionality.
- No changes to notification bell behaviour.
- No backend or routing changes.
