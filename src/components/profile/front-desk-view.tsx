import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCatalogue, listPatients, listPractitioners } from "@/lib/clinic.functions";
import { timeOffLabel } from "@/lib/staff-schedule";
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

/**
 * What everyone outside the management tier sees of a colleague: who they
 * are, whether they can be booked, what for, and when. No registration
 * numbers, insurance, earnings or documents.
 */
export function FrontDeskView({ subject, treats }: { subject: ProfileSubject; treats: boolean }) {
  const [booking, setBooking] = useState(false);
  const fetchPatients = useServerFn(listPatients);
  const fetchPractitioners = useServerFn(listPractitioners);
  const fetchCatalogue = useServerFn(getCatalogue);
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
        </div>
        {treats && !subject.revoked ? (
          <QuickAddAppointment
            patients={(patients ?? []) as never[]}
            practitioners={(practitioners ?? []) as never[]}
            catalogue={(catalogue ?? []) as never[]}
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
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card className="flex flex-col gap-3 p-6" data-qc="frontdesk-bookable">
          <h3 className="text-lg font-semibold text-foreground">Can be booked for</h3>
          {subject.bookable.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {subject.bookable.map((b) => (
                <span
                  key={b.catalogueId}
                  className="rounded-full bg-glass-2 px-3.5 py-2 text-sm text-foreground shadow-inset-hi"
                  data-qc="bookable-chip"
                >
                  {b.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {treats
                ? "No treatments set yet — ask a manager to choose what the front desk can book."
                : `${first} does not take patient bookings.`}
            </p>
          )}
          {subject.email ? (
            <p className="text-[13px] text-muted-foreground">Work email: {subject.email}</p>
          ) : null}
        </Card>

        <Card className="flex flex-col gap-2.5 p-6" data-qc="frontdesk-hours">
          <h3 className="text-lg font-semibold text-foreground">Hours &amp; unavailable</h3>
          <p className="text-sm leading-relaxed text-foreground" data-qc="frontdesk-pattern">
            {subject.patternSummary}
          </p>
          {subject.upcomingUnavailable.length === 0 ? (
            <p className="border-t border-edge-2 pt-2.5 text-sm text-muted-foreground">
              Nothing booked off in the weeks ahead.
            </p>
          ) : (
            subject.upcomingUnavailable.map((u) => (
              <div
                key={`${u.starts_on}-${u.ends_on}`}
                className="flex justify-between gap-3 border-t border-edge-2 py-2.5 text-sm"
                data-qc="frontdesk-unavailable"
              >
                <span className="font-semibold text-foreground">{timeOffLabel(u)}</span>
                <span className="text-muted-foreground">Unavailable</span>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}
