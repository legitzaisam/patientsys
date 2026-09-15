import { useNavigate } from "react-router-dom";
import { Chip } from "../../../components/ui";
import { useLoad } from "../../../hooks";
import { api } from "../../../mock/api";
import { CaHead } from "./Shell";

/** Functional secondary pages for advanced nav items without a designed v2 screen. */
export function AdvancedSimple({ page }: { page: "patients" | "reports" | "messages" }) {
  const nav = useNavigate();
  const { data: patients } = useLoad(() => api.getPatients({ pageSize: 10 }));
  const { data: msgs } = useLoad(() => api.getThread("patient-clinic"));

  const meta: Record<string, [string, string]> = {
    patients: ["Patients", "Quick list — open a record, or use the full searchable table in the pastel direction."],
    reports: ["Reports", "Reporting lives in the pastel Performance and journey Retention pages."],
    messages: ["Messages", "Recent patient messages across the clinic."],
  };

  return (
    <>
      <CaHead title={meta[page][0]} sub={meta[page][1]} />
      <div className="ca-panel" style={{ marginTop: 12, maxWidth: 860 }}>
        {page === "patients" &&
          patients?.rows.map((p) => (
            <button key={p.id} type="button" className="ca-up" onClick={() => nav("/clinic/advanced/patients/grace-adeyemi")}>
              <span className="av" style={{ width: 26, height: 26, borderRadius: "50%", background: "#eef1f2", color: "#5a6a72", fontSize: 9, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                {p.first[0]}
                {p.last[0]}
              </span>
              <span>
                <b>
                  {p.last}, {p.title} {p.first}
                </b>
                <small>
                  {p.ref} · {p.lastTreatment}
                </small>
              </span>
              <span style={{ marginLeft: "auto" }}>
                <Chip tone={p.status === "Active" ? "mint" : "slate"}>{p.status}</Chip>
              </span>
            </button>
          ))}
        {page === "reports" && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="ca-fsel" onClick={() => nav("/clinic/pastel/performance")}>
              Performance report →
            </button>
            <button type="button" className="ca-fsel" onClick={() => nav("/clinic/journey/retention")}>
              Retention &amp; outcomes →
            </button>
          </div>
        )}
        {page === "messages" && (
          <>
            {msgs?.length === 0 && <div className="empty-note">No messages yet — patients can write from their portals.</div>}
            {msgs?.map((m) => (
              <div key={m.id} className="ca-up" style={{ cursor: "default" }}>
                <span>
                  <b>{m.author}</b>
                  <small>{m.text}</small>
                </span>
                <span style={{ marginLeft: "auto", color: "var(--mut)", fontSize: 10 }}>{m.at}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
