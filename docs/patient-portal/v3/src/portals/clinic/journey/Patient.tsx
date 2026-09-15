import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { Check, Chip, Modal, Ring } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import { useLoad } from "../../../hooks";
import { api } from "../../../mock/api";

const TABS = ["Overview", "Skin Journey", "Treatments", "Before & After", "Documents", "Messages"] as const;

export function JourneyPatient() {
  const toast = useToast();
  const nav = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Skin Journey");
  const { data: steps, setData: setSteps } = useLoad(() => api.getPlan());
  const { data: actions, setData: setActions } = useLoad(() => api.getClinActions());
  const { data: focus, setData: setFocus } = useLoad(() => api.getFocus());
  const { data: notesData } = useLoad(() => api.getNotes());
  const [editNote, setEditNote] = useState(false);
  const [noteText, setNoteText] = useState<string | null>(null);
  const [upload, setUpload] = useState(false);

  const doneCount = steps?.filter((s) => s.status === "done").length ?? 6;
  const pct = Math.round((doneCount / (steps?.length ?? 14)) * 100);
  const planNote = noteText ?? notesData?.planNote ?? "";

  const monthMeta = [
    { label: "Month 1", title: "Foundation", desc: "Assess, plan and prepare your skin for the best results." },
    { label: "Month 2", title: "Build & Support", desc: "Continue treatment, support skin health and monitor progress." },
    { label: "Month 3", title: "Results & Confidence", desc: "Complete your treatment plan and review your results." },
  ];
  const monthDone = (m: number) => steps?.filter((s) => s.month === m && s.status === "done").length ?? 0;
  const monthTotal = (m: number) => steps?.filter((s) => s.month === m).length ?? 1;

  return (
    <>
      <button type="button" className="cp-bc" style={{ color: "#2c8f8a" }} onClick={() => nav("/clinic/journey/patients")}>
        ← All patients
      </button>
      <div className="cj-rechead" style={{ marginTop: 6 }}>
        <span className="gtile">GA</span>
        <div>
          <h2>Grace Adeyemi</h2> <Chip tone="mint" style={{ verticalAlign: 6, marginLeft: 6 }}>Active patient</Chip>
          <div className="meta">ID: AV-1263 &nbsp;|&nbsp; 16 Aug 1999 (25 yrs) &nbsp;|&nbsp; grace.adeyemi@example.com &nbsp;|&nbsp; 07796 358454</div>
          <div className="meta">
            <b style={{ fontWeight: 600 }}>Practitioner:</b> Dr Nadia Rahman &nbsp;|&nbsp; <b style={{ fontWeight: 600 }}>Journey:</b> 3-Month Microneedling Plan
          </div>
        </div>
        <button type="button" className="cj-pill" style={{ marginLeft: "auto" }} onClick={() => toast("More actions: archive, export, transfer (mocked)")}>
          More actions ▾
        </button>
      </div>

      <div className="cj-stats" style={{ marginTop: 10 }}>
        <button type="button" className="cj-stat" onClick={() => { setTab("Skin Journey"); toast("Build & Support — month 2 of 3, five steps remaining"); }}>
          <span className="ic" style={{ background: "var(--mint)", color: "var(--mintink)" }}>
            <Icon d="layers" size={18} />
          </span>
          <span>
            <small>Current phase</small>
            <span className="v" style={{ fontSize: 15, marginTop: 3, display: "block" }}>Build &amp; Support</span>
            <span className="foot">Month 2 of 3</span>
          </span>
          <span style={{ marginLeft: "auto", color: "#aab3c6" }}>›</span>
        </button>
        <button type="button" className="cj-stat" onClick={() => { setTab("Skin Journey"); toast(`Plan progress: ${doneCount} of ${steps?.length ?? 14} milestones (${pct}%)`); }}>
          <Ring pct={pct} size={52} strokeWidth={6} color="#0b635c" ink="#0b1f4d" fontSize={11.5} />
          <span>
            <small>Plan progress</small>
            <span className="v" style={{ fontSize: 15, marginTop: 3, display: "block" }}>
              {doneCount} of {steps?.length ?? 14} milestones
            </span>
          </span>
          <span style={{ marginLeft: "auto", color: "#aab3c6" }}>›</span>
        </button>
        <button type="button" className="cj-stat" onClick={() => toast("Appointment detail: Tue 27 Sep 2024 10:00 with Dr Nadia Rahman")}>
          <span className="ic" style={{ background: "var(--blue)", color: "var(--blueink)" }}>
            <Icon d="cal" size={18} />
          </span>
          <span>
            <small>Next appointment</small>
            <span className="v" style={{ fontSize: 15, marginTop: 3, display: "block" }}>Microneedling Session 2</span>
            <span className="foot">Tue 27 Sep 2024, 10:00am</span>
          </span>
        </button>
        <button type="button" className="cj-stat" onClick={() => setUpload(true)}>
          <span className="ic" style={{ background: "#f8ebe7", color: "#d0685f" }}>
            <Icon d="drop" size={18} />
          </span>
          <span>
            <small>Blood test status</small>
            <span className="v" style={{ fontSize: 15, marginTop: 3, display: "block" }}>In progress</span>
            <span className="foot">Due 22 Sep 2024</span>
          </span>
        </button>
      </div>

      <div className="cj-tabs">
        {TABS.map((t) => (
          <button key={t} type="button" className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Skin Journey" ? (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 12, marginTop: 10, alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="cj-panel">
              <h3>
                Plan roadmap
                <span className="see">
                  <button type="button" className="cj-pill" style={{ height: 30, fontSize: 11.5 }} onClick={() => toast("Calendar view is on the Lumina patient portal — same plan data")}>
                    <Icon d="cal" size={13} /> View as calendar
                  </button>
                </span>
              </h3>
              <div className="psub">A step-by-step guide to Grace's treatment, care and results. This mirrors the patient portal.</div>
              <div style={{ display: "grid", gridTemplateColumns: "140px minmax(0,1fr)", columnGap: 16, marginTop: 8 }}>
                <div>
                  {monthMeta.map((m, i) => (
                    <div key={m.label} className="cj-month" style={i === 0 ? { borderTop: "3px solid var(--teal)", paddingTop: 8 } : { marginTop: 30 }}>
                      <h4>
                        <small>{m.label}</small>
                        {m.title}
                      </h4>
                      <p>{m.desc}</p>
                      <div className="prog">
                        {monthDone(i)} of {monthTotal(i)} complete
                      </div>
                      <div className="bar">
                        <i style={{ width: `${(monthDone(i) / monthTotal(i)) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="cj-steps">
                  {steps?.map((s, i) => {
                    const cls = s.status === "done" ? "done" : s.status === "current" ? "cur" : s.status === "conditional" ? "cond" : "";
                    const chip = s.status === "done" ? ["mint", "Completed"] : s.status === "current" ? ["deep", "Current"] : s.status === "conditional" ? ["slate", "Conditional"] : ["blue", "Upcoming"];
                    return (
                      <button key={s.id} type="button" className={`cj-step ${cls}`} onClick={() => toast(`${s.title}: ${s.desc}`)}>
                        <span className="dot">{s.status === "done" || s.status === "current" ? <Icon d="check" size={10} stroke="#fff" /> : i + 1}</span>
                        <b>{s.title}</b>
                        <span className="date">{s.date}</span>
                        <Chip tone={chip[0]} style={{ minWidth: 72, justifyContent: "center" }}>
                          {chip[1]}
                        </Chip>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.25fr", gap: 10 }}>
              <div className="cj-panel">
                <h3 style={{ fontSize: 12.5 }}>
                  Treatment history<span className="see" style={{ fontSize: 10, color: "var(--mut)" }}>4 treatments</span>
                </h3>
                {[
                  ["Microneedling with PRP", "15 Sep 2024"],
                  ["Consultation & Skin Assessment", "5 Sep 2024"],
                  ["Patch Test", "3 Sep 2024"],
                ].map(([t, d]) => (
                  <button key={t} type="button" className="cj-hrow" onClick={() => toast(`${t} on ${d} — detail is mocked`)}>
                    <span>{t}</span>
                    <span className="d">
                      {d} <Chip tone="mint">Completed</Chip>
                    </span>
                  </button>
                ))}
                <button type="button" style={{ color: "var(--teal)", fontSize: 11, fontWeight: 600, marginTop: 7 }} onClick={() => toast("Full treatment history is in the pastel patient record")}>
                  View full history →
                </button>
              </div>
              <div className="cj-panel">
                <h3 style={{ fontSize: 12.5 }}>
                  Upcoming appointments<span className="see" style={{ fontSize: 10, color: "var(--mut)" }}>2 appointments</span>
                </h3>
                {[
                  ["Microneedling Session 2", "Tue 27 Sep 2024, 10:00am", "blue", "Confirmed"],
                  ["Microneedling Session 3", "Fri 25 Oct 2024, 10:00am", "slate", "Scheduled"],
                ].map(([t, d, tone, lb]) => (
                  <button key={t} type="button" className="cj-hrow" onClick={() => toast(`${t} — ${d}`)}>
                    <span>
                      <b style={{ fontSize: 11.8 }}>{t}</b>
                      <br />
                      <small style={{ color: "var(--mut)", fontSize: 10.5 }}>{d}</small>
                    </span>
                    <span className="d">
                      <Chip tone={tone}>{lb}</Chip>
                    </span>
                  </button>
                ))}
                <button type="button" style={{ color: "var(--teal)", fontSize: 11, fontWeight: 600, marginTop: 7 }} onClick={() => nav("/clinic/journey/diary")}>
                  View all appointments →
                </button>
              </div>
              <div className="cj-panel">
                <h3 style={{ fontSize: 12.5 }}>
                  Recent photos
                  <span className="see" style={{ fontSize: 10 }} onClick={() => setTab("Before & After")}>
                    View all photos →
                  </span>
                </h3>
                <div className="cj-photos">
                  <div className="ph">
                    <img src="/assets/skin-before-2.png" alt="" />
                    <div className="lb">
                      5 Sep 2024
                      <br />
                      Baseline
                    </div>
                  </div>
                  <div className="ph">
                    <img src="/assets/skin-progress-2.png" alt="" />
                    <div className="lb">
                      15 Sep 2024
                      <br />
                      After Session 1
                    </div>
                  </div>
                  <div className="ph">
                    <img src="/assets/skin-after-2.png" alt="" />
                    <div className="lb">
                      18 Sep 2024
                      <br />
                      Progress
                    </div>
                  </div>
                  <button type="button" className="add" onClick={() => toast("Photo upload is mocked")}>
                    ＋<span style={{ fontSize: 9, marginTop: 2 }}>Add photos</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="cj-panel">
              <h3 style={{ fontSize: 13.5 }}>⚙ Clinician action panel</h3>
              <div className="psub">Support Grace's journey with timely actions.</div>
              <div style={{ marginTop: 6 }}>
                {actions?.map((a) => (
                  <Check key={a.id} checked={a.done} onChange={async () => setActions(await api.toggleClinAction(a.id))}>
                    {a.label}
                  </Check>
                ))}
              </div>
              <button type="button" className="btn deep" style={{ width: "100%", marginTop: 9, background: "var(--deep)", borderColor: "var(--deep)" }} onClick={() => setUpload(true)}>
                <Icon d="up" size={14} /> Upload Result
              </button>
              <div className="cj-btnrow">
                <button type="button" className="btn sm" onClick={() => toast("Compose opened in the messages panel of the pastel record (mocked here)")}>
                  💬 Send Message
                </button>
                <button type="button" className="btn sm" onClick={() => toast("Reminder assigned to Dr Nadia Rahman for 20 Sep")}>
                  ⏰ Assign Reminder
                </button>
              </div>
            </div>
            <div className="cj-panel cj-focuscard">
              <h3 style={{ fontSize: 13 }}>
                ☀ Today's focus<span className="see" style={{ color: "var(--mut)", fontSize: 10.5 }}>{focus?.filter((f) => !f.done).length ?? 3} tasks</span>
              </h3>
              {focus?.map((t) => (
                <Check key={t.id} checked={t.done} onChange={async () => setFocus(await api.toggleFocus(t.id))}>
                  {t.label}
                </Check>
              ))}
            </div>
            <div className="cj-panel">
              <h3 style={{ fontSize: 13 }}>
                Plan notes
                <span className="see" onClick={() => setEditNote(true)}>
                  ✎ Edit
                </span>
              </h3>
              <p style={{ fontSize: 11.8, lineHeight: 1.55, color: "#42506e", marginTop: 7 }}>{planNote}</p>
              <div style={{ color: "var(--mut)", fontSize: 10.5, marginTop: 9 }}>Last updated 18 Sep 2024 by Dr Nadia Rahman</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="cj-panel" style={{ marginTop: 10 }}>
          <h3>{tab}</h3>
          {tab === "Before & After" ? (
            <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
              {[
                ["/assets/skin-before-2.png", "Baseline · 5 Sep"],
                ["/assets/skin-progress-2.png", "After Session 1 · 15 Sep"],
                ["/assets/skin-after-2.png", "Progress · 18 Sep"],
              ].map(([src, lb]) => (
                <div key={lb} style={{ width: 170 }}>
                  <img src={src} alt={lb} style={{ width: "100%", height: 128, objectFit: "cover", borderRadius: 10 }} />
                  <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 4, textAlign: "center" }}>{lb}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="psub" style={{ padding: "10px 0" }}>
              {tab === "Overview" && "Summary of Grace's plan — the Skin Journey tab holds the full roadmap."}
              {tab === "Treatments" && "Three completed treatments — the full history lives in the pastel patient record."}
              {tab === "Documents" && "Consent forms and lab reports would be listed here (mocked)."}
              {tab === "Messages" && "Message Grace from the pastel patient record's message panel."}
            </div>
          )}
        </div>
      )}

      <Modal open={editNote} onClose={() => setEditNote(false)} title="Edit plan notes">
        <label className="field">
          <span>Notes</span>
          <textarea rows={5} defaultValue={planNote} id="cj-note-edit" />
        </label>
        <button
          type="button"
          className="cj-cta"
          onClick={async () => {
            const el = document.getElementById("cj-note-edit") as HTMLTextAreaElement;
            const updated = await api.setPlanNote(el.value);
            setNoteText(updated);
            setEditNote(false);
            toast("Plan notes saved");
          }}
        >
          Save notes
        </button>
      </Modal>
      <Modal open={upload} onClose={() => setUpload(false)} title="Upload blood test result">
        <label className="field">
          <span>File</span>
          <input defaultValue="B12-results-grace-adeyemi.pdf" />
        </label>
        <button
          type="button"
          className="cj-cta"
          onClick={async () => {
            const updated = await api.uploadResult("s7", "B12-results-grace-adeyemi.pdf");
            setSteps(steps!.map((s) => (s.id === updated.id ? updated : s)));
            setUpload(false);
            toast("Result uploaded against the Blood Test Check step");
          }}
        >
          <Icon d="up" size={14} /> Upload
        </button>
      </Modal>
    </>
  );
}
