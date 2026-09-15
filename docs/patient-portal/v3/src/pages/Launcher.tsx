import { Link } from "react-router-dom";
import { DIRECTIONS } from "../screens";

export function Launcher() {
  return (
    <div className="launch">
      <h1>AETHERIA</h1>
      <div className="sub">V3 interactive wireframes — two portals, six design directions, fifteen screens. Everything clicks.</div>
      <div className="cols">
        <div>
          <h2>PATIENT PORTAL</h2>
          {DIRECTIONS.filter((d) => d.portal === "patient").map((d) => (
            <Link key={d.id} className="dircard" to={d.first}>
              <span className="go">Open →</span>
              <b>{d.id}</b>
              <span>{d.blurb}</span>
            </Link>
          ))}
        </div>
        <div>
          <h2>CLINIC PORTAL</h2>
          {DIRECTIONS.filter((d) => d.portal === "clinic").map((d) => (
            <Link key={d.id} className="dircard" to={d.first}>
              <span className="go">Open →</span>
              <b>{d.id}</b>
              <span>{d.blurb}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
