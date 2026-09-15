import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { Modal } from "../../../components/ui";
import { useToast } from "../../../components/Toast";
import { useLoad } from "../../../hooks";
import { api } from "../../../mock/api";
import { TREATMENTS } from "../../../mock/seed";
import type { Appointment } from "../../../mock/types";

const HOUR = 56;
const DAY_START = 9 * 60;
const fmtTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const DAY_LABELS: Record<number, string> = {
  [-1]: "Saturday 12 September 2026",
  0: "Sunday 13 September 2026",
  1: "Monday 14 September 2026",
};

export function PastelDiary() {
  const toast = useToast();
  const nav = useNavigate();
  const [day, setDay] = useState(0);
  const [range, setRange] = useState<"Day" | "Week" | "Month">("Day");
  const [booking, setBooking] = useState(false);
  const [viewBy, setViewBy] = useState("all");
  const { data: appts, reload } = useLoad(() => api.getDiary(day), [day]);
  const { data: practs } = useLoad(() => api.getPractitioners());

  const columns = useMemo(() => {
    const cols = (practs ?? []).filter((p) => p.id !== "sm").filter((p) => viewBy === "all" || p.id === viewBy);
    return cols.map((p) => ({ p, appts: (appts ?? []).filter((a) => a.practitionerId === p.id) }));
  }, [practs, appts, viewBy]);

  return (
    <>
      <div className="cp-h1row">
        <div>
          <h1>Clinic diary</h1>
          <div className="sub">{DAY_LABELS[day] ?? `Day ${day > 0 ? "+" : ""}${day}`}</div>
        </div>
        <div className="cp-right">
          <button type="button" className="btn" style={{ padding: "0 12px" }} onClick={() => setDay(day - 1)} aria-label="Previous day">
            ‹
          </button>
          <button type="button" className="btn" onClick={() => setDay(0)}>
            Today
          </button>
          <button type="button" className="btn" style={{ padding: "0 12px" }} onClick={() => setDay(day + 1)} aria-label="Next day">
            ›
          </button>
          <div className="cp-seg">
            {(["Day", "Week", "Month"] as const).map((r) => (
              <button key={r} type="button" className={range === r ? "on" : ""} onClick={() => { setRange(r); if (r !== "Day") toast(`${r} view is mocked in this demo`); }}>
                {r}
              </button>
            ))}
          </div>
          <button type="button" className="btn butter" onClick={() => setBooking(true)}>
            ⊕ New booking
          </button>
        </div>
      </div>

      <div className="cp-legend">
        <b>Treatment colours</b>
        {TREATMENTS.map((t) => (
          <span key={t.name} className="it">
            <span className="dot" style={{ background: t.accent }} />
            {t.name}
          </span>
        ))}
      </div>

      <div className="cp-diary">
        <div className="hd">
          <b>Day planner</b>· {appts?.length ?? 0} booked · 09:00–18:00
          <span className="vb">
            View by{" "}
            <select value={viewBy} onChange={(e) => setViewBy(e.target.value)} aria-label="View by practitioner">
              <option value="all">All practitioners</option>
              {(practs ?? [])
                .filter((p) => p.id !== "sm")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </span>
        </div>
        <div className="cp-planner" style={{ gridTemplateColumns: `52px repeat(${Math.max(columns.length, 1)}, 1fr)` }}>
          <div className="cp-gutter">
            {["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"].map((t) => (
              <div key={t}>{t}</div>
            ))}
          </div>
          {columns.map(({ p, appts: colAppts }) => (
            <div key={p.id}>
              <div className="cp-cohead">
                <span className="cp-ava" style={{ background: p.bg, color: p.fg }}>
                  {p.initials}
                </span>
                {p.name}
                <span className="n">{colAppts.length}</span>
              </div>
              <div className="cp-lanes" style={{ minHeight: 9 * HOUR }}>
                {colAppts.map((a) => (
                  <DiaryBlock key={a.id} a={a} onOpen={() => nav("/clinic/pastel/patients/grace-adeyemi")} />
                ))}
              </div>
            </div>
          ))}
          {columns.length === 0 && <div className="empty-note">No practitioners match this filter.</div>}
        </div>
        <div className="cp-quiet">
          {appts?.length ? "1 quiet hour · 17:30–18:00 · " : "No bookings this day · "}
          <button type="button" style={{ color: "#5b6a8f", textDecoration: "underline" }} onClick={() => setBooking(true)}>
            book something
          </button>
        </div>
      </div>

      <BookingModal
        open={booking}
        day={day}
        onClose={() => setBooking(false)}
        onBooked={(a) => {
          setBooking(false);
          reload();
          toast(`Booked ${a.patientName} — ${a.treatment} at ${fmtTime(a.start)}`);
        }}
      />
    </>
  );
}

function DiaryBlock({ a, onOpen }: { a: Appointment; onOpen: () => void }) {
  const top = ((a.start - DAY_START) / 60) * HOUR;
  const height = Math.max(((a.end - a.start) / 60) * HOUR, 42);
  return (
    <button
      type="button"
      className="cp-block"
      style={{ top, height, ["--bc" as never]: a.accent, ["--bg" as never]: a.tint }}
      onClick={onOpen}
      title={`${a.patientName} — ${a.treatment}`}
    >
      <span className="bt">
        {fmtTime(a.start)} – {fmtTime(a.end)}
        <span className="bi">
          ▤ ☰ <span style={{ color: a.status === "Complete" ? "#3f9e68" : "#8b96ad" }}>{a.status === "Complete" ? "✓" : "◷"}</span>
        </span>
      </span>
      <b>{a.patientName}</b>
      <small>
        {a.treatment} · {a.session}
      </small>
    </button>
  );
}

function BookingModal({
  open,
  day,
  onClose,
  onBooked,
}: {
  open: boolean;
  day: number;
  onClose: () => void;
  onBooked: (a: Appointment) => void;
}) {
  const { data: practs } = useLoad(() => api.getPractitioners());
  const [name, setName] = useState("");
  const [treatment, setTreatment] = useState(TREATMENTS[0].name);
  const [practitioner, setPractitioner] = useState("dn");
  const [time, setTime] = useState("12:00");
  const [duration, setDuration] = useState(45);
  const [busy, setBusy] = useState(false);

  async function book() {
    setBusy(true);
    const [h, m] = time.split(":").map(Number);
    const appt = await api.createBooking({
      patientName: name.trim() || "Walk-in patient",
      treatment,
      practitionerId: practitioner,
      start: h * 60 + m,
      durationMin: duration,
      dayOffset: day,
    });
    setBusy(false);
    setName("");
    onBooked(appt);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New booking"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn butter" disabled={busy} onClick={book}>
            {busy ? "Booking…" : "Book appointment"}
          </button>
        </>
      }
    >
      <label className="field">
        <span>Patient</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Start typing a name…" />
      </label>
      <label className="field">
        <span>Treatment</span>
        <select value={treatment} onChange={(e) => setTreatment(e.target.value)}>
          {TREATMENTS.map((t) => (
            <option key={t.name}>{t.name}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Practitioner</span>
        <select value={practitioner} onChange={(e) => setPractitioner(e.target.value)}>
          {(practs ?? [])
            .filter((p) => p.id !== "sm")
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label className="field">
          <span>Time</span>
          <select value={time} onChange={(e) => setTime(e.target.value)}>
            {["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "14:00", "15:00", "16:00", "17:00"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Duration</span>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {[30, 45, 60, 75].map((d) => (
              <option key={d} value={d}>
                {d} minutes
              </option>
            ))}
          </select>
        </label>
      </div>
      <p style={{ fontSize: 12, color: "#8996b7" }}>
        <Icon d="cal" size={12} style={{ verticalAlign: -2 }} /> The booking is written to the mock diary for the day currently shown.
      </p>
    </Modal>
  );
}
