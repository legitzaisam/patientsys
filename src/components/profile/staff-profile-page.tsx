import { useMemo, useState } from "react";
import { clinicDayKey } from "@/lib/clinic-time";
import { ESSENTIAL_DOC_CATEGORIES } from "@/lib/staff-doc-compliance";
import type { TimeOffLike } from "@/lib/staff-schedule";
import { Card } from "@/components/ui/card";
import { EffectivePermissions } from "@/components/effective-permissions";
import { SecuritySettings } from "@/components/security-settings";
import { StaffDocuments } from "@/components/staff-files";
import { EarningsTab } from "./earnings-tab";
import { InvoiceDialog } from "./invoice-dialog";
import { ProfileHero } from "./profile-hero";
import { ProfileTabs, type ProfileTabDef } from "./profile-tabs";
import { PersonalDetailsCard } from "./personal-details-card";
import { RegistrationInsuranceCard } from "./registration-insurance-card";
import { QualificationsCard } from "./qualifications-card";
import { DocumentsSummaryCard, MonthSoFarCard, YourWeekCard } from "./overview-side-cards";
import { useStaffSchedule } from "./profile-helpers";
import type { ProfileMode, ProfileSubject, ProfileTabKey, ProfileViewer } from "./profile-types";

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
  // Until Phase 8 lands the time-off sheet, the hero action opens the Schedule tab.
  const openTimeOff = () => onTabChange("schedule");

  return (
    <div className="flex flex-col gap-5" data-qc={`profile-page-${mode}`}>
      <ProfileHero
        mode={mode}
        subject={subject}
        todayKey={todayKey}
        canEditPhoto={mode !== "frontdesk" && !subject.revoked}
        onTab={onTabChange}
        onInvoice={() => openInvoice()}
        onTimeOff={openTimeOff}
        treats={viewer.treats}
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
        <EarningsTab mode={mode} subject={subject} todayKey={todayKey} onInvoice={openInvoice} />
      ) : null}

      {active === "schedule" ? (
        <Card className="p-6" data-qc="profile-schedule-tab">
          <h2 className="section-title">Schedule &amp; time off</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {subject.patternSummary}
            {schedule.data?.totals
              ? ` · ${schedule.data.totals.taken} taken, ${schedule.data.totals.booked} booked, ${schedule.data.totals.pending} pending this year`
              : ""}
          </p>
        </Card>
      ) : null}

      {active === "documents" ? (
        <Card className="overflow-hidden p-0" data-qc="profile-documents-tab">
          <div className="px-5 py-5 sm:px-6">
            <StaffDocuments
              userId={subject.userId}
              readOnly={mode !== "self"}
              {...(mode === "self" ? {} : { queryKey: ["staff-documents", subject.userId] })}
              embedded
            />
          </div>
        </Card>
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

      {mode === "self" && viewer.treats ? (
        <InvoiceDialog
          open={invoice.open}
          onOpenChange={(open) => setInvoice((s) => ({ ...s, open }))}
          subject={subject}
          todayKey={todayKey}
          initial={invoice.period}
        />
      ) : null}
    </div>
  );
}
