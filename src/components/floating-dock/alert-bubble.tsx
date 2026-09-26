import { useEffect, useRef, useState, type ElementType } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { CalendarClock, ChevronDown, ChevronUp, Clock, Hourglass, Megaphone, ShieldAlert, TriangleAlert } from "lucide-react";
import { ArrivalAlerts } from "@/components/arrival-alerts";
import { UrgentStaffAlerts } from "@/components/urgent-staff-alerts";
import type { ArrivalAlertPhase } from "@/lib/arrival-alert-snooze";
import { cn } from "@/lib/utils";

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

const ARRIVAL_PILL: Record<
  ArrivalAlertPhase,
  { className: string; icon: ElementType }
> = {
  due: {
    className: "bg-[#9ccfe3] text-[#2a5f7a] ring-arrived/40",
    icon: Clock,
  },
  arrival: {
    className: "bg-[#b8a8e0] text-[#4a3a7a] ring-warning/40",
    icon: CalendarClock,
  },
  late: {
    className: "bg-[#e8c49a] text-[#7a4518] ring-[rgba(224,154,92,0.45)]",
    icon: TriangleAlert,
  },
  overdue: {
    className: "bg-[#e0a8c4] text-[#7a2a4a] ring-destructive/40",
    icon: TriangleAlert,
  },
  consent: {
    className: "bg-[#e8c49a] text-[#7a4518] ring-[rgba(224,154,92,0.45)]",
    icon: ShieldAlert,
  },
  waiting: {
    className: "bg-accent-soft text-accent-ink ring-accent/50",
    icon: Hourglass,
  },
};

const TEAM_PILL = {
  className: "bg-[#b8a8e0] text-[#4a3a7a] ring-warning/40",
  icon: Megaphone,
};

/**
 * One launcher for arrival alerts and urgent team alerts.
 *
 * Resting state is the original coloured “N Alerts” pill. Newly arriving
 * alerts still peek the panel for a few seconds (paused while hovered).
 */
export function AlertBubble({ roles }: { roles: string[] }) {
  const [open, setOpen] = useState(false);
  const [peeking, setPeeking] = useState(false);
  // null until each source has loaded — a fresh mount must not read as
  // "zero alerts" (it would reset the peek memory and replay on every page).
  const [arrivalCount, setArrivalCount] = useState<number | null>(null);
  const [urgentCount, setUrgentCount] = useState<number | null>(null);
  const [arrivalPhase, setArrivalPhase] = useState<ArrivalAlertPhase | null>(null);
  const ready = arrivalCount !== null && urgentCount !== null;
  const total = (arrivalCount ?? 0) + (urgentCount ?? 0);

  const seen = useRef(loadSeen());
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hovered = useRef(false);
  // On a phone the peeking card stack covers half the page; the pill's count
  // is the nudge there, and a tap opens the cards.
  const phone = useIsMobile(640);

  function armPeekTimer() {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    peekTimer.current = setTimeout(() => {
      if (hovered.current) armPeekTimer();
      else setPeeking(false);
    }, PEEK_MS);
  }

  useEffect(() => {
    if (!ready) return;
    if (total > seen.current && !open && !phone) {
      setPeeking(true);
      armPeekTimer();
    }
    if (total !== seen.current) {
      seen.current = total;
      storeSeen(total);
    }
  }, [ready, total, open, phone]);

  useEffect(
    () => () => {
      if (peekTimer.current) clearTimeout(peekTimer.current);
    },
    [],
  );

  const showPanel = (open || peeking) && total > 0;
  const pill =
    arrivalCount && arrivalCount > 0 && arrivalPhase
      ? ARRIVAL_PILL[arrivalPhase]
      : TEAM_PILL;
  const PillIcon = pill.icon;
  // Closed pill stays the overdue pink. Open still follows the alert type.
  const Chevron = showPanel ? ChevronDown : ChevronUp;

  return (
    <div className="flex flex-col items-end gap-3">
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
          onPhaseChange={setArrivalPhase}
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
          className={cn(
            "pointer-events-auto inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-3.5 text-xs font-semibold shadow-glass ring-1 transition-all hover:-translate-y-0.5",
            showPanel ? pill.className : ARRIVAL_PILL.overdue.className,
          )}
        >
          <PillIcon className="h-3.5 w-3.5" aria-hidden />
          <span className="tabular-nums">{total > 9 ? "9+" : total}</span>
          Alert{total === 1 ? "" : "s"}
          <Chevron className="h-3.5 w-3.5 opacity-70" aria-hidden />
        </button>
      ) : (
        // Zero alerts: no bubble, but the (hidden) cards above keep counting.
        <span data-qc="alert-bubble-hidden" className="hidden" />
      )}
    </div>
  );
}
