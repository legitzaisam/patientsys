import { Icon } from "../components/Icon";
import { PageHead } from "../components/Shell";
import { Card, Head, LinkText } from "../components/ui";
import { clinic, clinician, completedTreatments, otherClinicHistory, upcomingTreatments } from "../mock/seed";

export function Clinic() {
  return (
    <>
      <PageHead title="My Clinic" subtitle="Your care team, clinic details and treatment history — all in one place." />

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.35fr", alignItems: "start" }}>
        <Card>
          <Head title="Your clinician" />
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img
              src={clinician.avatar}
              alt=""
              style={{ width: 76, height: 76, borderRadius: 18, objectFit: "cover", flex: "none" }}
            />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 600 }}>{clinician.name}</p>
              <p className="tiny" style={{ marginTop: 2 }}>
                {clinician.longTitle}
              </p>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 13 }}>
                View profile <Icon d="arrow" size={12} />
              </button>
            </div>
          </div>
        </Card>

        <Card>
          <Head title="Clinic details" />
          <div style={{ display: "flex", gap: 14 }}>
            <div style={{ minWidth: 0, flex: 1, display: "grid", gap: 11 }}>
              <Line icon="pin">
                <b style={{ fontWeight: 600 }}>{clinic.name}</b>
                {clinic.address.map((a) => (
                  <span key={a} style={{ display: "block" }}>
                    {a}
                  </span>
                ))}
              </Line>
              <Line icon="phone">{clinic.phone}</Line>
              <Line icon="mail">{clinic.email}</Line>
            </div>
            <div style={{ flex: "none", width: 190 }}>
              <MapPlaceholder />
              <div style={{ textAlign: "right", marginTop: 6 }}>
                <LinkText>Get directions</LinkText>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 13, alignItems: "start" }}>
        <Card>
          <Head icon="cal" title="Upcoming treatments" action={<LinkText icon={null}>See all</LinkText>} />
          {upcomingTreatments.map((t) => (
            <button key={t.date} type="button" className="rowlink">
              <span className="tile-icon" style={{ width: 28, height: 28, background: "var(--sky-bg)", color: "var(--sky-ink)" }}>
                <Icon d="cal" size={14} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>{t.date}</span>
                <span className="tiny">{t.name}</span>
              </span>
              <Icon d="right" size={13} stroke="var(--ink-3)" style={{ marginLeft: "auto" }} />
            </button>
          ))}
        </Card>

        <Card>
          <Head icon="checkCircle" title="Completed treatments" action={<LinkText icon={null}>See all</LinkText>} />
          {completedTreatments.map((t) => (
            <button key={t.date} type="button" className="rowlink">
              <span
                className="tile-icon"
                style={{ width: 28, height: 28, background: "var(--success-bg)", color: "var(--success-ink)" }}
              >
                <Icon d="cal" size={14} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>{t.date}</span>
                <span className="tiny">{t.name}</span>
              </span>
              <Icon d="right" size={13} stroke="var(--ink-3)" style={{ marginLeft: "auto" }} />
            </button>
          ))}
        </Card>
      </div>

      <Card style={{ marginTop: 13 }}>
        <Head
          icon="doc"
          title="Treatment history (other clinics)"
          sub="Keep a record of your previous treatments from other clinics to help us provide the best care."
          action={
            <button type="button" className="btn btn-ghost btn-sm">
              <Icon d="plus" size={12} /> Add past treatment
            </button>
          }
        />
        <table className="grid-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Treatment</th>
              <th>Clinic</th>
              <th style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {otherClinicHistory.map((r) => (
              <tr key={r.treatment}>
                <td className="muted num">{r.date}</td>
                <td style={{ fontWeight: 600 }}>{r.treatment}</td>
                <td className="muted">{r.clinic}</td>
                <td style={{ textAlign: "right" }}>
                  <Icon d="dots" size={15} stroke="var(--ink-3)" style={{ display: "inline-block" }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function Line({ icon, children }: { icon: "pin" | "phone" | "mail"; children: React.ReactNode }) {
  return (
    <p style={{ display: "flex", gap: 9, fontSize: 12.5 }}>
      <span className="tile-icon" style={{ width: 26, height: 26, background: "var(--glass-2)", color: "var(--accent-ink)" }}>
        <Icon d={icon} size={13} />
      </span>
      <span style={{ lineHeight: 1.45 }}>{children}</span>
    </p>
  );
}

/** Stylised street grid — stands in for the map tile in the mockup. */
function MapPlaceholder() {
  return (
    <div
      style={{
        position: "relative",
        height: 112,
        borderRadius: 14,
        overflow: "hidden",
        background: "linear-gradient(160deg, #eef1f4, #e6ebef)",
        boxShadow: "inset 0 0 0 1px var(--edge-2)",
      }}
    >
      {[18, 46, 76].map((t) => (
        <span key={t} style={{ position: "absolute", left: 0, right: 0, top: t, height: 5, background: "#fff" }} />
      ))}
      {[40, 104, 150].map((l) => (
        <span key={l} style={{ position: "absolute", top: 0, bottom: 0, left: l, width: 5, background: "#fff" }} />
      ))}
      <span
        style={{
          position: "absolute",
          left: 112,
          top: 34,
          width: 20,
          height: 20,
          display: "grid",
          placeItems: "center",
          color: "var(--success)",
        }}
      >
        <Icon d="pin" size={20} width={2.2} />
      </span>
    </div>
  );
}
