ALTER TABLE public.treatment_catalogue
  ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 60;

UPDATE public.treatment_catalogue
SET duration_minutes = 20
WHERE name ~* '(botox|botulinum|anti-?[[:space:]]?wrinkle)';

UPDATE public.treatment_catalogue
SET duration_minutes = 30
WHERE name ~* 'consult';
