import { describe, expect, it } from "vitest";
import { buildStageCohorts, previewStage } from "@/lib/offers/cohorts";
import { sendOfferToPatients, type OfferStore, type SendableTemplate } from "@/lib/offers/send";
import { loggedOutDestination } from "@/routes/_authenticated/route";

const NOW = new Date("2026-09-24T09:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

const consented = {
  marketing_opt_in: true,
  email_opt_in: true,
  sms_opt_in: false,
  reminders_opt_in: true,
  unsubscribed_at: null,
};
const notConsented = { ...consented, marketing_opt_in: false };

const patients = [
  { id: "p1", first_name: "Isla", last_name: "Hartley", email: "isla@x.test", phone: null, status: "active", created_at: daysAgo(11), ...consented },
  { id: "p2", first_name: "Maya", last_name: "Quayle", email: "maya@x.test", phone: null, status: "active", created_at: daysAgo(18), ...notConsented },
  { id: "p3", first_name: "Freya", last_name: "Nielsen", email: "freya@x.test", phone: null, status: "active", created_at: daysAgo(28), ...consented },
  { id: "p4", first_name: "Bea", last_name: "Moreau", email: "bea@x.test", phone: null, status: "active", created_at: daysAgo(19), ...consented },
  { id: "p5", first_name: "Gone", last_name: "Away", email: "gone@x.test", phone: null, status: "archived", created_at: daysAgo(90), ...consented },
];

const input = {
  patients,
  appointments: [
    { patient_id: "p4", starts_at: daysAgo(9), status: "attended", treatment_name: "Skin Consultation", catalogue_id: null },
  ],
  treatments: [
    { patient_id: "p3", performed_at: daysAgo(16), name: "Skin Consultation", catalogue_id: null },
  ],
  catalogue: [],
  plans: [],
  milestones: [],
  offers: [{ patient_id: "p3", stage: "post_consultation", status: "viewed", source: "automation" }],
  now: NOW,
};

describe("buildStageCohorts", () => {
  it("places each patient in a stage and leaves archived records out", () => {
    const members = buildStageCohorts(input);
    const byId = Object.fromEntries(members.map((m) => [m.patient_id, m.stage]));
    expect(byId).toEqual({
      p1: "pre_consultation",
      p2: "pre_consultation",
      p3: "post_consultation",
      p4: "post_consultation",
    });
  });
});

describe("previewStage", () => {
  it("splits a stage into will-send and skipped with reasons", () => {
    const members = buildStageCohorts(input);
    const pre = previewStage(members, patients, input.offers, "pre_consultation", 0, NOW);
    expect(pre.willSend.map((r) => r.name)).toEqual(["Isla Hartley"]);
    expect(pre.skipped.map((r) => [r.name, r.reason])).toEqual([["Maya Quayle", "no_marketing_consent"]]);

    const post = previewStage(members, patients, input.offers, "post_consultation", 7, NOW);
    expect(post.willSend.map((r) => r.name)).toEqual(["Bea Moreau"]);
    expect(post.skipped.map((r) => r.reason)).toEqual(["already_offered"]);

    const waiting = previewStage(members, patients, input.offers, "post_consultation", 14, NOW);
    expect(waiting.willSend).toEqual([]);
    expect(waiting.skipped.map((r) => r.reason).sort()).toEqual(["already_offered", "waiting_for_delay"]);
  });

  it("puts no-consent patients on the portal-only list when the template shows a card", () => {
    const members = buildStageCohorts(input);
    const pre = previewStage(members, patients, input.offers, "pre_consultation", 0, NOW, {
      showInPortal: true,
    });
    expect(pre.willSend.map((r) => r.name)).toEqual(["Isla Hartley"]);
    expect(pre.portalOnly.map((r) => r.name)).toEqual(["Maya Quayle"]);
    expect(pre.skipped).toEqual([]);
  });

  it("applies one-per-patient and no-stacking to the preview", () => {
    const members = buildStageCohorts(input);
    const offers = [
      ...input.offers,
      {
        patient_id: "p1",
        stage: "custom",
        status: "expired",
        source: "one_off",
        template_id: "tpre",
        expires_at: daysAgo(3),
      },
      {
        patient_id: "p2",
        stage: "custom",
        status: "sent",
        source: "one_off",
        template_id: "t9",
        expires_at: new Date(NOW.getTime() + 86400000).toISOString(),
      },
    ];
    const pre = previewStage(members, patients, offers, "pre_consultation", 0, NOW, {
      templateId: "tpre",
      onePerPatient: true,
      noStacking: true,
      showInPortal: true,
    });
    expect(pre.willSend).toEqual([]);
    expect(pre.portalOnly).toEqual([]);
    expect(pre.skipped.map((r) => [r.name, r.reason])).toEqual([
      ["Isla Hartley", "already_offered"],
      ["Maya Quayle", "has_live_offer"],
    ]);
  });
});

const template: SendableTemplate = {
  id: "t1",
  stage: "custom",
  subject: "{{first_name}}, {{offer}}",
  headline: "Autumn skin reset",
  body: "Book a peel.",
  value_text: "Complimentary LED",
  code: "AUTUMNLED",
  cta_label: "Claim this offer",
  valid_days: 21,
  send_email: true,
  send_sms: false,
  show_in_portal: true,
};

function fakeStore() {
  const offers: any[] = [];
  const queued: any[] = [];
  const store: OfferStore = {
    clinicId: "c1",
    clinicName: "Aetheria",
    origin: "https://clinic.test",
    async getPatients(ids) {
      return patients.filter((p) => ids.includes(p.id));
    },
    async insertOffer(row) {
      const id = `o${offers.length + 1}`;
      offers.push({ id, ...row });
      return id;
    },
    async linkCommunication(offerId, communicationId) {
      offers.find((o) => o.id === offerId).communication_id = communicationId;
    },
    async enqueue(i) {
      queued.push(i);
      return { id: `m${queued.length}` };
    },
  };
  return { store, offers, queued };
}

describe("sendOfferToPatients", () => {
  it("emails consented patients with the claim link and records the send", async () => {
    const { store, offers, queued } = fakeStore();
    const result = await sendOfferToPatients(store, template, ["p1"], {
      source: "one_off",
      sentBy: "u1",
      personalLine: "Lovely to meet you.",
      portalOnlyWhenNoConsent: true,
      now: NOW,
    });
    expect(result.sent).toHaveLength(1);
    expect(result.sent[0]!.channels).toEqual(["email"]);
    expect(offers[0]).toMatchObject({ patient_id: "p1", status: "sent", source: "one_off", code: "AUTUMNLED", communication_id: "m1" });
    expect(offers[0].expires_at).toBe("2026-10-15T09:00:00.000Z");
    expect(queued[0]).toMatchObject({ channel: "email", purpose: "marketing", templateKey: "offer", relatedEntity: "patient_offers", relatedId: "o1" });
    expect(queued[0].subject).toBe("Isla, Complimentary LED");
    expect(queued[0].body).toContain("Lovely to meet you.");
    expect(queued[0].body).toContain("https://clinic.test/portal?next=%2Fmy-record%3Foffer%3Do1");
    expect(queued[0].bodyHtml).toContain("<a href=\"https://clinic.test/portal?next=%2Fmy-record%3Foffer%3Do1\"");
  });

  it("gives a non-consented patient a portal-only card on a one-off send, and skips them for automation", async () => {
    const oneOff = fakeStore();
    const r1 = await sendOfferToPatients(oneOff.store, template, ["p2"], {
      source: "bulk",
      sentBy: "u1",
      portalOnlyWhenNoConsent: true,
      now: NOW,
    });
    expect(r1.sent[0]).toMatchObject({ patient_id: "p2", channels: [] });
    expect(r1.sent[0]!.note).toContain("Portal only");
    expect(oneOff.queued).toHaveLength(0);
    expect(oneOff.offers).toHaveLength(1);

    const auto = fakeStore();
    const r2 = await sendOfferToPatients(auto.store, template, ["p2"], {
      source: "automation",
      sentBy: null,
      portalOnlyWhenNoConsent: false,
      now: NOW,
    });
    expect(r2.sent).toEqual([]);
    expect(r2.skipped[0]).toMatchObject({ patient_id: "p2", reason: "This patient has not opted in to marketing messages." });
    expect(auto.offers).toHaveLength(0);
  });

  it("enforces one per patient and no stacking, and names the treatments it applies to", async () => {
    const { store, offers, queued } = fakeStore();
    const existing = [
      // p1 already had this template; p3 holds a live offer from another template; p4 has only an expired one.
      { patient_id: "p1", template_id: "t1", status: "expired", expires_at: daysAgo(2) },
      {
        patient_id: "p3",
        template_id: "t9",
        status: "viewed",
        expires_at: new Date(NOW.getTime() + 5 * 86400000).toISOString(),
      },
      { patient_id: "p4", template_id: "t9", status: "sent", expires_at: daysAgo(1) },
    ];
    store.listOffers = async (ids) => existing.filter((o) => ids.includes(o.patient_id));
    store.catalogueNames = async (ids) =>
      ids.map((id) => ({ c1: "Chemical peel", c2: "Microneedling" })[id] ?? id);
    const ruled: SendableTemplate = {
      ...template,
      applies_to_catalogue_ids: ["c1", "c2"],
      one_per_patient: true,
      no_stacking: true,
    };
    const result = await sendOfferToPatients(store, ruled, ["p1", "p3", "p4"], {
      source: "bulk",
      sentBy: "u1",
      portalOnlyWhenNoConsent: true,
      now: NOW,
    });
    expect(result.skipped.map((s) => [s.patient_id, s.reason])).toEqual([
      ["p1", "Already had this offer (one per patient)."],
      ["p3", "Has a live offer already (no stacking)."],
    ]);
    expect(result.sent.map((s) => s.patient_id)).toEqual(["p4"]);
    expect(offers[0].body).toBe("Book a peel.\n\nApplies to: Chemical peel, Microneedling.");
    expect(queued[0].body).toContain("Applies to: Chemical peel, Microneedling.");
  });

  it("lets the rules be switched off", async () => {
    const { store } = fakeStore();
    store.listOffers = async () => [
      { patient_id: "p1", template_id: "t1", status: "claimed", expires_at: null },
    ];
    const result = await sendOfferToPatients(
      store,
      { ...template, one_per_patient: false, no_stacking: false },
      ["p1"],
      { source: "one_off", sentBy: "u1", portalOnlyWhenNoConsent: true, now: NOW },
    );
    expect(result.sent).toHaveLength(1);
  });

  it("skips archived and unknown patients", async () => {
    const { store } = fakeStore();
    const result = await sendOfferToPatients(store, template, ["p5", "nope"], {
      source: "insights",
      sentBy: "u1",
      portalOnlyWhenNoConsent: true,
      now: NOW,
    });
    expect(result.sent).toEqual([]);
    expect(result.skipped.map((s) => s.reason)).toEqual(["This patient is archived.", "Patient not found."]);
  });
});

describe("loggedOutDestination", () => {
  it("carries portal paths through the patient login and sends staff to /auth", () => {
    expect(loggedOutDestination({ pathname: "/my-record", search: "?offer=abc" })).toBe(
      "/portal?next=%2Fmy-record%3Foffer%3Dabc",
    );
    expect(loggedOutDestination({ pathname: "/my-record/resources", search: "" })).toBe(
      "/portal?next=%2Fmy-record%2Fresources",
    );
    expect(loggedOutDestination({ pathname: "/dashboard", search: "" })).toBe("/auth");
    expect(loggedOutDestination({ pathname: "/my-records-x", search: "" })).toBe("/auth");
  });
});
