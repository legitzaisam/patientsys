import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, Check, CheckCircle2, Clock, MapPin } from "lucide-react";
import { confirmAppointment, getPortalClinic } from "@/lib/clinic.functions";
import { openPortalChat } from "@/components/portal/portal-dock";
import { PortalCard, PortalHead, formatPortalDate } from "@/components/portal/ui";

export const Route = createFileRoute("/_authenticated/my-record/appointments")({
  component: Appointments,
});

function Appointments() {
  const queryClient = useQueryClient();
  const fetchClinic = useServerFn(getPortalClinic);
  const { data, isLoading } = useQuery({ queryKey: ["portal-clinic"], queryFn: () => fetchClinic() });

  const confirm = useMutation({
    mutationFn: useServerFn(confirmAppointment),
    onSuccess: () => {
      toast.success("Appointment confirmed");
      void queryClient.invalidateQueries({ queryKey: ["portal-clinic"] });
      void queryClient.invalidateQueries({ queryKey: ["portal-home"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div data-qc="portal-appointments">
      <div className="page-header">
        <div>
          <h1 className="page-title">Appointments</h1>
          <p className="page-subtitle">What's booked, and what you've already had.</p>
        </div>
      </div>

      {isLoading && <p className="p-4 text-xs text-muted-foreground">Loading…</p>}

      <div className="grid items-stretch gap-3.5 md:grid-cols-2">
        <PortalCard>
          <PortalHead icon={CalendarDays} title="Upcoming" />
          {(data?.upcoming ?? []).length === 0 && (
            <p className="py-3 text-xs text-muted-foreground">
              Nothing booked.{" "}
              <button
                type="button"
                onClick={() => openPortalChat("Hi, I'd like to book my next appointment. When do you have availability?")}
                className="cursor-pointer font-semibold text-accent-ink hover:underline"
              >
                Message your clinic
              </button>{" "}
              to arrange your next visit.
            </p>
          )}
          {(data?.upcoming ?? []).map((t: any) => (
            <div key={t.id} className="flex items-center gap-3 border-b border-edge-2 py-2.5 last:border-b-0">
              <div className="shrink-0 rounded-[14px] bg-accent-wash px-2.5 py-1.5 text-center shadow-inset-hi">
                <p className="text-2xs font-semibold text-muted-foreground">{t.weekday}</p>
                <p className="text-lg font-semibold leading-tight tabular-nums">{t.day}</p>
                <p className="text-2xs text-muted-foreground">{t.monthYear}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold">{t.treatment}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" aria-hidden /> {t.time}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" aria-hidden /> Aetheria Skin Clinic
                </p>
              </div>
              <div className="ml-auto flex shrink-0 flex-col items-end gap-1.5">
                {t.confirmedAt ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-semibold text-success-ink shadow-inset-hi">
                    <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden /> Confirmed
                  </span>
                ) : (
                  <button
                    type="button"
                    disabled={confirm.isPending}
                    onClick={() => confirm.mutate({ data: { appointment_id: t.id } })}
                    className="inline-flex h-7 cursor-pointer items-center rounded-full bg-accent px-3 text-xs font-semibold text-accent-foreground shadow-bloom hover:brightness-105 disabled:opacity-60"
                  >
                    Confirm
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    openPortalChat(
                      `Hi, I need to reschedule my ${t.treatment} on ${t.date} at ${t.time}. What other times do you have?`,
                    )
                  }
                  className="inline-flex h-7 cursor-pointer items-center rounded-full bg-glass-2 px-3 text-xs font-semibold shadow-[inset_0_0_0_1px_var(--edge-2)] hover:bg-[rgba(47,63,102,0.08)]"
                >
                  Reschedule
                </button>
              </div>
            </div>
          ))}
        </PortalCard>

        <PortalCard>
          <PortalHead icon={CheckCircle2} title="Past treatments" />
          {(data?.completed ?? []).length === 0 && (
            <p className="py-3 text-xs text-muted-foreground">No treatments recorded yet.</p>
          )}
          {(data?.completed ?? []).map((t: any) => (
            <div key={t.id} className="flex items-center gap-2.5 border-b border-edge-2 py-2.5 last:border-b-0">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[10px] bg-success-bg text-success-ink">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-semibold">{t.name}</span>
                <span className="text-xs text-muted-foreground">{formatPortalDate(t.performedAt)}</span>
              </span>
            </div>
          ))}
        </PortalCard>
      </div>
    </div>
  );
}
