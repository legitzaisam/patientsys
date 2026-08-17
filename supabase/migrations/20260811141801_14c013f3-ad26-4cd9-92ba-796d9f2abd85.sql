CREATE TYPE public.visit_stage AS ENUM ('booked','arrived','waiting','in_treatment','aftercare','complete','no_show');

ALTER TABLE public.appointments
  ADD COLUMN stage public.visit_stage NOT NULL DEFAULT 'booked';

UPDATE public.appointments SET stage = 'complete' WHERE status = 'attended';
UPDATE public.appointments SET stage = 'no_show' WHERE status = 'no_show';