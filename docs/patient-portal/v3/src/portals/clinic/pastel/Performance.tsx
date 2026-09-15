import { useState } from "react";
import { Icon } from "../../../components/Icon";
import { Skeleton } from "../../../components/ui";
import { BarChart, LineChart } from "../../../components/charts";
import { useToast } from "../../../components/Toast";
import { useLoad } from "../../../hooks";
import { api } from "../../../mock/api";
import type { Period } from "../../../mock/types";

const PERIODS: Array<[Period, string]> = [
  ["month", "This month"],
  ["lastMonth", "Last month"],
  ["year", "This year"],
];

const KPI_ROWS = [
  ["DN", "var(--butter)", "#7a5f18", "Dr Nadia Rahman", "Aesthetic Practitioner", "£12,785.00", 49, "93%", "72%", "£19,225.00"],
  ["DT", "var(--lav)", "var(--lavink)", "Dr Tom Whitfield", "Aesthetic Doctor", "£11,680.00", 47, "86%", "71%", "£21,315.00"],
  ["DA", "var(--mint)", "var(--mintink)", "Dr Amara Osei", "Clinic Director", "£7,460.00", 27, "81%", "74%", "£13,875.00"],
] as const;

export function PastelPerformance() {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>("month");
  const [scope, setScope] = useState("Clinic total");
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: perf, loading } = useLoad(() => api.getPerformance(period), [period]);

  const dayLabel = (i: number) => `${i + 1} Sep`;

  return (
    <>
      <div className="cp-h1row">
        <div>
          <h1>Performance</h1>
          <div className="sub">Earnings and collections for the clinic, then a breakdown by practitioner.</div>
        </div>
        <div className="cp-right">
          <div className="cp-seg">
            {PERIODS.map(([p, label]) => (
              <button key={p} type="button" className={period === p ? "on" : ""} onClick={() => setPeriod(p)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="cp-stats">
        {(
          [
            ["Earned", perf?.stats.earned, "↗ 12%", "chart", "var(--mint)", "var(--mintink)"],
            ["Collected", perf?.stats.collected, "↗ 8%", "bill", "var(--blue)", "var(--blueink)"],
            ["To practitioners", perf?.stats.toPract, "↗ 11%", "users", "var(--mint)", "var(--mintink)"],
            ["Retained by clinic", perf?.stats.retained, "↗ 6%", "trend", "var(--pink)", "var(--pinkink)"],
          ] as const
        ).map(([label, value, delta, icon, bg, fg]) => (
          <button key={label} type="button" className="cp-stat" onClick={() => toast(`${label}: drill-down is mocked`)}>
            <span className="ic" style={{ background: bg, color: fg }}>
              <Icon d={icon} size={18} />
            </span>
            <small>{label}</small>
            <div className="v">{value ?? <Skeleton h={22} w={120} />}</div>
            <div className="chips">
              <span className="cp-uch up">{delta}</span>
              <span className="cp-uch mut">vs. last {period === "year" ? "year" : "month"}</span>
            </div>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", marginTop: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Trends</div>
          <div style={{ color: "var(--mut)", fontSize: 12, marginTop: 1 }}>By day over the selected period — clinic total or a single practitioner.</div>
        </div>
        <select
          className="btn sm"
          style={{ marginLeft: "auto", height: 34 }}
          value={scope}
          onChange={(e) => {
            setScope(e.target.value);
            toast(`Scoped to ${e.target.value} — series re-scaled (mock data)`);
          }}
          aria-label="Scope"
        >
          <option>Clinic total</option>
          <option>Dr Nadia Rahman</option>
          <option>Dr Tom Whitfield</option>
          <option>Dr Amara Osei</option>
        </select>
      </div>

      <div className="cp-trend">
        <div className="cp-chart">
          <h4>Earnings</h4>
          <div className="csub">Treatment value earned and booking revenue collected</div>
          <div className="leg">
            <span>
              <i style={{ background: "#e79f0a" }} />
              Earned
            </span>
            <span>
              <i style={{ background: "#f3d9a0" }} />
              Collected
            </span>
          </div>
          {perf && !loading ? (
            <LineChart
              max={6000}
              yLabels={["£0", "£1,500", "£3,000", "£4,500", "£6,000"]}
              series={[
                { vals: scale(perf.earn, scope), color: "#e79f0a", fill: "#fdf3dd" },
                { vals: scale(perf.coll, scope), color: "#f3d9a0", dash: true },
              ]}
              hoverLabel={(i, v) => [dayLabel(i), `£${v.toLocaleString()}`]}
            />
          ) : (
            <Skeleton h={140} style={{ marginTop: 8 }} />
          )}
        </div>
        <div className="cp-chart">
          <h4>Appointments</h4>
          <div className="csub">Bookings in the diary for each day</div>
          <div className="leg">
            <span>
              <i style={{ background: "#67adfe" }} />
              Scheduled
            </span>
            <span>
              <i style={{ background: "#c2ddfd" }} />
              Completed
            </span>
          </div>
          {perf && !loading ? (
            <BarChart max={24} yLabels={["0", "6", "12", "18", "24"]} vals={perf.appt} color="#67adfe" color2="#c2ddfd" hoverLabel={(i, v) => [dayLabel(i), `${v} bookings`]} />
          ) : (
            <Skeleton h={140} style={{ marginTop: 8 }} />
          )}
        </div>
        <div className="cp-chart">
          <h4>Attendance rate</h4>
          <div className="csub">Attended as a share of settled bookings</div>
          {perf && !loading ? (
            <LineChart
              max={100}
              yLabels={["0%", "25%", "50%", "75%", "100%"]}
              series={[{ vals: perf.att, color: "#2f9e68", fill: "#e2f2e9" }]}
              hoverLabel={(i, v) => [dayLabel(i), `Attendance: ${v}%`]}
            />
          ) : (
            <Skeleton h={140} style={{ marginTop: 8 }} />
          )}
        </div>
        <div className="cp-chart">
          <h4>No shows</h4>
          <div className="csub">Bookings marked as no show</div>
          {perf && !loading ? (
            <BarChart max={4} yLabels={["0", "1", "2", "3", "4"]} vals={perf.nosh} color="#e56898" hoverLabel={(i, v) => [dayLabel(i), `${v} no-show${v === 1 ? "" : "s"}`]} />
          ) : (
            <Skeleton h={140} style={{ marginTop: 8 }} />
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", marginTop: 14 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Practitioner KPIs</div>
          <div style={{ color: "var(--mut)", fontSize: 12, marginTop: 1 }}>Expand a row for cash collected, outstanding balances, and activity. Edit commission under Team.</div>
        </div>
      </div>
      <div className="cp-kpi">
        <div className="top">
          <span className="ic">
            <Icon d="trend" size={17} />
          </span>
          <div>
            <small style={{ color: "#2e7d5b", fontWeight: 700, fontSize: 11.5 }}>Top performer</small>
            <b style={{ fontSize: 13.5, display: "block" }}>
              Dr Nadia Rahman <span style={{ fontWeight: 500, color: "var(--mut)" }}>Aesthetic Practitioner</span>
            </b>
            <small style={{ color: "var(--mut)", fontSize: 11.5 }}>£12,785.00 earned · 49 treatments · 72% retention</small>
          </div>
          <button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={() => toast("Practitioner profiles are mocked")}>
            View profile
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Practitioner</th>
              <th>Earned</th>
              <th>Treatments</th>
              <th>Attendance</th>
              <th>Retention</th>
              <th>Outstanding</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {KPI_ROWS.map(([ini, bg, fg, name, role, earned, tx, att, ret, out]) => (
              <RowWithDetail
                key={ini}
                open={expanded === ini}
                onToggle={() => setExpanded(expanded === ini ? null : (ini as string))}
                cells={[ini, bg, fg, name, role, earned, tx, att, ret, out] as never}
              />
            ))}
            <tr onClick={() => toast("Clinic totals combine all three treating practitioners")}>
              <td>
                <b style={{ display: "inline", color: "#2e7d5b" }}>Clinic total</b> <small>3 practitioners · 42.3% avg commission</small>
              </td>
              <td>
                <b style={{ display: "inline" }}>£31,925.00</b>
              </td>
              <td>
                <b style={{ display: "inline" }}>123</b>
              </td>
              <td>
                <b style={{ display: "inline" }}>87%</b>
              </td>
              <td>
                <b style={{ display: "inline" }}>72%</b>
              </td>
              <td className="out">£54,415.00</td>
              <td style={{ color: "#aab3c6" }}>▾</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function scale(vals: number[], scope: string): number[] {
  const f = scope === "Clinic total" ? 1 : scope.includes("Nadia") ? 0.4 : scope.includes("Tom") ? 0.37 : 0.23;
  return vals.map((v) => Math.round(v * f));
}

function RowWithDetail({
  cells,
  open,
  onToggle,
}: {
  cells: readonly [string, string, string, string, string, string, number, string, string, string];
  open: boolean;
  onToggle: () => void;
}) {
  const [ini, bg, fg, name, role, earned, tx, att, ret, out] = cells;
  return (
    <>
      <tr onClick={onToggle}>
        <td>
          <span className="cp-ava" style={{ width: 24, height: 24, fontSize: 9.5, marginRight: 8, background: bg, color: fg }}>
            {ini}
          </span>
          <b style={{ display: "inline" }}>{name}</b> <small>{role}</small>
        </td>
        <td>{earned}</td>
        <td>{tx}</td>
        <td>{att}</td>
        <td>{ret}</td>
        <td className="out">{out}</td>
        <td style={{ color: "#aab3c6" }}>{open ? "▴" : "▾"}</td>
      </tr>
      {open && (
        <tr className="expand">
          <td colSpan={7}>
            Cash collected {Math.round(parseFloat(earned.replace(/[£,]/g, "")) * 0.48).toLocaleString("en-GB", { style: "currency", currency: "GBP" })} · outstanding balances{" "}
            {out} · {tx} treatments over the period · next available diary slot tomorrow 10:15.
          </td>
        </tr>
      )}
    </>
  );
}
