import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dateTime } from "@/lib/format";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronDown, History, ShieldCheck } from "lucide-react";
import { listRolePermissions, setClinicRolePermission, setRolePermission } from "@/lib/clinic.functions";
import { PERMISSION_GROUPS, PERMISSION_META, type PermissionKey } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { isStepUpRequired, useStepUp } from "@/components/step-up-dialog";

const SYSTEM_ROLES = [
  { key: "manager" as const, label: "Manager", named: false },
  { key: "front_desk" as const, label: "Receptionist", named: false },
  { key: "practitioner" as const, label: "Practitioner", named: false },
];

type GridRole = { key: string; label: string; named: boolean };

/** Clinic owner customises what managers and other staff can reach. */
export function AccessControlSettings({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const stepUp = useStepUp();
  const fetchGrants = useServerFn(listRolePermissions);
  const { data } = useQuery({ queryKey: ["role-permissions"], queryFn: () => fetchGrants() });

  const saveSystem = useMutation({
    mutationFn: useServerFn(setRolePermission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries();
      toast.success("Access updated");
    },
    onError: (e: Error) => {
      if (!isStepUpRequired(e)) toast.error(e.message);
    },
  });

  const saveNamed = useMutation({
    mutationFn: useServerFn(setClinicRolePermission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries();
      toast.success("Access updated");
    },
    onError: (e: Error) => {
      if (!isStepUpRequired(e)) toast.error(e.message);
    },
  });

  const saving = saveSystem.isPending || saveNamed.isPending;
  const roles: GridRole[] = [
    ...SYSTEM_ROLES.filter((role) => role.key !== "manager" || data?.hasSeparateManager !== false),
    ...(data?.clinicRoles ?? []).map((role) => ({ key: role.id, label: role.name, named: true })),
  ];
  const grantsFor = (role: GridRole) =>
    role.named ? data?.clinicRoleGrants?.[role.key] : data?.grants?.[role.key];
  const changesFor = (role: GridRole) =>
    role.named ? data?.clinicRoleChanges?.[role.key] : data?.changes?.[role.key];

  const latestChange = (key: string) => {
    let best: { by: string; at: string; role: string } | null = null;
    for (const role of roles) {
      const c = changesFor(role)?.[key];
      if (c && (!best || c.at > best.at)) best = { ...c, role: role.label };
    }
    return best;
  };
  const recentChanges = roles
    .flatMap((role) =>
      Object.entries(changesFor(role) ?? {}).map(([key, c]) => ({
        role: role.label,
        key: key as PermissionKey,
        enabled: grantsFor(role)?.[key] ?? false,
        ...c,
      })),
    )
    .filter((c) => PERMISSION_META[c.key] && !c.key.startsWith("view."))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 12);
  const groups = PERMISSION_GROUPS.map((group) => ({
    ...group,
    keys: group.keys.filter((key) => !key.startsWith("view.")),
  })).filter((group) => group.keys.length > 0);
  const columns = `minmax(12rem,1fr) repeat(${Math.max(roles.length, 1)}, 5.5rem)`;
  const [openGroups, setOpenGroups] = useState(() => new Set(groups.map((group) => group.label)));
  const anyOpen = groups.some((group) => openGroups.has(group.label));

  const setGroupOpen = (label: string, open: boolean) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (open) next.add(label);
      else next.delete(label);
      return next;
    });
  };

  return (
    <Card className="space-y-5 p-5">
      {stepUp.dialog}
      <div className="mb-0 flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Staff access</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {canEdit
                ? "Choose what each access level can reach. New named roles start with generic floor access. You always keep full access as clinic owner."
                : "Access levels set by the clinic owner."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setOpenGroups(anyOpen ? new Set() : new Set(groups.map((group) => group.label)))
            }
          >
            {anyOpen ? "Collapse all" : "Expand all"}
          </Button>
          {recentChanges.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <History className="h-3.5 w-3.5" aria-hidden />
                  Recent changes
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 rounded-2xl p-0">
                <div className="border-b border-edge px-3.5 py-3">
                  <p className="text-sm font-semibold text-foreground">Recent changes</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Who last changed staff access. The full history stays in the audit log.
                  </p>
                </div>
                <ul
                  data-qc="access-changes"
                  className="max-h-56 space-y-2 overflow-y-auto px-3.5 py-3"
                >
                  {recentChanges.map((c) => (
                    <li key={`${c.role}-${c.key}-${c.at}`} className="text-xs text-ink-2">
                      <span className="text-foreground">{c.by}</span> turned{" "}
                      <span className="text-foreground">{PERMISSION_META[c.key].label}</span>{" "}
                      {c.enabled ? "on" : "off"} for {c.role.toLowerCase()}
                      {c.role.endsWith("s") ? "" : "s"} · {dateTime(c.at)}
                    </li>
                  ))}
                </ul>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-edge">
        <div className="min-w-[32rem] border-b border-edge bg-background">
          <div
            className="grid items-center gap-4 bg-background px-4 py-2.5"
            style={{ gridTemplateColumns: columns }}
          >
            <span className="text-xs tracking-[0.02em] text-muted-foreground">Capability</span>
            {roles.map((r) => (
              <span key={r.key} className="text-center text-xs tracking-[0.02em] text-muted-foreground">
                {r.label}
              </span>
            ))}
          </div>
        </div>
        {groups.map((group) => {
          const open = openGroups.has(group.label);
          return (
            <Collapsible
              key={group.label}
              open={open}
              onOpenChange={(next) => setGroupOpen(group.label, next)}
            >
              <CollapsibleTrigger
                aria-expanded={open}
                className="flex w-full min-w-[32rem] items-center gap-1.5 border-b border-glass-line bg-background px-4 py-1.5 text-left"
              >
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform",
                    open && "rotate-180",
                  )}
                  aria-hidden
                />
                <span className="text-2xs font-medium uppercase tracking-[0.08em] text-ink-3">
                  {group.label}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                {group.keys.map((key: PermissionKey) => (
                  <div
                    key={key}
                    className="grid min-w-[32rem] items-center gap-4 border-b border-glass-line px-4 py-3"
                    style={{ gridTemplateColumns: columns }}
                  >
                    <div>
                      <p className="text-sm text-foreground">{PERMISSION_META[key].label}</p>
                      <p className="text-xs text-muted-foreground">{PERMISSION_META[key].description}</p>
                      {(() => {
                        const c = latestChange(key);
                        return c ? (
                          <p className="mt-0.5 text-2xs text-ink-3" data-qc="grant-changed-by">
                            {c.role} changed by {c.by} · {dateTime(c.at)}
                          </p>
                        ) : null;
                      })()}
                    </div>
                    {roles.map((role) => (
                      <div key={role.key} className="flex justify-center">
                        <Switch
                          aria-label={`${PERMISSION_META[key].label} for ${role.label}`}
                          title={
                            changesFor(role)?.[key]
                              ? `Changed by ${changesFor(role)![key]!.by} · ${dateTime(changesFor(role)![key]!.at)}`
                              : undefined
                          }
                          checked={grantsFor(role)?.[key] ?? false}
                          disabled={!canEdit || saving || !data?.grants}
                          onCheckedChange={(enabled) =>
                            void stepUp.run(() => {
                              if (role.named) {
                                return saveNamed.mutateAsync({
                                  data: { clinicRoleId: role.key, permission: key, enabled },
                                });
                              }
                              return saveSystem.mutateAsync({
                                data: {
                                  role: role.key as "manager" | "front_desk" | "practitioner",
                                  permission: key,
                                  enabled,
                                },
                              });
                            }, "permission")
                          }
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </Card>
  );
}
