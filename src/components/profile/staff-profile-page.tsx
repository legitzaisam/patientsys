import { useMemo, useState } from "react";
import { clinicDayKey } from "@/lib/clinic-time";
import { ESSENTIAL_DOC_CATEGORIES } from "@/lib/staff-doc-compliance";
import type { TimeOffLike } from "@/lib/staff-schedule";
import { Card } from "@/components/ui/card";
import { EffectivePermissions } from "@/components/effective-permissions";
import { SecuritySettings } from "@/components/security-settings";
import { DocumentsTab } from "./documents-tab";
import { EarningsTab } from "./earnings-tab";
import { FrontDeskView } from "./front-desk-view";
import { InvoiceDialog } from "./invoice-dialog";
import { ProfileHero } from "./profile-hero";
import { ScheduleTab } from "./schedule-tab";
import { TimeOffSheet } from "./time-off-sheet";
import { ProfileTabs, type ProfileTabDef } from "./profile-tabs";
import { PersonalDetailsCard } from "./personal-details-card";
import { RegistrationInsuranceCard } from "./registration-insurance-card";
import { QualificationsCard } from "./qualifications-card";
import { DocumentsSummaryCard, MonthSoFarCard, YourWeekCard } from "./overview-side-cards";
import { useStaffSchedule } from "./profile-helpers";
import type {
  PatternRequestView,
  ProfileMode,
  ProfileSubject,
  ProfileTabKey,
  ProfileViewer,
} from "./profile-types";

/**
 * The staff profile in its three modes. The route decides the mode and hands
 * in the subject it loaded; every card fetches what else it needs.
 */
export function StaffProfilePage({
  mode,
  subject,
  viewer,
  hasSeparateManager,
  tab,
  onTabChange,
}: {
  mode: ProfileMode;
  subject: ProfileSubject;
  viewer: ProfileViewer;
  hasSeparateManager: boolean;
  tab: ProfileTabKey;
  onTabChange: (tab: ProfileTabKey) => void;
}) {
  const todayKey = useMemo(() => clinicDayKey(), []);
  const schedule = useStaffSchedule(subject.userId, mode);
  const pattern = schedule.data?.pattern ?? subject.pattern;
  const timeOff = (schedule.data?.timeOff ?? []) as TimeOffLike[];
  const [invoice, setInvoice] = useState<{
    open: boolean;
    period?: { year: number; month: number } | undefined;
  }>({ open: false });

  const missingDocs = ESSENTIAL_DOC_CATEGORIES.filter(
    (c) => !subject.presentCategories.includes(c.value),
  ).length;
  const onFile = ESSENTIAL_DOC_CATEGORIES.length - missingDocs;

  const showEarnings = viewer.treats && (mode === "self" || viewer.canCommission);
  // Raising an invoice: your own page, or a colleague's when you hold Set staff commission.
  const canInvoice = showEarnings && !subject.revoked;
  const tabs: ProfileTabDef[] = [
    { key: "overview", label: "Overview" },
    ...(showEarnings ? [{ key: "earnings" as const, label: "Performance & earnings" }] : []),
    { key: "schedule", label: "Schedule & time off" },
    {
      key: "documents",
      label: "Documents",
      badge: missingDocs > 0 ? `${onFile}/${ESSENTIAL_DOC_CATEGORIES.length}` : null,
    },
    ...(mode === "self" ? [{ key: "security" as const, label: "Security" }] : []),
    ...(mode === "manage" && subject.capabilities
      ? [{ key: "access" as const, label: "Access" }]
      : []),
  ];
  const active = tabs.some((t) => t.key === tab) ? tab : "overview";

  const openInvoice = (period?: { year: number; month: number }) =>
    setInvoice({ open: true, period });
  const [timeOffOpen, setTimeOffOpen] = useState(false);
  const openTimeOff = () => setTimeOffOpen(true);

  if (mode === "frontdesk") {
    return <FrontDeskView subject={subject} treats={viewer.treats} />;
  }

  return (
    <div className="flex flex-col gap-5" data-qc={`profile-page-${mode}`}>
      <ProfileHero
        mode={mode}
        subject={subject}
        todayKey={todayKey}
        canEditPhoto={!subject.revoked}
        onTab={onTabChange}
        onInvoice={() => openInvoice()}
        onTimeOff={openTimeOff}
        treats={viewer.treats}
        canInvoice={canInvoice}
      />
      <ProfileTabs tabs={tabs} value={active} onChange={onTabChange} />

      {active === "overview" ? (
        <div
          className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
          data-qc="profile-overview"
        >
          <div className="flex min-w-0 flex-col gap-6">
            <PersonalDetailsCard
              mode={mode}
              subject={subject}
              viewer={viewer}
              hasSeparateManager={hasSeparateManager}
            />
            <RegistrationInsuranceCard
              mode={mode}
              subject={subject}
              viewer={viewer}
              todayKey={todayKey}
            />
            <QualificationsCard mode={mode} subject={subject} canEditBookable={mode === "manage"} />
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            {showEarnings ? (
              <MonthSoFarCard
                mode={mode}
                subject={subject}
                todayKey={todayKey}
                onTab={onTabChange}
                onInvoice={() => openInvoice()}
                canInvoice={canInvoice}
              />
            ) : null}
            <YourWeekCard
              mode={mode}
              subject={subject}
              todayKey={todayKey}
              pattern={pattern}
              timeOff={timeOff}
              onTab={onTabChange}
              onTimeOff={openTimeOff}
            />
            <DocumentsSummaryCard mode={mode} subject={subject} onTab={onTabChange} />
          </div>
        </div>
      ) : null}

      {active === "earnings" ? (
        <EarningsTab
          mode={mode}
          subject={subject}
          todayKey={todayKey}
          onInvoice={openInvoice}
          canInvoice={canInvoice}
        />
      ) : null}

      {active === "schedule" ? (
        <ScheduleTab
          mode={mode}
          subject={subject}
          viewer={viewer}
          todayKey={todayKey}
          pattern={pattern}
          patternRequest={
            (schedule.data as { patternRequest?: PatternRequestView | null } | undefined)
              ?.patternRequest ?? null
          }
          timeOff={timeOff}
          totals={schedule.data?.totals ?? null}
          hasSeparateManager={hasSeparateManager}
          onTimeOff={openTimeOff}
        />
      ) : null}

      {active === "documents" ? (
        <DocumentsTab mode={mode} subject={subject} todayKey={todayKey} />
      ) : null}

      {active === "security" && mode === "self" ? (
        <Card className="overflow-hidden p-0" data-qc="profile-security-tab">
          <SecuritySettings
            identity={{
              ...(viewer.email ? { email: viewer.email } : {}),
              ...(viewer.mfaRequired !== undefined ? { mfaRequired: viewer.mfaRequired } : {}),
            }}
            embedded
          />
        </Card>
      ) : null}

      {active === "access" && subject.capabilities ? (
        <EffectivePermissions capabilities={subject.capabilities} name={subject.fullName} />
      ) : null}

      <TimeOffSheet
        open={timeOffOpen}
        onOpenChange={setTimeOffOpen}
        mode={mode}
        subject={subject}
        pattern={pattern}
        todayKey={todayKey}
        hasSeparateManager={hasSeparateManager}
      />

      {canInvoice ? (
        <InvoiceDialog
          open={invoice.open}
          onOpenChange={(open) => setInvoice((s) => ({ ...s, open }))}
          mode={mode}
          subject={subject}
          todayKey={todayKey}
          initial={invoice.period}
        />
      ) : null}
    </div>
  );
}
