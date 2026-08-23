import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { listRolePermissions, setRolePermission } from "@/lib/clinic.functions";
import { PERMISSION_KEYS, PERMISSION_META, type PermissionKey } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

const ROLES = [
  { key: "manager" as const, label: "Manager" },
  { key: "front_desk" as const, label: "Receptionist" },
  { key: "practitioner" as const, label: "Practitioner" },
];

/** Clinic owner customises what managers and other staff can reach. */
export function AccessControlSettings({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const fetchGrants = useServerFn(listRolePermissions);
  const { data } = useQuery({ queryKey: ["role-permissions"], queryFn: () => fetchGrants() });

  const save = useMutation({
    mutationFn: useServerFn(setRolePermission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries();
      toast.success("Access updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grants = data?.grants;

  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-ink-3" />
        <div>
          <h2 className="text-sm font-semibold text-foreground">Staff access</h2>
          <p className="text-xs text-muted-foreground">
            {canEdit
              ? "Choose what managers, receptionists and practitioners can reach. You always keep full access as clinic owner."
              : "Access levels set by the clinic owner."}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto overflow-hidden rounded-2xl border border-edge">
        <div
          className="grid min-w-[32rem] items-center gap-4 border-b border-edge bg-glass-2 px-4 py-2.5"
          style={{ gridTemplateColumns: `minmax(12rem,1fr) repeat(${ROLES.length}, 5.5rem)` }}
        >
          <span className="text-xs tracking-[0.02em] text-muted-foreground">Capability</span>
          {ROLES.map((r) => (
            <span key={r.key} className="text-center text-xs tracking-[0.02em] text-muted-foreground">
              {r.label}
            </span>
          ))}
        </div>
        {PERMISSION_KEYS.map((key: PermissionKey) => (
          <div
            key={key}
            className="grid min-w-[32rem] items-center gap-4 border-b border-glass-line px-4 py-3 last:border-0"
            style={{ gridTemplateColumns: `minmax(12rem,1fr) repeat(${ROLES.length}, 5.5rem)` }}
          >
            <div>
              <p className="text-sm text-foreground">{PERMISSION_META[key].label}</p>
              <p className="text-xs text-muted-foreground">{PERMISSION_META[key].description}</p>
            </div>
            {ROLES.map((role) => (
              <div key={role.key} className="flex justify-center">
                <Switch
                  aria-label={`${PERMISSION_META[key].label} for ${role.label}`}
                  checked={grants?.[role.key]?.[key] ?? false}
                  disabled={!canEdit || save.isPending || !grants}
                  onCheckedChange={(enabled) =>
                    save.mutate({ data: { role: role.key, permission: key, enabled } })
                  }
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}
