import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { addExternalTreatment, deleteExternalTreatment, getPortalClinic } from "@/lib/clinic.functions";
import { PortalCard, PortalHead, PortalLink, formatPortalDate } from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/my-record/clinic")({
  component: MyClinic,
});

function MyClinic() {
  const queryClient = useQueryClient();
  const fetchClinic = useServerFn(getPortalClinic);
  const { data, isLoading } = useQuery({ queryKey: ["portal-clinic"], queryFn: () => fetchClinic() });
  const [adding, setAdding] = useState(false);

  const remove = useMutation({
    mutationFn: useServerFn(deleteExternalTreatment),
    onSuccess: () => {
      toast.success("Removed");
      void queryClient.invalidateQueries({ queryKey: ["portal-clinic"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <p className="p-6 text-sm text-muted-foreground">Loading your clinic…</p>;

  const clinician = data?.clinician;
  const clinic = data?.clinic as any;

  return (
    <div data-qc="portal-clinic">
      <div className="page-header">
        <div>
          <h1 className="page-title">My Clinic</h1>
          <p className="page-subtitle">Your care team, clinic details and treatment history — all in one place.</p>
        </div>
      </div>

      <div className="grid items-start gap-3.5 xl:grid-cols-[1fr_1.35fr]">
        <PortalCard>
          <PortalHead title="Your clinician" />
          <div className="flex items-center gap-3.5">
            {clinician?.avatarUrl ? (
              <img src={clinician.avatarUrl} alt="" className="h-[76px] w-[76px] shrink-0 rounded-[18px] object-cover" />
            ) : (
              <span className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-[18px] bg-accent-soft text-lg font-semibold text-accent-ink">
                {clinician?.initials ?? "AC"}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-[15px] font-semibold">{clinician?.name ?? "Your care team"}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{clinician?.title ?? "Aetheria Skin Clinic"}</p>
              <PortalLink>View profile</PortalLink>
            </div>
          </div>
        </PortalCard>

        <PortalCard>
          <PortalHead title="Clinic details" />
          <div className="flex gap-3.5">
            <div className="grid min-w-0 flex-1 gap-2.5">
              <Line icon={MapPin}>
                <b className="font-semibold">{clinic?.name ?? "Aetheria Skin Clinic"}</b>
                {clinic?.address && <span className="block">{clinic.address}</span>}
              </Line>
              {clinic?.phone && <Line icon={Phone}>{clinic.phone}</Line>}
              {clinic?.email && <Line icon={Mail}>{clinic.email}</Line>}
            </div>
            <div className="hidden w-[190px] shrink-0 md:block">
              <MapPlaceholder />
              <div className="mt-1.5 text-right">
                <PortalLink>Get directions</PortalLink>
              </div>
            </div>
          </div>
        </PortalCard>
      </div>

      <div className="mt-3.5 grid items-start gap-3.5 md:grid-cols-2">
        <PortalCard>
          <PortalHead icon={CalendarDays} title="Upcoming treatments" />
          {(data?.upcoming ?? []).length === 0 && (
            <p className="py-3 text-xs text-muted-foreground">Nothing booked yet.</p>
          )}
          {(data?.upcoming ?? []).map((t: any) => (
            <div key={t.id} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-[rgba(47,63,102,0.06)]">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[10px] bg-sky-bg text-sky-ink">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold">
                  {t.date} · {t.time}
                </span>
                <span className="text-xs text-muted-foreground">{t.treatment}</span>
              </span>
              <ChevronRight className="ml-auto h-3.5 w-3.5 text-ink-3" aria-hidden />
            </div>
          ))}
        </PortalCard>

        <PortalCard>
          <PortalHead icon={CheckCircle2} title="Completed treatments" />
          {(data?.completed ?? []).length === 0 && (
            <p className="py-3 text-xs text-muted-foreground">No treatments recorded yet.</p>
          )}
          {(data?.completed ?? []).map((t: any) => (
            <div key={t.id} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 hover:bg-[rgba(47,63,102,0.06)]">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[10px] bg-success-bg text-success-ink">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{formatPortalDate(t.performedAt)}</span>
                <span className="text-xs text-muted-foreground">{t.name}</span>
              </span>
              <ChevronRight className="ml-auto h-3.5 w-3.5 text-ink-3" aria-hidden />
            </div>
          ))}
        </PortalCard>
      </div>

      <PortalCard className="mt-3.5">
        <PortalHead
          icon={FileText}
          title="Treatment history (other clinics)"
          sub="Keep a record of your previous treatments from other clinics to help us provide the best care."
          action={
            <button
              type="button"
              data-qc="external-add"
              onClick={() => setAdding(true)}
              className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-glass-2 px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--edge-2)] hover:bg-[rgba(47,63,102,0.08)]"
            >
              <Plus className="h-3 w-3" aria-hidden /> Add past treatment
            </button>
          }
        />
        <table className="glass-table w-full text-sm">
          <thead>
            <tr>
              <th className="px-2.5 py-2 text-left text-2xs uppercase tracking-[0.06em] text-ink-3">Date</th>
              <th className="px-2.5 py-2 text-left text-2xs uppercase tracking-[0.06em] text-ink-3">Treatment</th>
              <th className="px-2.5 py-2 text-left text-2xs uppercase tracking-[0.06em] text-ink-3">Clinic</th>
              <th className="px-2.5 py-2 text-right text-2xs uppercase tracking-[0.06em] text-ink-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(data?.external ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-2.5 py-5 text-center text-xs text-muted-foreground">
                  Nothing added yet.
                </td>
              </tr>
            )}
            {(data?.external ?? []).map((r: any) => (
              <tr key={r.id} className="hover:bg-[rgba(47,63,102,0.045)]">
                <td className="px-2.5 py-2.5 text-xs tabular-nums text-muted-foreground">{r.performed_label}</td>
                <td className="px-2.5 py-2.5 text-xs font-semibold">{r.treatment}</td>
                <td className="px-2.5 py-2.5 text-xs text-muted-foreground">{r.clinic_name}</td>
                <td className="px-2.5 py-2.5 text-right">
                  <button
                    type="button"
                    data-qc="external-delete"
                    aria-label={`Remove ${r.treatment}`}
                    onClick={() => remove.mutate({ data: { id: r.id } })}
                    className="grid h-6 w-6 cursor-pointer place-items-center rounded-full text-ink-3 hover:bg-destructive-bg hover:text-destructive-ink"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </PortalCard>

      {adding && <AddExternalModal onClose={() => setAdding(false)} />}
    </div>
  );
}

function Line({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <p className="flex gap-2.5 text-xs">
      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[10px] bg-glass-2 text-accent-ink">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="leading-relaxed">{children}</span>
    </p>
  );
}

/** Stylised street grid; the portal has no map provider wired up. */
function MapPlaceholder() {
  return (
    <div className="relative h-28 overflow-hidden rounded-[14px] bg-[linear-gradient(160deg,#eef1f4,#e6ebef)] shadow-[inset_0_0_0_1px_var(--edge-2)]">
      {[18, 46, 76].map((t) => (
        <span key={t} className="absolute inset-x-0 h-[5px] bg-white" style={{ top: t }} />
      ))}
      {[40, 104, 150].map((l) => (
        <span key={l} className="absolute inset-y-0 w-[5px] bg-white" style={{ left: l }} />
      ))}
      <MapPin className="absolute left-[112px] top-[34px] h-5 w-5 text-success" aria-hidden />
    </div>
  );
}

function AddExternalModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [treatment, setTreatment] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [label, setLabel] = useState("");

  const add = useMutation({
    mutationFn: useServerFn(addExternalTreatment),
    onSuccess: () => {
      toast.success("Added to your history");
      void queryClient.invalidateQueries({ queryKey: ["portal-clinic"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[rgba(47,63,102,0.28)] p-6 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-label="Add past treatment"
        data-qc="external-modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate({ data: { treatment, clinic_name: clinicName, performed_label: label } });
        }}
        className="w-[min(430px,100%)] rounded-[22px] border border-edge bg-white/95 p-[18px] shadow-popover"
      >
        <div className="flex items-start gap-2.5">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">Add a past treatment</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Treatments you had elsewhere help your clinician plan safely.
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

        {[
          { label: "Treatment", value: treatment, set: setTreatment, qc: "external-treatment", ph: "e.g. Lip Filler" },
          { label: "Clinic", value: clinicName, set: setClinicName, qc: "external-clinic", ph: "e.g. SkinLab, London" },
          { label: "When", value: label, set: setLabel, qc: "external-when", ph: "e.g. Mar 2023" },
        ].map((f) => (
          <label key={f.label} className="mt-3 block">
            <span className="text-xs font-semibold">{f.label}</span>
            <input
              data-qc={f.qc}
              value={f.value}
              required
              placeholder={f.ph}
              onChange={(e) => f.set(e.target.value)}
              className="mt-1.5 h-[34px] w-full rounded-[11px] border border-edge-2 bg-glass-2 px-2.5 text-xs shadow-inset-hi"
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
            data-qc="external-save"
            disabled={!treatment.trim() || !clinicName.trim() || !label.trim() || add.isPending}
            className="inline-flex h-[34px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-accent text-xs font-semibold text-accent-foreground shadow-bloom disabled:opacity-45"
          >
            Add treatment <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        </div>
      </form>
    </div>
  );
}
