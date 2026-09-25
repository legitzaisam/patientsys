import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import { listRolePermissions, setRolePermission } from "@/lib/clinic.functions";
import {
  catalogueChildren,
  catalogueNode,
  type CatalogueNode,
  type SwitchRole,
} from "@/lib/access-catalogue";
import { PERMISSION_META } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { isStepUpRequired, useStepUp } from "@/components/step-up-dialog";

const COLUMNS: { key: SwitchRole | "owner"; label: string }[] = [
  { key: "owner", label: "Owner" },
  { key: "practitioner", label: "Practitioner" },
  { key: "front_desk", label: "Receptionist" },
  { key: "patient", label: "Patient" },
];

const FIXED = [
  "The clinic owner always holds every staff grant. That column cannot be turned off.",
  "This page is limited to the clinic owner and the software-developer admin. It is not a grant, so no role can be given it from here.",
  "Patients stay inside their portal. Staff do not open the live portal, and patients do not open the clinic.",
  "A practitioner's own book on the dashboard and retention is a data rule, not a switch.",
  "Archiving a patient, inviting staff and revoking access stay with the clinic owner.",
];

function ancestorOff(
  node: CatalogueNode,
  role: SwitchRole,
  grants: Record<string, Record<string, boolean>> | undefined,
) {
  let parentId = node.parentId;
  while (parentId) {
    const parent = catalogueNode(parentId);
    if (!parent) break;
    if (!grants?.[role]?.[parent.permission]) return true;
    parentId = parent.parentId;
  }
  return false;
}

function Rows({
  parentId,
  depth,
  grants,
  canEdit,
  pending,
  onToggle,
}: {
  parentId: string | null;
  depth: number;
  grants: Record<string, Record<string, boolean>> | undefined;
  canEdit: boolean;
  pending: boolean;
  onToggle: (role: SwitchRole, permission: string, enabled: boolean) => void;
}) {
  return (
    <>
      {catalogueChildren(parentId).map((node) => (
        <div key={node.id}>
          <div
            className="grid min-w-[40rem] items-center gap-3 border-b border-glass-line px-4 py-3"
            style={{ gridTemplateColumns: "minmax(14rem,1fr) repeat(4, 6.5rem)" }}
          >
            <div style={{ paddingLeft: depth * 16 }}>
              <p className="text-sm text-foreground">{node.label}</p>
              <p className="text-xs text-muted-foreground">
                {node.kind === "page" ? "Page" : node.kind === "tab" ? "Tab" : "Component"}
                {" · "}
                {PERMISSION_META[node.permission].description}
              </p>
            </div>
            {COLUMNS.map((column) => {
              const role = column.key;
              if (role === "owner") {
                return (
                  <span key={role} className="text-center text-xs text-muted-foreground">
                    {node.columns.includes("practitioner") ? "Always" : ""}
                  </span>
                );
              }
              if (!node.columns.includes(role)) {
                return <span key={role} />;
              }
              const locked = ancestorOff(node, role, grants);
              return (
                <div key={role} className="flex justify-center">
                  <Switch
                    aria-label={`${node.label} for ${column.label}`}
                    checked={Boolean(grants?.[role]?.[node.permission])}
                    disabled={!canEdit || pending || !grants || locked}
                    onCheckedChange={(enabled) => onToggle(role, node.permission, enabled)}
                  />
                </div>
              );
            })}
          </div>
          <Rows
            parentId={node.id}
            depth={depth + 1}
            grants={grants}
            canEdit={canEdit}
            pending={pending}
            onToggle={onToggle}
          />
        </div>
      ))}
    </>
  );
}

/** Owner and admin edit which pages, tabs and components each role can see. */
export function AccessCatalogueEditor() {
  const queryClient = useQueryClient();
  const stepUp = useStepUp();
  const fetchGrants = useServerFn(listRolePermissions);
  const { data } = useQuery({ queryKey: ["role-permissions"], queryFn: () => fetchGrants() });
  const save = useMutation({
    mutationFn: useServerFn(setRolePermission),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success("Access updated");
    },
    onError: (e: Error) => {
      if (!isStepUpRequired(e)) toast.error(e.message);
    },
  });

  const grants = data?.grants;
  const canEdit = Boolean(data?.canEdit);

  return (
    <div className="space-y-5">
      {stepUp.dialog}
      <div className="page-header">
        <div>
          <h1 className="page-title">Access</h1>
          <p className="page-subtitle">
            Choose what practitioners, receptionists and patients can see. Changes apply as soon as you save them.
          </p>
        </div>
      </div>

      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-ink-3" />
          <p className="text-sm text-foreground">Pages, tabs and components</p>
        </div>
        <div className="overflow-x-auto overflow-hidden rounded-2xl border border-edge">
          <div
            className="grid min-w-[40rem] items-center gap-3 border-b border-edge bg-glass-2 px-4 py-2.5"
            style={{ gridTemplateColumns: "minmax(14rem,1fr) repeat(4, 6.5rem)" }}
          >
            <span className="text-xs tracking-[0.02em] text-muted-foreground">Surface</span>
            {COLUMNS.map((column) => (
              <span key={column.key} className="text-center text-xs tracking-[0.02em] text-muted-foreground">
                {column.label}
              </span>
            ))}
          </div>
          <Rows
            parentId={null}
            depth={0}
            grants={grants}
            canEdit={canEdit}
            pending={save.isPending}
            onToggle={(role, permission, enabled) =>
              void stepUp.run(
                () => save.mutateAsync({ data: { role, permission, enabled } }),
                "permission",
              )
            }
          />
        </div>
        <ul className="space-y-1 text-xs text-muted-foreground">
          {FIXED.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
