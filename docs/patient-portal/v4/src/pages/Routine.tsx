import { Icon } from "../components/Icon";
import { PageHead, PlanTabs } from "../components/Shell";
import { Avatar, Banner, Card, Head, LinkText, PhotoBlock, Ring, Scribble } from "../components/ui";
import {
  adherence,
  clinician,
  eveningRoutine,
  morningRoutine,
  practitionerNote,
  reminder,
  routineBanner,
  skinResponse,
  type Product,
} from "../mock/seed";

export function Routine() {
  return (
    <>
      <PageHead
        title="My Skin Plan & Journey"
        subtitle="Practitioner-guided care, personalized for lasting results."
        right={<Scribble lines={["Progress", "looks good", "on you."]} />}
      />
      <PlanTabs />

      {/* Recommendation banner — Routine 2's strip with Routine 1's practitioner photo. */}
      <Card style={{ background: "var(--sky-bg)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <img
            src={clinician.avatar}
            alt=""
            style={{ width: 62, height: 62, borderRadius: 999, objectFit: "cover", flex: "none" }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600 }}>{routineBanner.title}</p>
            <p className="tiny" style={{ marginTop: 3, lineHeight: 1.5 }}>
              {routineBanner.body}
            </p>
          </div>
          <div
            style={{
              flex: "none",
              paddingLeft: 14,
              borderLeft: "1px solid var(--edge)",
              display: "flex",
              alignItems: "center",
              gap: 9,
            }}
          >
            <div style={{ textAlign: "right" }}>
              <p className="tiny" style={{ fontSize: 10 }}>
                From your care team
              </p>
              <p style={{ fontSize: 12.5, fontWeight: 600 }}>{clinician.shortName}</p>
              <p className="tiny" style={{ fontSize: 10 }}>
                {clinician.title}
              </p>
            </div>
            <Avatar initials={clinician.initials} size={30} />
          </div>
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 0.78fr", marginTop: 13, alignItems: "start" }}>
        <RoutineColumn
          icon="sun"
          title="Morning routine"
          sub="Protect, hydrate and prepare for the day."
          products={morningRoutine}
          addLabel="Add product to morning routine"
        />
        <RoutineColumn
          icon="moon"
          title="Evening routine"
          sub="Cleanse, treat and renew overnight."
          products={eveningRoutine}
          addLabel="Add product to evening routine"
        />

        <div className="grid">
          <Card>
            <Head icon="chart" title="Routine adherence" />
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 12.5, fontWeight: 600 }}>{adherence.headline}</p>
                <p className="tiny" style={{ marginTop: 3, lineHeight: 1.45 }}>
                  {adherence.body}
                </p>
              </div>
              <Ring pct={adherence.pct} size={56} stroke={6} />
            </div>
            <div style={{ marginTop: 13 }}>
              <LinkText>View details</LinkText>
            </div>
          </Card>

          <Card>
            <Head icon="bell" title="Upcoming reminder" action={<LinkText icon={null}>Edit</LinkText>} />
            <div style={{ display: "flex", gap: 9 }}>
              <Icon d="clock" size={15} stroke="var(--accent-ink)" style={{ marginTop: 2 }} />
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 12.5, fontWeight: 600 }}>{reminder.title}</p>
                <p className="tiny">{reminder.when}</p>
              </div>
            </div>
            <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 11 }}>
              {reminder.primary}
            </button>
            <button type="button" className="btn btn-ghost btn-block btn-sm" style={{ marginTop: 6 }}>
              {reminder.secondary}
            </button>
          </Card>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 11, alignItems: "start" }}>
        <Card>
          <Head icon="chart" title="Skin response" sub="Track how your skin is responding to your routine." />
          <div className="soft-well" style={{ padding: "11px 12px", background: "var(--success-bg)", display: "flex", gap: 10 }}>
            <Icon d="smile" size={18} stroke="var(--success-ink)" style={{ marginTop: 1 }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 600, color: "var(--success-ink)" }}>{skinResponse.headline}</p>
              <p className="tiny" style={{ marginTop: 2, color: "var(--success-ink)", lineHeight: 1.45 }}>
                {skinResponse.body}
              </p>
            </div>
          </div>
          <div style={{ marginTop: 13 }}>
            <LinkText>View skin journal</LinkText>
          </div>
        </Card>

        <Card>
          <Head icon="msg" title="Practitioner note" action={<span className="tiny">{practitionerNote.date}</span>} />
          <div style={{ display: "flex", gap: 9 }}>
            <Avatar initials={clinician.initials} size={30} />
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12.5, fontWeight: 600 }}>{clinician.shortName}</p>
              <p className="tiny" style={{ fontSize: 10 }}>
                {clinician.title}
              </p>
            </div>
          </div>
          <p className="tiny" style={{ marginTop: 9, lineHeight: 1.5 }}>
            {practitionerNote.body}
          </p>
        </Card>

        <Card>
          <Head icon="book" title="Product guide" />
          <p className="tiny" style={{ lineHeight: 1.5 }}>
            Learn more about your products, how they work and tips for the best results.
          </p>
          <div style={{ display: "flex", gap: 6, margin: "9px 0" }}>
            {["drop", "spark", "moon"].map((ic) => (
              <PhotoBlock key={ic} icon={ic as never} height={42} style={{ flex: 1 }} />
            ))}
          </div>
          <button type="button" className="btn btn-ghost btn-block">
            View product guide <Icon d="arrow" size={12} />
          </button>
        </Card>
      </div>

      <div style={{ marginTop: 13 }}>
        <Banner
          title="Consistency brings real results."
          body="Stick with your routine, track your progress and reach out anytime — we're here to support you."
          cta="View your journey"
        />
      </div>
    </>
  );
}

function RoutineColumn({
  icon,
  title,
  sub,
  products,
  addLabel,
}: {
  icon: "sun" | "moon";
  title: string;
  sub: string;
  products: Product[];
  addLabel: string;
}) {
  return (
    <Card>
      <Head
        icon={icon}
        title={title}
        sub={sub}
        action={
          <button type="button" className="link">
            <Icon d="pen" size={12} /> Edit routine
          </button>
        }
      />
      <div style={{ display: "grid", gap: 0 }}>
        {products.map((p) => (
          <div key={p.step} className="rowlink" style={{ cursor: "default", gap: 9, padding: "5px 9px" }}>
            <PhotoBlock icon="drop" height={30} style={{ width: 25, flex: "none", borderRadius: 8 }} />
            <div style={{ width: "42%", flex: "none", minWidth: 0 }}>
              <p className="tiny" style={{ fontSize: 9.5, lineHeight: 1.2 }}>
                {p.step}
              </p>
              <p style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.25 }}>{p.name}</p>
            </div>
            <p className="tiny" style={{ flex: 1, minWidth: 0, fontSize: 10.5, lineHeight: 1.35 }}>
              {p.how}
            </p>
            <Icon d="pen" size={12} stroke="var(--ink-3)" />
          </div>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-block"
        style={{ marginTop: 6, borderRadius: 13, height: 34, background: "var(--glass-2)" }}
      >
        <span className="tile-icon" style={{ width: 20, height: 20, background: "var(--success-bg)", color: "var(--success-ink)" }}>
          <Icon d="plus" size={12} />
        </span>
        {addLabel}
      </button>
    </Card>
  );
}
