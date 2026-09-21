import { useState } from "react";
import { Icon } from "../components/Icon";
import { PageHead, PlanTabs } from "../components/Shell";
import { Card, Head, Note, StatusChip } from "../components/ui";
import { pauseReasons, plan, roadmap, type Step } from "../mock/seed";

export function Timeline() {
  const [openId, setOpenId] = useState<string | null>("blood-test");
  const [pauseOpen, setPauseOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<number[]>([3]);

  const step = roadmap.flatMap((m) => m.steps).find((s) => s.id === openId) ?? null;

  return (
    <>
      <PageHead
        title={plan.name}
        subtitle={plan.strapline}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Note icon="info">This roadmap is managed by your clinic. Changes and pauses must be authorised by the clinic.</Note>
            <button
              type="button"
              className="btn"
              style={{ background: "var(--destructive-bg)", color: "var(--destructive-ink)", flex: "none" }}
              onClick={() => setPauseOpen(true)}
            >
              <Icon d="pen" size={13} /> Pause plan
            </button>
          </div>
        }
      />
      <PlanTabs />

      <div className="grid" style={{ gridTemplateColumns: step ? "1.9fr 1fr" : "1fr", alignItems: "start" }}>
        <Card>
          <Head
            icon="megaphone"
            title="Your plan roadmap"
            sub="Your personalised journey, designed by your clinic. Tap on each step to view more details."
            action={
              <div style={{ textAlign: "right" }}>
                <p className="tiny num">
                  {plan.roadmapDone} of {plan.milestonesTotal} milestones completed
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 4 }}>
                  <span className="track" style={{ width: 96 }}>
                    <span style={{ width: `${plan.roadmapPct}%` }} />
                  </span>
                  <span className="tiny num">{plan.roadmapPct}%</span>
                </div>
              </div>
            }
          />

          {roadmap.map((month) => {
            const isCollapsed = collapsed.includes(month.n);
            return (
              <div key={month.n} style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="soft-well"
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    textAlign: "left",
                    background: "var(--accent-wash)",
                  }}
                  onClick={() =>
                    setCollapsed((c) => (c.includes(month.n) ? c.filter((n) => n !== month.n) : [...c, month.n]))
                  }
                >
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 999,
                      display: "grid",
                      placeItems: "center",
                      background: "var(--success)",
                      color: "#fff",
                      fontSize: 11,
                      fontWeight: 700,
                      flex: "none",
                    }}
                  >
                    {month.n}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ fontSize: 12.5 }}>
                      <b>{month.month}</b>&nbsp;&nbsp;{month.title}
                    </span>
                    <span className="tiny" style={{ display: "block" }}>
                      {month.blurb}
                    </span>
                  </span>
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7 }}>
                    {isCollapsed && <span className="tiny num">{month.steps.length} steps</span>}
                    <Icon d={isCollapsed ? "down" : "up"} size={13} stroke="var(--ink-3)" />
                  </span>
                </button>

                {!isCollapsed && (
                  <div style={{ position: "relative", paddingLeft: 11, marginTop: 4 }}>
                    <span
                      style={{
                        position: "absolute",
                        left: 10,
                        top: 12,
                        bottom: 14,
                        width: 2,
                        background: "var(--bar)",
                      }}
                    />
                    {month.steps.map((s) => (
                      <StepRow key={s.id} step={s} active={s.id === openId} onOpen={() => setOpenId(s.id)} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </Card>

        {step && <StepDetails step={step} onClose={() => setOpenId(null)} />}
      </div>

      {pauseOpen && <PauseModal onClose={() => setPauseOpen(false)} />}
    </>
  );
}

function StepRow({ step, active, onOpen }: { step: Step; active: boolean; onOpen: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, position: "relative" }}>
      <span
        style={{
          width: 11,
          height: 11,
          borderRadius: 999,
          flex: "none",
          zIndex: 1,
          background: step.status === "progress" ? "var(--success)" : "var(--glass-hi)",
          boxShadow: step.status === "progress" ? "none" : "inset 0 0 0 2px var(--bar)",
        }}
      />
      <button
        type="button"
        onClick={onOpen}
        className="rowlink"
        style={{
          margin: "3px 0",
          background: active ? "var(--accent-soft)" : "var(--glass-2)",
          boxShadow: `inset 0 0 0 1px ${active ? "var(--accent-line)" : "var(--edge-2)"}`,
        }}
      >
        <span className="tile-icon" style={{ width: 26, height: 26, background: "var(--glass-hi)", color: "var(--accent-ink)" }}>
          <Icon d={step.icon as never} size={13} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>{step.title}</span>
          <span className="tiny">{step.date}</span>
        </span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7 }}>
          <StatusChip status={step.status} label={step.statusLabel} />
          <Icon d="right" size={13} stroke="var(--ink-3)" />
        </span>
      </button>
    </div>
  );
}

function StepDetails({ step, onClose }: { step: Step; onClose: () => void }) {
  const done = step.checklist.filter((c) => c.done).length;
  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Icon d="spark" size={15} stroke="var(--accent-ink)" />
        <h2 className="section-title">Step details</h2>
        <button type="button" onClick={onClose} className="icon-btn" style={{ marginLeft: "auto", width: 24, height: 24 }}>
          <Icon d="x" size={12} />
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <StatusChip status={step.status} label={step.statusLabel} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <span className="tile-icon" style={{ width: 26, height: 26, background: "var(--glass-2)", color: "var(--accent-ink)" }}>
          <Icon d={step.icon as never} size={14} />
        </span>
        <p style={{ fontSize: 15, fontWeight: 600 }}>{step.title}</p>
      </div>

      <div className="soft-well" style={{ padding: "8px 10px", marginTop: 9, display: "flex", alignItems: "center", gap: 8 }}>
        <Icon d="cal" size={13} stroke="var(--ink-3)" />
        <span>
          <span className="tiny" style={{ display: "block" }}>
            Due date
          </span>
          <span style={{ fontSize: 12, fontWeight: 600 }}>{step.date}</span>
        </span>
      </div>

      <p className="tiny" style={{ marginTop: 13, lineHeight: 1.55 }}>
        {step.detail}
      </p>

      <div className="soft-well" style={{ padding: "10px 11px", marginTop: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Icon d="checkCircle" size={13} stroke="var(--accent-ink)" />
          <span style={{ fontSize: 12, fontWeight: 600 }}>Your checklist</span>
          <span className="tiny num" style={{ marginLeft: "auto" }}>
            {done} of {step.checklist.length} completed
          </span>
        </div>
        <div style={{ marginTop: 7, display: "grid", gap: 2 }}>
          {step.checklist.map((c) => (
            <div
              key={c.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 8px",
                borderRadius: 9,
                background: "var(--glass-hi)",
              }}
            >
              <span className={`ck ${c.done ? "on" : ""}`} style={{ width: 14, height: 14 }}>
                <Icon d="check" size={10} width={3} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 11.5 }}>{c.label}</span>
                {c.byClinic && <span className="tiny" style={{ fontSize: 10 }}>Completed by clinic</span>}
              </span>
              <Icon
                d={c.byClinic ? "lock" : "ext"}
                size={12}
                stroke={c.byClinic ? "var(--ink-3)" : "var(--accent-ink)"}
                style={{ marginLeft: "auto" }}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="soft-well" style={{ padding: "10px 11px", marginTop: 9, background: "var(--sky-bg)" }}>
        <p style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "var(--sky-ink)" }}>
          <Icon d="msg" size={13} /> Clinician guidance
        </p>
        <p className="tiny" style={{ marginTop: 5, color: "var(--sky-ink)", lineHeight: 1.5 }}>
          {step.guidance}
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 9, padding: "9px 11px", borderRadius: 13, background: "var(--glass-2)" }}>
        <Icon d="lock" size={13} stroke="var(--ink-3)" style={{ marginTop: 1 }} />
        <p className="tiny" style={{ lineHeight: 1.45 }}>
          This step is managed by your clinic. Dates, requirements and progression cannot be edited by patients.
        </p>
      </div>
    </Card>
  );
}

function PauseModal({ onClose }: { onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const invalid = touched && !reason;

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" role="dialog" aria-label="Pause your plan" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>Pause your plan</h2>
            <p className="tiny" style={{ marginTop: 4, lineHeight: 1.5 }}>
              This will send a pause request to your clinic. Your plan will continue as scheduled until your clinic
              confirms.
            </p>
          </div>
          <button type="button" className="icon-btn" style={{ width: 26, height: 26 }} onClick={onClose} aria-label="Close">
            <Icon d="x" size={13} />
          </button>
        </div>

        <label style={{ display: "block", marginTop: 13 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>
            Reason <span style={{ color: "var(--destructive)" }}>*</span>
          </span>
          <select
            className={`field ${invalid ? "bad" : ""}`}
            style={{ marginTop: 5 }}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
          >
            <option value="">Select a reason</option>
            {pauseReasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        {invalid && (
          <p style={{ fontSize: 11, color: "var(--destructive)", marginTop: 5 }}>Please select a reason to continue.</p>
        )}

        <label style={{ display: "block", marginTop: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>
            Notes <span className="tiny">(optional)</span>
          </span>
          <textarea
            className="field"
            style={{ marginTop: 5, minHeight: 74 }}
            maxLength={500}
            placeholder="Add any additional information for your clinic..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <p className="tiny num" style={{ textAlign: "right", marginTop: 3 }}>
          {notes.length}/500
        </p>

        <div style={{ marginTop: 13 }}>
          <Note icon="info">
            Your clinic will review your request and be in touch via Messages. You'll receive a notification once it's
            been updated.
          </Note>
        </div>

        <div style={{ display: "flex", gap: 9, marginTop: 13 }}>
          <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={!reason}
            onClick={() => setTouched(true)}
            onMouseEnter={() => setTouched(true)}
          >
            Submit request
          </button>
        </div>
      </div>
    </div>
  );
}
