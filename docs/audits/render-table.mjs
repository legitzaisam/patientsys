#!/usr/bin/env node
/**
 * Renders the audit JSON as the markdown tables in insights-numbers.md.
 *
 *   node docs/audits/render-table.mjs before   # insights-numbers.before.json
 *   node docs/audits/render-table.mjs          # insights-numbers.json
 */
import { readFileSync } from "node:fs";

const tag = process.argv[2];
const file = new URL(`./insights-numbers${tag ? `.${tag}` : ""}.json`, import.meta.url);
const data = JSON.parse(readFileSync(file, "utf8"));
const after = !tag;

/** Definition, source (before → after), problem found, fix. */
const META = {
  "funnel.signUps": ["Distinct people (by patient, then email) with an online enquiry, or a website-sourced record, in the window", "insights.server buildInsights → metrics/funnel funnelMetrics", "Window was a trailing month/year from today, not whole calendar months", "Calendar-month window from metrics/period"],
  "funnel.booked": ["Enquirers with any non-cancelled booking (future and no-show count as booked) or a visit on file", "buildInsights hasAnyAppointment → funnelMetrics", "Imported visits with no booking row read as not booked (17 people)", "Booked = non-cancelled booking or a visit"],
  "funnel.bookedRate": ["Booked ÷ enquiries", "FunnelTiles → funnelMetrics", "Wrong numerator (see Booked)", "Follows Booked"],
  "funnel.consulted": ["Enquirers whose consultation has happened: a consult treatment, or an attended consult booking, up to now", "buildInsights firstConsultAt → funnelMetrics", "Counted future and no-show consult bookings", "Only consultations that happened"],
  "funnel.consultRate": ["Consulted ÷ booked", "buildInsights → funnelMetrics", "Denominator fell back to enquiries; could exceed 100%", "Consulted ÷ booked, blank when nobody booked"],
  "funnel.treated": ["Consulted enquirers with a non-consultation treatment up to now", "buildInsights → funnelMetrics", "—", "—"],
  "funnel.treatRate": ["Treated ÷ consulted", "buildInsights → funnelMetrics", "Showed 0% instead of blank for an empty stage", "Blank (—) when nobody consulted"],
  "funnel.notBooked": ["Enquirers not booked; equals enquiries − booked", "buildInsights waiting → funnelMetrics", "Did not reconcile with the tiles", "Same rule as Booked"],
  "funnel.consultedNoTreatment": ["Consulted − treated", "buildInsights → funnelMetrics", "—", "—"],
  "funnel.chart.months": ["One bar per London calendar month in the window, none after now", "seriesBuckets → metrics/period buckets", "13 bars with a repeated partial month; server-time-zone buckets", "Whole London months"],
  "funnel.chart.signUps": ["Sum of bars = Online enquiries tile", "buildInsights monthly → funnelMetrics", "—", "—"],
  "funnel.chart.booked": ["Sum of bars = Booked tile (bars by enquiry month)", "buildInsights monthly → funnelMetrics", "Bars were first-booking dates, so they never summed to the tile", "Bars count the enquiry cohort by enquiry month"],
  "funnel.chart.consulted": ["Sum of bars = Consulted tile", "buildInsights monthly → funnelMetrics", "Bars were first-consult dates (same timing mismatch as booked)", "Cohort by enquiry month"],
  "funnel.sources": ["Enquirers by source; adds to enquiries", "buildInsights sources → funnelMetrics", "—", "—"],
  "funnel.sourcePercents": ["Whole percents by largest remainder, adding to 100", "SourceMix → funnelMetrics", "Rounded each row separately (could add to 99 or 101)", "Largest remainder"],
  "funnel.bestsellers": ["Treatments performed in the window by name: count and earned value", "buildInsights bestsellers → metrics/money", "Float pounds, no refunds, trailing window", "Pence, net of refunds"],
  "funnel.retailRevenue": ["Retail sales in the window", "buildInsights → funnelMetrics", "Trailing window", "Calendar window"],
  "book.total": ["Records not deleted, created on or before the window end", "buildBookMetrics → metrics/book", "Ignored the window end (a 2019 window showed today's 641)", "As of the window end"],
  "book.active": ["Of Total, status active (archived stays in Total, not Active)", "buildBookMetrics → bookMetrics", "Same as Total", "As of the window end"],
  "book.inactive": ["Total − Active", "buildBookMetrics → bookMetrics", "Same as Total", "—"],
  "book.newRecords": ["Records created in the window", "buildBookMetrics newThisMonth → bookMetrics", "Fixed to the calendar month; ignored the picker", "Follows the picker"],
  "book.newRecordsChart": ["Sum of bars = New patients tile", "buildBookMetrics monthlyNew → bookMetrics", "Fixed last-12-months chart; never matched the tile", "Chart follows the picker"],
  "book.dormant": ["Treated before, but no visit in the 12 months before the window end", "buildBookMetrics → bookMetrics", "Included never-treated patients; fixed to today", "Never-treated shown separately; as of window end"],
  "book.dormantShare": ["Dormant ÷ Total", "buildBookMetrics → bookMetrics", "Follows Dormant", "Blank when Total is 0"],
  "book.neverTreated": ["On the list at the window end with no visit by then", "buildBookMetrics → bookMetrics", "Whole book regardless of window", "As of window end"],
  "book.lastVisit": ["Months since last visit at the window end, by London calendar month; 12+ = Dormant", "buildBookMetrics → bookMetrics", "30.44-day months; 12+ disagreed with Dormant", "Calendar months, same cut as Dormant"],
  "book.seen": ["Patients with a visit in the window", "buildBookMetrics composition → bookMetrics", "Visits were treatment rows", "Visit = one attended booking"],
  "book.once": ["Seen patients with exactly one visit up to the window end", "composition → metrics/visits", "Multi-treatment visits counted twice", "Visits, not treatment rows"],
  "book.twoPlus": ["Seen patients with two or more visits", "composition → metrics/visits", "As above", "As above"],
  "book.firstToSecond": ["First visit in the window and 180+ days ago; returned within 180 days", "firstToSecond → metrics/visits", "Second 'visit' could be another treatment in the same appointment", "Visits"],
  "book.rebooked": ["Of patients seen in the window, those with a later non-cancelled booking", "buildBookMetrics ninetyDaysAgo → bookMetrics", "Fixed 90 days to today; ignored the picker", "Follows the picker"],
  "book.revenue": ["Earned in the window (net of refunds)", "buildBookMetrics → metrics/money", "Trailing window", "Same earned as Performance"],
  "book.spendPerPatient": ["Earned ÷ patients seen", "buildBookMetrics → bookMetrics", "Float pounds", "Pence"],
  "book.visitValue": ["Earned ÷ visits in the window", "buildBookMetrics → bookMetrics", "Divided by treatment rows", "Divided by visits"],
  "book.visitsInWindow": ["Visits in the window", "buildBookMetrics → metrics/visits", "Treatment rows", "Visits"],
  "book.newVsReturning": ["Seen patients whose first visit is in the window vs before it", "buildBookMetrics treatedMix → bookMetrics", "Trailing window", "Calendar window"],
  "book.listSources": ["Everyone on the list by record source (lifetime)", "buildBookMetrics sources → bookMetrics", "Ignored the window end", "As of window end"],
  "dashboard.totalClients": ["Records not deleted", "getDashboard (inline) → metrics/dashboard", "—", "One function for both handlers"],
  "dashboard.activeClients": ["Status active", "getDashboard (inline) → dashboardFigures", "—", "—"],
  "dashboard.revenueMonth": ["Earned this London calendar month, net of refunds", "getDashboard (inline) → dashboardFigures", "Server-local month; ignored refunds", "London month, earned rule"],
  "dashboard.treatmentsMonth": ["Treatments performed this London month", "getDashboard (inline) → dashboardFigures", "Server-local month", "London month"],
  "retention.rate": ["Patients seen in the 12 months to the window end with 2+ visits", "buildRetention rollingRate → metrics/visits", "Treatment rows; 365 days", "Visits; 12 calendar months"],
  "retention.once": ["= Insights treated once", "buildRetention → metrics/visits", "Treatment rows", "Visits"],
  "retention.twoPlus": ["= Insights two or more", "buildRetention → metrics/visits", "Treatment rows", "Visits"],
  "retention.firstToSecond": ["= Insights first to second", "buildRetention → metrics/visits", "—", "—"],
  "money.earned": ["Treatments performed in the window, net of refunds", "buildStats → metrics/money", "Trailing window; float pounds", "Pence, calendar window"],
  "money.collected": ["Paid in full, or the deposit share on deposit-paid bookings; refunds 0", "buildStats collectedFor → metrics/money", "As Earned", "As Earned"],
  "money.outstanding": ["Earned − Collected", "buildStats → metrics/money", "—", "—"],
  "money.bookedAhead": ["Live future bookings' value", "bookedAhead → metrics/money", "—", "—"],
  "money.trendEarned": ["Sum of the monthly trend = Earned", "buildTrend → metrics/money", "UTC month buckets (BST shifts midnight visits)", "London month buckets"],
  "money.practitioners.earned": ["Per practitioner; adds to clinic Earned", "buildStats → metrics/money", "Trailing window", "Calendar window"],
  "money.practitioners.collected": ["Per practitioner; adds to clinic Collected", "buildStats → metrics/money", "Trailing window", "Calendar window"],
  "profile.earnedShare": ["Each line's value × its stamped rate, rounded to the penny per line", "buildStats share → metrics/money", "Float rounding per line", "Integer pence per line"],
  "profile.collectedShare": ["Each line's collected × rate", "buildStats → metrics/money", "As above", "As above"],
  "profile.outstandingShare": ["Your share − collected share", "getMyEarnings → metrics/money", "—", "—"],
  "profile.csv": ["Sum of the CSV's share column = Your share", "practitioner-earnings toCsv → earnings lines from metrics/money", "Line share rounded differently from the tile", "Same line share as the tile"],
  "profile.treatments": ["Treatments performed in the window", "buildStats → metrics/money", "Trailing window", "Calendar window"],
  "profile.newPatients": ["Patients whose first-ever visit is in the window", "buildStats patientFirstSeen → metrics/visits", "Used the record's created date, not the first visit", "First visit"],
};

const MONEY = /[rR]evenue|[eE]arned|collected|outstanding|bookedAhead|Share|csv|spend|visitValue/;
const gbp = (p) => `£${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const staff = data.staff ?? {};
const shortName = (id) => (staff[id] ?? id).replace(/^(Dr|Mr|Mrs|Ms|Miss)\s+/, "").split(" ")[0];

function fmt(id, v) {
  if (v === null || v === undefined) return "—";
  const money = MONEY.test(id) && !/visitsInWindow/.test(id);
  if (typeof v === "number") return money ? gbp(v) : /Rate|Share$|rate|Percents/.test(id) && !money ? `${v}%` : String(v);
  if (Array.isArray(v)) return v.slice(0, 3).map((b) => `${b.name} ${b.count} · ${gbp(b.revenue)}`).join("; ") + (v.length > 3 ? "; …" : "");
  return Object.entries(v)
    .map(([k, x]) => `${staff[k] ? shortName(k) : k} ${typeof x === "number" && money ? gbp(x) : fmt(`${id}.${k}`, x)}`)
    .join(", ");
}

const cell = (s) => String(s).replace(/\|/g, "\\|");
for (const key of ["12m", "1m", "empty"]) {
  const period = data[key];
  if (!period) continue;
  const title = { "12m": "Last 12 months (default)", "1m": "This month", empty: "1–31 Jan 2019 (no data)" }[key];
  console.log(`\n#### ${title}\n`);
  console.log(`Window shown: ${period.shownWindow.from} → ${period.shownWindow.to}. Recalculated: ${period.recalcWindow.from} → ${period.recalcWindow.to}.\n`);
  if (key === "12m") {
    console.log("| Metric | Where it appears | Definition | Source (file/function) | Value shown | Value recalculated | Match? | Problem found | Suggested fix |");
    console.log("|---|---|---|---|---|---|---|---|---|");
  } else {
    console.log("| Metric | Value shown | Value recalculated | Match? |");
    console.log("|---|---|---|---|");
  }
  for (const r of period.rows) {
    const [def, src, problem, fix] = META[r.id] ?? ["", "", "", ""];
    const source = after ? src.split(" → ").pop() : src.split(" → ")[0];
    const shown = cell(fmt(r.id, r.shown));
    const recalculated = cell(fmt(r.id, r.recalculated));
    const match = r.match ? "Yes" : "**No**";
    if (key === "12m") {
      const found = after ? (problem === "—" ? "—" : `Fixed: ${problem}`) : r.match ? (problem === "—" ? "—" : `${problem} (hidden in this window)`) : problem;
      console.log(`| ${r.metric} | ${r.where} | ${def} | \`${source}\` | ${shown} | ${recalculated} | ${match} | ${cell(found)} | ${after ? "Done" : fix} |`);
    } else {
      console.log(`| ${r.metric} | ${shown} | ${recalculated} | ${match} |`);
    }
  }
}
const total = ["12m", "1m", "empty"].reduce((n, k) => n + (data[k]?.rows.length ?? 0), 0);
const ok = ["12m", "1m", "empty"].reduce((n, k) => n + (data[k]?.rows.filter((r) => r.match).length ?? 0), 0);
console.log(`\n${ok} of ${total} rows match. Seed problems: ${data.seedProblems.length ? data.seedProblems.join("; ") : "none"}.`);
