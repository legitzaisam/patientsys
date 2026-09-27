import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dateTime } from "@/lib/format";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BadgeCheck,
  ChevronDown,
  ConciergeBell,
  History,
  ShieldCheck,
  Stethoscope,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { listRolePermissions, setClinicRolePermission, setRolePermission } from "@/lib/clinic.functions";
import { PERMISSION_GROUPS, PERMISSION_META, type PermissionKey } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isStepUpRequired, useStepUp } from "@/components/step-up-dialog";

const RECENT_CHANGE_PREVIEW = 5;

type AccessChange = {
  role: string;
  key: PermissionKey;
  enabled: boolean;
  by: string;
  at: string;
};

function accessChangeLine(c: AccessChange) {
  return (
    <li key={`${c.role}-${c.key}-${c.at}`} className="text-xs text-ink-2">
      <span className="text-foreground">{c.by}</span> turned{" "}
      <span className="text-foreground">{PERMISSION_META[c.key].label}</span>{" "}
      {c.enabled ? "on" : "off"} for {c.role.toLowerCase()}
      {c.role.endsWith("s") ? "" : "s"} · {dateTime(c.at)}
    </li>
  );
}

const SYSTEM_ROLES = [
  { key: "manager" as const, label: "Manager", named: false },
  { key: "front_desk" as const, label: "Receptionist", named: false },
  { key: "practitioner" as const, label: "Practitioner", named: false },
];

const ROLE_ICONS: Record<string, LucideIcon> = {
  manager: UserCog,
  front_desk: ConciergeBell,
  practitioner: Stethoscope,
};

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
  const grantedCount = (role: GridRole, keys: PermissionKey[]) =>
    keys.filter((key) => grantsFor(role)?.[key]).length;

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
    .sort((a, b) => b.at.localeCompare(a.at));
  const previewChanges = recentChanges.slice(0, RECENT_CHANGE_PREVIEW);
  const groups = PERMISSION_GROUPS.map((group) => ({
    ...group,
    keys: group.keys.filter((key) => !key.startsWith("view.")),
  })).filter((group) => group.keys.length > 0);
  const allKeys = groups.flatMap((group) => group.keys);
  const columns = `minmax(13rem,1fr) repeat(${Math.max(roles.length, 1)}, 6rem)`;
  const [openGroups, setOpenGroups] = useState(() => new Set(groups.map((group) => group.label)));
  const anyOpen = groups.some((group) => openGroups.has(group.label));
  const [historyOpen, setHistoryOpen] = useState(false);
  const headRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [headPinned, setHeadPinned] = useState(false);

  // The header pins under the page toolbar (3.5rem). Watching it against a line
  // just below that tells us when it is stuck and needs its opaque backdrop.
  // The bottom margin keeps a header that is still below the fold from counting.
  useEffect(() => {
    const node = headRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => setHeadPinned(!entry.isIntersecting),
      {
        root: document.getElementById("app-main-scroll"),
        rootMargin: "-57px 0px 100% 0px",
        threshold: 1,
      },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // A row that sits halfway under the pin would show a sliced title or
  // description. Hide that row and extend the header fill over the gap.
  useEffect(() => {
    const main = document.getElementById("app-main-scroll");
    const head = headRef.current;
    const body = bodyRef.current;
    if (!main || !head || !body) return;

    let raf = 0;
    const update = () => {
      raf = 0;
      const edge = head.getBoundingClientRect().bottom;
      let leftover = 0;
      for (const row of body.querySelectorAll<HTMLElement>("[data-access-row]")) {
        const box = row.getBoundingClientRect();
        const straddles = box.top < edge - 1 && box.bottom > edge + 1;
        row.style.visibility = straddles ? "hidden" : "";
        if (straddles) leftover = Math.max(leftover, Math.ceil(box.bottom - edge));
      }
      head.style.setProperty("--access-leftover", `${leftover}px`);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    main.addEventListener("scroll", onScroll, { passive: true });
    const ro = new ResizeObserver(onScroll);
    ro.observe(head);
    ro.observe(body);
    update();
    return () => {
      main.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      head.style.removeProperty("--access-leftover");
      for (const row of body.querySelectorAll<HTMLElement>("[data-access-row]")) {
        row.style.visibility = "";
      }
    };
  }, []);

  const setGroupOpen = (label: string, open: boolean) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (open) next.add(label);
      else next.delete(label);
      return next;
    });
  };

  return (
    <Card className="space-y-4 p-5">
      {stepUp.dialog}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md rounded-[22px] sm:rounded-[22px]">
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>Access history</DialogTitle>
            <DialogDescription>The latest change to each capability, newest first.</DialogDescription>
          </DialogHeader>
          <ul
            data-qc="access-history"
            className="max-h-[20rem] space-y-2 overflow-y-auto overscroll-contain pr-1"
          >
            {recentChanges.map(accessChangeLine)}
          </ul>
        </DialogContent>
      </Dialog>
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title flex min-w-0 items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
            <span className="truncate">Staff access</span>
          </h2>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
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
                      {recentChanges.length > RECENT_CHANGE_PREVIEW
                        ? "The last five changes. Older ones are in Access history."
                        : "Who last changed staff access."}
                    </p>
                  </div>
                  <ul data-qc="access-changes" className="space-y-2 px-3.5 py-3">
                    {previewChanges.map(accessChangeLine)}
                  </ul>
                  {recentChanges.length > RECENT_CHANGE_PREVIEW && (
                    <div className="border-t border-edge px-3.5 py-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setHistoryOpen(true)}
                      >
                        Access history
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {canEdit
            ? "Choose what each access level can reach. New named roles start with generic floor access. You always keep full access as clinic owner."
            : "Access levels set by the clinic owner."}
        </p>
      </div>

      <div
        className="rounded-2xl border border-edge-2 bg-background shadow-inset-hi max-sm:overflow-x-auto"
        aria-busy={!data?.grants}
      >
        <div className="min-w-0">
          <div
            ref={headRef}
            data-pinned={headPinned || undefined}
            className="access-grid-head sticky top-[3.5rem] z-10 grid items-end gap-3 border-b border-edge-2 bg-background px-4 pb-3 pt-3.5"
            style={{ gridTemplateColumns: columns }}
          >
            <span className="min-w-0 text-2xs font-semibold uppercase tracking-[0.08em] text-ink-3">
              Capability
            </span>
            {roles.map((role) => {
              const Icon = role.named ? BadgeCheck : (ROLE_ICONS[role.key] ?? BadgeCheck);
              return (
                <div key={role.key} className="flex flex-col items-center gap-1 text-center">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full border border-edge bg-glass shadow-inset-hi">
                    <Icon className="h-3.5 w-3.5 text-ink-3" aria-hidden />
                  </span>
                  <span className="text-xs font-semibold leading-tight text-foreground">
                    {role.label}
                  </span>
                  <span className="text-2xs leading-none tabular-nums text-ink-3">
                    {grantedCount(role, allKeys)} of {allKeys.length} on
                  </span>
                </div>
              );
            })}
          </div>

          <div ref={bodyRef}>
          {groups.map((group, groupIndex) => {
            const open = openGroups.has(group.label);
            const lastGroup = groupIndex === groups.length - 1;
            return (
              <Collapsible
                key={group.label}
                open={open}
                onOpenChange={(next) => setGroupOpen(group.label, next)}
              >
                <CollapsibleTrigger
                  data-access-row
                  aria-expanded={open}
                  className={cn(
                    "grid w-full cursor-pointer items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-[rgba(47,63,102,0.09)] focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]",
                    open ? "bg-[rgba(47,63,102,0.065)]" : "bg-[rgba(47,63,102,0.035)]",
                    (open || !lastGroup) && "border-b border-edge-2",
                  )}
                  style={{ gridTemplateColumns: columns }}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-ink-3 transition-transform duration-200",
                        !open && "-rotate-90",
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        "truncate text-2xs font-semibold uppercase tracking-[0.08em]",
                        open ? "text-foreground" : "text-ink-2",
                      )}
                    >
                      {group.label}
                    </span>
                  </span>
                  {roles.map((role) => {
                    const on = grantedCount(role, group.keys);
                    return (
                      <span key={role.key} className="flex justify-center" aria-hidden>
                        <span
                          className={cn(
                            "rounded-full border px-1.5 py-px text-2xs tabular-nums",
                            on === 0 && "border-transparent text-ink-3",
                            on > 0 && on < group.keys.length && "border-edge bg-glass text-ink-2",
                            on === group.keys.length &&
                              "border-accent-line bg-accent-soft text-accent-ink",
                          )}
                        >
                          {on}/{group.keys.length}
                        </span>
                      </span>
                    );
                  })}
                </CollapsibleTrigger>
                <CollapsibleContent className="collapsible-panel">
                  {group.keys.map((key: PermissionKey, keyIndex) => (
                    <div
                      key={key}
                      data-access-row
                      className={cn(
                        "grid items-center gap-3 px-4 py-3 transition-colors hover:bg-[rgba(47,63,102,0.04)]",
                        !(lastGroup && keyIndex === group.keys.length - 1) &&
                          "border-b border-edge-2",
                      )}
                      style={{ gridTemplateColumns: columns }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug text-foreground">
                          {PERMISSION_META[key].label}
                        </p>
                        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                          {PERMISSION_META[key].description}
                        </p>
                        {(() => {
                          const c = latestChange(key);
                          return c ? (
                            <p
                              className="mt-1 flex items-center gap-1 text-2xs text-ink-3"
                              data-qc="grant-changed-by"
                            >
                              <History className="h-3 w-3 shrink-0" aria-hidden />
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
        </div>
      </div>
    </Card>
  );
}
