import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  accessSummary,
  EffectivePermissions,
  type EffectiveCapabilities,
} from "@/components/effective-permissions";
import { StaffDocuments } from "@/components/staff-files";
import { StaffDocCompliance } from "@/components/staff-doc-compliance";
import { PractitionerEarnings } from "@/components/earnings/practitioner-earnings";
import { CURRENT_YEAR, PeriodPicker, type PeriodSelection } from "@/components/period-picker";
import { cn } from "@/lib/utils";

type Tab = "access" | "documents" | "performance";
type IdentityLike = { isOwner?: boolean; isManager?: boolean; permissions?: string[] } | null | undefined;

export function StaffRecordTabs({
  name,
  capabilities,
  userId,
  canViewDocuments,
  presentCategories,
  identity,
  role,
}: {
  name: string;
  capabilities?: EffectiveCapabilities;
  userId: string;
  canViewDocuments: boolean;
  presentCategories: string[];
  identity: IdentityLike;
  role: string;
}) {
  const canViewPerformance =
    Boolean(identity?.isOwner || identity?.isManager) &&
    (role === "practitioner" || role === "owner");
  const [tab, setTab] = useState<Tab | null>(null);
  const currentTab: Tab = tab ?? (canViewPerformance ? "performance" : "access");
  const [onFile, setOnFile] = useState(0);
  const [period, setPeriod] = useState<PeriodSelection>(CURRENT_YEAR);

  const tabs = (
    [
      ...(canViewPerformance ? [{ key: "performance", label: "Performance" } as const] : []),
      { key: "access", label: "Access" },
      { key: "documents", label: "Documents" },
    ] as const
  );

  const hint =
    currentTab === "access"
      ? capabilities
        ? accessSummary(capabilities)
        : "What this person can do in the clinic."
      : currentTab === "documents"
        ? canViewDocuments
          ? "Records held on file for JCCP and UK clinic practice. Managers can open but not edit these."
          : "Status only — file contents stay private to the team member and clinic owners."
        : "Their share of the treatments they delivered.";

  return (
    <section>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="section-title">
              {currentTab === "access"
                ? `What ${name} can do`
                : currentTab === "documents"
                  ? "Documents"
                  : "Performance"}
            </h2>
            {currentTab === "documents" && canViewDocuments ? (
              <Badge variant="outline" className="rounded-xl text-2xs uppercase">
                {onFile} on file
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {currentTab === "performance" ? <PeriodPicker value={period} onChange={setPeriod} /> : null}
        <div
          role="tablist"
          aria-label="Staff record"
          className="flex h-[34px] shrink-0 items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi"
        >
          {tabs.map((o) => (
            <button
              key={o.key}
              type="button"
              role="tab"
              aria-selected={currentTab === o.key}
              onClick={() => setTab(o.key)}
              data-qc={`staff-tab-${o.key}`}
              className={cn(
                "h-7 cursor-pointer whitespace-nowrap rounded-full px-3.5 text-xs tracking-[0.02em] transition-colors",
                currentTab === o.key
                  ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                  : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]",
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
        </div>
      </div>

      {currentTab === "performance" ? (
        <PractitionerEarnings userId={userId} period={period} possessive="their" />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="px-5 py-5 sm:px-6">
            {currentTab === "access" ? (
              capabilities ? (
                <EffectivePermissions capabilities={capabilities} name={name} embedded />
              ) : (
                <p className="text-sm text-muted-foreground">Loading access…</p>
              )
            ) : canViewDocuments ? (
              <StaffDocuments
                userId={userId}
                readOnly
                queryKey={["staff-documents", userId]}
                embedded
                onCount={setOnFile}
              />
            ) : (
              <StaffDocCompliance
                userId={userId}
                fullName={name}
                presentCategories={presentCategories}
                embedded
              />
            )}
          </div>
        </Card>
      )}
    </section>
  );
}
