import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DoorOpen,
  FileSignature,
  Gift,
  Heart,
  Hourglass,
  Mail,
  Phone,
  Sparkles,
  UserX,
} from "lucide-react";
import { toast } from "sonner";
import { PatientAvatar } from "@/components/patient-avatar";
import { clinicDayKey } from "@/lib/clinic-time";
import { seedAppointmentNoteQueries } from "@/lib/appointment-note-cache";
import {
  logCallAttempt,
  resendDocument,
  sendMessage,
  sendPaymentRequest,
  updateAppointmentState,
} from "@/lib/clinic.functions";
import { formatMoney } from "@/lib/payment-link";
import { manualStageOptions, stageHeldForConsent, type ConsentState } from "@/lib/visit-stage";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { AppointmentTimeEditor } from "@/components/appointment-time-editor";
import { NoShowFollowUpDialog } from "@/components/no-show-followup-dialog";
import { ConsentInClinicDialog } from "@/components/consent-in-clinic-dialog";
import { VisitNoteChip, VisitNoteEditor, isPreAppointmentNote } from "@/components/visit-note-chip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Stage = "booked" | "arrived" | "waiting" | "in_treatment" | "aftercare" | "complete" | "no_show";

const STAGES: { key: Stage; label: string; icon: React.ElementType }[] = [
  { key: "booked", label: "Booked", icon: Calendar },
  { key: "arrived", label: "Arrived", icon: DoorOpen },
  { key: "waiting", label: "Waiting", icon: Hourglass },
  { key: "in_treatment", label: "In treatment", icon: Sparkles },
  { key: "aftercare", label: "Aftercare", icon: Heart },
  { key: "complete", label: "Complete", icon: CheckCircle2 },
];

const STAGE_TONE: Record<Stage, string> = {
  booked: "border border-edge bg-glass-2 text-muted-foreground",
  arrived: "bg-sky-bg text-sky-ink",
  waiting: "bg-warning-bg text-warning-ink",
  in_treatment: "bg-accent-soft text-accent-ink",
  aftercare: "bg-destructive-bg text-aftercare-ink",
  complete: "bg-success-bg text-success-ink",
  no_show: "bg-destructive-bg text-destructive-ink",
};

function stageOf(a: any): Stage {
  const raw = (a.stage ?? (a.status === "no_show" ? "no_show" : a.status === "attended" ? "complete" : "booked")) as Stage;
  const consent: ConsentState = a.consentState ?? (a.documents?.status === "signed" ? "signed" : "outstanding");
  return stageHeldForConsent(raw, consent) as Stage;
}

function sortByStart(appointments: any[]) {
  return [...appointments].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  );
}

export function TodaySnapshot({
  appointments,
  isManager,
  span = "day",
}: {
  appointments: any[];
  isManager: boolean;
  span?: "day" | "week";
}) {
  const queryClient = useQueryClient();
  const ordered = useMemo(
    () => sortByStart(appointments.filter((a) => a.status !== "cancelled")),
    [appointments],
  );

  useEffect(() => {
    seedAppointmentNoteQueries(queryClient, ordered);
  }, [ordered, queryClient]);

  if (ordered.length === 0) {
    // Match carousel bottom padding (item pb-1 + viewport pb-8).
    return (
      <div className="pb-9">
        <Link
          to="/schedule"
          className="block rounded-2xl bg-glass-2 p-8 text-center text-sm text-muted-foreground transition-colors hover:bg-accent-wash hover:text-foreground"
        >
          {span === "week" ? "No appointments this week." : "No appointments today."}
        </Link>
      </div>
    );
  }

  return (
    <AppointmentCarousel appointments={ordered} isManager={isManager} showDay={span === "week"} />
  );
}

function AppointmentCarousel({
  appointments,
  isManager,
  showDay,
}: {
  appointments: any[];
  isManager: boolean;
  showDay: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const jumpedKeyRef = useRef<string | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startScroll: number;
    moved: boolean;
  } | null>(null);

  const slides = () =>
    Array.from(scrollerRef.current?.querySelectorAll<HTMLElement>("[data-diary-slide]") ?? []);

  const padX = (el: HTMLElement) => {
    const styles = getComputedStyle(el);
    return {
      left: Number.parseFloat(styles.paddingLeft) || 0,
      right: Number.parseFloat(styles.paddingRight) || 0,
    };
  };

  /** Edge arrows from whether first/last cards are clipped — reliable with gutter padding. */
  const getEdges = () => {
    const el = scrollerRef.current;
    if (!el) return { canPrev: false, canNext: false };
    const list = slides();
    if (list.length === 0) return { canPrev: false, canNext: false };
    const { left: padL, right: padR } = padX(el);
    const bounds = el.getBoundingClientRect();
    const viewLeft = bounds.left + padL;
    const viewRight = bounds.right - padR;
    const first = list[0].getBoundingClientRect();
    const last = list[list.length - 1].getBoundingClientRect();
    return {
      canPrev: el.scrollLeft > 2 || first.left < viewLeft - 2,
      canNext:
        el.scrollLeft < el.scrollWidth - el.clientWidth - 2 || last.right > viewRight + 2,
    };
  };

  const syncEdges = () => {
    const { canPrev: prev, canNext: next } = getEdges();
    setCanPrev(prev);
    setCanNext(next);
  };

  const nearestIndex = () => {
    const el = scrollerRef.current;
    if (!el) return 0;
    const list = slides();
    if (list.length === 0) return 0;
    const target = el.getBoundingClientRect().left + padX(el).left;
    let best = 0;
    let bestDist = Infinity;
    list.forEach((slide, i) => {
      const dist = Math.abs(slide.getBoundingClientRect().left - target);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  };

  const scrollToIndex = (index: number, behavior: ScrollBehavior = "smooth") => {
    const el = scrollerRef.current;
    if (!el) return;
    const list = slides();
    const slide = list[Math.max(0, Math.min(list.length - 1, index))];
    if (!slide) return;
    const delta =
      slide.getBoundingClientRect().left - (el.getBoundingClientRect().left + padX(el).left);
    el.scrollBy({ left: delta, behavior });
    requestAnimationFrame(syncEdges);
    if (behavior === "smooth") {
      const onEnd = () => {
        syncEdges();
        el.removeEventListener("scrollend", onEnd);
      };
      el.addEventListener("scrollend", onEnd);
    }
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onScroll = () => syncEdges();
    const onWheel = (event: WheelEvent) => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const dx =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (dx === 0) return;
      event.preventDefault();
      el.scrollLeft = Math.max(0, Math.min(max, el.scrollLeft + dx));
      syncEdges();
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", onScroll);
    el.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(() => syncEdges());
    ro.observe(el);
    const raf = requestAnimationFrame(syncEdges);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", onScroll);
      el.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
  }, [appointments.length]);

  // Jump once per list identity to the first (earliest) appointment card.
  useEffect(() => {
    const key = `${appointments.length}:${appointments[0]?.id ?? ""}:${appointments[appointments.length - 1]?.id ?? ""}`;
    if (jumpedKeyRef.current === key) return;
    const el = scrollerRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      jumpedKeyRef.current = key;
      scrollToIndex(0, "auto");
      syncEdges();
    });
    return () => cancelAnimationFrame(id);
  }, [appointments]);

  /** Leftmost card at the snap origin — floor, not nearest. */
  const alignedIndex = () => {
    const el = scrollerRef.current;
    if (!el) return 0;
    const list = slides();
    if (list.length === 0) return 0;
    const origin = el.getBoundingClientRect().left + padX(el).left;
    let idx = 0;
    list.forEach((slide, i) => {
      if (slide.getBoundingClientRect().left <= origin + 12) idx = i;
    });
    return idx;
  };

  const setSnap = (on: boolean) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.classList.toggle("is-free-scroll", !on);
    // Inline snap must come off during a paged scroll — the scroller also sets
    // scroll-snap-type in CSS, and an inline value would win over the class.
    el.style.scrollSnapType = on ? "x mandatory" : "none";
  };

  // The arrows page by two cards on click. There is deliberately no hover
  // behaviour here: the old hover auto-glide kept the row moving whenever the
  // pointer sat near an edge, which made the cards hard to click.
  const onArrowClick = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    setSnap(false);
    scrollToIndex(alignedIndex() + dir * 2, "smooth");
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      setSnap(true);
      syncEdges();
    };
    el.addEventListener("scrollend", settle, { once: true });
    window.setTimeout(settle, 500);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("a, button, input, textarea, select, label")) return;
    const el = scrollerRef.current;
    if (!el) return;
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScroll: el.scrollLeft,
      moved: false,
    };
    // Capture is taken only once a drag is under way (see onPointerMove).
    // Capturing on every press retargets the following click to the strip,
    // so a plain click on a card never reached the card's own handler.
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = scrollerRef.current;
    if (!drag || !el || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    if (!drag.moved && Math.abs(dx) > 5) {
      drag.moved = true;
      el.dataset.diaryDragging = "1";
      el.setPointerCapture(event.pointerId);
    }
    if (!drag.moved) return;
    event.preventDefault();
    el.scrollLeft = drag.startScroll - dx;
    syncEdges();
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = scrollerRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (el?.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }
    if (drag.moved) {
      scrollToIndex(nearestIndex(), "smooth");
      window.setTimeout(() => {
        if (el) delete el.dataset.diaryDragging;
      }, 40);
    }
    dragRef.current = null;
    syncEdges();
  };

  return (
    <div className="relative isolate">
      {/*
        Pull left by the shadow gutter so card faces still line up with
        KPI / Attention, while pl-* keeps left shadows from clipping.
      */}
      <div className="relative -ml-5 min-w-0">
        {/*
          Mask the strip (not a painted grey overlay) so clipped cards dissolve
          into the page wash — the old --background gradient read as a grey
          ombre once the peach bloom sat behind the gutter.
        */}
        <div
          className={`diary-carousel-clip${canPrev ? " is-fade-left" : ""}${canNext ? " is-fade-right" : ""}`}
        >
          <div
            ref={scrollerRef}
            className="diary-carousel-scroller relative flex cursor-grab gap-4 overflow-x-auto overscroll-x-contain pl-5 pr-4 pt-3 pb-8 active:cursor-grabbing"
            style={{
              scrollPaddingInline: "1.25rem 1rem",
              touchAction: "pan-x",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {appointments.map((a) => (
              <div
                key={a.id}
                data-diary-slide
                className="w-[min(100%,280px)] shrink-0 snap-start py-1 sm:w-[280px] lg:w-[300px]"
              >
                <TodayCard appointment={a} isManager={isManager} showDay={showDay} />
              </div>
            ))}
          </div>
        </div>

        {/*
          Plain arrow buttons on the unmasked gutter. They are the size of the
          circle you see — not full-height hover zones — so the cards beside
          them stay clickable and nothing moves until you click.
        */}
        {canPrev ? (
          <div className="pointer-events-none absolute top-3 bottom-8 left-0 z-20 flex items-center pl-5">
            <button
              type="button"
              aria-label="Previous appointments"
              onClick={() => onArrowClick(-1)}
              className="pointer-events-auto inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-edge-2 bg-card/90 shadow-lift backdrop-blur-[2px] transition-colors hover:bg-card"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        {canNext ? (
          <div className="pointer-events-none absolute top-3 bottom-8 right-0 z-20 flex items-center pr-1">
            <button
              type="button"
              aria-label="Next appointments"
              onClick={() => onArrowClick(1)}
              className="pointer-events-auto inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-edge-2 bg-card/90 shadow-lift backdrop-blur-[2px] transition-colors hover:bg-card"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function formatDayHeading(dayKey: string) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 12)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function TodayCard({
  appointment: a,
  isManager,
  showDay = false,
}: {
  appointment: any;
  isManager: boolean;
  showDay?: boolean;
}) {
  const queryClient = useQueryClient();
  const logCall = useServerFn(logCallAttempt);
  const setState = useMutation({
    mutationFn: useServerFn(updateAppointmentState),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-week"] });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stage = stageOf(a);
  const stageMeta = STAGES.find((s) => s.key === stage) ?? STAGES[0];
  const StageIcon = stage === "no_show" ? UserX : stageMeta!.icon;
  const consentSigned = a.documents?.status === "signed";
  const paymentStatus = a.payment_status as "unpaid" | "deposit_paid" | "paid" | "refunded";
  const isCancelled = a.status === "cancelled";

  const setStage = (s: Stage) => setState.mutate({ data: { id: a.id, stage: s } });
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [cancelStep, setCancelStep] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const navigate = useNavigate();
  const consent: ConsentState = a.consentState ?? (consentSigned ? "signed" : "outstanding");
  const [consentOpen, setConsentOpen] = useState(false);
  const needsConsentInClinic = stage === "arrived" && consent !== "signed" && !isCancelled;
  const openTreatmentForm = () => {
    setDetailOpen(false);
    void navigate({ to: "/patients/$id", params: { id: a.patient_id }, search: { treat: a.id } });
  };
  const handleStage = (s: Stage) => {
    if (s === "no_show") {
      setNoShowOpen(true);
      return;
    }
    // Treatment starts from the form, which sets the stage itself.
    if (s === "in_treatment") {
      openTreatmentForm();
      return;
    }
    setStage(s);
  };

  const openDetail = () => {
    // Ignore the click that fires at the end of a drag on the strip.
    if (document.querySelector(".diary-carousel-scroller[data-diary-dragging]")) return;
    setCancelStep(false);
    setCancelReason("");
    setDetailOpen(true);
  };

  const confirmCancel = () => {
    const reason = cancelReason.trim();
    if (!reason) {
      toast.error("Please enter a reason for cancelling");
      return;
    }
    setState.mutate(
      { data: { id: a.id, status: "cancelled", cancel_reason: reason } },
      {
        onSuccess: () => {
          toast.success("Appointment cancelled");
          setDetailOpen(false);
          setCancelStep(false);
          setCancelReason("");
        },
      },
    );
  };

  const patientName =
    `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""}`.trim() || "Patient";
  const timeRange = `${new Date(a.starts_at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })} – ${new Date(a.ends_at).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  const stopCardOpen = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label={`View appointment for ${patientName}`}
        onClick={openDetail}
        onKeyDown={(e) => {
          // Only when the card itself is focused — ignore Enter from nested controls
          // (e.g. “Save new time” in the hover editor).
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openDetail();
          }
        }}
        className="cursor-pointer rounded-[22px] shadow-[var(--shadow-glass)] transition-[box-shadow] hover:shadow-[var(--shadow-lift)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="glass-card flex h-full flex-col gap-3 p-4 !shadow-none">
          <div className="space-y-1.5">
            <div className="flex items-start justify-between gap-3">
              <div className={showDay ? "space-y-1" : undefined}>
                {showDay && (
                  <p className="text-[11px] font-semibold leading-none tracking-[0.02em] text-ink-3">
                    {formatDayHeading(clinicDayKey(new Date(a.starts_at)))}
                  </p>
                )}
                <div onClick={stopCardOpen} onKeyDown={stopCardOpen}>
                  <AppointmentTimeEditor appointment={a}>
                    <button
                      type="button"
                      className="text-left text-xs font-medium leading-none tabular-nums text-accent-ink underline-offset-4 hover:underline"
                    >
                      {timeRange}
                    </button>
                  </AppointmentTimeEditor>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1" onClick={stopCardOpen}>
                <StageBadge
                  stage={stage}
                  StageIcon={StageIcon}
                  onChange={handleStage}
                  consent={consent}
                  locked={detailOpen}
                />
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <PatientAvatar
                patientId={a.patient_id}
                name={patientName}
                photoUrl={a.patients?.avatar_url}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <Link
                  to="/patients/$id"
                  params={{ id: a.patient_id }}
                  onClick={stopCardOpen}
                  className="block truncate text-sm font-semibold leading-snug tracking-[-0.012em] text-foreground hover:text-accent-ink"
                >
                  {patientName}
                </Link>
                <p className="truncate text-xs leading-snug text-muted-foreground">
                  {a.plan && a.treatment_number <= a.plan.totalSessions
                    ? `Session ${a.treatment_number} of ${a.plan.totalSessions}`
                    : `#${a.treatment_number}`}
                  {" · "}
                  {a.treatment_name}
                </p>
              </div>
            </div>
            {isManager && a.profiles?.full_name ? (
              <p className="text-xs leading-snug text-muted-foreground">⚕ {a.profiles.full_name}</p>
            ) : null}
          </div>

          <div
            className="mt-auto flex flex-nowrap items-center gap-1.5 [&_button]:inline-flex [&_button]:items-center"
            onClick={stopCardOpen}
          >
            <ConsentChip appointment={a} signed={consentSigned} />
            <PaymentChip appointment={a} status={paymentStatus} />
            <VisitNoteChip appointmentId={a.id} variant="chip" compact preRead={isPreAppointmentNote(a)} />
            {a.claimedOffer ? <ClaimedOfferChip offer={a.claimedOffer} /> : null}
          </div>
        </div>
      </div>

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setCancelStep(false);
            setCancelReason("");
          }
        }}
      >
        <DialogContent
          className="max-h-[min(90dvh,720px)] w-[calc(100vw-2rem)] max-w-md gap-0 overflow-y-auto overscroll-contain rounded-[22px] border-edge-2 bg-card/95 p-5 pb-5 shadow-popover sm:rounded-[22px]"
        >
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>
              {cancelStep ? "Cancel appointment" : patientName}
            </DialogTitle>
            <DialogDescription>
              {cancelStep
                ? `${patientName} · ${timeRange}`
                : `${timeRange}${
                    showDay ? ` · ${formatDayHeading(clinicDayKey(new Date(a.starts_at)))}` : ""
                  }`}
            </DialogDescription>
          </DialogHeader>

          {cancelStep ? (
            <div className="mt-4 space-y-4">
              <div className="field-stack">
                <Label htmlFor={`cancel-reason-${a.id}`}>Reason for cancelling</Label>
                <Textarea
                  id={`cancel-reason-${a.id}`}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Patient requested to reschedule, practitioner unavailable…"
                  rows={4}
                  className="rounded-2xl"
                />
                <p className="text-2xs text-muted-foreground">
                  This is saved on the appointment record for the clinic team.
                </p>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  disabled={setState.isPending}
                  onClick={() => {
                    setCancelStep(false);
                    setCancelReason("");
                  }}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  enterSubmit
                  disabled={setState.isPending || !cancelReason.trim()}
                  onClick={confirmCancel}
                >
                  Confirm cancel
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="space-y-2 rounded-2xl bg-glass-2 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{a.treatment_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Treatment #{a.treatment_number}
                      {a.profiles?.full_name ? ` · ${a.profiles.full_name}` : null}
                    </p>
                  </div>
                  <StageBadge
                    stage={stage}
                    StageIcon={StageIcon}
                    onChange={handleStage}
                    consent={consent}
                    reopenGraceMs={450}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <ConsentChip appointment={a} signed={consentSigned} />
                  <PaymentChip appointment={a} status={paymentStatus} />
                </div>
                {(a.patients?.phone || a.patients?.email) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-edge pt-2 text-xs text-muted-foreground">
                    {a.patients?.phone ? (
                      <a
                        href={`tel:${a.patients.phone}`}
                        className="hover:text-foreground hover:underline"
                        onClick={() =>
                          // Log the attempt so the call shows in the comms trail.
                          void logCall({
                            data: { patient_id: a.patient_id, phone: a.patients.phone },
                          }).catch(() => {})
                        }
                      >
                        {a.patients.phone}
                      </a>
                    ) : null}
                    {a.patients?.email ? (
                      <a
                        href={`mailto:${a.patients.email}`}
                        className="truncate hover:text-foreground hover:underline"
                      >
                        {a.patients.email}
                      </a>
                    ) : null}
                  </div>
                )}
              </div>

              {needsConsentInClinic ? (
                <div className="flex items-center gap-3 rounded-2xl bg-warning-bg px-3.5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-warning-ink">Consent outstanding</p>
                    <p className="text-2xs leading-snug text-warning-ink/80">
                      Have {a.patients?.first_name ?? "the patient"} sign on this device to move them to waiting.
                    </p>
                  </div>
                  <Button type="button" data-qc="complete-consent" className="shrink-0 text-xs" onClick={() => setConsentOpen(true)}>
                    Complete consent
                  </Button>
                </div>
              ) : null}
              {stage === "waiting" || stage === "in_treatment" || stage === "aftercare" ? (
                <Button type="button" data-qc="start-treatment" className="w-full text-xs" onClick={openTreatmentForm}>
                  {stage === "waiting" ? "Start treatment" : "Continue treatment form"}
                </Button>
              ) : null}

              <div className="flex gap-2">
                <Button asChild variant="outline" className="flex-1 text-xs">
                  <Link to="/patients/$id" params={{ id: a.patient_id }}>
                    Patient record
                  </Link>
                </Button>
                <Button asChild variant="outline" className="flex-1 text-xs">
                  <Link to="/schedule">Open schedule</Link>
                </Button>
              </div>

              <VisitNoteEditor
                appointmentId={a.id}
                preRead={isPreAppointmentNote(a)}
                minHeightClass="min-h-[180px]"
                footerEnd={
                  !isCancelled ? (
                    <Button type="button" onClick={() => setCancelStep(true)}>
                      Cancel appointment
                    </Button>
                  ) : undefined
                }
              />

              {isCancelled ? (
                <p className="rounded-xl bg-destructive-bg px-3 py-2 text-xs font-medium text-destructive-ink">
                  This appointment is cancelled
                  {a.notes ? `. ${String(a.notes).split("\n")[0]}` : "."}
                </p>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConsentInClinicDialog appointmentId={a.id} open={consentOpen} onOpenChange={setConsentOpen} />

      <NoShowFollowUpDialog
        appointment={a}
        open={noShowOpen}
        onOpenChange={setNoShowOpen}
        onMarkNoShow={async () => {
          await setState.mutateAsync({ data: { id: a.id, stage: "no_show" } });
        }}
      />
    </>
  );
}

function StageBadge({
  stage,
  StageIcon,
  onChange,
  consent = "outstanding",
  locked = false,
  reopenGraceMs = 0,
}: {
  stage: Stage;
  StageIcon: React.ElementType;
  onChange?: (s: Stage) => void;
  /** Gates "Waiting" and explains why when consent is still outstanding. */
  consent?: ConsentState;
  /** Keep closed (e.g. while the appointment detail dialog is open). */
  locked?: boolean;
  /**
   * Ignore hover-open for this many ms after mount so a dialog that appears
   * under the cursor does not auto-open the journey menu.
   */
  reopenGraceMs?: number;
}) {
  const [open, setOpen] = useState(false);
  const lastPointerType = useRef<string>("");
  const ignoreOpenUntil = useRef(0);

  useEffect(() => {
    if (reopenGraceMs > 0) {
      ignoreOpenUntil.current = Date.now() + reopenGraceMs;
      setOpen(false);
    }
  }, [reopenGraceMs]);

  useEffect(() => {
    if (locked) {
      setOpen(false);
      return;
    }
    // Dialog just closed; pointer may still sit on the badge without a real hover.
    ignoreOpenUntil.current = Date.now() + 300;
  }, [locked]);

  const label = stage === "no_show" ? "No show" : STAGES.find((s) => s.key === stage)?.label ?? "Booked";
  const options = manualStageOptions({ current: stage, consent });
  const trigger = (
    <button
      type="button"
      className={`inline-flex min-h-6 cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold shadow-inset-hi transition-[filter,box-shadow] hover:brightness-[0.96] hover:shadow-lift active:brightness-[0.9] ${STAGE_TONE[stage]}`}
      onPointerDown={(event) => {
        lastPointerType.current = event.pointerType;
      }}
      onClick={(event) => {
        // HoverCard ignores touch. A tap toggles the menu where hover does not exist.
        const touch =
          lastPointerType.current === "touch" ||
          (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches);
        if (touch) {
          event.stopPropagation();
          setOpen((v) => !v);
        }
      }}
    >
      <StageIcon className="h-3 w-3" />
      {label}
    </button>
  );

  if (!onChange) return trigger;

  return (
    <HoverCard
      open={locked ? false : open}
      onOpenChange={(next) => {
        if (locked) {
          setOpen(false);
          return;
        }
        // Stationary pointer over a newly mounted trigger is not intentional hover.
        if (next && Date.now() < ignoreOpenUntil.current) return;
        setOpen(next);
      }}
      openDelay={280}
      closeDelay={120}
    >
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent
        side="bottom"
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-56 rounded-2xl p-3.5"
      >
        <p className="text-sm font-semibold leading-snug text-foreground">Patient journey</p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          Waiting needs consent; treatment starts from the form.
        </p>
        <div className="mt-2.5 -mx-1.5 space-y-0.5">
          {STAGES.map((s) => {
            const Icon = s.icon;
            const active = s.key === stage;
            const option = options.find((o) => o.key === s.key);
            const disabled = option ? !option.enabled : false;
            return (
              <button
                key={s.key}
                type="button"
                data-stage-option={s.key}
                disabled={disabled}
                title={option?.reason}
                aria-disabled={disabled || undefined}
                onClick={() => onChange(s.key)}
                className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-xs leading-snug transition-colors ${
                  disabled
                    ? "cursor-not-allowed text-ink-3"
                    : active
                      ? "cursor-pointer bg-accent-soft font-semibold text-accent-ink"
                      : "cursor-pointer text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]"
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  {s.label}
                  {option?.opensForm ? <span className="ml-1 text-2xs text-muted-foreground">· opens the form</span> : null}
                  {disabled && option?.reason ? (
                    <span className="block text-2xs leading-snug text-ink-3">{option.reason}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onChange("no_show")}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-xs leading-snug transition-colors hover:bg-destructive-bg active:bg-destructive-bg ${
              stage === "no_show" ? "bg-destructive-bg font-semibold text-destructive-ink" : "text-destructive-ink"
            }`}
          >
            <UserX className="h-3.5 w-3.5 shrink-0" />
            <span>No show</span>
          </button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function ConsentChip({ appointment: a, signed }: { appointment: any; signed: boolean }) {
  const send = useMutation({
    mutationFn: useServerFn(sendMessage),
    onError: (e: Error) => toast.error(e.message),
  });
  const remind = useMutation({
    mutationFn: useServerFn(resendDocument),
    onError: (e: Error) => toast.error(e.message),
  });
  const name = `${a.patients?.first_name ?? ""}`.trim() || "there";
  const email = a.patients?.email as string | undefined;
  const phone = a.patients?.phone as string | undefined;

  const sendReminder = (channel: "email" | "sms") => {
    const target = channel === "email" ? email : phone;
    if (!target) {
      toast.error(channel === "email" ? "No email on file" : "No mobile number on file");
      return;
    }
    // With a consent form on the booking, remind with the real signing link.
    if (a.consent_document_id) {
      remind.mutate(
        {
          data: {
            id: a.consent_document_id,
            patient_id: a.patient_id,
            channel,
            app_origin: window.location.origin,
          },
        },
        {
          onSuccess: (r: { emailed: boolean }) =>
            toast.success(
              r.emailed
                ? `Consent reminder queued to send by ${channel === "email" ? "email" : "text"}`
                : "Consent reminder posted to their patient portal",
            ),
        },
      );
      return;
    }
    send.mutate(
      {
        data: {
          patient_id: a.patient_id,
          as: "staff" as const,
          body: `Hi ${name}, before your ${a.treatment_name} on ${new Date(
            a.starts_at,
          ).toLocaleDateString("en-GB")}, please complete and sign your consent form. You can open and sign it securely from your patient portal.`,
        },
      },
      { onSuccess: () => toast.success("Consent reminder posted to their patient portal") },
    );
  };

  const chip = (
    <span
      className={`inline-flex h-6 items-center gap-1 rounded-full px-2 text-2xs font-semibold leading-none shadow-inset-hi transition-[filter,box-shadow] ${
        signed ? "bg-success-bg text-success-ink" : "bg-warning-bg text-consent-ink"
      }`}
    >
      <FileSignature className="h-3 w-3 shrink-0" />
      {signed ? "Consent ✓" : "Consent due"}
    </span>
  );

  if (signed) return chip;

  return (
    <HoverCard openDelay={80} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center rounded-full transition-[filter,box-shadow] hover:brightness-[0.96] hover:shadow-lift active:brightness-[0.9]"
        >
          {chip}
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" sideOffset={8} className="w-64 rounded-2xl p-3.5 text-left">
        <p className="text-sm font-semibold leading-snug text-foreground">Consent outstanding</p>
        <p className="mt-1 text-xs leading-snug text-muted-foreground">Send a reminder to complete the consent form.</p>
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            className="flex-1 text-xs"
            disabled={send.isPending || remind.isPending}
            onClick={() => sendReminder("email")}
          >
            <Mail className="h-3 w-3" /> Email
          </Button>
          <Button
            variant="outline"
            className="flex-1 text-xs"
            disabled={send.isPending || remind.isPending}
            onClick={() => sendReminder("sms")}
          >
            <Phone className="h-3 w-3" /> Text
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/** The patient has claimed an offer that is still valid: apply it at the desk. */
function ClaimedOfferChip({ offer }: { offer: { id: string; headline: string; code: string | null } }) {
  return (
    <HoverCard openDelay={80} closeDelay={140}>
      <HoverCardTrigger asChild>
        <span
          className="inline-flex h-6 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full bg-accent-soft px-1.5 text-[10px] font-semibold leading-none text-accent-ink shadow-inset-hi"
          data-qc="claimed-offer-chip"
          aria-label="Offer claimed"
        >
          <Gift className="h-2.5 w-2.5 shrink-0" />
          Offer
        </span>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-64 rounded-2xl p-3.5 text-sm">
        <p className="font-semibold text-foreground">{offer.headline}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {offer.code ? (
            <>
              Code <span className="font-semibold text-foreground">{offer.code}</span> — apply it when taking payment.
            </>
          ) : (
            "Apply the offer when taking payment."
          )}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

function PaymentChip({ appointment: a, status }: { appointment: any; status: string }) {
  const send = useMutation({
    mutationFn: useServerFn(sendPaymentRequest),
    onError: (e: Error) => toast.error(e.message),
  });
  const [amountKind, setAmountKind] = useState<"deposit" | "full">("deposit");
  const email = a.patients?.email as string | undefined;
  const phone = a.patients?.phone as string | undefined;
  const total = Number(a.price ?? 0);
  const depositAmount = Math.round(total * 0.3 * 100) / 100;
  const balance = Math.round((total - depositAmount) * 100) / 100;
  const when = new Date(a.starts_at).toLocaleDateString("en-GB");

  // The server builds the message and queues the real send; a portal copy is
  // written alongside. Refused sends (no opt-in, bad address) surface as the
  // error toast rather than quietly downgrading to portal-only.
  const dispatch = (
    channel: "email" | "sms",
    kind: "deposit" | "full" | "balance" | "receipt",
    label: string,
  ) => {
    const target = channel === "email" ? email : phone;
    if (!target) {
      toast.error(channel === "email" ? "No email on file" : "No mobile number on file");
      return;
    }
    send.mutate(
      {
        data: {
          patient_id: a.patient_id,
          appointment_id: a.id,
          channel,
          kind,
          app_origin: window.location.origin,
        },
      },
      {
        onSuccess: () =>
          toast.success(`${label} queued to send by ${channel === "email" ? "email" : "text"}`),
      },
    );
  };

  const sendPayment = (channel: "email" | "sms", kind: "deposit" | "full" | "balance") => {
    dispatch(channel, kind, kind === "deposit" ? "Deposit link" : "Payment link");
  };

  const paid = status === "paid";
  const deposit = status === "deposit_paid";
  const selectedAmount = amountKind === "deposit" ? depositAmount : total;

  const chip = (
    <span
      className={`inline-flex h-6 items-center gap-1 rounded-full px-2 text-2xs font-semibold capitalize leading-none shadow-inset-hi ${
        paid
          ? "bg-success-bg text-success-ink"
          : deposit
            ? "bg-warning-bg text-warning-ink"
            : "bg-destructive-bg text-destructive-ink"
      }`}
    >
      <CreditCard className="h-3 w-3 shrink-0" />
      {status.replace("_", " ")}
    </span>
  );

  if (status === "refunded") return chip;

  return (
    <HoverCard openDelay={80} closeDelay={140}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center rounded-full transition-[filter,box-shadow] hover:brightness-[0.96] hover:shadow-lift active:brightness-[0.9]"
        >
          {chip}
        </button>
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="end" sideOffset={8} className="w-72 rounded-2xl p-3.5 text-left">
        <div className="space-y-3 text-xs leading-snug">
          {paid ? (
            <>
              <p className="text-sm font-semibold leading-snug text-foreground">Receipt</p>
              <div className="text-muted-foreground">
                <p className="text-foreground">{a.treatment_name}</p>
                <p>{when}</p>
                <p className="mt-1 font-semibold text-foreground">Paid in full {formatMoney(total)}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => dispatch("email", "receipt", "Receipt")}
                >
                  <Mail className="h-3 w-3" /> Email
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => dispatch("sms", "receipt", "Receipt")}
                >
                  <Phone className="h-3 w-3" /> Text
                </Button>
              </div>
            </>
          ) : deposit ? (
            <>
              <p className="text-sm font-semibold leading-snug text-foreground">Balance outstanding</p>
              <p className="text-muted-foreground">
                Deposit {formatMoney(depositAmount)} received. Send a link for the remaining{" "}
                <span className="font-semibold text-foreground">{formatMoney(balance)}</span>.
              </p>
              <p className="text-2xs text-muted-foreground">
                Texts and emails include a link to their patient account to pay.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => sendPayment("email", "balance")}
                >
                  <Mail className="h-3 w-3" /> Email
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => sendPayment("sms", "balance")}
                >
                  <Phone className="h-3 w-3" /> Text
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold leading-snug text-foreground">Payment outstanding</p>
              <p className="text-muted-foreground">Choose deposit or full amount, then send by email or text.</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={amountKind === "deposit" ? "selected" : "outline"}
                  onClick={() => setAmountKind("deposit")}
                  className="h-auto flex-1 flex-col items-center justify-center gap-0.5 py-2 text-center text-xs"
                >
                  <span className="block w-full text-center text-2xs font-semibold tracking-[0.02em]">Deposit</span>
                  <span className="block w-full text-center font-semibold tabular-nums">{formatMoney(depositAmount)}</span>
                </Button>
                <Button
                  type="button"
                  variant={amountKind === "full" ? "selected" : "outline"}
                  onClick={() => setAmountKind("full")}
                  className="h-auto flex-1 flex-col items-center justify-center gap-0.5 py-2 text-center text-xs"
                >
                  <span className="block w-full text-center text-2xs font-semibold tracking-[0.02em]">Full amount</span>
                  <span className="block w-full text-center font-semibold tabular-nums">{formatMoney(total)}</span>
                </Button>
              </div>
              <p className="text-2xs text-muted-foreground">
                Sending a {amountKind === "deposit" ? "deposit" : "full payment"} request for{" "}
                <span className="font-semibold text-foreground">{formatMoney(selectedAmount)}</span>
                . The message includes a link to pay in their account.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => sendPayment("email", amountKind)}
                >
                  <Mail className="h-3 w-3" /> Email
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => sendPayment("sms", amountKind)}
                >
                  <Phone className="h-3 w-3" /> Text
                </Button>
              </div>
            </>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
