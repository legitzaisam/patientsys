/**
 * Shared phone-digit checks so a number has the length its country code expects.
 *
 * UK: the local number is 11 digits (07700 900000 / 020 7946 0812). +44 is not
 * counted in those 11. After +44 we also accept 10 digits, because the leading
 * 0 is dropped in the international form.
 *
 * Other countries use the national length for that calling code.
 *
 * UI policy: never show digit-count errors while the user is typing. Surface
 * them after blur or submit (same as email).
 */

type Country = { name: string; min: number; max: number };

function country(name: string, min: number, max = min): Country {
  return { name, min, max };
}

/** Calling code → local-number length, without the country code or a trunk 0. */
const COUNTRIES: Record<string, Country> = {
  "1": country("US / Canadian", 10),
  "7": country("Russian or Kazakh", 10),
  "20": country("Egyptian", 10),
  "27": country("South African", 9),
  "30": country("Greek", 10),
  "31": country("Dutch", 9),
  "32": country("Belgian", 8, 9),
  "33": country("French", 9),
  "34": country("Spanish", 9),
  "36": country("Hungarian", 8, 9),
  "39": country("Italian", 6, 12),
  "40": country("Romanian", 9),
  "41": country("Swiss", 9),
  "43": country("Austrian", 4, 13),
  "44": country("UK", 10, 11),
  "45": country("Danish", 8),
  "46": country("Swedish", 7, 9),
  "47": country("Norwegian", 8),
  "48": country("Polish", 9),
  "49": country("German", 6, 13),
  "51": country("Peruvian", 8, 9),
  "52": country("Mexican", 10),
  "53": country("Cuban", 8),
  "54": country("Argentine", 10),
  "55": country("Brazilian", 10, 11),
  "56": country("Chilean", 9),
  "57": country("Colombian", 10),
  "58": country("Venezuelan", 10),
  "60": country("Malaysian", 9, 10),
  "61": country("Australian", 9),
  "62": country("Indonesian", 9, 11),
  "63": country("Philippine", 10),
  "64": country("New Zealand", 8, 10),
  "65": country("Singapore", 8),
  "66": country("Thai", 9),
  "81": country("Japanese", 10),
  "82": country("South Korean", 9, 10),
  "84": country("Vietnamese", 9),
  "86": country("Chinese", 11),
  "90": country("Turkish", 10),
  "91": country("Indian", 10),
  "92": country("Pakistani", 10),
  "93": country("Afghan", 9),
  "94": country("Sri Lankan", 9),
  "95": country("Myanmar", 8, 10),
  "98": country("Iranian", 10),
  "211": country("South Sudanese", 9),
  "212": country("Moroccan", 9),
  "213": country("Algerian", 9),
  "216": country("Tunisian", 8),
  "218": country("Libyan", 9),
  "220": country("Gambian", 7),
  "221": country("Senegalese", 9),
  "222": country("Mauritanian", 8),
  "223": country("Malian", 8),
  "224": country("Guinean", 9),
  "225": country("Ivorian", 10),
  "226": country("Burkinabe", 8),
  "227": country("Nigerien", 8),
  "228": country("Togolese", 8),
  "229": country("Beninese", 8),
  "230": country("Mauritian", 8),
  "231": country("Liberian", 7, 9),
  "232": country("Sierra Leonean", 8),
  "233": country("Ghanaian", 9),
  "234": country("Nigerian", 10),
  "235": country("Chadian", 8),
  "236": country("Central African", 8),
  "237": country("Cameroonian", 9),
  "238": country("Cape Verdean", 7),
  "239": country("Sao Tomean", 7),
  "240": country("Equatorial Guinean", 9),
  "241": country("Gabonese", 7, 8),
  "242": country("Congolese", 9),
  "243": country("Congolese", 9),
  "244": country("Angolan", 9),
  "245": country("Guinea-Bissau", 7),
  "248": country("Seychellois", 7),
  "249": country("Sudanese", 9),
  "250": country("Rwandan", 9),
  "251": country("Ethiopian", 9),
  "252": country("Somali", 7, 9),
  "253": country("Djiboutian", 8),
  "254": country("Kenyan", 9),
  "255": country("Tanzanian", 9),
  "256": country("Ugandan", 9),
  "257": country("Burundian", 8),
  "258": country("Mozambican", 9),
  "260": country("Zambian", 9),
  "261": country("Malagasy", 9),
  "262": country("Reunion", 9),
  "263": country("Zimbabwean", 9),
  "264": country("Namibian", 9),
  "265": country("Malawian", 9),
  "266": country("Basotho", 8),
  "267": country("Botswanan", 8),
  "268": country("Eswatini", 8),
  "269": country("Comorian", 7),
  "297": country("Aruban", 7),
  "298": country("Faroese", 6),
  "299": country("Greenlandic", 6),
  "350": country("Gibraltar", 8),
  "351": country("Portuguese", 9),
  "352": country("Luxembourg", 9),
  "353": country("Irish", 7, 9),
  "354": country("Icelandic", 7),
  "355": country("Albanian", 9),
  "356": country("Maltese", 8),
  "357": country("Cypriot", 8),
  "358": country("Finnish", 6, 10),
  "359": country("Bulgarian", 8, 9),
  "370": country("Lithuanian", 8),
  "371": country("Latvian", 8),
  "372": country("Estonian", 7, 8),
  "373": country("Moldovan", 8),
  "374": country("Armenian", 8),
  "375": country("Belarusian", 9),
  "376": country("Andorran", 6),
  "377": country("Monaco", 8, 9),
  "378": country("Sammarinese", 6, 10),
  "380": country("Ukrainian", 9),
  "381": country("Serbian", 8, 9),
  "382": country("Montenegrin", 8),
  "383": country("Kosovan", 8),
  "385": country("Croatian", 8, 9),
  "386": country("Slovenian", 8),
  "387": country("Bosnian", 8),
  "389": country("Macedonian", 8),
  "420": country("Czech", 9),
  "421": country("Slovak", 9),
  "423": country("Liechtenstein", 7),
  "501": country("Belizean", 7),
  "502": country("Guatemalan", 8),
  "503": country("Salvadoran", 8),
  "504": country("Honduran", 8),
  "505": country("Nicaraguan", 8),
  "506": country("Costa Rican", 8),
  "507": country("Panamanian", 8),
  "509": country("Haitian", 8),
  "590": country("Guadeloupe", 9),
  "591": country("Bolivian", 8),
  "592": country("Guyanese", 7),
  "593": country("Ecuadorian", 9),
  "594": country("French Guianese", 9),
  "595": country("Paraguayan", 9),
  "596": country("Martinican", 9),
  "597": country("Surinamese", 7),
  "598": country("Uruguayan", 8),
  "670": country("Timorese", 7, 8),
  "673": country("Brunei", 7),
  "675": country("Papua New Guinean", 8),
  "676": country("Tongan", 5, 7),
  "677": country("Solomon Islands", 7),
  "678": country("Vanuatuan", 7),
  "679": country("Fijian", 7),
  "682": country("Cook Islands", 5),
  "685": country("Samoan", 5, 7),
  "686": country("I-Kiribati", 8),
  "687": country("New Caledonian", 6),
  "689": country("French Polynesian", 8),
  "852": country("Hong Kong", 8),
  "853": country("Macanese", 8),
  "855": country("Cambodian", 8, 9),
  "856": country("Lao", 8, 10),
  "880": country("Bangladeshi", 10),
  "886": country("Taiwanese", 9),
  "960": country("Maldivian", 7),
  "961": country("Lebanese", 7, 8),
  "962": country("Jordanian", 8, 9),
  "963": country("Syrian", 8, 9),
  "964": country("Iraqi", 10),
  "965": country("Kuwaiti", 8),
  "966": country("Saudi", 9),
  "967": country("Yemeni", 9),
  "968": country("Omani", 8),
  "970": country("Palestinian", 9),
  "971": country("UAE", 9),
  "972": country("Israeli", 8, 9),
  "973": country("Bahraini", 8),
  "974": country("Qatari", 8),
  "975": country("Bhutanese", 8),
  "976": country("Mongolian", 8),
  "977": country("Nepalese", 10),
  "992": country("Tajik", 9),
  "993": country("Turkmen", 8),
  "994": country("Azerbaijani", 9),
  "995": country("Georgian", 9),
  "996": country("Kyrgyz", 9),
  "998": country("Uzbek", 9),
};

const CALLING_CODES = Object.keys(COUNTRIES).sort((a, b) => b.length - a.length);

export type PhoneCheck = { ok: true; phone: string } | { ok: false; error: string };

function digitsOf(raw: string): string {
  return raw.replace(/\D/g, "");
}

function matchCountry(digits: string): { code: string; country: Country; national: string } | null {
  for (const code of CALLING_CODES) {
    if (digits.startsWith(code)) {
      return { code, country: COUNTRIES[code]!, national: digits.slice(code.length) };
    }
  }
  return null;
}

function countPhrase(n: number): string {
  return `${n} digit${n === 1 ? "" : "s"}`;
}

function lengthPhrase(min: number, max: number): string {
  return min === max ? countPhrase(min) : `${min} to ${max} digits`;
}

function hasLength(national: string, min: number, max: number): boolean {
  if (national.length >= min && national.length <= max) return true;
  // Trunk 0 after the country code (e.g. +33 06 12 34 56 78).
  if (national.startsWith("0")) {
    const rest = national.slice(1);
    return rest.length >= min && rest.length <= max;
  }
  return false;
}

function ukError(count: number, afterPlus44: boolean): string {
  if (afterPlus44) {
    return `UK numbers need 11 digits after +44 — this one has ${count}`;
  }
  return `UK numbers need 11 digits — this one has ${count}`;
}

function checkUkNational(national: string, afterPlus44: boolean): PhoneCheck {
  if (afterPlus44) {
    // 11 digits as entered (often still including the leading 0), or 10 after
    // the 0 is dropped for +44.
    if (national.length === 11 || (national.length === 10 && !national.startsWith("0"))) {
      return { ok: true, phone: "" };
    }
    return { ok: false, error: ukError(national.length, true) };
  }
  if (national.length === 11) return { ok: true, phone: "" };
  return { ok: false, error: ukError(national.length, false) };
}

function checkMatched(
  match: { code: string; country: Country; national: string },
  afterCountryCode: boolean,
): PhoneCheck {
  if (!match.national) {
    return { ok: false, error: `Enter the rest of the ${match.country.name} number after +${match.code}` };
  }
  if (match.code === "44") return checkUkNational(match.national, afterCountryCode);

  const { name, min, max } = match.country;
  if (hasLength(match.national, min, max)) return { ok: true, phone: "" };

  const shown = match.national.startsWith("0") ? match.national.length - 1 : match.national.length;
  return {
    ok: false,
    error: `${name} numbers need ${lengthPhrase(min, max)} after +${match.code} — this one has ${shown}`,
  };
}

/** Normalise and validate a phone number against its country digit count. */
export function checkPhone(raw: string, label = "phone number"): PhoneCheck {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: `Enter a valid ${label}` };
  if (/[A-Za-z]/.test(trimmed)) return { ok: false, error: `Enter a valid ${label}` };

  const digits = digitsOf(trimmed);
  if (!digits) return { ok: false, error: `Enter a valid ${label}` };

  const international = trimmed.startsWith("+") || trimmed.startsWith("00");
  const intlDigits = trimmed.startsWith("00") ? digits.replace(/^00/, "") : digits;

  if (international) {
    const match = matchCountry(intlDigits);
    if (!match) {
      return { ok: false, error: "Check the country code, then enter the right number of digits" };
    }
    const result = checkMatched(match, true);
    return result.ok ? { ok: true, phone: trimmed } : result;
  }

  // National UK (clinic default): 11 digits, usually starting with 0.
  if (digits.startsWith("0")) {
    const result = checkUkNational(digits, false);
    return result.ok ? { ok: true, phone: trimmed } : result;
  }

  // International written without + / 00, e.g. 447700900118 or 61418765432.
  // Only accept this when the digits already match that country — a 10-digit
  // UK mobile missing its leading 0 must not be read as a Russian +7 number.
  const match = matchCountry(digits);
  if (match && match.national.length > 0) {
    const result = checkMatched(match, true);
    if (result.ok) return { ok: true, phone: trimmed };
  }

  const result = checkUkNational(digits, false);
  return result.ok ? { ok: true, phone: trimmed } : result;
}

/** Throw if invalid (server handlers). Empty string is invalid unless `optional`. */
export function assertPhone(raw: string, label = "phone number", optional = false): string | null {
  const trimmed = raw.trim();
  if (optional && !trimmed) return null;
  const result = checkPhone(trimmed, label);
  if (!result.ok) throw new Error(result.error);
  return result.phone;
}

/** True when the value is empty or a fully valid number (for optional fields). */
export function isPhoneOk(raw: string, optional = false): boolean {
  if (optional && !raw.trim()) return true;
  return checkPhone(raw).ok;
}
