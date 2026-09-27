import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Copy, Mail, Plus, Shield } from "lucide-react";
import { createClinicRole, inviteStaffMember, listRolePermissions } from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { checkEmail } from "@/lib/email";
import { PERMISSION_KEYS, PERMISSION_META, type PermissionKey } from "@/lib/permissions";
import { InviteStaffMember } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InviteRole = "owner" | "manager" | "practitioner" | "front_desk";
type RolePick = { kind: "system"; role: InviteRole } | { kind: "named"; id: string };

const ROLES: { value: InviteRole; label: string; baseline: string }[] = [
  {
    value: "front_desk",
    label: "Receptionist",
    baseline: "Diary, bookings, patient contact details and documents.",
  },
  {
    value: "practitioner",
    label: "Practitioner",
    baseline: "Clinical care, their own diary and patient work.",
  },
  {
    value: "manager",
    label: "Manager",
    baseline: "Day-to-day clinic operations.",
  },
  {
    value: "owner",
    label: "Clinic owner",
    baseline: "Full control of the clinic, team and staff access.",
  },
];

function roleAccessDescription(
  role: InviteRole,
  baseline: string,
  grants: Record<string, Record<string, boolean>> | undefined,
): string {
  if (role === "owner") return baseline;
  if (!grants) return baseline;

  const capabilityKeys = PERMISSION_KEYS.filter((key) => !key.startsWith("view."));
  const extras = capabilityKeys.filter((key) => grants[role]?.[key]).map(
    (key: PermissionKey) => PERMISSION_META[key].label,
  );
  if (extras.length === 0) return baseline;

  const base = baseline.replace(/\.$/, "");
  if (extras.length === capabilityKeys.length) return `${base} Full staff access.`;
  if (extras.length === 1) return `${base} Also ${extras[0].toLowerCase()}.`;
  if (extras.length === 2) return `${base} Also ${extras[0].toLowerCase()} and ${extras[1].toLowerCase()}.`;
  return `${base} Plus ${extras.length} staff access options.`;
}

type InviteValues = z.infer<typeof InviteStaffMember>;

const EMPTY: InviteValues = {
  fullName: "",
  email: "",
  jobTitle: "",
  role: "front_desk",
  clinicRoleId: "",
  registrationBody: "",
  registrationNumber: "",
};

const GENERIC_ROLE_COPY =
  "Generic floor access: diary, bookings, contact details and documents. Clinical notes, photos, insights and money stay off until the owner turns them on under Staff access.";

type InviteResult = { email: string; delivery: "emailed" | "link"; actionLink: string | null };

function RoleChip({
  label,
  checked,
  onSelect,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <Button
      type="button"
      role="radio"
      aria-checked={checked}
      size="sm"
      variant={checked ? "selected" : "outline"}
      onClick={onSelect}
    >
      {label}
    </Button>
  );
}

export function InviteStaffDialog({ onInvited }: { onInvited?: () => void }) {
  const { data: identity } = useIdentity();
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [addingRole, setAddingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [pick, setPick] = useState<RolePick>({ kind: "system", role: "front_desk" });

  const form = useForm<InviteValues>({
    resolver: zodResolver(InviteStaffMember),
    defaultValues: EMPTY,
    mode: "onBlur",
    reValidateMode: "onBlur",
  });

  const fetchGrants = useServerFn(listRolePermissions);
  const accessQuery = useQuery({
    queryKey: ["role-permissions"],
    queryFn: () => fetchGrants(),
    enabled: open,
  });
  const accessData = accessQuery.data;

  const resetComposer = () => {
    form.reset(EMPTY);
    setPick({ kind: "system", role: "front_desk" });
    setAddingRole(false);
    setNewRoleName("");
  };

  const chooseSystem = (role: InviteRole) => {
    setPick({ kind: "system", role });
    form.setValue("role", role);
    form.setValue("clinicRoleId", "");
    if (role === "front_desk") {
      form.setValue("registrationBody", "");
      form.setValue("registrationNumber", "");
    }
  };

  const chooseNamed = (id: string) => {
    setPick({ kind: "named", id });
    form.setValue("role", "front_desk");
    form.setValue("clinicRoleId", id);
  };

  const invite = useMutation({
    mutationFn: useServerFn(inviteStaffMember),
    onSuccess: (r: InviteResult) => {
      setResult(r);
      resetComposer();
      toast.success(r.delivery === "emailed" ? "Invitation email sent" : "Sign-in link ready");
      onInvited?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createRole = useMutation({
    mutationFn: useServerFn(createClinicRole),
    onSuccess: (created) => {
      chooseNamed(created.id);
      setAddingRole(false);
      setNewRoleName("");
      void accessQuery.refetch();
      toast.success(`${created.name} added with generic access`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visibleRoles = ROLES.filter((r) => {
    if (r.value === "owner") return Boolean(identity?.isOwner);
    if (r.value === "manager") return Boolean(identity?.isOwner && identity?.hasSeparateManager);
    return true;
  });
  const namedRoles = accessData?.clinicRoles ?? [];
  const selectedNamed = pick.kind === "named" ? namedRoles.find((r) => r.id === pick.id) : undefined;
  const selectedSystem = pick.kind === "system" ? ROLES.find((r) => r.value === pick.role) : undefined;
  const accessDescription = selectedNamed
    ? GENERIC_ROLE_COPY
    : selectedSystem
      ? roleAccessDescription(selectedSystem.value, selectedSystem.baseline, accessData?.grants)
      : "";
  const showRegistration =
    pick.kind === "named" ||
    (pick.kind === "system" &&
      (pick.role === "practitioner" || pick.role === "manager" || pick.role === "owner"));

  const emailCheck = form.formState.errors.email ? checkEmail(form.watch("email") ?? "") : null;
  const emailSuggestion = emailCheck && !emailCheck.ok ? (emailCheck.suggestion ?? null) : null;

  const submit = (values: InviteValues) =>
    invite.mutate({
      data: {
        email: values.email,
        fullName: values.fullName,
        jobTitle: values.jobTitle ?? "",
        role: pick.kind === "named" ? "front_desk" : pick.role,
        clinicRoleId: pick.kind === "named" ? pick.id : undefined,
        registrationBody: values.registrationBody ?? "",
        registrationNumber: values.registrationNumber ?? "",
        app_origin: window.location.origin,
      },
    });

  return (
    <>
      <Button
        onClick={() => {
          setResult(null);
          resetComposer();
          setOpen(true);
        }}
        className="rounded-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Invite staff
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(90dvh,720px)] w-[calc(100vw-2rem)] max-w-[28rem] flex-col gap-0 overflow-hidden rounded-[22px] border-edge-2 bg-card/95 p-6 shadow-popover sm:rounded-[22px]">
          <DialogHeader className="shrink-0 pr-8 text-left">
            <DialogTitle>
              {result
                ? result.delivery === "emailed"
                  ? "Invitation sent"
                  : "Sign-in link ready"
                : "Invite someone"}
            </DialogTitle>
            <DialogDescription>
              {result
                ? result.delivery === "emailed"
                  ? "They’ll get an email with a link to choose their own password."
                  : "They already have an account. Share this one-time link privately — it lets them choose a new password."
                : "We’ll email a link so they can choose their own password."}
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <>
              <div className="mt-5 space-y-3">
                <div className="field-stack">
                  <Label>Work email</Label>
                  <Input readOnly value={result.email} />
                </div>
                {result.delivery === "link" && result.actionLink && (
                  <div className="field-stack">
                    <Label>One-time sign-in link</Label>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={result.actionLink} className="font-mono text-xs" />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Copy sign-in link"
                        onClick={() => {
                          void navigator.clipboard.writeText(result.actionLink ?? "");
                          toast.success("Sign-in link copied");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                {result.delivery === "emailed" && (
                  <div className="flex gap-2.5 rounded-2xl border border-edge px-3.5 py-3">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                    <p className="text-xs text-muted-foreground">
                      If the email does not arrive, check the address and invite them again.
                    </p>
                  </div>
                )}
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="outline" className="text-xs" onClick={() => setResult(null)}>
                  Invite another
                </Button>
                <Button type="button" onClick={() => setOpen(false)}>
                  Done
                </Button>
              </div>
            </>
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(submit)}
                className="flex min-h-0 flex-1 flex-col"
                noValidate
              >
                <div className="mt-5 -mr-2 min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain pr-2">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full name</FormLabel>
                        <FormControl>
                          <Input {...field} autoComplete="name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work email</FormLabel>
                          <FormControl>
                            <Input type="email" autoComplete="email" {...field} />
                          </FormControl>
                          <FormMessage />
                          {emailSuggestion ? (
                            <button
                              type="button"
                              className="self-start text-xs font-medium text-destructive underline underline-offset-2 hover:text-destructive/90"
                              onClick={() =>
                                form.setValue("email", emailSuggestion, { shouldValidate: true })
                              }
                            >
                              Yes
                            </button>
                          ) : null}
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="jobTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job title</FormLabel>
                          <FormControl>
                            <Input {...field} value={field.value ?? ""} placeholder="Optional" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="field-stack">
                    <Label id="invite-role-label">Role</Label>
                    <p className="text-xs text-muted-foreground">
                      What they can do in the clinic. Job title is only how they appear on the team.
                    </p>
                    <div
                      role="radiogroup"
                      aria-labelledby="invite-role-label"
                      className="flex flex-wrap gap-1.5"
                    >
                      {visibleRoles.map((r) => (
                        <RoleChip
                          key={r.value}
                          label={r.label}
                          checked={pick.kind === "system" && pick.role === r.value}
                          onSelect={() => chooseSystem(r.value)}
                        />
                      ))}
                      {namedRoles.map((named) => (
                        <RoleChip
                          key={named.id}
                          label={named.name}
                          checked={pick.kind === "named" && pick.id === named.id}
                          onSelect={() => chooseNamed(named.id)}
                        />
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs font-medium text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground"
                        aria-expanded={addingRole}
                        onClick={() => setAddingRole((openAdd) => !openAdd)}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden />
                        Add a role
                      </button>
                    </div>
                    {addingRole && (
                      <div className="rounded-2xl border border-edge bg-glass-2 px-3.5 py-3">
                        <Label htmlFor="new-clinic-role">Name the role</Label>
                        <div className="mt-1.5 flex gap-2">
                          <Input
                            id="new-clinic-role"
                            value={newRoleName}
                            onChange={(event) => setNewRoleName(event.target.value)}
                            placeholder="Plastic surgeon"
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                if (newRoleName.trim()) createRole.mutate({ data: { name: newRoleName } });
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="shrink-0"
                            disabled={!newRoleName.trim() || createRole.isPending}
                            onClick={() => createRole.mutate({ data: { name: newRoleName } })}
                          >
                            {createRole.isPending ? "Adding…" : "Add"}
                          </Button>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          New roles start with generic access. You can raise rights later on Team.
                        </p>
                      </div>
                    )}
                    {accessDescription && (
                      <div className="flex gap-2.5 rounded-2xl border border-edge px-3.5 py-3">
                        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                        <p className="text-xs text-muted-foreground">{accessDescription}</p>
                      </div>
                    )}
                  </div>

                  {showRegistration && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="registrationBody"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Registration body</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value ?? ""} placeholder="Optional" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="registrationNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Registration number</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value ?? ""} placeholder="Optional" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
                <div className="mt-5 flex justify-end gap-2" data-slot="dialog-footer">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="text-xs" disabled={invite.isPending}>
                    {invite.isPending ? "Sending…" : "Send invitation"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
