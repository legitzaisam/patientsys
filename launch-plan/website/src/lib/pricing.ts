// Every number on /pricing lives here. Prices are GBP per month, excluding VAT.
// Annual billing is ten months paid over twelve (two months free), so the
// monthly equivalent is monthly * 10 / 12, rounded.

export const annualMonths = 10;
export const perMonthAnnual = (monthly: number) => Math.round((monthly * annualMonths) / 12);
export const perYear = (monthly: number) => monthly * annualMonths;

export interface Tier {
  id: string;
  name: string;
  monthly: number | null; // null = custom
  who: string; // one line: who it is for
  seats: string; // practitioners and locations
  lead?: string; // "Everything in X, plus" line
  features: string[];
  cta: { label: string; href: string };
  featured?: boolean;
}

export const tiers: Tier[] = [
  {
    id: "solo",
    name: "Solo",
    monthly: 79,
    who: "One practitioner running their own list.",
    seats: "1 practitioner · 1 location",
    features: [
      "Unlimited patients",
      "The full patient portal: plan, roadmap, aftercare routine, check-ins and the AI aftercare assistant",
      "Diary and online booking",
      "Consent-gated visits with witnessed signatures",
      "Treatment records, notes and photos",
      "Deposits, payments and invoices",
    ],
    cta: { label: "Start with Solo", href: "/contact?topic=sales&plan=solo" },
  },
  {
    id: "clinic",
    name: "Clinic",
    monthly: 229,
    who: "A clinic with a small team and a front desk.",
    seats: "Up to 5 practitioners · 1 location",
    lead: "Everything in Solo, plus",
    features: [
      "Retention scoring and recall tasks",
      "Stage-based offers that send themselves",
      "Practitioner earnings and commission",
      "Insights and performance",
      "Role-shaped dashboards for owner, practitioner and front desk",
    ],
    cta: { label: "Start with Clinic", href: "/contact?topic=sales&plan=clinic" },
    featured: true,
  },
  {
    id: "group",
    name: "Group",
    monthly: 449,
    who: "Several practitioners across more than one site.",
    seats: "Up to 15 practitioners · up to 3 locations",
    lead: "Everything in Clinic, plus",
    features: ["Shared patient records across sites", "Cross-site reporting", "Priority support"],
    cta: { label: "Start with Group", href: "/contact?topic=sales&plan=group" },
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthly: null,
    who: "Groups with four or more sites, or sixteen or more practitioners.",
    seats: "Unlimited practitioners · unlimited locations",
    lead: "Everything in Group, plus",
    features: ["Dedicated onboarding and migration", "Custom reporting", "Named account contact"],
    cta: { label: "Talk to sales", href: "/contact?topic=sales&plan=enterprise" },
  },
];

export const everyPlan: string[] = [
  "Front desk, managers and owners who do not treat are never charged",
  "No per-patient fees, no booking fees, no marketplace commission",
  "The patient portal is included; patients pay nothing",
  "Data migration in, and export out, are free",
  "Text messages at cost; card payments at the payment provider's rates",
  "Monthly contracts; annual billing gives two months free",
];

// Published UK prices, September 2026, for a clinic with 4 practitioners and
// 2 front desk staff on the most common aesthetics platforms, once logins and
// the add-ons needed for a patient portal, automation and retention are
// counted. Excludes VAT, texts and card fees.
export const market = { low: 290, high: 480 };

export const faq: { q: string; a: string }[] = [
  {
    q: "Who counts as a practitioner?",
    a: "Anyone who can be booked for appointments or records treatments. Front desk, managers and owners who do not treat use SQINOS for free on every plan.",
  },
  {
    q: "Can I change plans?",
    a: "Yes, at any time. Monthly plans change from the next bill; annual plans are adjusted pro rata.",
  },
  {
    q: "Is there a trial?",
    a: "Walk through the live demo first, on a fictional clinic with no real data. When you are ready, we set your clinic up on a monthly plan that you can cancel at any time.",
  },
  {
    q: "What do patients pay?",
    a: "Nothing. The patient portal, the aftercare assistant and reminders are part of the clinic's plan.",
  },
  {
    q: "What about texts and card payments?",
    a: "Text messages are passed through at cost. Card payments are charged by the payment provider at its own rates; SQINOS adds nothing on top.",
  },
  {
    q: "How does moving from another system work?",
    a: "Send us an export of your patients, appointments and records and we import them for you, free. Your data is yours: export it at any time.",
  },
  {
    q: "Do prices include VAT?",
    a: "No. All prices are shown excluding VAT, which is added at the current UK rate.",
  },
];
