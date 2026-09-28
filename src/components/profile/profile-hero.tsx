import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StaffAvatar } from "@/components/staff-files";
import { cn } from "@/lib/utils";
import { heroChips, type HeroChip } from "./profile-helpers";
import type { ProfileMode, ProfileSubject, ProfileTabKey } from "./profile-types";

const CHIP_TONE: Record<HeroChip["tone"], string> = {
  warning: "bg-warning-bg text-warning-ink",
  success: "bg-success-bg text-success-ink",
  destructive: "bg-destructive-bg text-destructive-ink",
};

export function ProfileHero({
  mode,
  subject,
  todayKey,
  canEditPhoto,
  onTab,
  onInvoice,
  onTimeOff,
  treats,
}: {
  mode: ProfileMode;
  subject: ProfileSubject;
  todayKey: string;
  canEditPhoto: boolean;
  onTab: (tab: ProfileTabKey) => void;
  onInvoice: () => void;
  onTimeOff: () => void;
  treats: boolean;
}) {
  const chips = heroChips(subject, todayKey);
  const meta = [
    subject.jobTitle,
    subject.registrationBody && subject.registrationBody !== "None" && subject.registrationNumber
      ? `${subject.registrationBody} ${subject.registrationNumber}`
      : null,
    subject.workingArrangement,
  ].filter(Boolean);

  return (
    <Card
      className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-7"
      data-qc="profile-hero"
    >
      <StaffAvatar
        userId={subject.userId}
        fullName={subject.fullName || subject.email}
        avatarPath={subject.avatarPath}
        readOnly={!canEditPhoto}
        variant="badge"
        queryKey={mode === "self" ? ["my-profile"] : ["staff-profile", subject.userId]}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2
          className="text-[26px] font-semibold leading-tight tracking-[-0.016em] text-foreground"
          data-qc="profile-name"
        >
          {subject.fullName || subject.email}
        </h2>
        {meta.length > 0 ? (
          <p className="text-sm text-muted-foreground" data-qc="profile-meta">
            {meta.join(" · ")}
          </p>
        ) : null}
        {chips.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-2" data-qc="profile-chips">
            {chips.map((chip) =>
              chip.tab ? (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => onTab(chip.tab!)}
                  className={cn(
                    "inline-flex h-8 cursor-pointer items-center rounded-full px-3.5 text-xs font-semibold shadow-inset-hi transition-[filter] hover:brightness-[0.97]",
                    CHIP_TONE[chip.tone],
                  )}
                  data-qc={`profile-chip-${chip.id}`}
                >
                  {chip.label}
                </button>
              ) : (
                <span
                  key={chip.id}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full px-3.5 text-xs font-semibold shadow-inset-hi",
                    CHIP_TONE[chip.tone],
                  )}
                  data-qc={`profile-chip-${chip.id}`}
                >
                  {chip.label}
                </span>
              ),
            )}
          </div>
        ) : null}
      </div>
      {mode === "self" ? (
        <div className="flex shrink-0 flex-col gap-2.5 sm:w-[230px]">
          {treats ? (
            <Button
              size="lg"
              className="w-full font-semibold"
              onClick={onInvoice}
              data-qc="hero-invoice"
            >
              Create &amp; send invoice
            </Button>
          ) : null}
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={onTimeOff}
            data-qc="hero-time-off"
          >
            Request time off
          </Button>
        </div>
      ) : mode === "manage" && !subject.revoked ? (
        <div className="flex shrink-0 flex-col gap-2.5 sm:w-[230px]">
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={onTimeOff}
            data-qc="hero-time-off"
          >
            Add time off
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
