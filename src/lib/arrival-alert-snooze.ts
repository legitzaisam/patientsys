/** Cross-page snooze for arrival alerts (Clock control). Survives route changes. */

export type ArrivalAlertPhase = "due" | "arrival" | "late" | "overdue";

const STORAGE_KEY = "aetheria:arrival-alert-snoozes";
export const ARRIVAL_ALERT_SNOOZE_MS = 5 * 60 * 1000;

type SnoozeEntry = { until: number; phase: ArrivalAlertPhase };
type SnoozeMap = Record<string, SnoozeEntry>;

function readRaw(): SnoozeMap {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SnoozeMap;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeRaw(map: SnoozeMap) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* private mode / quota */
  }
}

/** Drop expired entries and return the active map. */
export function loadArrivalAlertSnoozes(now = Date.now()): SnoozeMap {
  const raw = readRaw();
  const next: SnoozeMap = {};
  let changed = false;
  for (const [id, entry] of Object.entries(raw)) {
    if (!entry || typeof entry.until !== "number") {
      changed = true;
      continue;
    }
    if (entry.until <= now) {
      changed = true;
      continue;
    }
    next[id] = entry;
  }
  if (changed) writeRaw(next);
  return next;
}

/** Snooze this appointment’s current phase for 5 minutes (all pages). */
export function snoozeArrivalAlert(id: string, phase: ArrivalAlertPhase, now = Date.now()) {
  const map = loadArrivalAlertSnoozes(now);
  map[id] = { until: now + ARRIVAL_ALERT_SNOOZE_MS, phase };
  writeRaw(map);
}

/**
 * True while the alert is snoozed for this phase.
 * Escalating to a later phase (e.g. late → overdue) shows it again.
 */
export function isArrivalAlertSnoozed(
  id: string,
  phase: ArrivalAlertPhase,
  now = Date.now(),
  map = loadArrivalAlertSnoozes(now),
): boolean {
  const entry = map[id];
  if (!entry || entry.until <= now) return false;
  return entry.phase === phase;
}
