import { ToneChip } from "@/components/patients/record/chips";
import { SeverityWord } from "@/components/patients/record/severity-bars";
import type { CheckinRow } from "@/components/patients/record/urgent-checkins-card";
import { CHECKIN_STATUS_LABEL, checkinStatus, shortDate } from "@/lib/patients/record-overview";

const ROW = "grid grid-cols-[70px_repeat(3,minmax(0,1fr))_80px] items-center gap-2";

/** Every recovery check-in the patient has sent, newest first, with its flag state. */
export function AllCheckinsTable({ checkins }: { checkins: CheckinRow[] }) {
  const rows = [...checkins].sort((a, b) => b.checkin_date.localeCompare(a.checkin_date));
  return (
    <section className="glass-card flex flex-col px-[22px] py-5" data-qc="checkins-table">
      <div className="mb-2">
        <h2 className="text-base font-medium text-foreground">All check-ins</h2>
        <p className="mt-0.5 text-xs text-ink-2">Self-reported between visits.</p>
      </div>
      <div
        className={`${ROW} border-b border-edge-2 py-1.5 text-[11px] font-semibold text-ink-3`}
        role="row"
      >
        <span>Date</span>
        <span>Redness</span>
        <span>Sensitivity</span>
        <span>Dryness</span>
        <span />
      </div>
      {rows.length === 0 ? (
        <p className="py-5 text-sm text-ink-2">No check-ins submitted yet.</p>
      ) : (
        rows.map((c, i) => {
          const status = checkinStatus(c);
          return (
            <div
              key={c.id}
              className={`${ROW} py-[9px] text-[12.5px] text-foreground ${i < rows.length - 1 ? "border-b border-edge-2" : ""}`}
              role="row"
              data-qc="checkin-row"
              data-date={c.checkin_date}
              data-status={status}
            >
              <span>{shortDate(c.checkin_date)}</span>
              <SeverityWord value={c.redness} />
              <SeverityWord value={c.sensitivity} />
              <SeverityWord value={c.dryness} />
              {status === "none" ? (
                <span className="text-center text-[11px] text-ink-2">
                  {CHECKIN_STATUS_LABEL.none}
                </span>
              ) : (
                <ToneChip tone={status === "open" ? "alert" : "done"} className="justify-center">
                  {CHECKIN_STATUS_LABEL[status]}
                </ToneChip>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
