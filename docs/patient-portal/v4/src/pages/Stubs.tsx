import { Icon, type IconName } from "../components/Icon";
import { PageHead } from "../components/Shell";
import { Card, Chip, Head, LinkText } from "../components/ui";
import { clinician, latestMessage, upcomingTreatments } from "../mock/seed";

/**
 * Secondary destinations. The mockup set does not cover these screens, so they
 * are deliberately light — enough that every nav item leads somewhere real
 * while the seven designed pages stay the reference.
 */
function Placeholder({ icon, note }: { icon: IconName; note: string }) {
  return (
    <Card style={{ padding: 34, textAlign: "center" }}>
      <span
        className="tile-icon"
        style={{ width: 44, height: 44, margin: "0 auto", background: "var(--accent-soft)", color: "var(--accent-ink)" }}
      >
        <Icon d={icon} size={20} />
      </span>
      <p className="tiny" style={{ marginTop: 11, maxWidth: 380, marginInline: "auto", lineHeight: 1.5 }}>
        {note}
      </p>
      <Chip tone="line" style={{ marginTop: 11 }}>
        Not part of the V4 mockup set
      </Chip>
    </Card>
  );
}

export function Appointments() {
  return (
    <>
      <PageHead title="Appointments" subtitle="Everything booked, and everything you can book." />
      <Card style={{ marginBottom: 14 }}>
        <Head icon="cal" title="Upcoming" action={<LinkText icon={null}>See all</LinkText>} />
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
      <Placeholder icon="cal" note="Booking, rescheduling and reminders live here in the full product." />
    </>
  );
}

export function Billing() {
  return (
    <>
      <PageHead title="Billing" subtitle="Invoices, payments and your plan balance." />
      <Placeholder icon="bill" note="Invoices, saved cards and payment plans live here in the full product." />
    </>
  );
}

export function Settings() {
  return (
    <>
      <PageHead title="Settings" subtitle="Notifications, privacy and account preferences." />
      <Placeholder icon="gear" note="Notification channels, privacy controls and sign-in settings live here." />
    </>
  );
}

export function Resources() {
  return (
    <>
      <PageHead title="Resources" subtitle="Guides and aftercare from your clinic." />
      <Placeholder icon="book" note="Treatment guides, aftercare advice and FAQs live here in the full product." />
    </>
  );
}

export function Messages() {
  return (
    <>
      <PageHead title="Messages" subtitle="Your private conversation with the clinic." />
      <Card>
        <Head icon="mail" title={`Conversation with ${clinician.shortName}`} />
        <div style={{ display: "flex", gap: 9 }}>
          <span className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
            {clinician.initials}
          </span>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12.5, fontWeight: 600 }}>{clinician.shortName}</p>
            <p className="tiny">{latestMessage.when}</p>
            <p style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 6, lineHeight: 1.5 }}>{latestMessage.body}</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 13 }}>
          <input className="field" placeholder="Message your clinic…" />
          <button type="button" className="btn btn-primary" style={{ flex: "none" }}>
            Send
          </button>
        </div>
      </Card>
    </>
  );
}
