import type { ReactNode } from "react";
import { Icon, type IconName } from "../components/Icon";
import { PageHead } from "../components/Shell";
import { Card, Chip, Head, LinkText, Note } from "../components/ui";
import {
  clinic,
  clinicDocuments,
  emergencyContact,
  labResults,
  medicalHistory,
  patient,
  treatmentHistory,
} from "../mock/seed";

export function Records() {
  return (
    <>
      <PageHead
        title="My Profile / Records"
        subtitle="Keep your personal, medical and treatment information organised in one place."
      />

      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", alignItems: "start" }}>
        <Card>
          <EditableHead icon="person" title="Personal details" />
          <Field label="Full name" value={patient.name} />
          <Field label="Date of birth" value={patient.dob} />
          <Field label="Email address" value={patient.email} />
          <Field label="Phone number" value={patient.phone} />
          <Field label="Address" value={patient.address.join("\n")} />
        </Card>

        <Card>
          <EditableHead icon="phone" title="Emergency contact" />
          <Field label="Name" value={emergencyContact.name} />
          <Field label="Relationship" value={emergencyContact.relationship} />
          <Field label="Phone number" value={emergencyContact.phone} />
        </Card>

        <Card>
          <EditableHead icon="heart" title="Medical history" />
          <Stack label="Allergies" value={medicalHistory.allergies} />
          <Stack label="Current medications" value={medicalHistory.medications} />
          <Stack label="Medical conditions" value={medicalHistory.conditions} />
          <div style={{ marginTop: 11 }}>
            <Note icon="info">{medicalHistory.note}</Note>
          </div>
        </Card>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 13, alignItems: "start" }}>
        <Card>
          <RecordsHead icon="doc" title="Treatment history" />
          <div style={{ position: "relative", paddingLeft: 4, marginTop: 4 }}>
            <span style={{ position: "absolute", left: 8, top: 10, bottom: 12, width: 2, background: "var(--success)" }} />
            {treatmentHistory.map((t) => (
              <div key={t.date} style={{ display: "flex", gap: 12, padding: "7px 0" }}>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    background: "var(--success)",
                    marginTop: 5,
                    marginLeft: 4,
                    flex: "none",
                    zIndex: 1,
                  }}
                />
                <span className="tiny num" style={{ width: 78, flex: "none" }}>
                  {t.date}
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>{t.name}</span>
                  <span className="tiny">{clinic.name}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <RecordsHead icon="chart" title="Results & Labs" />
          {labResults.map((r) => (
            <button key={r.name} type="button" className="rowlink">
              <span className="tile-icon" style={{ width: 26, height: 26, background: "var(--glass-2)", color: "var(--accent-ink)" }}>
                <Icon d={r.icon as IconName} size={13} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>{r.name}</span>
                <span className="tiny">{r.date}</span>
              </span>
              <Icon d="right" size={13} stroke="var(--ink-3)" style={{ marginLeft: "auto" }} />
            </button>
          ))}
        </Card>

        <Card>
          <RecordsHead icon="doc" title="Clinic documents" />
          {clinicDocuments.map((d) => (
            <button key={d.name} type="button" className="rowlink">
              <span className="tile-icon" style={{ width: 26, height: 26, background: "var(--glass-2)", color: "var(--accent-ink)" }}>
                <Icon d="doc" size={13} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>{d.name}</span>
                <span className="tiny">{d.meta}</span>
              </span>
              <Icon d="right" size={13} stroke="var(--ink-3)" style={{ marginLeft: "auto" }} />
            </button>
          ))}
        </Card>
      </div>

      <Card style={{ marginTop: 13 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="tile-icon" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
            <Icon d="photo" size={16} />
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 className="section-title">Before & After Archive</h2>
              <Chip tone="line">
                <Icon d="lock" size={10} /> Clinic records
              </Chip>
            </div>
            <p className="tiny" style={{ marginTop: 2 }}>
              View your treatment progress with your before and after photos, all in one place.
            </p>
          </div>
          <button type="button" className="btn btn-ghost">
            View my gallery <Icon d="arrow" size={12} />
          </button>
        </div>
      </Card>
    </>
  );
}

/** Heading for patient-editable cards: badge plus an Edit button. */
function EditableHead({ icon, title }: { icon: IconName; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
      <Icon d={icon} size={16} stroke="var(--accent-ink)" style={{ marginTop: 2 }} />
      <div style={{ minWidth: 0 }}>
        <h2 className="section-title">{title}</h2>
        <Chip tone="line" style={{ marginTop: 4 }}>
          You can edit these details
        </Chip>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: "auto", flex: "none" }}>
        Edit <Icon d="pen" size={12} />
      </button>
    </div>
  );
}

/** Heading for clinic-owned cards: read-only badge plus View all. */
function RecordsHead({ icon, title }: { icon: IconName; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
      <Icon d={icon} size={16} stroke="var(--accent-ink)" style={{ marginTop: 2 }} />
      <div style={{ minWidth: 0 }}>
        <h2 className="section-title">{title}</h2>
        <Chip tone="line" style={{ marginTop: 4 }}>
          <Icon d="lock" size={10} /> Clinic records
        </Chip>
      </div>
      <span style={{ marginLeft: "auto", flex: "none" }}>
        <LinkText>View all</LinkText>
      </span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 10, padding: "4px 0" }}>
      <span className="tiny" style={{ width: 94, flex: "none" }}>
        {label}
      </span>
      <span style={{ fontSize: 12.5, whiteSpace: "pre-line" }}>{value}</span>
    </div>
  );
}

function Stack({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ marginBottom: 9 }}>
      <p style={{ fontSize: 11.5, fontWeight: 600 }}>{label}</p>
      <p className="tiny" style={{ marginTop: 1 }}>
        {value}
      </p>
    </div>
  );
}
