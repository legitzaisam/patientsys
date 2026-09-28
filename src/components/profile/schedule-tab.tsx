import { useState } from "react";
import { yearMonthOf, type PatternRow, type TimeOffLike } from "@/lib/staff-schedule";
import { useStaffSchedule } from "./profile-helpers";
import { TimeOffCalendar } from "./time-off-calendar";
import { BankHolidaysCard, TimeOffRequestsCard, TimeOffSummaryCard } from "./time-off-cards";
import { WorkingPatternCard } from "./working-pattern-card";
import type {
  PatternRequestView,
  ProfileMode,
  ProfileSubject,
  ProfileViewer,
} from "./profile-types";

/** Schedule & time off: pattern and calendar on the left, totals, requests and bank holidays on the right. */
export function ScheduleTab({
  mode,
  subject,
  viewer,
  todayKey,
  pattern,
  patternRequest,
  timeOff,
  totals,
  hasSeparateManager,
  onTimeOff,
}: {
  mode: ProfileMode;
  subject: ProfileSubject;
  viewer: ProfileViewer;
  todayKey: string;
  pattern: PatternRow[];
  patternRequest: PatternRequestView | null;
  timeOff: TimeOffLike[];
  totals: { taken: number; booked: number; pending: number } | null;
  hasSeparateManager: boolean;
  onTimeOff: () => void;
}) {
  const current = yearMonthOf(todayKey);
  const [view, setView] = useState(current);
  // The page already holds this year's schedule; another year needs its own rows.
  const other = useStaffSchedule(
    subject.userId,
    mode,
    view.year !== current.year ? view.year : undefined,
  );
  const rows =
    view.year !== current.year ? ((other.data?.timeOff ?? []) as TimeOffLike[]) : timeOff;

  return (
    <div
      className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"
      data-qc="profile-schedule-tab"
    >
      <div className="flex min-w-0 flex-col gap-5">
        <WorkingPatternCard
          mode={mode}
          subject={subject}
          viewer={viewer}
          pattern={pattern}
          request={patternRequest}
          hasSeparateManager={hasSeparateManager}
        />
        <TimeOffCalendar
          year={view.year}
          month={view.month}
          onMonth={setView}
          pattern={pattern}
          timeOff={rows}
          todayKey={todayKey}
        />
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        {totals ? (
          <TimeOffSummaryCard
            mode={mode}
            year={current.year}
            totals={totals}
            onRequest={onTimeOff}
          />
        ) : null}
        <TimeOffRequestsCard
          mode={mode}
          subject={subject}
          rows={timeOff}
          patternRequest={patternRequest}
        />
        <BankHolidaysCard todayKey={todayKey} />
      </div>
    </div>
  );
}
