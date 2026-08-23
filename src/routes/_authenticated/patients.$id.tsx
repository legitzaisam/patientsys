import { RiskBadge } from "@/components/retention/risk-badge";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCheck, Upload } from "lucide-react";
import {
  addPhoto,
  addTreatment,
  getCatalogue,
  getPatient,
  markMessagesRead,
  resendDocument,
  reviewHistory,
  sendDocument,
} from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { MessageAttachments } from "@/components/message-attachments";
import { MessageComposer } from "@/components/message-composer";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/patients/$id")({
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
  const { data: identity } = useIdentity();
  const queryClient = useQueryClient();
  const fetchPatient = useServerFn(getPatient);
  const fetchCatalogue = useServerFn(getCatalogue);

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
  const [uploading, setUploading] = useState(false);
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");
  const [photoTreatmentId, setPhotoTreatmentId] = useState<string>("");
  const [treatmentPhotoId, setTreatmentPhotoId] = useState<string>("");

  const [chatWidth, setChatWidth] = usePanelWidth("patient-messages", 280);
  const [chatFontSize, setChatFontSize] = usePanelWidth("patient-messages-font", 12);
  const [resizing, setResizing] = useState(false);
  const resizeStart = useRef({ x: 0, width: 280 });

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
      const next = Math.max(220, Math.min(480, resizeStart.current.width + delta));
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
  }, [resizing]);

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
    onSuccess: () => {
      toast.success("Sent to patient");
      setDocOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const resend = useMutation({
    mutationFn: useServerFn(resendDocument),
    onSuccess: () => {
      toast.success("Reminder sent");
      invalidate();
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

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

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

  // Scroll to the latest message when the thread changes.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [data?.messages.length]);

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

  return (
    <AppShell identity={identity}>
      <Link to="/patients" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All patients
      </Link>

      <div
        className="relative grid gap-6 md:grid-cols-[1fr_var(--chat-width)]"
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
              </div>
            </div>

            <div className="mt-6 grid gap-4 border-t border-edge pt-4 sm:grid-cols-3">
              <Detail label="Allergies" value={p.allergies} alert />
              <Detail label="Medication" value={p.medications} />
              <Detail label="Conditions" value={p.conditions} />
            </div>
          </Card>

          <Tabs defaultValue="treatments">
            <TabsList>
              <TabsTrigger value="treatments">Treatments</TabsTrigger>
              <TabsTrigger value="visit-notes">Visit notes</TabsTrigger>
              <TabsTrigger value="photos">Before and after</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="history">History updates</TabsTrigger>
            </TabsList>

            <TabsContent value="treatments">
              <Card className="p-5">
                <ul className="divide-y divide-glass-line">
                  {data.treatments.map((t: any) => (
                    <li key={t.id} className="py-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-foreground">{t.name}</p>
                        <span className="text-xs text-muted-foreground">
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
                  {data.treatments.length === 0 && (
                    <li className="py-6 text-sm text-muted-foreground">No treatments recorded.</li>
                  )}
                </ul>
              </Card>
              <RecallTasksPanel patientId={id} />
            </TabsContent>

            <TabsContent value="visit-notes">
              <Card className="p-5">
                <div className="mb-3">
                  <h3 className="section-title">
                    Visit notes
                  </h3>
                  <p className="text-xs text-muted-foreground">From diary appointments.</p>
                </div>
                {(data.visitNotes ?? []).length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-edge-2 bg-glass-2 px-4 py-6 text-center text-sm text-muted-foreground">
                    No visit notes yet. Add one from an appointment on the diary.
                  </div>
                ) : (
                  <ul className="max-h-[32rem] space-y-2 overflow-y-auto overscroll-contain pr-1">
                    {groupVisitNotesByDay(data.visitNotes ?? []).flatMap((group) =>
                      group.notes.map((n) => (
                        <VisitNoteItem key={n.appointmentId} note={n} />
                      )),
                    )}
                  </ul>
                )}
              </Card>
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
                              className={`group flex w-full gap-3 rounded-xl border p-3 text-left transition-all hover:border-accent hover:bg-accent-wash ${
                                selectedTreatment?.id === t.id ? "border-accent bg-accent-wash" : "border-edge bg-background"
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

                    <div className="rounded-xl border-2 border-dashed border-edge-2 p-4 text-center transition-colors hover:border-accent hover:bg-accent-wash">
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

            <TabsContent value="documents">
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
                           
                            onClick={() => resend.mutate({ data: { id: d.id, patient_id: id } })}
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

        <Card className="relative flex h-[calc(100vh-8rem)] flex-col rounded-2xl p-0 md:sticky md:top-24">
          <div
            className="group hidden md:flex absolute -left-3 top-0 bottom-0 z-10 w-6 cursor-col-resize items-center justify-center"
            onMouseDown={startResize}
            onTouchStart={startResize}
            aria-label="Resize messages panel"
            role="separator"
          >
            <div className="h-10 w-1 rounded-full bg-foreground/20 transition-colors group-hover:bg-foreground/40" />
          </div>
          <div className="flex items-start justify-between gap-2 border-b border-edge px-5 py-4">
            <div>
              <h2 className="section-title">Messages</h2>
              <p className="text-xs text-muted-foreground">Secure clinic ↔ patient thread</p>
            </div>
            <div className="flex shrink-0 items-center rounded-lg border border-edge bg-glass-2 p-0.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-5 w-5 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
                aria-label="Decrease message text size"
                disabled={chatFontSize <= 10}
                onClick={() => setChatFontSize(Math.max(10, chatFontSize - 1))}
              >
                <span className="text-2xs font-medium leading-none">A−</span>
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-5 w-5 text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-30"
                aria-label="Increase message text size"
                disabled={chatFontSize >= 18}
                onClick={() => setChatFontSize(Math.min(18, chatFontSize + 1))}
              >
                <span className="text-2xs font-medium leading-none">A+</span>
              </Button>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {data.messages.map((m: any) => (
              <div
                key={m.id}
                style={{ fontSize: `${chatFontSize}px`, lineHeight: 1.45 }}
                className={`max-w-[85%] rounded-xl px-3 py-2 ${
                  m.author === "staff"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-glass-2 text-foreground"
                }`}
              >
                <p>{m.body}</p>
                <MessageAttachments attachments={(m.attachments ?? []) as any} />
                <div className="mt-1 flex items-center gap-1 opacity-70" style={{ fontSize: `${Math.max(9, chatFontSize - 3)}px` }}>
                  <span>{new Date(m.created_at).toLocaleString("en-GB")}</span>
                  {m.author === "staff" && m.read_at && (
                    <span className="inline-flex items-center gap-0.5" title="Read by patient">
                      <CheckCheck className="h-3 w-3" /> Read
                    </span>
                  )}
                </div>
              </div>
            ))}
            {data.messages.length === 0 && (
              <p className="text-sm text-muted-foreground">No messages yet.</p>
            )}
            <div ref={messagesEndRef} />
          </div>
          <MessageComposer
            patientId={id}
            as="staff"
            templates
            canDeleteTemplates={!!identity?.isManager}
            patientFirstName={p.first_name}
            placeholder="Message patient…"
            onSent={invalidate}
          />
        </Card>
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
  treatmentNumber?: number | null;
  startsAt: string;
  status?: string;
  practitionerName?: string | null;
  body: string;
  updatedAt?: string | null;
  updatedBy?: string | null;
};

/** Statuses worth calling out; anything routine stays unlabelled. */
function visitStatusChip(status?: string) {
  if (!status || status === "booked" || status === "scheduled") return null;
  const tone =
    status === "no_show" || status === "cancelled"
      ? "bg-destructive-bg text-destructive-ink"
      : status === "attended" || status === "complete"
        ? "bg-success-bg text-success-ink"
        : "bg-glass-2 text-muted-foreground";
  return { label: status.replace(/_/g, " "), tone };
}

function VisitNoteItem({ note }: { note: VisitNoteRow }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const bodyRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (expanded) return;
    const el = bodyRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > el.clientHeight + 1);
  }, [note.body, expanded]);

  const startsAt = new Date(note.startsAt);
  const time = startsAt.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const shortDate = startsAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const title = [note.treatmentName, note.treatmentNumber != null ? `#${note.treatmentNumber}` : null]
    .filter(Boolean)
    .join(" · ");
  const chip = visitStatusChip(note.status);

  const editedAt = note.updatedAt ? new Date(note.updatedAt) : null;
  const sameDayAsVisit =
    editedAt != null &&
    editedAt.getFullYear() === startsAt.getFullYear() &&
    editedAt.getMonth() === startsAt.getMonth() &&
    editedAt.getDate() === startsAt.getDate();
  const editedWhen = editedAt
    ? sameDayAsVisit
      ? editedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      : editedAt.toLocaleString("en-GB", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
    : null;
  const hasFooter = overflows || Boolean(note.updatedBy) || Boolean(editedWhen);

  return (
    <li className="rounded-xl border border-edge bg-glass-2/60 px-3.5 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold tracking-tight text-foreground">{title}</p>
          <p className="mt-0.5 truncate text-2xs text-muted-foreground">
            <span className="tabular-nums">{shortDate}</span>
            <span className="text-ink-3"> · </span>
            <span className="font-semibold tabular-nums text-accent-ink">{time}</span>
            {note.practitionerName ? (
              <>
                <span className="text-ink-3"> · </span>
                {note.practitionerName}
              </>
            ) : null}
          </p>
        </div>
        {chip ? (
          <span
            className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-semibold capitalize ${chip.tone}`}
          >
            {chip.label}
          </span>
        ) : null}
      </div>

      <p
        ref={bodyRef}
        className={`mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground ${
          expanded ? "" : "line-clamp-4"
        }`}
      >
        {note.body}
      </p>

      {hasFooter ? (
        <div className="mt-2.5 flex items-center justify-between gap-3 border-t border-edge/70 pt-2">
          {note.updatedBy || editedWhen ? (
            <p className="min-w-0 truncate text-2xs text-ink-3">
              {note.updatedBy ? (
                <>
                  Added by <span className="text-muted-foreground">{note.updatedBy}</span>
                </>
              ) : (
                "Updated"
              )}
              {editedWhen ? (
                <>
                  <span aria-hidden> · </span>
                  <span className="tabular-nums">{editedWhen}</span>
                </>
              ) : null}
            </p>
          ) : (
            <span />
          )}
          {overflows ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="shrink-0 cursor-pointer text-2xs font-semibold text-accent-ink hover:underline"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function groupVisitNotesByDay(notes: VisitNoteRow[]) {
  const byDay = new Map<string, VisitNoteRow[]>();
  for (const note of notes) {
    const d = new Date(note.startsAt);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const list = byDay.get(dayKey);
    if (list) list.push(note);
    else byDay.set(dayKey, [note]);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([dayKey, dayNotes]) => {
      const dayLabel = new Date(`${dayKey}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const sorted = [...dayNotes].sort((a, b) => (a.startsAt < b.startsAt ? 1 : -1));
      return { dayKey, dayLabel, notes: sorted };
    });
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