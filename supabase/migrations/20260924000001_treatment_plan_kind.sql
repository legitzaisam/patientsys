-- What sort of plan a treatment plan is.
--
-- The dashboard journey card lists every active plan by phase. A plan raised
-- from the retention flow ("Win-back Review": a call, a consultation, a plan)
-- sat next to clinical courses with nothing to tell them apart, and read as a
-- treatment. Provenance is data, not something to infer from the name, so it
-- gets a column: a treatment course, a review track, or a re-engagement track.

ALTER TABLE public.treatment_plans
  ADD COLUMN kind text NOT NULL DEFAULT 'treatment'
    CHECK (kind IN ('treatment', 'review', 're_engagement'));

COMMENT ON COLUMN public.treatment_plans.kind IS
  'treatment = a clinical course; review = a maintenance/review track; re_engagement = a win-back track raised from retention.';
