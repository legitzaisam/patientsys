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
