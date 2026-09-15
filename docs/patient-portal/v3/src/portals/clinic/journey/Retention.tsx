import { useNavigate } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { Chip } from "../../../components/ui";
import { Funnel } from "../../../components/charts";
import { useToast } from "../../../components/Toast";
import { useLoad } from "../../../hooks";
import { api } from "../../../mock/api";

const OUTCOMES = [
  ["❋", "Microneedling", 78, "3.4", "68%"],
  ["△", "Chemical Peels", 71, "3.1", "59%"],
  ["◎", "Acne Program", 64, "4.2", "51%"],
  ["✿", "Skin Reset", 76, "3.6", "66%"],
] as const;

export function JourneyRetention() {
  const toast = useToast();
  const nav = useNavigate();
  const { data: risk, setData } = useLoad(() => api.getAtRisk());

  return (
    <>
      <div className="cj-h1row">
        <div>
          <h1>Retention &amp; outcomes</h1>
          <div className="sub">See who is progressing, who is dropping off, and where to intervene.</div>
        </div>
        <div className="cj-right">
          <button type="button" className="cj-pill" onClick={() => toast("Period picker is mocked — showing the last 12 months")}>
            <Icon d="cal" size={14} />
            Last 12 months&nbsp;&nbsp;‹&nbsp;›
          </button>
          <button type="button" className="cj-pill" onClick={() => toast("Report exported as retention-2024.csv (mocked)")}>
            ⇩ Export report
          </button>
        </div>
      </div>

      <div className="cj-stats">
        {(
          [
            ["Journey completion rate", "72%", "up", "↗ 12%", "457 of 633 patients completed a plan", "users", "var(--mint)", "var(--mintink)"],
            ["Repeat booking rate", "68%", "up", "↗ 8%", "513 patients booked a second plan", "cal", "var(--blue)", "var(--blueink)"],
            ["Plans at risk", "24", "dn", "↑ 29%", "Patients overdue or missing next step", "warn", "var(--pink)", "var(--pinkink)"],
            ["Before & after reviews collected", "62%", "up", "↗ 18%", "389 of 633 completed plans", "photo", "var(--mint)", "var(--mintink)"],
          ] as const
        ).map(([label, v, tone, delta, foot, icon, bg, fg]) => (
          <button key={label} type="button" className="cj-stat" onClick={() => toast(`${label}: breakdown is mocked`)}>
            <span className="ic" style={{ background: bg, color: fg }}>
              <Icon d={icon} size={18} />
            </span>
            <span>
              <small>{label}</small>
              <span className="v">
                {v}
                <span className={`cj-uch ${tone}`}>{delta}</span>
              </span>
              <span className="foot">{foot}</span>
            </span>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 12, marginTop: 12, alignItems: "start" }}>
        <div className="cj-panel">
          <h3>
            Patient journey progression
            <span className="see">
              <button type="button" className="cj-pill" style={{ height: 30, fontSize: 11.5 }} onClick={() => toast("Plan-type filter is mocked — showing all treatment plans")}>
                All treatment plans ▾
              </button>
            </span>
          </h3>
          <div className="psub">From first consultation to completed plan. Shows where patients drop off. Hover a stage for the count.</div>
          <Funnel />
        </div>
        <div className="cj-panel">
          <h3>💡 Where to focus</h3>
          <div className="psub">Insights based on your clinic's patient journey data.</div>
          <div style={{ marginTop: 6 }}>
            <button type="button" className="cj-focusrow" onClick={() => document.getElementById("cj-risk-table")?.scrollIntoView({ behavior: "smooth" })}>
              <span className="ic" style={{ background: "var(--pink)", color: "var(--pinkink)" }}>
                <Icon d="clock" size={14} />
              </span>
              <span>
                <b>24 patients are at risk</b>
                <small>Haven't booked their next step. Send a recall message to keep them on track.</small>
              </span>
              <span className="chev">›</span>
            </button>
            <button type="button" className="cj-focusrow" onClick={() => toast("Suggested automation: follow-up message 7 days after treatment 1 (mocked)")}>
              <span className="ic" style={{ background: "var(--cream)", color: "var(--creamink)" }}>
                <Icon d="clock" size={14} />
              </span>
              <span>
                <b>Biggest drop-off after treatment 1</b>
                <small>14% of patients don't return for treatment 2. Consider a follow-up message at 7 days.</small>
              </span>
              <span className="chev">›</span>
            </button>
            <button type="button" className="cj-focusrow" onClick={() => toast("38% of completed plans are missing photos — ask at the final appointment")}>
              <span className="ic" style={{ background: "var(--blue)", color: "var(--blueink)" }}>
                <Icon d="photo" size={14} />
              </span>
              <span>
                <b>Before &amp; after reviews can improve</b>
                <small>38% of completed plans are missing photos. Ask at the final appointment.</small>
              </span>
              <span className="chev">›</span>
            </button>
            <button type="button" className="cj-focusrow" onClick={() => toast("Maintenance patients have 3.2x higher lifetime value")}>
              <span className="ic" style={{ background: "var(--mint)", color: "var(--mintink)" }}>
                <Icon d="trend" size={14} />
              </span>
              <span>
                <b>Maintenance drives long-term value</b>
                <small>Patients who enter maintenance have 3.2x higher lifetime value. Promote continued care.</small>
              </span>
              <span className="chev">›</span>
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.55fr 1fr", gap: 12, marginTop: 12, alignItems: "start" }}>
        <div className="cj-panel" id="cj-risk-table">
          <h3>
            Patients at risk
            <span className="see" onClick={() => toast("Showing 5 of 24 — the full list is mocked")}>
              View all at-risk patients →
            </span>
          </h3>
          <div className="psub">Patients who may be dropping off, so you can take action early. Actions persist.</div>
          <table className="cj-rtable">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Current phase</th>
                <th>Last visit</th>
                <th>Next step</th>
                <th>Risk reason</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {risk?.map((r) => (
                <tr key={r.id}>
                  <td>
                    <span className="cp-ava" style={{ width: 22, height: 22, fontSize: 8.5, background: "#eef0f4", color: "#66708a", marginRight: 7 }}>
                      {r.initials}
                    </span>
                    <b style={{ display: "inline", fontSize: 11.8, cursor: "pointer" }} onClick={() => nav("/clinic/journey/patients/grace-adeyemi")}>
                      {r.name}
                    </b>
                  </td>
                  <td>
                    <Chip tone={r.phaseTone}>{r.phase}</Chip>
                  </td>
                  <td>{r.lastVisit}</td>
                  <td>{r.nextStep}</td>
                  <td>{r.reason}</td>
                  <td>
                    {r.sent ? (
                      <Chip tone="mint">Sent ✓</Chip>
                    ) : (
                      <button
                        type="button"
                        className="cj-pill"
                        style={{ height: 24, fontSize: 9.8, padding: "0 8px" }}
                        onClick={async () => {
                          setData(await api.sendReminder(r.id));
                          toast(`${r.action} — done for ${r.name}`);
                        }}
                      >
                        {r.action}
                      </button>
                    )}{" "}
                    <span style={{ color: "#aab3c6" }}>⋯</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", color: "var(--mut)", fontSize: 11, marginTop: 8 }}>
            Showing 5 of 24 at-risk patients
            <button type="button" style={{ marginLeft: "auto", color: "var(--teal)", fontWeight: 600, fontSize: 11 }} onClick={() => toast("Full at-risk worklist is mocked")}>
              View all at-risk patients →
            </button>
          </div>
        </div>
        <div className="cj-panel">
          <h3>Outcomes by plan type</h3>
          <div className="psub">Completion rate and key results for each treatment plan.</div>
          <div className="cj-obar" style={{ borderTop: 0, color: "#6b7894", fontSize: 10.5, fontWeight: 600 }}>
            <span />
            <span>Plan type</span>
            <span>Completion</span>
            <span />
            <span>Avg. visits</span>
            <span>Reviews</span>
          </div>
          {OUTCOMES.map(([ic, name, pct, visits, reviews]) => (
            <div key={name} className="cj-obar">
              <span style={{ color: "var(--teal)" }}>{ic}</span>
              <b style={{ fontSize: 11.8 }}>{name}</b>
              <span style={{ fontWeight: 700 }}>{pct}%</span>
              <span className="bar">
                <i style={{ width: `${pct}%` }} />
              </span>
              <span>{visits}</span>
              <span>{reviews}</span>
            </div>
          ))}
          <div className="cj-banner">
            <Icon d="chart" size={16} stroke="#237a55" style={{ flex: "none" }} />
            <div>
              <b>Microneedling has the highest completion rate</b>
              Patients on microneedling plans are 22% more likely to complete their journey than the clinic average.
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
