import { RiskBadge } from "@/components/retention/risk-badge";
import { dateTime, daysAgoLabel, displayName, moneyWhole } from "@/lib/format";
import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, MessageCircle, MoreHorizontal, Upload } from "lucide-react";
import {
  addPhoto,
  addTreatment,
  archivePatient,
  getCatalogue,
  getPatient,
  getPatientPlanDetail,
  getUnreadMessages,
  listPractitioners,
  listTreatmentPlans,
  markMessagesRead,
  resendDocument,
  reviewHistory,
  sendDocument,
} from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { isStepUpRequired, useStepUp } from "@/components/step-up-dialog";
import { useFloatingDock, useRegisterChatPage } from "@/components/floating-dock/dock-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TasksRecallsCard } from "@/components/retention/patient-tasks-panel";
import {
  SkinPlanRoadmap,
  type PlanRiskRow,
  type RoadmapStep,
} from "@/components/patients/record/skin-plan-roadmap";
import { StepDetails } from "@/components/patients/record/step-details";
import { EditStepDialog } from "@/components/patients/record/edit-step-dialog";
import { TreatmentHistory } from "@/components/patients/record/treatment-history";
import {
  UrgentCheckinsCard,
  type CheckinRow,
} from "@/components/patients/record/urgent-checkins-card";
import { AllCheckinsTable } from "@/components/patients/record/all-checkins-table";
import { JournalList } from "@/components/patients/record/journal-list";
import { PatientUpdatesCard } from "@/components/patients/record/patient-updates-card";
import {
  ReadyToTreatCard,
  type ReadyToTreatVisit,
} from "@/components/patients/record/ready-to-treat-card";
import {
  SkinPlanSummaryCard,
  type PlanDetail,
} from "@/components/patients/record/skin-plan-summary-card";
import { UpcomingCard, type UpcomingBooking } from "@/components/patients/record/upcoming-card";
import {
  LatestJournalCard,
  type JournalEntryRow,
} from "@/components/patients/record/latest-journal-card";
import { QuickAddAppointment } from "@/components/quick-add-appointment";
import { CommsPreferencesCard } from "@/components/comms/comms-preferences";
import { CommsLogCard } from "@/components/comms/comms-log";
import { SendOfferDialog } from "@/components/offers/send-offer-dialog";
import { PatientOffersCard } from "@/components/offers/patient-offers-card";
import { TreatmentFormDialog } from "@/components/treatment-form-dialog";
import { TreatmentRecordDialog } from "@/components/treatment-record-view";
import { canSee } from "@/lib/access-catalogue";
import { can } from "@/lib/permissions";
import {
  onPlanAppointmentIds,
  readinessItems,
  recordTabBadges,
  upNextStep,
} from "@/lib/patients/record-overview";
import { TabBadge } from "@/components/patients/record/chips";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/patients/$id")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { tab?: string; chase?: boolean; chat?: boolean; treat?: string; record?: string } => {
    const tab = typeof search["tab"] === "string" ? search["tab"] : undefined;
    const treat = typeof search["treat"] === "string" && search["treat"] ? search["treat"] : undefined;
    const record = typeof search["record"] === "string" && search["record"] ? search["record"] : undefined;
    const flag = (v: unknown) => v === true || v === "1" || v === 1;
    return {
      ...(tab ? { tab } : {}),
      ...(flag(search["chase"]) ? { chase: true } : {}),
      // `chat` opens the docked message panel (Contact buttons elsewhere link here).
      ...(flag(search["chat"]) ? { chat: true } : {}),
      // `treat` opens the treatment form for that appointment (dock, bell, diary).
      ...(treat ? { treat } : {}),
      // `record` opens a completed treatment's record.
      ...(record ? { record } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Patient record — Aetheria" },
      { name: "description", content: "Treatment history, before and after imagery, documents and secure messaging." },
      { property: "og:title", content: "Patient record — Aetheria" },
      { property: "og:description", content: "Treatment history, imagery, documents and secure messaging." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PatientRecord,
});

function PatientRecord() {
  const { id } = Route.useParams();
  const { tab: tabSearch, chase: chaseFocus, chat: chatFocus, treat: treatParam, record: recordParam } = Route.useSearch();
  const navigate = useNavigate();
  // The treatment form and the record viewer are driven by the address so the
  // dock, the bell and the diary can open them directly.
  const [treatOpen, setTreatOpen] = useState<string | null>(treatParam ?? null);
  const [recordOpen, setRecordOpen] = useState<string | null>(recordParam ?? null);
  useEffect(() => {
    if (treatParam) setTreatOpen(treatParam);
  }, [treatParam]);
  useEffect(() => {
    if (recordParam) setRecordOpen(recordParam);
  }, [recordParam]);
  const closeTreat = () => {
    setTreatOpen(null);
    if (treatParam) void navigate({ to: "/patients/$id", params: { id }, search: (prev: any) => ({ ...prev, treat: undefined }), replace: true });
  };
  const showTreatments = () => {
    setTreatOpen(null);
    void navigate({
      to: "/patients/$id",
      params: { id },
      search: (prev: any) => ({ ...prev, tab: "treatments", treat: undefined }),
    });
  };
  const closeRecord = () => {
    setRecordOpen(null);
    if (recordParam) void navigate({ to: "/patients/$id", params: { id }, search: (prev: any) => ({ ...prev, record: undefined }), replace: true });
  };
  const { data: identity } = useIdentity();
  const queryClient = useQueryClient();
  const fetchPatient = useServerFn(getPatient);
  const fetchCatalogue = useServerFn(getCatalogue);
  const bookingsRef = useRef<HTMLDivElement>(null);
  // Overview is the record's front page; `bookings` / `visit-notes` are old
  // names for Treatments and a chase lands on Overview's Upcoming card.
  const tabFor = (tab: string | undefined, chase: boolean | undefined) => {
    if (chase) return "overview";
    if (tab === "bookings" || tab === "visit-notes") return "treatments";
    return tab ?? "overview";
  };
  const [activeTab, setActiveTab] = useState(() => tabFor(tabSearch, chaseFocus));
  // A tab change is a navigation: the address keeps the tab so Back and a
  // copied link land where the reader was.
  const changeTab = (tab: string) => {
    setActiveTab(tab);
    void navigate({
      to: "/patients/$id",
      params: { id },
      search: (prev: ReturnType<typeof Route.useSearch>) => ({
        ...prev,
        tab: tab === "overview" ? undefined : tab,
        chase: undefined,
      }),
      replace: true,
    });
  };

  const { data } = useQuery({
    queryKey: ["patient", id],
    queryFn: () => fetchPatient({ data: { id } }),
    enabled: !!identity?.isStaff,
  });
  const { data: catalogue } = useQuery({
    queryKey: ["catalogue"],
    queryFn: () => fetchCatalogue(),
    enabled: !!identity?.isStaff,
  });
  // The plan as the patient's Timeline sees it, for the Overview card and the
  // Treatments roadmap; the practitioners list feeds Book on a step.
  const fetchPlanDetail = useServerFn(getPatientPlanDetail);
  const { data: planDetail } = useQuery({
    queryKey: ["patient-plan", id],
    queryFn: () => fetchPlanDetail({ data: { patient_id: id } }) as Promise<PlanDetail | null>,
    enabled: !!identity?.isStaff,
  });
  const fetchPractitioners = useServerFn(listPractitioners);
  const { data: practitioners } = useQuery({
    queryKey: ["practitioners"],
    queryFn: () => fetchPractitioners(),
    enabled: !!identity?.isStaff,
  });
  // The journey board's reading of the same plan: whether the current step is
  // booked, booked for something else, or was missed. The roadmap repeats it.
  const fetchPlans = useServerFn(listTreatmentPlans);
  const { data: planRows } = useQuery({
    queryKey: ["treatment-plans", "patient", id],
    queryFn: () => fetchPlans({ data: { patient_id: id } }) as Promise<PlanRiskRow[]>,
    enabled: !!identity?.isStaff,
  });
  // One clock per render of the record, so every card agrees on "today".
  const now = useMemo(() => new Date(), []);
  const [bookingStep, setBookingStep] = useState<string | null>(null);
  // Treatments: the roadmap step open in Step details (the current step until
  // a row is clicked), and the one being edited.
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [editStep, setEditStep] = useState<RoadmapStep | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["patient", id] });
  const [treatmentOpen, setTreatmentOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  // "Send consent forms" opens the sender already on the consent kind, titled for the visit.
  const [docPreset, setDocPreset] = useState<{ kind: string; title: string } | null>(null);
  const [offerOpen, setOfferOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");
  const [photoTreatmentId, setPhotoTreatmentId] = useState<string>("");
  const [treatmentPhotoId, setTreatmentPhotoId] = useState<string>("");

  // The chat bubble shows on every page; this record tells the dock which
  // patient it is about so the bubble (and "Open chat") land in their thread.
  const registerChatPage = useRegisterChatPage();
  const { requestChat } = useFloatingDock();
  const patientName = `${data?.patient?.first_name ?? ""} ${data?.patient?.last_name ?? ""}`.trim();
  useEffect(() => {
    if (!data?.patient) return;
    registerChatPage({ patientId: id, patientName: patientName || "Patient" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, patientName, !!data?.patient]);
  useEffect(() => () => registerChatPage(null), [registerChatPage]);

  // Arriving with ?chat=1 (e.g. Contact on a dashboard card) opens the
  // floating window on this patient.
  useEffect(() => {
    if (!chatFocus || !data?.patient) return;
    requestChat({ patientId: id, patientName: patientName || "Patient" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatFocus, !!data?.patient]);

  // Unread patient messages on this record, for the Open chat badge.
  const fetchUnread = useServerFn(getUnreadMessages);
  const { data: unread } = useQuery({
    queryKey: ["unread-messages"],
    queryFn: () => fetchUnread(),
    enabled: !!identity?.isStaff,
    refetchInterval: 60_000,
  });
  const unreadHere =
    (unread?.items as { patient_id: string; count: number }[] | undefined)?.find(
      (i) => i.patient_id === id,
    )?.count ?? 0;

  useEffect(() => {
    if (tabSearch || chaseFocus) setActiveTab(tabFor(tabSearch, chaseFocus));
  }, [tabSearch, chaseFocus]);

  // A reader without the Overview grant opens on Treatments instead.
  useEffect(() => {
    if (identity && activeTab === "overview" && !canSee(identity, "patient-overview"))
      setActiveTab("treatments");
  }, [identity, activeTab]);

  useEffect(() => {
    if (activeTab !== "overview" || !chaseFocus) return;
    bookingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeTab, chaseFocus, data]);

  // Deep links: #plan is the roadmap on Treatments; #tasks and #recall are the
  // Tasks and recalls card on Overview. The anchors render once the tab has
  // data, so switch tab first and scroll then.
  const hash = useLocation({ select: (l) => l.hash });
  useEffect(() => {
    if (!data) return;
    const target =
      hash === "plan" ? "treatments" : hash === "recall" || hash === "tasks" ? "overview" : null;
    if (!target) return;
    if (activeTab !== target) {
      setActiveTab(target);
      return;
    }
    const timer = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [activeTab, data, hash]);

  const createTreatment = useMutation({
    mutationFn: useServerFn(addTreatment),
    onSuccess: () => {
      toast.success("Treatment recorded");
      setTreatmentOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const issueDocument = useMutation({
    mutationFn: useServerFn(sendDocument),
    onSuccess: (r: { emailed: boolean }) => {
      toast.success(
        r.emailed
          ? "Form sent — signing link emailed and added to their portal"
          : "Form issued to their portal — no email on file to send the link",
      );
      setDocOpen(false);
      invalidate();
      // The issue now queues a signing-link email, so the outbox card changes.
      void queryClient.invalidateQueries({ queryKey: ["communications", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const stepUp = useStepUp();
  const archive = useMutation({
    mutationFn: useServerFn(archivePatient),
    onSuccess: (res: { archived: boolean }) => {
      toast.success(
        res.archived
          ? "Patient archived — their record is kept for the retention period"
          : "Patient restored to the active list",
      );
      setArchiveOpen(false);
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
    },
    onError: (e: Error) => {
      if (!isStepUpRequired(e)) toast.error(e.message);
    },
  });
  const resend = useMutation({
    mutationFn: useServerFn(resendDocument),
    onSuccess: (r: { emailed: boolean }) => {
      toast.success(
        r.emailed
          ? "Reminder emailed with the signing link, and posted to their portal"
          : "Reminder posted to their portal — no email on file to send the link",
      );
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["communications", id] });
    },
  });
  const markReviewed = useMutation({
    mutationFn: useServerFn(reviewHistory),
    onSuccess: () => {
      toast.success("Marked as reviewed");
      invalidate();
    },
  });
  const savePhoto = useMutation({
    mutationFn: useServerFn(addPhoto),
    onSuccess: () => {
      toast.success("Photo added");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const markRead = useMutation({
    mutationFn: useServerFn(markMessagesRead),
    onSuccess: () => invalidate(),
  });

  // Live message thread: subscribe to inserts/updates for this patient.
  useEffect(() => {
    if (!id || DEMO_MODE) return;
    const channel = supabase
      .channel(`patient-messages-${id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages", filter: `patient_id=eq.${id}` },
        () => invalidate(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, queryClient]);

  // Mark patient messages as read when the thread is visible.
  useEffect(() => {
    if (!id || !data) return;
    const hasUnreadPatient = data.messages.some((m: any) => m.author === "patient" && !m.read_at);
    if (hasUnreadPatient) markRead.mutate({ data: { patient_id: id } });
  }, [id, data?.messages.length]);

  /** Chronological photo timeline, labelled by which treatment in the course it belongs to. */
  const timeline = useMemo(() => {
    const order = [...(data?.treatments ?? [])].sort((a: any, b: any) =>
      a.performed_at > b.performed_at ? 1 : -1,
    );
    const numberFor = new Map<string, number>();
    order.forEach((t: any, i: number) => numberFor.set(t.id, i + 1));
    return [...(data?.photos ?? [])]
      .sort((a: any, b: any) => (a.taken_at > b.taken_at ? 1 : -1))
      .map((p: any) => {
        const n = p.treatment_id ? numberFor.get(p.treatment_id) : undefined;
        return {
          ...p,
          label: `${p.kind === "before" ? "Before" : "After"}${n ? ` treatment ${n}` : ""} · ${new Date(
            p.taken_at,
          ).toLocaleDateString("en-GB")}`,
          treatmentNumber: n ?? null,
        };
      });
  }, [data]);

  const left = timeline.find((p: any) => p.id === leftId) ?? timeline[0];
  const right = timeline.find((p: any) => p.id === rightId) ?? timeline[timeline.length - 1];

  /** Treatments that have at least one photo, with their before/after sets. */
  const photosByTreatment = useMemo(() => {
    const order = [...(data?.treatments ?? [])].sort((a: any, b: any) =>
      a.performed_at > b.performed_at ? 1 : -1,
    );
    return order
      .map((t: any, i: number) => {
        const photos = (data?.photos ?? []).filter((p: any) => p.treatment_id === t.id);
        return {
          id: t.id,
          label: `Treatment ${i + 1} · ${t.name} · ${new Date(t.performed_at).toLocaleDateString("en-GB")}`,
          before: photos.filter((p: any) => p.kind === "before"),
          after: photos.filter((p: any) => p.kind === "after"),
          count: photos.length,
        };
      })
      .filter((t) => t.count > 0);
  }, [data]);

  const selectedTreatment =
    photosByTreatment.find((t) => t.id === treatmentPhotoId) ?? photosByTreatment[0];

  async function uploadPhoto(file: File, kind: "before" | "after") {
    setUploading(true);
    try {
      const path = `${id}/${kind}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "")}`;
      if (DEMO_MODE) {
        await savePhoto.mutateAsync({
          data: { patient_id: id, storage_path: URL.createObjectURL(file), kind, treatment_id: photoTreatmentId },
        });
        return;
      }
      const { error } = await supabase.storage.from("patient-photos").upload(path, file);
      if (error) throw error;
      await savePhoto.mutateAsync({
        data: { patient_id: id, storage_path: path, kind, treatment_id: photoTreatmentId },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!identity.isStaff) return <div className="p-12 text-sm text-muted-foreground">Staff access only.</div>;
  if (!data) return <div className="p-12 text-sm text-muted-foreground">Loading record…</div>;

  const p = data.patient as any;
  const bookingChase = (data.bookingChase ?? []) as Array<{
    id: string;
    startsAt: string;
    treatmentName: string;
    practitionerName: string | null;
    paymentStatus: string;
    consentSigned: boolean;
    issues: string[];
    bookingNote: string;
  }>;
  const history = historyWithVisitNotes(data.treatments ?? [], data.visitNotes ?? []);
  // Tab counts: bookings to chase, unreviewed urgent check-ins, pending patient updates.
  const badges = recordTabBadges({
    bookingChase,
    checkins: data.checkins ?? [],
    history: data.history ?? [],
  });
  // What the Overview reads: today's visit, every future booking, which of
  // them a plan step claims, and the readiness rows for the hero.
  const todayVisit = (data.todayVisit ?? null) as ReadyToTreatVisit | null;
  const upcoming = (data.upcoming ?? []) as UpcomingBooking[];
  const checkins = (data.checkins ?? []) as CheckinRow[];
  const onPlanIds = onPlanAppointmentIds(
    (planDetail?.milestoneAppointmentIds ?? []).map((appointmentId) => ({
      appointment_id: appointmentId,
    })),
  );
  const nextStep = planDetail ? upNextStep(planDetail.roadmap) : null;
  const roadmapSteps = (planDetail?.roadmap.flatMap((m) => m.steps) ?? []) as RoadmapStep[];
  const selectedStep = roadmapSteps.find((s) => s.id === (selectedStepId ?? nextStep?.id)) ?? null;
  const planRisk =
    (planRows ?? []).find((row) => row.id === planDetail?.plan.id) ?? planRows?.[0] ?? null;
  const nextStepChecklist = nextStep
    ? (planDetail?.roadmap.flatMap((m) => m.steps).find((s) => s.id === nextStep.id)?.checklist ??
      [])
    : [];
  const readiness = readinessItems({
    visit: todayVisit
      ? {
          treatment: todayVisit.treatment,
          startsAt: todayVisit.startsAt,
          consentState: todayVisit.consentState,
          paymentStatus: todayVisit.paymentStatus,
          price: todayVisit.price,
        }
      : null,
    checkins: data.checkins ?? [],
    history: data.history ?? [],
    checklist: nextStepChecklist as Parameters<typeof readinessItems>[0]["checklist"],
    beforePhotos: ((data.photos ?? []) as { kind: string; taken_at: string }[]).filter(
      (ph) => ph.kind === "before",
    ),
    now,
  });
  const lastPractitionerId =
    (history[0] as { practitioner_id?: string | null } | undefined)?.practitioner_id ?? null;
  const openConsentForm = () => {
    const treatment = todayVisit?.treatment ?? upcoming[0]?.treatmentName ?? "Treatment";
    setDocPreset({ kind: "consent", title: `${treatment} — consent form` });
    setDocOpen(true);
  };
  // Owner-only: what this patient has spent with the clinic, from recorded treatments.
  const lifetimeSpend = ((data.treatments ?? []) as { price?: number | null }[]).reduce(
    (sum, t) => sum + Number(t.price ?? 0),
    0,
  );
  return (
    <AppShell identity={identity}>
      {stepUp.dialog}
      <Link to="/patients" className="-my-1 mb-3 inline-flex min-h-6 items-center gap-2 py-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All patients
      </Link>

      <div className="relative grid items-start gap-5 md:grid-cols-[minmax(0,1fr)] md:gap-[26px]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="page-title">{displayName(p, { withTitle: true })}</h1>
                <p className="page-subtitle">
                  {p.reference} · {p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString("en-GB") : "DOB not set"} ·{" "}
                  {p.email ?? "no email"} · {p.phone ?? "no phone"}
                </p>
                {data?.retention && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {data.retention.risk && <RiskBadge risk={data.retention.risk} />}
                    <span className="text-xs text-muted-foreground" data-qc="record-visits">
                      {data.retention.visits} visit{data.retention.visits === 1 ? "" : "s"}
                      {data.retention.daysSince !== null
                        ? ` · last seen ${daysAgoLabel(data.retention.daysSince)}`
                        : ""}
                      {identity.isOwner ? (
                        <span data-qc="record-lifetime-spend">
                          {" · "}
                          {moneyWhole(lifetimeSpend)} lifetime spend
                        </span>
                      ) : null}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {/* Record treatment stays a button; Open chat sits beside it; the rest live in ⋯. */}
                {canSee(identity, "patient-record-treatment") ? (
                  <Button onClick={() => setTreatmentOpen(true)}>Record treatment</Button>
                ) : null}
                <Button
                  variant="outline"
                  data-qc="open-chat"
                  aria-label={`Open chat${unreadHere ? ` (${unreadHere} unread)` : ""}`}
                  onClick={() =>
                    requestChat({ patientId: id, patientName: patientName || "Patient" })
                  }
                  className="relative"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  Open chat
                  {unreadHere > 0 ? (
                    <span
                      data-qc="open-chat-unread"
                      className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-2xs font-bold text-white shadow-lift"
                    >
                      {unreadHere > 9 ? "9+" : unreadHere}
                    </span>
                  ) : null}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      aria-label="More actions"
                      data-qc="record-more"
                      className="px-2.5"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-2xl">
                    {canSee(identity, "patient-send-documents") ? (
                      <DropdownMenuItem onSelect={() => setDocOpen(true)} data-qc="menu-send-form">
                        Send form
                      </DropdownMenuItem>
                    ) : null}
                    {can(identity, "comms.send") && !p.deleted_at ? (
                      <DropdownMenuItem
                        onSelect={() => setOfferOpen(true)}
                        data-qc="send-offer-open"
                      >
                        Send offer
                      </DropdownMenuItem>
                    ) : null}
                    {identity.isManager ? (
                      p.deleted_at ? (
                        <DropdownMenuItem
                          disabled={archive.isPending}
                          onSelect={() =>
                            void stepUp.run(
                              () => archive.mutateAsync({ data: { id, archived: false } }),
                              "restore",
                            )
                          }
                          data-qc="menu-restore"
                        >
                          Restore patient
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onSelect={() => setArchiveOpen(true)}
                          data-qc="menu-archive"
                          className="text-destructive-ink focus:text-destructive-ink"
                        >
                          Archive
                        </DropdownMenuItem>
                      )
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Dialog open={treatmentOpen} onOpenChange={setTreatmentOpen}>
                  <DialogContent className="max-h-[calc(calc(100*var(--app-dvh))-2rem)] overflow-y-auto rounded-xl">
                    <DialogHeader>
                      <DialogTitle>Record treatment</DialogTitle>
                    </DialogHeader>
                    <form
                      id="treatment-form"
                      className="grid gap-4 sm:grid-cols-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget as HTMLFormElement);
                        const catalogueId = String(f.get("catalogue_id") ?? "");
                        const item = (catalogue ?? []).find((c: any) => c.id === catalogueId);
                        createTreatment.mutate({
                          data: {
                            patient_id: id,
                            catalogue_id: catalogueId,
                            name: item?.name ?? String(f.get("name") ?? "Treatment"),
                            area: String(f.get("area") ?? ""),
                            product: String(f.get("product") ?? ""),
                            dose: String(f.get("dose") ?? ""),
                            notes: String(f.get("notes") ?? ""),
                            price: Number(f.get("price") ?? 0),
                            performed_at: String(f.get("performed_at")),
                            next_due_at: String(f.get("next_due_at") ?? ""),
                          },
                        });
                      }}
                    >
                      <div className="field-stack sm:col-span-2">
                        <Label htmlFor="catalogue_id">Treatment</Label>
                        <select
                          id="catalogue_id"
                          name="catalogue_id"
                          className="h-10 w-full rounded-xl border border-edge-2 bg-glass-2 shadow-inset-hi px-3 text-sm"
                        >
                          {(catalogue ?? []).map((c: any) => (
                            <option key={c.id} value={c.id}>
                              {c.name} — {c.category}
                            </option>
                          ))}
                        </select>
                      </div>
                      <TField name="area" label="Area treated" />
                      <TField name="product" label="Product / batch" />
                      <TField name="dose" label="Dose / units" />
                      <TField name="price" label="Price (£)" type="number" />
                      <TField name="performed_at" label="Date performed" type="date" required />
                      <TField name="next_due_at" label="Next due" type="date" />
                      <div className="field-stack sm:col-span-2">
                        <Label htmlFor="notes">Clinical notes</Label>
                        <Textarea id="notes" name="notes" rows={3} className="rounded-xl" />
                      </div>
                    </form>
                    <DialogFooter>
                      <Button type="submit" form="treatment-form">
                        Save treatment
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {canSee(identity, "patient-send-documents") && (
                  <Dialog
                    open={docOpen}
                    onOpenChange={(v) => {
                      setDocOpen(v);
                      if (!v) setDocPreset(null);
                    }}
                  >
                    <DialogContent className="max-h-[calc(calc(100*var(--app-dvh))-2rem)] overflow-y-auto rounded-xl">
                      <DialogHeader>
                        <DialogTitle>Send to patient</DialogTitle>
                      </DialogHeader>
                      <form
                        id="doc-form"
                        key={docPreset?.title ?? "blank"}
                        className="space-y-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget as HTMLFormElement);
                          issueDocument.mutate({
                            data: {
                              patient_id: id,
                              kind: String(f.get("kind")) as Parameters<
                                typeof issueDocument.mutate
                              >[0]["data"]["kind"],
                              title: String(f.get("title")),
                              body: String(f.get("body") ?? ""),
                              app_origin: window.location.origin,
                            },
                          });
                        }}
                      >
                        <div className="field-stack">
                          <Label htmlFor="kind">Type</Label>
                          <select
                            id="kind"
                            name="kind"
                            defaultValue={docPreset?.kind ?? "consent"}
                            className="h-10 w-full rounded-xl border border-edge-2 bg-glass-2 shadow-inset-hi px-3 text-sm"
                          >
                            <option value="consent">Consent form</option>
                            <option value="consultation">Consultation form</option>
                            <option value="treatment_plan">Treatment plan</option>
                            <option value="aftercare">Aftercare advice</option>
                            <option value="other">Payment link / other</option>
                          </select>
                        </div>
                        <div className="field-stack">
                          <Label htmlFor="title">Title</Label>
                          <Input
                            id="title"
                            name="title"
                            required
                            defaultValue={docPreset?.title ?? ""}
                            className="rounded-xl"
                          />
                        </div>
                        <div className="field-stack">
                          <Label htmlFor="body">Content</Label>
                          <Textarea id="body" name="body" rows={5} className="rounded-xl" />
                        </div>
                      </form>
                      <DialogFooter>
                        <Button type="submit" form="doc-form">
                          Send
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}

                {can(identity, "comms.send") && !p.deleted_at ? (
                  <SendOfferDialog open={offerOpen} onOpenChange={setOfferOpen} patients={[p]} source="one_off" />
                ) : null}

                {identity.isManager && !p.deleted_at ? (
                  <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
                    <DialogContent className="max-h-[calc(calc(100*var(--app-dvh))-2rem)] overflow-y-auto rounded-xl">
                      <DialogHeader>
                        <DialogTitle>Archive this patient</DialogTitle>
                      </DialogHeader>
                      <form
                        id="archive-form"
                        className="space-y-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget as HTMLFormElement);
                          void stepUp.run(
                            () =>
                              archive.mutateAsync({
                                data: { id, archived: true, reason: String(f.get("reason") ?? "") },
                              }),
                            "archive",
                          );
                        }}
                      >
                        <p className="text-sm text-muted-foreground">
                          They will drop out of the patient list and the diary, and this starts the
                          8-year retention clock. Nothing is deleted: the clinical record is kept
                          for 8 years after their last treatment, and you can restore them at any
                          time.
                        </p>
                        <div className="field-stack">
                          <Label htmlFor="reason">Reason (optional)</Label>
                          <Input
                            id="reason"
                            name="reason"
                            placeholder="Moved away, duplicate record, requested removal…"
                            className="rounded-xl"
                          />
                        </div>
                      </form>
                      <DialogFooter>
                        <Button type="submit" form="archive-form" disabled={archive.isPending}>
                          Archive patient
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                ) : null}
              </div>
            </div>

            {p.deleted_at && (
              <div className="mt-4 rounded-xl bg-warning-bg px-4 py-3 text-sm text-warning-ink">
                Archived on {new Date(p.deleted_at).toLocaleDateString("en-GB")}
                {p.deletion_reason ? ` — ${p.deletion_reason}` : ""}. The record is retained and
                read-only in the patient list until restored.
              </div>
            )}

            <div className="mt-6 grid gap-4 border-t border-edge pt-4 sm:grid-cols-3">
              <Detail label="Allergies" value={p.allergies} alert />
              <Detail label="Medication" value={p.medications} />
              <Detail label="Conditions" value={p.conditions} />
            </div>
          </Card>

          <Tabs value={activeTab} onValueChange={changeTab}>
            {/* Let the pill wrap on narrower layouts rather than run under the docked chat panel. */}
            <TabsList className="h-auto max-w-full flex-wrap justify-start">
              {canSee(identity, "patient-overview") && (
                <TabsTrigger value="overview">Overview</TabsTrigger>
              )}
              {canSee(identity, "patient-treatments") && (
                <TabsTrigger value="treatments" className="gap-1.5">
                  Treatments
                  <TabBadge
                    count={badges.treatments}
                    tone="gold"
                    data-qc="treatments-badge"
                    title={`${bookingChase.length} upcoming booking${bookingChase.length === 1 ? "" : "s"} still need${bookingChase.length === 1 ? "s" : ""} chasing (deposit, balance or consent)`}
                  />
                </TabsTrigger>
              )}
              {canSee(identity, "patient-photos") && <TabsTrigger value="photos">Before and after</TabsTrigger>}
              {canSee(identity, "patient-documents") && <TabsTrigger value="documents">Documents</TabsTrigger>}
              {canSee(identity, "patient-history") && (
                <TabsTrigger value="history" className="gap-1.5">
                  Medical history
                  <TabBadge
                    count={badges.history}
                    tone="pink"
                    data-qc="history-badge"
                    title={`${badges.history} patient update${badges.history === 1 ? "" : "s"} waiting to be accepted into the record`}
                  />
                </TabsTrigger>
              )}
              {canSee(identity, "patient-from-patient") && (
                <TabsTrigger value="portal" className="gap-1.5">
                  From the patient
                  <TabBadge
                    count={badges.portal}
                    tone="pink"
                    data-qc="portal-badge"
                    title={`${badges.portal} recovery check-in${badges.portal === 1 ? "" : "s"} flagged and not yet reviewed`}
                  />
                </TabsTrigger>
              )}
              {canSee(identity, "patient-contact") && <TabsTrigger value="contact">Contact</TabsTrigger>}
            </TabsList>

            {/* How we may reach this patient, and what has been sent. Lives in
                a tab so the record opens on clinical content, not admin. */}
            <TabsContent value="contact" className="space-y-4">
              <PatientOffersCard
                patientId={id}
                action={
                  can(identity, "comms.send") && !p.deleted_at ? (
                    <Button variant="outline" size="sm" onClick={() => setOfferOpen(true)}>
                      Send offer
                    </Button>
                  ) : null
                }
              />
              <CommsPreferencesCard
                patientId={id}
                patient={p}
                onSaved={() => {
                  invalidate();
                  void queryClient.invalidateQueries({ queryKey: ["communications", id] });
                }}
              />
              {can(identity, "comms.send") ? (
                <CommsLogCard
                  patientId={id}
                  enabled
                  canDrain={can(identity, "comms.send")}
                  showDiagnostics={Boolean(identity.isAdmin)}
                />
              ) : null}
            </TabsContent>

            {/* Overview: readable in a few seconds before a visit. The hero is
                today's visit and what still stands in the way; the four cards
                are the plan, the diary, the tasks and the patient's own words. */}
            <TabsContent value="overview" className="space-y-4">
              <ReadyToTreatCard
                visit={todayVisit}
                nextAppointmentAt={data.nextAppointmentAt ?? null}
                items={readiness.items}
                clear={readiness.clear}
                total={readiness.total}
                payment={
                  todayVisit
                    ? {
                        id: todayVisit.id,
                        patient_id: id,
                        starts_at: todayVisit.startsAt,
                        treatment_name: todayVisit.treatment,
                        treatment_number: null,
                        payment_status: todayVisit.paymentStatus,
                        price: todayVisit.price,
                        patients: { email: p.email ?? null, phone: p.phone ?? null },
                      }
                    : null
                }
                canTreat={can(identity, "treatments.record")}
                onReview={(tab) => changeTab(tab)}
                onSendConsent={openConsentForm}
                onContinue={() => todayVisit && setTreatOpen(todayVisit.id)}
              />
              {/* Two by two, equal height, one column below the laptop breakpoint. */}
              <div className="grid grid-cols-1 gap-4 [grid-auto-rows:1fr] lg:grid-cols-2">
                <SkinPlanSummaryCard
                  detail={planDetail}
                  now={now}
                  canBook={can(identity, "appointments.edit")}
                  onBook={(stepId) => setBookingStep(stepId)}
                  onOpenRoadmap={() => changeTab("treatments")}
                />
                <div id="upcoming" ref={bookingsRef}>
                  <UpcomingCard
                    upcoming={upcoming}
                    onPlanIds={onPlanIds}
                    chaseFocus={Boolean(chaseFocus)}
                    canSendForms={canSee(identity, "patient-send-documents")}
                    onSendConsent={openConsentForm}
                  />
                </div>
                <TasksRecallsCard
                  patientId={id}
                  patientName={patientName || "this patient"}
                  patientFirstName={p?.first_name ?? "the patient"}
                  avatarUrl={p?.avatar_url ?? null}
                  practitionerId={lastPractitionerId}
                  context={history[0]?.name ? `Last treatment ${history[0].name}` : null}
                />
                <LatestJournalCard
                  journal={(data.journal ?? []) as JournalEntryRow[]}
                  treatments={data.treatments ?? []}
                  onReply={() =>
                    requestChat({ patientId: id, patientName: patientName || "Patient" })
                  }
                  onAllEntries={() => changeTab("portal")}
                />
              </div>
            </TabsContent>

            {/* Treatments: the full roadmap with the selected step beside it,
                then every recorded treatment with its note and forms. The
                diary and the tasks moved to Overview. */}
            <TabsContent value="treatments" className="space-y-4">
              {planDetail ? (
                <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.55fr_1fr]">
                  <SkinPlanRoadmap
                    detail={planDetail}
                    risk={planRisk}
                    selectedId={selectedStep?.id ?? null}
                    onSelect={setSelectedStepId}
                  />
                  <StepDetails
                    step={selectedStep}
                    risk={planRisk}
                    patientId={id}
                    canTick={can(identity, "treatments.record")}
                    canBook={can(identity, "appointments.edit")}
                    canEdit={can(identity, "treatments.record")}
                    onBook={(stepId) => setBookingStep(stepId)}
                    onEdit={(step) => setEditStep(step)}
                  />
                </div>
              ) : null}
              <TreatmentHistory
                rows={history}
                documents={data.documents ?? []}
                photos={data.photos ?? []}
                canViewRecord={canSee(identity, "patient-edit-clinical")}
                onViewRecord={(treatmentId) => setRecordOpen(treatmentId)}
              />
            </TabsContent>

            <TabsContent value="photos">
              <Card className="p-0">
                <div className="grid grid-cols-[minmax(0,1fr)] gap-0 lg:grid-cols-[minmax(0,1fr)_280px]">
                  {/* Main comparison panel */}
                  <div className="p-5 lg:border-r lg:border-edge">
                    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                      <div>
                        <h3 className="section-title">Image comparison</h3>
                        <p className="text-xs text-muted-foreground">
                          Select two points in the course to compare side by side.
                        </p>
                      </div>
                      {/* Each select sits in a clipping box: WebKit reports a select's
                          longest option as scrollable overflow, which would let the
                          page scroll sideways on a phone. */}
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <div className="min-w-0 flex-1 basis-full overflow-hidden sm:basis-auto lg:flex-none">
                          <select
                            value={left?.id ?? ""}
                            onChange={(e) => setLeftId(e.target.value)}
                            className="h-10 w-full rounded-xl border border-edge-2 bg-glass-2 shadow-inset-hi px-3 text-sm lg:w-48"
                            aria-label="Before comparison photo"
                          >
                            {timeline.map((p: any) => (
                              <option key={p.id} value={p.id}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground max-sm:hidden">vs</span>
                        <div className="min-w-0 flex-1 basis-full overflow-hidden sm:basis-auto lg:flex-none">
                          <select
                            value={right?.id ?? ""}
                            onChange={(e) => setRightId(e.target.value)}
                            className="h-10 w-full rounded-xl border border-edge-2 bg-glass-2 shadow-inset-hi px-3 text-sm lg:w-48"
                            aria-label="After comparison photo"
                          >
                            {timeline.map((p: any) => (
                              <option key={p.id} value={p.id}>
                                {p.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {timeline.length === 0 ? (
                      <div className="mt-6 flex aspect-video items-center justify-center rounded-xl border border-dashed border-edge-2 bg-glass-2 text-sm text-muted-foreground">
                        Upload photos to start comparing.
                      </div>
                    ) : (
                      <>
                        {/* minmax(0,…): a photo's natural width must not set the column. */}
                        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                          {[
                            { label: "Before", photo: left },
                            { label: "After", photo: right },
                          ].map(({ label, photo }) => (
                            <div key={label} className="field-stack">
                              <div className="relative overflow-hidden rounded-xl border border-edge bg-glass-2">
                                {photo?.url ? (
                                  <img
                                    src={photo.url}
                                    alt={photo.label}
                                    className="aspect-3/4 w-full min-w-0 object-cover"
                                  />
                                ) : (
                                  <div className="aspect-3/4 w-full" />
                                )}
                                <span
                                  className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-2xs font-semibold tracking-[0.02em] ${
                                    label === "Before"
                                      ? "bg-glass text-foreground backdrop-blur"
                                      : "bg-accent text-accent-foreground"
                                  }`}
                                >
                                  {label}
                                </span>
                              </div>
                              <p className="text-center text-2xs font-medium text-muted-foreground">
                                {photo?.taken_at
                                  ? new Date(photo.taken_at).toLocaleDateString("en-GB")
                                  : "—"}
                              </p>
                            </div>
                          ))}
                        </div>

                        <div className="mt-5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold tracking-[0.02em] text-muted-foreground">
                              Available photos
                            </span>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={timeline.length < 2}
                                onClick={() => {
                                  setLeftId(timeline[0]?.id ?? "");
                                  setRightId(timeline[timeline.length - 1]?.id ?? "");
                                }}
                              >
                                Baseline → latest
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={timeline.length < 2}
                                onClick={() => {
                                  const i = timeline.findIndex((p: any) => p.id === (left?.id ?? ""));
                                  const a = Math.max(0, Math.min(i, timeline.length - 2));
                                  setLeftId(timeline[a].id);
                                  setRightId(timeline[a + 1].id);
                                }}
                              >
                                Step through
                              </Button>
                            </div>
                          </div>
                          <div className="flex gap-2 overflow-x-auto pb-1">
                            {timeline.map((p: any) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => (p.id === left?.id ? setRightId(p.id) : setLeftId(p.id))}
                                className={`shrink-0 overflow-hidden rounded-xl border ${
                                  p.id === left?.id || p.id === right?.id
                                    ? "border-accent ring-1 ring-accent"
                                    : "border-edge"
                                }`}
                                title={p.label}
                              >
                                {p.url ? (
                                  <img src={p.url} alt={p.label} className="h-16 w-14 object-cover" />
                                ) : (
                                  <div className="h-16 w-14 bg-glass-2" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Sidebar: treatment history & upload */}
                  <div className="flex flex-col gap-5 border-t border-edge bg-glass-2 p-5 lg:border-t-0">
                    <div className="flex items-center justify-between">
                      <h3 className="section-title">Treatment history</h3>
                      {canSee(identity, "patient-upload-photos") && <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-edge-2 bg-glass-2 shadow-inset-hi px-2.5 py-1.5 text-xs font-medium text-accent-ink hover:bg-accent-wash">
                        <Upload className="h-3.5 w-3.5" /> Upload
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadPhoto(file, "before");
                            e.target.value = "";
                          }}
                        />
                      </label>}
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-2xs font-semibold tracking-[0.02em] text-muted-foreground">
                        Attach uploads to
                      </span>
                      <select
                        value={photoTreatmentId}
                        onChange={(e) => setPhotoTreatmentId(e.target.value)}
                        className="h-9 rounded-xl border border-edge-2 bg-glass-2 shadow-inset-hi px-3 text-xs"
                        aria-label="Treatment for new photos"
                      >
                        <option value="">No specific treatment</option>
                        {[...data.treatments]
                          .sort((a: any, b: any) => (a.performed_at > b.performed_at ? 1 : -1))
                          .map((t: any, i: number) => (
                            <option key={t.id} value={t.id}>
                              Treatment {i + 1} — {t.name} ({new Date(t.performed_at).toLocaleDateString("en-GB")})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="flex-1 space-y-3">
                      <span className="text-2xs font-semibold tracking-[0.02em] text-muted-foreground">
                        Photos by treatment
                      </span>
                      {photosByTreatment.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No treatment photos yet.</p>
                      ) : (
                        photosByTreatment.map((t) => {
                          const thumb = t.before[0] ?? t.after[0];
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setTreatmentPhotoId(t.id);
                                const beforeId = t.before[0]?.id;
                                const afterId = t.after[t.after.length - 1]?.id ?? t.before[t.before.length - 1]?.id;
                                if (beforeId) setLeftId(beforeId);
                                if (afterId) setRightId(afterId);
                              }}
                              className={`group flex w-full gap-3 rounded-xl border p-3 text-left transition-all hover:border-edge-2 hover:bg-[rgba(47,63,102,0.08)] ${
                                selectedTreatment?.id === t.id
                                  ? "border-edge-2 bg-[rgba(47,63,102,0.08)]"
                                  : "border-edge bg-background"
                              }`}
                            >
                              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-glass-2">
                                {thumb?.url ? (
                                  <img src={thumb.url} alt={t.label} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="h-full w-full" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-foreground">{t.label}</p>
                                <p className="text-2xs text-muted-foreground">
                                  {t.before.length} before · {t.after.length} after
                                </p>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    {canSee(identity, "patient-upload-photos") && <div className="rounded-xl border-2 border-dashed border-edge-2 p-4 text-center transition-colors hover:border-edge-2 hover:bg-[rgba(47,63,102,0.08)]">
                      <label className="flex cursor-pointer flex-col items-center gap-1">
                        <Upload className="h-4 w-4 text-ink-3" />
                        <span className="text-2xs font-medium text-muted-foreground">Drop photos to upload</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadPhoto(file, "after");
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>}
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="space-y-4">
              {data.treatments.some((t: any) => t.hasRecord) ? (
                <Card className="p-5" data-qc="treatment-records">
                  <div className="mb-3">
                    <h3 className="section-title">Treatment records</h3>
                    <p className="text-xs text-muted-foreground">
                      The completed treatment form for each visit, kept as a viewable document.
                    </p>
                  </div>
                  <ul className="divide-y divide-glass-line">
                    {data.treatments
                      .filter((t: any) => t.hasRecord)
                      .map((t: any) => (
                        <li key={t.id} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="text-sm text-foreground">{t.name} — treatment record</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(t.performed_at).toLocaleDateString("en-GB")}
                              {t.profiles?.full_name ? ` · ${t.profiles.full_name}` : ""}
                            </p>
                          </div>
                          {/* Receptionists see that a record exists and its date; the form itself is clinical. */}
                          {canSee(identity, "patient-edit-clinical") ? (
                            <Button type="button" size="sm" variant="outline" onClick={() => setRecordOpen(t.id)}>
                              View
                            </Button>
                          ) : (
                            <Badge variant="outline" className="rounded-xl text-2xs uppercase">
                              Recorded
                            </Badge>
                          )}
                        </li>
                      ))}
                  </ul>
                </Card>
              ) : null}
              <Card className="p-5">
                <ul className="divide-y divide-glass-line">
                  {data.documents.map((d: any) => (
                    <li key={d.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm text-foreground">{d.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.kind.replace("_", " ")}
                          {d.signed_at
                            ? ` · signed ${new Date(d.signed_at).toLocaleDateString("en-GB")} by ${d.signed_name}`
                            : d.sent_at
                              ? ` · sent ${new Date(d.sent_at).toLocaleDateString("en-GB")}`
                              : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="rounded-xl text-2xs uppercase">
                          {d.status}
                        </Badge>
                        {d.status !== "signed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                           
                            onClick={() =>
                              resend.mutate({
                                data: {
                                  id: d.id,
                                  patient_id: id,
                                  app_origin: window.location.origin,
                                },
                              })
                            }
                          >
                            Remind
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                  {data.documents.length === 0 && (
                    <li className="py-6 text-sm text-muted-foreground">Nothing sent yet.</li>
                  )}
                </ul>
              </Card>
            </TabsContent>

            {/* What the patient wrote in their portal: their journal and the
                recovery readings they submit between visits. */}
            {/* From the patient: what came through the portal. Flagged
                check-ins wait at the top until reviewed; the full list and the
                shared journal sit side by side beneath. */}
            <TabsContent value="portal" className="space-y-4">
              <UrgentCheckinsCard
                checkins={checkins}
                treatments={data.treatments ?? []}
                phone={p.phone ?? null}
                patientId={id}
                canReview={can(identity, "treatments.record")}
              />
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
                <AllCheckinsTable checkins={checkins} />
                <JournalList
                  journal={(data.journal ?? []) as JournalEntryRow[]}
                  treatments={data.treatments ?? []}
                />
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              <PatientUpdatesCard
                history={data.history ?? []}
                patient={{
                  allergies: p.allergies ?? null,
                  medications: p.medications ?? null,
                  conditions: p.conditions ?? null,
                }}
                patientId={id}
                canAccept={can(identity, "treatments.record")}
                onBackToOverview={() => changeTab("overview")}
              />
              <Card className="p-5">
                <ul className="divide-y divide-glass-line">
                  {data.history.map((h: any) => (
                    <li key={h.id} className="py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-foreground">{h.summary}</p>
                        {h.reviewed_at ? (
                          <span className="text-xs text-muted-foreground">Reviewed</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                           
                            onClick={() => markReviewed.mutate({ data: { id: h.id, patient_id: id } })}
                          >
                            Mark reviewed
                          </Button>
                        )}
                      </div>
                      <pre className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
                        {Object.entries(h.data ?? {})
                          .filter(([, v]) => v)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join("\n")}
                      </pre>
                      <p className="mt-1 text-2xs text-muted-foreground">
                        {dateTime(h.created_at)} · {h.source}
                      </p>
                    </li>
                  ))}
                  {data.history.length === 0 && (
                    <li className="py-6 text-sm text-muted-foreground">No updates submitted.</li>
                  )}
                </ul>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Book a plan step (Overview's Book, Treatments' Book this step) and edit one. */}
        {bookingStep ? (
          <QuickAddAppointment
            patients={[p]}
            practitioners={practitioners ?? []}
            catalogue={catalogue ?? []}
            date={now}
            defaultPatientId={id}
            defaultPractitionerId={planDetail?.plan.practitionerId ?? undefined}
            milestoneId={bookingStep}
            open
            onOpenChange={(v) => {
              if (!v) {
                setBookingStep(null);
                void queryClient.invalidateQueries({ queryKey: ["patient-plan", id] });
                void queryClient.invalidateQueries({ queryKey: ["treatment-plans"] });
                invalidate();
              }
            }}
            centered
            title="Book this step"
          >
            <span className="sr-only">Book</span>
          </QuickAddAppointment>
        ) : null}
        <EditStepDialog step={editStep} patientId={id} onClose={() => setEditStep(null)} />
        <TreatmentFormDialog
          appointmentId={treatOpen}
          patientId={id}
          open={Boolean(treatOpen)}
          onOpenChange={(o) => !o && closeTreat()}
          onShowTreatments={showTreatments}
        />
        <TreatmentRecordDialog treatmentId={recordOpen} open={Boolean(recordOpen)} onOpenChange={(o) => !o && closeRecord()} />
      </div>
    </AppShell>
  );
}

function Detail({ label, value, alert }: { label: string; value?: string | null; alert?: boolean }) {
  return (
    <div>
      <p className="text-xs tracking-[0.02em] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm ${alert && value ? "text-destructive" : "text-foreground"}`}>
        {value || "None recorded"}
      </p>
    </div>
  );
}

type VisitNoteRow = {
  appointmentId: string;
  treatmentName: string;
  startsAt: string;
  body: string;
};

function historyWithVisitNotes(treatments: any[], notes: VisitNoteRow[]) {
  const past = notes.filter((n) => new Date(n.startsAt).getTime() < Date.now());
  const used = new Set<string>();
  const day = (value: string) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toDateString();
  };
  const rows = treatments.map((t) => {
    const match = past.find(
      (n) =>
        !used.has(n.appointmentId) &&
        ((t.appointment_id && n.appointmentId === t.appointment_id) ||
          (n.treatmentName === t.name && day(n.startsAt) === day(t.performed_at))),
    );
    if (!match) return t;
    used.add(match.appointmentId);
    const existing = String(t.notes ?? "").trim();
    if (!existing) return { ...t, notes: match.body };
    if (existing === match.body.trim()) return t;
    return { ...t, notes: `${existing}\n${match.body}` };
  });
  for (const note of past) {
    if (used.has(note.appointmentId)) continue;
    rows.push({
      id: `visit-note-${note.appointmentId}`,
      name: note.treatmentName,
      performed_at: note.startsAt,
      notes: note.body,
      area: null,
      product: null,
      dose: null,
      price: null,
      next_due_at: null,
      hasRecord: false,
    });
  }
  rows.sort((a, b) => (String(a.performed_at) < String(b.performed_at) ? 1 : -1));
  return rows;
}

function TField({
  name,
  label,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="field-stack">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} required={required} className="rounded-xl" />
    </div>
  );
}