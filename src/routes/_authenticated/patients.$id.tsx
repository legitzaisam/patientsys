import { RiskBadge } from "@/components/retention/risk-badge";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Upload } from "lucide-react";
import {
  addPhoto,
  addTreatment,
  archivePatient,
  getCatalogue,
  getPatient,
  markMessagesRead,
  resendDocument,
  reviewHistory,
  sendDocument,
} from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { isStepUpRequired, useStepUp } from "@/components/step-up-dialog";
import { PatientChatPanel } from "@/components/patient-chat-panel";
import { useRegisterChatPage } from "@/components/floating-dock/dock-context";
import { supabase } from "@/integrations/supabase/client";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { usePanelWidth } from "@/hooks/use-panel-width";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RecallTasksPanel } from "@/components/retention/recall-tasks-panel";
import { CommsPreferencesCard } from "@/components/comms/comms-preferences";
import { CommsLogCard } from "@/components/comms/comms-log";
import { SendOfferDialog } from "@/components/offers/send-offer-dialog";
import { PatientOffersCard } from "@/components/offers/patient-offers-card";
import { TreatmentFormDialog } from "@/components/treatment-form-dialog";
import { TreatmentRecordDialog } from "@/components/treatment-record-view";
import { STAGE_LABEL } from "@/lib/visit-stage";
import { can } from "@/lib/permissions";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  const [activeTab, setActiveTab] = useState(() => tabSearch ?? "treatments");

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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["patient", id] });
  const [treatmentOpen, setTreatmentOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");
  const [photoTreatmentId, setPhotoTreatmentId] = useState<string>("");
  const [treatmentPhotoId, setTreatmentPhotoId] = useState<string>("");

  const [chatWidth, setChatWidth] = usePanelWidth("patient-messages", 340);
  const [chatCollapsed, setChatCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("aetheria.patient-chat-collapsed") === "1",
  );
  function setChatCollapsedPersisted(next: boolean) {
    setChatCollapsed(next);
    localStorage.setItem("aetheria.patient-chat-collapsed", next ? "1" : "0");
  }

  // Tell the floating dock which patient this page is about: while the docked
  // panel is open the chat bubble hides; when minimised, the bubble opens the
  // floating window on this patient, and its dock-back action lands here.
  const registerChatPage = useRegisterChatPage();
  const patientName = `${data?.patient?.first_name ?? ""} ${data?.patient?.last_name ?? ""}`.trim();
  useEffect(() => {
    if (!data?.patient) return;
    registerChatPage({
      patientId: id,
      patientName: patientName || "Patient",
      docked: !chatCollapsed,
      restoreDock: () => setChatCollapsedPersisted(false),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, patientName, chatCollapsed, !!data?.patient]);
  useEffect(() => () => registerChatPage(null), [registerChatPage]);

  // Arriving with ?chat=1 (e.g. Contact on a dashboard card): make sure the
  // docked panel is open and put the cursor in the composer.
  useEffect(() => {
    if (!chatFocus || !data?.patient) return;
    setChatCollapsedPersisted(false);
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLTextAreaElement>("#patient-chat textarea")?.focus();
    }, 150);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatFocus, !!data?.patient]);
  const [resizing, setResizing] = useState(false);
  const resizeStart = useRef({ x: 0, width: 340 });

  function startResize(e: React.MouseEvent | React.TouchEvent) {
    const clientX = "touches" in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
    resizeStart.current = { x: clientX, width: chatWidth };
    setResizing(true);
  }

  useEffect(() => {
    if (!resizing) return;
    function onMove(e: MouseEvent | TouchEvent) {
      const clientX = "touches" in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
      const delta = resizeStart.current.x - clientX;
      const next = Math.max(280, Math.min(520, resizeStart.current.width + delta));
      setChatWidth(next);
    }
    function onUp() {
      setResizing(false);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [resizing, setChatWidth]);

  useEffect(() => {
    if (tabSearch === "bookings" || tabSearch === "visit-notes" || chaseFocus) setActiveTab("treatments");
    else if (tabSearch) setActiveTab(tabSearch);
  }, [tabSearch, chaseFocus]);

  useEffect(() => {
    if (activeTab !== "treatments" || !chaseFocus) return;
    bookingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeTab, chaseFocus, data]);

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

  return (
    <AppShell identity={identity}>
      {stepUp.dialog}
      <Link to="/patients" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All patients
      </Link>

      <div
        className={`relative grid items-start gap-5 md:gap-[26px] ${
          chatCollapsed ? "md:grid-cols-[minmax(0,1fr)]" : "md:grid-cols-[minmax(0,1fr)_var(--chat-width)]"
        }`}
        style={{ "--chat-width": `${chatWidth}px` } as React.CSSProperties}
      >
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="page-title">
                  {p.last_name}, {p.title ? `${p.title} ` : ""}
                  {p.first_name}
                </h1>
                <p className="page-subtitle">
                  {p.reference} · {p.date_of_birth ? new Date(p.date_of_birth).toLocaleDateString("en-GB") : "DOB not set"} ·{" "}
                  {p.email ?? "no email"} · {p.phone ?? "no phone"}
                </p>
                {data?.retention && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {data.retention.risk && <RiskBadge risk={data.retention.risk} />}
                    <span className="text-xs text-muted-foreground">
                      {data.retention.visits} visit{data.retention.visits === 1 ? "" : "s"}
                      {data.retention.daysSince !== null
                        ? ` · last seen ${data.retention.daysSince} days ago`
                        : ""}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Dialog open={treatmentOpen} onOpenChange={setTreatmentOpen}>
                  <DialogTrigger asChild>
                    <Button>Record treatment</Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-xl">
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

                <Dialog open={docOpen} onOpenChange={setDocOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      Send form
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-xl">
                    <DialogHeader>
                      <DialogTitle>Send to patient</DialogTitle>
                    </DialogHeader>
                    <form
                      id="doc-form"
                      className="space-y-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget as HTMLFormElement);
                        issueDocument.mutate({
                          data: {
                            patient_id: id,
                            kind: String(f.get("kind")) as any,
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
                        <Input id="title" name="title" required className="rounded-xl" />
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

                {can(identity, "comms.send") && !p.deleted_at ? (
                  <>
                    <Button variant="outline" onClick={() => setOfferOpen(true)} data-qc="send-offer-open">
                      Send offer
                    </Button>
                    <SendOfferDialog open={offerOpen} onOpenChange={setOfferOpen} patients={[p]} source="one_off" />
                  </>
                ) : null}

                {identity?.isOwner &&
                  (p.deleted_at ? (
                    <Button
                      variant="outline"
                      onClick={() =>
                        void stepUp.run(
                          () => archive.mutateAsync({ data: { id, archived: false } }),
                          "restore",
                        )
                      }
                      disabled={archive.isPending}
                    >
                      Restore patient
                    </Button>
                  ) : (
                    <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline">Archive</Button>
                      </DialogTrigger>
                      <DialogContent className="rounded-xl">
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
                            They will drop out of the patient list and the diary. Nothing is
                            deleted: the clinical record is kept for 8 years after their last
                            treatment, and you can restore them at any time.
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
                  ))}
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

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* Let the pill wrap on narrower layouts rather than run under the docked chat panel. */}
            <TabsList className="h-auto max-w-full flex-wrap justify-start">
              <TabsTrigger value="treatments" className="items-center pr-2.5">
                Treatments
                {bookingChase.length > 0 ? (
                  <span className="ml-1.5 inline-flex h-[15px] min-w-[15px] shrink-0 items-center justify-center rounded-full bg-destructive-bg px-0.5 text-[10px] font-semibold leading-none text-destructive-ink tabular-nums">
                    {bookingChase.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="photos">Before and after</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="history">History updates</TabsTrigger>
              <TabsTrigger value="portal">From the patient</TabsTrigger>
              <TabsTrigger value="contact">Contact</TabsTrigger>
            </TabsList>

            {/* How we may reach this patient, and what has been sent. Lives in
                a tab so the record opens on clinical content, not admin. */}
            <TabsContent value="contact" className="space-y-4">
              <CommsPreferencesCard
                patientId={id}
                patient={p}
                onSaved={() => {
                  invalidate();
                  void queryClient.invalidateQueries({ queryKey: ["communications", id] });
                }}
              />
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
              {can(identity, "comms.send") ? (
                <CommsLogCard patientId={id} enabled canDrain={can(identity, "comms.send")} />
              ) : null}
            </TabsContent>

            <TabsContent value="treatments" className="space-y-4">
              {(data as any).todayVisit && (data as any).todayVisit.stage !== "complete" ? (
                <Card className="flex flex-wrap items-center gap-3 p-4" data-qc="today-visit">
                  <div className="min-w-0 flex-1">
                    <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-ink-3">Today's visit</p>
                    <p className="text-sm font-semibold text-foreground">
                      {(data as any).todayVisit.treatment} ·{" "}
                      {new Date((data as any).todayVisit.startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      {(data as any).todayVisit.practitionerName ? ` · ${(data as any).todayVisit.practitionerName}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {STAGE_LABEL[(data as any).todayVisit.stage as keyof typeof STAGE_LABEL] ?? (data as any).todayVisit.stage}
                      {(data as any).todayVisit.consentState === "outstanding" ? " · consent outstanding" : ""}
                    </p>
                  </div>
                  {can(identity, "treatments.record") ? (
                    <Button
                      type="button"
                      data-qc="open-treatment-form"
                      disabled={(data as any).todayVisit.consentState === "outstanding" || (data as any).todayVisit.stage === "no_show"}
                      title={(data as any).todayVisit.consentState === "outstanding" ? "Consent is outstanding" : undefined}
                      onClick={() => setTreatOpen((data as any).todayVisit.id)}
                    >
                      {(data as any).todayVisit.stage === "in_treatment" || (data as any).todayVisit.stage === "aftercare"
                        ? "Continue treatment form"
                        : "Start treatment"}
                    </Button>
                  ) : null}
                </Card>
              ) : null}

              <Card className="p-5">
                <div className="mb-3">
                  <h3 className="section-title">Treatment history</h3>
                  <p className="text-xs text-muted-foreground">Recorded treatments and follow-up dates.</p>
                </div>
                <ul className="divide-y divide-glass-line">
                  {history.map((t: any) => (
                    <li key={t.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-foreground">{t.name}</p>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground">
                          {t.hasRecord ? (
                            <button
                              type="button"
                              data-qc="view-treatment-record"
                              onClick={() => setRecordOpen(t.id)}
                              className="cursor-pointer font-semibold text-accent-ink hover:underline"
                            >
                              View record
                            </button>
                          ) : null}
                          {new Date(t.performed_at).toLocaleDateString("en-GB")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {[t.area, t.product, t.dose, t.price ? `£${t.price}` : null].filter(Boolean).join(" · ")}
                        {t.next_due_at
                          ? ` · due ${new Date(t.next_due_at).toLocaleDateString("en-GB")}`
                          : ""}
                      </p>
                      {t.notes && <p className="mt-1 text-xs text-foreground/80">{t.notes}</p>}
                    </li>
                  ))}
                  {history.length === 0 && (
                    <li className="py-6 text-sm text-muted-foreground">No treatments recorded.</li>
                  )}
                </ul>
              </Card>

              <Card ref={bookingsRef} className="p-5">
                <div className="mb-4">
                  <h3 className="section-title">Upcoming appointments</h3>
                  <p className="text-xs text-muted-foreground">
                    {chaseFocus
                      ? "These visits still need chasing — deposits, balances or consent."
                      : "Future diary visits and what still needs chasing."}
                  </p>
                </div>
                {bookingChase.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-edge-2 bg-glass-2 px-4 py-6 text-center text-sm text-muted-foreground">
                    No upcoming appointments need chasing right now.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {bookingChase.map((booking) => (
                      <li
                        key={booking.id}
                        className="rounded-xl border border-edge bg-glass-2/70 px-4 py-3 shadow-inset-hi"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{booking.treatmentName}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {new Date(booking.startsAt).toLocaleDateString("en-GB", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {booking.practitionerName ? ` · ${booking.practitionerName}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {booking.issues.map((issue) => (
                              <Badge
                                key={issue}
                                variant="secondary"
                                className={
                                  issue === "Consent due"
                                    ? "rounded-xl bg-warning-bg text-consent-ink"
                                    : "rounded-xl bg-destructive-bg text-destructive-ink"
                                }
                              >
                                {issue}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {booking.bookingNote ? (
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
                            {booking.bookingNote}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-4">
                  <Link to="/schedule" className="text-2xs font-semibold text-accent-ink hover:underline">
                    Open diary
                  </Link>
                </div>
              </Card>
              <RecallTasksPanel patientId={id} />
            </TabsContent>

            <TabsContent value="photos">
              <Card className="p-0">
                <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
                  {/* Main comparison panel */}
                  <div className="p-5 lg:border-r lg:border-edge">
                    <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
                      <div>
                        <h3 className="section-title">Image comparison</h3>
                        <p className="text-xs text-muted-foreground">
                          Select two points in the course to compare side by side.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={left?.id ?? ""}
                          onChange={(e) => setLeftId(e.target.value)}
                          className="h-10 w-48 rounded-xl border border-edge-2 bg-glass-2 shadow-inset-hi px-3 text-sm"
                          aria-label="Before comparison photo"
                        >
                          {timeline.map((p: any) => (
                            <option key={p.id} value={p.id}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                        <span className="shrink-0 text-xs text-muted-foreground">vs</span>
                        <select
                          value={right?.id ?? ""}
                          onChange={(e) => setRightId(e.target.value)}
                          className="h-10 w-48 rounded-xl border border-edge-2 bg-glass-2 shadow-inset-hi px-3 text-sm"
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

                    {timeline.length === 0 ? (
                      <div className="mt-6 flex aspect-video items-center justify-center rounded-xl border border-dashed border-edge-2 bg-glass-2 text-sm text-muted-foreground">
                        Upload photos to start comparing.
                      </div>
                    ) : (
                      <>
                        <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
                                    className="aspect-3/4 w-full object-cover"
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
                      <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-edge-2 bg-glass-2 shadow-inset-hi px-2.5 py-1.5 text-xs font-medium text-accent-ink hover:bg-accent-wash">
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
                      </label>
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

                    <div className="rounded-xl border-2 border-dashed border-edge-2 p-4 text-center transition-colors hover:border-edge-2 hover:bg-[rgba(47,63,102,0.08)]">
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
                    </div>
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
                          <Button type="button" size="sm" variant="outline" onClick={() => setRecordOpen(t.id)}>
                            View
                          </Button>
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
            <TabsContent value="portal" className="space-y-4">
              <Card className="p-5">
                <h2 className="section-title">Recovery check-ins</h2>
                <p className="text-xs text-muted-foreground">
                  Self-reported between visits. Anything moderate or worse is flagged.
                </p>
                <ul className="mt-3 divide-y divide-glass-line">
                  {((data as any).checkins ?? []).map((c: any) => (
                    <li key={c.id} className="flex items-center gap-3 py-2.5">
                      <span className="w-24 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {new Date(c.checkin_date).toLocaleDateString("en-GB")}
                      </span>
                      <span className="flex-1 text-xs">
                        Redness {c.redness} · Sensitivity {c.sensitivity} · Dryness {c.dryness}
                      </span>
                      {c.needsAttention && (
                        <Badge variant="outline" className="rounded-xl text-2xs uppercase text-destructive">
                          Review
                        </Badge>
                      )}
                    </li>
                  ))}
                  {((data as any).checkins ?? []).length === 0 && (
                    <li className="py-5 text-sm text-muted-foreground">No check-ins submitted yet.</li>
                  )}
                </ul>
              </Card>

              <Card className="p-5">
                <h2 className="section-title">Patient journal</h2>
                <p className="text-xs text-muted-foreground">
                  Entries the patient chose to share with the clinic.
                </p>
                <ul className="mt-3 divide-y divide-glass-line">
                  {((data as any).journal ?? []).map((j: any) => (
                    <li key={j.id} className="py-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">{j.title}</p>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {new Date(j.entry_date).toLocaleDateString("en-GB")}
                        </span>
                      </div>
                      {j.body && <p className="mt-1 text-xs text-muted-foreground">{j.body}</p>}
                    </li>
                  ))}
                  {((data as any).journal ?? []).length === 0 && (
                    <li className="py-5 text-sm text-muted-foreground">No journal entries shared yet.</li>
                  )}
                </ul>
              </Card>
            </TabsContent>

            <TabsContent value="history">
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
                        {new Date(h.created_at).toLocaleString("en-GB")} · {h.source}
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

        <TreatmentFormDialog
          appointmentId={treatOpen}
          patientId={id}
          open={Boolean(treatOpen)}
          onOpenChange={(o) => !o && closeTreat()}
          onShowTreatments={showTreatments}
        />
        <TreatmentRecordDialog treatmentId={recordOpen} open={Boolean(recordOpen)} onOpenChange={(o) => !o && closeRecord()} />

        {chatCollapsed ? null : (
          <PatientChatPanel
            patientId={id}
            patientName={`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Patient"}
            messages={data.messages}
            as="staff"
            templates
            canDeleteTemplates={!!identity?.isManager}
            onResizeStart={startResize}
            onCollapse={() => setChatCollapsedPersisted(true)}
            onSent={invalidate}
          />
        )}
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