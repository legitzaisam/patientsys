import { Icon } from "../components/Icon";
import { PageHead } from "../components/Shell";
import { Avatar, Banner, Card, Chip, Head, LinkText, PhotoBlock, Ring, Scribble, StatTile } from "../components/ui";
import {
  clinicNews,
  clinician,
  latestMessage,
  nextAppointment,
  offer,
  patient,
  plan,
  progressSteps,
  quickActions,
} from "../mock/seed";

export function Home() {
  return (
    <>
      <PageHead
        title={`Good morning, ${patient.first}`}
        subtitle="A simple view of your skin journey, clinic updates and what's next."
        right={<Scribble lines={["Progress", "looks good", "on you."]} />}
      />

      <div className="grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <StatTile
          icon="doc"
          label="Current skin plan"
          value={plan.name}
          sub={plan.strapline}
        />
        <StatTile
          lead={<Ring pct={plan.completion} size={44} stroke={5} />}
          label=""
          value="Plan completion"
          sub={`${plan.milestonesDone} of ${plan.milestonesTotal} milestones`}
        />
        <StatTile
          icon="cal"
          iconBg="var(--sky-bg)"
          iconInk="var(--sky-ink)"
          label="Next appointment"
          value={nextAppointment.date}
          sub={nextAppointment.time}
        />
        <StatTile
          icon="person"
          iconBg="var(--rose-bg)"
          iconInk="var(--rose-ink)"
          label="Your clinician"
          value={clinician.shortName}
          sub={clinician.title}
        />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 13, alignItems: "start" }}>
        {/* ------------------------------------------------ column 1 */}
        <div className="grid">
          <Card>
            <Head icon="megaphone" title="Clinic news" action={<LinkText icon={null}>See all</LinkText>} />
            <PhotoBlock icon="clinicBag" height={96} label="Clinic" />
            <p style={{ fontSize: 13, fontWeight: 600, marginTop: 13 }}>{clinicNews.title}</p>
            <p className="tiny" style={{ marginTop: 3 }}>
              {clinicNews.body}
            </p>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 13 }}>
              {clinicNews.cta} <Icon d="arrow" size={12} />
            </button>
          </Card>

          <Card>
            <Head icon="chart" title="Your plan progress" action={<LinkText>View full plan</LinkText>} />
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <p style={{ fontSize: 12.5, fontWeight: 600 }}>{plan.name}</p>
              <p className="tiny num">
                {plan.milestonesDone} of {plan.milestonesTotal} milestones
              </p>
            </div>
            <div style={{ display: "flex", marginTop: 13 }}>
              {progressSteps.map((s, i) => (
                <div key={s.label} style={{ flex: 1, minWidth: 0, textAlign: "center", position: "relative" }}>
                  {i > 0 && (
                    <span
                      style={{
                        position: "absolute",
                        left: "-50%",
                        right: "50%",
                        top: 8,
                        height: 2,
                        background: s.state === "upcoming" ? "var(--bar)" : "var(--success)",
                      }}
                    />
                  )}
                  <span
                    style={{
                      position: "relative",
                      display: "grid",
                      placeItems: "center",
                      width: 17,
                      height: 17,
                      margin: "0 auto",
                      borderRadius: 999,
                      background:
                        s.state === "done"
                          ? "var(--success)"
                          : s.state === "current"
                            ? "var(--accent)"
                            : "var(--glass-2)",
                      boxShadow: s.state === "upcoming" ? "inset 0 0 0 1.5px var(--bar)" : "none",
                      color: s.state === "current" ? "var(--accent-ink)" : "#fff",
                    }}
                  >
                    {s.state === "done" && <Icon d="check" size={10} width={2.8} />}
                    {s.state === "current" && (
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--accent-ink)" }} />
                    )}
                  </span>
                  <p style={{ fontSize: 9.5, marginTop: 6, color: "var(--ink-2)", lineHeight: 1.25 }}>{s.label}</p>
                  {s.state === "done" ? (
                    <Icon d="check" size={10} stroke="var(--success)" style={{ margin: "2px auto 0" }} />
                  ) : (
                    <p style={{ fontSize: 8.5, color: "var(--ink-3)" }}>{s.note}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* ------------------------------------------------ column 2 */}
        <div className="grid">
          <Card>
            <Head icon="tag" title="Special offers" action={<LinkText icon={null}>See all</LinkText>} />
            <div
              style={{
                borderRadius: 14,
                background: "var(--rose-bg)",
                padding: "12px 14px",
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <Chip tone="rose" style={{ fontSize: 9 }}>
                  {offer.flag}
                </Chip>
                <p style={{ fontSize: 13.5, fontWeight: 600, marginTop: 7 }}>{offer.title}</p>
                <p className="tiny" style={{ marginTop: 3 }}>
                  {offer.body}
                </p>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ marginTop: 9, background: "#fff", color: "var(--foreground)" }}
                >
                  {offer.cta} <Icon d="arrow" size={12} />
                </button>
              </div>
              <PhotoBlock icon="drop" height={92} label="" style={{ width: 70, flex: "none" }} />
            </div>
          </Card>

          <Card>
            <Head icon="mail" title="Latest message from your clinic" action={<LinkText icon={null}>See all</LinkText>} />
            <div style={{ display: "flex", gap: 9 }}>
              <Avatar initials={latestMessage.initials} size={30} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 600 }}>{latestMessage.from}</p>
                <p className="tiny">{latestMessage.when}</p>
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 9, lineHeight: 1.5 }}>{latestMessage.body}</p>
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 13 }}>
              Reply <Icon d="arrow" size={12} />
            </button>
          </Card>
        </div>

        {/* ------------------------------------------------ column 3 */}
        <div className="grid">
          <Card>
            <Head icon="cal" title="Your next appointment" action={<Icon d="right" size={14} stroke="var(--ink-3)" />} />
            <div style={{ display: "flex", gap: 12 }}>
              <div
                className="soft-well"
                style={{ padding: "9px 12px", textAlign: "center", flex: "none", background: "var(--accent-wash)" }}
              >
                <p className="tiny" style={{ fontWeight: 600 }}>
                  {nextAppointment.weekday}
                </p>
                <p className="num" style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.1 }}>
                  {nextAppointment.day}
                </p>
                <p className="tiny">{nextAppointment.monthYear}</p>
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600 }}>{nextAppointment.treatment}</p>
                <p className="tiny" style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
                  <Icon d="clock" size={12} /> {nextAppointment.duration}
                </p>
                <p className="tiny" style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
                  <Icon d="pin" size={12} /> {nextAppointment.clinic}
                </p>
              </div>
            </div>
            <div className="row" style={{ gap: 7, marginTop: 11 }}>
              <button type="button" className="btn btn-primary btn-block btn-sm" style={{ whiteSpace: "nowrap" }}>
                Confirm appointment
              </button>
              <button type="button" className="btn btn-ghost btn-block btn-sm" style={{ whiteSpace: "nowrap" }}>
                Reschedule
              </button>
            </div>
          </Card>

          <Card>
            <Head icon="spark" title="Quick actions" />
            <div>
              {quickActions.map((a) => (
                <button key={a.label} type="button" className="rowlink">
                  <Icon d={a.icon as never} size={15} stroke="var(--accent-ink)" />
                  <span style={{ fontSize: 12.5 }}>{a.label}</span>
                  <Icon d="right" size={13} stroke="var(--ink-3)" style={{ marginLeft: "auto" }} />
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div style={{ marginTop: 13 }}>
        <Banner
          title="You're doing great"
          body="Consistency brings real results. Keep going — your skin journey matters."
          cta="View your journey"
        />
      </div>
    </>
  );
}
