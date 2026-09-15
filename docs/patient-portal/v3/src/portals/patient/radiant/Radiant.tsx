import { useState } from "react";
import { NavLink, useParams } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { Check, Ring, Toggle } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import { useLoad } from "../../../hooks";
import { api } from "../../../mock/api";
import "../../../styles/radiant.css";

const NAV = [
  { id: "overview", label: "Overview", icon: "home" },
  { id: "plan", label: "Skin Plan & Journey", icon: "plan" },
  { id: "appointments", label: "Appointments", icon: "cal" },
  { id: "results", label: "Results & Labs", icon: "task" },
  { id: "photos", label: "Photos", icon: "photo" },
  { id: "routine", label: "Skincare Routine", icon: "drop" },
  { id: "messages", label: "Messages", icon: "msg" },
  { id: "billing", label: "Billing & Insurance", icon: "bill" },
  { id: "settings", label: "Settings", icon: "gear" },
] as const;

const MILESTONES = [
  { id: "m1", cls: "", ck: "✓", title: "Session 1 Complete", sub: "Apr 2, 2024", note: "Completed 2 Apr — great healing, no adverse reactions." },
  { id: "m2", cls: "", ck: "✓", title: "Skincare Routine Active", sub: "Ongoing", note: "AM/PM routine active since 5 Apr — adherence 80% this month." },
  { id: "m3", cls: "due", ck: "!", title: "Blood Test Due", sub: "Apr 18, 2024", note: "Book with your GP or a partner lab, then upload the result." },
  { id: "m4", cls: "lock", ck: "🔒", title: "Session 2 Upcoming", sub: "", note: "Unlocks once your blood test is reviewed. Booked for May 6." },
  { id: "m5", cls: "lock", ck: "🔒", title: "Follow-up Assessment", sub: "", note: "Scheduled after Session 2 to review your progress." },
  { id: "m6", cls: "lock", ck: "🔒", title: "Long-Term Glow", sub: "", note: "Maintenance plan begins when your treatment plan completes." },
];

export function RadiantPortal() {
  const { page = "overview" } = useParams();
  const toast = useToast();
  const [view, setView] = useState<"garden" | "clinical">("garden");
  const [artwork, setArtwork] = useState(true);
  const [milestoneNote, setMilestoneNote] = useState<string | null>(null);
  const { data: garden, setData: setGarden } = useLoad(() => api.getGarden());
  const { data: sliders } = useLoad(() => api.getSliders());
  void sliders;

  const doneTasks = garden?.tasks.filter((t) => t.done).length ?? 0;
  const milestonePct = 50;
  const adherencePct = Math.round((((garden?.routine.am ?? 5) + (garden?.routine.pm ?? 4)) / 14) * 100 / 10) * 10 + 10;

  return (
    <div className="rad-root">
      <aside className="rad-side">
        <div className="rad-logo">
          <span className="lf">❦</span>
          <div>
            <b>Radiant Health</b>
            <small>SKIN · SCIENCE · YOU</small>
          </div>
        </div>
        <nav className="rad-nav">
          {NAV.map((n) => (
            <NavLink key={n.id} to={n.id === "overview" ? "/patient/radiant" : `/patient/radiant/${n.id}`} className={page === n.id ? "on" : ""} end>
              <Icon d={n.icon} size={16} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="rad-bloom">
          A healthier
          <br />
          brighter you
          <br />
          blooms here.
        </div>
        <div className="rad-foot">Care today. A brighter tomorrow. ♡</div>
      </aside>
      <div className="rad-main">
        <div className="rad-top">
          <div className="tl">
            <button type="button" className="on">My Plan</button>
            <button type="button" onClick={() => toast("Appointments live in the sidebar — Appointments")}>Appointments</button>
            <button type="button" onClick={() => toast("Results live in the sidebar — Results & Labs")}>Results</button>
            <button type="button" onClick={() => toast("Resources: aftercare guides and FAQs (mocked)")}>Resources</button>
            <button type="button" onClick={() => toast("Messages live in the sidebar — Messages")}>Messages</button>
          </div>
          <div className="search">
            ⌕ <input placeholder="Search…" onKeyDown={(e) => e.key === "Enter" && toast(`No results for "${(e.target as HTMLInputElement).value}" (search is mocked)`)} />
          </div>
          <button type="button" style={{ color: "#7b877f" }} aria-label="Notifications" onClick={() => toast("1 notification: blood test due Apr 18")}>
            <Icon d="bell" size={17} />
          </button>
          <div className="hi" onClick={() => toast("Signed in as Alex (patient demo account)")}>
            <img src="/assets/avatar-alex.png" alt="" />
            Hi, Alex <span style={{ color: "#9aa69f" }}>▾</span>
          </div>
        </div>

        {page !== "overview" ? (
          <RadiantSecondary page={page} />
        ) : (
          <>
            <div className="rad-head">
              <div>
                <div className="eb">YOUR PERSONALIZED JOURNEY</div>
                <h1>Skin Plan &amp; Journey – {view === "garden" ? "Glow Garden View" : "Clinical View"}</h1>
                <div className="sub">Real progress. A healthier, brighter you. ♡</div>
              </div>
              <div className="rad-toggle">
                <div className="grp">
                  <button type="button" className={view === "garden" ? "on" : ""} onClick={() => setView("garden")}>
                    Glow Garden View
                  </button>
                  <button type="button" className={view === "clinical" ? "on" : ""} onClick={() => setView("clinical")}>
                    Clinical View
                  </button>
                </div>
                <button type="button" className={`ghost ${!artwork ? "active" : ""}`} onClick={() => setArtwork(!artwork)}>
                  ⛅ {artwork ? "Hide artwork layer" : "Show artwork layer"}
                </button>
              </div>
            </div>

            {view === "garden" ? (
              <div className={`rad-garden ${artwork ? "" : "noart"}`}>
                {artwork && <img src="/assets/garden-hero.png" alt="" />}
                <div className="q1 caveat">
                  Progress
                  <br />
                  looks good
                  <br />
                  on you ♡
                </div>
                <div className="q2">
                  “Healthy skin is a journey,
                  <br />
                  not a destination.”
                </div>
                <div className="rad-phase" style={{ left: "17%" }}>
                  <b>1. FOUNDATION</b>Build the right conditions for healthy skin
                </div>
                <div className="rad-phase" style={{ left: "44%" }}>
                  <b>2. SUPPORT</b>Nourish, monitor and stay consistent
                </div>
                <div className="rad-phase" style={{ left: "70%" }}>
                  <b>3. RESULTS</b>See and feel your progress
                </div>
                {artwork && (
                  <div className="rad-sign">
                    Brighter
                    <br />
                    Healthier
                    <br />
                    Happier
                    <br />
                    You
                  </div>
                )}
                <div className="rad-mstones">
                  {MILESTONES.map((m) => (
                    <button key={m.id} type="button" className={`rad-ms ${m.cls}`} onClick={() => setMilestoneNote(milestoneNote === m.id ? null : m.id)}>
                      <span className="ck">{m.ck}</span>
                      <b>{m.title}</b>
                      {milestoneNote === m.id ? <small style={{ display: "block", maxWidth: 150 }}>{m.note}</small> : m.sub && <small>{m.sub}</small>}
                    </button>
                  ))}
                </div>
                <div className="cap">Small steps. Lasting radiance.</div>
              </div>
            ) : (
              <div className="rad-clinical">
                <h4>Treatment plan — clinical timeline</h4>
                {MILESTONES.map((m) => (
                  <div key={m.id} className="rad-clin-row">
                    <span
                      className="st"
                      style={{
                        background: m.cls === "" ? "#2f7d5f" : m.cls === "due" ? "#f3e3c2" : "#e5e5dd",
                        color: m.cls === "" ? "#fff" : m.cls === "due" ? "#8a6a22" : "#8b8f88",
                      }}
                    >
                      {m.cls === "" ? "✓" : m.cls === "due" ? "!" : "•"}
                    </span>
                    <span>
                      <b style={{ fontSize: 12.8 }}>{m.title}</b>
                      <span style={{ display: "block", color: "#8b958f", fontSize: 11.5 }}>{m.note}</span>
                    </span>
                    <span className="d">{m.sub || (m.cls === "lock" ? "Locked" : "")}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="rad-mid">
              <div className="rad-card">
                <h4>
                  <Icon d="task" size={15} />
                  Today's garden tasks<span className="r">{(garden?.tasks.length ?? 4) - doneTasks} open</span>
                </h4>
                {garden?.tasks.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`rad-task ${t.done ? "hl" : ""}`}
                    onClick={async () => setGarden({ ...garden, tasks: await api.toggleGardenTask(t.id) })}
                  >
                    <Icon d={t.id === "g1" ? "drop" : t.id === "g2" ? "sun" : t.id === "g3" ? "up" : "trend"} size={14} />
                    <span>
                      <b>{t.label}</b>
                      <small>{t.sub}</small>
                    </span>
                    <span className={`o ${t.done ? "on" : ""}`} />
                  </button>
                ))}
                <button
                  type="button"
                  className="rad-mark"
                  disabled={garden?.dayComplete}
                  onClick={async () => {
                    const res = await api.markDayComplete();
                    setGarden({ ...garden!, ...res, notifs: garden!.notifs });
                    toast("Day marked complete — your garden grows 🌱");
                  }}
                >
                  <Icon d="check" size={13} stroke="#fff" /> {garden?.dayComplete ? "Day complete ✓" : "Mark day complete"}
                </button>
              </div>
              <div className="rad-card">
                <h4>
                  <Icon d="chart" size={15} />
                  Progress this month<span className="r">Apr 2024</span>
                </h4>
                <div className="rad-rings">
                  <div className="rad-ring">
                    <Ring pct={milestonePct} size={74} strokeWidth={7} color="#2f7d5f" ink="#22303a" fontSize={14.5} />
                    <div className="lb">Plan milestones</div>
                    <small>1 of 2 complete</small>
                  </div>
                  <div className="rad-ring">
                    <Ring pct={adherencePct} size={74} strokeWidth={7} color="#2f7d5f" ink="#22303a" fontSize={14.5} />
                    <div className="lb">Routine adherence</div>
                    <small>
                      {garden ? garden.routine.am + garden.routine.pm + 15 : 24} of 30 days
                    </small>
                  </div>
                  <div className="rad-ring">
                    <Ring pct={garden?.dayComplete ? 100 : 0} size={74} strokeWidth={7} color="#2f7d5f" ink="#22303a" fontSize={14.5} label={garden?.dayComplete ? "1/1" : "0%"} />
                    <div className="lb">Lab results</div>
                    <small>{garden?.dayComplete ? "1 of 1 uploaded" : "0 of 1 uploaded"}</small>
                  </div>
                </div>
                <div className="rad-quote">“Consistency today creates your tomorrow glow.” ❧</div>
              </div>
              <div className="rad-card">
                <h4>
                  <Icon d="cal" size={15} />
                  Next treatment prep<span className="r">Session 2 · May 6, 2024</span>
                </h4>
                <PrepList />
                <button type="button" className="rad-preplink" onClick={() => toast("Full prep guide: stop actives 3 days before, arrive with clean skin, hydrate well")}>
                  View full prep guide →
                </button>
              </div>
            </div>

            <RadiantBottom garden={garden} setGarden={setGarden} />
          </>
        )}
      </div>
    </div>
  );
}

function PrepList() {
  const [items, setItems] = useState([
    { id: "1", label: "Complete blood test (due Apr 18)", hl: true, done: false },
    { id: "2", label: "Continue skincare routine", hl: false, done: false },
    { id: "3", label: "Avoid active exfoliants 3 days before", hl: false, done: false },
    { id: "4", label: "Stay hydrated", hl: false, done: false },
    { id: "5", label: "Log any skin changes", hl: false, done: false },
  ]);
  return (
    <>
      {items.map((i) => (
        <button key={i.id} type="button" className={`rad-prep ${i.hl && !i.done ? "hl" : ""}`} onClick={() => setItems(items.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x)))}>
          <span className={`o ${i.done ? "on" : ""}`} />
          <span style={i.done ? { textDecoration: "line-through", color: "#9aa69f" } : undefined}>{i.label}</span>
        </button>
      ))}
    </>
  );
}

function RadiantBottom({
  garden,
  setGarden,
}: {
  garden: Awaited<ReturnType<typeof api.getGarden>> | null;
  setGarden: (g: Awaited<ReturnType<typeof api.getGarden>>) => void;
}) {
  const toast = useToast();
  const [month, setMonth] = useState(3); // 0-indexed April
  const [selDay, setSelDay] = useState(18);
  const [reply, setReply] = useState("");
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const days = new Date(2024, month + 1, 0).getDate();
  const firstDow = (new Date(2024, month, 1).getDay() + 6) % 7;
  const cells: Array<number | null> = [...Array(firstDow).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);

  return (
    <div className="rad-bot">
      <div className="rad-card">
        <h4>
          <Icon d="cal" size={15} />
          Calendar
          <span className="r">
            <button type="button" onClick={() => setMonth((m) => Math.max(0, m - 1))} style={{ padding: "0 4px" }}>‹</button>
            <button type="button" onClick={() => setMonth((m) => Math.min(11, m + 1))} style={{ padding: "0 4px" }}>›</button>
          </span>
        </h4>
        <div style={{ fontSize: 10.5, fontWeight: 700, marginTop: 5, color: "#42504a" }}>{MONTHS[month]} 2024</div>
        <table className="rad-cal">
          <thead>
            <tr>{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <th key={d}>{d}</th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: cells.length / 7 }, (_, r) => (
              <tr key={r}>
                {cells.slice(r * 7, r * 7 + 7).map((d, c) => (
                  <td
                    key={c}
                    className={d === selDay && month === 3 ? "sel" : ""}
                    onClick={() => d && (setSelDay(d), toast(d === 18 && month === 3 ? "Apr 18 — blood test due" : `No events on ${d} ${MONTHS[month].slice(0, 3)}`))}
                  >
                    {d ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rad-card">
        <h4>
          <Icon d="photo" size={15} />
          Progress photos<span className="r" onClick={() => toast("Photo gallery is mocked — 2 photos so far")}>See all →</span>
        </h4>
        <div className="rad-photos">
          <div className="ph">
            <img src="/assets/skin-before-1.png" alt="" />
            <div className="lb">Mar 1<br />Before</div>
          </div>
          <div className="ph">
            <img src="/assets/skin-progress-2.png" alt="" />
            <div className="lb">Apr 2<br />After Session 1</div>
          </div>
          <button type="button" className="add" onClick={() => toast("Photo upload is mocked in this demo")} aria-label="Add photo">
            +
          </button>
        </div>
        <div style={{ fontSize: 9.5, color: "#8b958f", marginTop: 4 }}>Add photos</div>
      </div>
      <div className="rad-card">
        <h4>
          <Icon d="msg" size={15} />
          Message from your practitioner<span className="r">Apr 4, 2024</span>
        </h4>
        <div className="rad-msg">
          <img src="/assets/avatar-chen.png" alt="" />
          <div>
            <b>Dr. Emily Chen</b>
            <small>Dermatologist</small>
            <p>
              Your skin is responding beautifully! Keep up with your routine, and don't forget to upload your blood test results when available. We're on track for great
              progress. 💚
            </p>
          </div>
        </div>
        <div className="rad-reply">
          <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to Dr. Chen…" onKeyDown={(e) => e.key === "Enter" && reply.trim() && send()} />
          <button type="button" className="btn sm deep" style={{ background: "#245d63", borderColor: "#245d63" }} disabled={!reply.trim()} onClick={send}>
            Send
          </button>
        </div>
      </div>
      <div className="rad-card">
        <h4>
          <Icon d="drop" size={15} />
          Your skincare routine<span className="r" onClick={() => toast("Routine management is mocked")}>Manage →</span>
        </h4>
        {[
          ["🧴", "Cleanser", "AM / PM"],
          ["💧", "Vitamin C Serum", "AM"],
          ["🫧", "Moisturiser", "AM / PM"],
          ["☀️", "SPF 50", "AM"],
        ].map(([ic, name, when]) => (
          <div key={name} className="rad-rout">
            <span className="ic">{ic}</span>
            <span>
              {name}
              <small>{when}</small>
            </span>
          </div>
        ))}
      </div>
      <div className="rad-card">
        <h4>
          <Icon d="bell" size={15} />
          Notification settings<span className="r" onClick={() => toast("These switches persist — try toggling one and reloading")}>Manage →</span>
        </h4>
        {garden?.notifs.map((n) => (
          <div key={n.id} className="rad-not">
            {n.label}
            <Toggle
              on={n.on}
              label={n.label}
              onChange={async () => {
                const notifs = await api.toggleNotif(n.id);
                setGarden({ ...garden, notifs });
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );

  async function send() {
    await api.sendMessage("patient-clinic", "patient", "Alex", reply.trim());
    setReply("");
    toast("Reply sent to Dr. Chen");
  }
}

function RadiantSecondary({ page }: { page: string }) {
  const toast = useToast();
  const { data: garden, setData } = useLoad(() => api.getGarden());
  if (page === "routine")
    return (
      <div className="rad-page">
        <h1>Skincare Routine</h1>
        <p className="psub">Your prescribed products, morning and night.</p>
        <div className="rad-card" style={{ marginTop: 16, maxWidth: 520 }}>
          {[
            ["🧴", "Gentle Cleanser", "AM / PM — massage for 60 seconds"],
            ["💧", "Vitamin C Serum", "AM — 3 drops on dry skin"],
            ["🫧", "Ceramide Moisturiser", "AM / PM"],
            ["☀️", "SPF 50", "AM — reapply at lunch"],
          ].map(([ic, name, when]) => (
            <div key={name} className="rad-rout">
              <span className="ic">{ic}</span>
              <span>
                {name}
                <small>{when}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  if (page === "settings")
    return (
      <div className="rad-page">
        <h1>Settings</h1>
        <p className="psub">Notification preferences — changes persist.</p>
        <div className="rad-card" style={{ marginTop: 16, maxWidth: 520 }}>
          {garden?.notifs.map((n) => (
            <div key={n.id} className="rad-not">
              {n.label}
              <Toggle on={n.on} label={n.label} onChange={async () => setData({ ...garden, notifs: await api.toggleNotif(n.id) })} />
            </div>
          ))}
        </div>
      </div>
    );
  return (
    <div className="rad-page">
      <h1>{page[0].toUpperCase() + page.slice(1).replace(/-/g, " ")}</h1>
      <p className="psub">This section is a functional placeholder in the v3 demo.</p>
      <div className="rad-card" style={{ marginTop: 16, maxWidth: 560 }}>
        {page === "appointments" &&
          [
            ["Microneedling Session 2", "May 6, 2024 · 10:00 · Dr. Emily Chen"],
            ["Follow-up Assessment", "May 20, 2024 · 14:30 · Dr. Emily Chen"],
            ["Microneedling Session 1", "Apr 2, 2024 · Completed"],
          ].map(([t, s]) => (
            <div key={t} className="rad-clin-row">
              <span className="st" style={{ background: "#e5eff0", color: "#245d63" }}>
                <Icon d="cal" size={12} />
              </span>
              <span>
                <b style={{ fontSize: 12.8 }}>{t}</b>
                <span style={{ display: "block", color: "#8b958f", fontSize: 11.5 }}>{s}</span>
              </span>
            </div>
          ))}
        {page === "results" && (
          <>
            <div className="rad-clin-row">
              <span className="st" style={{ background: "#fdf3e4", color: "#8a6a22" }}>!</span>
              <span>
                <b style={{ fontSize: 12.8 }}>B12 blood test</b>
                <span style={{ display: "block", color: "#8b958f", fontSize: 11.5 }}>Due Apr 18, 2024 — book with your GP or a partner lab</span>
              </span>
              <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={() => toast("Upload is mocked — use the garden task on Overview")}>
                Upload
              </button>
            </div>
            <div className="rad-clin-row">
              <span className="st" style={{ background: "#2f7d5f", color: "#fff" }}>✓</span>
              <span>
                <b style={{ fontSize: 12.8 }}>Baseline skin assessment</b>
                <span style={{ display: "block", color: "#8b958f", fontSize: 11.5 }}>Completed Mar 1, 2024</span>
              </span>
            </div>
          </>
        )}
        {page === "photos" && (
          <div className="rad-photos" style={{ marginTop: 0 }}>
            <div className="ph">
              <img src="/assets/skin-before-1.png" alt="" style={{ height: 120 }} />
              <div className="lb">Mar 1 · Before</div>
            </div>
            <div className="ph">
              <img src="/assets/skin-progress-2.png" alt="" style={{ height: 120 }} />
              <div className="lb">Apr 2 · After Session 1</div>
            </div>
            <button type="button" className="add" style={{ height: 120 }} onClick={() => toast("Photo upload is mocked")}>
              +
            </button>
          </div>
        )}
        {page === "messages" && <p style={{ fontSize: 13, color: "#5b6862" }}>Use the practitioner card on the Overview page to send Dr. Chen a reply.</p>}
        {page === "billing" && (
          <>
            {[
              ["INV-311 · Microneedling Plan (3 sessions)", "£885.00 · Paid Mar 1"],
              ["INV-322 · Skincare starter kit", "£64.00 · Paid Apr 5"],
            ].map(([t, s]) => (
              <div key={t} className="rad-clin-row">
                <span className="st" style={{ background: "#e5eff0", color: "#245d63" }}>
                  <Icon d="bill" size={12} />
                </span>
                <span>
                  <b style={{ fontSize: 12.8 }}>{t}</b>
                  <span style={{ display: "block", color: "#8b958f", fontSize: 11.5 }}>{s}</span>
                </span>
              </div>
            ))}
          </>
        )}
        {page === "plan" && <p style={{ fontSize: 13, color: "#5b6862" }}>Your full plan lives on the Overview page — switch between Glow Garden and Clinical views there.</p>}
      </div>
    </div>
  );
}
