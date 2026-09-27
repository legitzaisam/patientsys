-- Offer rules: which treatments an offer applies to, one per patient, and
-- no stacking with another live offer. Enforced by the send path.

ALTER TABLE public.offer_templates
  ADD COLUMN IF NOT EXISTS applies_to_catalogue_ids uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS one_per_patient boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS no_stacking boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.offer_templates.applies_to_catalogue_ids IS
  'Catalogue items the offer can be redeemed against. Empty means any treatment.';
COMMENT ON COLUMN public.offer_templates.one_per_patient IS
  'A patient can receive this template once (across sends).';
COMMENT ON COLUMN public.offer_templates.no_stacking IS
  'Not sent to a patient who already holds an unexpired, unclaimed offer.';
