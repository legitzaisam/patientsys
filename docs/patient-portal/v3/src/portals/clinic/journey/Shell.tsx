import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { useToast } from "../../../components/Toast";
import { CP_TEAM } from "../pastel/Shell";
import "../../../styles/journey.css";

export function JourneyShell() {
  const toast = useToast();
  const nav = useNavigate();
  return (
    <div className="cj-root">
      <aside className="cj-side">
        <div className="cj-logo">
          <span className="mark">✦</span>
          <div>
            <b>Aetheria</b>
            <small>SKIN&nbsp;CLINIC</small>
          </div>
        </div>
        <div className="cj-group">Clinic</div>
        <nav className="cj-nav">
          <NavLink to="/clinic/journey/overview">
            <Icon d="grid" size={16} />
            Dashboard
          </NavLink>
          <NavLink to="/clinic/journey/diary">
            <Icon d="cal" size={16} />
            Diary
          </NavLink>
          <NavLink to="/clinic/journey/patients" end>
            <Icon d="users" size={16} />
            Patients
          </NavLink>
          <NavLink to="/clinic/journey/board">
            <Icon d="task" size={16} />
            Journey board
          </NavLink>
        </nav>
        <div className="cj-group g2">Reports</div>
        <nav className="cj-nav">
          <NavLink to="/clinic/journey/retention">
            <Icon d="trend" size={16} />
            Retention
          </NavLink>
          <NavLink to="/clinic/journey/performance">
            <Icon d="chart" size={16} />
            Performance
          </NavLink>
        </nav>
        <div className="cj-group g2">Team</div>
        <nav className="cj-nav">
          {CP_TEAM.map(([ini, bg, fg, name, role]) => (
            <button key={ini} type="button" className="cj-team" onClick={() => toast(`${name} — ${role} (profile pages are mocked)`)}>
              <span className="cp-ava" style={{ background: bg, color: fg }}>
                {ini}
              </span>
              {name}
            </button>
          ))}
        </nav>
        <div className="cj-art">
          <img src="/assets/sidebar-silk.png" alt="" />
          <div className="cap">
            <b>Confident skin brighter futures.</b>
            <span>Your patients' journey makes a difference.</span>
          </div>
        </div>
      </aside>
      <div className="cj-main">
        <div className="cj-top">
          <div className="cj-search">
            ⌕
            <input
              placeholder="Search patients, appointments, or treatments…"
              onKeyDown={(e) => e.key === "Enter" && nav("/clinic/journey/patients")}
            />
          </div>
          <div className="cj-script caveat">
            Healthy skin
            <br />
            brighter tomorrows
          </div>
          <button type="button" className="cj-bell" onClick={() => toast("3 notifications: blood results missing, consent outstanding, adverse reaction follow-up")} aria-label="Notifications">
            <Icon d="bell" size={18} />
            <em>3</em>
          </button>
          <div className="cj-me" onClick={() => toast("Signed in as Dr Amara Osei (Clinic Owner)")}>
            <span className="cp-ava" style={{ width: 34, height: 34, fontSize: 11.5, background: "#fae9be", color: "#7a5f18" }}>
              DA
            </span>
            <div>
              <b>Dr Amara Osei</b>
              <small>Clinic Owner</small>
            </div>
            <span style={{ color: "#aab3c6" }}>▾</span>
          </div>
        </div>
        <div className="cj-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
