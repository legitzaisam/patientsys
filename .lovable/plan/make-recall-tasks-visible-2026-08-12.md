# Make recall tasks visible

## Why you can't see it

Two reasons, both confirmed:

- No recall tasks exist yet in the database (zero records), and the panel is written to render nothing when a patient has no tasks — so it is invisible on every patient right now.
- Even with tasks, it sits at the bottom of the **Treatments** tab of a patient record, which is easy to miss.

## What to change

1. **Always show the panel** on the patient record instead of hiding it when empty. With no tasks it shows a short "No recall tasks yet" line plus an "Assign recall task" button.
2. **Move it somewhere obvious**: add a dedicated **Recalls** tab on the patient record (next to Treatments, Before and after, Documents, History updates), with the task tracker and the outreach history in it. Keep a small summary line ("2 open recall tasks") in the Treatments tab that jumps to the tab.
3. **Let tasks be created from the patient record**, not only from the Retention page hover card: the "Assign recall task" button opens the same staff picker (tick practitioner / front desk, add a note).
4. **Surface open tasks where staff work**: an "Open recalls" count on the Retention page header, so managers can see there is something outstanding without opening a patient.

## Technical notes

- `src/components/retention/recall-tasks-panel.tsx`: drop the `if (!tasks || tasks.length === 0) return null` early return; add empty state and a trigger button.
- Reuse the assignment UI from `staff-task-hovercard.tsx` by extracting its body into a shared dialog/popover component used in both places.
- `src/routes/_authenticated/patients.$id.tsx`: add the `recalls` tab trigger and content; keep the count badge on the Treatments tab.
- `src/routes/_authenticated/retention.tsx`: add an open-task count from a new `countOpenRecallTasks` server function in `src/lib/clinic.functions.ts`.
- No schema changes needed; `recall_tasks` already stores status and timestamps.
