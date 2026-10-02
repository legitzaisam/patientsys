import { displayName } from "@/lib/format";
import { nextTreatmentState } from "@/lib/patients/records-summary";
import type { PatientRow } from "@/components/patients/records-types";

export const RECORDS_SORTS = ["patient", "last", "next", "tasks"] as const;
export type RecordsSort = (typeof RECORDS_SORTS)[number];
export type RecordsSortDir = "asc" | "desc";

export function isRecordsSort(value: unknown): value is RecordsSort {
  return typeof value === "string" && (RECORDS_SORTS as readonly string[]).includes(value);
}

export function isRecordsSortDir(value: unknown): value is RecordsSortDir {
  return value === "asc" || value === "desc";
}

/** First click on a column: the useful direction for that data. */
export function defaultDirFor(sort: RecordsSort): RecordsSortDir {
  return sort === "tasks" ? "desc" : "asc";
}

function nameKey(p: PatientRow) {
  return displayName(p, { surnameFirst: true }).toLocaleLowerCase("en-GB");
}

function lastKey(p: PatientRow) {
  const at = p.lastTreatment?.performed_at;
  const t = at ? Date.parse(at) : Number.NaN;
  return Number.isFinite(t) ? t : 0;
}

/** Soonest / most overdue first when sorted ascending. Nothing planned last. */
function nextKey(p: PatientRow, now: Date) {
  const state = nextTreatmentState(
    {
      nextAppointment: p.nextAppointment,
      nextDue: p.nextDue,
      planStep: p.summary?.planStep ?? null,
    },
    now,
  );
  if (state.kind === "none") return Number.POSITIVE_INFINITY;
  const raw = state.kind === "booked" ? state.at : state.dueDate;
  const t = Date.parse(raw.length === 10 ? `${raw}T12:00:00` : raw);
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
}

function tasksKey(p: PatientRow) {
  return p.summary?.openTasks?.length ?? p.openTasks?.length ?? 0;
}

/** One collator for every comparison: `localeCompare` builds one per call. */
const collator = new Intl.Collator("en-GB");

/** Subtraction would give NaN for two rows with nothing planned (∞ − ∞). */
function cmpNumber(a: number, b: number) {
  return a === b ? 0 : a < b ? -1 : 1;
}

export function sortRecords(
  rows: readonly PatientRow[],
  sort: RecordsSort,
  dir: RecordsSortDir,
  now: Date,
): PatientRow[] {
  const sign = dir === "desc" ? -1 : 1;
  // Keys are worked out once per row rather than once per comparison: a list
  // this size makes thousands of comparisons, and nextKey formats dates.
  const keyed = rows.map((row) => ({
    row,
    name: nameKey(row),
    value:
      sort === "last"
        ? lastKey(row)
        : sort === "next"
          ? nextKey(row, now)
          : sort === "tasks"
            ? tasksKey(row)
            : 0,
  }));
  keyed.sort((a, b) => {
    const key =
      sort === "patient" ? collator.compare(a.name, b.name) : cmpNumber(a.value, b.value);
    return key === 0 ? collator.compare(a.name, b.name) : key * sign;
  });
  return keyed.map((k) => k.row);
}
