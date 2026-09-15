import { useNavigate } from "react-router-dom";
import { Chip } from "../../../components/ui";
import { useLoad } from "../../../hooks";
import { api } from "../../../mock/api";

/** Functional secondary pages for journey nav items without a designed v2 screen. */
export function JourneySimple({ page }: { page: "diary" | "patients" | "board" | "performance" }) {
  const nav = useNavigate();
  const { data: patients } = useLoad(() => api.getPatients({ pageSize: 8 }));
  const { data: appts } = useLoad(() => api.getDiary(0));

  const titles: Record<string, [string, string]> = {
    diary: ["Diary", "Today's appointments — the full planner lives in the pastel direction."],
    patients: ["Patients", "Quick patient list — the full searchable table lives in the pastel direction."],
    board: ["Journey board", "The full kanban journey board lives in the Advanced direction."],
    performance: ["Performance", "The full performance report with charts lives in the pastel direction."],
  };

  return (
    <>
      <div className="cj-h1row">
        <div>
          <h1>{titles[page][0]}</h1>
          <div className="sub">{titles[page][1]}</div>
        </div>
        <div className="cj-right">
          {page === "diary" && (
            <button type="button" className="cj-pill" onClick={() => nav("/clinic/pastel/diary")}>
              Open pastel diary →
            </button>
          )}
          {page === "patients" && (
            <button type="button" className="cj-pill" onClick={() => nav("/clinic/pastel/patients")}>
              Open full patients table →
            </button>
          )}
          {page === "board" && (
            <button type="button" className="cj-pill" onClick={() => nav("/clinic/advanced/board")}>
              Open journey board →
            </button>
          )}
          {page === "performance" && (
            <button type="button" className="cj-pill" onClick={() => nav("/clinic/pastel/performance")}>
              Open performance report →
            </button>
          )}
        </div>
      </div>
      <div className="cj-panel" style={{ marginTop: 12 }}>
        {page === "diary" &&
          appts?.map((a) => (
            <button key={a.id} type="button" className="cj-hrow" onClick={() => nav("/clinic/journey/patients/grace-adeyemi")}>
              <span>
                <b style={{ fontSize: 12.5 }}>{a.patientName}</b>
                <br />
                <small style={{ color: "var(--mut)", fontSize: 10.8 }}>
                  {a.treatment} · {a.session}
                </small>
              </span>
              <span className="d">
                {`${String(Math.floor(a.start / 60)).padStart(2, "0")}:${String(a.start % 60).padStart(2, "0")}`}{" "}
                <Chip tone={a.status === "Complete" ? "mint" : a.status === "Aftercare" ? "pink" : "blue"}>{a.status}</Chip>
              </span>
            </button>
          ))}
        {(page === "patients" || page === "board" || page === "performance") &&
          patients?.rows.map((p) => (
            <button key={p.id} type="button" className="cj-hrow" onClick={() => nav("/clinic/journey/patients/grace-adeyemi")}>
              <span>
                <b style={{ fontSize: 12.5 }}>
                  {p.last}, {p.title} {p.first}
                </b>
                <br />
                <small style={{ color: "var(--mut)", fontSize: 10.8 }}>
                  {p.ref} · {p.lastTreatment}
                </small>
              </span>
              <span className="d">
                <Chip tone={p.status === "Active" ? "mint" : "slate"}>{p.status}</Chip> ›
              </span>
            </button>
          ))}
      </div>
    </>
  );
}
