import { useState } from "react";
import { Icon } from "../../../components/Icon";
import { Check, Chip, Ring } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import { useLoad } from "../../../hooks";
import { api } from "../../../mock/api";
import { CaHead, CaStat } from "./Shell";

const HOUR = 50;

interface Blk {
  id: string;
  patient: string;
  plan: string;
  start: number; // hours after 09:00
  dur: number;
  tone: "mint" | "amber" | "blue";
  label: string;
}

const COLS: Array<{ ini: string; name: string; blocks: Blk[] }> = [
  {
    ini: "SL",
    name: "Sophie Lane",
    blocks: [
      { id: "sl1", patient: "Grace Adeyemi", plan: "Acne Programme · Session 2", start: 0, dur: 0.75, tone: "mint", label: "Ready" },
      { id: "sl2", patient: "Lily Chen", plan: "Acne Programme · Session 3", start: 1.25, dur: 0.75, tone: "mint", label: "Bloods received" },
      { id: "sl3", patient: "Priya Shah", plan: "Acne Programme · Session 1", start: 2.5, dur: 0.9, tone: "mint", label: "Ready" },
      { id: "sl4", patient: "Noah Patel", plan: "Acne Programme · Session 2", start: 5, dur: 0.75, tone: "mint", label: "Ready" },
      { id: "sl5", patient: "Chloe Martin", plan: "Acne Programme · Session 1", start: 6.5, dur: 0.9, tone: "blue", label: "Aftercare due" },
    ],
  },
  {
    ini: "JW",
    name: "James Wilson",
    blocks: [
      { id: "jw1", patient: "Daniel Carter", plan: "Skin Plan Review · Session 2", start: 0.5, dur: 0.75, tone: "amber", label: "Consent pending" },
      { id: "jw2", patient: "Olivia Park", plan: "Microneedling · Session 3", start: 2.5, dur: 0.9, tone: "blue", label: "Aftercare due" },
      { id: "jw3", patient: "Isla Turner", plan: "Microneedling · Session 1", start: 5, dur: 0.75, tone: "amber", label: "Bloods pending" },
    ],
  },
  {
    ini: "PS",
    name: "Priya Shah",
    blocks: [
      { id: "ps1", patient: "Hannah Brooks", plan: "Skin Plan Review", start: 0, dur: 0.75, tone: "blue", label: "Follow-up" },
      { id: "ps2", patient: "Maya Ali", plan: "Skin Plan Review", start: 1, dur: 0.75, tone: "mint", label: "Ready" },
      { id: "ps3", patient: "Lucas Bennett", plan: "Skin Plan Review", start: 5, dur: 0.75, tone: "mint", label: "Ready" },
      { id: "ps4", patient: "Amelia Scott", plan: "Skin Plan Review", start: 6.5, dur: 0.9, tone: "mint", label: "Ready" },
    ],
  },
  {
    ini: "CG",
    name: "Charlotte Green",
    blocks: [
      { id: "cg1", patient: "Sophie Lane", plan: "Profhilo · Session 1", start: 0.5, dur: 0.9, tone: "mint", label: "Ready" },
      { id: "cg2", patient: "Ethan Morris", plan: "Profhilo · Session 2", start: 3, dur: 0.9, tone: "mint", label: "Ready" },
      { id: "cg3", patient: "Ryan Clarke", plan: "Profhilo · Session 1", start: 6.6, dur: 0.9, tone: "amber", label: "Consent pending" },
    ],
  },
  {
    ini: "OP",
    name: "Oliver Grant",
    blocks: [
      { id: "op1", patient: "James Wilson", plan: "B12 Programme · Session 1", start: 1, dur: 0.9, tone: "amber", label: "Stop actives pending" },
      { id: "op2", patient: "Grace Adeyemi", plan: "B12 Programme · Session 2", start: 5, dur: 0.75, tone: "mint", label: "Ready" },
    ],
  },
];

const FOLLOWUPS = [
  ["CM", "Chloe Martin", "Acne Programme · Session 1 · 2 days ago"],
  ["OP", "Olivia Park", "Microneedling · Session 3 · 3 days ago"],
  ["HB", "Hannah Brooks", "Skin Plan Review · 1 week ago"],
  ["MA", "Maya Ali", "Skin Plan Review · 1 week ago"],
  ["RC", "Ryan Clarke", "Profhilo · 1 week ago"],
] as const;

const fmtBlock = (start: number, dur: number) => {
  const s = 9 * 60 + Math.round(start * 60);
  const e = s + Math.round(dur * 60);
  const f = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return `${f(s)} – ${f(e)}`;
};

export function AdvancedDiary() {
  const toast = useToast();
  const [range, setRange] = useState<"Day" | "Week" | "Month">("Day");
  const [sel, setSel] = useState<Blk>(COLS[0].blocks[0]);
  const [prepTab, setPrepTab] = useState("Visit Prep");
  const { data: prep, setData: setPrep } = useLoad(() => api.getPrepChecklist());
  const doneCount = prep?.filter((p) => p.done).length ?? 4;

  return (
    <>
      <CaHead title="Clinic Diary" sub="Today's visits, preparation steps and real-time treatment flow." />
      <div className="ca-stats">
        <CaStat v="18" label="Visits today" delta="▲ +12%" deltaColor="#2e8a63" em="vs. last week" onClick={() => toast("18 visits booked today")} />
        <CaStat v="6" label="Pre-treatment tasks due" delta="▲ +2" deltaColor="#b9563f" em="vs. yesterday" onClick={() => toast("6 preparation tasks outstanding")} />
        <CaStat v="4" label="Aftercare follow-ups" delta="▼ −33%" deltaColor="#2e8a63" em="vs. last week" onClick={() => toast("Aftercare list is at the bottom of this page")} />
        <CaStat v="3" label="Patients needing review" delta="▲ +1" deltaColor="#b9563f" em="vs. yesterday" onClick={() => toast("3 patients flagged for clinician review")} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 10 }}>
        <button type="button" className="ca-fsel" style={{ padding: "0 9px" }} onClick={() => toast("Previous day (mocked — one demo day)")}>
          ‹
        </button>
        <button type="button" className="ca-fsel" style={{ padding: "0 9px" }} onClick={() => toast("Next day (mocked — one demo day)")}>
          ›
        </button>
        <button type="button" className="ca-fsel" onClick={() => toast("Date picker is mocked — Mon, 20 Oct 2025")}>
          <Icon d="cal" size={13} />
          Mon, 20 Oct 2025 ▾
        </button>
        <div style={{ marginLeft: "auto", display: "flex", background: "#eceff0", borderRadius: 9, padding: 3 }}>
          {(["Day", "Week", "Month"] as const).map((r) => (
            <button
              key={r}
              type="button"
              style={{
                fontSize: 11.8,
                fontWeight: 600,
                padding: "5px 16px",
                borderRadius: 7,
                background: range === r ? "var(--deep)" : "none",
                color: range === r ? "#fff" : "#5a6a72",
              }}
              onClick={() => {
                setRange(r);
                if (r !== "Day") toast(`${r} view is mocked in this demo`);
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 12, marginTop: 9, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="ca-panel" style={{ padding: "10px 13px" }}>
            <div className="ca-planner">
              <div className="ca-gutter">
                {["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"].map((t) => (
                  <div key={t}>{t}</div>
                ))}
              </div>
              {COLS.map((col) => (
                <div key={col.ini}>
                  <div className="ca-chead">
                    <span className="ca-avatar">{col.ini}</span>
                    {col.name}
                  </div>
                  <div className="ca-lanes">
                    {col.blocks.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className={`ca-block ${sel.id === b.id ? "sel" : ""}`}
                        style={{ top: b.start * HOUR, minHeight: Math.max(b.dur * HOUR, 44) }}
                        onClick={() => setSel(b)}
                      >
                        <small>{fmtBlock(b.start, b.dur)}</small>
                        <b>{b.patient}</b>
                        <small>{b.plan}</small>
                        <span className="st">
                          <Chip tone={b.tone}>● {b.label}</Chip>
                        </span>
                      </button>
                    ))}
                    <div className="ca-lunch" style={{ top: 4 * HOUR }}>
                      Lunch break
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="ca-panel" style={{ padding: "9px 13px" }}>
            <h3 style={{ fontSize: 12.5 }}>
              ⏰ Aftercare follow-ups due
              <span className="see" onClick={() => toast("Full follow-up worklist is mocked")}>
                View all follow-ups →
              </span>
            </h3>
            <div style={{ display: "flex", gap: 9, marginTop: 7, flexWrap: "wrap" }}>
              {FOLLOWUPS.map(([ini, name, sub]) => (
                <button
                  key={name}
                  type="button"
                  style={{ flex: "1 1 150px", border: "1px solid var(--edge)", borderRadius: 9, padding: "6px 9px", display: "flex", gap: 7, alignItems: "center", fontSize: 10, background: "#fff", textAlign: "left", cursor: "pointer" }}
                  onClick={() => toast(`Aftercare check-in sent to ${name}`)}
                >
                  <span className="ca-avatar" style={{ background: "#eef1f2", color: "#5a6a72", width: 20, height: 20, fontSize: 7.5 }}>
                    {ini}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 10.5, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</b>
                    <small style={{ color: "var(--mut)", fontSize: 9, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</small>
                  </span>
                  <span style={{ marginLeft: "auto", color: "#b7c0c5" }}>›</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="ca-panel ca-clin-check" style={{ position: "sticky", top: 66 }}>
          <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <span className="ca-avatar" style={{ width: 34, height: 34, fontSize: 11 }}>
              {sel.patient
                .split(" ")
                .map((w) => w[0])
                .join("")}
            </span>
            <div>
              <b style={{ fontSize: 14 }}>{sel.patient}</b>
              <div style={{ color: "var(--slate)", fontSize: 11, marginTop: 1 }}>
                {fmtBlock(sel.start, sel.dur)} <span style={{ color: "#2e8a63", fontWeight: 600 }}>(in 10 mins)</span>
              </div>
              <div style={{ color: "var(--mut)", fontSize: 10.5 }}>{sel.plan}</div>
            </div>
            <button type="button" style={{ marginLeft: "auto", color: "#9aa5ab" }} onClick={() => toast("Panel follows the selected diary block")} aria-label="Close">
              ✕
            </button>
          </div>
          <div className="ca-tabs" style={{ marginTop: 8, gap: 16 }}>
            {["Visit Prep", "Patient Details", "Treatment Plan"].map((t) => (
              <button key={t} type="button" className={prepTab === t ? "on" : ""} style={{ fontSize: 11.5 }} onClick={() => setPrepTab(t)}>
                {t}
              </button>
            ))}
          </div>
          {prepTab === "Visit Prep" ? (
            <>
              <div style={{ display: "flex", gap: 11, alignItems: "center", marginTop: 10 }}>
                <Ring pct={33} size={52} strokeWidth={6} color="#359497" ink="#16323a" label="2/6" fontSize={11} />
                <div>
                  <b style={{ fontSize: 12.5 }}>{sel.plan.split(" · ")[0]}</b>
                  <small style={{ display: "block", color: "var(--mut)", fontSize: 10.5 }}>Session 2 of 6 · Active phase</small>
                </div>
                <button type="button" className="ca-fsel" style={{ marginLeft: "auto", height: 28, fontSize: 10.5 }} onClick={() => toast("Plan view is on the patient record — Journey tab")}>
                  View plan →
                </button>
              </div>
              <div style={{ display: "flex", marginTop: 11, fontSize: 12, fontWeight: 700 }}>
                Preparation checklist
                <span style={{ marginLeft: "auto", color: "var(--mut)", fontWeight: 500, fontSize: 10.5 }}>
                  {doneCount} of {prep?.length ?? 5} complete
                </span>
              </div>
              {prep?.map((p) => (
                <Check key={p.id} checked={p.done} onChange={async () => setPrep(await api.togglePrep(p.id))} meta={p.meta}>
                  {p.label}
                </Check>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 8, marginTop: 10 }}>
                <button type="button" className="ca-fsel" style={{ height: 34, justifyContent: "center", fontSize: 11 }} onClick={() => toast(`Message sent to ${sel.patient} (mocked)`)}>
                  💬 Message patient
                </button>
                <button
                  type="button"
                  className="ca-fsel"
                  style={{ height: 34, justifyContent: "center", fontSize: 11, background: "var(--deep)", color: "#fff", borderColor: "var(--deep)" }}
                  onClick={() => toast(`Treatment recording started for ${sel.patient} (mocked)`)}
                >
                  ✎ Record treatment
                </button>
              </div>
              <div className="ca-note-info">ⓘ Patient has sensitive skin. Use gentle protocol and check comfort throughout treatment.</div>
            </>
          ) : (
            <div style={{ fontSize: 11.5, color: "var(--slate)", marginTop: 12, lineHeight: 1.6 }}>
              {prepTab === "Patient Details" ? (
                <>
                  <b style={{ display: "block", fontSize: 12 }}>{sel.patient}</b>
                  DOB 12 Mar 1992 · PA-10483
                  <br />
                  {sel.patient.toLowerCase().replace(" ", ".")}@example.com
                  <br />
                  07700 900123 · No known allergies
                </>
              ) : (
                <>
                  <b style={{ display: "block", fontSize: 12 }}>{sel.plan.split(" · ")[0]}</b>
                  6 sessions over 3 months. Currently in the active phase — session 2 today, next review after session 3.
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
