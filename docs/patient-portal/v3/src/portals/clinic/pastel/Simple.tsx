import { useNavigate } from "react-router-dom";
import { Funnel } from "../../../components/charts";
import { useLoad } from "../../../hooks";
import { api } from "../../../mock/api";
import { Chip } from "../../../components/ui";
import { useToast } from "../../../components/Toast";

/** Functional secondary pages for pastel nav items without a designed v2 screen. */
export function PastelSimple({ page }: { page: "retention" }) {
  const toast = useToast();
  const nav = useNavigate();
  const { data: risk, setData } = useLoad(() => api.getAtRisk());
  void page;

  return (
    <>
      <div className="cp-h1row">
        <div>
          <h1>Retention</h1>
          <div className="sub">Journey progression and at-risk patients — the full retention report lives in the journey-led direction.</div>
        </div>
        <div className="cp-right">
          <button type="button" className="btn" onClick={() => nav("/clinic/journey/retention")}>
            Open journey-led retention →
          </button>
        </div>
      </div>
      <div className="cp-panel" style={{ marginTop: 14 }}>
        <h3>Patient journey progression</h3>
        <div className="psub">From first consultation to completed plan.</div>
        <Funnel />
      </div>
      <div className="cp-panel" style={{ marginTop: 12 }}>
        <h3>Patients at risk</h3>
        <div className="psub">Send a reminder without leaving the page — actions persist.</div>
        {risk?.map((r) => (
          <div key={r.id} className="cp-taskrow">
            <span className="cp-ava" style={{ background: "#eef0f4", color: "#66708a" }}>
              {r.initials}
            </span>
            <span>
              <b>{r.name}</b>
              <small>
                {r.phase} · {r.reason}
              </small>
            </span>
            <span className="ics">
              {r.sent ? (
                <Chip tone="mint">Reminder sent ✓</Chip>
              ) : (
                <button
                  type="button"
                  className="btn sm"
                  onClick={async () => {
                    setData(await api.sendReminder(r.id));
                    toast(`Reminder sent to ${r.name}`);
                  }}
                >
                  {r.action}
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
