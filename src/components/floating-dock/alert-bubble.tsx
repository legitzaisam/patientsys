import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { ArrivalAlerts } from "@/components/arrival-alerts";
import { UrgentStaffAlerts } from "@/components/urgent-staff-alerts";

const PEEK_MS = 8_000;
/** Highest alert count already peeked this session — the shell remounts on
 *  every route change, so without this the peek would replay on each page. */
const SEEN_KEY = "aetheria.dock-alerts-seen";

function loadSeen(): number {
  try {
    return Number(sessionStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

function storeSeen(n: number) {
  try {
    sessionStorage.setItem(SEEN_KEY, String(n));
  } catch {
    /* ignore */
  }
}

/**
 * One launcher for everything that used to pile up in the corner: arrival
 * alerts and urgent team alerts collapse into a single bubble with a badge.
 *
 * A newly arriving alert "peeks" — the panel opens by itself for a few
 * seconds (paused while hovered) and then folds back into the bubble, so
 * time-critical arrivals are still seen without permanently owning the
 * corner. The bubble disappears entirely at zero.
 */
export function AlertBubble({ roles }: { roles: string[] }) {
  const [open, setOpen] = useState(false);
  const [peeking, setPeeking] = useState(false);
  // null until each source has loaded — a fresh mount must not read as
  // "zero alerts" (it would reset the peek memory and replay on every page).
  const [arrivalCount, setArrivalCount] = useState<number | null>(null);
  const [urgentCount, setUrgentCount] = useState<number | null>(null);
  const ready = arrivalCount !== null && urgentCount !== null;
  const total = (arrivalCount ?? 0) + (urgentCount ?? 0);

  const seen = useRef(loadSeen());
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hovered = useRef(false);

  function armPeekTimer() {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    peekTimer.current = setTimeout(() => {
      if (hovered.current) armPeekTimer();
      else setPeeking(false);
    }, PEEK_MS);
  }

  useEffect(() => {
    if (!ready) return;
    if (total > seen.current && !open) {
      setPeeking(true);
      armPeekTimer();
    }
    if (total !== seen.current) {
      seen.current = total;
      storeSeen(total);
    }
  }, [ready, total, open]);

  useEffect(() => () => {
    if (peekTimer.current) clearTimeout(peekTimer.current);
  }, []);

  const showPanel = (open || peeking) && total > 0;

  return (
    <>
      {/* Cards stay mounted while hidden so their data hooks keep the badge
          count live and the no-show dialog keeps working. */}
      <div
        role="region"
        aria-label="Clinic alerts"
        data-qc="alert-panel"
        onMouseEnter={() => {
          hovered.current = true;
        }}
        onMouseLeave={() => {
          hovered.current = false;
          if (peeking) armPeekTimer();
        }}
        className={
          showPanel
            ? "pointer-events-auto flex w-[min(18rem,calc(100vw-2.5rem))] flex-col items-end gap-3"
            : "hidden"
        }
      >
        <ArrivalAlerts
          roles={roles}
          variant="panel"
          panelVisible={showPanel}
          onCountChange={setArrivalCount}
          onRequestCollapse={() => {
            setOpen(false);
            setPeeking(false);
          }}
        />
        <UrgentStaffAlerts
          variant="panel"
          panelVisible={showPanel}
          onCountChange={setUrgentCount}
          onRequestCollapse={() => {
            setOpen(false);
            setPeeking(false);
          }}
        />
      </div>

      {total > 0 ? (
        <button
          type="button"
          onClick={() => {
            setPeeking(false);
            setOpen(!showPanel);
          }}
          aria-expanded={showPanel}
          aria-label={`${showPanel ? "Hide" : "Show"} ${total} clinic alert${total === 1 ? "" : "s"}`}
          data-qc="alert-bubble"
          className="pointer-events-auto relative flex h-13 w-13 items-center justify-center rounded-full border border-edge bg-glass p-3.5 text-foreground shadow-lift backdrop-blur transition-transform hover:scale-105 active:scale-95 motion-reduce:transition-none"
        >
          <Bell className="h-5 w-5" aria-hidden />
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-bold text-white shadow-lift">
            {total > 9 ? "9+" : total}
          </span>
        </button>
      ) : (
        // Zero alerts: no bubble, but the (hidden) cards above keep counting.
        <span data-qc="alert-bubble-hidden" className="hidden" />
      )}
    </>
  );
}
