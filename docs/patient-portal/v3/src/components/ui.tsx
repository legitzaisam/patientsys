import { useEffect } from "react";
import { Icon } from "./Icon";

/* ---------------------------------------------------------------- Chip */
export function Chip({
  tone = "line",
  children,
  className,
  style,
  onClick,
}: {
  tone?: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag className={`chip chip-${tone} ${className ?? ""}`} style={style} onClick={onClick} type={onClick ? "button" : undefined}>
      {children}
    </Tag>
  );
}

/* -------------------------------------------------------------- Toggle */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      className={`tgl ${on ? "on" : ""}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
    />
  );
}

/* ------------------------------------------------------------ Checkbox */
export function Check({
  checked,
  onChange,
  children,
  strike = true,
  meta,
}: {
  checked: boolean;
  onChange: () => void;
  children: React.ReactNode;
  strike?: boolean;
  meta?: React.ReactNode;
}) {
  return (
    <label className={`ckrow ${checked && strike ? "done" : ""}`}>
      <button type="button" className={`ckbox ${checked ? "on" : ""}`} aria-checked={checked} role="checkbox" onClick={onChange} />
      <span className="cklabel" onClick={onChange}>
        {children}
      </span>
      {meta != null && <span className="ckmeta">{meta}</span>}
    </label>
  );
}

/* -------------------------------------------------------- ProgressRing */
export function Ring({
  pct,
  size = 74,
  strokeWidth = 7,
  color = "#0b635c",
  track = "#e6ecee",
  label,
  ink = "#0e1c33",
  fontSize,
}: {
  pct: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  track?: string;
  label?: string;
  ink?: string;
  fontSize?: number;
}) {
  const r = size / 2 - strokeWidth - 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={strokeWidth} />
      {pct > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${pct} 100`}
          pathLength={100}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      <text x={size / 2} y={size / 2 + (fontSize ?? size * 0.2) * 0.36} textAnchor="middle" fontSize={fontSize ?? size * 0.2} fontWeight={800} fill={ink}>
        {label ?? `${pct}%`}
      </text>
    </svg>
  );
}

/* ---------------------------------------------------------------- Modal */
export function Modal({
  open,
  onClose,
  title,
  children,
  width = 460,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: number;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-veil" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width }} role="dialog" aria-modal aria-label={title}>
        <div className="modal-head">
          <b>{title}</b>
          <button type="button" className="modal-x" onClick={onClose} aria-label="Close">
            <Icon d="x" size={15} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Skeleton */
export function Skeleton({ h = 14, w = "100%", style }: { h?: number; w?: number | string; style?: React.CSSProperties }) {
  return <span className="skel" style={{ height: h, width: w, ...style }} />;
}

/* --------------------------------------------------------------- Slider */
export function Slider({
  value,
  onChange,
  label,
  levelText,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
  levelText: (v: number) => string;
}) {
  return (
    <div className="sliderrow">
      <span className="sl-label">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ["--val" as never]: `${value}%` }}
      />
      <span className="sl-level">{levelText(value)}</span>
    </div>
  );
}

export function levelOf(v: number) {
  return v < 40 ? "Mild" : v < 70 ? "Moderate" : "Severe";
}
