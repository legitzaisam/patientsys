import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Icon, type IconName } from "./Icon";
import { Avatar } from "./ui";
import { PortalDock } from "./PortalDock";
import { messagesUnread, notificationsUnread, patient } from "../mock/seed";

const MAIN: { to: string; icon: IconName; label: string }[] = [
  { to: "/home", icon: "home", label: "Home" },
  { to: "/plan", icon: "chart", label: "Skin Plan & Journey" },
  { to: "/clinic", icon: "clinicBag", label: "My Clinic" },
  { to: "/records", icon: "person", label: "My Profile / Records" },
  { to: "/appointments", icon: "cal", label: "Appointments" },
  { to: "/billing", icon: "bill", label: "Billing" },
  { to: "/settings", icon: "gear", label: "Settings" },
];

const SUPPORT: { to: string; icon: IconName; label: string; count?: number }[] = [
  { to: "/resources", icon: "book", label: "Resources" },
  { to: "/messages", icon: "mail", label: "Messages", count: messagesUnread },
];

/** Sub-items under Skin Plan & Journey, mirroring the mockups' expanded nav. */
const PLAN_TABS = [
  { to: "/plan", label: "Overview", end: true },
  { to: "/plan/timeline", label: "Timeline" },
  { to: "/plan/journal", label: "Journal" },
  { to: "/plan/routine", label: "Skincare Routine" },
];

export function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const planOpen = pathname.startsWith("/plan");

  return (
    <div className="app">
      <aside className="sidebar">
        <NavLink to="/" className="brand">
          <span className="brand-mark">Æ</span>
          <span>
            <span className="brand-name" style={{ display: "block" }}>
              AETHERIA
            </span>
            <span className="brand-tag">Skin health for what's next</span>
          </span>
        </NavLink>

        <nav className="navgroup">
          {MAIN.map((item) => (
            <div key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/plan"}
                className={({ isActive }) =>
                  `navitem ${isActive || (item.to === "/plan" && planOpen) ? "on" : ""}`
                }
              >
                <Icon d={item.icon} size={15} />
                {item.label}
              </NavLink>
              {item.to === "/plan" && planOpen && (
                <div className="subnav">
                  {PLAN_TABS.map((t) => (
                    <NavLink
                      key={t.to}
                      to={t.to}
                      end={t.end}
                      className={({ isActive }) => `subitem ${isActive ? "on" : ""}`}
                    >
                      {t.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <p className="navlabel">Support</p>
        <nav className="navgroup" style={{ paddingTop: 0 }}>
          {SUPPORT.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `navitem ${isActive ? "on" : ""}`}>
              <Icon d={item.icon} size={15} />
              {item.label}
              {item.count ? <span className="count">{item.count}</span> : null}
            </NavLink>
          ))}
        </nav>

        <div className="help-card">
          <p style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600 }}>
            <Icon d="help" size={14} stroke="var(--accent-ink)" />
            Need help?
          </p>
          <button type="button" className="link" style={{ marginTop: 4 }}>
            Contact our team <Icon d="arrow" size={11} />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button type="button" className="icon-btn" aria-label="Notifications">
            <Icon d="bell" size={15} />
            {notificationsUnread > 0 && <span className="dot">{notificationsUnread}</span>}
          </button>
          <button type="button" className="icon-btn" aria-label="Messages">
            <Icon d="mail" size={15} />
          </button>
          <div className="who">
            <Avatar src={patient.avatar} size={28} />
            <span>
              <span style={{ display: "block", fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{patient.name}</span>
              <span className="tiny" style={{ fontSize: 10 }}>
                {patient.role}
              </span>
            </span>
            <Icon d="down" size={13} stroke="var(--ink-3)" />
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
      <PortalDock />
    </div>
  );
}

/** Page header: title block left, optional control on the same row (workspace rule). */
export function PageHead({
  eyebrow,
  title,
  subtitle,
  right,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/** The four plan tabs rendered as the clinic portal's segmented pill control. */
export function PlanTabs() {
  return (
    <div className="pillbar" style={{ marginBottom: 14 }}>
      {PLAN_TABS.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => `pill ${isActive ? "on" : ""}`}>
          {t.label}
        </NavLink>
      ))}
    </div>
  );
}
