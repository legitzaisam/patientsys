import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { reviewTimeOff, withdrawTimeOff } from "@/lib/clinic.functions";
import {
  shortDay,
  timeOffLabel,
  timeOffWhat,
  upcomingBankHolidays,
  type TimeOffLike,
} from "@/lib/staff-schedule";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ProfileMode, ProfileSubject } from "./profile-types";

/** Taken / booked / pending this year, with the request button. */
export function TimeOffSummaryCard({
  mode,
  year,
  totals,
  onRequest,
}: {
  mode: ProfileMode;
  year: number;
  totals: { taken: number; booked: number; pending: number } | null;
  onRequest: () => void;
}) {
  const t = totals ?? { taken: 0, booked: 0, pending: 0 };
  return (
    <Card className="flex flex-col gap-4 p-6" data-qc="time-off-summary">
      <h2 className="section-title">Time off in {year}</h2>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-glass-2 px-1.5 py-3 shadow-inset-hi">
          <p className="text-2xl font-semibold text-foreground" data-qc="timeoff-taken">
            {t.taken}
          </p>
          <p className="text-xs text-muted-foreground">taken</p>
        </div>
        <div className="rounded-2xl bg-success-bg px-1.5 py-3">
          <p className="text-2xl font-semibold text-success-ink" data-qc="timeoff-booked">
            {t.booked}
          </p>
          <p className="text-xs text-success-ink">booked</p>
        </div>
        <div className="rounded-2xl bg-accent-soft px-1.5 py-3">
          <p className="text-2xl font-semibold text-accent-ink" data-qc="timeoff-pending">
            {t.pending}
          </p>
          <p className="text-xs text-accent-ink">pending</p>
        </div>
      </div>
      {mode !== "frontdesk" ? (
        <Button
          type="button"
          className="h-12 w-full font-semibold"
          onClick={onRequest}
          data-qc="timeoff-request"
        >
          {mode === "self" ? "Request time off" : "Add time off"}
        </Button>
      ) : null}
    </Card>
  );
}

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-accent-soft text-accent-ink",
  approved: "bg-success-bg text-success-ink",
  declined: "bg-destructive-bg text-destructive-ink",
  withdrawn: "bg-glass-2 text-muted-foreground shadow-inset-hi",
};

function sortRequests(rows: TimeOffLike[]): TimeOffLike[] {
  return [...rows]
    .filter((r) => r.status !== "withdrawn")
    .sort((a, b) => {
      if ((a.status === "pending") !== (b.status === "pending"))
        return a.status === "pending" ? -1 : 1;
      return b.starts_on.localeCompare(a.starts_on);
    });
}

/** The person's requests: withdraw your own pending ones; approve or decline in manage mode. */
export function TimeOffRequestsCard({
  mode,
  subject,
  rows,
}: {
  mode: ProfileMode;
  subject: ProfileSubject;
  rows: TimeOffLike[];
}) {
  const queryClient = useQueryClient();
  const [declining, setDeclining] = useState<TimeOffLike | null>(null);
  const [reviewerNote, setReviewerNote] = useState("");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["staff-schedule"] });
    queryClient.invalidateQueries({ queryKey: ["staff-profile", subject.userId] });
    queryClient.invalidateQueries({ queryKey: ["staff-notifications"] });
  };

  const withdrawFn = useServerFn(withdrawTimeOff);
  const withdraw = useMutation({
    mutationFn: (id: string) => withdrawFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Request withdrawn");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewFn = useServerFn(reviewTimeOff);
  const review = useMutation({
    mutationFn: (input: { id: string; approve: boolean; reviewerNote?: string }) =>
      reviewFn({ data: input }),
    onSuccess: (_r, input) => {
      toast.success(input.approve ? "Approved" : "Declined");
      setDeclining(null);
      setReviewerNote("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = sortRequests(rows);
  const first = subject.fullName.replace(/^(Dr|Mr|Mrs|Ms|Miss|Mx|Prof)\.?\s+/i, "").split(" ")[0];

  return (
    <Card className="flex flex-col gap-1 p-6" data-qc="time-off-requests">
      <h2 className="section-title mb-2">
        {mode === "self" ? "Your requests" : `${first}’s requests`}
      </h2>
      {list.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No time off requested this year.</p>
      ) : (
        list.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-2.5 border-t border-edge-2 py-3"
            data-qc="timeoff-row"
            data-status={r.status}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-foreground">{timeOffLabel(r)}</p>
              <p className="text-[13px] text-muted-foreground">{timeOffWhat(r)}</p>
              {r.note ? <p className="mt-0.5 text-xs text-muted-foreground">“{r.note}”</p> : null}
            </div>
            <span className="flex items-center gap-1.5">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-bold capitalize",
                  STATUS_CHIP[r.status] ?? STATUS_CHIP["withdrawn"],
                )}
                data-qc="timeoff-status"
              >
                {r.status}
              </span>
              {r.status === "pending" && mode === "self" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  disabled={withdraw.isPending}
                  onClick={() => withdraw.mutate(r.id)}
                  data-qc="timeoff-withdraw"
                >
                  Withdraw
                </Button>
              ) : null}
              {r.status === "pending" && mode === "manage" ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    disabled={review.isPending}
                    onClick={() => review.mutate({ id: r.id, approve: true })}
                    data-qc="timeoff-approve"
                  >
                    Approve
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    disabled={review.isPending}
                    onClick={() => setDeclining(r)}
                    data-qc="timeoff-decline"
                  >
                    Decline
                  </Button>
                </>
              ) : null}
            </span>
          </div>
        ))
      )}

      <Dialog open={Boolean(declining)} onOpenChange={(open) => !open && setDeclining(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Decline this request?</DialogTitle>
            <DialogDescription>
              {declining ? `${timeOffLabel(declining)} · ${timeOffWhat(declining)}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="field-stack">
            <Label htmlFor="decline-note">Reason (optional)</Label>
            <Textarea
              id="decline-note"
              rows={2}
              value={reviewerNote}
              onChange={(e) => setReviewerNote(e.target.value)}
              className="rounded-xl"
              data-qc="timeoff-decline-note"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeclining(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={review.isPending}
              onClick={() =>
                declining &&
                review.mutate({
                  id: declining.id,
                  approve: false,
                  ...(reviewerNote.trim() ? { reviewerNote: reviewerNote.trim() } : {}),
                })
              }
              data-qc="timeoff-decline-confirm"
            >
              {review.isPending ? "Declining…" : "Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/** The next three England and Wales bank holidays. */
export function BankHolidaysCard({ todayKey }: { todayKey: string }) {
  const next = upcomingBankHolidays(todayKey, 3);
  return (
    <Card className="flex flex-col gap-1 p-6" data-qc="bank-holidays">
      <h2 className="section-title mb-2">Bank holidays</h2>
      {next.map((h) => (
        <div
          key={h.key}
          className="flex justify-between gap-3 border-t border-edge-2 py-2.5 text-sm"
          data-qc="bank-holiday"
        >
          <span className="text-foreground">{h.name}</span>
          <span className="shrink-0 text-muted-foreground">{shortDay(h.key, true)}</span>
        </div>
      ))}
    </Card>
  );
}
