import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarClock, ChevronRight, MessageSquare } from "lucide-react";
import { useOpenTeamChat } from "@/components/floating-dock/dock-context";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { StaffAlertDialog } from "@/components/staff-alert-dialog";
import { getPractitionerDay } from "@/lib/clinic.functions";
import { initialsOf, laneFor } from "@/lib/practitioner-colours";
import { cn } from "@/lib/utils";

const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const CARD_CLASS = "relative w-[18.5rem] overflow-hidden rounded-[22px] border-edge p-0 shadow-popover";

type CardProps = {
  practitionerId: string;
  name: string;
  date: string;
  children: ReactNode;
};

/** Hover a practitioner's name/avatar to see today's availability, urgent notes and a message action. */
export function PractitionerHoverCard({ practitionerId, name, date, children }: CardProps) {
  const [open, setOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const openTeamChat = useOpenTeamChat();
  const lane = laneFor(practitionerId);

  return (
    <>
      <HoverCard open={open} onOpenChange={setOpen} openDelay={120} closeDelay={140}>
        <HoverCardTrigger asChild>{children}</HoverCardTrigger>
        <HoverCardContent
          side="bottom"
          align="start"
          sideOffset={10}
          avoidCollisions={false}
          sticky="always"
          hideWhenDetached={false}
          style={lane.style}
          className={CARD_CLASS}
        >
          <PractitionerDayCard
            practitionerId={practitionerId}
            name={name}
            date={date}
            enabled={open}
            onMessage={() => {
              setOpen(false);
              setMessageOpen(true);
            }}
            onOpenAlert={(alertId) => {
              setOpen(false);
              openTeamChat({ userId: practitionerId, name, focusAlertId: alertId });
            }}
          />
        </HoverCardContent>
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

/** Put inside `PractitionerPressCard`'s children: the element that opens the card when pressed. */
export const PractitionerPressTrigger = PopoverTrigger;

/**
 * The same card, opened by pressing a `PractitionerPressTrigger` rather than hovering. The card is
 * placed against `children` (for example a whole sidebar row), not the small trigger inside it.
 */
export function PractitionerPressCard({
  practitionerId,
  name,
  date,
  children,
  side = "right",
}: CardProps & { side?: "top" | "right" | "bottom" | "left" }) {
  const [open, setOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const openTeamChat = useOpenTeamChat();
  const lane = laneFor(practitionerId);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>{children}</PopoverAnchor>
        <PopoverContent
          side={side}
          align="start"
          sideOffset={20}
          collisionPadding={12}
          style={lane.style}
          className={CARD_CLASS}
          data-qc="team-member-card"
        >
          <PractitionerDayCard
            practitionerId={practitionerId}
            name={name}
            date={date}
            enabled={open}
            onMessage={() => {
              setOpen(false);
              setMessageOpen(true);
            }}
            onOpenAlert={(alertId) => {
              setOpen(false);
              openTeamChat({ userId: practitionerId, name, focusAlertId: alertId });
            }}
          />
        </PopoverContent>
      </Popover>
      <StaffAlertDialog
        open={messageOpen}
        onOpenChange={setMessageOpen}
        recipientId={practitionerId}
        recipientName={name}
      />
    </>
  );
}

function PractitionerDayCard({
  practitionerId,
  name,
  date,
  enabled,
  onMessage,
  onOpenAlert,
}: {
  practitionerId: string;
  name: string;
  date: string;
  enabled: boolean;
  onMessage: () => void;
  onOpenAlert: (alertId: string) => void;
}) {
  const fetchDay = useServerFn(getPractitionerDay);
  const lane = laneFor(practitionerId);
  const initials = initialsOf(name) || "?";

  const { data, isFetching } = useQuery({
    queryKey: ["practitioner-day", practitionerId, date],
    queryFn: () => fetchDay({ data: { practitionerId, date } }),
    enabled,
    staleTime: 60_000,
  });

  const bookedCount = data?.bookedCount ?? 0;
  const freeSlots = data?.free ?? [];
  const alerts = data?.alerts ?? [];

  return (
    <>
      {/* Soft lane wash + sheen — glass first, diary colour as a hint. */}
      <div className={cn("pointer-events-none absolute inset-0 opacity-55", lane.softBg)} aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--sheen)] via-transparent to-transparent"
        aria-hidden
      />

      <div className="relative px-4 pb-3.5 pt-3.5">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-2xs font-semibold tracking-wide shadow-inset-hi",
              lane.border,
              lane.bg,
              lane.text,
            )}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <Link
              to="/team/$id"
              search={{}}
              params={{ id: practitionerId }}
              className="block truncate text-sm font-semibold tracking-[-0.012em] text-foreground transition-colors hover:text-accent-ink"
            >
              {name}
            </Link>
            <p className="mt-0.5 text-2xs text-muted-foreground">
              {isFetching && !data ? "Loading today’s diary…" : "Today’s availability"}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-edge bg-glass-2 px-2 py-0.5 text-2xs font-semibold tabular-nums text-foreground shadow-inset-hi">
            {bookedCount} booked
          </span>
        </div>

        <div className="mt-3.5 rounded-[16px] border border-edge bg-glass-2/90 p-2.5 shadow-inset-hi">
          <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.04em] text-ink-3">
            <CalendarClock className={cn("h-3.5 w-3.5", lane.text)} />
            Free today
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {freeSlots.length ? (
              freeSlots.map((f) => (
                <span
                  key={`${f.from}-${f.to}`}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-2xs font-medium tabular-nums shadow-inset-hi",
                    lane.border,
                    "bg-glass text-foreground",
                  )}
                >
                  {hhmm(f.from)}–{hhmm(f.to)}
                </span>
              ))
            ) : (
              <span className="text-2xs text-muted-foreground">
                {data ? "No free slots left today" : "—"}
              </span>
            )}
          </div>
        </div>

        {alerts.length ? (
          <div className="mt-2.5 rounded-[16px] border border-destructive/25 bg-destructive-bg/80 p-2.5">
            <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.04em] text-destructive-ink">
              <AlertTriangle className="h-3.5 w-3.5" />
              Urgent
            </p>
            <ul className="mt-1.5 space-y-1">
              {alerts.map((a) => {
                const text = (
                  <>
                    <span className="font-semibold">{a.title}</span>
                    {a.body ? <span className="text-muted-foreground"> — {a.body}</span> : null}
                  </>
                );
                if (!a.forMe) {
                  return (
                    <li key={a.id} className="px-1.5 py-1 text-2xs leading-snug text-foreground">
                      {text}
                    </li>
                  );
                }
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      data-qc="day-card-alert"
                      onClick={() => onOpenAlert(a.id)}
                      className="group flex w-full cursor-pointer items-start gap-1.5 rounded-[11px] px-1.5 py-1 text-left text-2xs leading-snug text-foreground transition-colors hover:bg-[rgba(47,63,102,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Open alert: ${a.title}${a.acknowledged ? " (acknowledged)" : ""}`}
                    >
                      <span className="min-w-0 flex-1">{text}</span>
                      <span
                        className={cn(
                          "mt-px inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-semibold",
                          a.acknowledged
                            ? "bg-glass-2 text-ink-3"
                            : "bg-destructive/10 text-destructive-ink group-hover:bg-destructive/15",
                        )}
                      >
                        {a.acknowledged ? "Seen" : "Open"}
                        <ChevronRight className="h-3 w-3" aria-hidden />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <Button
          size="sm"
          className="mt-3.5 h-9 w-full rounded-full border border-accent-line bg-accent-soft font-semibold text-accent-ink shadow-inset-hi hover:brightness-[0.97]"
          onClick={onMessage}
        >
          <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
          Send message
        </Button>
      </div>
    </>
  );
}
