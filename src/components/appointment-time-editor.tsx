import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { rescheduleAppointment } from "@/lib/clinic.functions";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DrilldownDatePicker } from "@/components/drilldown-date-picker";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

/** Hover a booking's time to nudge or fully re-time the appointment. */
export function AppointmentTimeEditor({
  appointment: a,
  invalidateKeys = [["appointments"], ["dashboard"]],
  children,
}: {
  appointment: any;
  invalidateKeys?: string[][];
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(() => toLocalInput(a.starts_at));
  const duration = Math.max(
    5,
    Math.round((new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000) || 30,
  );
  const [minutes, setMinutes] = useState(duration);
  const datePart = value.split("T")[0] ?? "";
  const timePart = value.split("T")[1] ?? "09:00";

  const move = useMutation({
    mutationFn: useServerFn(rescheduleAppointment),
    onSuccess: () => {
      toast.success("Appointment time updated");
      invalidateKeys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = (nextValue = value, nextMinutes = minutes) =>
    move.mutate({ data: { id: a.id, starts_at: new Date(nextValue).toISOString(), duration_minutes: nextMinutes } });

  const nudge = (delta: number) => {
    const next = toLocalInput(new Date(new Date(value).getTime() + delta * 60000).toISOString());
    setValue(next);
    save(next);
  };

  return (
    <HoverCard openDelay={150} closeDelay={120}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent align="start" className="w-72 rounded-2xl p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Clock className="h-3.5 w-3.5 text-accent-ink" /> Change appointment time
        </p>
        <div className="mt-3 space-y-2">
          <Label htmlFor={`date-${a.id}`} className="text-2xs uppercase tracking-wide text-muted-foreground">
            Date
          </Label>
          <DrilldownDatePicker
            id={`date-${a.id}`}
            value={datePart}
            onChange={(d) => setValue(`${d}T${timePart}`)}
          />
          <Label htmlFor={`time-${a.id}`} className="text-2xs uppercase tracking-wide text-muted-foreground">
            Time
          </Label>
          <Input
            id={`time-${a.id}`}
            type="time"
            step={300}
            value={timePart}
            onChange={(e) => setValue(`${datePart}T${e.target.value}`)}
            className="h-9 rounded-xl text-xs"
          />
          <Label htmlFor={`dur-${a.id}`} className="text-2xs uppercase tracking-wide text-muted-foreground">
            Duration (minutes)
          </Label>
          <Input
            id={`dur-${a.id}`}
            type="number"
            min={5}
            step={5}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="h-9 rounded-xl text-xs"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[-30, -15, 15, 30].map((d) => (
            <Button
              key={d}
              size="sm"
              variant="secondary"
              className="h-7 px-2.5 text-2xs"
              disabled={move.isPending}
              onClick={() => nudge(d)}
            >
              {d > 0 ? `+${d}` : d} min
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          className="mt-3 w-full "
          disabled={move.isPending}
          onClick={() => save()}
        >
          {move.isPending ? "Saving…" : "Save new time"}
        </Button>
      </HoverCardContent>
    </HoverCard>
  );
}
