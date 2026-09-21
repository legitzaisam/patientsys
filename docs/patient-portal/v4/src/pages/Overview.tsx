import { Icon } from "../components/Icon";
import { PageHead, PlanTabs } from "../components/Shell";
import { Card, Ck, Head, LinkText, Note, ReadSlider, Ring } from "../components/ui";
import {
  beforeAfter,
  checkIn,
  clinician,
  journeySnapshot,
  nextAppointment,
  plan,
  safeToProceed,
  todayAction,
} from "../mock/seed";

/** The KPI strip that sits beside the plan title on every plan page. */
function PlanKpis() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", justifyContent: "flex-end" }}>
      <div className="glass-card" style={{ padding: "7px 11px", display: "flex", alignItems: "center", gap: 8 }}>
        <Ring pct={plan.completion} size={36} stroke={4.5} />
        <span>
          <span style={{ display: "block", fontSize: 12, fontWeight: 600 }}>Plan completion</span>
          <span className="tiny">
            {plan.milestonesDone} of {plan.milestonesTotal} milestones
          </span>
        </span>
      </div>
      <div className="glass-card" style={{ padding: "7px 11px", display: "flex", alignItems: "center", gap: 8 }}>
        <span className="tile-icon" style={{ width: 26, height: 26, background: "var(--rose-bg)", color: "var(--rose-ink)" }}>
          <Icon d="person" size={14} />
        </span>
        <span>
          <span className="tiny" style={{ display: "block" }}>
            Your clinician
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{clinician.shortName}</span>
          <span className="tiny" style={{ display: "block", fontSize: 10 }}>
            {clinician.title}
          </span>
        </span>
      </div>
      <div className="glass-card" style={{ padding: "7px 11px", display: "flex", alignItems: "center", gap: 8 }}>
        <span className="tile-icon" style={{ width: 26, height: 26, background: "var(--sky-bg)", color: "var(--sky-ink)" }}>
          <Icon d="cal" size={14} />
        </span>
        <span>
          <span className="tiny" style={{ display: "block" }}>
            Next appointment
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{nextAppointment.date}</span>
          <span className="tiny" style={{ display: "block", fontSize: 10 }}>
            {nextAppointment.treatment} · {nextAppointment.time}
          </span>
        </span>
      </div>
      <div className="glass-card" style={{ padding: "7px 11px", display: "flex", alignItems: "center", gap: 8 }}>
        <span className="tile-icon" style={{ width: 26, height: 26, background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
          <Icon d="layers" size={14} />
        </span>
        <span>
          <span className="tiny" style={{ display: "block" }}>
            Current phase
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600 }}>{plan.phase}</span>
          <span className="tiny" style={{ display: "block", fontSize: 10 }}>
            {plan.phaseLabel}
          </span>
        </span>
      </div>
    </div>
  );
}

export function Overview() {
  return (
    <>
      <PageHead eyebrow="Your plan" title={plan.name} subtitle={plan.straplineAlt} right={<PlanKpis />} />
      <PlanTabs />

      <div className="grid" style={{ gridTemplateColumns: "1.05fr 1fr 1fr", alignItems: "start" }}>
        {/* ------------------------------------------- today / next action */}
        <Card>
          <Head
            icon="sun"
            title="Today / Next action"
            action={<span className="tiny num">{todayAction.day}</span>}
          />
          <div className="soft-well" style={{ padding: 12, display: "flex", gap: 10 }}>
            <span className="tile-icon" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
              <Icon d="doc" size={15} />
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 600 }}>{todayAction.title}</p>
              <p className="tiny" style={{ marginTop: 3 }}>
                {todayAction.body}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 13 }}>
                <button type="button" className="btn btn-primary btn-sm">
                  <Icon d="upload" size={13} /> {todayAction.primary}
                </button>
                <LinkText>{todayAction.secondary}</LinkText>
              </div>
            </div>
          </div>
          {todayAction.tasks.map((t) => (
            <button key={t.title} type="button" className="rowlink" style={{ marginTop: 6 }}>
              <span className="ck" />
              <span className="tile-icon" style={{ width: 26, height: 26, background: "var(--glass-2)", color: "var(--ink-2)" }}>
                <Icon d={t.icon as never} size={13} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>{t.title}</span>
                <span className="tiny">{t.sub}</span>
              </span>
              <Icon d="right" size={13} stroke="var(--ink-3)" style={{ marginLeft: "auto" }} />
            </button>
          ))}
        </Card>

        {/* ------------------------------------------------ recovery check-in */}
        <Card>
          <Head
            icon="heart"
            title="Recovery Check-in"
            sub={checkIn.question}
            action={<span className="tiny">{checkIn.date}</span>}
          />
          <div style={{ display: "grid", gap: 9, marginTop: 4 }}>
            {checkIn.rows.map((r) => (
              <ReadSlider key={r.label} label={r.label} value={r.value} reading={r.reading} />
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <LinkText>{checkIn.noteLink}</LinkText>
          </div>
          <div style={{ marginTop: 13 }}>
            <Note tone="danger" icon="warn">
              {checkIn.alert}
            </Note>
          </div>
        </Card>

        {/* -------------------------------------------- before & after */}
        <Card>
          <Head icon="chart" title="Before & After Progress" action={<LinkText icon={null}>See all</LinkText>} />
          <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[beforeAfter.before, beforeAfter.after].map((p) => (
              <div key={p.label}>
                <img
                  src={p.image}
                  alt=""
                  style={{ width: "100%", height: 96, objectFit: "cover", borderRadius: 12 }}
                />
                <p style={{ fontSize: 11.5, fontWeight: 600, marginTop: 5 }}>{p.label}</p>
                <p className="tiny">{p.date}</p>
              </div>
            ))}
            <button
              type="button"
              className="icon-btn"
              style={{
                position: "absolute",
                left: "50%",
                top: 48,
                transform: "translate(-50%, -50%)",
                background: "#fff",
                boxShadow: "var(--shadow-glass)",
              }}
              aria-label="Compare"
            >
              <Icon d="left" size={11} />
              <Icon d="right" size={11} />
            </button>
          </div>
          <div className="soft-well" style={{ padding: "10px 12px", marginTop: 11, background: "var(--success-bg)" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--success-ink)" }}>Visible improvements</p>
            <div style={{ marginTop: 5, display: "grid", gap: 3 }}>
              {beforeAfter.improvements.map((i) => (
                <p key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5 }}>
                  <Icon d="check" size={12} width={2.4} stroke="var(--success)" />
                  {i}
                </p>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "2.1fr 1fr", marginTop: 13, alignItems: "start" }}>
        {/* ----------------------------------------------- journey snapshot */}
        <Card>
          <Head icon="layers" title="Your Journey Snapshot" action={<LinkText>View full timeline</LinkText>} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {journeySnapshot.map((m, mi) => (
              <div key={m.month}>
                <p className="tiny">{m.month}</p>
                <p style={{ fontSize: 12.5, fontWeight: 600 }}>{m.title}</p>
                <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "9px 0 10px" }}>
                  {m.steps.map((s, si) => (
                    <span key={s.label} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                      <span
                        style={{
                          width: 13,
                          height: 13,
                          borderRadius: 999,
                          flex: "none",
                          display: "grid",
                          placeItems: "center",
                          background: s.done ? "var(--success)" : mi === 1 && si === 0 ? "var(--accent)" : "var(--glass-2)",
                          boxShadow: !s.done && !(mi === 1 && si === 0) ? "inset 0 0 0 1.5px var(--bar)" : "none",
                          color: "#fff",
                        }}
                      >
                        {s.done && <Icon d="check" size={8} width={3} />}
                      </span>
                      {si < m.steps.length - 1 && (
                        <span style={{ flex: 1, height: 2, background: s.done ? "var(--success)" : "var(--bar)" }} />
                      )}
                    </span>
                  ))}
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  {m.steps.map((s) => (
                    <p key={s.label} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5 }}>
                      <span
                        className={`ck ${s.done ? "on" : ""}`}
                        style={{ width: 13, height: 13, borderRadius: 4 }}
                      >
                        <Icon d="check" size={9} width={3} />
                      </span>
                      <span style={{ color: s.done ? "var(--foreground)" : "var(--muted-foreground)" }}>{s.label}</span>
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ------------------------------------------------- safe to proceed */}
        <Card>
          <Head icon="shield" title="Safe to Proceed?" sub={safeToProceed.blurb} />
          <div>
            {safeToProceed.items.map((i) => (
              <Ck key={i.label} on={i.done} label={i.label} />
            ))}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-block"
            style={{ marginTop: 13, justifyContent: "space-between" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Icon d="doc" size={13} /> View checklist
            </span>
            <Icon d="right" size={13} />
          </button>
        </Card>
      </div>
    </>
  );
}
