import { describe, expect, it } from "vitest";
import {
  canStartTreatment,
  consentState,
  manualStageOptions,
  preCheckFlags,
  stageAfterArrival,
} from "@/lib/visit-stage";
import { aftercarePointsFor } from "@/lib/aftercare-defaults";

describe("consentState", () => {
  it("is signed when the linked document is signed, whatever the catalogue says", () => {
    expect(consentState({ documentStatus: "signed", requiresConsent: true })).toBe("signed");
    expect(consentState({ documentStatus: "signed", requiresConsent: false })).toBe("signed");
  });

  it("is not required only when the catalogue says so and nothing is signed", () => {
    expect(consentState({ documentStatus: null, requiresConsent: false })).toBe("not_required");
    expect(consentState({ documentStatus: "sent", requiresConsent: false })).toBe("not_required");
  });

  it("is outstanding when consent is required and unsigned, or unknown", () => {
    expect(consentState({ documentStatus: "sent", requiresConsent: true })).toBe("outstanding");
    expect(consentState({ documentStatus: null, requiresConsent: true })).toBe("outstanding");
    expect(consentState({ documentStatus: null, requiresConsent: null })).toBe("outstanding");
    expect(consentState({})).toBe("outstanding");
  });
});

describe("stageAfterArrival", () => {
  it("moves straight to waiting when consent is done, else stays arrived", () => {
    expect(stageAfterArrival("signed")).toBe("waiting");
    expect(stageAfterArrival("not_required")).toBe("arrived");
    expect(stageAfterArrival("outstanding")).toBe("arrived");
  });
});

describe("manualStageOptions", () => {
  it("disables waiting with a reason while consent is outstanding", () => {
    const waiting = manualStageOptions({ current: "arrived", consent: "outstanding" }).find((o) => o.key === "waiting");
    expect(waiting?.enabled).toBe(false);
    expect(waiting?.reason).toMatch(/consent/i);
  });

  it("offers waiting only once a form is signed", () => {
    expect(manualStageOptions({ current: "arrived", consent: "signed" }).find((o) => o.key === "waiting")?.enabled).toBe(true);
    expect(
      manualStageOptions({ current: "arrived", consent: "not_required" }).find((o) => o.key === "waiting")?.enabled,
    ).toBe(false);
  });

  it("routes in_treatment through the form and keeps the rest free", () => {
    const options = manualStageOptions({ current: "waiting", consent: "signed" });
    expect(options.find((o) => o.key === "in_treatment")?.opensForm).toBe(true);
    for (const key of ["booked", "arrived", "aftercare", "complete", "no_show"] as const) {
      const option = options.find((o) => o.key === key);
      expect(option?.enabled).toBe(true);
      expect(option?.opensForm).toBeUndefined();
    }
  });
});

describe("canStartTreatment", () => {
  it("refuses without consent, after completion, or for a no-show", () => {
    expect(canStartTreatment({ stage: "waiting", consent: "outstanding" }).ok).toBe(false);
    expect(canStartTreatment({ stage: "complete", consent: "signed" }).ok).toBe(false);
    expect(canStartTreatment({ stage: "no_show", consent: "signed" }).ok).toBe(false);
  });

  it("allows a consented visit from arrived, waiting, or mid-form", () => {
    for (const stage of ["arrived", "waiting", "in_treatment", "aftercare"] as const) {
      expect(canStartTreatment({ stage, consent: "signed" }).ok).toBe(true);
    }
  });
});

describe("preCheckFlags", () => {
  it("flags only the questions answered yes", () => {
    const flags = preCheckFlags({
      changes_since_last: { answer: "yes", note: "Started a new blood thinner" },
      anything_today: { answer: "no" },
      reason_to_wait: { answer: "na" },
    });
    expect(flags.map((f) => f.key)).toEqual(["changes_since_last"]);
  });
});

describe("aftercarePointsFor", () => {
  it("prefers the catalogue's own points, then appends the general safety lines", () => {
    const points = aftercarePointsFor({ catalogueAftercare: ["Ice for ten minutes."], category: "Injectables" });
    expect(points[0]).toBe("Ice for ten minutes.");
    expect(points.some((p) => /Seek urgent care/.test(p))).toBe(true);
    expect(points.some((p) => /Stay upright/.test(p))).toBe(false);
  });

  it("falls back to the category defaults when the catalogue has none", () => {
    const points = aftercarePointsFor({ catalogueAftercare: [], category: "Laser" });
    expect(points.some((p) => /Shave rather than wax/.test(p))).toBe(true);
  });

  it("still gives the general lines for an unknown category", () => {
    const points = aftercarePointsFor({ category: "Unknown" });
    expect(points.length).toBe(2);
  });
});
