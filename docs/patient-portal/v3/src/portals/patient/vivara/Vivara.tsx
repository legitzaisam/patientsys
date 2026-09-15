import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { Check, Modal, Ring, Slider, levelOf } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import { useLoad } from "../../../hooks";
import { api } from "../../../mock/api";
import type { Msg } from "../../../mock/types";
import "../../../styles/vivara.css";

const TABS = ["overview", "timeline", "today", "photos", "messages"] as const;

export function VivaraPortal() {
  const { tab = "overview" } = useParams();
  const nav = useNavigate();
  const toast = useToast();

  return (
    <div className="viv-root">
      <div className="viv-nav">
        <div className="viv-logo">
          <span className="leaf">❧</span>
          <div>
            <b>VIVARA</b>
            <small>SKIN HEALTH FOR WHAT'S NEXT</small>
          </div>
        </div>
        <div className="viv-links">
          <button type="button" onClick={() => toast("Care menu: treatments, aftercare guides, contact")}>Care ▾</button>
          <button type="button" className="on" onClick={() => nav("/patient/vivara")}>
            Skin Plan &amp; Journey
          </button>
          <button type="button" onClick={() => toast("Resources: skincare guides and FAQs (mocked)")}>Resources</button>
          <button type="button" onClick={() => toast("Booking flow is mocked — use 'Book a blood test' on the Overview tab")}>Book</button>
          <button type="button" onClick={() => nav("/patient/vivara/messages")}>Messages</button>
        </div>
        <div className="viv-right">
          <button type="button" style={{ color: "#6b7284" }} onClick={() => toast("1 notification: stop actives in 5 days")} aria-label="Notifications">
            <Icon d="bell" size={20} />
          </button>
          <span className="em">EM</span>
          <b style={{ fontSize: 14 }}>Emma Carter</b>
          <span style={{ color: "#9aa0ac" }}>▾</span>
        </div>
      </div>
      <VivaraBand tab={tab} onTab={(t) => nav(t === "overview" ? "/patient/vivara" : `/patient/vivara/${t}`)} />
      {tab === "overview" && <VivaraOverview />}
      {tab === "timeline" && <VivaraTimeline full />}
      {tab === "today" && <VivaraToday />}
      {tab === "photos" && <VivaraPhotos />}
      {tab === "messages" && <VivaraMessages />}
    </div>
  );
}

function VivaraBand({ tab, onTab }: { tab: string; onTab: (t: string) => void }) {
  return (
    <div className="viv-band">
      <div className="viv-band-row">
        <div>
          <div className="viv-eyebrow">YOUR PLAN</div>
          <h1>3-Month Microneedling Plan</h1>
          <div className="sub">Smoother texture. Brighter tone. A stronger, healthier you.</div>
        </div>
        <div className="viv-meta">
          <div className="cell">
            <Ring pct={43} size={70} strokeWidth={7} color="#18555c" ink="#111a2b" fontSize={15} />
            <div>
              <b>Plan completion</b>
              <em>5 of 12 milestones</em>
            </div>
          </div>
          <div className="cell">
            <span className="tile">
              <Icon d="person" size={20} />
            </span>
            <div>
              <small>Your clinician</small>
              <b>Layla Hassan</b>
              <em>Dermatology Specialist</em>
            </div>
          </div>
          <div className="cell">
            <span className="tile sq">
              <Icon d="cal" size={20} />
            </span>
            <div>
              <small>Next visit</small>
              <b>20 Oct 2025</b>
              <em>Microneedling Session 2</em>
            </div>
          </div>
        </div>
        <div className="viv-script caveat">
          Progress
          <br />
          looks good
          <br />
          on you.
        </div>
      </div>
      <div className="viv-tabs">
        {TABS.map((t) => (
          <button key={t} type="button" className={tab === t ? "on" : ""} onClick={() => onTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- overview */
function VivaraOverview() {
  const toast = useToast();
  const nav = useNavigate();
  const { data: sliders, setData: setSliders } = useLoad(() => api.getSliders());
  const { data: garden, setData: setGarden } = useLoad(() => api.getGarden());
  const [upload, setUpload] = useState(false);
  const [book, setBook] = useState(false);
  const [checklist, setChecklist] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const routine = garden?.tasks.find((t) => t.id === "g2");
  const hydration = garden?.tasks.find((t) => t.id === "g1");

  async function toggleTask(id: string) {
    if (!garden) return;
    const tasks = await api.toggleGardenTask(id);
    setGarden({ ...garden, tasks });
  }

  return (
    <div className="viv-grid">
      <div className="viv-card viv-today" style={{ gridRow: "1" }}>
        <div className="viv-h">
          <Icon d="sun" size={18} stroke="#b08d4f" />
          Today / Next Action<span className="day">Day 12 of 90</span>
        </div>
        <div className="viv-big">
          <div className="tile">
            <Icon d="task" size={23} />
          </div>
          <div>
            <h4>{uploaded ? "B12 result uploaded — clinic reviewing" : "Book or upload your B12 blood test result"}</h4>
            <p>Your B12 level helps us ensure the best healing and results. Upload your result or book a test with our partner lab.</p>
            <div className="btns">
              <button type="button" className="btn deep" style={{ background: "#18555c", borderColor: "#18555c" }} onClick={() => setUpload(true)}>
                <Icon d="up" size={16} /> Upload result
              </button>
              <button type="button" className="viv-link" onClick={() => setBook(true)}>
                Book a blood test →
              </button>
            </div>
          </div>
        </div>
        <button type="button" className="viv-row" onClick={() => toggleTask("g2")}>
          <span className={`ckbox ${routine?.done ? "on" : ""}`} style={{ width: 22, height: 22, borderRadius: "50%" }} />
          <span className="tile">
            <Icon d="person" size={18} />
          </span>
          <span>
            <b className={routine?.done ? "donetext" : ""}>Complete your daily skincare routine</b>
            <small>AM and PM routine</small>
          </span>
          <span className="chev">›</span>
        </button>
        <button type="button" className="viv-row" onClick={() => toggleTask("g1")}>
          <span className={`ckbox ${hydration?.done ? "on" : ""}`} style={{ width: 22, height: 22, borderRadius: "50%" }} />
          <span className="tile">
            <Icon d="drop" size={18} />
          </span>
          <span>
            <b className={hydration?.done ? "donetext" : ""}>Stay hydrated</b>
            <small>Aim for 2–3 litres of water today</small>
          </span>
          <span className="chev">›</span>
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="viv-card">
          <div className="viv-h">
            <Icon d="cal" size={17} stroke="#8a7a5c" />
            Upcoming
            <span className="see" onClick={() => nav("/patient/vivara/timeline")}>
              See all
            </span>
          </div>
          <button type="button" className="viv-up-item" onClick={() => toast("Reminder set: stop retinoids, acids and exfoliants from 15 Oct")}>
            <span className="tile">
              <Icon d="clock" size={18} />
            </span>
            <span>
              <b>Stop actives in 5 days</b>
              <small>15 Oct 2025</small>
              <p>Pause retinoids, acids and exfoliants before your next session.</p>
            </span>
            <span className="chev">›</span>
          </button>
          <button type="button" className="viv-up-item" onClick={() => toast("Microneedling Session 2 — 20 Oct 2025, 10:00 AM at Vivara Skin Clinic")}>
            <span className="tile">
              <Icon d="cal" size={18} />
            </span>
            <span>
              <b>Microneedling Session 2</b>
              <small>20 Oct 2025 · 10:00 AM</small>
              <p>📍 Vivara Skin Clinic</p>
            </span>
            <span className="chev">›</span>
          </button>
        </div>
        <div className="viv-card">
          <div className="viv-h">
            <Icon d="link" size={17} stroke="#8a7a5c" />
            Conditional steps
          </div>
          <button type="button" className="viv-up-item" onClick={() => toast("This step unlocks automatically once your B12 result is reviewed")}>
            <span className="tile">
              <Icon d="link" size={18} />
            </span>
            <span>
              <b>Start B12 supplement guidance if deficient</b>
              <p>We'll share a personalised supplement plan once we've received your result.</p>
            </span>
            <span className="chev">›</span>
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="viv-card">
          <div className="viv-h">
            <Icon d="heart" size={17} stroke="#c2705f" />
            Recovery Check-in
          </div>
          <div style={{ color: "#8b8f99", fontSize: 12.5, marginTop: 4 }}>How are you feeling today? Drag to update.</div>
          {sliders && (
            <>
              <Slider label="Redness" value={sliders.redness} levelText={levelOf} onChange={async (v) => setSliders(await api.setSlider("redness", v))} />
              <Slider label="Sensitivity" value={sliders.sensitivity} levelText={levelOf} onChange={async (v) => setSliders(await api.setSlider("sensitivity", v))} />
              <Slider label="Dryness" value={sliders.dryness} levelText={levelOf} onChange={async (v) => setSliders(await api.setSlider("dryness", v))} />
            </>
          )}
        </div>
        <div className="viv-card">
          <div className="viv-h">
            <Icon d="photo" size={17} stroke="#8a7a5c" />
            Before &amp; After
            <span className="see" onClick={() => nav("/patient/vivara/photos")}>
              See all
            </span>
          </div>
          <div className="viv-ba">
            <div>
              <img src="/assets/skin-before-1.png" alt="Before" />
              <div className="lb">
                <b>Before</b> · 12 Sep 2025
              </div>
            </div>
            <div>
              <img src="/assets/skin-after-1.png" alt="After" />
              <div className="lb">
                <b>After</b> · —
              </div>
            </div>
            <div className="handle">‹›</div>
          </div>
        </div>
        <div className="viv-card">
          <div className="viv-h">
            <Icon d="drop" size={17} stroke="#5a7ba6" />
            Product routine adherence<span className="see" style={{ color: "#8b8f99" }}>This week</span>
          </div>
          <div className="viv-adh">
            <span>☀ AM routine</span>
            <span className="lane">
              <i style={{ width: `${((garden?.routine.am ?? 5) / 7) * 100}%` }} />
            </span>
            <span className="n">{garden?.routine.am ?? 5}/7</span>
          </div>
          <div className="viv-adh">
            <span>☾ PM routine</span>
            <span className="lane">
              <i style={{ width: `${((garden?.routine.pm ?? 4) / 7) * 100}%` }} />
            </span>
            <span className="n">{garden?.routine.pm ?? 4}/7</span>
          </div>
        </div>
        <div className="viv-card viv-safe">
          <div className="viv-h">
            <Icon d="shield" size={17} stroke="#2f8f83" />
            Safe to Proceed?
          </div>
          <p>
            <b style={{ color: "#111a2b" }}>Appointment preparation</b>
            <br />
            Review your pre-treatment checklist to make sure you're ready for Session 2.
          </p>
          <button type="button" className="chk" onClick={() => setChecklist(true)}>
            <Icon d="task" size={16} /> View checklist<span className="chev">›</span>
          </button>
        </div>
      </div>

      <VivaraTimeline />

      <Modal open={upload} onClose={() => setUpload(false)} title="Upload B12 result">
        <label className="field">
          <span>File</span>
          <input defaultValue="B12-results-emma-carter.pdf" id="viv-upload-name" />
        </label>
        <button
          type="button"
          className="btn deep"
          style={{ background: "#18555c", borderColor: "#18555c" }}
          onClick={() => {
            setUpload(false);
            setUploaded(true);
            toast("Result uploaded — Layla Hassan will review it before Session 2");
          }}
        >
          <Icon d="up" size={15} /> Upload
        </button>
      </Modal>
      <Modal open={book} onClose={() => setBook(false)} title="Book a blood test">
        <label className="field">
          <span>Partner lab</span>
          <select defaultValue="Vivara Health Lab — City Centre">
            <option>Vivara Health Lab — City Centre</option>
            <option>Vivara Health Lab — Riverside</option>
          </select>
        </label>
        <label className="field">
          <span>Preferred date</span>
          <input type="date" defaultValue="2025-10-16" />
        </label>
        <button
          type="button"
          className="btn deep"
          style={{ background: "#18555c", borderColor: "#18555c" }}
          onClick={() => {
            setBook(false);
            toast("Blood test requested — the lab will confirm by email");
          }}
        >
          Request booking
        </button>
      </Modal>
      <Modal open={checklist} onClose={() => setChecklist(false)} title="Pre-treatment checklist — Session 2">
        <PreTreatmentChecklist />
      </Modal>
    </div>
  );
}

function PreTreatmentChecklist() {
  const [items, setItems] = useState([
    { id: "1", label: "Stop retinoids, acids and exfoliants (from 15 Oct)", done: false },
    { id: "2", label: "Upload B12 blood test result", done: false },
    { id: "3", label: "No sunbathing or SPF-free sun exposure this week", done: true },
    { id: "4", label: "Arrive with clean skin, no makeup", done: false },
  ]);
  return (
    <div>
      {items.map((i) => (
        <Check key={i.id} checked={i.done} onChange={() => setItems(items.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x)))}>
          {i.label}
        </Check>
      ))}
      <p style={{ fontSize: 12, color: "#8b8f99", marginTop: 10 }}>
        {items.every((i) => i.done) ? "You're ready for Session 2 ✓" : `${items.filter((i) => i.done).length} of ${items.length} complete`}
      </p>
    </div>
  );
}

/* --------------------------------------------------------------- timeline */
const JOURNEY = [
  {
    month: "Month 1",
    title: "Foundation",
    pts: ["done", "done", "done"],
    items: [
      ["Consultation", true],
      ["Skin prep & baseline photos", true],
      ["Microneedling Session 1", true],
      ["Healing & recovery", true],
    ],
  },
  {
    month: "Month 2",
    title: "Build & Support",
    pts: ["cur", "", ""],
    items: [
      ["B12 test & supplement (if needed)", false],
      ["Microneedling Session 2", false],
      ["Continue skincare routine", false],
      ["Track progress photos", false],
    ],
  },
  {
    month: "Month 3",
    title: "Results & Confidence",
    pts: ["", "", ""],
    items: [
      ["Microneedling Session 3", false],
      ["Final comparison", false],
      ["Maintenance plan", false],
      ["Celebrate your progress ✨", false],
    ],
  },
] as const;

function VivaraTimeline({ full }: { full?: boolean }) {
  const nav = useNavigate();
  const body = (
    <div className="viv-jgrid">
      {JOURNEY.map((m) => (
        <div key={m.month} className="viv-jm">
          <small>{m.month}</small>
          <b>{m.title}</b>
          <div className="viv-track">
            {m.pts.map((p, i) => (
              <span key={i} className={`pt ${p}`} style={{ left: `${i * 36}%` }}>
                {p === "done" && <Icon d="check" size={11} stroke="#fff" />}
                {p === "cur" && <i />}
              </span>
            ))}
          </div>
          <div className="viv-jlist">
            {m.items.map(([label, on]) => (
              <div key={label as string}>
                <span className={`c ${on ? "on" : ""}`} />
                {label}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
  if (full)
    return (
      <div className="viv-page">
        <h2>Your 3-Month Journey</h2>
        <p className="psub">Every milestone from consultation to results.</p>
        <div className="viv-card" style={{ marginTop: 16 }}>{body}</div>
      </div>
    );
  return (
    <div className="viv-card viv-journey">
      <div className="viv-h">
        <Icon d="chart" size={17} stroke="#18555c" />
        Your 3-Month Journey
        <span className="see" style={{ borderBottom: "1px solid currentColor", paddingBottom: 1 }} onClick={() => nav("/patient/vivara/timeline")}>
          View full timeline →
        </span>
      </div>
      {body}
    </div>
  );
}

/* ------------------------------------------------------------- other tabs */
function VivaraToday() {
  const { data: garden, setData } = useLoad(() => api.getGarden());
  return (
    <div className="viv-page">
      <h2>Today</h2>
      <p className="psub">Day 12 of 90 — your daily actions.</p>
      <div className="viv-card" style={{ marginTop: 16, maxWidth: 560 }}>
        {garden?.tasks.map((t) => (
          <Check
            key={t.id}
            checked={t.done}
            onChange={async () => setData({ ...garden, tasks: await api.toggleGardenTask(t.id) })}
            meta={t.sub}
          >
            {t.label}
          </Check>
        ))}
      </div>
    </div>
  );
}

function VivaraPhotos() {
  const toast = useToast();
  return (
    <div className="viv-page">
      <h2>Photos</h2>
      <p className="psub">Track your progress over the plan.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 220px)", gap: 14, marginTop: 16 }}>
        {[
          ["/assets/skin-before-1.png", "Before · 12 Sep 2025"],
          ["/assets/skin-progress-2.png", "After Session 1 · 18 Sep 2025"],
          ["/assets/skin-after-1.png", "Latest · today"],
        ].map(([src, lb]) => (
          <div key={lb}>
            <img src={src} alt={lb} style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 12 }} />
            <div style={{ fontSize: 12, color: "#8b8f99", marginTop: 5 }}>{lb}</div>
          </div>
        ))}
      </div>
      <button type="button" className="btn" style={{ marginTop: 18 }} onClick={() => toast("Photo upload is mocked in this demo")}>
        <Icon d="up" size={15} /> Add photo
      </button>
    </div>
  );
}

function VivaraMessages() {
  const toast = useToast();
  const { data: msgs, setData } = useLoad<Msg[]>(() => api.getThread("patient-clinic"));
  const [text, setText] = useState("");
  async function send() {
    setData(await api.sendMessage("patient-clinic", "patient", "Emma Carter", text.trim()));
    setText("");
    toast("Message sent");
  }
  return (
    <div className="viv-page">
      <h2>Messages</h2>
      <p className="psub">Your conversation with the Vivara care team.</p>
      <div className="lum-msgs" style={{ marginTop: 16 }}>
        {msgs?.map((m) => (
          <div key={m.id} className={`lum-msg ${m.from}`} style={m.from === "patient" ? { background: "#e2efe9", color: "#123f3d" } : undefined}>
            {m.text}
            <small>
              {m.author} · {m.at}
            </small>
          </div>
        ))}
      </div>
      <div className="lum-compose">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message your care team…" onKeyDown={(e) => e.key === "Enter" && text.trim() && send()} />
        <button type="button" className="btn deep" style={{ background: "#18555c", borderColor: "#18555c" }} disabled={!text.trim()} onClick={send}>
          Send
        </button>
      </div>
    </div>
  );
}
