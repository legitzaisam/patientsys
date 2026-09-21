import { Link } from "react-router-dom";
import { Icon, type IconName } from "../components/Icon";

const SCREENS: { to: string; title: string; blurb: string; icon: IconName; designed: boolean }[] = [
  { to: "/home", title: "Home", blurb: "Greeting, plan snapshot, news, next appointment", icon: "home", designed: true },
  { to: "/plan", title: "Plan · Overview", blurb: "Today's action, check-in, before & after, safe to proceed", icon: "chart", designed: true },
  { to: "/plan/timeline", title: "Plan · Timeline", blurb: "Roadmap, step details, pause request", icon: "layers", designed: true },
  { to: "/plan/journal", title: "Plan · Journal", blurb: "Entries, photos, voice notes, calendar", icon: "pen", designed: true },
  { to: "/plan/routine", title: "Plan · Skincare Routine", blurb: "AM/PM products, adherence, reminders", icon: "drop", designed: true },
  { to: "/clinic", title: "My Clinic", blurb: "Care team, clinic details, treatment history", icon: "clinicBag", designed: true },
  { to: "/records", title: "My Profile / Records", blurb: "Personal, medical, labs and documents", icon: "person", designed: true },
  { to: "/appointments", title: "Appointments", blurb: "Secondary screen", icon: "cal", designed: false },
  { to: "/billing", title: "Billing", blurb: "Secondary screen", icon: "bill", designed: false },
  { to: "/settings", title: "Settings", blurb: "Secondary screen", icon: "gear", designed: false },
  { to: "/resources", title: "Resources", blurb: "Secondary screen", icon: "book", designed: false },
  { to: "/messages", title: "Messages", blurb: "Secondary screen", icon: "mail", designed: false },
];

export function Launcher() {
  return (
    <div className="launcher">
      <p className="eyebrow">Aetheria · Patient portal</p>
      <h1 className="page-title" style={{ fontSize: 30 }}>
        V4 wireframes
      </h1>
      <p className="page-subtitle" style={{ maxWidth: 580 }}>
        The Vivara mockups rebuilt in the clinic portal's theme — butter accent, ink text, glass surfaces and Space
        Grotesk. Seven designed screens plus the secondary destinations so every nav item leads somewhere.
      </p>

      <div className="launch-grid">
        {SCREENS.map((s) => (
          <Link key={s.to} to={s.to} className="launch-card">
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                className="tile-icon"
                style={{
                  background: s.designed ? "var(--accent-soft)" : "var(--glass-2)",
                  color: s.designed ? "var(--accent-ink)" : "var(--ink-3)",
                }}
              >
                <Icon d={s.icon} size={15} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>{s.title}</span>
                <span className="tiny">{s.blurb}</span>
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
