import { describe, expect, it } from "vitest";
import {
  dueAtForPreset,
  dueBucket,
  isTaskType,
  isTaskView,
  resolutionLabel,
  suggestedAssignee,
  taskDueLabel,
  TASK_TYPE_META,
  ROLE_VIEWS,
} from "@/lib/tasks/types";

// A Tuesday afternoon in London (BST).
const now = new Date("2026-09-29T13:00:00+01:00");
const iso = (s: string) => new Date(s).toISOString();

describe("dueBucket", () => {
  it("buckets by clinic day", () => {
    expect(dueBucket(iso("2026-09-27T18:00:00+01:00"), now)).toBe("overdue");
    expect(dueBucket(iso("2026-09-29T09:00:00+01:00"), now)).toBe("overdue");
    expect(dueBucket(iso("2026-09-29T18:00:00+01:00"), now)).toBe("today");
    expect(dueBucket(iso("2026-10-01T18:00:00+01:00"), now)).toBe("week");
    // Sunday 4 Oct still counts as this week; Monday 5 Oct is later.
    expect(dueBucket(iso("2026-10-04T18:00:00+01:00"), now)).toBe("week");
    expect(dueBucket(iso("2026-10-05T18:00:00+01:00"), now)).toBe("later");
    expect(dueBucket(null, now)).toBe("later");
    // On a Sunday nothing is "later this week".
    const sunday = new Date("2026-10-04T13:00:00+01:00");
    expect(dueBucket(iso("2026-10-05T18:00:00+01:00"), sunday)).toBe("later");
  });
});

describe("taskDueLabel", () => {
  it("says how late, counts down questions, names the weekday", () => {
    expect(taskDueLabel({ dueAt: iso("2026-09-27T18:00:00+01:00") }, now)).toBe("2 days late");
    expect(taskDueLabel({ dueAt: iso("2026-09-28T18:00:00+01:00") }, now)).toBe("1 day late");
    expect(taskDueLabel({ dueAt: iso("2026-09-29T09:00:00+01:00") }, now)).toBe("Late today");
    expect(taskDueLabel({ dueAt: iso("2026-09-29T18:00:00+01:00") }, now)).toBe("Today");
    expect(taskDueLabel({ dueAt: iso("2026-09-29T16:22:00+01:00"), type: "question" }, now)).toBe(
      "3h 22m left",
    );
    expect(taskDueLabel({ dueAt: iso("2026-09-30T18:00:00+01:00") }, now)).toBe("Tomorrow");
    expect(taskDueLabel({ dueAt: iso("2026-10-01T18:00:00+01:00") }, now)).toBe("Thu");
    expect(taskDueLabel({ dueAt: iso("2026-10-05T18:00:00+01:00") }, now)).toBe("Before 5 Oct");
    expect(taskDueLabel({ dueAt: null }, now)).toBe("No due date");
    expect(taskDueLabel({ dueAt: iso("2026-09-27T18:00:00+01:00"), escalated: true }, now)).toBe(
      "Escalated",
    );
    expect(taskDueLabel({ dueAt: null, status: "done", resolution: "will_book" }, now)).toBe(
      "Spoke, will book",
    );
  });
});

describe("suggestedAssignee", () => {
  it("routes clinical work to the practitioner, offers to the owner, chasing to the pool", () => {
    const base = { patientPractitionerId: "nadia", ownerId: "amara" };
    expect(suggestedAssignee({ type: "question", ...base })).toEqual({
      assigneeId: "nadia",
      assigneeRole: null,
    });
    expect(suggestedAssignee({ type: "plan_support", ...base }).assigneeId).toBe("nadia");
    expect(suggestedAssignee({ type: "send_offer", ...base }).assigneeId).toBe("amara");
    expect(suggestedAssignee({ type: "chase_booking", ...base })).toEqual({
      assigneeId: null,
      assigneeRole: "front_desk",
    });
    expect(suggestedAssignee({ type: "recall", ...base }).assigneeRole).toBe("front_desk");
    expect(suggestedAssignee({ type: "rebook_no_show", ...base }).assigneeRole).toBe("front_desk");
    expect(
      suggestedAssignee({ type: "question", patientPractitionerId: null, ownerId: "amara" }),
    ).toEqual({ assigneeId: null, assigneeRole: "practitioner" });
  });
});

describe("dueAtForPreset", () => {
  it("lands at 18:00 London on the chosen day, or four hours out", () => {
    expect(dueAtForPreset("4h", now)).toBe(iso("2026-09-29T17:00:00+01:00"));
    expect(dueAtForPreset("today", now)).toBe(iso("2026-09-29T18:00:00+01:00"));
    expect(dueAtForPreset("tomorrow", now)).toBe(iso("2026-09-30T18:00:00+01:00"));
    expect(dueAtForPreset("3d", now)).toBe(iso("2026-10-02T18:00:00+01:00"));
    // Across the DST change the clock time stays 18:00 local.
    const late = new Date("2026-10-24T13:00:00+01:00");
    expect(dueAtForPreset("3d", late)).toBe(iso("2026-10-27T18:00:00+00:00"));
  });
});

describe("vocabulary", () => {
  it("guards, labels and role views agree", () => {
    expect(isTaskView("pool")).toBe(true);
    expect(isTaskView("nope")).toBe(false);
    expect(isTaskType("recall")).toBe(true);
    expect(isTaskType("chase")).toBe(false);
    expect(resolutionLabel("no_answer")).toBe("No answer");
    expect(resolutionLabel("something_else")).toBe("something else");
    expect(TASK_TYPE_META.rebook_no_show.chip).toContain("noshow");
    expect(TASK_TYPE_META.chase_booking.actionLabel).toBe("Contact");
    expect(TASK_TYPE_META.recall.actionLabel).toBe("Contact");
    expect(TASK_TYPE_META.rebook_no_show.actionLabel).toBe("Contact");
    expect(ROLE_VIEWS.front_desk.map((v) => v.view)).toEqual(["queue", "pool", "retries", "done"]);
    expect(ROLE_VIEWS.practitioner[0]?.view).toBe("assigned");
    expect(ROLE_VIEWS.owner[0]?.view).toBe("mine");
  });
});
