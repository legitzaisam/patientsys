import { describe, expect, it } from "vitest";
import {
  onMyPlate,
  TASK_ATTENTION_KIND,
  taskAttentionItems,
  taskAttentionUrgency,
  type PatientLite,
  type TaskRow,
  type TaskViewer,
} from "@/lib/tasks/service";

// A Tuesday afternoon in London (BST).
const now = new Date("2026-09-29T13:00:00+01:00");
const iso = (s: string) => new Date(s).toISOString();

const owner: TaskViewer = { userId: "owner", roles: ["owner"], isManager: true, isOwner: true };
const manager: TaskViewer = { userId: "maya", roles: ["manager"], isManager: true };
const nadia: TaskViewer = { userId: "nadia", roles: ["practitioner"], isManager: false };
const sofia: TaskViewer = { userId: "sofia", roles: ["front_desk"], isManager: false };

function task(over: Partial<TaskRow> & { id: string }): TaskRow {
  return {
    clinic_id: "c1",
    patient_id: "p1",
    type: "chase_booking",
    title: "Chase to book",
    context: null,
    source: "manual",
    source_label: null,
    rule_id: null,
    dedupe_key: null,
    assignee_id: null,
    assignee_role: null,
    created_by: "owner",
    note: null,
    priority: 2,
    due_at: iso("2026-09-30T18:00:00+01:00"),
    escalate_at: null,
    escalated_at: null,
    escalated_to: null,
    attempts: 0,
    next_retry_at: null,
    snoozed_until: null,
    status: "open",
    resolution: null,
    resolved_by: null,
    resolved_at: null,
    auto_close: true,
    links: {},
    created_at: iso("2026-09-27T09:00:00+01:00"),
    updated_at: iso("2026-09-27T09:00:00+01:00"),
    ...over,
  };
}

const patients: Record<string, PatientLite> = {
  p1: {
    id: "p1",
    first_name: "Tilly",
    last_name: "Rowntree",
    practitionerId: "nadia",
    patientType: "new",
  },
  p2: {
    id: "p2",
    first_name: "Aisha",
    last_name: "Bello",
    practitionerId: "owner",
    patientType: "regular",
  },
};
const lite = (id: string) => patients[id] ?? null;

describe("taskAttentionUrgency", () => {
  it("late or due within three clinic days is Urgent; within ten is This week; later stays off the dashboard", () => {
    expect(taskAttentionUrgency(iso("2026-09-27T18:00:00+01:00"), now)).toBe("urgent");
    expect(taskAttentionUrgency(iso("2026-09-29T09:00:00+01:00"), now)).toBe("urgent");
    expect(taskAttentionUrgency(iso("2026-10-02T18:00:00+01:00"), now)).toBe("urgent");
    expect(taskAttentionUrgency(iso("2026-10-03T18:00:00+01:00"), now)).toBe("this_week");
    expect(taskAttentionUrgency(iso("2026-10-09T18:00:00+01:00"), now)).toBe("this_week");
    expect(taskAttentionUrgency(iso("2026-10-10T18:00:00+01:00"), now)).toBeNull();
    // No due date: nothing to count down, so it waits under This week.
    expect(taskAttentionUrgency(null, now)).toBe("this_week");
  });
});

describe("onMyPlate", () => {
  it("is what I hold, plus the truly unassigned for owner and managers and the pool for the front desk", () => {
    const mine = task({ id: "t1", assignee_id: "nadia" });
    const nobodys = task({ id: "t2" });
    const pool = task({ id: "t3", assignee_role: "front_desk" });
    const practitioners = task({ id: "t4", assignee_role: "practitioner" });

    expect(onMyPlate(mine, nadia)).toBe(true);
    expect(onMyPlate(mine, owner)).toBe(false);
    expect(onMyPlate(mine, manager)).toBe(false);

    expect(onMyPlate(nobodys, owner)).toBe(true);
    expect(onMyPlate(nobodys, manager)).toBe(true);
    expect(onMyPlate(nobodys, nadia)).toBe(false);
    expect(onMyPlate(nobodys, sofia)).toBe(false);

    expect(onMyPlate(pool, sofia)).toBe(true);
    expect(onMyPlate(pool, owner)).toBe(false);
    expect(onMyPlate(practitioners, nadia)).toBe(false);
    expect(onMyPlate(practitioners, owner)).toBe(false);
  });
});

describe("taskAttentionItems", () => {
  it("one row per task, under the accordion for its type, with the Tasks deep link", () => {
    const rows = [
      task({
        id: "t1",
        type: "send_offer",
        title: "Send voucher",
        patient_id: "p2",
        assignee_id: "owner",
      }),
      task({
        id: "t2",
        type: "chase_booking",
        title: "Chase to book",
        due_at: iso("2026-09-29T18:00:00+01:00"),
      }),
      task({ id: "t3", type: "recall", title: "Recall", assignee_role: "front_desk" }),
      task({ id: "t4", type: "question", title: "Is redness normal?", assignee_id: "nadia" }),
      task({
        id: "t5",
        type: "custom",
        title: "Order more gloves",
        assignee_id: "owner",
        due_at: iso("2026-10-07T18:00:00+01:00"),
      }),
      task({
        id: "t6",
        type: "plan_support",
        title: "Check in",
        assignee_id: "owner",
        due_at: iso("2026-10-20T18:00:00+01:00"),
      }),
      task({
        id: "t7",
        type: "rebook_no_show",
        title: "Rebook",
        assignee_id: "owner",
        status: "done",
      }),
    ];
    const items = taskAttentionItems(rows, owner, lite, now);
    expect(items.map((i) => i.taskId)).toEqual(["t1", "t2", "t5"]);

    const voucher = items[0]!;
    expect(voucher).toMatchObject({
      id: "task-t1",
      kind: "send_offer",
      urgency: "urgent",
      title: "Aisha Bello — Send voucher",
      subtitle: "Send voucher · Tomorrow",
      patientId: "p2",
      completable: true,
      href: "/tasks?task=t1",
    });
    // The unclaimed chase opens the Unassigned view, where it actually lives.
    expect(items[1]).toMatchObject({
      kind: "chase_booking",
      href: "/tasks?task=t2&view=unassigned",
    });
    // A custom task keeps the plain Tasks accordion; This week when due in eight days.
    expect(items[2]).toMatchObject({ kind: "tasks", urgency: "this_week" });
  });

  it("the front desk gets its pool, cannot close a pool task from the dashboard, and never sees questions", () => {
    const rows = [
      task({ id: "t3", type: "recall", title: "Recall", assignee_role: "front_desk" }),
      task({
        id: "t4",
        type: "question",
        title: "Is redness normal?",
        assignee_role: "front_desk",
      }),
      task({ id: "t5", type: "chase_booking", title: "Chase", assignee_id: "sofia" }),
    ];
    const items = taskAttentionItems(rows, sofia, lite, now);
    expect(items.map((i) => [i.taskId, i.completable, i.href])).toEqual([
      ["t3", false, "/tasks?task=t3&view=pool"],
      ["t5", true, "/tasks?task=t5"],
    ]);
  });

  it("a practitioner sees only what she holds", () => {
    const rows = [
      task({ id: "t1", assignee_id: "nadia", type: "question", title: "Gym OK?" }),
      task({ id: "t2", assignee_id: "owner" }),
      task({ id: "t3" }),
    ];
    const items = taskAttentionItems(rows, nadia, lite, now);
    expect(items.map((i) => i.taskId)).toEqual(["t1"]);
    expect(items[0]!.kind).toBe(TASK_ATTENTION_KIND.question);
  });
});
