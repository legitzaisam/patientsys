import { describe, expect, it } from "vitest";
import {
  evaluateRules,
  type OpenTaskSnapshot,
  type PatientSnapshot,
  type PlanSnapshot,
  type RuleLike,
  type RuleSnapshot,
} from "@/lib/tasks/evaluate-rules";

const now = new Date("2026-09-29T13:00:00+01:00");
const OWNER = "owner";
const NADIA = "nadia";
const TOM = "tom";

const rule = (key: string, over: Partial<RuleLike> = {}): RuleLike => ({
  id: `rule-${key}`,
  key,
  name: key,
  enabled: true,
  conditions: {},
  task_type: null,
  assign_strategy: "front_desk_pool",
  due_offset_hours: 24,
  escalate_after_hours: null,
  escalate_to_role: null,
  ...over,
});

const RULES: RuleLike[] = [
  rule("plan_step_overdue", {
    task_type: "chase_booking",
    conditions: { grace_days: 2 },
    escalate_after_hours: 48,
    escalate_to_role: "practitioner",
  }),
  rule("plan_step_due_unbooked", { task_type: "chase_booking", conditions: { within_days: 7 } }),
  rule("urgent_portal_question", {
    task_type: "question",
    assign_strategy: "patient_practitioner",
    due_offset_hours: 4,
    escalate_after_hours: 4,
    escalate_to_role: "owner",
  }),
  rule("rebook_window", {
    task_type: "recall",
    conditions: { nudge_days: 7, max_open: 2 },
    due_offset_hours: 48,
  }),
  rule("no_show", {
    task_type: "rebook_no_show",
    due_offset_hours: 8,
    escalate_after_hours: 24,
    escalate_to_role: "owner",
  }),
  rule("lapsing_regular", {
    task_type: "send_offer",
    assign_strategy: "owner",
    conditions: { lapse_days: 120 },
    due_offset_hours: 72,
  }),
  rule("progress_photos", {
    task_type: "plan_support",
    assign_strategy: "patient_practitioner",
    due_offset_hours: 72,
  }),
];

const patient = (id: string, over: Partial<PatientSnapshot> = {}): PatientSnapshot => ({
  id,
  firstName: id[0]!.toUpperCase() + id.slice(1),
  status: "active",
  practitionerId: NADIA,
  hasActivePlan: false,
  lastVisitAt: "2026-09-01T10:00:00Z",
  visitCount: 4,
  lifetimeSpend: 800,
  nextDue: null,
  upcoming: [],
  missed: [],
  hasLiveOffer: false,
  ...over,
});

const plan = (id: string, patientId: string, over: Partial<PlanSnapshot> = {}): PlanSnapshot => ({
  id,
  patientId,
  practitionerId: NADIA,
  name: "3-Month Microneedling Plan",
  done: 5,
  total: 8,
  nextMilestone: { id: `${id}-m6`, title: "Microneedling session 2", dueDate: "2026-10-02" },
  overdue: false,
  stepBookedAt: null,
  otherBookingTreatment: null,
  noShowAt: null,
  ...over,
});

function snap(over: Partial<RuleSnapshot>): RuleSnapshot {
  return {
    now,
    ownerId: OWNER,
    rules: RULES,
    plans: [],
    patients: [],
    messages: [],
    photoUploads: [],
    openTasks: [],
    ...over,
  };
}

describe("plan rules", () => {
  it("due inside the window → chase for the pool; overdue past grace → chase with escalation; booked step → nothing", () => {
    const r = evaluateRules(
      snap({
        patients: [
          patient("grace", { hasActivePlan: true }),
          patient("simon", { hasActivePlan: true }),
          patient("rosa", { hasActivePlan: true }),
        ],
        plans: [
          plan("p-grace", "grace"),
          plan("p-simon", "simon", {
            nextMilestone: { id: "m-top", title: "Top-up treatment", dueDate: "2026-07-26" },
            overdue: true,
          }),
          plan("p-rosa", "rosa", { stepBookedAt: "2026-10-05T10:00:00Z" }),
        ],
      }),
    );
    expect(r.create.map((t) => [t.dedupeKey, t.type, t.title])).toEqual([
      ["plan_step_due:p-grace-m6", "chase_booking", "Chase to book microneedling session 2"],
      ["plan_step_overdue:m-top", "chase_booking", "Chase to book top-up treatment"],
    ]);
    const overdue = r.create[1]!;
    expect(overdue.context).toBe("Skin plan step 65 days overdue");
    expect(overdue.assigneeId).toBeNull();
    expect(overdue.assigneeRole).toBe("front_desk");
    expect(overdue.priority).toBe(1);
    expect(new Date(overdue.dueAt).getTime()).toBeLessThan(now.getTime());
    expect(overdue.escalateAt).not.toBeNull();
    expect(r.create[0]!.context).toBe("Due in 3 days · not booked");
  });

  it("a step inside grace is not chased yet; a wrong booking is named", () => {
    const r = evaluateRules(
      snap({
        patients: [patient("a", { hasActivePlan: true }), patient("b", { hasActivePlan: true })],
        plans: [
          plan("p-a", "a", {
            nextMilestone: { id: "m-a", title: "Peel 2", dueDate: "2026-09-28" },
            overdue: true,
          }),
          plan("p-b", "b", {
            nextMilestone: { id: "m-b", title: "Peel 2", dueDate: "2026-09-20" },
            overdue: true,
            otherBookingTreatment: "Profhilo",
          }),
        ],
      }),
    );
    expect(r.create.map((t) => t.dedupeKey)).toEqual(["plan_step_overdue:m-b"]);
    expect(r.create[0]!.context).toContain("Profhilo booked instead");
  });

  it("a missed step becomes a rebook task and wins over overdue", () => {
    const r = evaluateRules(
      snap({
        patients: [patient("oliver", { hasActivePlan: true })],
        plans: [
          plan("p-o", "oliver", {
            nextMilestone: { id: "m-o", title: "Laser session 2", dueDate: "2026-09-24" },
            overdue: true,
            noShowAt: "2026-09-24T10:00:00+01:00",
            noShowAppointmentId: "appt-1",
          }),
        ],
      }),
    );
    expect(r.create).toHaveLength(1);
    expect(r.create[0]).toMatchObject({
      dedupeKey: "no_show:m-o",
      type: "rebook_no_show",
      title: "Rebook missed laser session 2",
      priority: 1,
    });
    expect(r.create[0]!.links).toMatchObject({ appointment_id: "appt-1" });
  });

  it("recent portal photos on a plan → review task for the practitioner, due before the next visit", () => {
    const r = evaluateRules(
      snap({
        patients: [
          patient("orla", {
            hasActivePlan: true,
            upcoming: [
              { startsAt: "2026-10-05T10:00:00+01:00", createdAt: "2026-09-20T10:00:00Z" },
            ],
          }),
        ],
        plans: [
          plan("p-orla", "orla", {
            name: "PRP Hair Plan",
            stepBookedAt: "2026-10-05T10:00:00+01:00",
          }),
        ],
        photoUploads: [{ patientId: "orla", at: "2026-09-29T11:00:00+01:00", count: 4 }],
      }),
    );
    expect(r.create).toHaveLength(1);
    expect(r.create[0]).toMatchObject({
      type: "plan_support",
      assigneeId: NADIA,
      title: "Review PRP Hair progress photos",
    });
    expect(r.create[0]!.context).toBe("4 photos uploaded in portal · next visit 5 Oct");
    expect(r.create[0]!.dueAt).toBe(new Date("2026-10-05T10:00:00+01:00").toISOString());
  });
});

describe("portal questions", () => {
  it("urgent unread message → question for the practitioner with a 4h target; replied ones are skipped", () => {
    const r = evaluateRules(
      snap({
        patients: [patient("kirsty", { practitionerId: TOM }), patient("poppy")],
        messages: [
          {
            id: "m1",
            patientId: "kirsty",
            body: "Is redness on day 3 normal?",
            createdAt: "2026-09-29T12:22:00+01:00",
            readAt: null,
            repliedAt: null,
          },
          {
            id: "m2",
            patientId: "poppy",
            body: "Thanks, see you Friday!",
            createdAt: "2026-09-29T12:00:00+01:00",
            readAt: null,
            repliedAt: null,
          },
          {
            id: "m3",
            patientId: "poppy",
            body: "Is swelling normal?",
            createdAt: "2026-09-28T12:00:00+01:00",
            readAt: "2026-09-28T13:00:00+01:00",
            repliedAt: "2026-09-28T13:00:00+01:00",
          },
        ],
      }),
    );
    expect(r.create).toHaveLength(1);
    expect(r.create[0]).toMatchObject({
      dedupeKey: "portal_question:m1",
      type: "question",
      source: "portal",
      assigneeId: TOM,
      title: "Reply: “Is redness on day 3 normal?”",
      context: "Sent via portal 38 min ago",
      priority: 1,
    });
    expect(r.create[0]!.dueAt).toBe(new Date("2026-09-29T16:22:00+01:00").toISOString());
  });
});

describe("regulars", () => {
  it("rebook window open ≥ 7 days and nothing booked → recall, capped; lapsed regulars → offer for the owner", () => {
    const patients = [
      patient("jonas", { nextDue: { name: "Profhilo", dueDate: "2026-09-13" } }),
      patient("bruno", { nextDue: { name: "Vitamin Injection", dueDate: "2026-09-27" } }), // only 2 days open
      patient("cara", {
        nextDue: { name: "LED Light Therapy", dueDate: "2026-06-26" },
        lastVisitAt: "2026-05-27T10:00:00Z",
        lifetimeSpend: 1240,
      }),
      patient("dee", { nextDue: { name: "Peel", dueDate: "2026-09-10" } }),
      patient("eve", { nextDue: { name: "Peel", dueDate: "2026-09-05" } }),
      patient("booked", {
        nextDue: { name: "Peel", dueDate: "2026-09-01" },
        upcoming: [{ startsAt: "2026-10-01T10:00:00Z", createdAt: "2026-09-20T10:00:00Z" }],
      }),
    ];
    const r = evaluateRules(snap({ patients }));
    const recalls = r.create.filter((t) => t.type === "recall");
    // max_open 2: the two most recently opened windows are created, every window stays valid.
    expect(recalls.map((t) => t.patientId)).toEqual(["jonas", "dee"]);
    expect(recalls[0]).toMatchObject({
      title: "Profhilo recall",
      context: "Window opened 16 days ago · auto reminder unanswered",
      assigneeRole: "front_desk",
    });
    expect(r.valid.has("rebook_window:eve:2026-09-05")).toBe(true);
    const offers = r.create.filter((t) => t.type === "send_offer");
    expect(offers).toHaveLength(1);
    expect(offers[0]).toMatchObject({
      patientId: "cara",
      assigneeId: OWNER,
      title: "Approve win-back offer for Cara",
      context: "125 days since last visit · £1,240 lifetime spend",
      priority: 3,
    });
    expect(r.create.some((t) => t.patientId === "booked")).toBe(false);
  });

  it("a missed booking for a regular without a plan → rebook", () => {
    const r = evaluateRules(
      snap({
        patients: [
          patient("mia", {
            missed: [
              {
                appointmentId: "ap-9",
                startsAt: "2026-09-24T10:00:00+01:00",
                treatmentName: "Laser Hair Removal",
              },
            ],
          }),
        ],
      }),
    );
    expect(r.create[0]).toMatchObject({
      dedupeKey: "no_show_appt:ap-9",
      type: "rebook_no_show",
      title: "Rebook missed laser Hair Removal",
    });
  });
});

describe("closing and escalating", () => {
  const open = (over: Partial<OpenTaskSnapshot>): OpenTaskSnapshot => ({
    id: "t",
    type: "chase_booking",
    patientId: "grace",
    source: "rule",
    dedupeKey: null,
    ruleId: "rule-plan_step_due_unbooked",
    autoClose: true,
    createdAt: "2026-09-25T10:00:00Z",
    escalateAt: null,
    escalatedAt: null,
    links: {},
    ...over,
  });

  it("closes rule tasks whose reason is gone with the right resolution, keeps valid ones, never touches auto_close=false", () => {
    const r = evaluateRules(
      snap({
        patients: [
          patient("grace", {
            hasActivePlan: true,
            upcoming: [{ startsAt: "2026-10-02T10:00:00Z", createdAt: "2026-09-28T10:00:00Z" }],
          }),
          patient("kirsty"),
          patient("still", { hasActivePlan: true }),
        ],
        plans: [
          plan("p-grace", "grace", { stepBookedAt: "2026-10-02T10:00:00Z" }),
          plan("p-still", "still"),
        ],
        messages: [
          {
            id: "m1",
            patientId: "kirsty",
            body: "Is redness normal?",
            createdAt: "2026-09-29T09:00:00+01:00",
            readAt: "2026-09-29T09:30:00+01:00",
            repliedAt: "2026-09-29T09:30:00+01:00",
          },
        ],
        openTasks: [
          open({ id: "t-grace", dedupeKey: "plan_step_due:p-grace-m6" }),
          open({
            id: "t-q",
            type: "question",
            patientId: "kirsty",
            dedupeKey: "portal_question:m1",
            ruleId: "rule-urgent_portal_question",
            links: { message_id: "m1" },
          }),
          open({ id: "t-still", patientId: "still", dedupeKey: "plan_step_due:p-still-m6" }),
          open({
            id: "t-manual",
            source: "manual",
            patientId: "grace",
            dedupeKey: null,
            ruleId: null,
          }),
          open({
            id: "t-keep",
            source: "manual",
            patientId: "grace",
            dedupeKey: null,
            ruleId: null,
            autoClose: false,
          }),
        ],
      }),
    );
    expect(r.close).toEqual([
      { taskId: "t-grace", resolution: "auto_booked" },
      { taskId: "t-q", resolution: "auto_replied" },
      { taskId: "t-manual", resolution: "auto_booked" },
    ]);
    // The still-valid one is neither closed nor recreated.
    expect(r.create.some((t) => t.dedupeKey === "plan_step_due:p-still-m6")).toBe(false);
  });

  it("escalates past escalate_at to the rule's role, once", () => {
    const r = evaluateRules(
      snap({
        patients: [patient("simon", { hasActivePlan: true, practitionerId: TOM })],
        plans: [
          plan("p-simon", "simon", {
            practitionerId: TOM,
            nextMilestone: { id: "m-top", title: "Top-up", dueDate: "2026-07-26" },
            overdue: true,
          }),
        ],
        openTasks: [
          open({
            id: "t-esc",
            dedupeKey: "plan_step_overdue:m-top",
            ruleId: "rule-plan_step_overdue",
            patientId: "simon",
            escalateAt: "2026-09-28T10:00:00Z",
          }),
          open({
            id: "t-done",
            dedupeKey: "plan_step_overdue:m-top-x",
            ruleId: "rule-plan_step_overdue",
            patientId: "simon",
            escalateAt: "2026-09-28T10:00:00Z",
            escalatedAt: "2026-09-28T10:05:00Z",
          }),
        ],
      }),
    );
    expect(r.escalate).toEqual([{ taskId: "t-esc", toId: TOM, toRole: "practitioner" }]);
  });
});
