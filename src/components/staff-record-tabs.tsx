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
import { cn } from "@/lib/utils";

type Tab = "access" | "documents";

export function StaffRecordTabs({
  name,
  capabilities,
  userId,
  canViewDocuments,
  presentCategories,
}: {
  name: string;
  capabilities?: EffectiveCapabilities;
  userId: string;
  canViewDocuments: boolean;
  presentCategories: string[];
}) {
  const [tab, setTab] = useState<Tab>("access");
  const [onFile, setOnFile] = useState(0);

  const hint =
    tab === "access"
      ? capabilities
        ? accessSummary(capabilities)
        : "What this person can do in the clinic."
      : canViewDocuments
        ? "Records held on file for JCCP and UK clinic practice. Managers can open but not edit these."
        : "Status only — file contents stay private to the team member and clinic owners.";

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="section-title">{tab === "access" ? `What ${name} can do` : "Documents"}</h2>
            {tab === "documents" && canViewDocuments ? (
              <Badge variant="outline" className="rounded-xl text-2xs uppercase">
                {onFile} on file
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        </div>
        <div
          role="tablist"
          aria-label="Staff record"
          className="flex h-[34px] shrink-0 items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi"
        >
          {(
            [
              { key: "access", label: "Access" },
              { key: "documents", label: "Documents" },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              role="tab"
              aria-selected={tab === o.key}
              onClick={() => setTab(o.key)}
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

      <Card className="overflow-hidden p-0">
        <div className="px-5 py-5 sm:px-6">
          {tab === "access" ? (
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
    </section>
  );
}
