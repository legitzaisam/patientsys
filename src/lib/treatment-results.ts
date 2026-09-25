/** Result inputs for each treatment the clinic offers. One template per procedure. */

export type ResultColumn = "area" | "product" | "dose";

export type ResultField = {
  key: string;
  label: string;
  placeholder: string;
  column: ResultColumn;
};

export type ResultTemplate = { id: string; label: string; fields: ResultField[] };

const area = (placeholder: string): ResultField => ({
  key: "area",
  label: "Area treated",
  placeholder,
  column: "area",
});

export const RESULT_TEMPLATES: ResultTemplate[] = [
  {
    id: "toxin",
    label: "Anti-wrinkle injections",
    fields: [
      area("e.g. Glabella and frontalis"),
      {
        key: "product",
        label: "Brand and product",
        placeholder: "e.g. Botox, Azzalure, Bocouture",
        column: "product",
      },
      { key: "batch", label: "Batch / lot", placeholder: "e.g. Lot 4471", column: "dose" },
      { key: "units", label: "Units", placeholder: "e.g. 32 units", column: "dose" },
    ],
  },
  {
    id: "filler",
    label: "Dermal filler",
    fields: [
      area("e.g. Upper and lower lip"),
      { key: "product", label: "Product", placeholder: "e.g. Juvederm Volift", column: "product" },
      { key: "batch", label: "Batch / lot", placeholder: "e.g. Lot V8821", column: "dose" },
      { key: "volume", label: "Volume", placeholder: "e.g. 1ml", column: "dose" },
    ],
  },
  {
    id: "booster",
    label: "Skin booster",
    fields: [
      area("e.g. Full face"),
      {
        key: "product",
        label: "Product",
        placeholder: "e.g. Profhilo, Plinest",
        column: "product",
      },
      { key: "batch", label: "Batch / lot", placeholder: "e.g. Lot PH220", column: "dose" },
      { key: "volume", label: "Volume", placeholder: "e.g. 2ml", column: "dose" },
    ],
  },
  {
    id: "needling-prp",
    label: "Microneedling with PRP",
    fields: [
      area("e.g. Full face"),
      { key: "solution", label: "Solution", placeholder: "e.g. Autologous PRP", column: "product" },
      { key: "depth", label: "Needle depth", placeholder: "e.g. 1.0mm", column: "dose" },
      { key: "passes", label: "Passes", placeholder: "e.g. 3 passes", column: "dose" },
    ],
  },
  {
    id: "needling",
    label: "Microneedling",
    fields: [
      area("e.g. Full face"),
      {
        key: "solution",
        label: "Product / solution",
        placeholder: "e.g. Hyaluronic glide",
        column: "product",
      },
      { key: "depth", label: "Needle depth", placeholder: "e.g. 0.5mm", column: "dose" },
      { key: "passes", label: "Passes", placeholder: "e.g. 2 passes", column: "dose" },
    ],
  },
  {
    id: "prp",
    label: "PRP",
    fields: [
      area("e.g. Scalp, full face"),
      { key: "draw", label: "Draw volume", placeholder: "e.g. 10ml", column: "product" },
      { key: "applied", label: "Volume applied", placeholder: "e.g. 4ml", column: "dose" },
      { key: "depth", label: "Needle depth", placeholder: "e.g. 1.5mm", column: "dose" },
    ],
  },
  {
    id: "peel",
    label: "Chemical peel",
    fields: [
      area("e.g. Full face"),
      { key: "product", label: "Product", placeholder: "e.g. Glycolic peel", column: "product" },
      { key: "strength", label: "Strength", placeholder: "e.g. 20%", column: "dose" },
      { key: "time_applied", label: "Time applied", placeholder: "e.g. 3 minutes", column: "dose" },
    ],
  },
  {
    id: "hydrafacial",
    label: "Hydrafacial",
    fields: [
      area("e.g. Face and neck"),
      { key: "booster", label: "Booster / serum", placeholder: "e.g. Britenol", column: "product" },
      { key: "protocol", label: "Protocol", placeholder: "e.g. Signature", column: "dose" },
    ],
  },
  {
    id: "dermaplaning",
    label: "Dermaplaning",
    fields: [
      area("e.g. Full face"),
      {
        key: "blade",
        label: "Blade",
        placeholder: "e.g. Size 10 sterile blade",
        column: "product",
      },
      { key: "serum", label: "Serum used", placeholder: "e.g. Hyaluronic serum", column: "dose" },
    ],
  },
  {
    id: "led",
    label: "LED light therapy",
    fields: [
      area("e.g. Full face"),
      { key: "wavelength", label: "Wavelength", placeholder: "e.g. Red 633nm", column: "product" },
      { key: "time", label: "Time", placeholder: "e.g. 20 minutes", column: "dose" },
    ],
  },
  {
    id: "laser-hair",
    label: "Laser hair removal",
    fields: [
      area("e.g. Underarms"),
      {
        key: "device",
        label: "Device / wavelength",
        placeholder: "e.g. Nd:YAG 1064nm",
        column: "product",
      },
      { key: "fluence", label: "Fluence", placeholder: "e.g. 30 J/cm²", column: "dose" },
      { key: "pulse", label: "Pulse duration", placeholder: "e.g. 20ms", column: "dose" },
    ],
  },
  {
    id: "laser-skin",
    label: "Laser skin resurfacing",
    fields: [
      area("e.g. Full face"),
      { key: "device", label: "Device", placeholder: "e.g. CO2 fractional", column: "product" },
      { key: "passes", label: "Passes", placeholder: "e.g. 1 pass", column: "dose" },
      { key: "energy", label: "Energy", placeholder: "e.g. 15 mJ", column: "dose" },
    ],
  },
  {
    id: "ipl",
    label: "IPL",
    fields: [
      area("e.g. Cheeks"),
      { key: "device", label: "Device", placeholder: "e.g. Lumenis M22", column: "product" },
      { key: "filter", label: "Filter", placeholder: "e.g. 560nm", column: "dose" },
      { key: "fluence", label: "Fluence", placeholder: "e.g. 16 J/cm²", column: "dose" },
    ],
  },
  {
    id: "fat-dissolving",
    label: "Fat dissolving",
    fields: [
      area("e.g. Submental"),
      { key: "product", label: "Product", placeholder: "e.g. Aqualyx", column: "product" },
      { key: "batch", label: "Batch / lot", placeholder: "e.g. Lot AQ19", column: "dose" },
      { key: "volume", label: "Volume", placeholder: "e.g. 8ml", column: "dose" },
    ],
  },
  {
    id: "mesotherapy",
    label: "Mesotherapy",
    fields: [
      area("e.g. Full face"),
      { key: "product", label: "Product", placeholder: "e.g. NCTF 135", column: "product" },
      { key: "batch", label: "Batch / lot", placeholder: "e.g. Lot M441", column: "dose" },
      { key: "volume", label: "Volume", placeholder: "e.g. 3ml", column: "dose" },
    ],
  },
  {
    id: "vitamin",
    label: "Vitamin injection",
    fields: [
      { key: "site", label: "Site", placeholder: "e.g. Deltoid", column: "area" },
      { key: "product", label: "Product", placeholder: "e.g. Vitamin B12", column: "product" },
      { key: "dose", label: "Dose", placeholder: "e.g. 1ml", column: "dose" },
    ],
  },
  {
    id: "iv",
    label: "IV drip",
    fields: [
      { key: "product", label: "Product", placeholder: "e.g. Myers cocktail", column: "product" },
      { key: "volume", label: "Volume", placeholder: "e.g. 500ml", column: "dose" },
      { key: "time", label: "Time", placeholder: "e.g. 45 minutes", column: "dose" },
    ],
  },
  {
    id: "pmu",
    label: "Semi-permanent makeup",
    fields: [
      { key: "area", label: "Area", placeholder: "e.g. Brows", column: "area" },
      {
        key: "pigment",
        label: "Pigment and brand",
        placeholder: "e.g. PhiBrows espresso",
        column: "product",
      },
      {
        key: "needle",
        label: "Needle configuration",
        placeholder: "e.g. 1RL 0.25",
        column: "dose",
      },
    ],
  },
  {
    id: "tattoo",
    label: "Laser tattoo removal",
    fields: [
      area("e.g. Left wrist"),
      {
        key: "device",
        label: "Device / wavelength",
        placeholder: "e.g. Q-switched 1064nm",
        column: "product",
      },
      { key: "fluence", label: "Fluence", placeholder: "e.g. 4 J/cm²", column: "dose" },
      { key: "passes", label: "Passes", placeholder: "e.g. 2 passes", column: "dose" },
    ],
  },
  {
    id: "consultation",
    label: "Consultation",
    fields: [
      {
        key: "concern",
        label: "Presenting concern",
        placeholder: "e.g. Texture and pigmentation",
        column: "area",
      },
      {
        key: "recommendation",
        label: "Recommendation",
        placeholder: "e.g. Peel course, then review",
        column: "product",
      },
    ],
  },
];

const TEMPLATE_BY_ID = new Map(RESULT_TEMPLATES.map((t) => [t.id, t]));

/** Catalogue names, including the names already on file in live clinics. */
const NAME_TO_TEMPLATE: Record<string, string> = {
  "Anti-Wrinkle Injections": "toxin",
  "Botulinum Toxin Type A": "toxin",
  "Lip Filler": "filler",
  "Cheek Filler": "filler",
  "Jawline Filler": "filler",
  "Tear Trough Filler": "filler",
  "Chin Filler": "filler",
  "Non-surgical Rhinoplasty": "filler",
  "Hyaluronic Acid Dermal Filler": "filler",
  Profhilo: "booster",
  "Skin Booster": "booster",
  Polynucleotides: "booster",
  "Polynucleotide Skin Booster": "booster",
  "Microneedling with PRP": "needling-prp",
  "Microneedling with RF": "needling-prp",
  Microneedling: "needling",
  PRP: "prp",
  "Chemical Peel": "peel",
  "Medical Grade Chemical Peel": "peel",
  Hydrafacial: "hydrafacial",
  HydraFacial: "hydrafacial",
  Dermaplaning: "dermaplaning",
  "LED Light Therapy": "led",
  "Laser Hair Removal": "laser-hair",
  "Laser Skin Resurfacing": "laser-skin",
  IPL: "ipl",
  "Fat Dissolving": "fat-dissolving",
  Mesotherapy: "mesotherapy",
  "Vitamin Injection": "vitamin",
  "Vitamin B12 Injection": "vitamin",
  "IV Drip": "iv",
  "Brow Tattoo": "pmu",
  "Lip Blush": "pmu",
  "Eyeliner Tattoo": "pmu",
  "Laser Tattoo Removal": "tattoo",
  "Skin Consultation": "consultation",
  "Aesthetic Consultation": "consultation",
  "Follow-up Review": "consultation",
};

export function templateFor(
  name: string | null | undefined,
  templateId?: string | null,
): ResultTemplate {
  const chosen = templateId ? TEMPLATE_BY_ID.get(templateId) : undefined;
  if (chosen) return chosen;
  const byName = name ? TEMPLATE_BY_ID.get(NAME_TO_TEMPLATE[name] ?? "") : undefined;
  return byName ?? RESULT_TEMPLATES.find((t) => t.id === "consultation")!;
}

export function fieldsFor(
  name: string | null | undefined,
  templateId?: string | null,
): ResultField[] {
  return templateFor(name, templateId).fields;
}

/** Copy the keyed answers onto the three columns the treatment history already shows. */
export function foldResults(fields: ResultField[], values: Record<string, string | undefined>) {
  const pick = (column: ResultColumn) =>
    fields
      .filter((f) => f.column === column)
      .map((f) => values[f.key]?.trim())
      .filter((v): v is string => Boolean(v))
      .join(" · ");
  return {
    area: pick("area") || null,
    product: pick("product") || null,
    dose: pick("dose") || null,
  };
}
