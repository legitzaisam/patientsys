import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { useToast } from "../../../components/Toast";
import "../../../styles/pastel.css";

export const CP_TEAM = [
  ["DA", "#dff0e6", "#2e7d5b", "Dr Amara Osei", "Clinic Director"],
  ["DN", "#fae9be", "#7a5f18", "Dr Nadia Rahman", "Aesthetic Practitioner"],
  ["DT", "#f2eefe", "#7a5fb8", "Dr Tom Whitfield", "Aesthetic Doctor"],
  ["SM", "#fdebf4", "#c2588a", "Sofia Marchetti", "Front of House"],
] as const;

export function PastelShell() {
  const toast = useToast();
  const nav = useNavigate();

  return (
    <div className="cp-root">
      <aside className="cp-side">
        <div className="cp-logo">
          <span className="mark">❧</span>
          <div>
            <b>Aetheria</b>
            <small>CLINIC&nbsp;PORTAL</small>
          </div>
        </div>
        <div className="cp-group">Clinic</div>
        <nav className="cp-nav">
          <NavLink to="/clinic/pastel/overview">
            <Icon d="home" size={17} />
            Dashboard
          </NavLink>
          <NavLink to="/clinic/pastel/diary">
            <Icon d="cal" size={17} />
            Diary<span className="n">10</span>
          </NavLink>
          <NavLink to="/clinic/pastel/patients" end>
            <Icon d="users" size={17} />
            Patients
          </NavLink>
        </nav>
        <div className="cp-group">Reports</div>
        <nav className="cp-nav">
          <NavLink to="/clinic/pastel/retention">
            <Icon d="trend" size={17} />
            Retention
          </NavLink>
          <NavLink to="/clinic/pastel/performance">
            <Icon d="chart" size={17} />
            Performance
          </NavLink>
        </nav>
        <div className="cp-group">Team</div>
        <nav className="cp-nav">
          {CP_TEAM.map(([ini, bg, fg, name, role]) => (
            <button key={ini} type="button" className="cp-team" onClick={() => toast(`${name} — ${role} (profile pages are mocked)`)}>
              <span className="cp-ava" style={{ background: bg, color: fg }}>
                {ini}
              </span>
              {name}
            </button>
          ))}
        </nav>
        <div className="cp-art">
          <img src="/assets/sidebar-leaf.png" alt="" />
          <div className="cap">
            <b>Exceptional care, healthier tomorrows.</b>
            <span>A healthier, more confident you. Together.</span>
          </div>
        </div>
      </aside>
      <div className="cp-main">
        <div className="cp-top">
          <div className="cp-search">
            ⌕
            <input
              placeholder="Search patients, treatments or notes…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const q = (e.target as HTMLInputElement).value;
                  nav(`/clinic/pastel/patients${q ? `?q=${encodeURIComponent(q)}` : ""}`);
                }
              }}
            />
            <span className="k">⌘ K</span>
          </div>
          <div className="cp-icons">
            <button type="button" onClick={() => { if (location.pathname.endsWith("grace-adeyemi")) toast("You are already viewing Grace\u2019s record \u2014 messages are in the right panel"); else nav("/clinic/pastel/patients/grace-adeyemi"); }} aria-label="Chats">
              <Icon d="msg" size={19} />
            </button>
            <button type="button" onClick={() => toast("2 unread emails (mail is mocked)")} aria-label="Mail">
              <Icon d="mail" size={19} />
              <em>2</em>
            </button>
            <button type="button" onClick={() => toast("4 notifications: 1 no-show, 14 deposits due, 5 consents due")} aria-label="Notifications">
              <Icon d="bell" size={19} />
              <em>4</em>
            </button>
          </div>
          <div className="cp-me" onClick={() => toast("Signed in as Dr Amara Osei (Clinic Owner)")}>
            <span className="cp-ava" style={{ width: 36, height: 36, fontSize: 12, background: "#dff0e6", color: "#2e7d5b" }}>
              DA
            </span>
            <div>
              <b>Dr Amara Osei</b>
              <small>Clinic Owner</small>
            </div>
            <span style={{ color: "#aab3c6" }}>▾</span>
          </div>
        </div>
        <div className="cp-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
