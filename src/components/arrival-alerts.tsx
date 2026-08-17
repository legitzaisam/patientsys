import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  AlarmClock,
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
import { Button } from "@/components/ui/button";
import { NoShowFollowUpDialog } from "@/components/no-show-followup-dialog";

type Phase = "due" | "arrival" | "late" | "overdue";

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
    bar: string;
    bg: string;
    ring: string;
    shadow: string;
    badge: string;
    badgeText: string;
  }
> = {
  due: {
    label: "Arriving soon",
    icon: Clock,
    bar: "bg-arrived",
    bg: "bg-sky-bg",
    ring: "ring-arrived/30",
    shadow: "shadow-arrived/10",
    badge: "bg-sky-bg text-arrived-ink",
    badgeText: "text-arrived-ink",
  },
  arrival: {
    label: "Due now",
    icon: CalendarClock,
    bar: "bg-warning",
    bg: "bg-warning-bg",
    ring: "ring-warning/40",
    shadow: "shadow-warning/15",
    badge: "bg-warning-bg text-warning-ink",
    badgeText: "text-warning-ink",
  },
  late: {
    label: "Late",
    icon: TriangleAlert,
    bar: "bg-warning",
    bg: "bg-warning-bg",
    ring: "ring-warning/40",
    shadow: "shadow-warning/15",
    badge: "bg-warning-bg text-warning-ink",
    badgeText: "text-warning-ink",
  },
  overdue: {
    label: "Overdue",
    icon: TriangleAlert,
    bar: "bg-destructive",
    bg: "bg-destructive-bg",
    ring: "ring-destructive/40",
    shadow: "shadow-destructive/15",
    badge: "bg-destructive-bg text-destructive",
    badgeText: "text-destructive",
  },
};

export function ArrivalAlerts({ roles = [] }: { roles?: string[] }) {
  // Same card design for every staff role (reception layout is the standard).
  void roles;
  const isReception = true;
  const queryClient = useQueryClient();
  const fetchDashboard = useServerFn(getDashboard);
  const [now, setNow] = useState(() => Date.now());
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState<Record<string, Phase>>({});
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
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  // Keyboard support for the floating arrivals panel: Esc collapses it,
  // arrow keys move between queued arrivals. Disabled while a modal is open.
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
        // Keep the appointment visible while the no-show dialog is open so the
        // background doesn't flash/shift underneath the modal.
        if (a.status === "no_show" && a.id !== noShowAppt?.id) return false;
        return phaseOf(new Date(a.starts_at).getTime(), now) !== null;
      })
      .map((a) => ({ appt: a, phase: phaseOf(new Date(a.starts_at).getTime(), now)! }))
      .sort((a, b) => new Date(a.appt.starts_at).getTime() - new Date(b.appt.starts_at).getTime());
  }, [data, now, noShowAppt]);

  const visible = alerts.filter((a) => dismissed[a.appt.id] !== a.phase);

  const mostUrgentPhase = useMemo<Phase>(() => {
    const order: Phase[] = ["due", "arrival", "late", "overdue"];
    let highest: Phase = "due";
    for (const a of visible) {
      if (order.indexOf(a.phase) > order.indexOf(highest)) highest = a.phase;
    }
    return highest;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts, dismissed]);

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
  const current = alerts[index]!;
  const next = alerts[index + 1];

  if (collapsed) {
    const urgentMeta = phaseMeta[mostUrgentPhase];
    const isUrgent = mostUrgentPhase === "late" || mostUrgentPhase === "overdue";
    const isDestructive = mostUrgentPhase === "overdue";
    return (
      <>
      <button
        type="button"
        ref={collapsedBtnRef}
        aria-expanded={false}
        aria-label={`Show ${visible.length} arrival alert${visible.length > 1 ? "s" : ""}`}
        onClick={() => setCollapsed(false)}
        className={`fixed bottom-5 right-5 z-50 inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold shadow-glass ring-1 backdrop-blur-glass transition-all hover:-translate-y-0.5 ${
          isDestructive
            ? "bg-destructive text-destructive-foreground ring-destructive/40 animate-pulse"
            : `bg-glass text-foreground ${urgentMeta.ring}`
        }`}
      >
        {isUrgent ? <TriangleAlert className="h-4 w-4 text-warning-ink" /> : <BellRing className="h-4 w-4 text-arrived-ink" />}
        <span className="tabular-nums">{visible.length}</span> Arrival{visible.length > 1 ? "s" : ""}
        {isReception && <span className="opacity-80">to confirm</span>}
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
      className={`fixed bottom-5 right-5 z-50 max-w-[calc(100vw-2.5rem)] space-y-3 ${
        isReception ? "w-[24rem]" : "w-[19rem]"
      }`}
    >
      <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-card to-secondary/60 px-4 py-2.5 text-2xs tracking-[0.02em] text-muted-foreground shadow-lg ring-1 ring-border backdrop-blur">
        <span className="inline-flex items-center gap-2 font-semibold">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <AlarmClock className="h-3 w-3" />
          </span>
          {isReception ? "Arrivals — check in" : "Arrivals"}
          <span className="rounded-full bg-glass-2 px-2 py-0.5 text-2xs font-semibold tabular-nums text-foreground">
            {index + 1}/{visible.length}
          </span>
        </span>
        <span className="inline-flex items-center gap-1">
          {visible.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous arrival"
                disabled={index === 0}
                onClick={() => setCursor(index - 1)}
                className="rounded-full p-1 hover:bg-glass-2 hover:text-foreground disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Next arrival"
                disabled={index >= visible.length - 1}
                onClick={() => setCursor(index + 1)}
                className="rounded-full p-1 hover:bg-glass-2 hover:text-foreground disabled:opacity-30"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          <button
            type="button"
            aria-label="Snooze this alert"
            onClick={() => {
              const a = visible[index]?.appt;
              if (a) {
                setDismissed((d) => ({ ...d, [a.id]: visible[index]!.phase }));
                setCursor(0);
              }
            }}
            className="rounded-full p-1 hover:bg-glass-2 hover:text-foreground"
          >
            <Clock className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="ml-0.5 inline-flex items-center gap-1 rounded-full p-1 hover:bg-glass-2 hover:text-foreground"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>

      <div className="space-y-3">
        {[current].map(({ appt: a, phase }) => {
          const start = new Date(a.starts_at).getTime();
          const name = `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""}`.trim() || "Patient";
          const firstName = name.split(" ")[0];
          const time = new Date(a.starts_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
          const meta = phaseMeta[phase];
          const PhaseIcon = meta.icon;
          const askFirst = isReception && (phase === "arrival" || phase === "late" || phase === "overdue");
          return (
            <div
              key={a.id}
              className={`relative overflow-hidden rounded-3xl ${meta.bg} shadow-xl ring-1 backdrop-blur ${
                isReception ? "p-4" : "p-3"
              } ${meta.ring} ${meta.shadow}`}
            >
              <div className="min-w-0 flex-1">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold ${meta.badge}`}>
                  <PhaseIcon className="h-3 w-3" />
                  {meta.label}
                  <span className="tabular-nums opacity-80">
                    {phase === "due"
                      ? `· ${minutes(start - now)} min`
                      : `· ${time}`}
                  </span>
                </span>

                {askFirst && (
                  <p className="mt-2 text-sm font-semibold font-medium text-foreground">
                    Has {firstName} arrived?
                  </p>
                )}

                <div className="mt-1 flex items-center gap-2 truncate text-sm text-muted-foreground">
                  <Link
                    to="/patients/$id"
                    params={{ id: a.patient_id }}
                    className={`block shrink-0 truncate font-serif text-foreground hover:text-accent-ink ${
                      isReception ? "text-lg" : "text-sm"
                    }`}
                  >
                    {name}
                  </Link>
                  {a.patients?.phone && (
                    <>
                      <span className="shrink-0">·</span>
                      <a
                        href={`tel:${a.patients.phone}`}
                        className="shrink-0 truncate font-sans text-xs hover:text-foreground hover:underline"
                      >
                        {a.patients.phone}
                      </a>
                    </>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {a.treatment_name}
                  {a.profiles?.full_name ? ` · ${a.profiles.full_name}` : ""}
                </p>
              </div>

              {(isReception || phase === "overdue" || phase === "late") && (
                <p className={`mt-3 text-xs leading-relaxed ${meta.badgeText}/80`}>
                  {phase === "due"
                    ? `Due at ${time}. Confirm arrival when the patient checks in.`
                    : phase === "arrival"
                      ? "Reception to confirm check-in now."
                      : phase === "late"
                        ? `Not marked as arrived. ${minutes(start + OVERDUE_MS - now)} min before rescheduling is needed.`
                        : "Over 15 minutes late — contact the patient to reschedule."}
                </p>
              )}

              <div className={`flex gap-2 ${isReception ? "mt-4" : "mt-3"}`}>
                <Button
                  size={isReception ? "default" : "sm"}
                  variant="default"
                  className={`flex-1 text-xs transition-colors hover:bg-success-bg hover:bg-none hover:text-success-ink ${isReception ? "" : "h-8 px-3"}`}
                  disabled={setState.isPending}
                  onClick={() => {
                    setState.mutate({ data: { id: a.id, stage: "arrived" } });
                    setCursor(0);
                  }}
                >
                  <UserCheck className="mr-1.5 h-3.5 w-3.5" /> Arrived
                </Button>
                <Button
                  size={isReception ? "default" : "sm"}
                  variant="outline"
                  className={`flex-1 text-xs transition-colors hover:border-destructive hover:bg-destructive hover:text-destructive-foreground ${isReception ? "" : "h-8 px-3 text-muted-foreground"}`}
                  onClick={() => {
                    setNoShowAppt(a);
                    setCursor(0);
                  }}
                >
                  <UserX className="mr-1.5 h-3.5 w-3.5" /> No show
                </Button>
              </div>
            </div>
          );
        })}
        {next && (
          <button
            type="button"
            onClick={() => setCursor(index + 1)}
            className="flex w-full items-center justify-between rounded-2xl bg-glass px-4 py-2 text-2xs text-muted-foreground shadow-md ring-1 ring-border backdrop-blur transition-colors hover:bg-card hover:text-foreground"
          >
            <span className="inline-flex items-center gap-1.5 truncate">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-glass-2">
                <ChevronRight className="h-2.5 w-2.5" />
              </span>
              {`${next.appt.patients?.first_name ?? ""} ${next.appt.patients?.last_name ?? ""}`.trim() || "Patient"} ·{" "}
              {new Date(next.appt.starts_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="ml-2 shrink-0 tabular-nums">
              {visible.length - index - 1} in queue
            </span>
          </button>
        )}
      </div>
    </div>
    {noShowDialog}
    </>
  );
}
