import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { Chip, Modal, Ring } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import { CaHead } from "./Shell";

const TABS = ["Overview", "Journey", "Treatments", "Before & After", "Documents", "Messages"] as const;

type RoadItem = [status: "don" | "not" | "cur" | "", label: string, date: string, chip: string, tone: string];

const ROADMAP: Array<{ m: string; t: string; pts: string[]; items: RoadItem[] }> = [
  {
    m: "Month 1",
    t: "Foundation",
    pts: ["done", "done", "done"],
    items: [
      ["don", "Consultation", "12 Sep 2025", "Completed", "mint"],
      ["don", "Skin prep & baseline photos", "12 Sep 2025", "Completed", "mint"],
      ["don", "Microneedling Session 1", "15 Sep 2025", "Completed", "mint"],
      ["don", "Wait 3 days", "18 Sep 2025", "Completed", "mint"],
      ["don", "Start skincare routine", "18 Sep 2025", "Completed", "mint"],
    ],
  },
  {
    m: "Month 2",
    t: "Build & Support",
    pts: ["cur", "", ""],
    items: [
      ["don", "B12 test & review result", "25 Sep 2025", "Completed", "mint"],
      ["not", "Start B12 supplement (if deficient)", "25 Sep 2025", "Not required", "line"],
      ["cur", "Stop actives (5 days)", "15 Oct 2025", "Current", "mint"],
      ["", "Microneedling Session 2", "20 Oct 2025", "Upcoming", "line"],
      ["", "Continue skincare routine", "20 Oct 2025", "Upcoming", "line"],
    ],
  },
  {
    m: "Month 3",
    t: "Results & Confidence",
    pts: ["", "", ""],
    items: [
      ["", "Microneedling Session 3", "10 Nov 2025", "Upcoming", "line"],
      ["", "Final comparison", "17 Nov 2025", "Upcoming", "line"],
      ["", "Maintenance plan", "17 Nov 2025", "Upcoming", "line"],
      ["", "Celebrate progress ✨", "", "Upcoming", "line"],
    ],
  },
];

const CLIN_ACTIONS = [
  ["Review B12 blood test result", true],
  ["Confirm stop-actives advice given", true],
  ["Upload progress photos (Month 2)", false],
  ["Send appointment reminder for 20 Oct", false],
  ["Mark stage as reviewed", false],
] as const;

export function AdvancedPatient() {
  const toast = useToast();
  const nav = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Journey");
  const [actions, setActions] = useState(CLIN_ACTIONS.map(([label, done]) => ({ label, done })));
  const [addNote, setAddNote] = useState(false);
  const [notes, setNotes] = useState<string[]>([
    "Grace is responding well to treatment. Skin tone brighter and texture improved. No adverse reactions. Continue as planned.",
  ]);

  return (
    <>
      <div style={{ color: "var(--mut)", fontSize: 11 }}>
        <button type="button" style={{ color: "var(--mut)" }} onClick={() => nav("/clinic/advanced/patients")}>
          Patients
        </button>{" "}
        › <span style={{ color: "var(--ink)" }}>Grace Adeyemi</span>
      </div>
      <div className="ca-headrow" style={{ marginTop: 4 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="ca-avatar" style={{ width: 46, height: 46, fontSize: 14 }}>
            GA
          </span>
          <div>
            <h1 style={{ fontSize: 28, display: "inline" }}>Grace Adeyemi</h1>{" "}
            <Chip tone="mint" style={{ verticalAlign: 5, marginLeft: 4 }}>
              ● Active patient
            </Chip>
            <div className="sub">
              Patient ID PA-10483 &nbsp;|&nbsp; 12 Mar 1992 (33 years) &nbsp;|&nbsp; <b style={{ fontWeight: 600 }}>Clinician</b> Dr Amara Osei
            </div>
          </div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: 10, color: "var(--mut)" }}>Journey Plan</div>
          <div className="serif" style={{ fontSize: 20, fontWeight: 600 }}>3-Month Microneedling Plan</div>
          <div style={{ fontSize: 10.5, color: "var(--slate)" }}>Smoother texture. Brighter tone. A stronger, healthier you.</div>
        </div>
        <div className="ca-script caveat" style={{ marginLeft: 22 }}>
          Healthier
          <br />
          Skin Brighter
          <br />
          Tomorrows
        </div>
      </div>

      <div className="ca-stats" style={{ marginTop: 9 }}>
        <button type="button" className="ca-stat" onClick={() => { setTab("Journey"); toast("Build & Support — month 2 of 3"); }}>
          <span className="ic">
            <Icon d="layers" size={17} />
          </span>
          <span>
            <small>Current phase</small>
            <span className="v" style={{ fontSize: 14.5 }}>Build &amp; Support</span>
            <small>Month 2 of 3</small>
          </span>
        </button>
        <button type="button" className="ca-stat" onClick={() => { setTab("Journey"); toast("Plan completion: 5 of 12 milestones (43%)"); }}>
          <Ring pct={43} size={46} strokeWidth={5.5} color="#359497" ink="#16323a" fontSize={10.5} />
          <span>
            <small>Plan completion</small>
            <span className="v" style={{ fontSize: 14.5 }}>5 of 12 milestones</span>
          </span>
        </button>
        <button type="button" className="ca-stat" onClick={() => toast("Next visit: Microneedling Session 2 — 20 Oct 2025")}>
          <span className="ic">
            <Icon d="cal" size={17} />
          </span>
          <span>
            <small>Next visit</small>
            <span className="v" style={{ fontSize: 14.5 }}>20 Oct 2025</span>
            <small>Microneedling Session 2</small>
          </span>
        </button>
        <button type="button" className="ca-stat" onClick={() => toast("B12 result received 18 Oct — normal level")}>
          <span className="ic">
            <Icon d="drop" size={17} />
          </span>
          <span>
            <small>Blood test status</small>
            <span className="v" style={{ fontSize: 14.5, color: "#2e8a63" }}>✓ Result received</span>
            <small>Normal B12 level</small>
          </span>
        </button>
      </div>

      <div className="ca-tabs">
        {TABS.map((t) => (
          <button key={t} type="button" className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Journey" ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 286px", gap: 12, marginTop: 10, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="ca-panel">
              <h3>
                ✂ Plan Roadmap
                <span style={{ color: "var(--mut)", fontWeight: 500, fontSize: 10.5 }}>&nbsp;3 months · 12 milestones</span>
                <span className="see" onClick={() => nav("/patient/vivara")}>
                  View patient plan ⧉
                </span>
              </h3>
              <div className="ca-jrney" style={{ marginTop: 10 }}>
                {ROADMAP.map((m) => (
                  <div key={m.m} className="ca-jm">
                    <small>{m.m}</small>
                    <b>{m.t}</b>
                    <div className="ca-track">
                      {m.pts.map((p, i) => (
                        <span key={i} className={`pt ${p}`} style={{ left: `${i * 44}%` }}>
                          {p === "done" && <Icon d="check" size={10} stroke="#fff" />}
                          {p === "cur" && <i />}
                        </span>
                      ))}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
                      {m.items.map(([st, label, date, chip, tone]) => (
                        <button
                          key={label}
                          type="button"
                          style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 10.8, color: "#4b5a62", padding: "2.5px 0", textAlign: "left", cursor: "pointer" }}
                          onClick={() => toast(`${label} — ${chip}${date ? ` (${date})` : ""}`)}
                        >
                          <span
                            style={{
                              width: 13,
                              height: 13,
                              borderRadius: "50%",
                              flex: "none",
                              position: "relative",
                              ...(st === "don"
                                ? { background: "#359497" }
                                : st === "cur"
                                  ? { border: "2px solid #359497", background: "#e2f2ef" }
                                  : { border: "1.4px solid #ccd4d7" }),
                            }}
                          >
                            {st === "don" && (
                              <span style={{ position: "absolute", inset: 0, color: "#fff", fontSize: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>
                            )}
                          </span>
                          <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
                          <span style={{ color: "var(--mut)", fontSize: 9.5, whiteSpace: "nowrap" }}>{date}</span>
                          <Chip tone={tone} style={{ minWidth: 64, justifyContent: "center", fontSize: 8.8 }}>
                            {chip}
                          </Chip>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.15fr", gap: 10 }}>
              <div className="ca-panel" style={{ padding: "10px 12px" }}>
                <h3 style={{ fontSize: 12 }}>
                  Treatment history
                  <span className="see" style={{ fontSize: 9.5 }} onClick={() => setTab("Treatments")}>
                    View all
                  </span>
                </h3>
                {(
                  [
                    ["15 Sep 2025", "Microneedling Session 1", "Completed"],
                    ["12 Sep 2025", "Consultation", "Completed"],
                    ["—", "B12 blood test", "✓ Result received"],
                  ] as const
                ).map(([d, t, chip]) => (
                  <button key={t} type="button" className="ca-up" onClick={() => toast(`${t} — detail is mocked`)}>
                    <span className="tm" style={{ width: 62 }}>{d}</span>
                    <b style={{ fontSize: 11 }}>{t}</b>
                    <Chip tone="mint" style={{ marginLeft: "auto" }}>
                      {chip}
                    </Chip>
                  </button>
                ))}
              </div>
              <div className="ca-panel" style={{ padding: "10px 12px" }}>
                <h3 style={{ fontSize: 12 }}>
                  Upcoming appointments
                  <span className="see" style={{ fontSize: 9.5 }} onClick={() => nav("/clinic/advanced/diary")}>
                    See all
                  </span>
                </h3>
                {(
                  [
                    ["20 Oct 2025", "10:00", "Microneedling Session 2"],
                    ["10 Nov 2025", "10:00", "Microneedling Session 3"],
                  ] as const
                ).map(([d, tm, t]) => (
                  <button key={d} type="button" className="ca-up" onClick={() => nav("/clinic/advanced/diary")}>
                    <Icon d="cal" size={13} stroke="#6b7880" style={{ flex: "none" }} />
                    <span>
                      <b style={{ fontSize: 11 }}>{d}</b>
                      <small>{tm}</small>
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 10.5, color: "#4b5a62" }}>{t}</span>
                  </button>
                ))}
              </div>
              <div className="ca-panel" style={{ padding: "10px 12px" }}>
                <h3 style={{ fontSize: 12 }}>
                  Recent photos
                  <span className="see" style={{ fontSize: 9.5 }} onClick={() => setTab("Before & After")}>
                    View all
                  </span>
                </h3>
                <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
                  <div style={{ flex: 1 }}>
                    <img src="/assets/skin-before-2.png" alt="" style={{ width: "100%", height: 56, objectFit: "cover", borderRadius: 7 }} />
                    <div style={{ fontSize: 9, color: "var(--mut)", marginTop: 2, textAlign: "center" }}>Baseline · 12 Sep 2025</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <img src="/assets/skin-progress-2.png" alt="" style={{ width: "100%", height: 56, objectFit: "cover", borderRadius: 7 }} />
                    <div style={{ fontSize: 9, color: "var(--mut)", marginTop: 2, textAlign: "center" }}>After Session 1 · 15 Sep 2025</div>
                  </div>
                  <button
                    type="button"
                    style={{ flex: 0.6, border: "1.4px dashed #ccd4d7", borderRadius: 7, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#9aa5ab", fontSize: 13, minHeight: 56, cursor: "pointer" }}
                    onClick={() => toast("Photo upload is mocked")}
                  >
                    ＋<span style={{ fontSize: 8 }}>Add photos</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="ca-panel ca-clin-check">
              <h3 style={{ fontSize: 12.5 }}>
                ⚙ Clinician Action Panel
                <span className="see" style={{ fontSize: 9.5 }} onClick={() => toast("Full task list is mocked")}>
                  View all tasks
                </span>
              </h3>
              {actions.map((a, i) => (
                <label key={a.label} className={a.done ? "" : ""}>
                  <button
                    type="button"
                    className={`ckbox ${a.done ? "on" : ""}`}
                    style={{ width: 15, height: 15, borderRadius: 4 }}
                    role="checkbox"
                    aria-checked={a.done}
                    onClick={() => setActions(actions.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
                  />
                  <span style={a.done ? { color: "#9aa5ab", textDecoration: "line-through" } : undefined}>{a.label}</span>
                  <span className="chev">›</span>
                </label>
              ))}
            </div>
            <div className="ca-panel" style={{ background: "#fffdf6", borderColor: "#efe5c8" }}>
              <h3 style={{ fontSize: 12.5 }}>
                ☀ Today's focus<span className="see" style={{ color: "var(--mut)", fontSize: 9.5 }}>15 Oct 2025</span>
              </h3>
              <p style={{ fontSize: 11.3, lineHeight: 1.5, color: "#4b5a62", marginTop: 6 }}>
                Grace is stopping active skincare products today ahead of her next microneedling session.
                <br />
                <br />
                Check in on adherence and any skin concerns.
              </p>
            </div>
            <div className="ca-panel">
              <h3 style={{ fontSize: 12.5 }}>
                Clinician notes
                <span className="see" style={{ fontSize: 9.5 }} onClick={() => setAddNote(true)}>
                  Add note
                </span>
              </h3>
              {notes.map((n, i) => (
                <div key={i} style={{ background: "#f4f6f6", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#4b5a62", lineHeight: 1.5, marginTop: 7 }}>
                  {n}
                </div>
              ))}
              <div style={{ color: "var(--mut)", fontSize: 9.5, marginTop: 6 }}>Dr Amara Osei &nbsp;·&nbsp; 15 Oct 2025, 09:12</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="ca-panel" style={{ marginTop: 10 }}>
          <h3>{tab}</h3>
          {tab === "Before & After" ? (
            <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
              {(
                [
                  ["/assets/skin-before-2.png", "Baseline · 12 Sep"],
                  ["/assets/skin-progress-2.png", "After Session 1 · 15 Sep"],
                  ["/assets/skin-after-2.png", "Projected result"],
                ] as const
              ).map(([src, lb]) => (
                <div key={lb} style={{ width: 170 }}>
                  <img src={src} alt={lb} style={{ width: "100%", height: 128, objectFit: "cover", borderRadius: 10 }} />
                  <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 4, textAlign: "center" }}>{lb}</div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "var(--mut)", fontSize: 12, padding: "10px 0" }}>
              {tab === "Overview" && "Plan summary — the Journey tab holds the full roadmap and clinician actions."}
              {tab === "Treatments" && "Two treatments recorded plus the B12 blood test. The full history table lives in the pastel record."}
              {tab === "Documents" && "Consent forms and lab reports would be listed here (mocked)."}
              {tab === "Messages" && "Message Grace from the pastel patient record's message panel."}
            </div>
          )}
        </div>
      )}

      <Modal open={addNote} onClose={() => setAddNote(false)} title="Add clinician note">
        <label className="field">
          <span>Note</span>
          <textarea rows={4} id="ca-new-note" placeholder="Clinical observations…" />
        </label>
        <button
          type="button"
          className="btn deep"
          style={{ background: "#08646b", borderColor: "#08646b" }}
          onClick={() => {
            const el = document.getElementById("ca-new-note") as HTMLTextAreaElement;
            if (el.value.trim()) setNotes([el.value.trim(), ...notes]);
            setAddNote(false);
            toast("Note added");
          }}
        >
          Save note
        </button>
      </Modal>
    </>
  );
}
