import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SeverityBars } from "@/components/patients/record/severity-bars";
import { reviewRecoveryCheckin } from "@/lib/clinic.functions";
import {
  clockTime,
  dayAfterTreatment,
  isUrgentCheckin,
  shortDate,
  type CheckinLike,
} from "@/lib/patients/record-overview";
import { checkinNeedsAttention } from "@/lib/portal/shape";
import { cn } from "@/lib/utils";

export type CheckinRow = CheckinLike & { id: string; created_at?: string | null };

/**
 * Flagged recovery check-ins nobody has looked at yet: the three readings as
 * bars, when and how long after which treatment, the patient's own words,
 * and Call patient / Mark reviewed. Pink-bordered while anything is open;
 * an item leaves the card (and the tab badge drops) once it is reviewed.
 */
export function UrgentCheckinsCard({
  checkins,
  treatments,
  phone,
  patientId,
  canReview,
}: {
  checkins: CheckinRow[];
  treatments: { name: string; performed_at: string }[];
  phone: string | null;
  patientId: string;
  canReview: boolean;
}) {
  const queryClient = useQueryClient();
  const review = useMutation({
    mutationFn: useServerFn(reviewRecoveryCheckin),
    onSuccess: () => {
      toast.success("Check-in marked as reviewed.");
      void queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const flagged = checkins.filter(checkinNeedsAttention);
  if (flagged.length === 0) return null;
  const open = flagged
    .filter(isUrgentCheckin)
    .sort((a, b) => b.checkin_date.localeCompare(a.checkin_date));

  return (
    <section
      className={cn(
        "glass-card flex flex-col gap-3.5 px-6 py-5",
        open.length > 0 &&
          "border-[rgba(220,108,150,0.3)] shadow-[0_1px_2px_rgba(47,63,102,0.06),0_8px_24px_-10px_rgba(220,108,150,0.28),inset_0_1px_0_rgba(255,255,255,0.92)]",
      )}
      data-qc="urgent-checkins"
      data-open={open.length}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-medium text-foreground">Urgent recovery check-ins</h2>
          <p className="mt-0.5 text-xs text-ink-2">
            Moderate or worse on any reading. Stays here until someone marks it reviewed.
          </p>
        </div>
        {open.length > 0 ? (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-[rgba(250,204,226,0.7)] px-[9px] py-px text-[11px] font-semibold text-destructive-ink">
            {open.length} open
          </span>
        ) : (
          <span className="shrink-0 whitespace-nowrap rounded-full bg-success-bg px-[9px] py-px text-[11px] font-semibold text-success-ink">
            All reviewed
          </span>
        )}
      </div>

      {open.length === 0 ? (
        <p className="text-sm text-ink-2">
          Nothing open. Every flagged check-in has been reviewed; the full list is below.
        </p>
      ) : (
        open.map((c) => {
          const after = dayAfterTreatment(c.checkin_date, treatments);
          const when = c.created_at
            ? `${shortDate(c.checkin_date)}, ${clockTime(c.created_at)}`
            : shortDate(c.checkin_date);
          return (
            <div
              key={c.id}
              className="flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl bg-[rgba(250,204,226,0.22)] px-4 py-3.5"
              data-qc="urgent-checkin"
              data-date={c.checkin_date}
            >
              <SeverityBars
                redness={c.redness}
                sensitivity={c.sensitivity}
                dryness={c.dryness}
                className="min-w-0 flex-[1_1_240px]"
              />
              <div className="flex min-w-0 flex-[1_1_260px] flex-col gap-1">
                <span className="text-xs text-ink-2">
                  {when}
                  {after ? ` · ${after.label}` : ""}
                </span>
                <span className="text-[13.5px] text-foreground [text-wrap:pretty]">
                  {c.note?.trim() ? `“${c.note.trim()}”` : "No note left with this check-in."}
                </span>
              </div>
              <div className="flex flex-none flex-col gap-1.5">
                {phone ? (
                  <Button
                    asChild
                    className="h-auto rounded-full px-[13px] py-1.5 text-xs"
                    data-qc="checkin-call"
                  >
                    <a href={`tel:${phone.replace(/\s+/g, "")}`}>Call patient</a>
                  </Button>
                ) : null}
                {canReview ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-auto rounded-full border-edge-2 bg-[rgba(255,255,255,0.7)] px-[13px] py-1.5 text-xs font-medium"
                    disabled={review.isPending}
                    onClick={() =>
                      review.mutate({
                        data: { patient_id: patientId, checkin_date: c.checkin_date },
                      })
                    }
                    data-qc="checkin-review"
                  >
                    Mark reviewed
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })
      )}
    </section>
  );
}
