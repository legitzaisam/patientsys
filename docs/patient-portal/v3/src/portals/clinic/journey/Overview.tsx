import { useNavigate } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { Chip, Modal } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import { useLoad } from "../../../hooks";
import { api } from "../../../mock/api";
import { useState } from "react";

const APPTS = [
  { time: "09:00 – 09:45", st: ["mint", "Ready"], img: "/assets/avatar-priya.png", name: "Priya Chandrasekhar", sess: "Session 2 of 3", tx: "Chemical Peel", dr: "Dr Nadia Rahman", chips: [["mint", "Consent done"], ["slate", "Actives stopped"]] },
  { time: "10:15 – 11:00", st: ["pink", "Blood test pending"], img: "/assets/avatar-grace.png", name: "Grace Adeyemi", sess: "Session 3 of 6", tx: "Microneedling with PRP", dr: "Dr Tom Whitfield", chips: [["mint", "Consent done"], ["pink", "Blood test pending"]] },
  { time: "11:00 – 11:45", st: ["mint", "Ready"], img: "/assets/avatar-leila.png", name: "Leila Farouk", sess: "Session 1 of 3", tx: "Lip Filler", dr: "Dr Amara Osei", chips: [["mint", "Consent done"], ["cream", "Aftercare due"]] },
  { time: "14:00 – 14:45", st: ["mint", "Ready"], img: "/assets/avatar-theo.png", name: "Theo Nakamura", sess: "Session 2 of 4", tx: "Anti-Wrinkle Injections", dr: "Dr Nadia Rahman", chips: [["mint", "Consent done"], ["slate", "Actives stopped"]] },
];

const QUEUE = {
  urgent: [
    ["GA", "#fde4ec", "#c25a7d", "Grace Adeyemi", "Blood test results missing", "Today"],
    ["LF", "#e5effd", "#4a6fa5", "Leila Farouk", "Consent form outstanding", "Today"],
    ["RP", "#fde4ec", "#c25a7d", "Rebecca Lindqvist", "Adverse reaction follow-up", "Today"],
    ["HB", "#fdf4e4", "#9a7420", "Hugo Berrington", "Review photos overdue", "1 day"],
  ],
  today: [
    ["ON", "Olivia Bennett", "Start skincare routine"],
    ["ZM", "Zara Haddad", "Stop active ingredients before Session 2"],
    ["FC", "Freya Sundqvist", "Aftercare follow-up due"],
    ["TN", "Theo Nakamura", "Send pre-treatment advice"],
  ],
  week: [
    ["NP", "Nadia Petrova", "Book next session", "Mon 16 Sep"],
    ["EC", "Eleanor Whitmore", "Check in · 4 week review", "Tue 17 Sep"],
    ["DM", "Daniel Kowalski", "Review results photos", "Wed 18 Sep"],
    ["AC", "Amelia Fitzgerald", "Update treatment plan", "Thu 19 Sep"],
  ],
};

const SNAP = [
  { title: "Foundation", n: "132 patients", sub: "Assess, plan and prepare", icon: "layers", rows: [["/assets/avatar-leila.png", "Maya Patel", 33, "1 of 3"], ["/assets/avatar-theo.png", "James O'Connor", 33, "1 of 3"], ["/assets/avatar-alex.png", "Sophie Chen", 66, "2 of 3"]] },
  { title: "Build & Support", n: "201 patients", sub: "Continue treatment and monitor progress", icon: "layers", rows: [["/assets/avatar-grace.png", "Grace Adeyemi", 50, "3 of 6"], ["/assets/avatar-theo.png", "Theo Nakamura", 50, "2 of 4"], ["/assets/avatar-priya.png", "Nadia Petrova", 50, "2 of 4"]] },
  { title: "Results & Confidence", n: "124 patients", sub: "Complete your treatment and maintain results", icon: "check", rows: [["/assets/avatar-leila.png", "Leila Farouk", 100, "3 of 3"], ["/assets/avatar-theo.png", "Daniel Kowalski", 100, "3 of 3"], ["/assets/avatar-emma.png", "Eleanor Whitmore", 100, "3 of 3"]] },
] as const;

export function JourneyOverview() {
  const toast = useToast();
  const nav = useNavigate();
  const { data: notes } = useLoad(() => api.getNotes());
  const [newAppt, setNewAppt] = useState(false);

  const openPatient = () => nav("/clinic/journey/patients/grace-adeyemi");

  return (
    <>
      <div className="cj-h1row">
        <div>
          <h1>Clinic overview</h1>
          <div className="sub">A journey-led view of today's treatments, patient progress and next actions.</div>
        </div>
        <div className="cj-right">
          <button type="button" className="cj-pill" onClick={() => toast("Date picker is mocked — showing Fri 13 Sep 2024")}>
            <Icon d="cal" size={14} />
            Fri 13 Sep 2024&nbsp;&nbsp;‹&nbsp;›
          </button>
          <button type="button" className="cj-cta" onClick={() => setNewAppt(true)}>
            ＋ New appointment
          </button>
        </div>
      </div>

      <div className="cj-stats">
        <button type="button" className="cj-stat" onClick={() => nav("/clinic/journey/board")}>
          <span className="ic" style={{ background: "var(--mint)", color: "var(--mintink)" }}>
            <Icon d="layers" size={18} />
          </span>
          <span>
            <small>Active skin plans</small>
            <span className="v">
              457<span className="cj-uch up">↗ 12%</span>
            </span>
            <span className="foot">Patients on a treatment journey</span>
          </span>
        </button>
        <button type="button" className="cj-stat" onClick={() => toast("18 milestones today: 6 treatments, 12 tasks & follow-ups")}>
          <span className="ic" style={{ background: "var(--blue)", color: "var(--blueink)" }}>
            <Icon d="cal" size={18} />
          </span>
          <span>
            <small>Milestones due today</small>
            <span className="v">
              18<span className="cj-uch blue">6 treatments</span>
            </span>
            <span className="foot">12 tasks &amp; follow-ups</span>
          </span>
        </button>
        <button type="button" className="cj-stat" onClick={() => nav("/clinic/journey/retention")}>
          <span className="ic" style={{ background: "var(--cream)", color: "var(--creamink)" }}>
            <Icon d="users" size={18} />
          </span>
          <span>
            <small>Patients needing support</small>
            <span className="v">
              22<span className="cj-uch dn">↑ 4</span>
            </span>
            <span className="foot">Require clinic attention</span>
          </span>
        </button>
        <button type="button" className="cj-stat" onClick={() => toast("Revenue detail lives in the pastel direction — Performance")}>
          <span className="ic" style={{ background: "var(--mint)", color: "var(--mintink)" }}>
            <Icon d="chart" size={18} />
          </span>
          <span>
            <small>Revenue this month</small>
            <span className="v">
              £31,925<span className="cj-uch up">↗ 14%</span>
            </span>
            <span className="foot">123 treatments delivered</span>
          </span>
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 252px", gap: 11, marginTop: 11, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div className="cj-panel">
            <h3>
              Today's journey appointments
              <span className="see" onClick={() => nav("/clinic/journey/diary")}>
                View full diary →
              </span>
            </h3>
            <div className="psub">A focused view of today's patients and their treatment journey.</div>
            <div className="cj-appts">
              {APPTS.map((a) => (
                <button key={a.name} type="button" className="cj-appt" onClick={openPatient}>
                  <span className="t">
                    {a.time}
                    <span className="st">
                      <Chip tone={a.st[0]}>{a.st[1]}</Chip>
                    </span>
                  </span>
                  <span className="who">
                    <img src={a.img} alt="" />
                    <span>
                      <b>{a.name}</b>
                      <small>
                        {a.sess}
                        <br />
                        {a.tx}
                      </small>
                    </span>
                  </span>
                  <span className="dr">⚕ {a.dr}</span>
                  <span className="row">
                    {a.chips.map(([tone, label]) => (
                      <Chip key={label} tone={tone}>
                        {label}
                      </Chip>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="cj-panel">
            <h3>
              Journey support queue
              <span className="see" onClick={() => toast("Full task board is mocked — 18 open items")}>
                View all tasks →
              </span>
            </h3>
            <div className="psub">Patients that need attention to keep their journey on track.</div>
            <div className="cj-queue">
              <div className="cj-qcol">
                <div className="qh" style={{ background: "var(--pink)", color: "#b0446f" }}>
                  ⚠ Urgent<span className="n">4</span>
                </div>
                {QUEUE.urgent.map(([ini, bg, fg, name, sub, when]) => (
                  <button key={name} type="button" className="cj-qrow" onClick={openPatient}>
                    <span className="cj-ava" style={{ background: bg, color: fg }}>
                      {ini}
                    </span>
                    <span>
                      <b>{name}</b>
                      <small>{sub}</small>
                    </span>
                    <span className="d">{when}</span>
                  </button>
                ))}
              </div>
              <div className="cj-qcol">
                <div className="qh" style={{ background: "var(--cream)", color: "#9a7420" }}>
                  ◔ Today<span className="n">6</span>
                </div>
                {QUEUE.today.map(([ini, name, sub]) => (
                  <button key={name} type="button" className="cj-qrow" onClick={openPatient}>
                    <span className="cj-ava" style={{ background: "#eef0f4", color: "#66708a" }}>
                      {ini}
                    </span>
                    <span>
                      <b>{name}</b>
                      <small>{sub}</small>
                    </span>
                    <span className="d">Today</span>
                  </button>
                ))}
              </div>
              <div className="cj-qcol">
                <div className="qh" style={{ background: "var(--blue)", color: "#4a6fa5" }}>
                  ▤ This week<span className="n">8</span>
                </div>
                {QUEUE.week.map(([ini, name, sub, when]) => (
                  <button key={name} type="button" className="cj-qrow" onClick={openPatient}>
                    <span className="cj-ava" style={{ background: "#eef0f4", color: "#66708a" }}>
                      {ini}
                    </span>
                    <span>
                      <b>{name}</b>
                      <small>{sub}</small>
                    </span>
                    <span className="d">{when}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="cj-panel">
            <h3>
              Journey board snapshot
              <span className="see" onClick={() => nav("/clinic/journey/board")}>
                View journey board →
              </span>
            </h3>
            <div className="psub">A live view of your patients across the treatment journey.</div>
            <div className="cj-snap">
              {SNAP.map((col) => (
                <div key={col.title} className="cj-scol">
                  <div className="sh">
                    <span className="ic">
                      <Icon d={col.icon} size={13} />
                    </span>
                    {col.title}
                    <span className="n">{col.n}</span>
                  </div>
                  <div className="sub2">{col.sub}</div>
                  {col.rows.map(([img, name, pct, frac]) => (
                    <button key={name as string} type="button" className="cj-srow" onClick={openPatient}>
                      <img src={img as string} alt="" />
                      {name}
                      <span className="bar">
                        <i style={{ width: `${pct}%` }} />
                      </span>
                      <span className="frac">{frac} ›</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="cj-panel cj-notes">
          <h3>
            <Icon d="task" size={15} stroke="#5b6a8f" />
            Clinic notes<span style={{ marginLeft: "auto", color: "#aab3c6" }}>⋯</span>
          </h3>
          <div className="psub">Team reminders and key focus areas.</div>
          <ul style={{ marginTop: 8, padding: 0 }}>
            {notes?.clinicNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      </div>

      <Modal
        open={newAppt}
        onClose={() => setNewAppt(false)}
        title="New appointment"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setNewAppt(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="cj-cta"
              onClick={() => {
                setNewAppt(false);
                toast("Appointment created in the mock diary — open the pastel diary to see it");
              }}
            >
              Create appointment
            </button>
          </>
        }
      >
        <label className="field">
          <span>Patient</span>
          <input placeholder="Search patients…" defaultValue="Grace Adeyemi" />
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label className="field">
            <span>Treatment</span>
            <select defaultValue="Microneedling with PRP">
              <option>Microneedling with PRP</option>
              <option>Chemical Peel</option>
              <option>Lip Filler</option>
            </select>
          </label>
          <label className="field">
            <span>Time</span>
            <select defaultValue="15:00">
              {["09:00", "11:00", "13:00", "15:00", "16:30"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
      </Modal>
    </>
  );
}
