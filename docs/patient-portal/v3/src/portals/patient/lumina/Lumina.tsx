import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { Check, Chip, Modal, Ring, Skeleton, Toggle } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import { useLoad } from "../../../hooks";
import { api } from "../../../mock/api";
import type { Msg, PlanStep } from "../../../mock/types";
import "../../../styles/lumina.css";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "home" },
  { id: "appointments", label: "Appointments", icon: "cal" },
  { id: "plan", label: "Skin Plan & Journey", icon: "plan" },
  { id: "tasks", label: "Tasks", icon: "task" },
  { id: "photos", label: "Photos", icon: "photo" },
  { id: "messages", label: "Messages", icon: "msg", badge: 2 },
  { id: "billing", label: "Billing", icon: "bill" },
  { id: "settings", label: "Settings", icon: "gear" },
] as const;

export function LuminaPortal() {
  const { page = "plan" } = useParams();
  const toast = useToast();

  return (
    <div className="lum-root">
      <aside className="lum-side">
        <div className="lum-logo">
          LUMINA<small>SKIN&nbsp;CLINIC</small>
        </div>
        <nav className="lum-nav">
          {NAV.map((n) => (
            <NavLink key={n.id} to={n.id === "plan" ? "/patient/lumina" : `/patient/lumina/${n.id}`} className={page === n.id ? "on" : ""} end>
              <Icon d={n.icon} size={19} />
              {n.label}
              {"badge" in n && n.badge ? <span className="badge">{n.badge}</span> : null}
            </NavLink>
          ))}
        </nav>
        <div className="lum-art">
          <img src="/assets/sidebar-lumina.png" alt="" />
          <div className="cap">
            <b>
              Healthy skin.
              <br />
              Brighter tomorrows.
            </b>
            <span>
              Expert care.
              <br />
              Real progress.
            </span>
          </div>
        </div>
      </aside>
      <div className="lum-main">
        <div className="lum-top">
          <div>
            <h2>Patient Portal</h2>
            <p>Your skin journey, our support. Real progress, together.</p>
          </div>
          <div className="script caveat">
            Confident skin
            <br />
            brighter you
          </div>
          <button type="button" className="bell" onClick={() => toast("2 notifications: blood test due 22 Sep · message from Dr Reeves")} aria-label="Notifications">
            <Icon d="bell" size={21} />
          </button>
          <div className="lum-user" onClick={() => toast("Signed in as Emma Carter (patient demo account)")}>
            <img src="/assets/avatar-emma.png" alt="" />
            <div>
              <b>Emma Carter</b>
              <small>Patient</small>
            </div>
            <span style={{ color: "#aab3c2" }}>▾</span>
          </div>
        </div>
        {page === "plan" ? <LuminaPlan /> : <LuminaSecondary page={page} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ main screen */
function LuminaPlan() {
  const toast = useToast();
  const { data: steps, setData: setSteps, loading } = useLoad(() => api.getPlan());
  const { data: focus, setData: setFocus } = useLoad(() => api.getFocus());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [upload, setUpload] = useState(false);
  const [compose, setCompose] = useState(false);
  const [calendar, setCalendar] = useState(false);

  // Default the drawer to the current step once the plan loads.
  useEffect(() => {
    if (steps && !selectedId) setSelectedId(steps.find((s) => s.status === "current")?.id ?? steps[0].id);
  }, [steps, selectedId]);

  const selected = steps?.find((s) => s.id === selectedId) ?? null;
  const doneCount = steps?.filter((s) => s.status === "done").length ?? 0;
  const total = steps?.length ?? 14;
  const pct = Math.round((doneCount / total) * 100);
  const monthMeta = [
    { label: "Month 1", title: "Foundation", desc: "Assess, plan and prepare your skin for the best results." },
    { label: "Month 2", title: "Build & Support", desc: "Continue treatment, support skin health and monitor progress." },
    { label: "Month 3", title: "Results & Confidence", desc: "Complete your treatment plan and review your results." },
  ];
  const monthDone = (m: number) => steps?.filter((s) => s.month === m && s.status === "done").length ?? 0;
  const monthTotal = (m: number) => steps?.filter((s) => s.month === m).length ?? 0;

  const nextAppt = steps?.find((s) => s.title === "Microneedling Session 2");

  async function toggleChecklist(item: string) {
    if (!selected) return;
    const updated = await api.toggleStepChecklist(selected.id, item);
    setSteps(steps!.map((s) => (s.id === updated.id ? updated : s)));
  }

  async function markComplete() {
    if (!selected) return;
    const updated = await api.completeStep(selected.id);
    setSteps(updated);
    toast(`"${selected.title}" marked complete`);
  }

  return (
    <>
      <div className="lum-band">
        <div>
          <h1>3-Month Microneedling Plan</h1>
          <div className="sub">
            Smoother texture. Brighter tone. <b>A calmer, healthier you.</b>
          </div>
        </div>
        <div className="lum-ring">
          <Ring pct={pct} size={86} strokeWidth={9} color="#0b635c" label={`${pct}%`} fontSize={18} />
          <div className="meta">
            <b>Plan progress</b>
            <span>
              {doneCount} of {total} milestones complete
            </span>
            <div className="bar">
              <i style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>
        <div className="lum-quote">
          <div className="q">
            “Progress,
            <br />
            not perfection.”
          </div>
          <div className="a">— Dr. A. Reeves</div>
        </div>
      </div>
      <div className="lum-cards">
        <button type="button" className="lum-card" onClick={() => toast("Phase detail: Build & Support — sessions 2 of 3 booked")}>
          <span className="tile" style={{ background: "#ddf4f4", color: "#0b5355" }}>
            <Icon d="layers" size={22} />
          </span>
          <span>
            <small>Current phase</small>
            <b>Build &amp; Support</b>
            <em>Month 2 of 3</em>
          </span>
          <span className="chev">›</span>
        </button>
        <button type="button" className="lum-card" onClick={() => setCalendar(true)}>
          <span className="tile" style={{ background: "#e7f0fb", color: "#4a76b8" }}>
            <Icon d="cal" size={22} />
          </span>
          <span>
            <small>Next appointment</small>
            <b>
              Microneedling Session 2 <span style={{ color: "#0b635c" }}>in 12 days</span>
            </b>
            <em>Tue 27 Sep 2024, 10:00am</em>
          </span>
          <span className="chev">›</span>
        </button>
        <button type="button" className="lum-card" onClick={() => { document.querySelector(".lum-roadcard")?.scrollIntoView({ behavior: "smooth" }); toast(`${doneCount} of ${total} milestones complete — ${pct}% of the plan`); }}>
          <span className="tile" style={{ background: "#f9f3eb", color: "#b98a3a" }}>
            <Icon d="flag" size={22} />
          </span>
          <span>
            <small>Plan completion</small>
            <b>
              {doneCount} of {total} milestones complete
            </b>
            <em>You're {pct}% of the way there</em>
          </span>
          <span className="chev">›</span>
        </button>
      </div>
      <div className="lum-body">
        <section className="lum-roadcard">
          <div className="lum-road-head">
            <div>
              <h3>Your plan roadmap</h3>
              <p>A step-by-step guide to your treatment, care and results. Click any step for detail.</p>
            </div>
            <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={() => setCalendar(true)}>
              <Icon d="cal" size={15} /> View as calendar
            </button>
          </div>
          <div className="lum-road-grid">
            <div>
              {monthMeta.map((m, i) => (
                <div key={m.label} className="lum-month" style={i === 0 ? { borderTop: "3px solid #0b635c", marginTop: 4 } : { marginTop: 42 }}>
                  <h4>
                    <small>{m.label}</small>
                    {m.title}
                  </h4>
                  <p>{m.desc}</p>
                  <div className="prog">
                    {monthDone(i)} of {monthTotal(i)} complete
                  </div>
                  <div className="bar">
                    <i style={{ width: `${(monthDone(i) / Math.max(monthTotal(i), 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="lum-steps">
              {loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ padding: "12px 0" }}>
                    <Skeleton h={16} />
                  </div>
                ))}
              {steps?.map((s) => {
                const cls = s.status === "done" ? "done" : s.status === "current" ? "cur" : s.status === "conditional" ? "cond" : "";
                const chip = s.status === "done" ? ["done", "Completed"] : s.status === "current" ? ["cur", "Current"] : s.status === "conditional" ? ["cond", "Conditional"] : ["upc", "Upcoming"];
                return (
                  <button key={s.id} type="button" className={`lum-step ${cls} ${selectedId === s.id ? "sel" : ""}`} onClick={() => setSelectedId(s.id)}>
                    <span className="dot">{s.status === "done" || s.status === "current" ? <Icon d="check" size={12} stroke="#fff" /> : s.n}</span>
                    <b>{s.title}</b>
                    <span className="date">{s.date}</span>
                    <span className={`lum-chip ${chip[0]}`}>{chip[1]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
        <aside className="lum-drawer">
          {selected && (
            <div className="lum-detail">
              <button type="button" className="x" aria-label="Close detail" onClick={() => setSelectedId(steps?.find((s) => s.status === "current")?.id ?? null)}>
                <Icon d="x" size={15} />
              </button>
              <div className="tile">
                <Icon d={selected.id === "s7" ? "drop" : selected.status === "done" ? "check" : "plan"} size={22} />
              </div>
              <div>
                <h3>{selected.title}</h3>{" "}
                <Chip tone={selected.status === "done" ? "mint" : selected.status === "current" ? "mint" : "slate"} style={{ verticalAlign: 4, marginLeft: 6 }}>
                  ● {selected.status === "done" ? "Completed" : selected.status === "current" ? "Current" : selected.status === "conditional" ? "Conditional" : "Upcoming"}
                </Chip>
              </div>
              <p className="desc">{selected.desc}</p>
              <div className="lum-mini">
                <div>
                  <Icon d="cal" size={17} />
                  <span>
                    <small>Due date</small>
                    <b>{selected.due ?? selected.date}</b>
                  </span>
                </div>
                <div>
                  <Icon d="clock" size={17} />
                  <span>
                    <small>Status</small>
                    <b>{selected.state ?? (selected.status === "done" ? "Complete" : selected.status === "upcoming" ? "Not started" : "Pending")}</b>
                  </span>
                </div>
              </div>
              {selected.checklist && (
                <div className="lum-check">
                  <h5>
                    Checklist <span>{selected.checklist.filter((c) => c.done).length} of {selected.checklist.length} complete</span>
                  </h5>
                  {selected.checklist.map((c) => (
                    <Check key={c.id} checked={c.done} onChange={() => toggleChecklist(c.id)} meta={c.meta}>
                      {c.label}
                    </Check>
                  ))}
                </div>
              )}
              <div className="lum-btns">
                <button type="button" className="btn deep" onClick={() => setUpload(true)}>
                  <Icon d="up" size={16} /> Upload Result
                </button>
                <button type="button" className="btn" onClick={() => setCompose(true)}>
                  <Icon d="msg" size={16} /> Message Clinic
                </button>
                <button type="button" className="btn wide" style={{ borderColor: "#cddbdb", color: "#0b5355" }} disabled={selected.status === "done"} onClick={markComplete}>
                  <Icon d="check" size={15} /> {selected.status === "done" ? "Completed" : "Mark Complete"}
                </button>
              </div>
              {selected.note && (
                <div className="lum-note">
                  <span style={{ fontSize: 14 }}>ⓘ</span>
                  {selected.note}
                </div>
              )}
            </div>
          )}
          <div className="lum-focus">
            <h4>
              <span className="sun">☀</span>Today's focus<span>{focus?.length ?? 4} tasks</span>
            </h4>
            {focus?.map((t) => (
              <Check
                key={t.id}
                checked={t.done}
                onChange={async () => setFocus(await api.toggleFocus(t.id))}
              >
                {t.label}
              </Check>
            ))}
          </div>
        </aside>
      </div>

      <Modal open={upload} onClose={() => setUpload(false)} title="Upload blood test result">
        <UploadForm
          onDone={async (name) => {
            if (selected) {
              const updated = await api.uploadResult(selected.id, name);
              setSteps(steps!.map((s) => (s.id === updated.id ? updated : s)));
            }
            setUpload(false);
            toast(`Uploaded "${name}" — the clinic will review it shortly`);
          }}
        />
      </Modal>
      <Modal open={compose} onClose={() => setCompose(false)} title="Message Lumina Skin Clinic">
        <ComposeForm
          onSend={async (text) => {
            await api.sendMessage("patient-clinic", "patient", "Emma Carter", text);
            setCompose(false);
            toast("Message sent to the clinic");
          }}
        />
      </Modal>
      <Modal open={calendar} onClose={() => setCalendar(false)} title="Plan calendar" width={520}>
        {monthMeta.map((m, i) => (
          <div key={m.label} style={{ marginBottom: 14 }}>
            <b style={{ fontSize: 13.5 }}>
              {m.label} — {m.title}
            </b>
            {steps
              ?.filter((s) => s.month === i)
              .map((s) => (
                <div key={s.id} style={{ display: "flex", gap: 10, padding: "6px 0", borderBottom: "1px solid #f0f3f5", fontSize: 12.8 }}>
                  <span style={{ color: "#7d879b", width: 88, flex: "none" }}>{s.date}</span>
                  <span style={{ flex: 1 }}>{s.title}</span>
                  <Chip tone={s.status === "done" ? "mint" : s.status === "current" ? "deep" : "slate"}>{s.status}</Chip>
                </div>
              ))}
          </div>
        ))}
        {nextAppt && (
          <div className="lum-note" style={{ marginTop: 4 }}>
            <span>ⓘ</span>Next in-clinic visit: {nextAppt.title} — {nextAppt.date}, 10:00am with Dr. A. Reeves.
          </div>
        )}
      </Modal>
    </>
  );
}

function UploadForm({ onDone }: { onDone: (name: string) => void }) {
  const [name, setName] = useState("B12-results-emma-carter.pdf");
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <label className="field">
        <span>File</span>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <p style={{ fontSize: 12, color: "#7d879b", marginBottom: 12 }}>This demo mocks the upload — the file name is stored against the checklist item.</p>
      <button
        type="button"
        className="btn deep"
        disabled={busy || !name.trim()}
        onClick={async () => {
          setBusy(true);
          onDone(name.trim());
        }}
      >
        <Icon d="up" size={15} /> {busy ? "Uploading…" : "Upload"}
      </button>
    </div>
  );
}

function ComposeForm({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div>
      <label className="field">
        <span>Message</span>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask the clinic anything…" />
      </label>
      <button type="button" className="btn deep" disabled={!text.trim()} onClick={() => onSend(text.trim())}>
        Send message
      </button>
    </div>
  );
}

/* ------------------------------------------------------- secondary pages */
function LuminaSecondary({ page }: { page: string }) {
  const toast = useToast();
  const nav = useNavigate();

  if (page === "messages") return <LuminaMessages />;
  if (page === "settings") return <LuminaSettings />;
  if (page === "tasks") return <LuminaTasks />;

  if (page === "photos")
    return (
      <div className="lum-page">
        <h1>Photos</h1>
        <p className="psub">Progress photos from your microneedling plan.</p>
        <div className="lum-photos">
          {[
            ["/assets/skin-before-1.png", "12 Sep 2024 · Baseline"],
            ["/assets/skin-progress-2.png", "18 Sep 2024 · After Session 1"],
            ["/assets/skin-after-1.png", "Projected · Plan complete"],
          ].map(([src, lb]) => (
            <div key={lb}>
              <img src={src} alt={lb} />
              <div className="plb">{lb}</div>
            </div>
          ))}
        </div>
        <button type="button" className="btn" style={{ marginTop: 18 }} onClick={() => toast("Photo upload is mocked in this demo")}>
          <Icon d="up" size={15} /> Add photos
        </button>
      </div>
    );

  if (page === "appointments")
    return (
      <div className="lum-page">
        <h1>Appointments</h1>
        <p className="psub">Upcoming and past visits at Lumina Skin Clinic.</p>
        <div className="lum-list">
          {[
            ["Microneedling Session 2", "Tue 27 Sep 2024 · 10:00am · Dr. A. Reeves", "upc", "Upcoming"],
            ["Microneedling Session 3", "Fri 25 Oct 2024 · 10:00am · Dr. A. Reeves", "upc", "Scheduled"],
            ["Microneedling Session 1", "Sun 15 Sep 2024 · 10:00am · Dr. A. Reeves", "done", "Completed"],
            ["Consultation & Skin Assessment", "Thu 5 Sep 2024 · 2:30pm · Dr. A. Reeves", "done", "Completed"],
          ].map(([t, sub, tone, lb]) => (
            <div key={t as string} className="lum-listrow">
              <span className="tile">
                <Icon d="cal" size={18} />
              </span>
              <span>
                <b>{t}</b>
                <small>{sub}</small>
              </span>
              <span className="right">
                <span className={`lum-chip ${tone}`}>{lb}</span>
                <button type="button" className="btn sm" onClick={() => toast(`Rescheduling "${t}" — the clinic will confirm by message`)}>
                  Reschedule
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>
    );

  if (page === "billing")
    return (
      <div className="lum-page">
        <h1>Billing</h1>
        <p className="psub">Invoices and payments for your treatment plan.</p>
        <div className="lum-list">
          {[
            ["INV-2041 · Microneedling Session 2", "Due 27 Sep 2024 · £295.00", false],
            ["INV-2032 · Microneedling Session 1", "Paid 15 Sep 2024 · £295.00", true],
            ["INV-2019 · Consultation", "Paid 5 Sep 2024 · £60.00", true],
          ].map(([t, sub, paid]) => (
            <div key={t as string} className="lum-listrow">
              <span className="tile">
                <Icon d="bill" size={18} />
              </span>
              <span>
                <b>{t}</b>
                <small>{sub}</small>
              </span>
              <span className="right">
                {paid ? (
                  <span className="lum-chip done">Paid</span>
                ) : (
                  <button type="button" className="btn sm deep" onClick={() => toast("Payment flow is mocked — invoice marked for payment")}>
                    Pay now
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>
    );

  // dashboard (default for unknown)
  return (
    <div className="lum-page">
      <h1>Welcome back, Emma</h1>
      <p className="psub">Here's where your plan stands today.</p>
      <div className="lum-list">
        <div className="lum-listrow">
          <span className="tile">
            <Icon d="plan" size={18} />
          </span>
          <span>
            <b>3-Month Microneedling Plan</b>
            <small>Month 2 of 3 · Blood Test Check is your current step</small>
          </span>
          <span className="right">
            <button type="button" className="btn sm deep" onClick={() => nav("/patient/lumina")}>
              Open plan
            </button>
          </span>
        </div>
        <div className="lum-listrow">
          <span className="tile">
            <Icon d="cal" size={18} />
          </span>
          <span>
            <b>Next appointment</b>
            <small>Microneedling Session 2 · Tue 27 Sep 2024, 10:00am</small>
          </span>
          <span className="right">
            <button type="button" className="btn sm" onClick={() => nav("/patient/lumina/appointments")}>
              View
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

function LuminaTasks() {
  const { data: focus, setData } = useLoad(() => api.getFocus());
  return (
    <div className="lum-page">
      <h1>Tasks</h1>
      <p className="psub">Daily skin health tasks from your plan.</p>
      <div className="panel" style={{ marginTop: 18, maxWidth: 520 }}>
        {focus?.map((t) => (
          <Check key={t.id} checked={t.done} onChange={async () => setData(await api.toggleFocus(t.id))}>
            {t.label}
          </Check>
        ))}
      </div>
    </div>
  );
}

function LuminaMessages() {
  const toast = useToast();
  const { data: msgs, setData } = useLoad<Msg[]>(() => api.getThread("patient-clinic"));
  const [text, setText] = useState("");
  return (
    <div className="lum-page">
      <h1>Messages</h1>
      <p className="psub">Private messages with Lumina Skin Clinic.</p>
      <div className="lum-msgs">
        {msgs?.length === 0 && <div className="empty-note">No messages yet — say hello below.</div>}
        {msgs?.map((m) => (
          <div key={m.id} className={`lum-msg ${m.from}`}>
            {m.text}
            <small>
              {m.author} · {m.at}
            </small>
          </div>
        ))}
      </div>
      <div className="lum-compose">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Message the clinic…" onKeyDown={(e) => e.key === "Enter" && text.trim() && send()} />
        <button type="button" className="btn deep" disabled={!text.trim()} onClick={send}>
          Send
        </button>
      </div>
    </div>
  );

  async function send() {
    const updated = await api.sendMessage("patient-clinic", "patient", "Emma Carter", text.trim());
    setData(updated);
    setText("");
    toast("Message sent");
  }
}

function LuminaSettings() {
  const { data: prefs, setData } = useLoad(() => api.getPrefs());
  const rows: Array<[keyof NonNullable<typeof prefs>, string, string]> = [
    ["reminders", "Appointment reminders", "Visit confirmations and recall reminders by email or text."],
    ["marketingEmail", "Marketing by email", "Offers and news from the clinic."],
    ["marketingText", "Marketing by text", "Also needs the marketing switch on."],
  ];
  return (
    <div className="lum-page">
      <h1>Settings</h1>
      <p className="psub">Contact preferences for Emma Carter.</p>
      <div className="panel" style={{ marginTop: 18, maxWidth: 560 }}>
        {prefs &&
          rows.map(([key, label, sub]) => (
            <div key={key} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid #f0f3f5" }}>
              <span>
                <b style={{ fontSize: 13.5, display: "block" }}>{label}</b>
                <small style={{ color: "#7d879b", fontSize: 12 }}>{sub}</small>
              </span>
              <span style={{ marginLeft: "auto" }}>
                <Toggle on={prefs[key]} label={label} onChange={async (v) => setData(await api.setPref(key, v))} />
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
