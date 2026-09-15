import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { Chip } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import { useLoad } from "../../../hooks";
import { api } from "../../../mock/api";

const fmtTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function PastelOverview() {
  const toast = useToast();
  const nav = useNavigate();
  const [range, setRange] = useState<"Day" | "Week" | "Month">("Day");
  const { data: appts } = useLoad(() => api.getDiary(0));
  const { data: tasks, setData: setTasks } = useLoad(() => api.getContactTasks());
  const { data: practs } = useLoad(() => api.getPractitioners());
  const [notes, setNotes] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState("11:24");
  useLoad(async () => {
    const n = await api.getNotes();
    if (notes === null) setNotes(n.myNotes.map((x) => `•  ${x}`).join("\n"));
    return n;
  });

  const shown = (appts ?? []).slice(0, 4);

  return (
    <>
      <div className="cp-h1row">
        <div>
          <h1>Clinic overview</h1>
          <div className="sub">Live picture of today's diary, what needs attention and clinic performance.</div>
        </div>
        <div className="cp-right">
          <button type="button" className="btn" onClick={() => toast("Date picker is mocked — showing Sunday 13 September 2026")}>
            <Icon d="cal" size={15} />
            Sunday 13 September 2026 ▾
          </button>
          <div className="cp-seg">
            {(["Day", "Week", "Month"] as const).map((r) => (
              <button key={r} type="button" className={range === r ? "on" : ""} onClick={() => { setRange(r); if (r !== "Day") toast(`${r} view is mocked — Day shows the live diary`); }}>
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="cp-stats">
        <button type="button" className="cp-stat" onClick={() => nav("/clinic/pastel/retention")}>
          <span className="chev">›</span>
          <span className="ic" style={{ background: "var(--mint)", color: "var(--mintink)" }}>
            <Icon d="users" size={18} />
          </span>
          <small>Retention rate</small>
          <div className="v">72%</div>
          <div className="chips">
            <span className="cp-uch up">↗ 31%</span>
            <span className="cp-uch mut">vs. previous 12 months</span>
          </div>
        </button>
        <button type="button" className="cp-stat" onClick={() => nav("/clinic/pastel/patients")}>
          <span className="chev">›</span>
          <span className="ic" style={{ background: "var(--mint)", color: "var(--mintink)" }}>
            <Icon d="users" size={18} />
          </span>
          <small>Total clients</small>
          <div className="v">633</div>
          <div className="chips">
            <span className="cp-uch dn">↓ 68%</span>
            <span className="cp-uch mut">618 active · 15 inactive</span>
          </div>
        </button>
        <button type="button" className="cp-stat" onClick={() => nav("/clinic/pastel/patients")}>
          <span className="chev">›</span>
          <span className="ic" style={{ background: "var(--blue)", color: "var(--blueink)" }}>
            <Icon d="cal" size={18} />
          </span>
          <small>Treatments due</small>
          <div className="v">1303</div>
          <div className="chips">
            <span className="cp-uch dn" style={{ background: "var(--pink)" }}>150 due</span>
            <span className="cp-uch dn">1153 overdue</span>
          </div>
        </button>
        <button type="button" className="cp-stat" onClick={() => nav("/clinic/pastel/performance")}>
          <span className="chev">›</span>
          <span className="ic" style={{ background: "var(--pink)", color: "var(--pinkink)" }}>
            <Icon d="chart" size={18} />
          </span>
          <small>Revenue this month</small>
          <div className="v">£31,925</div>
          <div className="chips">
            <span className="cp-uch dn">↓ 64%</span>
            <span className="cp-uch mut">123 treatments delivered</span>
          </div>
        </button>
      </div>

      <div className="cp-panel" style={{ marginTop: 12 }}>
        <h3>
          <Icon d="clock" size={17} stroke="#4f9c74" />
          Sunday 13 September
          <span className="hlink" onClick={() => nav("/clinic/pastel/diary")}>
            {appts?.length ?? 0} appointments&nbsp;&nbsp;<b>View diary →</b>
          </span>
        </h3>
        <div className="cp-appts">
          {shown.map((a) => (
            <button key={a.id} type="button" className="cp-appt" style={{ ["--ac" as never]: a.accent }} onClick={() => nav("/clinic/pastel/patients/grace-adeyemi")}>
              <span className="t">
                {fmtTime(a.start)} – {fmtTime(a.end)}
                <span className="st">
                  <Chip tone={a.status === "Complete" ? "mint" : a.status === "Aftercare" ? "pink" : "blue"}>
                    {a.status === "Complete" ? "✓ Complete" : a.status}
                  </Chip>
                </span>
              </span>
              <b>{a.patientName}</b>
              <span className="tr">{a.treatment}</span>
              <span className="who">
                {a.session} · {practs?.find((p) => p.id === a.practitionerId)?.name}
              </span>
              <span className="row">
                <Chip tone="line">{a.consent === "Consent" ? "✓ Consent" : "Consent due"}</Chip>
                <Chip tone={a.paid === "Unpaid" ? "pink" : "line"}>{a.paid === "Paid" ? "✓ Paid" : a.paid}</Chip>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="cp-att-row">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="cp-panel">
            <h3>
              <Icon d="warn" size={17} stroke="#d0685f" />
              Attention needed
            </h3>
            <div className="psub">Outstanding items that need action — deposits must be paid at least 3 days before the appointment.</div>
            <AttentionSection
              tone="red"
              icon="clock"
              title="Urgent"
              total={22}
              rows={[
                ["No show", 1, true],
                ["Deposit due", 14, true],
                ["Consent due", 5, false],
                ["Balance due", 2, false],
              ]}
            />
            <AttentionSection
              tone=""
              icon="clock"
              title="This week"
              total={118}
              rows={[
                ["Deposit due", 103, true],
                ["Treatment due", 12, false],
                ["Message", 3, false],
              ]}
            />
          </div>
          <div className="cp-panel">
            <h3>
              <Icon d="task" size={17} />
              My tasks
              <span className="hlink" onClick={() => toast("Task board is mocked — these three are your open recalls")}>
                View all tasks →
              </span>
            </h3>
            <div className="psub">Patients to contact and rebook by chat, phone or email.</div>
            {tasks?.map((t) => (
              <div key={t.id} className="cp-taskrow">
                <span className="cp-ava" style={{ background: t.bg, color: t.fg }}>
                  {t.initials}
                </span>
                <span>
                  <b>{t.name}</b>
                  <small>{t.desc}</small>
                </span>
                <span className="ics">
                  <button type="button" onClick={() => toast(`Calling ${t.name}… (mocked)`)} aria-label="Call">✆</button>
                  <button type="button" onClick={() => toast(`Email draft opened for ${t.name} (mocked)`)} aria-label="Email">✉</button>
                  <button type="button" onClick={() => nav("/clinic/pastel/patients/grace-adeyemi")} aria-label="Chat">🗨</button>
                  <button
                    type="button"
                    className="btn sm"
                    disabled={t.contacted}
                    onClick={async () => {
                      setTasks(await api.markContacted(t.id));
                      toast(`${t.name} marked as contacted`);
                    }}
                  >
                    {t.contacted ? "Contacted ✓" : "Mark contacted"}
                  </button>
                  <Chip tone="mint">{t.contacted ? "Complete" : "Open"}</Chip>
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="cp-panel cp-notes" style={{ display: "flex", flexDirection: "column" }}>
          <h3>
            <Icon d="task" size={17} />
            My notes
          </h3>
          <div className="psub">Private to you · share anytime · saves automatically.</div>
          <div className="bar">
            Paragraph ▾&nbsp;&nbsp;<b>B</b>&nbsp;<i>I</i>&nbsp;<u>U</u>&nbsp;<s>S</s>&nbsp;&nbsp;☰ ☱ ☲&nbsp;&nbsp;🔗 ☺
          </div>
          <b style={{ fontSize: 14.5, marginTop: 12 }}>This week</b>
          <textarea
            value={notes ?? ""}
            onChange={(e) => {
              setNotes(e.target.value);
              setSavedAt(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
            }}
            aria-label="My notes"
          />
          <div className="ft">
            <span className="ok">✓ Saved just now</span>
            <span>Last edited {savedAt}</span>
          </div>
        </div>
      </div>
    </>
  );
}

function AttentionSection({
  tone,
  icon,
  title,
  total,
  rows,
}: {
  tone: string;
  icon: "clock";
  title: string;
  total: number;
  rows: Array<[string, number, boolean]>;
}) {
  const toast = useToast();
  const nav = useNavigate();
  const [open, setOpen] = useState(true);
  return (
    <div className="cp-sec">
      <button type="button" className={`hd ${tone}`} onClick={() => setOpen(!open)}>
        <Icon d={icon} size={14} stroke={tone === "red" ? "#c74f63" : undefined} />
        {title}
        <span className="n">{total}</span>
      </button>
      {open &&
        rows.map(([label, n, red]) => (
          <button
            key={label}
            type="button"
            className="li"
            onClick={() => (label === "Message" ? nav("/clinic/pastel/patients/grace-adeyemi") : toast(`${label}: ${n} patient${n > 1 ? "s" : ""} — worklist is mocked`))}
          >
            › {label}
            <span className={`n ${red ? "red" : ""}`}>{n}</span>
          </button>
        ))}
    </div>
  );
}
