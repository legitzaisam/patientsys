# Group Retention & Performance under a Reports dropdown

## Goal
Reduce top-bar clutter by grouping the two analytics pages — Retention and Performance — under a single "Reports" dropdown in the main navigation for managers.

## What will change

### 1. Manager navigation
- Replace the separate **Retention** and **Performance** top-level links with one **Reports** dropdown in the main nav.
- The dropdown contains:
  - **Retention** → `/retention`
  - **Performance** → `/performance`
- The dropdown trigger shows an active state when the current route is `/retention` or `/performance`.

### 2. Practitioner/front-desk navigation
- Keep **Retention** as a single top-level item (practitioners do not see Performance, so a dropdown would contain only one item).
- Keep **My earnings** unchanged for practitioners.

### 3. Visual treatment
- Use the existing rounded-card / pill style and color tokens (`bg-secondary`, `text-foreground`, etc.).
- Match the current nav item spacing and hover behavior.

## Files to edit
- `src/components/app-shell.tsx`

## Out of scope
- No changes to the Retention or Performance pages themselves.
- No changes to routes, permissions, or data fetching.
