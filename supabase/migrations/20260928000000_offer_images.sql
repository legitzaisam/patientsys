-- Pictures on offer templates, snapshotted onto each send so a later
-- edit does not change what the patient was shown.

ALTER TABLE public.offer_templates
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_placement text
    CHECK (image_placement IS NULL OR image_placement IN ('background', 'top', 'left', 'right', 'bottom'));

ALTER TABLE public.patient_offers
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_placement text
    CHECK (image_placement IS NULL OR image_placement IN ('background', 'top', 'left', 'right', 'bottom'));

COMMENT ON COLUMN public.offer_templates.image_url IS
  'Optional picture on the email and portal card. A public URL or a data URL in demo.';
COMMENT ON COLUMN public.offer_templates.image_placement IS
  'Where the picture sits on the card: background, top, left, right or bottom.';

INSERT INTO storage.buckets (id, name, public)
VALUES ('offer-images', 'offer-images', true)
ON CONFLICT (id) DO NOTHING;
