import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarClock, MessageSquare } from "lucide-react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Button } from "@/components/ui/button";
import { StaffAlertDialog } from "@/components/staff-alert-dialog";
import { getPractitionerDay } from "@/lib/clinic.functions";
import { laneFor } from "@/lib/practitioner-colours";

const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Hover a practitioner's name/avatar to see today's availability, urgent notes and a message action. */
export function PractitionerHoverCard({
  practitionerId,
  name,
  date,
  children,
}: {
  practitionerId: string;
  name: string;
  date: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const fetchDay = useServerFn(getPractitionerDay);
  const lane = laneFor(practitionerId);

  const { data } = useQuery({
    queryKey: ["practitioner-day", practitionerId, date],
    queryFn: () => fetchDay({ data: { practitionerId, date } }),
    enabled: open,
    staleTime: 60_000,
  });

  return (
    <>
      <HoverCard open={open} onOpenChange={setOpen} openDelay={120} closeDelay={140}>
        <HoverCardTrigger asChild>{children}</HoverCardTrigger>
        <HoverCardPrimitive.Portal>
        <HoverCardContent
          side="bottom"
          align="start"
          sideOffset={8}
          avoidCollisions={false}
          sticky="always"
          hideWhenDetached={false}
          className={`w-72 rounded-2xl border-glass-line p-3 shadow-lg backdrop-blur-md bg-glass ${lane.softBg}`}
        >
          <div className="flex items-center justify-between gap-2">
            <Link
              to="/team/$id" search={{}}
              params={{ id: practitionerId }}
              className={`truncate text-sm font-semibold hover:underline ${lane.text}`}
            >
              {name}
            </Link>
            <span className="shrink-0 rounded-full bg-glass px-2 py-0.5 text-2xs tabular-nums text-muted-foreground">
              {data?.bookedCount ?? 0} booked
            </span>
          </div>

          <div className="mt-3 rounded-xl bg-glass p-2">
            <p className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" /> Free today
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {data?.free?.length ? (
                data.free.map((f) => (
                  <span
                    key={`${f.from}-${f.to}`}
                    className="rounded-full bg-glass-2 px-2 py-0.5 text-2xs tabular-nums text-foreground"
                  >
                    {hhmm(f.from)}–{hhmm(f.to)}
                  </span>
                ))
              ) : (
                <span className="text-2xs text-muted-foreground">No free slots</span>
              )}
            </div>
          </div>

          {data?.alerts?.length ? (
            <div className="mt-2 rounded-xl border border-edge bg-destructive-bg p-2">
              <p className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-wide text-destructive">
                <AlertTriangle className="h-3.5 w-3.5" /> Urgent
              </p>
              <ul className="mt-1 space-y-1">
                {data.alerts.map((a) => (
                  <li key={a.id} className="text-2xs leading-snug text-foreground">
                    <span className="font-semibold">{a.title}</span>
                    {a.body ? <span className="text-muted-foreground"> — {a.body}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Button
            size="sm"
            variant="secondary"
            className="mt-3 w-full rounded-full"
            onClick={() => {
              setOpen(false);
              setMessageOpen(true);
            }}
          >
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Send message
          </Button>
        </HoverCardContent>
        </HoverCardPrimitive.Portal>
      </HoverCard>
      <StaffAlertDialog
        open={messageOpen}
        onOpenChange={setMessageOpen}
        recipientId={practitionerId}
        recipientName={name}
      />
    </>
  );
}
