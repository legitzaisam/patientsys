/**
 * Offer stages: pure rules shared by the server (cohorts, automation), the
 * designer page (previews) and the tests. Nothing in here touches the
 * database or the network.
 */
import { asOfferImagePlacement, wrapOfferEmailCard, type OfferImagePlacement } from "./picture";

export const OFFER_STAGES = [
  "pre_consultation",
  "post_consultation",
  "single_treatment",
  "plan_ending",
] as const;

export type OfferStage = (typeof OFFER_STAGES)[number];
export type TemplateStage = OfferStage | "custom";

export const OFFER_STATUSES = ["sent", "viewed", "claimed", "expired", "cancelled"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OFFER_SOURCES = ["automation", "one_off", "bulk", "insights"] as const;
export type OfferSource = (typeof OFFER_SOURCES)[number];

export const STAGE_META: Record<
  OfferStage,
  { label: string; meaning: string; defaultDelayDays: number; insightsList?: string }
> = {
  pre_consultation: {
    label: "Pre-consultation",
    meaning: "Signed up but has not booked a consultation.",
    defaultDelayDays: 0,
    insightsList: "Signed up, nothing booked",
  },
  post_consultation: {
    label: "Post-consultation",
    meaning: "Had a consultation, then booked nothing and has no plan.",
    defaultDelayDays: 7,
    insightsList: "Consulted, no treatment",
  },
  single_treatment: {
    label: "Single treatment",
    meaning: "Had one treatment with nothing booked since.",
    defaultDelayDays: 21,
  },
  plan_ending: {
    label: "Plan ending",
    meaning: "On a skin plan of three or more sessions that is nearly finished.",
    defaultDelayDays: 0,
  },
};

export const STAGE_LABEL: Record<TemplateStage, string> = {
  pre_consultation: STAGE_META.pre_consultation.label,
  post_consultation: STAGE_META.post_consultation.label,
  single_treatment: STAGE_META.single_treatment.label,
  plan_ending: STAGE_META.plan_ending.label,
  custom: "One-off",
};

/** Facts about one patient, gathered once by the server and fed to `stageOf`. */
export type PatientFacts = {
  /** ISO date the patient record was created. */
  createdAt: string;
  /** ISO date of the first consultation (treatment or booked appointment), if any. */
  firstConsultAt: string | null;
  /** Non-consultation treatments performed, oldest first. */
  treatmentDates: string[];
  /** Whether any booked appointment lies in the future. */
  hasUpcomingBooking: boolean;
  /** The patient's active treatment plan, if any. */
  activePlan: PlanFacts | null;
};

export type PlanFacts = {
  startedAt: string;
  durationDays: number | null;
  sessionsTotal: number;
  sessionsDone: number;
};

/**
 * A plan is nearing its end when it has three or more sessions and either one
 * session (or none) is left, or more than 80% of its duration has elapsed.
 */
export function planNearingEnd(plan: PlanFacts, now = new Date()): boolean {
  if (plan.sessionsTotal < 3) return false;
  if (plan.sessionsTotal - plan.sessionsDone <= 1) return true;
  if (plan.durationDays && plan.durationDays > 0) {
    const elapsed = (now.getTime() - new Date(plan.startedAt).getTime()) / 86400000;
    return elapsed / plan.durationDays > 0.8;
  }
  return false;
}

export type StageResult = {
  stage: OfferStage;
  /** ISO date the patient entered the stage (drives the per-template delay). */
  since: string;
};

/**
 * Which offer stage a patient is in today, or null when none applies (they
 * have something booked, are mid-plan, or have had several treatments).
 */
export function stageOf(facts: PatientFacts, now = new Date()): StageResult | null {
  if (facts.activePlan) {
    if (planNearingEnd(facts.activePlan, now)) {
      return { stage: "plan_ending", since: facts.activePlan.startedAt };
    }
    return null;
  }
  if (facts.hasUpcomingBooking) return null;
  const treatments = facts.treatmentDates.length;
  if (treatments >= 2) return null;
  if (treatments === 1) return { stage: "single_treatment", since: facts.treatmentDates[0]! };
  if (facts.firstConsultAt) {
    if (new Date(facts.firstConsultAt).getTime() > now.getTime()) return null;
    return { stage: "post_consultation", since: facts.firstConsultAt };
  }
  return { stage: "pre_consultation", since: facts.createdAt };
}

/** True once the patient has been in the stage for at least `delayDays`. */
export function delayElapsed(since: string, delayDays: number, now = new Date()): boolean {
  const start = new Date(since).getTime();
  if (Number.isNaN(start)) return true;
  return now.getTime() - start >= delayDays * 86400000;
}

/* ------------------------------------------------------------------ */
/* rendering                                                           */
/* ------------------------------------------------------------------ */

export type OfferTemplateLike = {
  subject: string;
  headline: string;
  body: string;
  value_text?: string | null;
  code?: string | null;
  cta_label?: string | null;
  valid_days?: number | null;
  image_url?: string | null;
  image_placement?: OfferImagePlacement | string | null;
};

export type OfferRecipient = {
  first_name?: string | null;
  last_name?: string | null;
};

export type RenderedOffer = {
  subject: string;
  text: string;
  html: string;
  card: {
    headline: string;
    body: string;
    value_text: string | null;
    code: string | null;
    cta_label: string;
    image_url: string | null;
    image_placement: OfferImagePlacement | null;
  };
};

function fill(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => vars[key] ?? match);
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function offerExpiry(sentAt: string | Date, validDays: number | null | undefined) {
  const days = validDays && validDays > 0 ? validDays : 30;
  const sent = typeof sentAt === "string" ? new Date(sentAt) : sentAt;
  return new Date(sent.getTime() + days * 86400000).toISOString();
}

/**
 * Turn a template into what one patient receives: the email subject, a plain
 * text body (the outbox's source of truth), an HTML body with the claim
 * button, and the fields the portal card shows.
 */
export function renderOffer(
  template: OfferTemplateLike,
  patient: OfferRecipient,
  opts: { clinicName: string; claimUrl: string; personalLine?: string | null; expiresAt?: string | null },
): RenderedOffer {
  const firstName = (patient.first_name ?? "").trim() || "there";
  const vars = {
    first_name: firstName,
    full_name: `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim() || "there",
    clinic: opts.clinicName,
    offer: template.value_text ?? "",
    code: template.code ?? "",
  };
  const subject = fill(template.subject, vars).trim() || `An offer from ${opts.clinicName}`;
  const headline = fill(template.headline, vars).trim();
  const body = fill(template.body, vars).trim();
  const cta = (template.cta_label ?? "").trim() || "Claim this offer";
  const expiry = opts.expiresAt
    ? new Date(opts.expiresAt).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;
  const personal = opts.personalLine?.trim() || null;

  const textLines = [
    `Hi ${firstName},`,
    "",
    ...(personal ? [personal, ""] : []),
    headline,
    "",
    body,
    ...(template.value_text ? ["", `Your offer: ${template.value_text}`] : []),
    ...(template.code ? [`Quote code ${template.code} when you book.`] : []),
    ...(expiry ? [`Valid until ${expiry}.`] : []),
    "",
    `${cta}: ${opts.claimUrl}`,
    "",
    opts.clinicName,
  ];

  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.6">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const inner = `<p style="margin:0 0 18px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#7a8199">${escapeHtml(opts.clinicName)}</p>
<p style="margin:0 0 14px;line-height:1.6">Hi ${escapeHtml(firstName)},</p>
${personal ? `<p style="margin:0 0 14px;line-height:1.6">${escapeHtml(personal)}</p>` : ""}
<h1 style="margin:0 0 14px;font-size:26px;font-weight:600;line-height:1.25">${escapeHtml(headline)}</h1>
${paragraphs}
${
  template.value_text
    ? `<div style="margin:18px 0;padding:16px 18px;background:#f6efe0;border-radius:12px;font-size:18px;font-weight:600">${escapeHtml(template.value_text)}${
        template.code
          ? `<div style="margin-top:6px;font-size:13px;font-weight:400;color:#5b6379">Quote code <strong>${escapeHtml(template.code)}</strong> when you book.</div>`
          : ""
      }</div>`
    : template.code
      ? `<p style="margin:0 0 14px;line-height:1.6">Quote code <strong>${escapeHtml(template.code)}</strong> when you book.</p>`
      : ""
}
${expiry ? `<p style="margin:0 0 18px;font-size:13px;color:#5b6379">Valid until ${escapeHtml(expiry)}.</p>` : ""}
<p style="margin:24px 0"><a href="${escapeHtml(opts.claimUrl)}" style="display:inline-block;padding:13px 22px;background:#f2c14e;color:#1e2436;text-decoration:none;border-radius:999px;font-weight:600">${escapeHtml(cta)}</a></p>
<p style="margin:0;font-size:13px;color:#7a8199">Or paste this link into your browser:<br><a href="${escapeHtml(opts.claimUrl)}" style="color:#2f3f66">${escapeHtml(opts.claimUrl)}</a></p>`;

  const placement = asOfferImagePlacement(template.image_placement ?? null);
  const imageUrl = template.image_url?.trim() || null;
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f1ea;font-family:Georgia,'Times New Roman',serif;color:#1e2436">${wrapOfferEmailCard(inner, imageUrl, placement)}</body></html>`;

  return {
    subject,
    text: textLines.join("\n"),
    html,
    card: {
      headline,
      body,
      value_text: template.value_text?.trim() || null,
      code: template.code?.trim() || null,
      cta_label: cta,
      image_url: imageUrl,
      image_placement: imageUrl ? placement ?? "top" : null,
    },
  };
}

/** The link in the email: through the patient login, back to the offer. */
export function offerClaimUrl(origin: string, patientOfferId: string) {
  const base = origin.replace(/\/$/, "");
  const next = encodeURIComponent(`/my-record?offer=${patientOfferId}`);
  return `${base}/portal?next=${next}`;
}

/* ------------------------------------------------------------------ */
/* stage defaults (also the AI fallback)                               */
/* ------------------------------------------------------------------ */

export type OfferDraft = {
  name: string;
  subject: string;
  headline: string;
  body: string;
  value_text: string;
  cta_label: string;
};

export const STAGE_DEFAULT_DRAFT: Record<TemplateStage, OfferDraft> = {
  pre_consultation: {
    name: "Welcome consultation",
    subject: "Your complimentary consultation at {{clinic}}",
    headline: "Let's talk about your skin",
    body: "You signed up with us but we haven't met yet. Book a consultation this month and it's on us: a relaxed thirty minutes with one of our practitioners to talk through what you'd like to change and what would suit you.\n\nNo pressure and nothing to buy on the day.",
    value_text: "Complimentary consultation",
    cta_label: "Book my consultation",
  },
  post_consultation: {
    name: "After your consultation",
    subject: "{{first_name}}, a little something towards your first treatment",
    headline: "Ready when you are",
    body: "It was lovely to meet you. If you've been thinking about the plan we discussed, here's a small thank-you to help you take the first step.\n\nBook your first treatment in the next few weeks and we'll take the amount below off the price.",
    value_text: "£25 off your first treatment",
    cta_label: "Book my first treatment",
  },
  single_treatment: {
    name: "Keep the results going",
    subject: "Keep your results going, {{first_name}}",
    headline: "Your skin is just getting started",
    body: "Most treatments work best as a course, and the results from your first session build with each one. To make the next step easier, here's an offer on your follow-up.\n\nWe'd also love to hear how you've found things so far.",
    value_text: "15% off your next session",
    cta_label: "Book my next session",
  },
  plan_ending: {
    name: "Your plan is nearly complete",
    subject: "You're nearly there, {{first_name}}",
    headline: "Nearly at the end of your plan",
    body: "You've almost finished your skin plan, and the difference shows. To keep your results where they are, here's an offer on a maintenance session or your next course.\n\nAsk your practitioner what they'd recommend at your final appointment.",
    value_text: "20% off a maintenance course",
    cta_label: "Plan what's next",
  },
  custom: {
    name: "New offer",
    subject: "A little something from {{clinic}}",
    headline: "An offer just for you",
    body: "We'd love to see you again. Here's an offer to help you book your next visit.",
    value_text: "10% off your next visit",
    cta_label: "Claim this offer",
  },
};
