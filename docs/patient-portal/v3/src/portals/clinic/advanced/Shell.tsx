import { NavLink, Outlet } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import { useToast } from "../../../components/Toast";
import "../../../styles/advanced.css";

const LINKS: Array<[string, string]> = [
  ["Overview", "/clinic/advanced/overview"],
  ["Diary", "/clinic/advanced/diary"],
  ["Patients", "/clinic/advanced/patients"],
  ["Journey Board", "/clinic/advanced/board"],
  ["Reports", "/clinic/advanced/reports"],
  ["Messages", "/clinic/advanced/messages"],
];

export function AdvancedShell() {
  const toast = useToast();
  return (
    <div className="ca-root">
      <div className="ca-nav">
        <div className="ca-logo">
          <span className="lf">❧</span>
          <div>
            <b>AETHERIA</b>
            <small>ADVANCED SKIN HEALTH</small>
          </div>
        </div>
        <div className="ca-links">
          {LINKS.map(([label, to]) => (
            <NavLink key={label} to={to}>
              {label}
            </NavLink>
          ))}
        </div>
        <div className="ca-right">
          <button type="button" className="ca-bell" onClick={() => toast("3 notifications: bloods pending, consent incomplete, sensitivity report")} aria-label="Notifications">
            <Icon d="bell" size={17} />
            <em>3</em>
          </button>
          <span className="ao">AO</span>
          <b style={{ fontSize: 13 }}>Dr Amara Osei</b>
          <span style={{ color: "#9aa5ab" }}>▾</span>
        </div>
      </div>
      <div className="ca-body">
        <Outlet />
      </div>
    </div>
  );
}

export function CaHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="ca-headrow">
      <div>
        <div className="ca-eyebrow">CLINIC</div>
        <h1>{title}</h1>
        <div className="sub">{sub}</div>
      </div>
      <div className="ca-script caveat">
        Healthier
        <br />
        Skin Brighter
        <br />
        Tomorrows
      </div>
    </div>
  );
}

export function CaStat({
  v,
  label,
  delta,
  deltaColor,
  em,
  onClick,
}: {
  v: string;
  label: string;
  delta: string;
  deltaColor: string;
  em: string;
  onClick?: () => void;
}) {
  return (
    <button type="button" className="ca-stat" onClick={onClick}>
      <span className="ic">
        <Icon d="layers" size={17} />
      </span>
      <span>
        <span className="v">{v}</span>
        <small>{label}</small>
      </span>
      <span className="d" style={{ color: deltaColor }}>
        {delta}
        <em>{em}</em>
      </span>
    </button>
  );
}
