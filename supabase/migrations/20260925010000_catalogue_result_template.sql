ALTER TABLE public.treatment_catalogue
  ADD COLUMN IF NOT EXISTS result_template text;

INSERT INTO public.treatment_catalogue (
  clinic_id, name, category, description, price, interval_days, cooling_off_hours, requires_consent, result_template
)
SELECT c.id, v.name, v.category, v.description, v.price::numeric, v.interval_days::integer, v.cooling_off_hours::integer, v.requires_consent::boolean, v.result_template
FROM public.clinics c
CROSS JOIN (
  VALUES
    ('Anti-Wrinkle Injections', 'Injectables', 'Three areas, botulinum toxin type A. Review at two weeks.', 275, 120, 48, true, 'toxin'),
    ('Lip Filler', 'Injectables', '0.5–1ml hyaluronic acid, cannula technique.', 320, 270, 48, true, 'filler'),
    ('Cheek Filler', 'Injectables', 'Midface volumisation, 1–2ml.', 450, 365, 48, true, 'filler'),
    ('Jawline Filler', 'Injectables', 'Mandibular contouring, 1–2ml hyaluronic acid.', 480, 365, 48, true, 'filler'),
    ('Tear Trough Filler', 'Injectables', 'Under-eye hyaluronic acid, cannula technique.', 400, 365, 48, true, 'filler'),
    ('Chin Filler', 'Injectables', 'Chin projection, 1–2ml hyaluronic acid.', 380, 365, 48, true, 'filler'),
    ('Non-surgical Rhinoplasty', 'Injectables', 'Nasal bridge and tip contouring with filler.', 450, 365, 48, true, 'filler'),
    ('Profhilo', 'Skin Boosters', 'Two-session bio-remodelling course, four weeks apart.', 350, 180, 48, true, 'booster'),
    ('Skin Booster', 'Skin Boosters', 'Hyaluronic acid skin quality course.', 280, 180, 48, true, 'booster'),
    ('Polynucleotides', 'Skin Boosters', 'Salmon-DNA biostimulator course, three sessions.', 380, 90, 48, true, 'booster'),
    ('Microneedling with PRP', 'Skin', 'Collagen induction with platelet-rich plasma.', 295, 90, 48, true, 'needling-prp'),
    ('Microneedling', 'Skin', 'Collagen induction without PRP.', 220, 42, 48, true, 'needling'),
    ('PRP', 'Skin', 'Platelet-rich plasma, injected or applied.', 350, 90, 48, true, 'prp'),
    ('Chemical Peel', 'Skin', 'Medium-depth resurfacing peel.', 150, 60, 48, true, 'peel'),
    ('Hydrafacial', 'Skin', 'Medical-grade cleanse, extract and hydrate.', 165, 28, 0, false, 'hydrafacial'),
    ('Dermaplaning', 'Skin', 'Manual exfoliation with a sterile blade.', 90, 28, 0, false, 'dermaplaning'),
    ('LED Light Therapy', 'Skin', 'Red or blue light session.', 60, 14, 0, false, 'led'),
    ('Laser Hair Removal', 'Laser', 'Course of six, Nd:YAG.', 180, 42, 48, true, 'laser-hair'),
    ('Laser Skin Resurfacing', 'Laser', 'Fractional laser for texture and tone.', 450, 90, 48, true, 'laser-skin'),
    ('IPL', 'Laser', 'Intense pulsed light for pigment and redness.', 200, 28, 48, true, 'ipl'),
    ('Fat Dissolving', 'Injectables', 'Injectable fat reduction, usually under the chin.', 300, 42, 48, true, 'fat-dissolving'),
    ('Mesotherapy', 'Injectables', 'Superficial cocktail of vitamins and hyaluronic acid.', 220, 28, 48, true, 'mesotherapy'),
    ('Vitamin Injection', 'Wellness', 'Intramuscular vitamin, usually B12.', 45, 30, 0, false, 'vitamin'),
    ('IV Drip', 'Wellness', 'Intravenous vitamin infusion.', 150, 30, 48, true, 'iv'),
    ('Brow Tattoo', 'Semi-permanent makeup', 'Powder or hair-stroke brows.', 350, 365, 48, true, 'pmu'),
    ('Lip Blush', 'Semi-permanent makeup', 'Semi-permanent lip colour.', 350, 365, 48, true, 'pmu'),
    ('Eyeliner Tattoo', 'Semi-permanent makeup', 'Lash-line enhancement.', 280, 365, 48, true, 'pmu'),
    ('Laser Tattoo Removal', 'Laser', 'Q-switched or picosecond laser, per session.', 150, 42, 48, true, 'tattoo'),
    ('Skin Consultation', 'Consultation', 'Thirty minute assessment and treatment plan.', 50, 180, 0, false, 'consultation'),
    ('Follow-up Review', 'Consultation', 'Review of a recent treatment.', 0, NULL, 0, false, 'consultation')
) AS v(name, category, description, price, interval_days, cooling_off_hours, requires_consent, result_template)
WHERE NOT EXISTS (
  SELECT 1 FROM public.treatment_catalogue t
  WHERE t.clinic_id = c.id AND t.name = v.name
);

UPDATE public.treatment_catalogue
SET interval_days = 180
WHERE name = 'Skin Consultation'
  AND interval_days IS DISTINCT FROM 180;
