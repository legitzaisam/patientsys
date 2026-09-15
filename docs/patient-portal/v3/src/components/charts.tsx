import { useState } from "react";

/** Inline SVG charts ported from the v2 wireframes, with interactive hover. */

const W = 560;
const H = 148;
const PAD = 36;

function pathOf(vals: number[], max: number) {
  const n = vals.length;
  const ix = (i: number) => PAD + (i * (W - 2 * PAD)) / (n - 1);
  const iy = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);
  return vals.map((v, i) => `${i ? "L" : "M"}${ix(i).toFixed(1)},${iy(v).toFixed(1)}`).join(" ");
}

const XLABELS = ["1 Sep", "5 Sep", "9 Sep", "13 Sep", "17 Sep", "21 Sep", "25 Sep", "30 Sep"];

function Frame({ yLabels, children }: { yLabels: string[]; children: React.ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block", marginTop: 6 }}>
      {[0, 1, 2, 3].map((i) => {
        const y = PAD + (i * (H - 2 * PAD)) / 3;
        return <line key={i} x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#eef1f4" />;
      })}
      {children}
      {yLabels.map((t, i) => (
        <text key={t} x={PAD - 5} y={H - PAD - (i * (H - 2 * PAD)) / (yLabels.length - 1) + 3} textAnchor="end" fontSize={8.5} fill="#9aa4bb">
          {t}
        </text>
      ))}
      {XLABELS.map((t, i) => (
        <text key={t} x={PAD + (i * (W - 2 * PAD)) / 7} y={H - 8} textAnchor="middle" fontSize={8.5} fill="#9aa4bb">
          {t}
        </text>
      ))}
    </svg>
  );
}

export function LineChart({
  series,
  max,
  yLabels,
  hoverLabel,
}: {
  series: Array<{ vals: number[]; color: string; fill?: string; dash?: boolean }>;
  max: number;
  yLabels: string[];
  hoverLabel?: (i: number, v: number) => [string, string];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const main = series[0];
  const n = main.vals.length;
  const ix = (i: number) => PAD + (i * (W - 2 * PAD)) / (n - 1);
  const iy = (v: number) => H - PAD - (v / max) * (H - 2 * PAD);

  return (
    <div
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const fx = ((e.clientX - r.left) / r.width) * W;
        const i = Math.round(((fx - PAD) / (W - 2 * PAD)) * (n - 1));
        setHover(i >= 0 && i < n ? i : null);
      }}
      onMouseLeave={() => setHover(null)}
    >
      <Frame yLabels={yLabels}>
        {series.map((s, k) => {
          const p = pathOf(s.vals, max);
          return (
            <g key={k}>
              {s.fill && <path d={`${p} L${W - PAD},${H - PAD} L${PAD},${H - PAD} Z`} fill={s.fill} opacity={0.4} />}
              <path d={p} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash ? "5 4" : undefined} />
            </g>
          );
        })}
        {hover != null && hoverLabel && (
          <g>
            <circle cx={ix(hover)} cy={iy(main.vals[hover])} r={4.5} fill="#fff" stroke={main.color} strokeWidth={2.5} />
            <g transform={`translate(${Math.min(Math.max(ix(hover) - 44, 2), W - 92)},${Math.max(iy(main.vals[hover]) - 46, 2)})`}>
              <rect width={88} height={34} rx={7} fill="#fff" stroke="#e4e8ee" />
              <text x={44} y={14} textAnchor="middle" fontSize={9} fill="#8996b7">
                {hoverLabel(hover, main.vals[hover])[0]}
              </text>
              <text x={44} y={26} textAnchor="middle" fontSize={10} fontWeight={700} fill="#0a1c46">
                {hoverLabel(hover, main.vals[hover])[1]}
              </text>
            </g>
          </g>
        )}
      </Frame>
    </div>
  );
}

export function BarChart({
  vals,
  max,
  yLabels,
  color,
  color2,
  hoverLabel,
}: {
  vals: number[];
  max: number;
  yLabels: string[];
  color: string;
  color2?: string;
  hoverLabel?: (i: number, v: number) => [string, string];
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = vals.length;
  const bw = ((W - 2 * PAD) / n) * 0.55;
  return (
    <div onMouseLeave={() => setHover(null)}>
      <Frame yLabels={yLabels}>
        {vals.map((v, i) => {
          const x = PAD + (i * (W - 2 * PAD)) / n;
          const bh = (v / max) * (H - 2 * PAD);
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={x} y={H - PAD - bh} width={bw} height={bh} rx={2.5} fill={color} opacity={hover === null || hover === i ? 1 : 0.45} />
              {color2 && <rect x={x + bw + 1.5} y={H - PAD - bh * 0.72} width={bw * 0.7} height={bh * 0.72} rx={2.5} fill={color2} />}
            </g>
          );
        })}
        {hover != null && hoverLabel && (
          <g transform={`translate(${Math.min(Math.max(PAD + (hover * (W - 2 * PAD)) / n - 40, 2), W - 92)},6)`}>
            <rect width={88} height={34} rx={7} fill="#fff" stroke="#e4e8ee" />
            <text x={44} y={14} textAnchor="middle" fontSize={9} fill="#8996b7">
              {hoverLabel(hover, vals[hover])[0]}
            </text>
            <text x={44} y={26} textAnchor="middle" fontSize={10} fontWeight={700} fill="#0a1c46">
              {hoverLabel(hover, vals[hover])[1]}
            </text>
          </g>
        )}
      </Frame>
    </div>
  );
}

const FUNNEL = [
  { pct: "100%", n: 633, h: 150, c: "#1c7979", k: "1", label: "Consultation & skin assessment" },
  { pct: "86%", n: 545, h: 128, c: "#4ca7a9", k: "2", label: "Plan started (treatment 1)" },
  { pct: "68%", n: 429, h: 101, c: "#71c1bb", k: "3", label: "Mid-plan (on track)" },
  { pct: "58%", n: 367, h: 86, c: "#92bfbf", k: "4", label: "Plan completed" },
  { pct: "48%", n: 304, h: 71, c: "#b9dcd9", k: "5", label: "Continued care (maintenance)" },
];

export function Funnel() {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="funnel">
      {FUNNEL.map((f, i) => (
        <div
          key={f.k}
          className="fbar"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(null)}
          title={`${f.label}: ${f.n} patients (${f.pct})`}
        >
          <div className="pct">{f.pct}</div>
          <div className="bar" style={{ height: f.h, background: f.c, outline: hover === i ? "2px solid rgba(1,86,90,.4)" : "none" }}>
            {hover === i ? `${f.n} patients` : f.n}
          </div>
          <div className="lbl">
            <b>{f.k}</b>
            {f.label}
          </div>
        </div>
      ))}
    </div>
  );
}
