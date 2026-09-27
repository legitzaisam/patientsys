import { describe, expect, it } from "vitest";
import { checkPhone, isPhoneOk } from "@/lib/phone";
import { SavePatient, UpdateClinicDetails, UpdatePortalProfile } from "@/lib/validation/schemas";

describe("checkPhone", () => {
  it("accepts UK numbers as 11 local digits, not counting +44", () => {
    expect(checkPhone("07700 900118").ok).toBe(true);
    expect(checkPhone("020 7946 0812").ok).toBe(true);
    expect(checkPhone("+44 07700 900118").ok).toBe(true);
    expect(checkPhone("0044 07700 900118").ok).toBe(true);
  });

  it("accepts the international UK form that drops the leading 0", () => {
    expect(checkPhone("+44 7700 900118").ok).toBe(true);
    expect(checkPhone("447700900118").ok).toBe(true);
  });

  it("rejects a UK number with the wrong number of digits", () => {
    const short = checkPhone("07700 90011");
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.error).toContain("11 digits");
    if (!short.ok) expect(short.error).toContain("10");

    const afterCode = checkPhone("+44 7700 90011");
    expect(afterCode.ok).toBe(false);
    if (!afterCode.ok) expect(afterCode.error).toContain("after +44");
  });

  it("does not treat a 10-digit UK mobile missing its 0 as a Russian number", () => {
    const result = checkPhone("7700900118");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/UK numbers need 11 digits/);
  });

  it("checks other country codes against their own lengths", () => {
    expect(checkPhone("+1 202 555 1234").ok).toBe(true);
    expect(checkPhone("+61 418 765 432").ok).toBe(true);
    expect(checkPhone("+33 6 12 34 56 78").ok).toBe(true);
    expect(checkPhone("+33 06 12 34 56 78").ok).toBe(true);

    const usShort = checkPhone("+1 202 555 123");
    expect(usShort.ok).toBe(false);
    if (!usShort.ok) expect(usShort.error).toContain("10 digits after +1");

    const auLong = checkPhone("+61 418 765 4321");
    expect(auLong.ok).toBe(false);
    if (!auLong.ok) expect(auLong.error).toContain("after +61");
  });

  it("rejects letters and an unknown country code", () => {
    expect(checkPhone("07abc 900118").ok).toBe(false);
    expect(checkPhone("+999 1234567").ok).toBe(false);
  });
});

describe("optional phone fields", () => {
  it("allows a blank optional number", () => {
    expect(isPhoneOk("", true)).toBe(true);
    expect(SavePatient.pick({ phone: true }).safeParse({ phone: "" }).success).toBe(true);
    expect(UpdateClinicDetails.pick({ phone: true }).safeParse({ phone: "" }).success).toBe(true);
    expect(
      UpdatePortalProfile.pick({ emergency_contact_phone: true }).safeParse({
        emergency_contact_phone: "",
      }).success,
    ).toBe(true);
  });

  it("rejects a short number on save schemas", () => {
    expect(SavePatient.pick({ phone: true }).safeParse({ phone: "07700" }).success).toBe(false);
    expect(
      UpdatePortalProfile.pick({ emergency_contact_phone: true }).safeParse({
        emergency_contact_phone: "+61 418",
      }).success,
    ).toBe(false);
  });
});
