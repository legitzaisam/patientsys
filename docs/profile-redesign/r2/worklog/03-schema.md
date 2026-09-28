# Phase 3: schema and fixtures for working-pattern requests

Branch `e2e_live`, on top of `74b0c97`. 29 Sep 2026.

### r2-p3-01-migration

- `supabase/migrations/20261002000100_staff_pattern_requests.sql`: `staff_pattern_requests` (id, clinic_id, user_id, `rows jsonb` — seven `{ weekday, start, end }`, checked to be an array — note, `requires_owner`, status pending | approved | declined | withdrawn, requested_at, reviewed_by, reviewed_at, reviewer_note, created_at, updated_at); indexes on (clinic_id, user_id, requested_at desc) and a partial one on pending rows; RLS `is_staff` + `clinic_isolation` (RESTRICTIVE), REVOKE / GRANT and comments as in `20261001000200_staff_schedule_invoices_bookable.sql`.

### r2-p3-02-types-scope

- `src/integrations/supabase/types.ts`: `staff_pattern_requests` Row / Insert / Update / Relationships (clinic, reviewed_by → profiles, user_id → profiles), placed before `staff_time_off`.
- `src/lib/auth/clinic-scope.server.ts`: `"staff_pattern_requests"` in `CLINIC_SCOPED_TABLES`. `check:tenancy` → 59 tables (50 scoped), ok.

### r2-p3-03-demo-fixture

- `src/lib/demo/data.ts`: `staffPatternRequests` — one pending request from Dr Tom Whitfield (Saturday off, Wednesday 10:00–18:00 added, note "Saturdays off from next month please — I can cover Wednesdays instead.", requested two days ago, `requires_owner: false`), exported on `db`. Distinct id prefix `w5`.

### r2-p3-04-verify-commit

| Check | Result |
| ----- | ------ |
| `check:policy` | ok — 182 handlers |
| `check:tenancy` | ok — 59 tables |
| Unit | 209 passed (+11 from P1 / P2), the 11 pre-existing failures unchanged |
| tsc | 109 = baseline |
| Lint | delta 0 on `data.ts`, `types.ts`, `clinic-scope.server.ts` |

Files: the migration (new); `types.ts`, `clinic-scope.server.ts`, `demo/data.ts`.
