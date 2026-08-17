ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS suffix TEXT;

COMMENT ON COLUMN public.patients.suffix IS 'Name suffix such as Jr, Sr, III';

-- No new RLS policies needed; existing policies cover the new column.
-- No GRANT changes needed as this is an existing table already granted.