# Team page quick links and role legend

## Goal
Make the Team page feel more like a manager dashboard by replacing the large role cards with useful quick links, while keeping the role explanations available in context.

## What will change

### 1. Replace role cards with a quick-links toolbar
- Remove the three `Manager / Practitioner / Front desk` cards from the top of the page.
- Add a horizontal row of pill-shaped quick links/actions under the page header.

### 2. Quick links to include
- **Add staff account** — opens the existing account-creation dialog.
- **Profile change requests** — scrolls to the requests section and shows a badge with the number of pending requests.
- **Role help** — opens a small popover/tooltip explaining the three access levels.

### 3. Move role descriptions into a help popover
- Keep the role blurbs accessible but out of the way.
- Place them inside a "Role help" popover triggered from the quick-links row.

### 4. Pending badge on profile change requests
- Compute `pendingCount` from the existing `requests` query.
- Show an orange/red badge on the quick link when pending requests exist.
- Keep the existing "Profile change requests" section below the team list.

### 5. Visual tidy-up
- Use the existing rounded-card style and color tokens.
- Ensure the quick-links row does not feel like a second nav bar.

## Files to edit
- `src/routes/_authenticated/team.tsx`

## Out of scope
- No changes to backend functions, RLS, or data model.
- No changes to the profile change request approval flow itself.
