import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/* ------------------------------------------------------------------ Card */
export function Card({
  children,
  className,
  style,
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  pad?: boolean;
}) {
  return (
    <section className={`glass-card ${pad ? "card-pad" : ""} ${className ?? ""}`} style={style}>
      {children}
    </section>
  );
}

/** Card heading row: icon + title on the left, optional action on the right. */
export function Head({
  icon,
  title,
  action,
  tone = "var(--accent-ink)",
  sub,
}: {
  icon?: IconName;
  title: ReactNode;
  action?: ReactNode;
  tone?: string;
  sub?: ReactNode;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      {icon && <Icon d={icon} size={16} stroke={tone} />}
      <div style={{ minWidth: 0 }}>
        <h2 className="section-title">{title}</h2>
        {sub && <p className="tiny" style={{ marginTop: 1 }}>{sub}</p>}
      </div>
      {action && <div style={{ marginLeft: "auto", flex: "none" }}>{action}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Chip */
export function Chip({
  tone = "line",
  children,
  style,
}: {
  tone?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span className={`chip chip-${tone}`} style={style}>
      {children}
    </span>
  );
}

/** Status chip vocabulary shared by the timeline and plan progress. */
export function StatusChip({ status, label }: { status: string; label: string }) {
  const tone =
    status === "done" ? "success" : status === "progress" || status === "current" ? "butter" : "line";
  return <Chip tone={tone}>{label}</Chip>;
}

/* ------------------------------------------------------------- Link text */
export function LinkText({ children, icon = "arrow" }: { children: ReactNode; icon?: IconName | null }) {
  return (
    <button type="button" className="link">
      {children}
      {icon && <Icon d={icon} size={12} />}
    </button>
  );
}

/* ------------------------------------------------------------------ Ring */
export function Ring({
  pct,
  size = 56,
  stroke = 6,
  color = "var(--success)",
  track = "var(--bar)",
  children,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * pct) / 100} ${c}`}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontSize: size > 70 ? 17 : 12.5,
          fontWeight: 600,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {children ?? `${pct}%`}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- StatTile */
export function StatTile({
  icon,
  iconBg = "var(--accent-soft)",
  iconInk = "var(--accent-ink)",
  label,
  value,
  sub,
  lead,
  chevron = true,
}: {
  icon?: IconName;
  iconBg?: string;
  iconInk?: string;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  lead?: ReactNode;
  chevron?: boolean;
}) {
  return (
    <button type="button" className="glass-card card-pad" style={{ display: "block", textAlign: "left" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {lead ?? (
          <span className="tile-icon" style={{ background: iconBg, color: iconInk }}>
            <Icon d={icon ?? "doc"} size={16} />
          </span>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="tiny">{label}</p>
          <p style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: "-0.01em", marginTop: 1 }}>{value}</p>
          {sub && (
            <p className="tiny" style={{ marginTop: 1 }}>
              {sub}
            </p>
          )}
        </div>
        {chevron && <Icon d="right" size={13} stroke="var(--ink-3)" />}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------- Checkbox */
export function Ck({ on, label, meta }: { on: boolean; label: ReactNode; meta?: ReactNode }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 9, padding: "5px 0", cursor: "pointer" }}>
      <span className={`ck ${on ? "on" : ""}`}>
        <Icon d="check" size={11} width={2.6} />
      </span>
      <span style={{ fontSize: 12.5, color: "var(--foreground)" }}>{label}</span>
      {meta && <span style={{ marginLeft: "auto" }}>{meta}</span>}
    </label>
  );
}

/* -------------------------------------------------------------- Slider */
export function ReadSlider({ label, value, reading }: { label: string; value: number; reading: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span className="tiny" style={{ width: 66, flex: "none" }}>
        {label}
      </span>
      <span style={{ position: "relative", flex: 1, height: 6 }}>
        <span className="track" style={{ position: "absolute", inset: 0 }}>
          <span style={{ width: `${value}%` }} />
        </span>
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: `${value}%`,
            transform: "translate(-50%, -50%)",
            width: 12,
            height: 12,
            borderRadius: 999,
            background: "var(--success)",
            boxShadow: "0 0 0 2px #fff, var(--shadow-glass)",
          }}
        />
      </span>
      <span className="tiny" style={{ width: 54, textAlign: "right", flex: "none" }}>
        {reading}
      </span>
    </div>
  );
}

/* ------------------------------------------------------------ Avatar */
export function Avatar({
  src,
  initials,
  size = 30,
}: {
  src?: string;
  initials?: string;
  size?: number;
}) {
  if (src) {
    return <img className="avatar" src={src} alt="" style={{ width: size, height: size }} />;
  }
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials}
    </span>
  );
}

/* --------------------------------------------------------- Banner strip */
export function Banner({
  icon = "heart",
  title,
  body,
  cta,
}: {
  icon?: IconName;
  title: string;
  body: string;
  cta?: string;
}) {
  return (
    <div
      className="glass-card"
      style={{
        padding: "13px 16px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--accent-wash)",
      }}
    >
      <span className="tile-icon" style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}>
        <Icon d={icon} size={16} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 600 }}>{title}</p>
        <p className="tiny" style={{ marginTop: 1 }}>
          {body}
        </p>
      </div>
      {cta && (
        <button type="button" className="btn btn-ghost btn-sm" style={{ background: "var(--glass-hi)" }}>
          {cta} <Icon d="arrow" size={12} />
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------ Note / callouts */
export function Note({
  tone = "sky",
  icon = "info",
  children,
}: {
  tone?: "sky" | "danger" | "success";
  icon?: IconName;
  children: ReactNode;
}) {
  const bg = tone === "danger" ? "var(--destructive-bg)" : tone === "success" ? "var(--success-bg)" : "var(--sky-bg)";
  const ink = tone === "danger" ? "var(--destructive-ink)" : tone === "success" ? "var(--success-ink)" : "var(--sky-ink)";
  return (
    <div className="note-box" style={{ background: bg, color: ink }}>
      <Icon d={icon} size={14} style={{ marginTop: 1 }} />
      <span>{children}</span>
    </div>
  );
}

/* ------------------------------------------------------- Photo placeholder
   The mockups show clinic interiors and product shots we have no assets for;
   a soft tinted block keeps the composition honest in a wireframe. */
export function PhotoBlock({
  icon = "photo",
  height = 92,
  label,
  style,
}: {
  icon?: IconName;
  height?: number;
  label?: string;
  style?: CSSProperties;
}) {
  return (
    <div className="photo-block" style={{ height, ...style }}>
      <span style={{ position: "relative", zIndex: 1, display: "grid", placeItems: "center", gap: 4 }}>
        <Icon d={icon} size={height > 70 ? 22 : 16} width={1.4} />
        {label && <span style={{ fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------- Handwrite */
export function Scribble({ lines }: { lines: string[] }) {
  return (
    <p
      className="caveat"
      style={{ fontSize: 17, lineHeight: 1.15, color: "var(--accent-ink)", transform: "rotate(-6deg)", textAlign: "center" }}
    >
      {lines.map((l) => (
        <span key={l} style={{ display: "block" }}>
          {l}
        </span>
      ))}
    </p>
  );
}
