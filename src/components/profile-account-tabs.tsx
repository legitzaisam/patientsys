import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SecuritySettings } from "@/components/security-settings";
import { StaffDocuments } from "@/components/staff-files";
import { cn } from "@/lib/utils";

type Tab = "security" | "documents";

export function ProfileAccountTabs({
  userId,
  identity,
}: {
  userId: string;
  identity: { userId?: string; mfaRequired?: boolean; email?: string };
}) {
  const [tab, setTab] = useState<Tab>("security");
  const [onFile, setOnFile] = useState(0);

  const hint =
    tab === "security"
      ? "Email sign-in codes, password, and the devices currently signed in as you."
      : "Records required for JCCP and UK clinic practice. Stored privately — only you and clinic managers can open them.";

  return (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="section-title">{tab === "security" ? "Security" : "Documents"}</h2>
            {tab === "documents" ? (
              <Badge variant="outline" className="rounded-xl text-2xs uppercase">
                {onFile} on file
              </Badge>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
        </div>
        <div
          role="tablist"
          aria-label="Account"
          className="flex h-[34px] shrink-0 items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi"
        >
          {(
            [
              { key: "security", label: "Security" },
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
        {tab === "security" ? (
          <SecuritySettings identity={identity} embedded />
        ) : (
          <div className="px-5 py-5 sm:px-6">
            <StaffDocuments userId={userId} embedded onCount={setOnFile} />
          </div>
        )}
      </Card>
    </section>
  );
}
