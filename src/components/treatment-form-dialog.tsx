import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ClipboardList,
  FileText,
  Heart,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  addPhoto,
  deletePhoto,
  completeTreatment,
  getTreatmentSession,
  moveToAftercare,
  saveTreatmentSessionDraft,
  startTreatment,
} from "@/lib/clinic.functions";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { supabase } from "@/integrations/supabase/client";
import { preCheckFlags, type PreChecks } from "@/lib/visit-stage";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  NotesTextarea,
  NotesToolbar,
  insertBullet,
  useNotesPrefs,
} from "@/components/notes/ios-notes-editor";

/**
 * The three-page treatment form. Each page's button moves the appointment's
 * stage — in_treatment, aftercare, complete — so the rest of the clinic sees
 * where the patient is, and on completion the form fans out into the record
 * (treatment history, visit note, photos, plan step).
 *
 * Fields autosave as a draft so a refresh never loses notes. The page shown
 * follows the saved form's status, so re-opening resumes where it left off.
 */

type Page = 1 | 2 | 3;

const PAGES: { n: Page; label: string; icon: typeof ClipboardList }[] = [
  { n: 1, label: "Before you start", icon: ClipboardList },
  { n: 2, label: "Treatment", icon: Sparkles },
  { n: 3, label: "Aftercare", icon: Heart },
];

function pageFor(status: string | undefined): Page {
  if (status === "treating") return 2;
  if (status === "aftercare" || status === "complete") return 3;
  return 1;
}

const INVALIDATE = [
  "dashboard",
  "dashboard-week",
  "appointments",
  "patient",
  "treatment-session",
  "staff-notifications",
];

export function TreatmentFormDialog({
  appointmentId,
  patientId,
  open,
  onOpenChange,
  onShowTreatments,
}: {
  appointmentId: string | null;
  patientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShowTreatments: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fetchSession = useServerFn(getTreatmentSession);
  const { data, isLoading, error } = useQuery({
    queryKey: ["treatment-session", appointmentId],
    queryFn: () => fetchSession({ data: { appointment_id: appointmentId! } }),
    enabled: open && Boolean(appointmentId),
  });

  const invalidateAll = () => {
    for (const key of INVALIDATE) void queryClient.invalidateQueries({ queryKey: [key] });
  };

  // ---- local form state, seeded from the saved draft ----
  const [page, setPage] = useState<Page>(1);
  const [checks, setChecks] = useState<PreChecks>({});
  const [results, setResults] = useState<Record<string, string>>({});
  const [treatmentNotes, setTreatmentNotes] = useState("");
  const [visitNotes, setVisitNotes] = useState("");
  const [points, setPoints] = useState<{ label: string; covered: boolean }[]>([]);
  const [extra, setExtra] = useState("");
  const [customPoint, setCustomPoint] = useState("");
  const [done, setDone] = useState<{ treatmentId: string } | null>(null);
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      seededFor.current = null;
      setDone(null);
      return;
    }
    if (!data || seededFor.current === data.appointment.id) return;
    seededFor.current = data.appointment.id;
    const s = data.session;
    setPage(pageFor(s?.status));
    setChecks(s?.preChecks ?? {});
    setResults({
      ...(data.lastSameTreatment
        ? {
            ...(data.lastSameTreatment.area ? { area: data.lastSameTreatment.area } : {}),
            ...(data.lastSameTreatment.product ? { product: data.lastSameTreatment.product } : {}),
            ...(data.lastSameTreatment.dose ? { dose: data.lastSameTreatment.dose } : {}),
          }
        : {}),
      ...(s?.results ?? {}),
    });
    setTreatmentNotes(s?.treatmentNotes ?? "");
    setVisitNotes(s?.visitNotes ?? "");
    setPoints(
      s?.aftercarePoints?.length
        ? s.aftercarePoints
        : data.aftercarePoints.map((label: string) => ({ label, covered: false })),
    );
    setExtra(s?.aftercareExtra ?? "");
    if (s?.status === "complete" && s.treatmentId) setDone({ treatmentId: s.treatmentId });
  }, [open, data]);

  // ---- autosave (debounced) ----
  // The timer reads the latest values through a ref, not the closure it was
  // scheduled in, so a late flush can never write stale fields back.
  const saveDraft = useServerFn(saveTreatmentSessionDraft);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);
  const latest = useRef({ checks, results, treatmentNotes, visitNotes, points, extra });
  latest.current = { checks, results, treatmentNotes, visitNotes, points, extra };
  const cancelDraft = () => {
    dirty.current = false;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = null;
  };
  const flushDraft = async () => {
    if (!dirty.current || !appointmentId || done) return;
    dirty.current = false;
    const v = latest.current;
    try {
      await saveDraft({
        data: {
          appointment_id: appointmentId,
          pre_checks: v.checks,
          results: v.results,
          treatment_notes: v.treatmentNotes,
          visit_notes: v.visitNotes,
          aftercare_points: v.points,
          aftercare_extra: v.extra,
        },
      });
    } catch {
      dirty.current = true;
    }
  };
  const scheduleDraft = () => {
    dirty.current = true;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => void flushDraft(), 900);
  };
  useEffect(
    () => () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    },
    [],
  );

  // ---- the three stage-moving mutations ----
  const start = useMutation({
    mutationFn: useServerFn(startTreatment),
    onMutate: cancelDraft,
    onSuccess: () => {
      toast.success("Treatment started — the diary shows In treatment");
      invalidateAll();
      setPage(2);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const aftercare = useMutation({
    mutationFn: useServerFn(moveToAftercare),
    onMutate: cancelDraft,
    onSuccess: () => {
      toast.success("Moved to aftercare — visit note saved");
      invalidateAll();
      setPage(3);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const complete = useMutation({
    mutationFn: useServerFn(completeTreatment),
    onMutate: cancelDraft,
    onSuccess: (res: any) => {
      toast.success("Treatment complete — saved to the patient's record");
      invalidateAll();
      setDone({ treatmentId: res.treatmentId });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- photos during the visit ----
  const savePhoto = useMutation({
    mutationFn: useServerFn(addPhoto),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["treatment-session", appointmentId] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const removePhoto = useMutation({
    mutationFn: useServerFn(deletePhoto),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["treatment-session", appointmentId] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const [uploading, setUploading] = useState(false);
  async function uploadPhoto(file: File, kind: "before" | "after") {
    if (!appointmentId) return;
    const already = (data?.photos ?? []).filter((p: { kind: string }) => p.kind === kind).length;
    if (already >= 3) {
      toast.error("Three photos is the limit for this set");
      return;
    }
    setUploading(true);
    try {
      const path = `${patientId}/${kind}-${Date.now()}-${file.name.replace(/[^\w.-]/g, "")}`;
      if (DEMO_MODE) {
        await savePhoto.mutateAsync({
          data: {
            patient_id: patientId,
            storage_path: URL.createObjectURL(file),
            kind,
            appointment_id: appointmentId,
          },
        });
        return;
      }
      const { error: uploadError } = await supabase.storage
        .from("patient-photos")
        .upload(path, file);
      if (uploadError) throw uploadError;
      await savePhoto.mutateAsync({
        data: { patient_id: patientId, storage_path: path, kind, appointment_id: appointmentId },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const prefs = useNotesPrefs("treatment-form-notes");
  const treatmentRef = useRef<HTMLTextAreaElement | null>(null);

  const flags = useMemo(() => preCheckFlags(checks), [checks]);
  const allAnswered = useMemo(
    () => (data?.checks ?? []).every((c: { key: string }) => checks[c.key]?.answer),
    [data?.checks, checks],
  );
  const locked = Boolean(done) || data?.session?.status === "complete";
  const stageNow = data?.appointment.stage ?? "booked";

  const close = () => {
    void flushDraft();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent
        className="max-h-[92vh] w-[min(920px,calc(100vw-2rem))] max-w-none overflow-hidden p-0 sm:rounded-[26px]"
        data-qc="treatment-form"
      >
        <DialogHeader className="border-b border-edge-2 px-6 pb-4 pt-5">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent-ink" aria-hidden />
            {data ? `${data.appointment.treatment} · ${data.patient.name}` : "Treatment form"}
          </DialogTitle>
          <DialogDescription>
            {data
              ? `${data.appointment.date} · ${data.appointment.time}${data.appointment.sessionNumber ? ` · Session ${data.appointment.sessionNumber} of ${data.appointment.sessionTotal}` : ` · #${data.appointment.treatmentNumber}`}${data.appointment.practitionerName ? ` · ${data.appointment.practitionerName}` : ""}`
              : isLoading
                ? "Loading the visit…"
                : "The three-page treatment form for this visit."}
          </DialogDescription>
          <ol className="mt-4 flex items-center gap-2" aria-label="Form pages">
            {PAGES.map((p, i) => {
              const Icon = p.icon;
              const reached = page >= p.n;
              const current = page === p.n;
              return (
                <li key={p.n} className="flex flex-1 items-center gap-2">
                  <button
                    type="button"
                    data-qc={`form-page-${p.n}`}
                    aria-current={current ? "step" : undefined}
                    disabled={!reached}
                    onClick={() => reached && setPage(p.n)}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-1.5 text-left text-xs transition-colors",
                      current
                        ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                        : reached
                          ? "cursor-pointer text-ink-2 hover:bg-[rgba(47,63,102,0.08)]"
                          : "cursor-default text-ink-3",
                    )}
                  >
                    <span
                      className={cn(
                        "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold",
                        reached
                          ? "bg-accent text-accent-foreground"
                          : "bg-glass-2 text-ink-3 shadow-inset-hi",
                      )}
                    >
                      {page > p.n || locked ? <Check className="h-3 w-3" strokeWidth={3} /> : p.n}
                    </span>
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{p.label}</span>
                  </button>
                  {i < PAGES.length - 1 ? (
                    <span className="h-px w-4 shrink-0 bg-edge-2" aria-hidden />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </DialogHeader>

        <div className="max-h-[calc(92vh-9.5rem)] overflow-y-auto px-6 py-5">
          {error ? (
            <p className="rounded-xl bg-destructive-bg px-3 py-2 text-sm text-destructive-ink">
              {(error as Error).message}
            </p>
          ) : !data ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : done ? (
            <DoneState
              treatmentId={done.treatmentId}
              patientName={data.patient.firstName}
              onViewRecord={() => {
                onOpenChange(false);
                void navigate({
                  to: "/patients/$id",
                  params: { id: patientId },
                  search: { record: done.treatmentId },
                });
              }}
              onShowTreatments={onShowTreatments}
            />
          ) : page === 1 ? (
            <PageOne
              data={data}
              checks={checks}
              onCheck={(key, answer) => {
                setChecks((c) => ({ ...c, [key]: { ...(c[key] ?? { answer }), answer } }));
                scheduleDraft();
              }}
              onNote={(key, note) => {
                setChecks((c) => ({ ...c, [key]: { answer: c[key]?.answer ?? "na", note } }));
                scheduleDraft();
              }}
              flags={flags}
              allAnswered={allAnswered}
              pending={start.isPending}
              canStart={data.canStart}
              alreadyStarted={stageNow === "in_treatment" || stageNow === "aftercare"}
              onStart={() =>
                start.mutate({ data: { appointment_id: appointmentId!, pre_checks: checks } })
              }
              onSkipToPage={() => setPage(pageFor(data.session?.status))}
            />
          ) : page === 2 ? (
            <PageTwo
              data={data}
              results={results}
              onResults={(patch) => {
                setResults((r) => ({ ...r, ...patch }));
                scheduleDraft();
              }}
              treatmentNotes={treatmentNotes}
              onTreatmentNotes={(v) => {
                setTreatmentNotes(v);
                scheduleDraft();
              }}
              prefs={prefs}
              treatmentRef={treatmentRef}
              uploading={uploading}
              onUpload={uploadPhoto}
              onRemove={(id) => removePhoto.mutate({ data: { id } })}
              pending={aftercare.isPending}
              onNext={() =>
                aftercare.mutate({
                  data: {
                    appointment_id: appointmentId!,
                    results: Object.fromEntries(
                      Object.entries(results)
                        .map(([key, value]) => [key, value.trim()])
                        .filter(([, value]) => value),
                    ),
                    ...(treatmentNotes.trim() ? { treatment_notes: treatmentNotes } : {}),
                  },
                })
              }
            />
          ) : (
            <PageThree
              data={data}
              points={points}
              onRemove={(i) => {
                setPoints((p) => p.filter((_, j) => j !== i));
                scheduleDraft();
              }}
              customPoint={customPoint}
              onCustomPoint={setCustomPoint}
              onAddCustom={() => {
                const label = customPoint.trim();
                if (!label) return;
                setPoints((p) => [...p, { label, covered: true }]);
                setCustomPoint("");
                scheduleDraft();
              }}
              extra={extra}
              onExtra={(v) => {
                setExtra(v);
                scheduleDraft();
              }}
              pending={complete.isPending}
              onComplete={() =>
                complete.mutate({
                  data: {
                    appointment_id: appointmentId!,
                    aftercare_points: points.map((p) => ({ ...p, covered: true })),
                    ...(extra.trim() ? { aftercare_extra: extra } : {}),
                  },
                })
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ pieces */

function Section({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: typeof FileText;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-glass-2 p-4 shadow-inset-hi">
      <div className={cn("flex items-center gap-2", children ? "mb-2.5" : "")}>
        <Icon className="h-3.5 w-3.5 text-accent-ink" aria-hidden />
        <h3 className="text-xs font-semibold tracking-[0.02em] text-foreground">{title}</h3>
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function Detail({
  label,
  value,
  alert,
}: {
  label: string;
  value?: string | null;
  alert?: boolean;
}) {
  const has = Boolean(value && value.trim() && !/^none( known)?$/i.test(value.trim()));
  return (
    <div>
      <p className="text-2xs uppercase tracking-[0.06em] text-ink-3">{label}</p>
      <p
        className={cn(
          "text-sm",
          alert && has ? "font-semibold text-destructive-ink" : "text-foreground",
        )}
      >
        {value?.trim() || "None recorded"}
      </p>
    </div>
  );
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// The server function's return type carries TanStack's fetcher generics;
// `any` here keeps the page components readable and the fields are checked
// where they are used.
type SessionData = any;

function PhotoCard({
  kind,
  photos,
  uploading,
  onUpload,
  onRemove,
}: {
  kind: "before" | "after";
  photos: { id: string; url?: string | null }[];
  uploading: boolean;
  onUpload: (file: File, kind: "before" | "after") => Promise<void>;
  onRemove: (id: string) => void;
}) {
  const title = kind === "before" ? "Before" : "After";
  const shown = photos.slice(0, 3);
  const add = shown.length < 3 ? (
    <label className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-glass-2 px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--edge-2)] hover:bg-[rgba(47,63,102,0.08)]">
      <Camera className="h-3.5 w-3.5" aria-hidden />
      {uploading ? "Uploading…" : "Add photo"}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        data-qc={`tf-photo-${kind}`}
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onUpload(file, kind);
          e.target.value = "";
        }}
      />
    </label>
  ) : null;
  return (
    <Section title={title} icon={Camera} action={add}>
      {shown.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {shown.map((p) => (
            <div key={p.id} className="relative h-24 w-32 shrink-0">
              <img src={p.url ?? ""} alt="" className="h-full w-full rounded-lg object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                data-qc={`tf-photo-remove-${kind}`}
                onClick={() => onRemove(p.id)}
                className="absolute right-1 top-1 grid h-5 w-5 cursor-pointer place-items-center rounded-full bg-popover/90 text-foreground shadow-inset-hi hover:bg-destructive-bg hover:text-destructive-ink"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

function PageOne({
  data,
  checks,
  onCheck,
  onNote,
  flags,
  allAnswered,
  pending,
  canStart,
  alreadyStarted,
  onStart,
  onSkipToPage,
}: {
  data: SessionData;
  checks: PreChecks;
  onCheck: (key: string, answer: "yes" | "no" | "na") => void;
  onNote: (key: string, note: string) => void;
  flags: { key: string; label: string }[];
  allAnswered: boolean;
  pending: boolean;
  canStart: { ok: boolean; reason?: string };
  alreadyStarted: boolean;
  onStart: () => void;
  onSkipToPage: () => void;
}) {
  return (
    <div className="space-y-4" data-qc="form-page1">
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Patient" icon={FileText}>
          <p className="text-sm font-semibold">{data.patient.name}</p>
          <p className="text-xs text-muted-foreground">
            {[
              data.patient.reference,
              data.patient.dateOfBirth ? `DOB ${formatDate(data.patient.dateOfBirth)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <div className="mt-3 grid gap-2.5">
            <Detail label="Allergies" value={data.patient.allergies} alert />
            <Detail label="Medication" value={data.patient.medications} />
            <Detail label="Conditions" value={data.patient.conditions} />
          </div>
        </Section>
        <Section title="Treatment" icon={Sparkles}>
          <p className="text-sm font-semibold">{data.appointment.treatment}</p>
          <p className="text-xs text-muted-foreground">
            {data.appointment.date} · {data.appointment.time}
            {data.appointment.sessionNumber
              ? ` · Session ${data.appointment.sessionNumber} of ${data.appointment.sessionTotal}`
              : ""}
          </p>
          <div className="mt-3 grid gap-2.5">
            <Detail label="Practitioner" value={data.appointment.practitionerName} />
            <div>
              <p className="text-2xs uppercase tracking-[0.06em] text-ink-3">Consent</p>
              <p className="flex items-center gap-1.5 text-sm">
                {data.consent.state === "signed" ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-success-ink" aria-hidden />
                    Signed{data.consent.signedName ? ` by ${data.consent.signedName}` : ""}
                    {data.consent.signedAt ? ` · ${formatDate(data.consent.signedAt)}` : ""}
                    {data.consent.witnessed ? " · witnessed in clinic" : ""}
                  </>
                ) : data.consent.state === "not_required" ? (
                  <>
                    <ShieldCheck className="h-4 w-4 text-ink-3" aria-hidden /> Not required for this
                    treatment
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-4 w-4 text-destructive-ink" aria-hidden />
                    <span className="font-semibold text-destructive-ink">
                      Outstanding — complete consent before starting
                    </span>
                  </>
                )}
              </p>
            </div>
            {data.milestone ? <Detail label="Skin plan step" value={data.milestone.title} /> : null}
          </div>
        </Section>
      </div>

      <Section title="Booking notes" icon={FileText}>
        {data.bookingNote ? (
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">
            {data.bookingNote}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">No booking notes for this appointment.</p>
        )}
      </Section>

      <Section title="Confirm before starting" icon={ClipboardList}>
        <ul className="space-y-2" data-qc="pre-checks">
          {data.checks.map((c: any) => {
            const value = checks[c.key];
            return (
              <li key={c.key} className="rounded-xl bg-glass-hi p-3" data-qc={`pre-check-${c.key}`}>
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{c.label}</p>
                    <p className="text-2xs text-muted-foreground">{c.hint}</p>
                  </div>
                  <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={c.label}>
                    {(["yes", "no", "na"] as const).map((a) => (
                      <button
                        key={a}
                        type="button"
                        role="radio"
                        aria-checked={value?.answer === a}
                        onClick={() => onCheck(c.key, a)}
                        className={cn(
                          "h-7 cursor-pointer rounded-full px-3 text-xs font-semibold transition-colors",
                          value?.answer === a
                            ? a === "yes"
                              ? "bg-destructive-bg text-destructive-ink shadow-[inset_0_0_0_1px_var(--edge)]"
                              : "bg-accent-soft text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                            : "bg-glass-2 text-ink-2 hover:bg-[rgba(47,63,102,0.08)]",
                        )}
                      >
                        {a === "yes" ? "Yes" : a === "no" ? "No" : "N/A"}
                      </button>
                    ))}
                  </div>
                </div>
                {value?.answer === "yes" ? (
                  <Input
                    value={value.note ?? ""}
                    onChange={(e) => onNote(c.key, e.target.value)}
                    placeholder="How you will manage this before treating"
                    className="mt-2 h-8 text-xs"
                    aria-label={`Note for ${c.label}`}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
        {flags.length > 0 ? (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning-bg px-3 py-2 text-xs text-warning-ink">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            {flags.length} question{flags.length === 1 ? "" : "s"} answered Yes — make sure each has
            a note before you start.
          </p>
        ) : null}
      </Section>

      <div className="flex items-center justify-end gap-3">
        {!canStart.ok ? <p className="text-xs text-destructive-ink">{canStart.reason}</p> : null}
        {alreadyStarted ? (
          <Button type="button" variant="outline" onClick={onSkipToPage}>
            Treatment already started — continue
          </Button>
        ) : null}
        <Button
          type="button"
          data-qc="start-treatment-btn"
          disabled={
            pending ||
            !canStart.ok ||
            !allAnswered ||
            flags.some((f) => !checks[f.key]?.note?.trim())
          }
          onClick={onStart}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          {pending
            ? "Starting…"
            : alreadyStarted
              ? "Update checks and continue"
              : "Start treatment"}
        </Button>
      </div>
    </div>
  );
}

function PageTwo({
  data,
  results,
  onResults,
  treatmentNotes,
  onTreatmentNotes,
  prefs,
  treatmentRef,
  uploading,
  onUpload,
  onRemove,
  pending,
  onNext,
}: {
  data: SessionData;
  results: Record<string, string>;
  onResults: (patch: Record<string, string>) => void;
  treatmentNotes: string;
  onTreatmentNotes: (v: string) => void;
  prefs: ReturnType<typeof useNotesPrefs>;
  treatmentRef: React.RefObject<HTMLTextAreaElement | null>;
  uploading: boolean;
  onUpload: (file: File, kind: "before" | "after") => Promise<void>;
  onRemove: (id: string) => void;
  pending: boolean;
  onNext: () => void;
}) {
  const before = data.photos.filter((p: { kind: string }) => p.kind === "before");
  const after = data.photos.filter((p: { kind: string }) => p.kind === "after");
  const fields = (data.resultFields ?? []) as { key: string; label: string; placeholder: string }[];
  const detailsFilled = fields.every((field) => (results[field.key] ?? "").trim());
  const notesFilled = treatmentNotes.replace(/<[^>]+>/g, "").trim().length > 0;
  const photosFilled = before.length > 0 && after.length > 0;
  const ready = detailsFilled && notesFilled && photosFilled;
  const [showGap, setShowGap] = useState(false);
  return (
    <div className="space-y-4" data-qc="form-page2">
      <PhotoCard kind="before" photos={before} uploading={uploading} onUpload={onUpload} onRemove={onRemove} />
      <Section title="Treatment details" icon={Sparkles}>
        <div className={cn("grid gap-3", fields.length > 3 ? "sm:grid-cols-2" : "sm:grid-cols-3")}>
          {fields.map((field) => (
            <div key={field.key} className="field-stack">
              <Label htmlFor={`tf-${field.key}`} className="text-xs">
                {field.label}
              </Label>
              <Input
                id={`tf-${field.key}`}
                data-qc={`tf-${field.key}`}
                value={results[field.key] ?? ""}
                onChange={(e) => onResults({ [field.key]: e.target.value })}
                placeholder={field.placeholder}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Treatment notes"
        icon={FileText}
        action={
          <NotesToolbar
            prefs={prefs}
            onBullet={() => insertBullet(treatmentRef.current, treatmentNotes, onTreatmentNotes)}
          />
        }
      >
        <p className="mb-2 text-2xs text-muted-foreground">
          What was done and how it went. Saved to the treatment history.
        </p>
        <NotesTextarea
          textareaRef={treatmentRef}
          value={treatmentNotes}
          onChange={onTreatmentNotes}
          prefs={prefs}
          placeholder="Technique, response, anything to remember next time…"
          className="min-h-[160px]"
        />
      </Section>

      <PhotoCard kind="after" photos={after} uploading={uploading} onUpload={onUpload} onRemove={onRemove} />

      <div className="flex items-center justify-end gap-3">
        {showGap && !ready ? (
          <p className="text-xs text-muted-foreground" data-qc="move-to-aftercare-hint">
            Add a before photo, the treatment details, the treatment notes, and an after photo.
          </p>
        ) : null}
        <Button
          type="button"
          data-qc="move-to-aftercare-btn"
          disabled={pending}
          onClick={() => {
            if (!ready) {
              setShowGap(true);
              return;
            }
            onNext();
          }}
        >
          <Heart className="h-4 w-4" aria-hidden />
          {pending ? "Saving…" : "Move on to aftercare"}
        </Button>
      </div>
    </div>
  );
}

function PageThree({
  data,
  points,
  onRemove,
  customPoint,
  onCustomPoint,
  onAddCustom,
  extra,
  onExtra,
  pending,
  onComplete,
}: {
  data: SessionData;
  points: { label: string; covered: boolean }[];
  onRemove: (i: number) => void;
  customPoint: string;
  onCustomPoint: (v: string) => void;
  onAddCustom: () => void;
  extra: string;
  onExtra: (v: string) => void;
  pending: boolean;
  onComplete: () => void;
}) {
  return (
    <div className="space-y-4" data-qc="form-page3">
      <Section title={`Aftercare for ${data.appointment.treatment}`} icon={Heart}>
        <p className="mb-3 text-2xs text-muted-foreground">
          Read these to {data.patient.firstName || "the patient"}. They are saved with the record.
        </p>
        <ul className="space-y-1.5" data-qc="aftercare-points">
          {points.map((p, i) => (
            <li
              key={`${p.label}-${i}`}
              data-qc="aftercare-point"
              className="group flex items-start gap-2.5 rounded-xl bg-glass-hi px-3 py-2"
            >
              <span className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">{p.label}</span>
              <button
                type="button"
                aria-label={`Remove: ${p.label}`}
                onClick={() => onRemove(i)}
                className="grid h-6 w-6 shrink-0 cursor-pointer place-items-center rounded-full text-ink-3 opacity-0 transition-opacity hover:bg-destructive-bg hover:text-destructive-ink group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onAddCustom();
          }}
        >
          <Input
            value={customPoint}
            onChange={(e) => onCustomPoint(e.target.value)}
            placeholder="Add a point specific to today…"
            className="h-8 text-xs"
            data-qc="aftercare-custom"
          />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            disabled={!customPoint.trim()}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add
          </Button>
        </form>
      </Section>

      <Section title="Anything else said" icon={FileText}>
        <Textarea
          value={extra}
          onChange={(e) => onExtra(e.target.value)}
          rows={3}
          placeholder="Specific advice given today that is not in the list above."
          className="text-sm"
          data-qc="aftercare-extra"
        />
      </Section>

      <div className="flex items-center justify-end gap-3">
        <Button
          type="button"
          data-qc="complete-treatment-btn"
          disabled={pending}
          onClick={onComplete}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {pending ? "Completing…" : "Complete treatment"}
        </Button>
      </div>
    </div>
  );
}

function DoneState({
  treatmentId,
  patientName,
  onViewRecord,
  onShowTreatments,
}: {
  treatmentId: string;
  patientName: string;
  onViewRecord: () => void;
  onShowTreatments: () => void;
}) {
  void treatmentId;
  return (
    <div className="py-6 text-center" data-qc="form-done">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success-bg text-success-ink">
        <CheckCircle2 className="h-6 w-6" aria-hidden />
      </span>
      <h3 className="mt-3 text-base font-semibold">Treatment complete</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        {patientName ? `${patientName}'s` : "The"} record now carries this visit: treatment history,
        visit note, photos and the aftercare read out. The diary card reads Complete.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button type="button" data-qc="view-record" onClick={onViewRecord}>
          <FileText className="h-4 w-4" aria-hidden /> View record
        </Button>
        <Button asChild type="button" variant="outline">
          <Link to="/dashboard">Back to diary</Link>
        </Button>
      </div>
      <p className="mt-4 text-2xs text-ink-3">
        <button
          type="button"
          data-qc="open-treatments-tab"
          onClick={onShowTreatments}
          className="cursor-pointer hover:underline"
        >
          Open the Treatments tab
        </button>
      </p>
    </div>
  );
}
