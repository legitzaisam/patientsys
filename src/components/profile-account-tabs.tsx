import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SecuritySettings } from "@/components/security-settings";
import { StaffDocuments } from "@/components/staff-files";
import { PractitionerEarnings } from "@/components/earnings/practitioner-earnings";
import { CURRENT_YEAR, PeriodPicker, type PeriodSelection } from "@/components/period-picker";
import { cn } from "@/lib/utils";

export type ProfileTab = "security" | "documents" | "performance";

/**
 * Security, Documents and (when the person treats patients) Performance.
 * The tab pill sits on the heading row, same as the earlier profile.
 */
export function ProfileAccountTabs({
  userId,
  identity,
  showPerformance,
}: {
  userId: string;
  identity: { userId?: string; mfaRequired?: boolean; email?: string };
  showPerformance: boolean;
}) {
  const [tab, setTab] = useState<ProfileTab>(showPerformance ? "performance" : "security");
  const [onFile, setOnFile] = useState(0);
  const [period, setPeriod] = useState<PeriodSelection>(CURRENT_YEAR);

  const tabs = (
    [
      ...(showPerformance ? [{ key: "performance", label: "Performance" } as const] : []),
      { key: "security", label: "Security" },
      { key: "documents", label: "Documents" },
    ] as const
  );

  const title =
    tab === "security" ? "Security" : tab === "documents" ? "Documents" : "Your performance";
  const hint =
    tab === "security"
      ? "Email sign-in codes, password, and the devices currently signed in as you."
      : tab === "documents"
        ? "Records required for JCCP and UK clinic practice. Stored privately — only you and clinic managers can open them."
        : "Your share of the treatments you delivered.";

  return (
    <section>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="section-title">{title}</h2>
            {tab === "documents" ? (
              <Badge variant="outline" className="rounded-xl text-2xs uppercase">
                {onFile} on file
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {tab === "performance" ? <PeriodPicker value={period} onChange={setPeriod} /> : null}
        <div
          role="tablist"
          aria-label="Account"
          className="flex h-[34px] shrink-0 items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi"
        >
          {tabs.map((o) => (
            <button
              key={o.key}
              type="button"
              role="tab"
              aria-selected={tab === o.key}
              onClick={() => setTab(o.key)}
              data-qc={`profile-tab-${o.key}`}
              className={cn(
                "h-7 cursor-pointer whitespace-nowrap rounded-full px-3.5 text-xs tracking-[0.02em] transition-colors",
                tab === o.key
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

      {tab === "performance" ? (
        <PractitionerEarnings userId={userId} period={period} possessive="your" />
      ) : (
        <Card className="overflow-hidden p-0">
          {tab === "security" ? (
            <SecuritySettings identity={identity} embedded />
          ) : (
            <div className="px-5 py-5 sm:px-6">
              <StaffDocuments userId={userId} embedded onCount={setOnFile} />
            </div>
          )}
        </Card>
      )}
    </section>
  );
}
