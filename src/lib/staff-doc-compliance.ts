/** Essential staff file categories for UK employment, GDPR and JCCP clinic practice. */
export const ESSENTIAL_DOC_CATEGORIES = [
  {
    value: "right_to_work",
    label: "Right to work / ID",
    reason: "UK employment law — proof of right to work",
  },
  {
    value: "dbs",
    label: "DBS check",
    reason: "Safeguarding — enhanced DBS for clinic roles",
  },
  {
    value: "jccp_register",
    label: "JCCP register entry",
    reason: "JCCP practitioner register confirmation",
  },
  {
    value: "statutory_registration",
    label: "Statutory registration",
    reason: "GMC / GDC / NMC / GPhC / HCPC where applicable",
  },
  {
    value: "indemnity_insurance",
    label: "Medical indemnity insurance",
    reason: "Current clinical indemnity cover",
  },
  {
    value: "bls",
    label: "BLS & anaphylaxis training",
    reason: "Emergency preparedness for clinical practice",
  },
  {
    value: "infection_control",
    label: "Infection control & sharps",
    reason: "Infection prevention for clinic procedures",
  },
  {
    value: "safeguarding",
    label: "Safeguarding training",
    reason: "Adults and children safeguarding",
  },
  {
    value: "information_governance",
    label: "Information governance / GDPR",
    reason: "UK GDPR and confidentiality training",
  },
  {
    value: "contract",
    label: "Contract & policies",
    reason: "Signed employment contract and clinic policies",
  },
] as const;

export type EssentialDocCategory = (typeof ESSENTIAL_DOC_CATEGORIES)[number]["value"];

export function missingEssentialDocs(presentCategories: string[]) {
  const present = new Set(presentCategories);
  return ESSENTIAL_DOC_CATEGORIES.filter((c) => !present.has(c.value));
}

export type ComplianceStatus = { tone: "ok" | "warn" | "bad"; label: string };

function daysUntil(dateKey: string, todayKey: string) {
  return Math.round((Date.parse(dateKey) - Date.parse(todayKey)) / 86_400_000);
}

/**
 * One line for the Team list: lapsed registration or insurance first, then an
 * expiry inside 60 days, then missing essential documents, else "Compliant".
 * `todayKey` is the clinic's day as YYYY-MM-DD.
 */
export function complianceStatus(
  input: {
    docsMissing: number;
    registrationExpiry?: string | null;
    insuranceExpiry?: string | null;
  },
  todayKey: string,
): ComplianceStatus {
  const expiries = [
    { what: "Registration", key: input.registrationExpiry },
    { what: "Insurance", key: input.insuranceExpiry },
  ].filter((e): e is { what: string; key: string } => Boolean(e.key));
  const lapsed = expiries.find((e) => daysUntil(e.key, todayKey) < 0);
  if (lapsed) return { tone: "bad", label: `${lapsed.what} lapsed` };
  const soon = expiries
    .map((e) => ({ ...e, days: daysUntil(e.key, todayKey) }))
    .filter((e) => e.days <= 60)
    .sort((a, b) => a.days - b.days)[0];
  if (soon) {
    return {
      tone: "warn",
      label:
        soon.days === 0
          ? `${soon.what} expires today`
          : `${soon.what} expires in ${soon.days} day${soon.days === 1 ? "" : "s"}`,
    };
  }
  if (input.docsMissing > 0) {
    return {
      tone: "warn",
      label: `${input.docsMissing} document${input.docsMissing === 1 ? "" : "s"} missing`,
    };
  }
  return { tone: "ok", label: "Compliant" };
}

export function remindUploadCopy(missingLabels: string[]) {
  const list =
    missingLabels.length === 0
      ? "your required staff documents"
      : missingLabels.join(", ");
  return {
    title: "Please upload missing staff documents",
    body: `Hi — our records show these essential documents are still needed on your staff file: ${list}. Please upload them from your profile when you can. These are required for UK employment, GDPR and JCCP clinic practice.`,
  };
}
