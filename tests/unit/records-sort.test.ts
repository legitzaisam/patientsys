import { describe, expect, it } from "vitest";
import { defaultDirFor, sortRecords, type RecordsSort } from "@/lib/patients/records-sort";
import type { PatientRow } from "@/components/patients/records-types";

const now = new Date("2026-10-01T12:00:00+01:00");

function row(over: Partial<PatientRow> & { id: string; first_name: string; last_name: string }): PatientRow {
  return {
    lastTreatment: null,
    nextDue: null,
    nextAppointment: null,
    outstandingDocuments: 0,
    practitioners: [],
    practitionerIds: [],
    openTasks: [],
    dueState: "ok",
    summary: null,
    ...over,
  };
}

describe("sortRecords", () => {
  it("defaults: name A–Z, last oldest first, next soonest first, tasks most first", () => {
    expect(defaultDirFor("patient")).toBe("asc");
    expect(defaultDirFor("last")).toBe("asc");
    expect(defaultDirFor("next")).toBe("asc");
    expect(defaultDirFor("tasks")).toBe("desc");
  });

  it("sorts Patient by surname, then given name", () => {
    const rows = [
      row({ id: "b", first_name: "Cara", last_name: "Ashcombe" }),
      row({ id: "a", first_name: "Beatrice", last_name: "Ashcombe" }),
      row({ id: "c", first_name: "Grace", last_name: "Adeyemi" }),
    ];
    expect(sortRecords(rows, "patient", "asc", now).map((p) => p.id)).toEqual(["c", "a", "b"]);
    expect(sortRecords(rows, "patient", "desc", now).map((p) => p.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts Last treatment oldest → newest", () => {
    const rows = [
      row({
        id: "new",
        first_name: "A",
        last_name: "New",
        lastTreatment: { name: "Peel", performed_at: "2026-09-20T10:00:00+01:00" },
      }),
      row({
        id: "old",
        first_name: "A",
        last_name: "Old",
        lastTreatment: { name: "Peel", performed_at: "2026-01-02T10:00:00+00:00" },
      }),
      row({ id: "none", first_name: "A", last_name: "None" }),
    ];
    expect(sortRecords(rows, "last", "asc", now).map((p) => p.id)).toEqual(["none", "old", "new"]);
  });

  it("sorts Next treatment overdue and soonest first", () => {
    const rows = [
      row({
        id: "later",
        first_name: "L",
        last_name: "Later",
        nextDue: { name: "Filler", next_due_at: "2027-08-01T00:00:00Z" },
      }),
      row({
        id: "over",
        first_name: "O",
        last_name: "Over",
        nextDue: { name: "Profhilo", next_due_at: "2026-09-15T00:00:00Z" },
      }),
      row({
        id: "booked",
        first_name: "B",
        last_name: "Booked",
        nextAppointment: { treatment_name: "Peel", starts_at: "2026-10-05T10:00:00+01:00" },
      }),
    ];
    expect(sortRecords(rows, "next", "asc", now).map((p) => p.id)).toEqual(["over", "booked", "later"]);
  });

  it("falls back to the name when two rows have nothing planned", () => {
    const rows = [
      row({ id: "z", first_name: "Ada", last_name: "Zephyr" }),
      row({ id: "a", first_name: "Ada", last_name: "Appleby" }),
    ];
    expect(sortRecords(rows, "next", "asc", now).map((p) => p.id)).toEqual(["a", "z"]);
  });

  it("sorts Tasks by open count, most first on the default dir", () => {
    const rows = [
      row({
        id: "one",
        first_name: "A",
        last_name: "One",
        summary: { openTasks: [{ type: "recall" }] } as PatientRow["summary"],
      }),
      row({
        id: "two",
        first_name: "A",
        last_name: "Two",
        summary: {
          openTasks: [{ type: "recall" }, { type: "chase_booking" }],
        } as PatientRow["summary"],
      }),
      row({ id: "zero", first_name: "A", last_name: "Zero" }),
    ];
    expect(sortRecords(rows, "tasks", "desc", now).map((p) => p.id)).toEqual(["two", "one", "zero"]);
  });
});

describe("records sort vocabulary", () => {
  it("names every column", () => {
    const cols: RecordsSort[] = ["patient", "last", "next", "tasks"];
    expect(cols.map(defaultDirFor)).toEqual(["asc", "asc", "asc", "desc"]);
  });
});
