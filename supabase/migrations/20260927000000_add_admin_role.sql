-- Software-developer admin. A new enum value has to be committed before it
-- can be used, so this file only adds the value. is_staff() picks it up in
-- the following migration.

DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE 'admin';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
