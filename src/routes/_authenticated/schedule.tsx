import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  DoorOpen,
  FileSignature,
  Heart,
  Hourglass,
  Mail,
  Phone,
  Plus,
  Send,
  Sparkles,
  UserX,
} from "lucide-react";
import {
  getCatalogue,
  listAppointments,
  listPatients,
  listPractitioners,
  rescheduleAppointment,
  saveAppointment,
  savePatient,
  updateAppointmentState,
} from "@/lib/clinic.functions";
import { checkEmail } from "@/lib/email";
import { useIdentity } from "@/lib/use-identity";
import { useStaffPresence } from "@/lib/use-staff-presence";
import { cn } from "@/lib/utils";
import { manualStageOptions, stageHeldForConsent, type ConsentState } from "@/lib/visit-stage";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NotesTextarea,
  NotesToolbar,
  SaveState,
  insertBullet,
  useNotesPrefs,
} from "@/components/notes/ios-notes-editor";
import { seedAppointmentNoteQueries } from "@/lib/appointment-note-cache";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { AppointmentTimeEditor } from "@/components/appointment-time-editor";
import { NoShowFollowUpDialog } from "@/components/no-show-followup-dialog";
import { QuickAddAppointment } from "@/components/quick-add-appointment";
import { durationForCatalogueItem } from "@/lib/treatment-duration";
import { clinicDayKey } from "@/lib/clinic-time";
import {
  findPractitionerOverlap,
  PRACTITIONER_OVERLAP_MESSAGE,
} from "@/lib/appointment-overlap";

import { initialsOf, laneFor, toneForTreatment } from "@/lib/practitioner-colours";
import { PractitionerHoverCard } from "@/components/practitioner-hovercard";
import { VisitNoteChip, isPreAppointmentNote } from "@/components/visit-note-chip";
import { useTreatmentColours } from "@/lib/use-treatment-colours";
import { resendDocument, sendMessage, sendPaymentRequest } from "@/lib/clinic.functions";
import { bookingNotifyDescription, formatMoney } from "@/lib/payment-link";

export const Route = createFileRoute("/_authenticated/schedule")({
  head: () => ({
    meta: [
      { title: "Clinic diary — Aetheria" },
      {
        name: "description",
        content:
          "Day, week and month views of every practitioner's bookings with consent and payment status at a glance.",
      },
      { property: "og:title", content: "Clinic diary — Aetheria" },
      { property: "og:description", content: "Practitioner bookings with consent and payment status." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SchedulePage,
});

type ViewMode = "day" | "week" | "month";

type Stage = "booked" | "arrived" | "waiting" | "in_treatment" | "aftercare" | "complete" | "no_show";

const STAGES: { key: Stage; label: string; short: string }[] = [
  { key: "booked", label: "Booked", short: "Booked" },
  { key: "arrived", label: "Arrived", short: "Arrived" },
  { key: "waiting", label: "Waiting", short: "Waiting" },
  { key: "in_treatment", label: "In treatment", short: "In tx" },
  { key: "aftercare", label: "Aftercare", short: "Aftercare" },
  { key: "complete", label: "Complete", short: "Done" },
];

function stageOf(a: any): Stage {
  const raw = (a.stage ?? (a.status === "no_show" ? "no_show" : a.status === "attended" ? "complete" : "booked")) as Stage;
  const consent: ConsentState = a.consentState ?? (a.documents?.status === "signed" ? "signed" : "outstanding");
  return stageHeldForConsent(raw, consent) as Stage;
}

const STAGE_META: Record<
  Stage,
  { icon: React.ElementType; tone: string; ring: string; label: string }
> = {
  booked: { icon: Calendar, tone: "text-muted-foreground", ring: "bg-glass-2 text-muted-foreground", label: "Booked" },
  arrived: { icon: DoorOpen, tone: "text-arrived-ink", ring: "bg-sky-bg text-arrived-ink", label: "Arrived" },
  waiting: { icon: Hourglass, tone: "text-warning-ink", ring: "bg-warning-bg text-warning-ink", label: "Waiting" },
  in_treatment: { icon: Sparkles, tone: "text-accent-ink", ring: "bg-accent-soft text-accent-ink", label: "In treatment" },
  aftercare: { icon: Heart, tone: "text-aftercare-ink", ring: "bg-destructive-bg text-aftercare-ink", label: "Aftercare" },
  complete: { icon: CheckCircle2, tone: "text-success-ink", ring: "bg-success-bg text-success-ink", label: "Complete" },
  no_show: { icon: UserX, tone: "text-destructive-ink", ring: "bg-destructive-bg text-destructive-ink", label: "No show" },
};

function stageTone(stage: Stage) {
  if (stage === "no_show") return "bg-destructive-bg text-destructive-ink";
  if (stage === "complete") return "bg-success-bg text-success-ink";
  if (stage === "in_treatment") return "bg-accent-soft text-accent-ink";
  if (stage === "aftercare") return "bg-destructive-bg text-aftercare-ink";
  if (stage === "booked") return "border border-edge bg-glass-2 text-muted-foreground";
  if (stage === "arrived") return "bg-sky-bg text-sky-ink";
  return "bg-warning-bg text-warning-ink";
}

const CHIP_BASE =
  "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-2xs font-medium tracking-[0.02em] leading-none transition-colors [&_svg]:pointer-events-none [&_svg]:size-3 [&_svg]:shrink-0";

function StageTracker({
  a,
  onState,
  compact,
}: {
  a: any;
  onState?: ((v: any) => Promise<unknown>) | undefined;
  compact?: boolean;
}) {
  const current = stageOf(a);
  const idx = STAGES.findIndex((s) => s.key === current);
  const [noShowOpen, setNoShowOpen] = useState(false);
  const navigate = useNavigate();
  const consent: ConsentState = a.consentState ?? (a.documents?.status === "signed" ? "signed" : "outstanding");
  const options = manualStageOptions({ current, consent });
  const set = (stage: Stage) => {
    // Treatment starts from the form, which sets the stage itself.
    if (stage === "in_treatment") {
      void navigate({ to: "/patients/$id", params: { id: a.patient_id }, search: { treat: a.id } });
      return;
    }
    onState?.({ data: { id: a.id, stage } });
  };
  const meta = STAGE_META[current];
  const label = current === "no_show" ? "No show" : (STAGES[idx]?.label ?? "Booked");
  const Icon = meta.icon;

  const trigger = (
    <button
      type="button"
      className={`${CHIP_BASE} ${stageTone(current)}`}
      title={`Patient stage: ${label}`}
    >
      <Icon />
      {compact ? (STAGES[idx]?.short ?? "No show") : label}
    </button>
  );

  if (!onState) return trigger;

  return (
    <>
    <HoverCard openDelay={80} closeDelay={140}>
      <HoverCardTrigger asChild>{trigger}</HoverCardTrigger>
      <HoverCardContent className="w-64 rounded-2xl" align="start">
        <p className="text-sm font-semibold text-foreground">Patient journey</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Waiting needs consent; treatment starts from the form.</p>
        <div className="mt-3 space-y-1">
          {STAGES.map((s, i) => {
            const done = current !== "no_show" && i < idx;
            const active = s.key === current;
            const stageMeta = STAGE_META[s.key];
            const StageIcon = stageMeta.icon;
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
                onClick={() => set(s.key)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-colors ${
                  disabled
                    ? "cursor-not-allowed text-ink-3"
                    : active
                      ? "cursor-pointer bg-accent-soft font-semibold text-accent-ink hover:bg-accent-wash"
                      : "cursor-pointer text-muted-foreground hover:bg-accent-wash"
                }`}
              >
                <span
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-2xs ${
                    active ? stageMeta.ring : done ? "bg-success-bg text-success-ink" : "bg-glass-2 text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="h-2.5 w-2.5" /> : <StageIcon className="h-2.5 w-2.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  {s.label}
                  {option?.opensForm ? <span className="ml-1 text-2xs text-ink-3">· opens the form</span> : null}
                  {disabled && option?.reason ? <span className="block text-2xs leading-snug text-ink-3">{option.reason}</span> : null}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setNoShowOpen(true)}
            className={`flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition-colors hover:bg-destructive-bg ${
              current === "no_show" ? "bg-destructive-bg text-destructive" : "text-destructive/80"
            }`}
          >
            <UserX className="h-3.5 w-3.5" /> No show
          </button>
        </div>
      </HoverCardContent>
    </HoverCard>
    <NoShowFollowUpDialog
      appointment={a}
      open={noShowOpen}
      onOpenChange={setNoShowOpen}
      onMarkNoShow={async () => {
        await onState?.({ data: { id: a.id, stage: "no_show" } });
      }}
    />
    </>
  );
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfWeek(d: Date) {
  const s = startOfDay(d);
  const day = (s.getDay() + 6) % 7; // Monday first
  s.setDate(s.getDate() - day);
  return s;
}
function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function dayKeyUtcNoon(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 12);
}

/** Centre control label for the diary jump control. */
function jumpControlLabel(anchor: Date, view: ViewMode) {
  if (view === "week") {
    const from = startOfWeek(anchor);
    const to = addDays(from, 6);
    const sameMonth = from.getMonth() === to.getMonth();
    const fromLabel = sameMonth
      ? String(from.getDate())
      : from.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const toLabel = to.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return `${fromLabel}–${toLabel}`;
  }
  if (view === "month") {
    return anchor.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  }

  const todayKey = clinicDayKey();
  const anchorKey = clinicDayKey(anchor);
  const dayDiff = Math.round((dayKeyUtcNoon(anchorKey) - dayKeyUtcNoon(todayKey)) / 86_400_000);
  if (dayDiff === 0) return "Today";
  if (dayDiff === -1) return "Yesterday";
  if (dayDiff === 1) return "Tomorrow";

  const [y, m, d] = anchorKey.split("-").map(Number);
  const labelDate = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1, 12));
  const includeYear = anchorKey.slice(0, 4) !== todayKey.slice(0, 4);
  return labelDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

function rangeFor(view: ViewMode, anchor: Date) {
  if (view === "day") return { from: startOfDay(anchor), to: addDays(startOfDay(anchor), 1) };
  if (view === "week") return { from: startOfWeek(anchor), to: addDays(startOfWeek(anchor), 7) };
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  return { from: gridStart, to: addDays(gridStart, 42) };
}

function SchedulePage() {
  const { data: identity } = useIdentity();
  const queryClient = useQueryClient();
  const [view, setView] = useState<ViewMode>("day");
  const [anchor, setAnchor] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const [dayPractitioner, setDayPractitioner] = useState<string[]>(["all"]);

  const fetchAppointments = useServerFn(listAppointments);
  const fetchPatients = useServerFn(listPatients);
  const fetchPractitioners = useServerFn(listPractitioners);
  const fetchCatalogue = useServerFn(getCatalogue);

  const { from, to } = useMemo(() => rangeFor(view, anchor), [view, anchor]);

  const { data: appointments } = useQuery({
    queryKey: ["appointments", from.toISOString(), to.toISOString()],
    queryFn: () => fetchAppointments({ data: { from: from.toISOString(), to: to.toISOString() } }),
    enabled: !!identity?.isStaff,
  });

  useEffect(() => {
    seedAppointmentNoteQueries(queryClient, appointments);
  }, [appointments, queryClient]);

  const { data: patients } = useQuery({
    queryKey: ["patients"],
    queryFn: () => fetchPatients(),
    enabled: !!identity?.isStaff,
  });
  const { data: practitioners } = useQuery({
    queryKey: ["practitioners"],
    queryFn: () => fetchPractitioners(),
    enabled: !!identity?.isStaff,
  });
  const { data: catalogue } = useQuery({
    queryKey: ["catalogue"],
    queryFn: () => fetchCatalogue(),
    enabled: !!identity?.isStaff,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["appointments"] });
  const [newPatient, setNewPatient] = useState(false);
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newDob, setNewDob] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newEmailError, setNewEmailError] = useState<string | null>(null);
  const [newEmailSuggestion, setNewEmailSuggestion] = useState<string | null>(null);
  const [bookingPatientId, setBookingPatientId] = useState("");
  const [bookingCatalogueId, setBookingCatalogueId] = useState("");
  const [bookingPractitionerId, setBookingPractitionerId] = useState("");
  const [bookingStartsAt, setBookingStartsAt] = useState("");
  const [bookingDuration, setBookingDuration] = useState("60");
  const [bookingPrice, setBookingPrice] = useState("");
  const [bookingPayAction, setBookingPayAction] = useState<"unpaid" | "take" | "link">("unpaid");
  const [bookingPayKind, setBookingPayKind] = useState<"deposit" | "full">("deposit");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingNotesDirty, setBookingNotesDirty] = useState(false);
  const bookingNotesRef = useRef<HTMLTextAreaElement>(null);
  const bookingNotesPrefs = useNotesPrefs("notes-prefs:visit-notes");
  const seededBookingDuration = useRef(false);

  const patientReady = newPatient
    ? Boolean(newFirstName.trim() && newLastName.trim() && newDob)
    : Boolean(bookingPatientId);
  const emailReady =
    !newPatient || !newEmail.trim() || (!newEmailError && checkEmail(newEmail).ok);
  const canSubmitBooking =
    patientReady &&
    emailReady &&
    Boolean(bookingCatalogueId) &&
    Boolean(bookingPractitionerId) &&
    Boolean(bookingStartsAt);

  useEffect(() => {
    if (!open) {
      seededBookingDuration.current = false;
      setBookingNotes("");
      setBookingNotesDirty(false);
      setBookingPrice("");
      setBookingPayAction("unpaid");
      setBookingPayKind("deposit");
      setNewPatient(false);
      setNewFirstName("");
      setNewLastName("");
      setNewDob("");
      setNewEmail("");
      setNewEmailError(null);
      setNewEmailSuggestion(null);
      setBookingPatientId("");
      setBookingCatalogueId("");
      setBookingPractitionerId("");
      setBookingStartsAt("");
      return;
    }
    if (seededBookingDuration.current) return;
    seededBookingDuration.current = true;
  }, [open]);

  useEffect(() => {
    if (!bookingNotesDirty) return;
    const t = setTimeout(() => setBookingNotesDirty(false), 900);
    return () => clearTimeout(t);
  }, [bookingNotes, bookingNotesDirty]);

  const book = useMutation({
    mutationFn: useServerFn(saveAppointment),
    onSuccess: (r: { queued?: string[] }) => {
      toast.success("Appointment booked", {
        description: bookingNotifyDescription(r.queued),
      });
      setOpen(false);
      setNewPatient(false);
      setBookingNotes("");
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-diary-count"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-week"] });
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const addPatient = useMutation({
    mutationFn: useServerFn(savePatient),
    onError: (e: Error) => toast.error(e.message),
  });
  const setState = useMutation({
    mutationFn: useServerFn(updateAppointmentState),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!identity.isStaff) return <div className="p-12 text-sm text-muted-foreground">Staff access only.</div>;

  const rows = (appointments ?? []) as any[];
  const step = view === "day" ? 1 : view === "week" ? 7 : 30;
  const shift = (dir: number) => {
    if (view === "month") {
      setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
    } else {
      setAnchor(addDays(anchor, dir * step));
    }
  };

  const heading =
    view === "day"
      ? anchor.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
      : view === "week"
        ? `${startOfWeek(anchor).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${addDays(
            startOfWeek(anchor),
            6,
          ).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
        : anchor.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <AppShell identity={identity}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="page-header">
          <div className="min-w-0">
            <h1 className="page-title">Clinic diary</h1>
            <p className="page-subtitle truncate">{heading}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex h-[34px] items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shift(-1)} aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" className="h-7 px-3 text-xs" onClick={() => setAnchor(new Date())}>
              {jumpControlLabel(anchor, view)}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shift(1)} aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex h-[34px] items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi">
            {(["day", "week", "month"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`h-7 cursor-pointer rounded-full px-3.5 text-xs capitalize tracking-[0.02em] transition-colors ${
                  view === v
                    ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                    : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>New booking</Button>
            </DialogTrigger>
            <DialogContent
              className="flex max-h-[min(90dvh,720px)] w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[22px] border-edge-2 bg-card/95 p-5 pb-5 shadow-popover sm:rounded-[22px]"
              onCloseAutoFocus={(e) => e.preventDefault()}
            >
              <DialogHeader className="shrink-0 pr-8 text-left">
                <DialogTitle>
                  New booking
                </DialogTitle>
                <DialogDescription>Patient, treatment, time and payment.</DialogDescription>
              </DialogHeader>
              {/* Scroll gutter: track sits near the card edge, clear of fields. */}
              <div className="mt-4 -mr-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-3.5">
              <form
                id="booking"
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget as HTMLFormElement);
                  const item = (catalogue ?? []).find((c: any) => c.id === bookingCatalogueId);
                  let patientId = "";
                  if (newPatient) {
                    const first = newFirstName.trim();
                    const last = newLastName.trim();
                    if (!first || !last) {
                      toast.error("Enter the patient's first and last name");
                      return;
                    }
                    if (!newDob) {
                      toast.error("Enter the patient's date of birth");
                      return;
                    }
                    let patientEmail = "";
                    if (newEmail.trim()) {
                      const check = checkEmail(newEmail);
                      if (!check.ok) {
                        setNewEmailError(check.error);
                        setNewEmailSuggestion(check.suggestion ?? null);
                        return;
                      }
                      patientEmail = check.email;
                    }
                    if (!bookingCatalogueId) {
                      toast.error("Choose a treatment");
                      return;
                    }
                    if (!bookingPractitionerId) {
                      toast.error("Choose a practitioner");
                      return;
                    }
                    if (!bookingStartsAt) {
                      toast.error("Choose a date and time");
                      return;
                    }
                    try {
                      const created = await addPatient.mutateAsync({
                        data: {
                          first_name: first,
                          last_name: last,
                          title: String(f.get("new_title") ?? ""),
                          email: patientEmail,
                          phone: String(f.get("new_phone") ?? "").trim(),
                          date_of_birth: newDob,
                        },
                      });
                      patientId = created.id;
                      queryClient.invalidateQueries({ queryKey: ["patients"] });
                      toast.success(`${first} ${last} added to patients`);
                    } catch {
                      return;
                    }
                  } else {
                    patientId = bookingPatientId;
                    if (!patientId) {
                      toast.error("Choose a patient");
                      return;
                    }
                    if (!bookingCatalogueId) {
                      toast.error("Choose a treatment");
                      return;
                    }
                    if (!bookingPractitionerId) {
                      toast.error("Choose a practitioner");
                      return;
                    }
                    if (!bookingStartsAt) {
                      toast.error("Choose a date and time");
                      return;
                    }
                  }

                  const price = Number(f.get("price") ?? 0);
                  const paymentStatus =
                    bookingPayAction === "take"
                      ? bookingPayKind === "deposit"
                        ? "deposit_paid"
                        : "paid"
                      : "unpaid";
                  const payKind =
                    paymentStatus === "deposit_paid"
                      ? ("balance" as const)
                      : bookingPayAction === "link" && bookingPayKind === "deposit"
                        ? ("deposit" as const)
                        : ("full" as const);

                  book.mutate({
                    data: {
                      patient_id: patientId,
                      practitioner_id: bookingPractitionerId,
                      catalogue_id: bookingCatalogueId,
                      treatment_name: item?.name ?? "Treatment",
                      treatment_number: Number(f.get("treatment_number") ?? 1),
                      starts_at: new Date(bookingStartsAt).toISOString(),
                      duration_minutes: Number(f.get("duration_minutes") ?? bookingDuration ?? 30),
                      price,
                      payment_status: paymentStatus,
                      notes: String(f.get("notes") ?? ""),
                      app_origin: typeof window !== "undefined" ? window.location.origin : "",
                      pay_kind: payKind,
                    },
                  });
                }}
              >
                <div className="field-stack sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label>Patient</Label>
                    <button
                      type="button"
                      onClick={() => setNewPatient((v) => !v)}
                      className="text-xs text-accent-ink hover:underline"
                    >
                      {newPatient ? "Choose existing patient" : "+ New patient"}
                    </button>
                  </div>
                  {newPatient ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextField name="new_title" label="Title" />
                      <TextField
                        name="new_first_name"
                        label="First name"
                        required
                        value={newFirstName}
                        onChange={setNewFirstName}
                      />
                      <TextField
                        name="new_last_name"
                        label="Last name"
                        required
                        value={newLastName}
                        onChange={setNewLastName}
                      />
                      <TextField
                        name="new_dob"
                        label="Date of birth"
                        type="date"
                        required
                        value={newDob}
                        onChange={setNewDob}
                      />
                      <div className="field-stack">
                        <Label htmlFor="new_email">Email</Label>
                        <Input
                          id="new_email"
                          name="new_email"
                          type="email"
                          value={newEmail}
                          aria-invalid={Boolean(newEmailError)}
                          onChange={(e) => {
                            setNewEmail(e.target.value);
                            // Only show email errors after blur or submit — not while typing.
                            setNewEmailError(null);
                            setNewEmailSuggestion(null);
                          }}
                          onBlur={() => {
                            if (!newEmail.trim()) {
                              setNewEmailError(null);
                              setNewEmailSuggestion(null);
                              return;
                            }
                            const check = checkEmail(newEmail);
                            setNewEmailError(check.ok ? null : check.error);
                            setNewEmailSuggestion(check.ok ? null : (check.suggestion ?? null));
                          }}
                          className="rounded-xl"
                        />
                        {newEmailError && (
                          <p className="text-xs text-destructive">
                            {newEmailError}
                            {newEmailSuggestion ? (
                              <>
                                {" "}
                                <button
                                  type="button"
                                  className="font-medium underline underline-offset-2 hover:text-destructive/90"
                                  onClick={() => {
                                    setNewEmail(newEmailSuggestion);
                                    setNewEmailError(null);
                                    setNewEmailSuggestion(null);
                                  }}
                                >
                                  Yes
                                </button>
                              </>
                            ) : null}
                          </p>
                        )}
                      </div>
                      <TextField name="new_phone" label="Mobile" />
                    </div>
                  ) : (
                    <SelectField
                      name="patient_id"
                      label=""
                      value={bookingPatientId}
                      required
                      onChange={(e) => setBookingPatientId(e.target.value)}
                    >
                      <option value="">Select patient</option>
                      {(patients ?? []).map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.first_name} {p.last_name}
                        </option>
                      ))}
                    </SelectField>
                  )}
                </div>
                <SelectField
                  name="practitioner_id"
                  label="Practitioner"
                  value={bookingPractitionerId}
                  required
                  onChange={(e) => setBookingPractitionerId(e.target.value)}
                >
                  <option value="">Select practitioner</option>
                  {(practitioners ?? []).map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name || "Unnamed"}
                    </option>
                  ))}
                </SelectField>
                <SelectField
                  name="catalogue_id"
                  label="Treatment"
                  value={bookingCatalogueId}
                  required
                  onChange={(e) => {
                    const id = e.target.value;
                    setBookingCatalogueId(id);
                    const item = (catalogue ?? []).find((c: any) => c.id === id);
                    setBookingDuration(String(durationForCatalogueItem(item)));
                    setBookingPrice(item?.price != null && item.price !== "" ? String(item.price) : "");
                  }}
                >
                  <option value="">Select treatment</option>
                  {(catalogue ?? []).map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </SelectField>
                <TextField name="treatment_number" label="Treatment number" type="number" defaultValue="1" />
                <TextField
                  name="duration_minutes"
                  label="Duration (min)"
                  type="number"
                  value={bookingDuration}
                  onChange={setBookingDuration}
                />
                <TextField
                  name="starts_at"
                  label="Date & time"
                  type="datetime-local"
                  required
                  value={bookingStartsAt}
                  onChange={setBookingStartsAt}
                />
                <TextField
                  name="price"
                  label="Price (£)"
                  type="number"
                  value={bookingPrice}
                  onChange={setBookingPrice}
                />
                <div className="field-stack sm:col-span-2">
                  <Label>Payment</Label>
                  {(() => {
                    const total = Number(bookingPrice || 0);
                    const depositAmount = Math.round(total * 0.3 * 100) / 100;
                    const selectedAmount = bookingPayKind === "deposit" ? depositAmount : total;
                    const modeBtn = (key: typeof bookingPayAction, label: string) => (
                      <Button
                        key={key}
                        type="button"
                        variant={bookingPayAction === key ? "selected" : "outline"}
                        onClick={() => setBookingPayAction(key)}
                        className="h-[34px] flex-1 px-[15px] text-xs"
                      >
                        {label}
                      </Button>
                    );
                    return (
                      <div className="field-stack">
                        <div className="flex gap-2">
                          {modeBtn("unpaid", "Leave unpaid")}
                          {modeBtn("take", "Take payment")}
                          {modeBtn("link", "Send link")}
                        </div>

                        {bookingPayAction === "unpaid" && (
                          <p className="text-2xs text-muted-foreground">
                            Confirmation and payment link are sent by email or text when on file,
                            plus their patient portal.
                          </p>
                        )}

                        {bookingPayAction !== "unpaid" && (
                          <>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant={bookingPayKind === "deposit" ? "selected" : "outline"}
                                onClick={() => setBookingPayKind("deposit")}
                                className="h-auto flex-1 flex-col gap-0.5 py-2 text-xs"
                              >
                                <span className="text-2xs font-semibold tracking-[0.02em]">Deposit</span>
                                <span className="font-semibold tabular-nums">
                                  {formatMoney(depositAmount)}
                                </span>
                              </Button>
                              <Button
                                type="button"
                                variant={bookingPayKind === "full" ? "selected" : "outline"}
                                onClick={() => setBookingPayKind("full")}
                                className="h-auto flex-1 flex-col gap-0.5 py-2 text-xs"
                              >
                                <span className="text-2xs font-semibold tracking-[0.02em]">Full amount</span>
                                <span className="font-semibold tabular-nums">
                                  {formatMoney(total)}
                                </span>
                              </Button>
                            </div>

                            {bookingPayAction === "take" ? (
                              <p className="text-2xs text-muted-foreground">
                                Marks this booking as{" "}
                                {bookingPayKind === "deposit" ? "deposit paid" : "paid in full"} for{" "}
                                <span className="font-semibold text-foreground">
                                  {formatMoney(selectedAmount)}
                                </span>
                                . Confirmation is still sent to the patient.
                              </p>
                            ) : (
                              <p className="text-2xs text-muted-foreground">
                                After booking, the confirmation includes a{" "}
                                {bookingPayKind === "deposit" ? "deposit" : "full payment"} link for{" "}
                                <span className="font-semibold text-foreground">
                                  {formatMoney(selectedAmount)}
                                </span>{" "}
                                — sent by email or text when on file, plus their portal.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="field-stack sm:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">Visit note</p>
                      <p className="text-2xs text-muted-foreground">Shared with the clinical team</p>
                    </div>
                    <NotesToolbar
                      prefs={bookingNotesPrefs}
                      onBullet={() =>
                        insertBullet(bookingNotesRef.current, bookingNotes, setBookingNotes)
                      }
                    />
                  </div>
                  <NotesTextarea
                    textareaRef={bookingNotesRef}
                    value={bookingNotes}
                    onChange={(v) => {
                      setBookingNotes(v);
                      setBookingNotesDirty(true);
                    }}
                    prefs={bookingNotesPrefs}
                    placeholder="Notes for this visit…"
                    autoGrow
                    className="min-h-[52px]"
                  />
                  <input type="hidden" name="notes" value={bookingNotes} />
                  <div className="mt-1.5 flex items-center justify-between gap-2 pl-1">
                    <SaveState saving={false} dirty={bookingNotesDirty} />
                    <Button
                      type="submit"
                      disabled={!canSubmitBooking || book.isPending || addPatient.isPending}
                    >
                      {newPatient ? "Add patient & book" : "Book appointment"}
                    </Button>
                  </div>
                </div>
              </form>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {view === "day" && (
        <DayPlanner
          rows={rows}
          date={anchor}
          onState={setState.mutateAsync}
          practitioners={(practitioners ?? []) as any[]}
          patients={(patients ?? []) as any[]}
          catalogue={(catalogue ?? []) as any[]}
          selected={dayPractitioner}
          onSelect={setDayPractitioner}
        />
      )}
      {view === "week" && (
        <WeekView
          rows={rows}
          start={startOfWeek(anchor)}
          onState={setState.mutateAsync}
          practitioners={(practitioners ?? []) as any[]}
          patients={(patients ?? []) as any[]}
          catalogue={(catalogue ?? []) as any[]}
          date={anchor}
          selected={dayPractitioner}
          onSelect={setDayPractitioner}
        />
      )}
      {view === "month" && (
        <MonthView
          rows={rows}
          anchor={anchor}
          gridStart={from}
          onPick={(d) => { setAnchor(d); setView("day"); }}
          practitioners={(practitioners ?? []) as any[]}
          patients={(patients ?? []) as any[]}
          catalogue={(catalogue ?? []) as any[]}
          selected={dayPractitioner}
          onSelect={setDayPractitioner}
        />
      )}
      </div>
    </AppShell>
  );
}

function AppointmentCard({ a, onState }: { a: any; onState?: (v: any) => Promise<unknown> }) {
  const consentSigned = a.documents?.status === "signed";
  return (
    <div className="glass-card group cursor-pointer p-3 transition-all hover:shadow-lift">
      <div className="mb-2 flex items-start justify-between gap-2">
        <AppointmentTimeEditor appointment={a}>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-semibold tabular-nums text-accent-ink shadow-inset-hi transition-colors hover:brightness-105"
          >
            {new Date(a.starts_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            {" – "}
            {new Date(a.ends_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
          </button>
        </AppointmentTimeEditor>
        <div className="flex items-center gap-1">
          <PaymentStatusChip a={a} compact />
          <VisitNoteChip appointmentId={a.id} variant="chip" compact preRead={isPreAppointmentNote(a)} />
        </div>
      </div>
      <Link
        to="/patients/$id"
        params={{ id: a.patient_id }}
        className="block text-sm font-semibold leading-tight text-foreground hover:text-accent-ink"
      >
        {a.patients?.first_name} {a.patients?.last_name}
      </Link>
      <p className="text-xs text-muted-foreground">
        {a.treatment_name}{" "}
        <span className="text-muted-foreground/60">· #{a.treatment_number}</span>
        <span className="text-muted-foreground/60"> · {a.profiles?.full_name ?? "Unassigned"}</span>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <ConsentChip a={a} signed={consentSigned} compact />
        <StageTracker a={a} onState={onState} compact />
      </div>
    </div>
  );
}

function PaymentStatusChip({ a, compact }: { a: any; compact?: boolean }) {
  const send = useMutation({
    mutationFn: useServerFn(sendPaymentRequest),
    onError: (e: Error) => toast.error(e.message),
  });
  const [amountKind, setAmountKind] = useState<"deposit" | "full">("deposit");
  const status = a.payment_status as "unpaid" | "deposit_paid" | "paid" | "refunded";
  const paid = status === "paid";
  const deposit = status === "deposit_paid";
  const email = a.patients?.email as string | undefined;
  const phone = a.patients?.phone as string | undefined;
  const total = Number(a.price ?? 0);
  const depositAmount = Math.round(total * 0.3 * 100) / 100;
  const balance = Math.round((total - depositAmount) * 100) / 100;
  const when = new Date(a.starts_at).toLocaleDateString("en-GB");

  // The server builds the message and queues the real send; a portal copy is
  // written alongside. Refused sends surface as the error toast.
  const dispatch = (
    channel: "email" | "sms",
    kind: "deposit" | "full" | "balance" | "receipt",
    label: string,
  ) => {
    const target = channel === "email" ? email : phone;
    if (!target) {
      toast.error(channel === "email" ? "No email on file for this patient" : "No mobile number on file");
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

  const chipClass = `${CHIP_BASE} ${
    paid
      ? "bg-success-bg text-success-ink"
      : deposit
        ? "bg-warning-bg text-warning-ink"
        : "bg-destructive-bg text-destructive"
  }`;
  const chipLabel = compact
    ? paid
      ? "Paid"
      : deposit
        ? "Deposit"
        : status === "refunded"
          ? "Refund"
          : "Unpaid"
    : status.replace("_", " ");
  const chip = (
    <>
      <CreditCard />
      {chipLabel}
    </>
  );

  if (status === "refunded") {
    return (
      <span className={chipClass} title={`Payment: ${status.replace("_", " ")}`}>
        {chip}
      </span>
    );
  }

  const selectedAmount = amountKind === "deposit" ? depositAmount : total;

  return (
    <HoverCard openDelay={80} closeDelay={140}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={chipClass}
          title={`Payment: ${status.replace("_", " ")}`}
        >
          {chip}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 rounded-2xl" align="end">
        <div className="space-y-3 text-xs">
          {paid ? (
            <>
              <p className="text-sm font-semibold text-foreground">Receipt</p>
              <div className="text-muted-foreground">
                <p className="text-foreground">{a.treatment_name} · #{a.treatment_number}</p>
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
                  <Mail className="mr-1 h-3 w-3" /> Email
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => dispatch("sms", "receipt", "Receipt")}
                >
                  <Phone className="mr-1 h-3 w-3" /> Text
                </Button>
              </div>
            </>
          ) : deposit ? (
            <>
              <p className="text-sm font-semibold text-foreground">Balance outstanding</p>
              <p className="text-muted-foreground">
                The deposit is in. Send the remaining balance by email or text.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto flex-1 flex-col gap-0.5 py-2 text-xs"
                >
                  <span className="text-2xs font-semibold tracking-[0.02em]">Deposit received</span>
                  <span className="font-semibold tabular-nums">{formatMoney(depositAmount)}</span>
                </Button>
                <Button
                  type="button"
                  variant="selected"
                  className="h-auto flex-1 flex-col gap-0.5 py-2 text-xs"
                >
                  <span className="text-2xs font-semibold tracking-[0.02em]">Balance</span>
                  <span className="font-semibold tabular-nums">{formatMoney(balance)}</span>
                </Button>
              </div>
              <p className="text-2xs text-muted-foreground">
                Sending a balance request for{" "}
                <span className="font-semibold text-foreground">{formatMoney(balance)}</span>
                . The message includes a link to pay in their account.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => sendPayment("email", "balance")}
                >
                  <Mail className="mr-1 h-3 w-3" /> Email
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => sendPayment("sms", "balance")}
                >
                  <Phone className="mr-1 h-3 w-3" /> Text
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground">Payment outstanding</p>
              <p className="text-muted-foreground">Choose deposit or full amount, then send by email or text.</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={amountKind === "deposit" ? "selected" : "outline"}
                  onClick={() => setAmountKind("deposit")}
                  className="h-auto flex-1 flex-col gap-0.5 py-2 text-xs"
                >
                  <span className="text-2xs font-semibold tracking-[0.02em]">Deposit</span>
                  <span className="font-semibold tabular-nums">{formatMoney(depositAmount)}</span>
                </Button>
                <Button
                  type="button"
                  variant={amountKind === "full" ? "selected" : "outline"}
                  onClick={() => setAmountKind("full")}
                  className="h-auto flex-1 flex-col gap-0.5 py-2 text-xs"
                >
                  <span className="text-2xs font-semibold tracking-[0.02em]">Full amount</span>
                  <span className="font-semibold tabular-nums">{formatMoney(total)}</span>
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
                  <Mail className="mr-1 h-3 w-3" /> Email
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  disabled={send.isPending}
                  onClick={() => sendPayment("sms", amountKind)}
                >
                  <Phone className="mr-1 h-3 w-3" /> Text
                </Button>
              </div>
            </>
          )}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function ConsentChip({ a, signed, compact }: { a: any; signed: boolean; compact?: boolean }) {
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
      toast.error(channel === "email" ? "No email on file for this patient" : "No mobile number on file");
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
          body: `Hi ${name}, before your ${a.treatment_name} (treatment #${a.treatment_number}) on ${new Date(
            a.starts_at,
          ).toLocaleDateString("en-GB")}, please complete and sign your consent form. You can open and sign it securely from your patient portal — it only takes a couple of minutes.`,
        },
      },
      { onSuccess: () => toast.success("Consent reminder posted to their patient portal") },
    );
  };

  const chipClass = `${CHIP_BASE} ${
    signed ? "bg-success-bg text-success-ink" : "bg-warning-bg text-consent-ink"
  }`;
  const chipLabel = compact
    ? signed
      ? "Consent"
      : "Consent due"
    : signed
      ? "Consent signed"
      : "Consent pending";
  const chip = (
    <>
      <FileSignature />
      {chipLabel}
    </>
  );

  if (signed) {
    return (
      <span className={chipClass} title="Consent signed">
        {chip}
      </span>
    );
  }

  return (
    <HoverCard openDelay={80} closeDelay={120}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className={chipClass}
          title="Consent pending"
        >
          {chip}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 rounded-2xl" align="start">
        <div className="space-y-3 text-xs">
          <p className="text-sm font-semibold text-foreground">Consent outstanding</p>
          <p className="text-muted-foreground">
            Send {name} a reminder to complete and sign their consent form before this appointment.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 text-xs"
              disabled={send.isPending || remind.isPending}
              onClick={() => sendReminder("email")}
            >
              <Mail className="mr-1 h-3 w-3" /> Email
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-xs"
              disabled={send.isPending || remind.isPending}
              onClick={() => sendReminder("sms")}
            >
              <Phone className="mr-1 h-3 w-3" /> Text
            </Button>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function PractitionerFilter({
  practitioners,
  selected,
  onSelect,
}: {
  practitioners: any[];
  selected: string[];
  onSelect: (v: string[]) => void;
}) {
  const allSelected = selected.includes("all");

  const toggle = (id: string) => {
    if (id === "all") {
      onSelect(["all"]);
      return;
    }
    let next = selected.filter((s) => s !== "all");
    if (next.includes(id)) {
      next = next.filter((s) => s !== id);
    } else {
      next = [...next, id];
    }
    onSelect(next.length ? next : ["all"]);
  };

  const label = allSelected
    ? "All practitioners"
    : selected.length === 1
      ? (practitioners.find((p) => p.id === selected[0])?.full_name ?? "Practitioner")
      : `${selected.length} selected`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-9 w-52 justify-between px-3 text-xs">
          <span className="truncate">{label}</span>
          <ChevronRight className="h-3.5 w-3.5 rotate-90 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl p-1.5">
        <DropdownMenuItem
          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs"
          onClick={(e) => {
            e.preventDefault();
            toggle("all");
          }}
        >
          <Checkbox checked={allSelected} className="h-4 w-4 rounded border-edge" />
          All practitioners
        </DropdownMenuItem>
        <div className="my-1 h-px bg-border" />
        {practitioners.map((p) => (
          <DropdownMenuItem
            key={p.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs"
            onClick={(e) => {
              e.preventDefault();
              toggle(p.id);
            }}
          >
            <Checkbox checked={selected.includes(p.id)} className="h-4 w-4 rounded border-edge" />
            <span className="truncate">{p.full_name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const SLOT_MINUTES = 30;
const SLOT_PX = 64;

/** Shared "View by" filter logic for day, week and month planners. */
function filterByPractitioner(rows: any[], selected: string[]): any[] {
  if (!selected.length || selected.includes("all")) return rows;
  return rows.filter((a: any) =>
    a.practitioner_id ? selected.includes(a.practitioner_id) : selected.includes("unassigned"),
  );
}
const PX_PER_MIN = SLOT_PX / SLOT_MINUTES;
/** Hide gutter hour labels when the now-chip is this close (px). */
const NOW_HOUR_HIDE_PX = 12;

function minutesFromMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

function DayPlanner({
  rows,
  date,
  onState,
  practitioners,
  patients,
  catalogue,
  selected,
  onSelect,
}: {
  rows: any[];
  date: Date;
  onState: (v: any) => Promise<unknown>;
  practitioners: any[];
  patients: any[];
  catalogue: any[];
  selected: string[];
  onSelect: (v: string[]) => void;
}) {
  const queryClient = useQueryClient();
  const { data: identity } = useIdentity();
  const onlineIds = useStaffPresence(Boolean(identity?.isStaff), identity?.userId);
  const treatmentColours = useTreatmentColours();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const colRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [drag, setDrag] = useState<null | {
    id: string;
    duration: number;
    minute: number;
    colId: string;
    originMinute: number;
    originColId: string;
    moved: boolean;
  }>(null);
  const [confirmDrop, setConfirmDrop] = useState<null | {
    appointment: any;
    minute: number;
    colId: string;
  }>(null);
  const [quickAdd, setQuickAdd] = useState<null | { top: number; left: number; minute: number; colId: string }>(null);
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const reschedule = useMutation({
    mutationFn: useServerFn(rescheduleAppointment),
    onSuccess: () => {
      toast.success("Appointment moved", { description: "The patient journey has been reset to booked." });
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visible = selected.includes("all")
    ? rows
    : rows.filter((a) => selected.includes(a.practitioner_id ?? "unassigned"));

  // ---- Columns: only practitioners with a booking today (plus any selected empty ones).
  const columnMap = new Map<string, { id: string; name: string; items: any[] }>();
  for (const a of visible) {
    const id = a.practitioner_id ?? "unassigned";
    if (!columnMap.has(id)) columnMap.set(id, { id, name: a.profiles?.full_name || "Unassigned", items: [] });
    columnMap.get(id)!.items.push(a);
  }
  if (!selected.includes("all")) {
    for (const id of selected) {
      if (columnMap.has(id)) continue;
      const p = practitioners.find((x) => x.id === id);
      columnMap.set(id, { id, name: p?.full_name ?? "Unassigned", items: [] });
    }
  }
  const columns = [...columnMap.values()].sort((a, b) => a.name.localeCompare(b.name));

  // ---- Planner window.
  let startMin = 9 * 60;
  let endMin = 18 * 60;
  for (const a of visible) {
    startMin = Math.min(startMin, Math.floor(minutesFromMidnight(new Date(a.starts_at)) / 60) * 60);
    endMin = Math.max(endMin, Math.ceil(minutesFromMidnight(new Date(a.ends_at)) / 60) * 60);
  }

  const now = new Date(tick);
  const isToday = now.toDateString() === date.toDateString();
  const nowMin = minutesFromMidnight(now);

  // ---- Quiet hours: keep slots near bookings (and near "now"), collapse the rest.
  const busy = (m: number) => {
    if (isToday && Math.abs(m - nowMin) <= 60) return true;
    return visible.some((a) => {
      const s = minutesFromMidnight(new Date(a.starts_at)) - 30;
      const e = minutesFromMidnight(new Date(a.ends_at)) + 30;
      return m + SLOT_MINUTES > s && m < e;
    });
  };

  type Row = { type: "slot"; minute: number } | { type: "gap"; from: number; to: number };
  const layout: Row[] = [];
  for (let m = startMin; m < endMin; m += SLOT_MINUTES) {
    const keep = busy(m) || expanded.has(Math.floor(m / 60) * 60);
    const last = layout[layout.length - 1];
    if (keep) layout.push({ type: "slot", minute: m });
    else if (last && last.type === "gap") last.to = m + SLOT_MINUTES;
    else layout.push({ type: "gap", from: m, to: m + SLOT_MINUTES });
  }

  const GAP_PX = 34;
  const offsets: { row: Row; top: number; height: number }[] = [];
  let cursor = 0;
  for (const row of layout) {
    const height = row.type === "slot" ? SLOT_PX : GAP_PX;
    offsets.push({ row, top: cursor, height });
    cursor += height;
  }
  const gridHeight = Math.max(cursor, 120);

  const yFor = (minute: number) => {
    for (const o of offsets) {
      if (o.row.type === "slot" && minute >= o.row.minute && minute < o.row.minute + SLOT_MINUTES) {
        return o.top + (minute - o.row.minute) * PX_PER_MIN;
      }
      if (o.row.type === "gap" && minute >= o.row.from && minute < o.row.to) return o.top;
    }
    return minute >= endMin ? gridHeight : 0;
  };
  const minuteFor = (y: number) => {
    for (const o of offsets) {
      if (y >= o.top && y < o.top + o.height) {
        if (o.row.type === "slot") return o.row.minute + Math.round(((y - o.top) / PX_PER_MIN) / 5) * 5;
        return o.row.from;
      }
    }
    return startMin;
  };

  const label = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const timeOf = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  // ---- Now / next.
  const sorted = [...visible].sort((a, b) => +new Date(a.starts_at) - +new Date(b.starts_at));
  const current = isToday
    ? sorted.find((a) => minutesFromMidnight(new Date(a.starts_at)) <= nowMin && minutesFromMidnight(new Date(a.ends_at)) > nowMin)
    : undefined;
  const next = isToday
    ? sorted.find((a) => minutesFromMidnight(new Date(a.starts_at)) > nowMin)
    : sorted[0];

  // ---- Drag handling.
  const beginDrag = (e: React.PointerEvent, a: any, colId: string) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("a,button,[role='button']")) return;
    const s = new Date(a.starts_at);
    const duration = Math.max(5, Math.round((+new Date(a.ends_at) - +s) / 60000));
    setDrag({
      id: a.id,
      duration,
      minute: minutesFromMidnight(s),
      colId,
      originMinute: minutesFromMidnight(s),
      originColId: colId,
      moved: false,
    });
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const moveDrag = (e: React.PointerEvent) => {
    if (!drag || !gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    const minute = Math.max(startMin, Math.min(endMin - drag.duration, minuteFor(e.clientY - rect.top)));
    let colId = drag.colId;
    for (const c of columns) {
      const el = colRefs.current[c.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right) colId = c.id;
    }
    if (minute !== drag.minute || colId !== drag.colId) setDrag({ ...drag, minute, colId, moved: true });
  };

  const endDrag = (a: any) => {
    if (!drag) return;
    const changed = drag.moved && (drag.minute !== drag.originMinute || drag.colId !== drag.originColId);
    if (changed) setConfirmDrop({ appointment: a, minute: drag.minute, colId: drag.colId });
    setDrag(null);
  };

  useEffect(() => {
    if (!drag) return;
    const cancel = (e: KeyboardEvent) => { if (e.key === "Escape") setDrag(null); };
    window.addEventListener("keydown", cancel);
    return () => window.removeEventListener("keydown", cancel);
  }, [drag]);

  const dropTarget = confirmDrop
    ? (() => {
        const d = new Date(date);
        d.setHours(Math.floor(confirmDrop.minute / 60), confirmDrop.minute % 60, 0, 0);
        return d;
      })()
    : null;

  const dropConflict =
    confirmDrop && dropTarget
      ? (() => {
          const a = confirmDrop.appointment;
          const duration = Math.max(
            5,
            Math.round((+new Date(a.ends_at) - +new Date(a.starts_at)) / 60000),
          );
          const practitionerId =
            confirmDrop.colId === "unassigned" ? a.practitioner_id : confirmDrop.colId;
          if (!practitionerId) return null;
          return findPractitionerOverlap({
            appointments: rows.filter((r) => r.practitioner_id === practitionerId),
            startsAt: dropTarget,
            endsAt: new Date(dropTarget.getTime() + duration * 60000),
            excludeAppointmentId: a.id,
          });
        })()
      : null;

  const showNow = isToday && nowMin >= startMin && nowMin <= endMin;
  const nowY = showNow ? yFor(nowMin) : null;
  const slideCols = columns.length > 3;
  // Keep each practitioner lane as wide as a 3-up day, then slide the rest
  // the same way the week planner slides extra days.
  const boardMinWidth = slideCols
    ? `calc(5rem + ${columns.length} * max(220px, (100% - 5rem) / 3))`
    : undefined;

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl p-0">
      {/* Header */}
      <div className="relative z-30 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-glass-line bg-glass-2 px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold tracking-[0.02em] text-foreground">Day planner</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{visible.length} booked</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{label(startMin)}–{label(endMin)}</span>
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          <span className="text-2xs tracking-[0.02em] text-muted-foreground">View by</span>
          <PractitionerFilter
            practitioners={practitioners}
            selected={selected}
            onSelect={onSelect}
          />
        </div>
      </div>

      {/* Now / next strip */}
      {(current || next) && (
        <div className="flex flex-wrap gap-3 border-b border-glass-line px-5 py-3">
          <NowNextTile appointment={current} kind="now" />
          <NowNextTile appointment={next} kind="next" />
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-5">
      {columns.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-center text-sm text-muted-foreground">
          No bookings on {date.toLocaleDateString("en-GB")}.
        </div>
      ) : (
        <div className="scroll-x-shadows min-h-0 min-w-0 flex-1 overflow-auto" data-qc="day-planner-scroll">
          <div
            className={cn(!slideCols && "min-w-[680px]")}
            style={boardMinWidth ? { minWidth: boardMinWidth } : undefined}
          >
            {/* Practitioner header */}
            <div className="sticky top-0 z-20 flex border-b border-glass-line bg-glass shadow-inset-hi backdrop-blur-glass">
              <div className="sticky left-0 z-30 w-20 shrink-0 bg-[var(--glass-hi)] shadow-[1px_0_0_0_var(--glass-line)] backdrop-blur-glass" />
              {columns.map((col) => {
                const lane = laneFor(col.id);
                const online = onlineIds.has(col.id);
                return (
                  <div key={col.id} className="relative z-0 flex min-w-0 flex-1 items-center gap-3 px-3 py-3">
                    <PractitionerHoverCard
                      practitionerId={col.id}
                      name={col.name}
                      date={`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`}
                    >
                    <Link
                      to="/team/$id" search={{}}
                      params={{ id: col.id }}
                      className="flex min-w-0 items-center gap-3 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span
                        title={online ? "Online" : undefined}
                        aria-label={online ? `${col.name}, online` : col.name}
                        className={cn(
                          "grid h-7 w-7 shrink-0 place-items-center rounded-full text-2xs font-semibold",
                          lane.softBg,
                          lane.text,
                          online && "ring-2 ring-[#4a9d75] ring-offset-2 ring-offset-card",
                        )}
                      >
                        {initialsOf(col.name)}
                      </span>
                      <span className="truncate text-xs font-semibold text-foreground hover:underline">
                        {col.name}
                      </span>
                    </Link>
                    </PractitionerHoverCard>
                    <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-2xs tabular-nums ${lane.softBg} ${lane.text}`}>
                      {col.items.length}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Time grid */}
            <div ref={gridRef} className="relative flex" style={{ height: gridHeight }}>
              {/* Gutter */}
              <div className="sticky left-0 z-20 w-20 shrink-0 bg-[var(--glass-hi)] shadow-[1px_0_0_0_var(--glass-line)] backdrop-blur-glass">
                {offsets.map((o, i) =>
                  o.row.type === "slot" ? (
                    <div
                      key={`g${i}`}
                      style={{ height: o.height }}
                      className="relative pr-3 text-right text-2xs tabular-nums text-muted-foreground"
                    >
                      {o.row.minute % 60 === 0 &&
                        !(
                          nowY != null &&
                          Math.abs(o.top + (o.top === 0 ? 4 : -8) - nowY) < NOW_HOUR_HIDE_PX
                        ) && (
                          <span className={`absolute right-3 ${o.top === 0 ? "top-1" : "-top-2"}`}>
                            {label(o.row.minute)}
                          </span>
                        )}
                    </div>
                  ) : (
                    <div key={`g${i}`} style={{ height: o.height }} />
                  ),
                )}
              </div>

              {/* Columns */}
              {columns.map((col) => {
                const lane = laneFor(col.id);
                return (
                  <div
                    key={col.id}
                    ref={(el) => { colRefs.current[col.id] = el; }}
                    className="relative z-0 min-w-0 flex-1 border-l border-glass-line"
                  >
                    {offsets.map((o, i) =>
                      o.row.type === "slot" ? (
                        <button
                          key={`s${i}`}
                          type="button"
                          style={{ height: o.height }}
                          onClick={(e) => {
                            const rect = gridRef.current!.getBoundingClientRect();
                            const colRect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                            setQuickAdd({
                              top: o.top,
                              left: colRect.left - rect.left + colRect.width / 2,
                              minute: (o.row as { minute: number }).minute,
                              colId: col.id,
                            });
                          }}
                          className={`group/slot relative flex w-full cursor-pointer items-center justify-center border-b ${
                            (o.row as { minute: number }).minute % 60 === 0 ? "border-glass-line" : "border-transparent"
                          }`}
                          aria-label={`Add appointment at ${label((o.row as { minute: number }).minute)} with ${col.name}`}
                        >
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-x-1.5 inset-y-1 rounded-xl bg-[rgba(47,63,102,0.06)] opacity-0 transition-opacity group-hover/slot:opacity-100"
                          />
                          <Plus className="relative z-[1] h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/slot:opacity-70" />
                        </button>
                      ) : (
                        <div
                          key={`s${i}`}
                          style={{ height: o.height }}
                          className="flex items-center justify-center bg-glass-2"
                        >
                          {col.id === columns[0]!.id && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpanded((prev) => {
                                  const nextSet = new Set(prev);
                                  const gap = o.row as { from: number; to: number };
                                  for (let m = gap.from; m < gap.to; m += 60) nextSet.add(Math.floor(m / 60) * 60);
                                  return nextSet;
                                })
                              }
                              className="cursor-pointer rounded-full px-3 py-1 text-2xs text-muted-foreground transition-colors hover:bg-accent-wash hover:text-foreground"
                            >
                              {Math.round(((o.row as { from: number; to: number }).to - (o.row as { from: number; to: number }).from) / 60) || 1} quiet hour
                              {(o.row as { from: number; to: number }).to - (o.row as { from: number; to: number }).from > 60 ? "s" : ""} ·{" "}
                              {label((o.row as { from: number; to: number }).from)}–{label((o.row as { from: number; to: number }).to)} · show
                            </button>
                          )}
                        </div>
                      ),
                    )}

                    {col.items.map((a) => {
                      const s = new Date(a.starts_at);
                      const e = new Date(a.ends_at);
                      const dragging = drag?.id === a.id;
                      const startAt = dragging ? drag!.minute : minutesFromMidnight(s);
                      const duration = Math.max(5, Math.round((+e - +s) / 60000));
                      if (dragging && drag!.colId !== col.id) return null;
                      const top = yFor(startAt);
                      const durationHeight = yFor(startAt + duration) - top - 6;
                      const height = Math.max(80, durationHeight);
                      const isCurrent = current?.id === a.id;
                      const treatmentTone = toneForTreatment(a.treatment_name, treatmentColours);
                      return (
                        <div
                          key={a.id}
                          style={{ top, height, ...treatmentTone.style }}
                          onPointerDown={(ev) => beginDrag(ev, a, col.id)}
                          onPointerMove={moveDrag}
                          onPointerUp={() => endDrag(a)}
                          className={`diary-event glass-card group absolute inset-x-1.5 z-[2] flex cursor-grab flex-col overflow-hidden !rounded-xl px-3 py-2.5 transition-shadow hover:shadow-lift ${
                            dragging ? "!z-30 cursor-grabbing opacity-90 shadow-lift" : ""
                          } ${isCurrent ? "shadow-lift" : ""}`}
                        >
                          <div
                            className={`pointer-events-none absolute inset-0 rounded-[inherit] ${treatmentTone.bg}`}
                            aria-hidden
                          />
                          <div className="relative flex items-center justify-between gap-2">
                            <span className={`text-2xs font-semibold tabular-nums ${treatmentTone.text}`}>
                              {dragging
                                ? `${label(startAt)}–${label(startAt + duration)}`
                                : `${timeOf(s)}–${timeOf(e)}`}
                            </span>
                            <div className="flex items-center gap-1">
                              <ChipRow a={a} onState={onState} />
                              <VisitNoteChip appointmentId={a.id} variant="ghost" preRead={isPreAppointmentNote(a)} />
                            </div>
                          </div>
                          <Link
                            to="/patients/$id"
                            params={{ id: a.patient_id }}
                            className="relative mt-1 block break-words text-xs font-semibold leading-tight text-foreground hover:text-accent-ink"
                          >
                            {a.patients?.first_name} {a.patients?.last_name}
                          </Link>
                          <p className="relative mt-0.5 truncate text-2xs text-muted-foreground">
                            {a.treatment_name} · #{a.treatment_number}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Current time: text aligns with hour labels (right-3); pill padding compensated */}
              {showNow && (
                <div
                  className="pointer-events-none absolute inset-x-0"
                  style={{ top: nowY! }}
                >
                  <div className="sticky left-0 z-[5] h-0 w-20">
                    <span className="absolute top-1/2 right-1 -translate-y-1/2 rounded-full bg-foreground px-2 py-0.5 text-2xs font-semibold tabular-nums text-background shadow-sm">
                      {label(nowMin)}
                    </span>
                  </div>
                  <div
                    className="absolute top-0 right-0 left-[calc(5rem-0.25rem)] z-[1] h-px -translate-y-1/2 bg-foreground/15"
                    aria-hidden
                  />
                </div>
              )}

              {/* Quick add anchor */}
              {quickAdd && (
                <div className="absolute" style={{ top: quickAdd.top, left: quickAdd.left }}>
                  <QuickAddAppointment
                    patients={patients}
                    practitioners={practitioners}
                    catalogue={catalogue}
                    date={date}
                    defaultStart={(() => {
                      const d = new Date(date);
                      d.setHours(Math.floor(quickAdd.minute / 60), quickAdd.minute % 60, 0, 0);
                      return d;
                    })()}
                    defaultPractitionerId={quickAdd.colId === "unassigned" ? undefined : quickAdd.colId}
                    open
                    onOpenChange={(v) => { if (!v) setQuickAdd(null); }}
                    align="center"
                  >
                    <span className="block h-1 w-1" />
                  </QuickAddAppointment>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>

      <div className="border-t border-glass-line bg-glass-2 px-5 py-2 text-2xs text-muted-foreground">
        Drag an appointment to move it · click an empty slot to book · Esc cancels a drag
      </div>

      {/* Confirm move */}
      <Dialog open={!!confirmDrop} onOpenChange={(v) => { if (!v) setConfirmDrop(null); }}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move this appointment?</DialogTitle>
          </DialogHeader>
          {confirmDrop && dropTarget && (
            <div className="space-y-2 text-sm">
              <p className="text-foreground">
                {confirmDrop.appointment.patients?.first_name} {confirmDrop.appointment.patients?.last_name} ·{" "}
                {confirmDrop.appointment.treatment_name}
              </p>
              <p className="text-muted-foreground">
                New time <span className="font-semibold text-foreground">{timeOf(dropTarget)}</span> with{" "}
                <span className="font-semibold text-foreground">
                  {columnMap.get(confirmDrop.colId)?.name ?? "Unassigned"}
                </span>
                . The patient journey resets to booked.
              </p>
              {dropConflict ? (
                <p className="rounded-lg bg-destructive-bg px-3 py-2 text-xs text-destructive-ink">
                  {PRACTITIONER_OVERLAP_MESSAGE}
                </p>
              ) : null}
            </div>
          )}
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setConfirmDrop(null)}>
              Keep as it was
            </Button>
            <Button
             
              enterSubmit
              disabled={reschedule.isPending || !!dropConflict}
              onClick={() => {
                if (!confirmDrop || !dropTarget || dropConflict) return;
                const a = confirmDrop.appointment;
                const duration = Math.max(
                  5,
                  Math.round(
                    (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000,
                  ),
                );
                reschedule.mutate({
                  data: {
                    id: a.id,
                    starts_at: dropTarget.toISOString(),
                    duration_minutes: duration,
                    ...(confirmDrop.colId !== "unassigned" ? { practitioner_id: confirmDrop.colId } : {}),
                  },
                });
                setConfirmDrop(null);
              }}
            >
              Move appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function ChipRow({ a, onState }: { a: any; onState: (v: any) => Promise<unknown> }) {
  const signed = a.documents?.status === "signed";
  const stage = stageOf(a);
  const stageMeta = STAGE_META[stage];
  const StageIcon = stageMeta.icon;
  const paid = a.payment_status === "paid";
  const deposit = a.payment_status === "deposit_paid";
  const paymentTone = paid
    ? "bg-success-bg text-success-ink"
    : deposit
      ? "bg-warning-bg text-warning-ink"
      : "bg-destructive-bg text-destructive";
  const consentTone = signed ? "bg-success-bg text-success-ink" : "bg-warning-bg text-consent-ink";

  return (
    <HoverCard openDelay={120} closeDelay={140}>
      <HoverCardTrigger asChild>
        <button type="button" className="flex shrink-0 items-center gap-1" aria-label="Appointment status">
          <span className={`grid h-3.5 w-3.5 place-items-center rounded-full ${paymentTone}`} title="Payment">
            <CreditCard className="h-2 w-2" />
          </span>
          <span className={`grid h-3.5 w-3.5 place-items-center rounded-full ${consentTone}`} title="Consent">
            <FileSignature className="h-2 w-2" />
          </span>
          <span className={`grid h-3.5 w-3.5 place-items-center rounded-full ${stageMeta.ring}`} title="Stage">
            <StageIcon className="h-2 w-2" />
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-auto rounded-2xl p-2">
        <div className="flex flex-wrap items-center gap-2">
          <PaymentStatusChip a={a} compact />
          <ConsentChip a={a} signed={signed} compact />
          <StageTracker a={a} onState={onState} compact />
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function NowNextTile({ appointment, kind }: { appointment: any; kind: "now" | "next" }) {
  const treatmentColours = useTreatmentColours();
  if (!appointment) {
    return (
      <div className="flex min-w-[220px] flex-1 items-center gap-3 rounded-xl border border-dashed border-edge-2 bg-glass-2 px-4 py-2.5">
        <span className="text-2xs font-semibold tracking-[0.02em] text-muted-foreground">
          {kind === "now" ? "Now" : "Next"}
        </span>
        <span className="text-xs text-muted-foreground">Nothing scheduled</span>
      </div>
    );
  }
  const treatmentTone = toneForTreatment(appointment.treatment_name, treatmentColours);
  const s = new Date(appointment.starts_at);
  return (
    <div
      className={`flex min-w-[240px] flex-1 items-center gap-3 rounded-2xl border ${treatmentTone.border} ${treatmentTone.bg} px-4 py-2.5`}
      style={treatmentTone.style}
    >
      <span
        className={`rounded-full px-2 py-0.5 text-2xs font-semibold tracking-[0.02em] ${
          kind === "now" ? "bg-foreground text-background" : `${treatmentTone.softBg} ${treatmentTone.text}`
        }`}
      >
        {kind === "now" ? "Now" : "Next"}
      </span>
      <div className="min-w-0">
        <Link
          to="/patients/$id"
          params={{ id: appointment.patient_id }}
          className="block truncate text-sm font-semibold text-foreground hover:text-accent-ink"
        >
          {appointment.patients?.first_name} {appointment.patients?.last_name}
        </Link>
        <p className="truncate text-2xs text-muted-foreground">
          {s.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {appointment.treatment_name} ·{" "}
          {appointment.profiles?.full_name ?? "Unassigned"}
        </p>
      </div>
      <div className="ml-auto shrink-0">
        <PaymentStatusChip a={appointment} compact />
      </div>
    </div>
  );
}

function WeekView({
  rows: allRows,
  start,
  onState,
  practitioners,
  patients,
  catalogue,
  date,
  selected,
  onSelect,
}: {
  rows: any[];
  start: Date;
  onState: (v: any) => Promise<unknown>;
  practitioners: any[];
  patients: any[];
  catalogue: any[];
  date: Date;
  selected: string[];
  onSelect: (v: string[]) => void;
}) {
  const rows = filterByPractitioner(allRows, selected);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date().toDateString();
  const [quickAdd, setQuickAdd] = useState<null | { top: number; left: number; day: Date }>(null);

  function openQuickAdd(event: { currentTarget: EventTarget & Element; clientX: number; clientY: number }, day: Date) {
    const root = event.currentTarget.closest("#week-planner");
    const rect = root?.getBoundingClientRect();
    const startAt = new Date(day);
    startAt.setHours(9, 0, 0, 0);
    setQuickAdd({
      top: event.clientY - (rect?.top ?? 0),
      left: event.clientX - (rect?.left ?? 0),
      day: startAt,
    });
  }
  return (
    <Card id="week-planner" className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl p-0">
      <div className="relative z-30 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-glass-line bg-glass-2 px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold tracking-[0.02em] text-foreground">Week planner</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{rows.length} booked</span>
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          <span className="text-2xs tracking-[0.02em] text-muted-foreground">View by</span>
          <PractitionerFilter practitioners={practitioners} selected={selected} onSelect={onSelect} />
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-5">
        <div className="min-h-0 min-w-0 flex-1 overflow-x-auto" data-qc="week-planner-scroll">
          <div className="grid min-h-0 h-full min-w-[1820px] auto-rows-fr grid-cols-7 divide-y divide-glass-line sm:divide-y-0">
        {days.map((day, i) => {
          const items = rows
            .filter((a) => new Date(a.starts_at).toDateString() === day.toDateString())
            .sort((x, y) => +new Date(x.starts_at) - +new Date(y.starts_at));
          const isToday = day.toDateString() === today;
          const newBookingLabel = `New booking on ${day.toLocaleDateString("en-GB")}`;
          return (
            <div
              key={day.toISOString()}
              className={`flex min-h-0 min-w-0 flex-1 flex-col ${
                i > 0 ? "border-l border-glass-line" : ""
              }`}
            >
              <div
                className={`sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-glass px-3 py-2.5 shadow-inset-hi backdrop-blur-glass ${
                  isToday ? "border-accent-line" : "border-glass-line"
                }`}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="text-xs font-semibold tracking-[0.02em] text-muted-foreground">
                    {day.toLocaleDateString("en-GB", { weekday: "short" })}
                  </span>
                  <span
                    className={`inline-grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-semibold tabular-nums ${
                      isToday ? "bg-accent text-accent-foreground" : "text-foreground"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                </div>
                {items.length > 0 && (
                  <span className="inline-grid size-6 shrink-0 place-items-center rounded-full bg-[rgba(47,63,102,0.08)] text-2xs font-semibold tabular-nums text-muted-foreground">
                    {items.length}
                  </span>
                )}
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 p-3">
                {items.map((a) => (
                  <WeekAppointmentCard key={a.id} a={a} onState={onState} />
                ))}
                <button
                  type="button"
                  aria-label={newBookingLabel}
                  onClick={(e) => openQuickAdd(e, day)}
                  className="group/slot relative flex min-h-[64px] flex-1 cursor-pointer items-center justify-center"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-x-0 inset-y-1 rounded-xl bg-[rgba(47,63,102,0.06)] opacity-0 transition-opacity group-hover/slot:opacity-100"
                  />
                  <span className="relative z-[1] grid place-items-center">
                    {items.length === 0 && (
                      <span className="col-start-1 row-start-1 text-2xs font-medium tracking-[0.02em] text-muted-foreground/60 transition-opacity group-hover/slot:opacity-0">
                        Free
                      </span>
                    )}
                    <Plus className="col-start-1 row-start-1 h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover/slot:opacity-70" />
                  </span>
                </button>
              </div>
            </div>
          );
        })}
          </div>
        </div>
      </div>
      {quickAdd && (
        <div className="absolute z-50" style={{ top: quickAdd.top, left: quickAdd.left }}>
          <QuickAddAppointment
            patients={patients ?? []}
            practitioners={practitioners ?? []}
            catalogue={catalogue ?? []}
            date={quickAdd.day}
            defaultStart={quickAdd.day}
            open
            onOpenChange={(v) => {
              if (!v) setQuickAdd(null);
            }}
            align="center"
          >
            <span className="block h-1 w-1" />
          </QuickAddAppointment>
        </div>
      )}
    </Card>
  );
}

function WeekAppointmentCard({
  a,
  onState,
}: {
  a: any;
  onState: (v: any) => Promise<unknown>;
}) {
  const treatmentColours = useTreatmentColours();
  const tone = toneForTreatment(a.treatment_name, treatmentColours);
  const starts = new Date(a.starts_at);
  const ends = a.ends_at ? new Date(a.ends_at) : null;
  const timeFmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  const name = `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""}`.trim();
  const practitioner = a.profiles?.full_name ?? "Unassigned";
  const timeLabel = ends
    ? `${starts.toLocaleTimeString("en-GB", timeFmt)}–${ends.toLocaleTimeString("en-GB", timeFmt)}`
    : starts.toLocaleTimeString("en-GB", timeFmt);

  return (
    <div
      className="diary-event glass-card group relative overflow-hidden !rounded-xl px-3 py-2.5 transition-shadow hover:shadow-lift"
      style={tone.style}
    >
      <div className={`pointer-events-none absolute inset-0 rounded-[inherit] ${tone.bg}`} aria-hidden />
      <div className="relative flex items-center justify-between gap-2">
        <AppointmentTimeEditor appointment={a}>
          <button
            type="button"
            className={`inline-flex items-center text-left text-2xs font-semibold tabular-nums ${tone.text} transition-opacity hover:opacity-80`}
          >
            {timeLabel}
          </button>
        </AppointmentTimeEditor>
        <div className="flex items-center gap-1">
          <ChipRow a={a} onState={onState} />
          <VisitNoteChip appointmentId={a.id} variant="ghost" preRead={isPreAppointmentNote(a)} />
        </div>
      </div>
      <Link
        to="/patients/$id"
        params={{ id: a.patient_id }}
        className="relative mt-1 block break-words text-xs font-semibold leading-tight text-foreground hover:underline"
      >
        {name}
      </Link>
      <p className="relative mt-0.5 truncate text-2xs text-muted-foreground">
        {a.treatment_name} · #{a.treatment_number}
      </p>
      <p className="relative truncate text-2xs text-muted-foreground/80">{practitioner}</p>
    </div>
  );
}

function MonthView({
  rows: allRows,
  anchor,
  gridStart,
  onPick,
  practitioners,
  patients,
  catalogue,
  selected,
  onSelect,
}: {
  rows: any[];
  anchor: Date;
  gridStart: Date;
  onPick: (d: Date) => void;
  practitioners: any[];
  patients: any[];
  catalogue: any[];
  selected: string[];
  onSelect: (v: string[]) => void;
}) {
  const rows = filterByPractitioner(allRows, selected);
  const treatmentColours = useTreatmentColours();
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const today = new Date().toDateString();
  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl p-0">
      <div className="relative z-30 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-glass-line bg-glass-2 px-5 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold tracking-[0.02em] text-foreground">Month planner</span>
          <span aria-hidden>·</span>
          <span className="tabular-nums">{rows.length} booked</span>
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          <span className="text-2xs tracking-[0.02em] text-muted-foreground">View by</span>
          <PractitionerFilter practitioners={practitioners} selected={selected} onSelect={onSelect} />
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-5">
      <div className="grid shrink-0 grid-cols-7 pb-2 text-center text-2xs tracking-[0.02em] text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-1.5">
        {days.map((day) => {
          const items = rows
            .filter((a) => new Date(a.starts_at).toDateString() === day.toDateString())
            .sort((x, y) => +new Date(x.starts_at) - +new Date(y.starts_at));
          const outside = day.getMonth() !== anchor.getMonth();
          const isToday = day.toDateString() === today;

          // Browsers vertically centre <button> content, which left the day
          // number floating mid-cell on empty days — hence the flex column.
          const cell = (
            <button
              onClick={() => onPick(day)}
              aria-label={`Open ${day.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })} in the day planner`}
              className={`group/mday relative flex h-full min-h-0 cursor-pointer flex-col items-stretch overflow-hidden rounded-xl border border-edge bg-glass-2 p-2 text-left shadow-inset-hi transition-colors hover:bg-glass ${
                outside ? "opacity-40" : ""
              } ${isToday ? "border-accent-line bg-accent-wash" : ""}`}
            >
              {items.length === 0 && !outside && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-1 rounded-lg bg-[rgba(47,63,102,0.06)] opacity-0 transition-opacity group-hover/mday:opacity-100"
                />
              )}
              <span className="relative flex shrink-0 items-center justify-between gap-1">
                <span
                  className={`inline-grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-semibold tabular-nums ${
                    isToday ? "bg-accent text-accent-foreground shadow-bloom" : "text-muted-foreground"
                  }`}
                >
                  {day.getDate()}
                </span>
                {items.length > 0 && (
                  <span className="inline-grid size-6 shrink-0 place-items-center rounded-full bg-[rgba(47,63,102,0.08)] text-2xs font-semibold tabular-nums text-muted-foreground">
                    {items.length}
                  </span>
                )}
              </span>
              <span className="relative mt-1.5 flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
                {items.slice(0, 3).map((a) => {
                  const tone = toneForTreatment(a.treatment_name, treatmentColours);
                  return (
                    <span
                      key={a.id}
                      style={tone.style}
                      className={`flex min-w-0 shrink-0 items-center gap-1 rounded-lg px-1.5 py-[3px] text-2xs leading-none ${tone.bg}`}
                    >
                      <span className={`shrink-0 font-semibold tabular-nums ${tone.text}`}>
                        {new Date(a.starts_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="truncate font-medium text-foreground">
                        {a.patients?.first_name} {a.patients?.last_name?.[0]}.
                      </span>
                    </span>
                  );
                })}
                {items.length > 3 && (
                  <span className="pl-1.5 text-2xs font-medium text-accent-ink">+{items.length - 3} more</span>
                )}
              </span>
            </button>
          );

          if (items.length === 0) {
            return <div key={day.toISOString()}>{cell}</div>;
          }

          return (
            <HoverCard key={day.toISOString()} openDelay={280} closeDelay={140}>
              <HoverCardTrigger asChild>{cell}</HoverCardTrigger>
              <HoverCardContent
                side="right"
                align="start"
                sideOffset={8}
                collisionPadding={12}
                className="w-80 rounded-2xl p-0"
              >
                <div className="flex items-baseline justify-between gap-2 border-b border-edge px-3.5 py-2.5">
                  <p className="text-sm font-semibold text-foreground">
                    {day.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                  <p className="text-2xs tabular-nums text-muted-foreground">
                    {items.length} booked
                  </p>
                </div>
                <div className="max-h-[50vh] space-y-2 overflow-y-auto p-3">
                  {items.map((a) => (
                    <MonthPeekCard key={a.id} a={a} treatmentColours={treatmentColours} />
                  ))}
                </div>
                <div className="border-t border-edge p-2.5">
                  <Button size="sm" variant="outline" className="w-full" onClick={() => onPick(day)}>
                    Open day
                  </Button>
                </div>
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
      </div>
    </Card>
  );
}

/**
 * Read-only miniature of the week card for the month peek: same tone wash and
 * text hierarchy, but static status glyphs — the interactive ChipRow opens
 * nested popovers that fight a hover-card surface.
 */
function MonthPeekCard({
  a,
  treatmentColours,
}: {
  a: any;
  treatmentColours: Record<string, number | string>;
}) {
  const tone = toneForTreatment(a.treatment_name, treatmentColours);
  const starts = new Date(a.starts_at);
  const ends = a.ends_at ? new Date(a.ends_at) : null;
  const timeFmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  const timeLabel = ends
    ? `${starts.toLocaleTimeString("en-GB", timeFmt)}–${ends.toLocaleTimeString("en-GB", timeFmt)}`
    : starts.toLocaleTimeString("en-GB", timeFmt);
  const name = `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""}`.trim();
  const practitioner = a.profiles?.full_name ?? "Unassigned";

  const signed = a.documents?.status === "signed";
  const paid = a.payment_status === "paid";
  const deposit = a.payment_status === "deposit_paid";
  const paymentTone = paid
    ? "bg-success-bg text-success-ink"
    : deposit
      ? "bg-warning-bg text-warning-ink"
      : "bg-destructive-bg text-destructive";
  const consentTone = signed ? "bg-success-bg text-success-ink" : "bg-warning-bg text-consent-ink";
  const stage = stageOf(a);
  const stageMeta = STAGE_META[stage];
  const StageIcon = stageMeta.icon;

  return (
    <div
      className="diary-event glass-card relative overflow-hidden !rounded-xl px-3 py-2.5"
      style={tone.style}
    >
      <div className={`pointer-events-none absolute inset-0 rounded-[inherit] ${tone.bg}`} aria-hidden />
      <div className="relative flex items-center justify-between gap-2">
        <span className={`text-2xs font-semibold tabular-nums ${tone.text}`}>{timeLabel}</span>
        <span className="flex shrink-0 items-center gap-1" aria-hidden>
          <span className={`grid h-3.5 w-3.5 place-items-center rounded-full ${paymentTone}`} title={paid ? "Paid" : deposit ? "Deposit paid" : "Unpaid"}>
            <CreditCard className="h-2 w-2" />
          </span>
          <span className={`grid h-3.5 w-3.5 place-items-center rounded-full ${consentTone}`} title={signed ? "Consent signed" : "Consent due"}>
            <FileSignature className="h-2 w-2" />
          </span>
          <span className={`grid h-3.5 w-3.5 place-items-center rounded-full ${stageMeta.ring}`} title={stageMeta.label}>
            <StageIcon className="h-2 w-2" />
          </span>
        </span>
      </div>
      <Link
        to="/patients/$id"
        params={{ id: a.patient_id }}
        className="relative mt-1 block break-words text-xs font-semibold leading-tight text-foreground hover:underline"
      >
        {name}
      </Link>
      <p className="relative mt-0.5 truncate text-2xs text-muted-foreground">
        {a.treatment_name} · #{a.treatment_number}
      </p>
      <p className="relative truncate text-2xs text-muted-foreground/80">{practitioner}</p>
    </div>
  );
}

function TextField({
  name,
  label,
  type = "text",
  required,
  defaultValue,
  value,
  onChange,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const isDateLike = type === "date" || type === "datetime-local";
  return (
    <div className="field-stack">
      <Label htmlFor={name}>{label}</Label>
      {isDateLike ? (
        <div className="relative">
          <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={name}
            name={name}
            type={type}
            required={required}
            defaultValue={value === undefined ? defaultValue : undefined}
            value={value}
            onChange={onChange ? (e) => onChange(e.target.value) : undefined}
            className="rounded-xl pl-[34px] pr-2 [&::-webkit-datetime-edit]:p-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-2 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
          />
        </div>
      ) : (
        <Input
          id={name}
          name={name}
          type={type}
          required={required}
          defaultValue={value === undefined ? defaultValue : undefined}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className="rounded-xl"
        />
      )}
    </div>
  );
}

function SelectField({
  name,
  label,
  children,
  className,
  value,
  required,
  onChange,
}: {
  name: string;
  label: string;
  children: React.ReactNode;
  className?: string;
  value?: string;
  required?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  const select = (
    <select
      id={name}
      name={name}
      value={value}
      required={required}
      onChange={onChange}
      className="flex h-9 w-full rounded-xl border border-edge bg-glass-2 px-3 text-[13.5px] shadow-inset-hi outline-none transition-colors hover:border-edge-2 focus-visible:border-accent-deep focus-visible:ring-1 focus-visible:ring-ring md:text-[13px]"
    >
      {children}
    </select>
  );
  if (!label) return <div className={className}>{select}</div>;
  return (
    <div className={`field-stack ${className ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      {select}
    </div>
  );
}