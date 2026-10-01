import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, MessageSquare } from "lucide-react";
import { useOpenTeamChat } from "@/components/floating-dock/dock-context";
import {
  getCatalogue,
  getPractitionerDay,
  listPatients,
  listPractitioners,
} from "@/lib/clinic.functions";
import { clinicDayKey } from "@/lib/clinic-time";
import { toneForTreatment } from "@/lib/practitioner-colours";
import { timeOffLabel } from "@/lib/staff-schedule";
import { useTreatmentColours } from "@/lib/use-treatment-colours";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QuickAddAppointment } from "@/components/quick-add-appointment";
import { StaffAvatar } from "@/components/staff-files";
import { isPrescriber } from "./profile-helpers";
import type { ProfileSubject } from "./profile-types";

function firstName(fullName: string) {
  return fullName.replace(/^(Dr|Mr|Mrs|Ms|Miss|Mx|Prof)\.?\s+/i, "").split(" ")[0] ?? fullName;
}

const hhmm = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

const GHOST_BTN =
  "border border-edge bg-[rgba(47,63,102,0.08)] shadow-inset-hi hover:border-edge-2 hover:bg-[rgba(47,63,102,0.12)]";

function WorkEmailChip({ email }: { email: string }) {
  return (
    <a
      href={`mailto:${email}`}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium text-foreground transition-colors",
        GHOST_BTN,
      )}
      data-qc="frontdesk-email"
    >
      <Mail className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-hidden />
      <span className="truncate">{email}</span>
    </a>
  );
}

/**
 * What everyone outside the management tier sees of a colleague: who they
 * are, whether they can be booked, what for, and when. No registration
 * numbers, insurance, earnings or documents.
 */
export function FrontDeskView({ subject, treats }: { subject: ProfileSubject; treats: boolean }) {
  const [booking, setBooking] = useState(false);
  const openTeamChat = useOpenTeamChat();
  const todayKey = clinicDayKey();
  const fetchPatients = useServerFn(listPatients);
  const fetchPractitioners = useServerFn(listPractitioners);
  const fetchCatalogue = useServerFn(getCatalogue);
  const fetchDay = useServerFn(getPractitionerDay);
  const { data: patients } = useQuery({
    queryKey: ["patients"],
    queryFn: () => fetchPatients(),
    enabled: treats,
  });
  const { data: practitioners } = useQuery({
    queryKey: ["practitioners"],
    queryFn: () => fetchPractitioners(),
    enabled: treats,
  });
  const { data: catalogue } = useQuery({
    queryKey: ["catalogue"],
    queryFn: () => fetchCatalogue(),
    enabled: treats,
  });
  const { data: day, isFetching: dayLoading } = useQuery({
    queryKey: ["practitioner-day", subject.userId, todayKey],
    queryFn: () => fetchDay({ data: { practitionerId: subject.userId, date: todayKey } }),
    staleTime: 60_000,
  });
  const colours = useTreatmentColours();
  const freeSlots = day?.free ?? [];

  // "Book with" offers only what the manager tagged under Can be booked for.
  // With nothing tagged yet the full list stays, so the front desk is not stuck.
  const bookableIds = new Set(subject.bookable.map((b) => b.catalogueId));
  const bookableCatalogue =
    bookableIds.size > 0
      ? ((catalogue ?? []) as { id: string }[]).filter((c) => bookableIds.has(c.id))
      : ((catalogue ?? []) as { id: string }[]);

  const first = firstName(subject.fullName);
  const compliance = subject.compliance;
  const cleared = compliance?.tone === "ok";

  return (
    <div className="flex flex-col gap-5" data-qc="profile-page-frontdesk">
      <Card className="flex flex-wrap items-center gap-5 p-6" data-qc="frontdesk-hero">
        <StaffAvatar
          userId={subject.userId}
          fullName={subject.fullName || subject.email}
          avatarPath={subject.avatarPath}
          readOnly
          variant="badge"
          size="sm"
          queryKey={["staff-profile", subject.userId]}
        />
        <div className="min-w-0 flex-1">
          <h2
            className="text-2xl font-semibold tracking-[-0.01em] text-foreground"
            data-qc="profile-name"
          >
            {subject.fullName}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {subject.jobTitle ? <span>{subject.jobTitle}</span> : null}
            {isPrescriber(subject) ? (
              <span
                className="rounded-full bg-foreground px-2.5 py-0.5 text-xs font-bold text-background"
                data-qc="frontdesk-prescriber"
              >
                Prescriber
              </span>
            ) : null}
            {compliance ? (
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-bold",
                  cleared
                    ? "bg-success-bg text-success-ink"
                    : compliance.tone === "bad"
                      ? "bg-destructive-bg text-destructive-ink"
                      : "bg-accent-soft text-accent-ink",
                )}
                data-qc="frontdesk-compliance"
                data-tone={compliance.tone}
              >
                {cleared ? "Cleared to practise" : compliance.label}
              </span>
            ) : null}
          </div>
          {subject.email ? (
            <div className="mt-2">
              <WorkEmailChip email={subject.email} />
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {treats && !subject.revoked ? (
            <QuickAddAppointment
              patients={(patients ?? []) as never[]}
              practitioners={(practitioners ?? []) as never[]}
              catalogue={bookableCatalogue as never[]}
              date={new Date()}
              defaultPractitionerId={subject.userId}
              open={booking}
              onOpenChange={setBooking}
              title={`Book with ${first}`}
              align="end"
            >
              <Button type="button" className="h-11 px-5 font-semibold" data-qc="frontdesk-book">
                Book with {first}
              </Button>
            </QuickAddAppointment>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className={cn("h-11 px-5 font-semibold", GHOST_BTN)}
            data-qc="frontdesk-message"
            onClick={() => openTeamChat({ userId: subject.userId, name: subject.fullName })}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Message
          </Button>
        </div>
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="flex flex-col gap-3 p-6" data-qc="frontdesk-bookable">
          <h3 className="text-lg font-semibold text-foreground">Can be booked for</h3>
          {subject.bookable.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {subject.bookable.map((b) => {
                // Same colour the treatment wears in the diary (Settings → Treatments).
                const tone = toneForTreatment(b.name, colours);
                return (
                  <span
                    key={b.catalogueId}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold shadow-inset-hi",
                      tone.softBg,
                      tone.text,
                    )}
                    style={tone.style}
                    data-qc="bookable-chip"
                  >
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)} aria-hidden />
                    {b.name}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {treats
                ? "No treatments set yet — ask a manager to choose what the front desk can book."
                : `${first} does not take patient bookings.`}
            </p>
          )}
        </Card>

        <Card className="flex flex-col gap-0 p-6" data-qc="frontdesk-hours">
          <section>
            <h3 className="text-sm font-semibold text-foreground">Free today</h3>
            <div className="mt-2 flex flex-wrap gap-1.5" data-qc="frontdesk-free-today">
              {freeSlots.length ? (
                freeSlots.map((f) => (
                  <span
                    key={`${f.from}-${f.to}`}
                    className="rounded-full border border-edge bg-glass-2 px-2.5 py-0.5 text-xs font-medium tabular-nums text-foreground shadow-inset-hi"
                  >
                    {hhmm(f.from)}–{hhmm(f.to)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">
                  {dayLoading && !day ? "Loading today’s diary…" : "No free slots left today"}
                </span>
              )}
            </div>
          </section>

          <section className="mt-3.5 border-t border-edge-2 pt-3.5">
            <h3 className="text-sm font-semibold text-foreground">Hours</h3>
            <p
              className="mt-1.5 text-sm leading-relaxed text-foreground"
              data-qc="frontdesk-pattern"
            >
              {subject.patternSummary}
            </p>
          </section>

          <section className="mt-3.5 border-t border-edge-2 pt-3.5">
            <h3 className="text-sm font-semibold text-foreground">Time off</h3>
            {subject.upcomingUnavailable.length === 0 ? (
              <p className="mt-1.5 text-sm text-muted-foreground">
                Nothing booked off in the weeks ahead.
              </p>
            ) : (
              <ul className="mt-1.5 flex flex-col">
                {subject.upcomingUnavailable.map((u) => (
                  <li
                    key={`${u.starts_on}-${u.ends_on}`}
                    className="py-1 text-sm font-semibold text-foreground"
                    data-qc="frontdesk-unavailable"
                  >
                    {timeOffLabel(u)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Card>
      </div>
    </div>
  );
}
