import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { Slider, levelOf } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import { useLoad } from "../../../hooks";
import { api } from "../../../mock/api";
import { CaHead, CaStat } from "./Shell";

const ACTIONS = [
  ["Review B12 blood test result", "Sophie Lane · Check results and add note", "Today, 09:00", "task"],
  ["Send skincare reminder", "George Patel · Post-treatment day 3", "Today, 10:00", "msg"],
  ["Check stop-actives status", "Hannah Brooks · Microneedling (tomorrow)", "Today, 11:00", "link"],
  ["Confirm consent", "Lily Chen · Profhilo (tomorrow)", "Today, 11:30", "task"],
  ["Review aftercare photo", "Daniel Carter · Day 7 check-in", "Today, 14:00", "photo"],
] as const;

const UPCOMING = [
  ["09:30", "Emma Reed", "Consultation · Acne Programme"],
  ["10:00", "James Wilson", "Microneedling Session 2"],
  ["11:30", "Priya Shah", "Skin Plan Review"],
  ["13:00", "Charlotte Green", "Profhilo Treatment"],
  ["14:30", "Oliver Grant", "Follow-up · B12 Programme"],
] as const;

const JOURNEYS = [
  { m: "Month 1", t: "Foundation", pts: ["done", "done", "done"], rows: [["SL", "Sophie Lane", "Acne Programme"], ["GP", "George Patel", "B12 Programme"], ["MA", "Maya Ali", "Pigmentation Plan"]] },
  { m: "Month 2", t: "Build & Support", pts: ["cur", "", ""], rows: [["JW", "James Wilson", "Microneedling"], ["PS", "Priya Shah", "Skin Rejuvenation Plan"], ["DC", "Daniel Carter", "Rosacea Management"]] },
  { m: "Month 3", t: "Results & Confidence", pts: ["", "", ""], rows: [["CG", "Charlotte Green", "Profhilo"], ["EM", "Ethan Morris", "Acne Programme"], ["OP", "Olivia Park", "Anti-Ageing Plan"]] },
] as const;

export function AdvancedOverview() {
  const toast = useToast();
  const nav = useNavigate();
  const [tab, setTab] = useState("Today");
  const [doneActions, setDoneActions] = useState<Set<number>>(new Set());
  const { data: sliders, setData: setSliders } = useLoad(() => api.getSliders());
  const { data: garden } = useLoad(() => api.getGarden());

  return (
    <>
      <CaHead title="Clinic Overview" sub="A journey-led view of today's patients, milestones and next actions." />
      <div className="ca-stats">
        <CaStat v="124" label="Active skin plans" delta="▲ +12%" deltaColor="#2e8a63" em="vs. last month" onClick={() => nav("/clinic/advanced/board")} />
        <CaStat v="18" label="Milestones due" delta="▲ +3" deltaColor="#b9563f" em="vs. last week" onClick={() => nav("/clinic/advanced/diary")} />
        <CaStat v="7" label="Patients needing support" delta="▼ −29%" deltaColor="#2e8a63" em="vs. last week" onClick={() => nav("/clinic/advanced/board")} />
        <CaStat v="£42,680" label="Revenue this month" delta="▲ +18%" deltaColor="#2e8a63" em="vs. last month" onClick={() => toast("Revenue report lives in the pastel Performance page")} />
      </div>
      <div className="ca-tabs">
        {["Today", "Preparation", "Recovery", "Outcomes"].map((t) => (
          <button key={t} type="button" className={tab === t ? "on" : ""} onClick={() => { setTab(t); if (t !== "Today") toast(`${t} tab is a summary view in this demo`); }}>
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr 1fr", gap: 12, marginTop: 11, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div className="ca-panel">
            <h3>
              ☀ Today / Next Actions<span className="see" style={{ color: "var(--mut)" }}>{ACTIONS.length - doneActions.size} open</span>
            </h3>
            {ACTIONS.map(([title, sub, when, icon], i) => (
              <button
                key={title}
                type="button"
                className="ca-task"
                onClick={() => {
                  const next = new Set(doneActions);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  setDoneActions(next);
                }}
              >
                <span className={`o ${doneActions.has(i) ? "on" : ""}`} />
                <span className="tile">
                  <Icon d={icon} size={13} />
                </span>
                <span>
                  <b className={doneActions.has(i) ? "done" : ""}>{title}</b>
                  <small>{sub}</small>
                </span>
                <span className="t">{when} ›</span>
              </button>
            ))}
          </div>
          <div className="ca-panel">
            <h3>
              <Icon d="chart" size={15} />
              Active Treatment Journeys
              <span className="see" onClick={() => nav("/clinic/advanced/board")}>
                View full journey board →
              </span>
            </h3>
            <div className="ca-jrney">
              {JOURNEYS.map((j) => (
                <div key={j.m} className="ca-jm">
                  <small>{j.m}</small>
                  <b>{j.t}</b>
                  <div className="ca-track">
                    {j.pts.map((p, i) => (
                      <span key={i} className={`pt ${p}`} style={{ left: `${i * 44}%` }}>
                        {p === "done" && <Icon d="check" size={10} stroke="#fff" />}
                        {p === "cur" && <i />}
                      </span>
                    ))}
                  </div>
                  <div className="ca-jlist">
                    {j.rows.map(([ini, name, plan]) => (
                      <button key={name} type="button" onClick={() => nav("/clinic/advanced/patients/grace-adeyemi")}>
                        <span className="av">{ini}</span>
                        <span style={{ flex: "none" }}>{name}</span>
                        <span style={{ color: "var(--mut)", overflow: "hidden", textOverflow: "ellipsis" }}>{plan}</span>
                        <span className="chev">›</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ca-panel">
          <h3>
            <Icon d="cal" size={15} />
            Upcoming
            <span className="see" onClick={() => nav("/clinic/advanced/diary")}>
              See all
            </span>
          </h3>
          {UPCOMING.map(([tm, name, sub]) => (
            <button key={name} type="button" className="ca-up" onClick={() => nav("/clinic/advanced/diary")}>
              <span className="tm">{tm}</span>
              <span>
                <b>{name}</b>
                <small>{sub}</small>
              </span>
              <span style={{ marginLeft: "auto", color: "#b7c0c5" }}>›</span>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div className="ca-panel">
            <h3>
              ♡ Recovery Watchlist
              <span className="see" onClick={() => toast("3 patients on the recovery watchlist — list is mocked")}>
                See all
              </span>
            </h3>
            {sliders && (
              <>
                <Slider label="Redness" value={sliders.redness} levelText={levelOf} onChange={async (v) => setSliders(await api.setSlider("redness", v))} />
                <Slider label="Sensitivity" value={sliders.sensitivity} levelText={levelOf} onChange={async (v) => setSliders(await api.setSlider("sensitivity", v))} />
                <Slider label="Dryness" value={sliders.dryness} levelText={levelOf} onChange={async (v) => setSliders(await api.setSlider("dryness", v))} />
              </>
            )}
          </div>
          <div className="ca-panel">
            <h3>
              <Icon d="photo" size={15} />
              Before &amp; After (Recent)
              <span className="see" onClick={() => toast("Gallery is mocked — 12 recent comparisons")}>
                See all
              </span>
            </h3>
            <div className="ca-ba">
              <div>
                <img src="/assets/skin-before-1.png" alt="" />
                <div className="lb">
                  <b>Sophie Lane</b> · Acne Programme · 6 weeks
                </div>
              </div>
              <div>
                <img src="/assets/skin-after-2.png" alt="" />
                <div className="lb">
                  <b>James Wilson</b> · Microneedling · 8 weeks
                </div>
              </div>
            </div>
          </div>
          <div className="ca-panel">
            <h3>
              <Icon d="drop" size={15} />
              Routine adherence<span className="see" style={{ color: "var(--mut)" }}>This week</span>
            </h3>
            <div className="ca-adh">
              <span>☀ AM routine</span>
              <span className="lane">
                <i style={{ width: `${Math.round(((garden?.routine.am ?? 5.7) / 7) * 100)}%` }} />
              </span>
              <span className="n">{Math.round(((garden?.routine.am ?? 5.7) / 7) * 100)}%</span>
            </div>
            <div className="ca-adh">
              <span>☾ PM routine</span>
              <span className="lane">
                <i style={{ width: `${Math.round(((garden?.routine.pm ?? 4.5) / 7) * 100)}%` }} />
              </span>
              <span className="n">{Math.round(((garden?.routine.pm ?? 4.5) / 7) * 100)}%</span>
            </div>
          </div>
          <div className="ca-panel">
            <h3>
              🛡 Safe to Proceed?<span className="see" style={{ color: "var(--mut)" }}>3 requiring review</span>
            </h3>
            {[
              ["HB", "Hannah Brooks", "Stop-actives confirmation pending"],
              ["LC", "Lily Chen", "Consent form incomplete"],
              ["DP", "Daniel Carter", "Reports increased sensitivity"],
            ].map(([ini, name, sub]) => (
              <button key={name} type="button" className="ca-safe" onClick={() => nav("/clinic/advanced/patients/grace-adeyemi")}>
                <span className="av">{ini}</span>
                <b style={{ fontSize: 11.5 }}>{name}</b>
                <small>{sub} ›</small>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
