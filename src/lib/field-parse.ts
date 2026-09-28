/**
 * Parsing for the themed time and date fields: what a person types is
 * forgiving, what the field stores is strict ("09:05", "2027-11-13").
 */

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * "9", "9:5", "0930", "9.30", "5pm", "17:30", "5:30 pm" → "HH:MM" (24-hour),
 * or null when it cannot be read as a clock time.
 */
export function normaliseClock(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  const meridiem = /(am|pm)$/.exec(raw)?.[1] ?? null;
  const digits = raw.replace(/\s*(am|pm)\s*$/, "").trim();
  let hours: number;
  let minutes = 0;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{1,2})[:.h](\d{1,2})$/.exec(digits))) {
    hours = Number(m[1]);
    minutes = Number(m[2]);
  } else if ((m = /^(\d{3,4})$/.exec(digits))) {
    const s = m[1]!.padStart(4, "0");
    hours = Number(s.slice(0, 2));
    minutes = Number(s.slice(2));
  } else if ((m = /^(\d{1,2})$/.exec(digits))) {
    hours = Number(m[1]);
  } else {
    return null;
  }
  if (meridiem === "pm" && hours < 12) hours += 12;
  if (meridiem === "am" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return `${pad(hours)}:${pad(minutes)}`;
}

/** "HH:MM" options every `stepMinutes` from `from` to `to` inclusive (default 06:00–22:00). */
export function clockOptions(stepMinutes = 15, from = "06:00", to = "22:00"): string[] {
  const start = toMinutes(from);
  const end = toMinutes(to);
  const out: string[] = [];
  for (let m = start; m <= end; m += stepMinutes)
    out.push(`${pad(Math.floor(m / 60))}:${pad(m % 60)}`);
  return out;
}

function toMinutes(clock: string): number {
  const [h, m] = clock.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function validDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= last;
}

/**
 * "13/11/2027", "13-11-2027", "13.11.27", "2027-11-13", "13 Nov 2027",
 * "13 November 2027" → "YYYY-MM-DD", or null. Two-digit years are 20xx.
 */
export function parseDayInput(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let m: RegExpExecArray | null;
  let year: number;
  let month: number;
  let day: number;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw))) {
    year = Number(m[1]);
    month = Number(m[2]);
    day = Number(m[3]);
  } else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(raw))) {
    day = Number(m[1]);
    month = Number(m[2]);
    year = Number(m[3]!.length === 2 ? `20${m[3]}` : m[3]);
  } else if ((m = /^(\d{1,2})\s+([a-z]{3,})\s+(\d{4})$/i.exec(raw))) {
    day = Number(m[1]);
    const idx = MONTHS.indexOf(m[2]!.slice(0, 3).toLowerCase());
    if (idx < 0) return null;
    month = idx + 1;
    year = Number(m[3]);
  } else {
    return null;
  }
  if (!validDay(year, month, day)) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** "2027-11-13" → "13/11/2027"; anything else comes back unchanged. */
export function formatDayInput(key: string | null | undefined): string {
  if (!key) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : key;
}

/** Local `Date` at noon for a YYYY-MM-DD key (safe from DST edge cases), or undefined. */
export function dayKeyToDate(key: string | null | undefined): Date | undefined {
  if (!key) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(key);
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
}

/** A local `Date` → YYYY-MM-DD. */
export function dateToDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
