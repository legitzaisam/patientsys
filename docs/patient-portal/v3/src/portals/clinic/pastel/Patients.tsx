import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { Chip, Modal, Skeleton } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import { useLoad } from "../../../hooks";
import { api, type PatientQuery } from "../../../mock/api";

const FILTERS = ["All", "Active", "Inactive", "Treatments due"] as const;
const PAGE_SIZE = 12;

export function PastelPatients() {
  const toast = useToast();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [sort, setSort] = useState<NonNullable<PatientQuery["sort"]>>("name");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [newPatient, setNewPatient] = useState(false);

  const { data, loading, reload } = useLoad(
    () => api.getPatients({ q, filter, sort, dir, page, pageSize: PAGE_SIZE }),
    [q, filter, sort, dir, page],
  );

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const pages = pageList(page, totalPages);

  function header(label: string, key: NonNullable<PatientQuery["sort"]> | null) {
    if (!key) return <th>{label}</th>;
    const active = sort === key;
    return (
      <th
        onClick={() => {
          if (active) setDir(dir === "asc" ? "desc" : "asc");
          else {
            setSort(key);
            setDir("asc");
          }
          setPage(1);
        }}
      >
        {label} {active ? (dir === "asc" ? "↑" : "↓") : "⇅"}
      </th>
    );
  }

  return (
    <>
      <div className="cp-h1row">
        <div>
          <h1>Patients</h1>
          <div className="sub">{data ? `${data.total} records` : "Loading…"}</div>
        </div>
        <div className="cp-right">
          <div className="cp-search" style={{ width: 240, height: 38 }}>
            ⌕
            <input
              value={q}
              placeholder="Name or reference"
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <button type="button" className="btn" onClick={() => toast("Date-of-birth filter is mocked")}>
            <Icon d="cal" size={15} />
            DD/MM/YYYY
          </button>
          <button type="button" className="btn green" onClick={() => setNewPatient(true)}>
            ⊕ New patient
          </button>
        </div>
      </div>

      <div className="cp-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`cp-fp ${filter === f ? "on" : ""}`}
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="cp-table">
        <table>
          <thead>
            <tr>
              {header("Patient", "name")}
              <th>Last treatment</th>
              <th>Next treatment</th>
              {header("Next due", "nextDue")}
              {header("Paperwork", "paperwork")}
              {header("Status", "status")}
              <th />
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={7}>
                    <Skeleton h={15} />
                  </td>
                </tr>
              ))}
            {!loading &&
              data?.rows.map((p) => (
                <tr key={p.id} onClick={() => nav(`/clinic/pastel/patients/${p.id === "grace-adeyemi" ? p.id : "grace-adeyemi"}`)}>
                  <td>
                    <b>
                      {p.last}, {p.title} {p.first}
                    </b>
                    <small>
                      {p.dob} · {p.ref}
                    </small>
                  </td>
                  <td>
                    {p.lastTreatment} · {p.lastTreatmentDate}
                  </td>
                  <td>{p.nextTreatment}</td>
                  <td>{p.nextDue}</td>
                  <td>{p.paperwork}</td>
                  <td>
                    <Chip tone={p.status === "Active" ? "mint" : "slate"}>{p.status}</Chip>
                  </td>
                  <td style={{ color: "#aab3c6" }}>⋮</td>
                </tr>
              ))}
            {!loading && data?.rows.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty-note">No patients match “{q}” with the {filter} filter.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div className="cp-pg">
          {data && data.total > 0 && (
            <>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total} records
            </>
          )}
          <div className="pages">
            <button type="button" className="ar" disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
              ‹
            </button>
            {pages.map((p, i) =>
              p === null ? (
                <span key={`gap-${i}`} style={{ padding: "0 3px" }}>
                  …
                </span>
              ) : (
                <button key={p} type="button" className={p === page ? "on" : ""} onClick={() => setPage(p)}>
                  {p}
                </button>
              ),
            )}
            <button type="button" className="ar" disabled={page === totalPages} onClick={() => setPage(page + 1)} aria-label="Next page">
              ›
            </button>
          </div>
        </div>
      </div>

      <NewPatientModal
        open={newPatient}
        onClose={() => setNewPatient(false)}
        onCreated={(name) => {
          setNewPatient(false);
          reload();
          toast(`Patient record created for ${name}`);
        }}
      />
    </>
  );
}

function pageList(page: number, total: number): Array<number | null> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: Array<number | null> = [1];
  if (page > 3) out.push(null);
  for (let p = Math.max(2, page - 1); p <= Math.min(total - 1, page + 1); p++) out.push(p);
  if (page < total - 2) out.push(null);
  out.push(total);
  return out;
}

function NewPatientModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (name: string) => void }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New patient"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn green"
            disabled={busy || !first.trim() || !last.trim()}
            onClick={async () => {
              setBusy(true);
              await api.createPatient({ first: first.trim(), last: last.trim(), email: email.trim() || "unknown@example.com" });
              setBusy(false);
              setFirst("");
              setLast("");
              setEmail("");
              onCreated(`${first.trim()} ${last.trim()}`);
            }}
          >
            {busy ? "Creating…" : "Create patient"}
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label className="field">
          <span>First name</span>
          <input value={first} onChange={(e) => setFirst(e.target.value)} />
        </label>
        <label className="field">
          <span>Last name</span>
          <input value={last} onChange={(e) => setLast(e.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Email</span>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="patient@example.com" />
      </label>
      <p style={{ fontSize: 12, color: "#8996b7" }}>The new record is stored in the mock DB (top of the patients list) and persists in localStorage.</p>
    </Modal>
  );
}
