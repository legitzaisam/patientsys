import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { Chip } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import { useLoad } from "../../../hooks";
import { api } from "../../../mock/api";
import { CaHead, CaStat } from "./Shell";

const COLS = [
  { title: "Consultation & Prep", n: 28, sub: "New patients and pre-treatment preparation.", bg: "#f6e8cf", fg: "#8a6a22", icon: "users" },
  { title: "Foundation", n: 32, sub: "Active treatments and early progress.", bg: "#e3edf7", fg: "#42688e", icon: "layers" },
  { title: "Build & Support", n: 36, sub: "Ongoing treatment and clinic support.", bg: "#d8f7ea", fg: "#1f6b52", icon: "drop" },
  { title: "Results & Review", n: 28, sub: "Assess results and plan next steps.", bg: "#e2f2e4", fg: "#2e7a4f", icon: "chart" },
] as const;

const FOCUS = [
  ["09:30", "Sophie Lane", "Check results and add note"],
  ["10:00", "James Wilson", "Microneedling Session 2"],
  ["11:00", "Priya Shah", "Skin Plan Review"],
  ["13:00", "Charlotte Green", "Profhilo Treatment"],
  ["14:00", "Sophie Park", "Results review"],
] as const;

const RISK = [
  ["HB", "Hannah Brooks", "Blood test overdue by 3 days", "#b9563f"],
  ["RP", "Ryan Patel", "Reports increased sensitivity", "#8a6a22"],
  ["LC", "Lily Chen", "Missed last appointment", "#5a6a72"],
] as const;

export function AdvancedBoard() {
  const toast = useToast();
  const nav = useNavigate();
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [q, setQ] = useState("");
  const [pract, setPract] = useState("all");
  const { data: cards } = useLoad(() => api.getBoard({ atRiskOnly, q, practitionerId: pract }), [atRiskOnly, q, pract]);
  const { data: practs } = useLoad(() => api.getPractitioners());

  return (
    <>
      <CaHead title="Journey Board" sub="Track every active skin plan by phase, readiness and next milestone." />
      <div className="ca-stats">
        <CaStat v="124" label="Active skin plans" delta="▲ +12%" deltaColor="#2e8a63" em="vs. last month" onClick={() => toast("124 plans across four phases")} />
        <CaStat v="18" label="Milestones due today" delta="▲ +3" deltaColor="#b9563f" em="vs. last week" onClick={() => toast("Focus Today panel lists the top five")} />
        <CaStat v="9" label="Blood tests pending" delta="▼ −25%" deltaColor="#2e8a63" em="vs. last week" onClick={() => { setAtRiskOnly(true); toast("Filtered to at-risk plans"); }} />
        <CaStat v="16" label="Reviews due" delta="▲ +8" deltaColor="#b9563f" em="vs. last week" onClick={() => toast("Results & Review column holds the due reviews")} />
      </div>

      <div style={{ display: "flex", gap: 9, marginTop: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        {(
          [
            ["Treatment type", "All treatments"],
            ["Phase", "All phases"],
            ["Date range", "This week"],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <small style={{ color: "var(--mut)", fontSize: 9.5, fontWeight: 600, display: "block" }}>{label}</small>
            <button type="button" className="ca-fsel" style={{ marginTop: 2 }} onClick={() => toast(`${label} filter is mocked — showing ${value.toLowerCase()}`)}>
              {value} ▾
            </button>
          </div>
        ))}
        <div>
          <small style={{ color: "var(--mut)", fontSize: 9.5, fontWeight: 600, display: "block" }}>Practitioner</small>
          <select className="ca-fsel" style={{ marginTop: 2, height: 34 }} value={pract} onChange={(e) => setPract(e.target.value)} aria-label="Practitioner filter">
            <option value="all">All practitioners</option>
            {(practs ?? [])
              .filter((p) => p.id !== "sm")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, paddingBottom: 8 }}>
          <button
            type="button"
            className={`tgl ${atRiskOnly ? "on" : ""}`}
            role="switch"
            aria-checked={atRiskOnly}
            aria-label="At risk only"
            onClick={() => setAtRiskOnly(!atRiskOnly)}
            style={{ transform: "scale(0.85)" }}
          />
          <span style={{ fontSize: 11, color: "#5a6a72" }}>At risk only</span>
        </div>
        <div className="cp-search" style={{ marginLeft: "auto", width: 290, height: 34, borderRadius: 9 }}>
          ⌕
          <input value={q} placeholder="Search patients by name or plan…" onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <div className="ca-board">
        {COLS.map((col, ci) => {
          const colCards = (cards ?? []).filter((c) => c.col === ci);
          return (
            <div key={col.title} className="ca-bcol">
              <div className="bh">
                <span className="ic" style={{ background: col.bg, color: col.fg }}>
                  <Icon d={col.icon} size={13} />
                </span>
                <span>
                  {col.title}
                  <small>{col.sub}</small>
                </span>
                <span className="n">{atRiskOnly || q || pract !== "all" ? colCards.length : col.n}</span>
              </div>
              <div className="ca-cards">
                {colCards.map((c) => (
                  <button key={c.id} type="button" className="ca-card" onClick={() => nav("/clinic/advanced/patients/grace-adeyemi")}>
                    <span className="r1">
                      <span className="av">{c.initials}</span>
                      <span>
                        <b>{c.name}</b>
                        <small>{c.plan}</small>
                      </span>
                      <span className="fr">{c.frac}</span>
                    </span>
                    <span className="r2">
                      <Icon d="task" size={11} stroke="#8b979d" style={{ flex: "none" }} /> {c.next}
                      {c.when && <span style={{ color: "var(--mut)" }}> · {c.when}</span>}
                      <span className="chev">›</span>
                    </span>
                    <span className="r3">
                      <Chip tone={c.tone}>● {c.label}</Chip>
                    </span>
                  </button>
                ))}
                {colCards.length === 0 && <div className="empty-note">No plans match the filters.</div>}
              </div>
            </div>
          );
        })}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="ca-panel" style={{ padding: "10px 12px" }}>
            <h3 style={{ fontSize: 12 }}>
              ☀ Focus Today
              <span className="see" style={{ fontSize: 9.5 }} onClick={() => toast("18 focus items today — top five shown")}>
                See all (18)
              </span>
            </h3>
            <div style={{ color: "var(--mut)", fontSize: 9.5, marginTop: 2 }}>High priority actions across the clinic.</div>
            {FOCUS.map(([tm, name, sub]) => (
              <button key={name} type="button" className="ca-focus2" onClick={() => nav("/clinic/advanced/diary")}>
                <span className="tm">{tm}</span>
                <span>
                  <b>{name}</b>
                  <small>{sub}</small>
                </span>
                <span className="chev">›</span>
              </button>
            ))}
          </div>
          <div className="ca-panel" style={{ padding: "10px 12px" }}>
            <h3 style={{ fontSize: 12 }}>
              ⚠ Patients at Risk
              <span className="see" style={{ fontSize: 9.5 }} onClick={() => { setAtRiskOnly(true); toast("Board filtered to at-risk plans"); }}>
                See all (7)
              </span>
            </h3>
            <div style={{ color: "var(--mut)", fontSize: 9.5, marginTop: 2 }}>Patients that need attention.</div>
            {RISK.map(([ini, name, sub, color]) => (
              <button key={name} type="button" className="ca-focus2" onClick={() => nav("/clinic/advanced/patients/grace-adeyemi")}>
                <span className="av" style={{ width: 22, height: 22, borderRadius: "50%", background: "#f6ebe7", color: "#a06048", fontSize: 8, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                  {ini}
                </span>
                <span>
                  <b>{name}</b>
                  <small style={{ color }}>{sub}</small>
                </span>
                <span className="chev">›</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
