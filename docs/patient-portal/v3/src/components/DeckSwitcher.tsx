import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DIRECTIONS, SCREENS } from "../screens";
import { api } from "../mock/api";
import { useToast } from "./Toast";

/** Floating dock present on every route: portal/direction/screen switching + demo reset. */
export function DeckSwitcher() {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const toast = useToast();

  const idx = useMemo(() => SCREENS.findIndex((s) => s.path === pathname), [pathname]);
  const current = idx >= 0 ? SCREENS[idx] : null;
  const portal = current?.portal ?? (pathname.startsWith("/clinic") ? "clinic" : pathname.startsWith("/patient") ? "patient" : null);

  return (
    <div className="dock">
      <span className="lbl">{portal ? portal.toUpperCase() : "V3"}</span>
      <div className="pills">
        {DIRECTIONS.filter((d) => !portal || d.portal === portal).map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={current?.dir === d.id}
            onClick={() => nav(d.first)}
          >
            {d.id}
          </button>
        ))}
      </div>
      <div className="step">
        <button type="button" disabled={idx <= 0} onClick={() => nav(SCREENS[idx - 1].path)} aria-label="Previous screen">
          ←
        </button>
        <span className="pos">{idx >= 0 ? `${idx + 1} / ${SCREENS.length}` : "— / 15"}</span>
        <button
          type="button"
          disabled={idx === SCREENS.length - 1}
          onClick={() => nav(SCREENS[Math.max(idx, 0) + (idx >= 0 ? 1 : 0)].path)}
          aria-label="Next screen"
        >
          →
        </button>
      </div>
      <select value={current?.path ?? ""} onChange={(e) => nav(e.target.value)} aria-label="Jump to screen">
        {!current && <option value="">Jump to…</option>}
        {SCREENS.map((s) => (
          <option key={s.path} value={s.path}>
            {s.dir} — {s.title}
          </option>
        ))}
      </select>
      {portal && (
        <button type="button" className="dbtn" onClick={() => nav(portal === "patient" ? "/clinic/pastel/overview" : "/patient/lumina")}>
          {portal === "patient" ? "Clinic →" : "Patient →"}
        </button>
      )}
      <button type="button" className="dbtn" onClick={() => nav("/")}>
        Home
      </button>
      <button
        type="button"
        className="dbtn"
        onClick={async () => {
          await api.resetDemoData();
          toast("Demo data reset to the seed state");
          // Force screens to re-fetch by hard-reloading the route.
          window.location.reload();
        }}
      >
        Reset data
      </button>
    </div>
  );
}
