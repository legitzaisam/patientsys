import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  BarChart3,
  FileText,
  FlaskConical,
  Heart,
  Image as ImageIcon,
  Info,
  Lock,
  Pencil,
  Phone,
  User,
  X,
} from "lucide-react";
import {
  getPortalRecords,
  signDocument,
  submitHistoryUpdate,
  updatePortalProfile,
} from "@/lib/clinic.functions";
import { PortalCard, PortalHead, PortalLink, PortalNote, formatPortalDate } from "@/components/portal/ui";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/my-record/records")({
  component: MyRecords,
});

function MyRecords() {
  const queryClient = useQueryClient();
  const fetchRecords = useServerFn(getPortalRecords);
  const { data, isLoading } = useQuery({ queryKey: ["portal-records"], queryFn: () => fetchRecords() });
  const [editing, setEditing] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["portal-records"] });
  const sign = useMutation({
    mutationFn: useServerFn(signDocument),
    onSuccess: () => {
      toast.success("Signed — thank you");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateHistory = useMutation({
    mutationFn: useServerFn(submitHistoryUpdate),
    onSuccess: () => {
      toast.success("Sent to your practitioner for review");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading your records…</p>;
  if (!data) return <p className="p-6 text-sm text-muted-foreground">No record linked yet.</p>;

  const p = data.patient as any;
  const address = [p.address_line1, p.address_line2, p.city, p.postcode].filter(Boolean).join("\n");

  return (
    <div data-qc="portal-records">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Profile / Records</h1>
          <p className="page-subtitle">Keep your personal, medical and treatment information organised in one place.</p>
        </div>
      </div>

      <div className="grid items-stretch gap-3.5 xl:grid-cols-3">
        <PortalCard>
          <EditableHead icon={User} title="Personal details" onEdit={() => setEditing(true)} />
          <Field label="Full name" value={`${p.first_name} ${p.last_name}`} />
          <Field label="Date of birth" value={p.date_of_birth ? formatPortalDate(p.date_of_birth) : "—"} />
          <Field label="Email address" value={p.email ?? "—"} />
          <Field label="Phone number" value={p.phone ?? "—"} />
          <Field label="Address" value={address || "Not provided"} />
        </PortalCard>

        <PortalCard>
          <EditableHead icon={Phone} title="Emergency contact" onEdit={() => setEditing(true)} />
          <Field label="Name" value={p.emergency_contact_name ?? "Not provided"} />
          <Field label="Relationship" value={p.emergency_contact_relationship ?? "—"} />
          <Field label="Phone number" value={p.emergency_contact_phone ?? "—"} />
        </PortalCard>

        <PortalCard>
          <PortalHead icon={Heart} title="Medical history" />
          <Stack label="Allergies" value={p.allergies || "None listed"} />
          <Stack label="Current medications" value={p.medications || "None listed"} />
          <Stack label="Medical conditions" value={p.conditions || "None listed"} />
          <div className="mt-2.5">
            <PortalNote icon={Info}>
              Please keep this information up to date so we can provide the safest and most effective care.
            </PortalNote>
          </div>
        </PortalCard>
      </div>

      <div className="mt-3.5 grid items-stretch gap-3.5 xl:grid-cols-3">
        <PortalCard>
          <RecordsHead icon={FileText} title="Treatment history" />
          <div className="relative mt-1 pl-1">
            <span className="absolute bottom-3 left-2 top-2.5 w-0.5 bg-success" />
            {data.treatments.length === 0 && (
              <p className="py-3 text-xs text-muted-foreground">No treatments recorded yet.</p>
            )}
            {data.treatments.map((t: any) => (
              <div key={t.id} className="flex gap-3 py-1.5">
                <span className="z-[1] mt-1.5 ml-1 h-2.5 w-2.5 shrink-0 rounded-full bg-success" />
                <span className="w-[78px] shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatPortalDate(t.performed_at)}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold">{t.name}</span>
                  <span className="text-xs text-muted-foreground">Aetheria Skin Clinic</span>
                </span>
              </div>
            ))}
          </div>
        </PortalCard>

        <PortalCard>
          <RecordsHead icon={BarChart3} title="Results & Labs" />
          {data.labs.length === 0 && <p className="py-3 text-xs text-muted-foreground">Nothing filed yet.</p>}
          {data.labs.map((r: any) => (
            <div key={r.id} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-[rgba(47,63,102,0.06)]">
              <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[10px] bg-glass-2 text-accent-ink">
                <FlaskConical className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{r.title}</span>
                <span className="text-xs text-muted-foreground">{formatPortalDate(r.created_at)}</span>
              </span>
            </div>
          ))}
        </PortalCard>

        <PortalCard>
          <RecordsHead icon={FileText} title="Clinic documents" />
          {data.documents.length === 0 && <p className="py-3 text-xs text-muted-foreground">Nothing outstanding.</p>}
          {data.documents.map((d: any) => (
            <div key={d.id} className="border-b border-edge-2 py-2 last:border-b-0">
              <div className="flex items-center gap-2.5">
                <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[10px] bg-glass-2 text-accent-ink">
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold">{d.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {d.signed_at ? `Signed ${formatPortalDate(d.signed_at)}` : d.kind.replace("_", " ")}
                  </span>
                </span>
                <Badge variant="outline" className="rounded-xl text-2xs uppercase">
                  {d.status}
                </Badge>
              </div>
              {/* Signing lives here now that the portal has a Records page. */}
              {d.status !== "signed" && (
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget as HTMLFormElement);
                    sign.mutate({ data: { id: d.id, signed_name: String(f.get("signed_name")) } });
                  }}
                >
                  <input
                    name="signed_name"
                    required
                    placeholder="Type your full name to sign"
                    className="h-[30px] min-w-0 flex-1 rounded-[11px] border border-edge-2 bg-glass-2 px-2.5 text-xs shadow-inset-hi"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-[30px] shrink-0 cursor-pointer items-center rounded-full bg-accent px-3 text-xs font-semibold text-accent-foreground shadow-bloom"
                  >
                    Sign
                  </button>
                </form>
              )}
            </div>
          ))}
        </PortalCard>
      </div>

      {/* Folded in from the old single-page portal. */}
      <PortalCard className="mt-3.5">
        <PortalHead
          icon={Heart}
          title="Update your health information"
          sub="Tell us about changes to medication, allergies, diet or health so your practitioner can treat you safely."
        />
        <form
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
          data-qc="history-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget as HTMLFormElement;
            const f = new FormData(form);
            updateHistory.mutate({
              data: {
                medications: String(f.get("medications") ?? ""),
                allergies: String(f.get("allergies") ?? ""),
                conditions: String(f.get("conditions") ?? ""),
                diet: String(f.get("diet") ?? ""),
                pregnancy: String(f.get("pregnancy") ?? ""),
                other: String(f.get("other") ?? ""),
              },
            });
            form.reset();
          }}
        >
          <HField name="medications" label="Medication" defaultValue={p.medications} />
          <HField name="allergies" label="Allergies" defaultValue={p.allergies} />
          <HField name="conditions" label="Medical conditions" defaultValue={p.conditions} />
          <HField name="diet" label="Diet / lifestyle changes" />
          <HField name="pregnancy" label="Pregnancy or breastfeeding" />
          <HField name="other" label="Anything else" />
          <div className="sm:col-span-2 xl:col-span-3">
            <button
              type="submit"
              data-qc="history-submit"
              disabled={updateHistory.isPending}
              className="inline-flex h-[34px] cursor-pointer items-center rounded-full bg-accent px-4 text-xs font-semibold text-accent-foreground shadow-bloom disabled:opacity-50"
            >
              Send update to my clinic
            </button>
          </div>
        </form>
      </PortalCard>

      <PortalCard className="mt-3.5" data-qc="photo-archive">
        <div className="flex items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-accent-soft text-accent-ink">
            <ImageIcon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="section-title">Before &amp; After Archive</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-glass-2 px-2 py-0.5 text-2xs text-muted-foreground shadow-[inset_0_0_0_1px_var(--edge-2)]">
                <Lock className="h-2.5 w-2.5" aria-hidden /> Clinic records
              </span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {data.photoCount} photo{data.photoCount === 1 ? "" : "s"} of your treatment progress, all in one place.
            </p>
          </div>
          {data.photoCount > 0 ? (
            <PortalLink onClick={() => setGalleryOpen(true)}>View my gallery</PortalLink>
          ) : null}
        </div>
        {(data.photos ?? []).length > 0 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1" data-qc="photo-strip">
            {(data.photos ?? []).slice(0, 8).map((photo: any) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setGalleryOpen(true)}
                aria-label={`${photo.kind} photo, ${formatPortalDate(photo.takenAt)}`}
                className="relative h-[72px] w-[72px] shrink-0 cursor-pointer overflow-hidden rounded-[12px] shadow-inset-hi transition-transform hover:scale-[1.03]"
              >
                {photo.url ? <img src={photo.url} alt="" className="h-full w-full object-cover" /> : <span className="block h-full w-full bg-glass-2" />}
                <span className="absolute bottom-1 left-1 rounded-full bg-white/85 px-1.5 text-[9px] font-semibold capitalize text-foreground">
                  {photo.kind}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </PortalCard>

      {galleryOpen && <GalleryModal photos={data.photos ?? []} onClose={() => setGalleryOpen(false)} />}
      {editing && <EditProfileModal patient={p} onClose={() => setEditing(false)} />}
    </div>
  );
}

function EditableHead({
  icon: Icon,
  title,
  onEdit,
}: {
  icon: typeof User;
  title: string;
  onEdit: () => void;
}) {
  return (
    <div className="mb-3 flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden />
      <div className="min-w-0">
        <h2 className="section-title">{title}</h2>
        <span className="mt-1 inline-flex items-center rounded-full bg-glass-2 px-2 py-0.5 text-2xs text-muted-foreground shadow-[inset_0_0_0_1px_var(--edge-2)]">
          You can edit these details
        </span>
      </div>
      <button
        type="button"
        data-qc="profile-edit"
        onClick={onEdit}
        className="ml-auto inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-glass-2 px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--edge-2)] hover:bg-[rgba(47,63,102,0.08)]"
      >
        Edit <Pencil className="h-3 w-3" aria-hidden />
      </button>
    </div>
  );
}

function RecordsHead({ icon: Icon, title }: { icon: typeof FileText; title: string }) {
  return (
    <div className="mb-2.5 flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden />
      <div className="min-w-0">
        <h2 className="section-title">{title}</h2>
        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-glass-2 px-2 py-0.5 text-2xs text-muted-foreground shadow-[inset_0_0_0_1px_var(--edge-2)]">
          <Lock className="h-2.5 w-2.5" aria-hidden /> Clinic records
        </span>
      </div>
      <span className="ml-auto shrink-0">
        <PortalLink>View all</PortalLink>
      </span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2.5 py-1">
      <span className="w-[94px] shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="whitespace-pre-line text-xs">{value}</span>
    </div>
  );
}

function Stack({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-2">
      <p className="text-xs font-semibold">{label}</p>
      <p className="mt-px text-xs text-muted-foreground">{value}</p>
    </div>
  );
}

/**
 * Every photo the clinic has shared, grouped by treatment and date, with the
 * before/after pairs side by side. Opened from the archive card.
 */
function GalleryModal({
  photos,
  onClose,
}: {
  photos: { id: string; kind: string; caption: string | null; takenAt: string; treatment: string | null; url: string | null }[];
  onClose: () => void;
}) {
  const groups = new Map<string, typeof photos>();
  for (const photo of photos) {
    const key = `${photo.treatment ?? "Progress photos"}`;
    const list = groups.get(key) ?? [];
    list.push(photo);
    groups.set(key, list);
  }
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(47,63,102,0.28)] p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Your before and after gallery"
        data-qc="photo-gallery"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-[min(820px,100%)] overflow-y-auto rounded-[22px] border border-edge bg-white/95 p-[18px] shadow-popover"
      >
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Before &amp; After gallery</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {photos.length} photo{photos.length === 1 ? "" : "s"} your clinic has shared with you, newest first.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-6 w-6 cursor-pointer place-items-center rounded-full text-ink-3 hover:bg-glass-2"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </div>
        {[...groups.entries()].map(([title, list]) => (
          <section key={title} className="mt-4">
            <p className="text-xs font-semibold">{title}</p>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {list.map((photo) => (
                <figure key={photo.id} className="min-w-0">
                  {photo.url ? (
                    <img src={photo.url} alt="" className="aspect-square w-full rounded-[14px] object-cover shadow-inset-hi" />
                  ) : (
                    <div className="aspect-square w-full rounded-[14px] bg-glass-2" />
                  )}
                  <figcaption className="mt-1.5 text-2xs text-muted-foreground">
                    <span className="font-semibold capitalize text-foreground">{photo.kind}</span> · {formatPortalDate(photo.takenAt)}
                    {photo.caption ? <span className="block">{photo.caption}</span> : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ))}
        {photos.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No photos have been shared yet.</p>
        ) : null}
      </div>
    </div>
  );
}

function HField({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string | null }) {
  return (
    <div>
      <label htmlFor={name} className="text-xs font-semibold">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        rows={2}
        defaultValue={defaultValue ?? ""}
        className="mt-1 w-full rounded-[11px] border border-edge-2 bg-glass-2 px-2.5 py-2 text-xs shadow-inset-hi"
      />
    </div>
  );
}

function EditProfileModal({ patient, onClose }: { patient: any; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    address_line1: patient.address_line1 ?? "",
    address_line2: patient.address_line2 ?? "",
    city: patient.city ?? "",
    postcode: patient.postcode ?? "",
    emergency_contact_name: patient.emergency_contact_name ?? "",
    emergency_contact_relationship: patient.emergency_contact_relationship ?? "",
    emergency_contact_phone: patient.emergency_contact_phone ?? "",
  });

  const save = useMutation({
    mutationFn: useServerFn(updatePortalProfile),
    onSuccess: () => {
      toast.success("Details updated");
      void queryClient.invalidateQueries({ queryKey: ["portal-records"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fields: { key: keyof typeof form; label: string }[] = [
    { key: "address_line1", label: "Address line 1" },
    { key: "address_line2", label: "Address line 2" },
    { key: "city", label: "City" },
    { key: "postcode", label: "Postcode" },
    { key: "emergency_contact_name", label: "Emergency contact name" },
    { key: "emergency_contact_relationship", label: "Relationship" },
    { key: "emergency_contact_phone", label: "Emergency contact phone" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(47,63,102,0.28)] p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-label="Edit your details"
        data-qc="profile-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ data: form });
        }}
        className="max-h-[80vh] w-[min(460px,100%)] overflow-y-auto rounded-[22px] border border-edge bg-white/95 p-[18px] shadow-popover"
      >
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Edit your details</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Your address and next of kin. Name, date of birth and medical history are updated by your clinic.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-6 w-6 cursor-pointer place-items-center rounded-full text-ink-3 hover:bg-glass-2"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </div>

        {fields.map((f) => (
          <label key={f.key} className="mt-2.5 block">
            <span className="text-xs font-semibold">{f.label}</span>
            <input
              data-qc={`profile-${f.key}`}
              value={form[f.key]}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              className="mt-1 h-[32px] w-full rounded-[11px] border border-edge-2 bg-glass-2 px-2.5 text-xs shadow-inset-hi"
            />
          </label>
        ))}

        <div className="mt-3.5 flex gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-[34px] flex-1 cursor-pointer items-center justify-center rounded-full bg-glass-2 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--edge-2)]"
          >
            Cancel
          </button>
          <button
            type="submit"
            data-qc="profile-save"
            disabled={save.isPending}
            className="inline-flex h-[34px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-accent text-xs font-semibold text-accent-foreground shadow-bloom disabled:opacity-45"
          >
            Save details <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        </div>
      </form>
    </div>
  );
}
