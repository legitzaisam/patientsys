import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, FileWarning, Upload } from "lucide-react";
import { addMyDocument, deleteMyDocument, listMyDocuments } from "@/lib/clinic.functions";
import { ESSENTIAL_DOC_CATEGORIES } from "@/lib/staff-doc-compliance";
import {
  STAFF_FILE_CATEGORIES,
  formatFileSize,
  openStaffFile,
  staffFileCategoryLabel,
  uploadStaffFile,
} from "@/lib/staff-file-storage";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_CLASS } from "./personal-details-card";
import { daysUntil, monthYear, shortDate } from "./profile-helpers";
import type { ProfileMode, ProfileSubject, StaffDocumentRow } from "./profile-types";

const ESSENTIAL = new Set<string>(ESSENTIAL_DOC_CATEGORIES.map((c) => c.value));
const DAY_MS = 86_400_000;

type Chip = { label: string; tone: "warning" | "success" | "muted" | "info" };

/** What the chip on an on-file row says. */
function statusChip(doc: StaffDocumentRow, subject: ProfileSubject, todayKey: string): Chip {
  const ageDays = (Date.parse(todayKey) - Date.parse(doc.created_at)) / DAY_MS;
  if (doc.category === "statutory_registration" && subject.registrationExpiry) {
    const days = daysUntil(subject.registrationExpiry, todayKey);
    return days <= 90
      ? { label: `Renew by ${shortDate(subject.registrationExpiry)}`, tone: "warning" }
      : { label: `Valid to ${monthYear(subject.registrationExpiry)}`, tone: "success" };
  }
  if (doc.category === "indemnity_insurance" && subject.insuranceExpiry) {
    const days = daysUntil(subject.insuranceExpiry, todayKey);
    return days <= 60
      ? { label: `Renew by ${shortDate(subject.insuranceExpiry)}`, tone: "warning" }
      : { label: `Valid to ${monthYear(subject.insuranceExpiry)}`, tone: "success" };
  }
  if (!ESSENTIAL.has(doc.category)) return { label: "Optional", tone: "muted" };
  if (ageDays < 1) return { label: "Awaiting check", tone: "info" };
  return { label: "On file", tone: "success" };
}

const CHIP_CLASS: Record<Chip["tone"], string> = {
  warning: "bg-accent-soft text-accent-ink",
  success: "bg-success-bg text-success-ink",
  muted: "bg-glass-2 text-muted-foreground shadow-inset-hi",
  info: "bg-warning-bg text-warning-ink",
};

function ProgressRing({ done, total }: { done: number; total: number }) {
  const r = 31;
  const c = 2 * Math.PI * r;
  const pct = total ? done / total : 0;
  return (
    <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden className="shrink-0">
      <circle cx="38" cy="38" r={r} fill="none" stroke="var(--edge-2)" strokeWidth="8" />
      <circle
        cx="38"
        cy="38"
        r={r}
        fill="none"
        stroke="var(--accent-deep)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${(pct * c).toFixed(1)} ${c.toFixed(1)}`}
        transform="rotate(-90 38 38)"
      />
      <text
        x="38"
        y="43"
        textAnchor="middle"
        fontWeight="700"
        fontSize="16"
        fill="var(--foreground)"
      >
        {done}/{total}
      </text>
    </svg>
  );
}

/**
 * Documents: the essentials still to upload, everything on file, and a place
 * for other certificates. Uploads are the person's own; a manager only opens.
 */
export function DocumentsTab({
  mode,
  subject,
  todayKey,
}: {
  mode: ProfileMode;
  subject: ProfileSubject;
  todayKey: string;
}) {
  const queryClient = useQueryClient();
  const self = mode === "self";
  const qKey = self ? ["my-profile", "documents"] : ["staff-documents", subject.userId];
  const fetchDocs = useServerFn(listMyDocuments);
  const { data } = useQuery({
    queryKey: qKey,
    queryFn: () => fetchDocs({ data: self ? {} : { targetUserId: subject.userId } }),
  });
  const docs = (data ?? subject.documents) as StaffDocumentRow[];

  const [busy, setBusy] = useState<string | null>(null);
  const [otherTitle, setOtherTitle] = useState("");
  const [otherCategory, setOtherCategory] = useState("training");
  const pending = useRef<{ category: string; title?: string; replaceId?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: qKey });
    queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    queryClient.invalidateQueries({ queryKey: ["staff-profile", subject.userId] });
    queryClient.invalidateQueries({ queryKey: ["team"] });
  };
  const add = useMutation({ mutationFn: useServerFn(addMyDocument) });
  const remove = useMutation({ mutationFn: useServerFn(deleteMyDocument) });

  const pick = (intent: { category: string; title?: string; replaceId?: string }) => {
    pending.current = intent;
    fileRef.current?.click();
  };

  async function handleFile(file?: File | null) {
    const intent = pending.current;
    pending.current = null;
    if (fileRef.current) fileRef.current.value = "";
    if (!file || !intent) return;
    setBusy(intent.replaceId ?? intent.category);
    try {
      const stored = await uploadStaffFile(subject.userId, file);
      if (!stored.ok) {
        toast.error(stored.error);
        return;
      }
      await add.mutateAsync({
        data: {
          title: intent.title?.trim() || staffFileCategoryLabel(intent.category),
          category: intent.category,
          path: stored.path,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
        },
      });
      if (intent.replaceId) await remove.mutateAsync({ data: { id: intent.replaceId } });
      toast.success(intent.replaceId ? "Document replaced" : "Document uploaded");
      setOtherTitle("");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(null);
    }
  }

  const present = new Set(docs.map((d) => d.category));
  const missing = ESSENTIAL_DOC_CATEGORIES.filter((c) => !present.has(c.value));
  const done = ESSENTIAL_DOC_CATEGORIES.length - missing.length;
  const onFile = [...docs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const headline =
    missing.length === 0
      ? "All required documents are on file"
      : `${missing.length} required document${missing.length === 1 ? "" : "s"} to upload`;

  return (
    <div className="flex flex-col gap-5" data-qc="profile-documents-tab">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,image/*"
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
        data-qc="documents-file-input"
      />

      <Card className="flex items-center gap-5 p-6" data-qc="documents-progress">
        <ProgressRing done={done} total={ESSENTIAL_DOC_CATEGORIES.length} />
        <div className="min-w-0 flex-1">
          <h2 className="section-title" data-qc="documents-headline">
            {headline}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Records required for JCCP and UK clinic practice.{" "}
            {self
              ? "Only you, clinic managers and the owner can open them."
              : "Managers can open these but only the person can upload."}
          </p>
        </div>
      </Card>

      {missing.length > 0 ? (
        <section className="flex flex-col gap-2.5" data-qc="documents-missing">
          <h3 className="text-2xs font-semibold uppercase tracking-[0.08em] text-destructive-ink">
            Needs uploading
          </h3>
          {missing.map((m) => (
            <div
              key={m.value}
              className="flex flex-wrap items-center gap-4 rounded-[22px] bg-destructive-bg/60 px-5 py-4"
              data-qc="document-missing"
              data-category={m.value}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-destructive-bg text-destructive-ink">
                <FileWarning className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">{m.label}</p>
                <p className="text-[13px] text-muted-foreground">{m.reason}</p>
              </div>
              {self ? (
                <Button
                  type="button"
                  disabled={busy === m.value}
                  onClick={() => pick({ category: m.value })}
                  data-qc="document-upload"
                >
                  <Upload className="h-4 w-4" />
                  {busy === m.value ? "Uploading…" : "Upload"}
                </Button>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      <section className="flex flex-col gap-2.5" data-qc="documents-on-file">
        <h3 className="text-2xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          On file
        </h3>
        <Card className="overflow-hidden p-0">
          {onFile.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">Nothing uploaded yet.</p>
          ) : (
            onFile.map((d, i) => {
              const chip = statusChip(d, subject, todayKey);
              return (
                <div
                  key={d.id}
                  className={cn(
                    "flex flex-wrap items-center gap-4 px-5 py-4",
                    i > 0 && "border-t border-edge-2",
                  )}
                  data-qc="document-row"
                  data-category={d.category}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-glass-2 text-muted-foreground shadow-inset-hi">
                    <FileText className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      {staffFileCategoryLabel(d.category)}
                    </p>
                    <p className="truncate font-semibold text-foreground">{d.title}</p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {d.file_name}
                      {d.file_size ? ` · ${formatFileSize(d.file_size)}` : ""} ·{" "}
                      {shortDate(d.created_at.slice(0, 10), true)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold",
                      CHIP_CLASS[chip.tone],
                    )}
                    data-qc="document-status"
                  >
                    {chip.label}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-accent-ink"
                      onClick={() => void openStaffFile(d.path)}
                      data-qc="document-view"
                    >
                      View
                    </Button>
                    {self ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-accent-ink"
                        disabled={busy === d.id}
                        onClick={() =>
                          pick({ category: d.category, title: d.title, replaceId: d.id })
                        }
                        data-qc="document-replace"
                      >
                        {busy === d.id ? "Replacing…" : "Replace"}
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </Card>
      </section>

      {self ? (
        <div
          className="flex flex-wrap items-end gap-4 rounded-[22px] border-2 border-dashed border-accent-line bg-accent-wash px-5 py-5"
          data-qc="documents-add-other"
        >
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">Add other certificates</p>
            <p className="text-[13px] text-muted-foreground">
              CPD, product training, vaccinations · PDF, JPG or PNG up to 10 MB
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px]">
              <div className="field-stack">
                <Label htmlFor="doc-other-title">Document name</Label>
                <Input
                  id="doc-other-title"
                  value={otherTitle}
                  onChange={(e) => setOtherTitle(e.target.value)}
                  placeholder="e.g. Advanced dermal filler masterclass"
                  data-qc="documents-other-title"
                />
              </div>
              <div className="field-stack">
                <Label htmlFor="doc-other-category">Category</Label>
                <select
                  id="doc-other-category"
                  value={otherCategory}
                  onChange={(e) => setOtherCategory(e.target.value)}
                  className={SELECT_CLASS}
                  data-qc="documents-other-category"
                >
                  {STAFF_FILE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={busy === "other"}
            onClick={() => {
              pending.current = { category: otherCategory, title: otherTitle };
              setBusy(null);
              fileRef.current?.click();
            }}
            data-qc="documents-choose-files"
          >
            {busy === "other" ? "Uploading…" : "Choose files"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
