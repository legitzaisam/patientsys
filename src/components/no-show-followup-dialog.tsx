import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Clock, PhoneCall } from "lucide-react";
import { createRecallTask, rescheduleAppointment } from "@/lib/clinic.functions";
import { DrilldownDatePicker } from "@/components/drilldown-date-picker";
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

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * After a booking is marked as a no show, ask the clinic user whether they want
 * to rebook there and then. If not, a follow-up task is created so someone
 * chases the patient by chat, phone or email later.
 */
export function NoShowFollowUpDialog({
  appointment: a,
  open,
  onOpenChange,
  onCancel,
  onMarkNoShow,
}: {
  appointment: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCancel?: () => void;
  onMarkNoShow?: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"ask" | "reschedule" | "task">("ask");
  const [handled, setHandled] = useState(false);
  const base = new Date(a.starts_at);
  const [date, setDate] = useState(
    `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`,
  );
  const [time, setTime] = useState(`${pad(base.getHours())}:${pad(base.getMinutes())}`);
  const duration = Math.max(
    5,
    Math.round((new Date(a.ends_at).getTime() - base.getTime()) / 60000) || 30,
  );
  const patientName = `${a.patients?.first_name ?? ""} ${a.patients?.last_name ?? ""}`.trim() || "this patient";
  const [note, setNote] = useState(
    `No show for ${a.treatment_name} (#${a.treatment_number}) on ${base.toLocaleDateString("en-GB")} — contact ${patientName} to rebook.`,
  );

  const done = (msg: string) => {
    toast.success(msg);
    ["appointments", "dashboard", "recall-tasks"].forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    );
    setHandled(true);
    onOpenChange(false);
    setMode("ask");
  };

  const rebook = useMutation({
    mutationFn: useServerFn(rescheduleAppointment),
    onSuccess: () => done("Appointment rebooked"),
    onError: (e: Error) => toast.error(e.message),
  });

  const task = useMutation({
    mutationFn: useServerFn(createRecallTask),
    onSuccess: (res: any) =>
      done(
        res?.duplicate
          ? "Follow-up task already on the dashboard"
          : "Follow-up task added to the dashboard",
      ),
    onError: (e: Error) => toast.error(e.message),
  });

  const handleAction = (next: "reschedule" | "task") => {
    // Switch view immediately so the click always registers first time, and
    // let the status update run in the background (it surfaces its own toast).
    setMode(next);
    void onMarkNoShow?.().catch(() => {});
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          if (!handled) onCancel?.();
          setMode("ask");
          setHandled(false);
        } else {
          setHandled(false);
        }
      }}
    >
      <DialogContent className="flex w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[22px] border-edge-2 bg-card/95 p-5 shadow-popover sm:rounded-[22px]">
        <DialogHeader className="shrink-0 pr-8 text-left">
          <DialogTitle>Marked as no show</DialogTitle>
          <DialogDescription>
            {patientName} missed {a.treatment_name}. Would you like to reschedule now?
          </DialogDescription>
        </DialogHeader>

        {mode === "ask" && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => handleAction("task")}>
              <PhoneCall className="mr-2 h-4 w-4" /> No, follow up later
            </Button>
            <Button enterSubmit onClick={() => handleAction("reschedule")}>
              <CalendarClock className="mr-2 h-4 w-4" /> Yes, reschedule
            </Button>
          </div>
        )}

        {mode === "reschedule" && (
          <div className="mt-4 space-y-3">
            <div className="field-stack">
              <Label className="text-2xs uppercase tracking-wide text-muted-foreground">New date</Label>
              <DrilldownDatePicker value={date} onChange={setDate} />
            </div>
            <div className="field-stack">
              <Label htmlFor="no-show-time" className="text-2xs uppercase tracking-wide text-muted-foreground">
                New time
              </Label>
              <div className="relative">
                <Clock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="no-show-time"
                  type="time"
                  step={300}
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-9 w-full rounded-xl border-input bg-background pl-[34px] pr-2 text-xs font-normal md:text-xs [&::-webkit-datetime-edit]:p-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:left-2 [&::-webkit-calendar-picker-indicator]:h-4 [&::-webkit-calendar-picker-indicator]:w-4 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2" data-slot="dialog-footer">
              <Button type="button" variant="outline" onClick={() => setMode("ask")}>
                Back
              </Button>
              <Button
                type="button"
                enterSubmit
                disabled={rebook.isPending}
                onClick={() =>
                  rebook.mutate({
                    data: {
                      id: a.id,
                      starts_at: new Date(`${date}T${time}`).toISOString(),
                      duration_minutes: duration,
                    },
                  })
                }
              >
                {rebook.isPending ? "Saving…" : "Confirm new appointment"}
              </Button>
            </div>
          </div>
        )}

        {mode === "task" && (
          <div className="mt-4 space-y-3">
            <div className="field-stack">
              <Label htmlFor="no-show-note" className="text-2xs uppercase tracking-wide text-muted-foreground">
                Task note
              </Label>
              <Textarea
                id="no-show-note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded-xl text-xs"
              />
              <p className="text-2xs text-muted-foreground">
                This appears in “My tasks” on the dashboard so the patient can be contacted by chat, phone or email.
              </p>
            </div>
            <div className="flex justify-end gap-2" data-slot="dialog-footer">
              <Button type="button" variant="outline" onClick={() => setMode("ask")}>
                Back
              </Button>
              <Button
                type="button"
                enterSubmit
                disabled={task.isPending}
                onClick={() =>
                  task.mutate({
                    data: {
                      patient_id: a.patient_id,
                      note,
                      recipients: a.practitioner_id
                        ? [{ id: a.practitioner_id, label: a.profiles?.full_name ?? "Practitioner" }]
                        : [],
                    },
                  })
                }
              >
                {task.isPending ? "Adding…" : "Add follow-up task"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}