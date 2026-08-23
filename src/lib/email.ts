/**
 * Shared email checks: shape, TLD, and common domain misspellings
 * (e.g. gmail.con → gmail.com) so invites and patient records don't go to a dead inbox.
 *
 * UI policy: never show “Did you mean…?” / validity errors while the user is typing.
 * Surface them only after blur or when they try to submit (see `useEmailField`).
 */

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Popular consumer/work domains we watch for near-miss typos. */
const COMMON_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "live.co.uk",
  "msn.com",
  "yahoo.com",
  "yahoo.co.uk",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "btinternet.com",
  "sky.com",
  "virginmedia.com",
  "ntlworld.com",
  "blueyonder.co.uk",
  "talktalk.net",
  "gmx.com",
  "gmx.co.uk",
  "mail.com",
  "zoho.com",
  "yandex.com",
] as const;

/** Known bad spellings → correct domain. */
const DOMAIN_TYPOS: Record<string, string> = {
  "gmail.con": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.om": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gnail.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "googlemail.con": "googlemail.com",
  "hotmial.com": "hotmail.com",
  "hotmal.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.cm": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "outlok.com": "outlook.com",
  "outllok.com": "outlook.com",
  "outlook.con": "outlook.com",
  "outlook.cm": "outlook.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "yahoo.cm": "yahoo.com",
  "icloud.con": "icloud.com",
  "icloud.cm": "icloud.com",
  "icoud.com": "icloud.com",
  "protonmail.con": "protonmail.com",
  "btinternet.con": "btinternet.com",
  "live.con": "live.com",
  "msn.con": "msn.com",
};

/** TLDs that are almost always typos (e.g. .con for .com). */
const BAD_TLDS = new Set(["con", "cmo", "ocm", "comm", "coom", "cim"]);

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    let prev = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cur = a[i] === b[j] ? row[j]! : Math.min(row[j]!, row[j + 1]!, prev) + 1;
      row[j] = prev;
      prev = cur;
    }
    row[b.length] = prev;
  }
  return row[b.length]!;
}

function suggestDomain(domain: string): string | null {
  if ((COMMON_DOMAINS as readonly string[]).includes(domain)) return null;
  const exact = DOMAIN_TYPOS[domain];
  if (exact) return exact;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const known of COMMON_DOMAINS) {
    // Ignore near-matches that are just a shorter/longer sibling (gmail ↔ mail).
    if (Math.abs(domain.length - known.length) > 2) continue;
    const dist = levenshtein(domain, known);
    // One edit only — two edits false-positive too often on short domains.
    if (dist > 0 && dist <= 1 && dist < bestDist) {
      best = known;
      bestDist = dist;
    }
  }
  return best;
}

export type EmailCheck =
  | { ok: true; email: string }
  | { ok: false; error: string; suggestion?: string };

/** Normalise and validate an email; flag likely domain typos. */
export function checkEmail(raw: string, label = "email address"): EmailCheck {
  const email = raw.trim().toLowerCase();
  if (!email) return { ok: false, error: `Enter a valid ${label}` };
  if (!EMAIL_SHAPE.test(email)) return { ok: false, error: `Enter a valid ${label}` };

  const at = email.lastIndexOf("@");
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (!local || local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return { ok: false, error: `Enter a valid ${label}` };
  }
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".") || domain.includes("..")) {
    return { ok: false, error: `Enter a valid ${label}` };
  }

  const labels = domain.split(".");
  const tld = labels[labels.length - 1]!;
  if (tld.length < 2 || !/^[a-z0-9]+$/.test(tld)) {
    return { ok: false, error: `Enter a valid ${label}` };
  }

  const suggestion = suggestDomain(domain);
  if (suggestion) {
    return {
      ok: false,
      error: `Did you mean ${local}@${suggestion}?`,
      suggestion: `${local}@${suggestion}`,
    };
  }

  if (BAD_TLDS.has(tld)) {
    return {
      ok: false,
      error: `Check the email domain — “.${tld}” doesn’t look right`,
    };
  }

  return { ok: true, email };
}

/** Throw if invalid (server handlers). Empty string is invalid unless `optional`. */
export function assertEmail(raw: string, label = "email address", optional = false): string | null {
  const trimmed = raw.trim();
  if (optional && !trimmed) return null;
  const result = checkEmail(trimmed, label);
  if (!result.ok) throw new Error(result.error);
  return result.email;
}

/** True when the value is empty or a fully valid email (for optional fields). */
export function isEmailOk(raw: string, optional = false): boolean {
  if (optional && !raw.trim()) return true;
  return checkEmail(raw).ok;
}
