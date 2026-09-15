import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { Chip, Modal, Toggle } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import { useLoad } from "../../../hooks";
import { api } from "../../../mock/api";
import type { Msg } from "../../../mock/types";

const TABS = ["Treatments", "Visit notes", "Before and after", "Documents", "History updates"] as const;

const HISTORY = [
  ["Microneedling with PRP", "Full face and neck · Autologous PRP · 1.5mm depth · £295", "13/09/2026"],
  ["Microneedling with PRP", "Full face · Dermapen 4 with PRP · 1.0mm depth · £295", "09/09/2026"],
  ["Microneedling with PRP", "Full face · Dermapen 4 with PRP · 1.0mm depth · £295", "08/09/2026"],
  ["Microneedling with PRP", "Full face and neck · Dermapen 4 with PRP · 1.5mm depth · £295", "22/05/2026"],
  ["Microneedling with PRP", "Full face · Dermapen 4 with PRP · 1.5mm depth · £295", "23/01/2026"],
];

export function PastelRecord() {
  const toast = useToast();
  const nav = useNavigate();
  const { id = "grace-adeyemi" } = useParams();
  const { data: patient } = useLoad(() => api.getPatient(id), [id]);
  const { data: prefs, setData: setPrefs } = useLoad(() => api.getPrefs());
  const [tab, setTab] = useState<(typeof TABS)[number]>("Treatments");
  const [recordTx, setRecordTx] = useState(false);
  const [history, setHistory] = useState(HISTORY);

  const fullName = patient ? `${patient.last}, ${patient.title} ${patient.first}` : "…";
  const firstName = patient?.first ?? "Grace";

  return (
    <>
      <button type="button" className="cp-bc" onClick={() => nav("/clinic/pastel/patients")}>
        ← All patients
      </button>
      <div className="cp-recgrid">
        <div className="cp-reccol">
          <div className="cp-panel">
            <div className="cp-rechead">
              <span className="gtile">{(patient?.first[0] ?? "G") + (patient?.last[0] ?? "A")}</span>
              <div>
                <h2>{fullName}</h2>
                <div className="meta">
                  {patient?.ref} · {patient?.dob} · {patient?.email} · {patient?.phone}
                </div>
                <div className="meta2">{patient?.visits ?? 5} visits · last seen 0 days ago</div>
              </div>
              <div className="acts">
                <button type="button" className="btn sm butter" onClick={() => setRecordTx(true)}>
                  <Icon d="cal" size={14} /> Record treatment
                </button>
                <button type="button" className="btn sm" onClick={() => toast(`Consent form sent to ${patient?.email} (mocked)`)}>
                  ✈ Send form
                </button>
                <button type="button" className="btn sm" onClick={() => toast("Archive is mocked — record kept active for the demo")}>
                  🗀 Archive
                </button>
                <button type="button" className="btn sm" style={{ padding: "0 10px" }} onClick={() => toast("More actions: merge, export, delete (mocked)")}>
                  ⋯
                </button>
              </div>
            </div>
            <div className="cp-3cards">
              <button type="button" className="cp-vital" style={{ background: "var(--pink)" }} onClick={() => toast("Allergies: none known — edit is mocked")}>
                <Icon d="heart" size={16} stroke="#c2588a" />
                <span>
                  <small style={{ color: "#c2588a" }}>Allergies</small>
                  <b style={{ color: "#b0446f" }}>None known</b>
                </span>
              </button>
              <button type="button" className="cp-vital" style={{ background: "var(--blue)" }} onClick={() => toast("Medication: none recorded — edit is mocked")}>
                <Icon d="plus" size={16} stroke="#4a6fa5" />
                <span>
                  <small style={{ color: "#4a6fa5" }}>Medication</small>
                  <b style={{ color: "#39587f" }}>None</b>
                </span>
              </button>
              <button type="button" className="cp-vital" style={{ background: "var(--mint)" }} onClick={() => toast("Conditions: none recorded — edit is mocked")}>
                <Icon d="task" size={16} stroke="#2e7d5b" />
                <span>
                  <small style={{ color: "#2e7d5b" }}>Conditions</small>
                  <b style={{ color: "#236248" }}>None recorded</b>
                </span>
              </button>
            </div>
          </div>

          <div className="cp-panel">
            <h3>
              <Icon d="mail" size={17} />
              Contact preferences
              <span className="hlink">
                <button type="button" className="btn sm" onClick={() => toast("Toggle the switches directly — they persist")}>
                  ✎ Edit preferences
                </button>
              </span>
            </h3>
            <div className="psub">UK marketing is opt-in. Reminders stay on unless the patient opts out. Nothing is emailed or texted from here yet.</div>
            {prefs && (
              <>
                <div className="cp-prefrow">
                  <span className="ic">
                    <Icon d="bell" size={14} />
                  </span>
                  <span>
                    <b>Appointment reminders</b>
                    <small>Visit confirmations and recall reminders by email or text.</small>
                  </span>
                  <Toggle on={prefs.reminders} label="Appointment reminders" onChange={async (v) => setPrefs(await api.setPref("reminders", v))} />
                </div>
                <div className="cp-prefrow">
                  <span className="ic">
                    <Icon d="mail" size={14} />
                  </span>
                  <span>
                    <b>Marketing by email</b>
                    <small>Offers and news. Off unless they opt in.</small>
                  </span>
                  <Toggle on={prefs.marketingEmail} label="Marketing by email" onChange={async (v) => setPrefs(await api.setPref("marketingEmail", v))} />
                </div>
                <div className="cp-prefrow">
                  <span className="ic">
                    <Icon d="msg" size={14} />
                  </span>
                  <span>
                    <b>Marketing by text</b>
                    <small>Also needs the marketing switch on.</small>
                  </span>
                  <Toggle on={prefs.marketingText} label="Marketing by text" onChange={async (v) => setPrefs(await api.setPref("marketingText", v))} />
                </div>
              </>
            )}
          </div>

          <div className="cp-panel">
            <h3>
              <Icon d="msg" size={17} />
              Email and text
              <span className="hlink">
                <button type="button" className="btn sm" onClick={() => toast("Outbox processed — nothing was queued")}>
                  Process queue
                </button>
              </span>
            </h3>
            <div className="psub">Queued until the outbox runs. Demo and sandbox mark them sent without leaving the clinic.</div>
            <div className="cp-inline-info">ⓘ Nothing queued. Emails and texts will appear here once the clinic starts sending them.</div>
          </div>

          <div className="cp-tabs">
            {TABS.map((t) => (
              <button key={t} type="button" className={`cp-tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>
                {t}
                {t === "Treatments" && <span className="n">{history.length}</span>}
              </button>
            ))}
          </div>

          {tab === "Treatments" ? (
            <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 12, alignItems: "start" }}>
              <div className="cp-panel">
                <h3>
                  <Icon d="task" size={17} />
                  Treatment history
                  <span className="hlink">
                    <button type="button" className="btn sm" onClick={() => setRecordTx(true)}>
                      + Add treatment
                    </button>
                  </span>
                </h3>
                <div className="psub">Recorded treatments and follow-up dates.</div>
                {history.map(([t, sub, d], i) => (
                  <button key={i} type="button" className="cp-hrow" onClick={() => toast(`${t} on ${d} — treatment detail view is mocked`)}>
                    <span>
                      <b>{t}</b>
                      <small>{sub}</small>
                    </span>
                    <span className="d">{d} ›</span>
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div className="cp-panel">
                  <h3>
                    <Icon d="cal" size={17} />
                    Upcoming appointments
                  </h3>
                  <div className="psub">Future diary visits and what still needs chasing.</div>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 10 }}>
                    <div style={{ textAlign: "center", background: "var(--pink)", borderRadius: 10, padding: "7px 11px", flex: "none" }}>
                      <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--pinkink)" }}>OCT</div>
                      <div style={{ fontSize: 19, fontWeight: 800, color: "#b0446f" }}>2</div>
                      <div style={{ fontSize: 9.5, color: "var(--pinkink)" }}>Fri</div>
                    </div>
                    <div>
                      <b style={{ fontSize: 13 }}>Microneedling with PRP</b>
                      <div style={{ color: "var(--mut)", fontSize: 11.5, marginTop: 2 }}>14:30 · Dr Nadia Rahman</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                        <Chip tone="pink" onClick={() => toast("Balance of £147.50 outstanding — payment links are mocked")}>
                          Balance due
                        </Chip>
                        <Chip tone="blue" onClick={() => toast("Consent form not yet signed — use Send form above")}>
                          Consent due
                        </Chip>
                      </div>
                    </div>
                    <span style={{ marginLeft: "auto", color: "#aab3c6" }}>›</span>
                  </div>
                  <button type="button" style={{ color: "#2e7d5b", fontSize: 12, fontWeight: 600, marginTop: 11 }} onClick={() => nav("/clinic/pastel/diary")}>
                    Open diary →
                  </button>
                </div>
                <div className="cp-panel">
                  <h3>
                    <Icon d="clock" size={17} />
                    Recall tasks
                  </h3>
                  <div className="psub">No recall tasks yet. Assign one from the Retention page by hovering a patient's practitioner.</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="cp-panel">
              <h3>{tab}</h3>
              {tab === "Before and after" ? (
                <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
                  {[
                    ["/assets/skin-before-2.png", "Baseline · 23/01/2026"],
                    ["/assets/skin-progress-2.png", "Mid-plan · 22/05/2026"],
                    ["/assets/skin-after-2.png", "Latest · 13/09/2026"],
                  ].map(([src, lb]) => (
                    <div key={lb} style={{ width: 160 }}>
                      <img src={src} alt={lb} style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 10 }} />
                      <div style={{ fontSize: 11, color: "var(--mut)", marginTop: 4 }}>{lb}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="psub" style={{ padding: "10px 0" }}>
                  {tab === "Visit notes" && "One visit note per treatment — the note editor is mocked in this demo."}
                  {tab === "Documents" && "Signed consent forms and lab reports would be listed here (mocked)."}
                  {tab === "History updates" && "Audit trail of record changes (mocked)."}
                </div>
              )}
            </div>
          )}
        </div>

        <PatientThread name={firstName} />
      </div>

      <Modal
        open={recordTx}
        onClose={() => setRecordTx(false)}
        title="Record treatment"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setRecordTx(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn butter"
              onClick={() => {
                setHistory([["Microneedling with PRP", "Full face · Dermapen 4 with PRP · 1.5mm depth · £295", "15/09/2026"], ...history]);
                setRecordTx(false);
                toast("Treatment recorded and added to the history");
              }}
            >
              Save treatment
            </button>
          </>
        }
      >
        <label className="field">
          <span>Treatment</span>
          <select defaultValue="Microneedling with PRP">
            <option>Microneedling with PRP</option>
            <option>Chemical Peel</option>
            <option>Profhilo</option>
          </select>
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea rows={3} defaultValue="Full face · Dermapen 4 with PRP · 1.5mm depth" />
        </label>
        <label className="field">
          <span>Price</span>
          <input defaultValue="£295.00" />
        </label>
      </Modal>
    </>
  );
}

function PatientThread({ name }: { name: string }) {
  const toast = useToast();
  const { data: msgs, setData } = useLoad<Msg[]>(() => api.getThread("grace-adeyemi"));
  const [text, setText] = useState("");

  async function send() {
    setData(await api.sendMessage("grace-adeyemi", "clinic", "Dr Amara Osei", text.trim()));
    setText("");
    toast(`Message sent to ${name}`);
  }

  return (
    <div className="cp-msgs">
      <div className="who">
        <span className="cp-ava" style={{ width: 34, height: 34, fontSize: 12, background: "var(--pink)", color: "var(--pinkink)" }}>
          GA
        </span>
        <div>
          <b>Grace Adeyemi</b>
          <small>Private messages with this patient</small>
        </div>
      </div>
      {msgs?.length === 0 ? (
        <div className="empty">
          <Icon d="msg" size={26} stroke="#c3ccd8" />
          No messages yet. Say hello, or send a treatment reminder.
        </div>
      ) : (
        <div className="stream">
          {msgs?.map((m) => (
            <div key={m.id} className={`m ${m.from}`}>
              {m.text}
              <small>
                {m.author} · {m.at}
              </small>
            </div>
          ))}
        </div>
      )}
      <div className="inp">
        <input value={text} placeholder={`Message ${name}…`} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && text.trim() && send()} />
        <button type="button" disabled={!text.trim()} onClick={send} aria-label="Send">
          ➤
        </button>
      </div>
    </div>
  );
}
