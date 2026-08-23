import { Check, Minus, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PERMISSION_GROUPS, PERMISSION_META, type PermissionKey } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export type EffectiveCapabilities = { isOwner: boolean; granted: readonly string[] };

/**
 * "What can this person actually do." The answer comes from the server, resolved
 * with the same can() the guards use, so it cannot drift from what is enforced.
 */
export function EffectivePermissions({
  capabilities,
  name,
}: {
  capabilities: EffectiveCapabilities;
  name: string;
}) {
  const held = new Set(capabilities.granted);

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-ink-3" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">What {name} can do</h2>
          <p className="text-xs text-muted-foreground">
            {capabilities.isOwner
              ? "Clinic owner — full access to everything, always."
              : `${held.size} of ${
                  PERMISSION_GROUPS.reduce((n, g) => n + g.keys.length, 0)
                } capabilities. Change these under Staff access on the team page.`}
          </p>
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
        {PERMISSION_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1.5">
            <p className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-3">
              {group.label}
            </p>
            <ul className="space-y-1">
              {group.keys.map((key: PermissionKey) => {
                const on = held.has(key);
                return (
                  <li key={key} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                        on ? "bg-success-bg text-success-ink" : "bg-glass-2 text-ink-3",
                      )}
                    >
                      {on ? (
                        <Check className="h-2.5 w-2.5" strokeWidth={3} />
                      ) : (
                        <Minus className="h-2.5 w-2.5" strokeWidth={3} />
                      )}
                    </span>
                    <span className={cn("text-xs", on ? "text-foreground" : "text-ink-3")}>
                      {PERMISSION_META[key].label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
