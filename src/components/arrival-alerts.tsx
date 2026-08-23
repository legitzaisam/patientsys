import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  BellRing,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  TriangleAlert,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { getDashboard, updateAppointmentState } from "@/lib/clinic.functions";
import {
  isArrivalAlertSnoozed,
  loadArrivalAlertSnoozes,
  snoozeArrivalAlert,
  type ArrivalAlertPhase,
} from "@/lib/arrival-alert-snooze";
import { Button } from "@/components/ui/button";
import { NoShowFollowUpDialog } from "@/components/no-show-followup-dialog";

type Phase = ArrivalAlertPhase;

const WINDOW_BEFORE_MS = 5 * 60 * 1000;
const OVERDUE_MS = 15 * 60 * 1000;

function phaseOf(startsAt: number, now: number): Phase | null {
  const diff = startsAt - now;
  if (diff > WINDOW_BEFORE_MS) return null;
  if (diff > 0) return "due";
  if (-diff < 5 * 60 * 1000) return "arrival";
  if (-diff < OVERDUE_MS) return "late";
  return "overdue";
}

function minutes(ms: number) {
  return Math.max(0, Math.round(ms / 60000));
}

const phaseMeta: Record<
  Phase,
  {
    label: string;
    icon: ElementType;
    /** Soft wash over the glass card — same pastel intensity as pill/badge. */
    wash: string;
    ring: string;
    badge: string;
    /** Collapsed pill — mid pastel fill + dark ink text. */
    pill: string;
    hint: string;
  }
> = {
  due: {
    label: "Soon",
    icon: Clock,
    wash: "bg-[rgba(156,207,227,0.52)]",
    ring: "ring-arrived/40",
    badge: "bg-[#9ccfe3] text-[#2a5f7a]",
    pill: "bg-[#9ccfe3] text-[#2a5f7a] ring-arrived/40",
    hint: "Due soon. Confirm arrival when the patient checks in.",
  },
  arrival: {
    label: "Due now",
    icon: CalendarClock,
    wash: "bg-[rgba(184,168,224,0.52)]",
    ring: "ring-warning/40",
    badge: "bg-[#b8a8e0] text-[#4a3a7a]",
    pill: "bg-[#b8a8e0] text-[#4a3a7a] ring-warning/40",
    hint: "Reception to confirm check-in now.",
  },
  late: {
    label: "Late",
    icon: TriangleAlert,
    // Soft pastel orange — light urgency step, not butter-gold Arrived.
    wash: "bg-[rgba(232,196,154,0.52)]",
    ring: "ring-[rgba(224,154,92,0.45)]",
    badge: "bg-[#e8c49a] text-[#7a4518]",
    pill: "bg-[#e8c49a] text-[#7a4518] ring-[rgba(224,154,92,0.45)]",
    hint: "Not marked as arrived yet.",
  },
  overdue: {
    label: "Overdue",
    icon: TriangleAlert,
    wash: "bg-[rgba(224,168,196,0.52)]",
    ring: "ring-destructive/40",
    badge: "bg-[#e0a8c4] text-[#7a2a4a]",
    pill: "bg-[#e0a8c4] text-[#7a2a4a] ring-destructive/40",
    hint: "Over 15 minutes late — contact the patient to reschedule.",
  },
};

export function ArrivalAlerts({ roles = [] }: { roles?: string[] }) {
  void roles;
  const queryClient = useQueryClient();
  const fetchDashboard = useServerFn(getDashboard);
  const [now, setNow] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(false);
  /** Snooze map (appointment id → until/phase); mirrored in sessionStorage for all pages. */
  const [snoozes, setSnoozes] = useState(() => loadArrivalAlertSnoozes());
  const [cursor, setCursor] = useState(0);
  const [noShowAppt, setNoShowAppt] = useState<any | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const collapsedBtnRef = useRef<HTMLButtonElement | null>(null);
  const restoreFocus = useRef(false);

  const { data } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => fetchDashboard(),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      setNow(t);
      setSnoozes(loadArrivalAlertSnoozes(t));
    };
    const id = setInterval(tick, 15_000);
    return () => clearInterval(id);
  }, []);

  // Re-read snoozes when this shell remounts, and on client navigations
  // (in case a sibling route remounts us without a full reload).
  useEffect(() => {
    setSnoozes(loadArrivalAlertSnoozes());
  }, []);

  useEffect(() => {
    const sync = () => setSnoozes(loadArrivalAlertSnoozes());
    window.addEventListener("pageshow", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("pageshow", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  useEffect(() => {
    if (collapsed || noShowAppt) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        restoreFocus.current = true;
        setCollapsed(true);
      } else if (panelRef.current?.contains(document.activeElement)) {
        if (e.key === "ArrowRight") setCursor((c) => c + 1);
        if (e.key === "ArrowLeft") setCursor((c) => Math.max(0, c - 1));
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [collapsed, noShowAppt]);

  useEffect(() => {
    if (collapsed && restoreFocus.current) {
      restoreFocus.current = false;
      collapsedBtnRef.current?.focus();
    }
  }, [collapsed]);

  const setState = useMutation({
    mutationFn: useServerFn(updateAppointmentState),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const alerts = useMemo(() => {
    const list = (data?.todayAppointments ?? []) as any[];
    return list
      .filter((a) => {
        const stage = a.stage ?? "booked";
        if (stage !== "booked") return false;
        if (a.status === "cancelled") return false;
        if (a.status === "no_show" && a.id !== noShowAppt?.id) return false;
        return phaseOf(new Date(a.starts_at).getTime(), now) !== null;
      })
      .map((a) => ({ appt: a, phase: phaseOf(new Date(a.starts_at).getTime(), now)! }))
      .sort((a, b) => new Date(a.appt.starts_at).getTime() - new Date(b.appt.starts_at).getTime());
  }, [data, now, noShowAppt]);

  const visible = alerts.filter(
    (a) => !isArrivalAlertSnoozed(a.appt.id, a.phase, now, snoozes),
  );

  const mostUrgentPhase = useMemo<Phase>(() => {
    const order: Phase[] = ["due", "arrival", "late", "overdue"];
    let highest: Phase = "due";
    for (const a of visible) {
      if (order.indexOf(a.phase) > order.indexOf(highest)) highest = a.phase;
    }
    return highest;
  }, [visible]);

  const noShowDialog = noShowAppt ? (
    <NoShowFollowUpDialog
      appointment={noShowAppt}
      open={!!noShowAppt}
      onOpenChange={(o) => !o && setNoShowAppt(null)}
      onMarkNoShow={async () => {
        await setState.mutateAsync({ data: { id: noShowAppt.id, stage: "no_show" } });
      }}
    />
  ) : null;

  if (visible.length === 0) return noShowDialog;

  const index = Math.min(cursor, visible.length - 1);
  const current = visible[index]!;
  const { appt: a, phase } = current;
  const start = new Date(a.starts_at).getTime();
  const name = `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""}`.trim() || "Patient";
  const firstName = name.split(" ")[0] ?? "Patient";
  const time = new Date(a.starts_at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const meta = phaseMeta[phase];
  const PhaseIcon = meta.icon;
  const statusDetail =
    phase === "due"
      ? `${minutes(start - now)} min`
      : phase === "late"
        ? `${minutes(start + OVERDUE_MS - now)} min left`
        : time;

  if (collapsed) {
    const pill = phaseMeta[mostUrgentPhase];
    const PillIcon = pill.icon;
    return (
      <>
        <button
          type="button"
          ref={collapsedBtnRef}
          aria-expanded={false}
          aria-label={`Show ${visible.length} arrival alert${visible.length > 1 ? "s" : ""}`}
          onClick={() => setCollapsed(false)}
          className={`inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-3.5 text-xs font-semibold shadow-glass ring-1 transition-all hover:-translate-y-0.5 ${pill.pill}`}
        >
          <PillIcon className="h-3.5 w-3.5" />
          <span className="tabular-nums">{visible.length}</span> Alert
          {visible.length > 1 ? "s" : ""}
          <ChevronUp className="h-3.5 w-3.5 opacity-70" />
        </button>
        {noShowDialog}
      </>
    );
  }

  return (
    <>
      <div
        ref={panelRef}
        role="region"
        aria-label="Arrival alerts"
        className="w-full"
      >
        <div
          className={`glass-card relative overflow-hidden !rounded-2xl p-3 shadow-popover ring-1 ${meta.ring}`}
        >
          <div className={`pointer-events-none absolute inset-0 ${meta.wash}`} aria-hidden />

          <div className="relative flex items-start gap-2">
            <span
              className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold ${meta.badge}`}
            >
              <PhaseIcon className="h-3 w-3" />
              {meta.label}
              <span className="tabular-nums">· {statusDetail}</span>
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              {visible.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous arrival"
                    disabled={index === 0}
                    onClick={() => setCursor(index - 1)}
                    className="rounded-full p-1 text-muted-foreground hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[2rem] text-center text-2xs tabular-nums text-muted-foreground">
                    {index + 1}/{visible.length}
                  </span>
                  <button
                    type="button"
                    aria-label="Next arrival"
                    disabled={index >= visible.length - 1}
                    onClick={() => setCursor(index + 1)}
                    className="rounded-full p-1 text-muted-foreground hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground disabled:opacity-30"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
              <button
                type="button"
                aria-label="Snooze this alert for 5 minutes"
                title="Snooze for 5 minutes"
                onClick={() => {
                  snoozeArrivalAlert(a.id, phase);
                  setSnoozes(loadArrivalAlertSnoozes());
                  setCursor(0);
                }}
                className="rounded-full p-1 text-muted-foreground hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground"
              >
                <Clock className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Collapse arrivals"
                onClick={() => setCollapsed(true)}
                className="rounded-full p-1 text-muted-foreground hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="relative mt-2.5 min-w-0">
            <p className="text-xs font-semibold text-foreground">Has {firstName} arrived?</p>
            <div className="mt-0.5 flex min-w-0 items-baseline gap-1.5 truncate">
              <Link
                to="/patients/$id"
                params={{ id: a.patient_id }}
                className="truncate text-sm font-semibold text-foreground hover:text-accent-ink"
              >
                {name}
              </Link>
              {a.patients?.phone ? (
                <>
                  <span className="shrink-0 text-muted-foreground">·</span>
                  <a
                    href={`tel:${a.patients.phone}`}
                    className="shrink-0 truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {a.patients.phone}
                  </a>
                </>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-2xs text-muted-foreground">
              {a.treatment_name}
              {a.profiles?.full_name ? ` · ${a.profiles.full_name}` : ""}
            </p>
            <p className="mt-1.5 text-2xs text-muted-foreground">
              {phase === "due"
                ? `Due at ${time}. Confirm arrival when the patient checks in.`
                : phase === "late"
                  ? `Not marked as arrived. ${minutes(start + OVERDUE_MS - now)} min before rescheduling is needed.`
                  : meta.hint}
            </p>
          </div>

          <div className="relative mt-3 flex gap-2">
            <Button
              size="sm"
              className="h-8 flex-1 px-3 text-xs"
              disabled={setState.isPending}
              onClick={() => {
                setState.mutate({ data: { id: a.id, stage: "arrived" } });
                setCursor(0);
              }}
            >
              <UserCheck className="h-3.5 w-3.5" /> Arrived
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 flex-1 px-3 text-xs"
              onClick={() => {
                setNoShowAppt(a);
                setCursor(0);
              }}
            >
              <UserX className="h-3.5 w-3.5" /> No show
            </Button>
          </div>
        </div>
      </div>
      {noShowDialog}
    </>
  );
}
