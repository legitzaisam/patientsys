/**
 * Aftercare points read out to the patient after a treatment.
 *
 * The catalogue carries points per treatment (`treatment_catalogue.
 * aftercare_points`); where a row has none, these category defaults apply so
 * the form's third page is never empty. Keyed by the catalogue `category`.
 */

const BY_CATEGORY: Record<string, string[]> = {
  Injectables: [
    "Stay upright for four hours and avoid lying face down tonight.",
    "No make-up, exercise, saunas or alcohol for 24 hours.",
    "Do not rub, massage or press the treated area for 48 hours.",
    "Mild swelling, redness or small bruises are normal and settle within a week; arnica helps.",
    "Full result shows at two weeks — the review is booked for then.",
  ],
  "Skin Boosters": [
    "Expect small bumps at the injection points for 24 to 48 hours.",
    "Avoid make-up, heat, sun and exercise for 24 hours.",
    "Keep the area clean; use only the products recommended in your routine.",
    "Results build over four weeks and with the next session.",
  ],
  Skin: [
    "Skin may feel warm, tight or look pink for 24 to 72 hours.",
    "Use SPF 50 every day for two weeks and avoid direct sun.",
    "Pause retinoids, acids and exfoliants for five days.",
    "Do not pick or peel flaking skin; let it come away on its own.",
    "Keep the skin hydrated with the recovery cream in your routine.",
  ],
  Laser: [
    "Cool the area with a clean compress if it feels warm.",
    "Avoid sun exposure and use SPF 50 on treated skin for four weeks.",
    "No hot baths, saunas, swimming or exercise for 48 hours.",
    "Shave rather than wax or pluck between sessions.",
  ],
  Consultation: [
    "Your plan and next steps are in your portal under Skin Plan & Journey.",
    "Message the clinic through the portal with any questions before your first session.",
  ],
  Wellness: [
    "Drink plenty of water today.",
    "A small bruise at the injection site is normal.",
    "Contact the clinic if you feel unwell in the next 24 hours.",
  ],
};

const GENERAL: string[] = [
  "Contact the clinic through the portal or by phone with any concerns.",
  "Seek urgent care for severe pain, spreading redness, blanching skin or signs of infection.",
];

/**
 * Points for a treatment: the catalogue's own list when set, else the
 * category defaults, always followed by the general safety lines.
 */
export function aftercarePointsFor(input: {
  catalogueAftercare?: string[] | null;
  category?: string | null;
}): string[] {
  const own = (input.catalogueAftercare ?? []).map((p) => p.trim()).filter(Boolean);
  const base = own.length ? own : (BY_CATEGORY[input.category ?? ""] ?? []);
  return [...base, ...GENERAL.filter((g) => !base.includes(g))];
}

export const AFTERCARE_CATEGORIES = Object.keys(BY_CATEGORY);
