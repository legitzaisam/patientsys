-- Phase 5.1 — take the write grants back off the browser-facing roles.
--
-- Both `anon` and `authenticated` held all seven privileges on all 27 public
-- tables. RLS made that survivable for most of them, but not for TRUNCATE:
-- row-level security does not apply to TRUNCATE at all, so no policy could
-- have stopped it. That is the privilege this migration exists to remove.
--
-- `authenticated` keeps INSERT/UPDATE/DELETE because RLS does govern those and
-- the patient portal needs them. `anon` keeps only SELECT, which every policy
-- already refuses since they all resolve through auth.uid().
--
-- Note this changes nothing for application traffic today: every request runs
-- on the service-role client, which bypasses RLS and holds its own grants.
-- This is defence-in-depth for the day that changes (audit 4.1).

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM anon;

REVOKE TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM authenticated;

-- Without this, the next CREATE TABLE re-grants everything and quietly undoes
-- the two statements above. Supabase seeds default ACLs under both role owners.
DO $$
DECLARE grantor text;
BEGIN
  FOREACH grantor IN ARRAY ARRAY['postgres', 'supabase_admin'] LOOP
    BEGIN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public
           REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon',
        grantor);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public
           REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM authenticated',
        grantor);
    EXCEPTION WHEN insufficient_privilege THEN
      -- Not a member of that role on this connection; the other one covers us.
      RAISE NOTICE 'skipped default privileges for %', grantor;
    END;
  END LOOP;
END $$;
