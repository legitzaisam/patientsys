import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { toast } from "sonner";
import { Copy, Mail, Plus, Shield } from "lucide-react";
import { inviteStaffMember, listRolePermissions } from "@/lib/clinic.functions";
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

const ROLES: { value: InviteRole; label: string; baseline: string }[] = [
  {
    value: "front_desk",
    label: "Receptionist",
    baseline: "Front desk work — diary, patient records, bookings and admin.",
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
    baseline: "Full control of the clinic, team and staff access settings.",
  },
];

/** Single blurb for the selected role, including live staff access grants. */
function roleAccessDescription(
  role: InviteRole,
  baseline: string,
  grants: Record<string, Record<string, boolean>> | undefined,
): string {
  if (role === "owner") return baseline;
  if (!grants) return baseline;

  const extras = PERMISSION_KEYS.filter((key) => grants[role]?.[key]).map(
    (key: PermissionKey) => PERMISSION_META[key].label,
  );
  if (extras.length === 0) return baseline;

  const base = baseline.replace(/\.$/, "");
  if (extras.length === PERMISSION_KEYS.length) {
    return `${base}, with full staff access.`;
  }
  if (extras.length === 1) return `${base}, plus access to ${extras[0]}.`;
  if (extras.length === 2) {
    return `${base}, plus access to ${extras[0]} and ${extras[1]}.`;
  }
  return `${base}, plus ${extras.length} staff access options.`;
}

type InviteValues = z.infer<typeof InviteStaffMember>;

const EMPTY: InviteValues = {
  fullName: "",
  email: "",
  jobTitle: "",
  role: "front_desk" as InviteRole,
  registrationBody: "",
  registrationNumber: "",
};

export function InviteStaffDialog({ onInvited }: { onInvited?: () => void }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ email: string; temporaryPassword: string } | null>(null);

  // Same schema the server function validates against, so a field the handler
  // would reject is caught here first and shown against the field itself.
  // onBlur matches the existing policy of never flagging an email mid-typing.
  const form = useForm<InviteValues>({
    resolver: zodResolver(InviteStaffMember),
    defaultValues: EMPTY,
    mode: "onBlur",
    reValidateMode: "onBlur",
  });

  const fetchGrants = useServerFn(listRolePermissions);
  const { data: accessData } = useQuery({
    queryKey: ["role-permissions"],
    queryFn: () => fetchGrants(),
    enabled: open,
  });

  const invite = useMutation({
    mutationFn: useServerFn(inviteStaffMember),
    onSuccess: (r: { email: string; temporaryPassword: string }) => {
      setResult({ email: r.email, temporaryPassword: r.temporaryPassword });
      form.reset(EMPTY);
      toast.success("Invitation created");
      onInvited?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const role = form.watch("role");
  const selectedRole = ROLES.find((r) => r.value === role);
  const accessDescription = selectedRole
    ? roleAccessDescription(selectedRole.value, selectedRole.baseline, accessData?.grants)
    : "";

  // The schema surfaces checkEmail's own message, so a typo still reads
  // "Did you mean …?" — recover the correction so the one-tap fix survives.
  const emailCheck = form.formState.errors.email ? checkEmail(form.watch("email") ?? "") : null;
  const emailSuggestion = emailCheck && !emailCheck.ok ? (emailCheck.suggestion ?? null) : null;

  const submit = (values: InviteValues) =>
    invite.mutate({
      data: {
        email: values.email,
        fullName: values.fullName,
        jobTitle: values.jobTitle ?? "",
        role: values.role,
        registrationBody: values.registrationBody ?? "",
        registrationNumber: values.registrationNumber ?? "",
      },
    });
  const mailto = result
    ? `mailto:${result.email}?subject=${encodeURIComponent("Your Aetheria clinic account")}&body=${encodeURIComponent(
        `Hello,\n\nAn account has been created for you on our clinic software.\n\nSign in at ${typeof window !== "undefined" ? window.location.origin : ""}/auth with:\n\nEmail: ${result.email}\nTemporary password: ${result.temporaryPassword}\n\nYou will be asked to choose a new password after you sign in. Do not share these details with anyone else.\n\nThank you.`,
      )}`
    : "";

  return (
    <>
      <Button
        onClick={() => {
          setResult(null);
          form.reset(EMPTY);
          setOpen(true);
        }}
        className="rounded-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Invite staff
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[min(90dvh,720px)] w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[22px] border-edge-2 bg-card/95 p-5 shadow-popover sm:rounded-[22px]">
          <DialogHeader className="shrink-0 pr-8 text-left">
            <DialogTitle>
              {result ? "Invitation ready" : "Invite a team member"}
            </DialogTitle>
            <DialogDescription>
              {result
                ? "Share this temporary password privately. They’ll sign in and be asked to change it."
                : "We’ll create their account with a temporary password for you to share."}
            </DialogDescription>
          </DialogHeader>

          {result ? (
            <>
              <div className="mt-4 space-y-3">
                <div className="field-stack">
                  <Label>Work email</Label>
                  <Input readOnly value={result.email} />
                </div>
                <div className="field-stack">
                  <Label>Temporary password</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={result.temporaryPassword}
                      className="font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label="Copy temporary password"
                      onClick={() => {
                        void navigator.clipboard.writeText(result.temporaryPassword);
                        toast.success("Temporary password copied");
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="text-xs"
                  onClick={() => setResult(null)}
                >
                  Invite another
                </Button>
                <Button asChild>
                  <a href={mailto}>
                    <Mail className="mr-1 h-4 w-4" />
                    Email instructions
                  </a>
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
                <div className="mt-4 -mr-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-3.5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Full name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                            <Input {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="field-stack sm:col-span-2">
                      <Label>Access level</Label>
                      <div className="flex flex-wrap gap-2">
                        {ROLES.map((r) => (
                          <Button
                            key={r.value}
                            type="button"
                            size="sm"
                            variant={role === r.value ? "selected" : "outline"}
                            onClick={() => {
                              form.setValue("role", r.value);
                              if (r.value === "front_desk") {
                                form.setValue("registrationBody", "");
                                form.setValue("registrationNumber", "");
                              }
                            }}
                          >
                            {r.label}
                          </Button>
                        ))}
                      </div>
                      {selectedRole && (
                        <div className="flex gap-2.5 rounded-2xl border border-edge px-3.5 py-3">
                          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                          <div className="min-w-0">
                            <p className="text-2xs font-semibold tracking-[0.02em] text-muted-foreground">
                              What this access covers
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {accessDescription}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                    {(role === "practitioner" || role === "manager" || role === "owner") && (
                      <>
                        <FormField
                          control={form.control}
                          name="registrationBody"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Registration body</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value ?? ""} />
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
                                <Input {...field} value={field.value ?? ""} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    They sign in with a temporary password, then choose their own. You can fine-tune
                    what they see under staff access.
                  </p>
                </div>
                <div className="mt-4 flex justify-end gap-2" data-slot="dialog-footer">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" className="text-xs" disabled={invite.isPending}>
                    {invite.isPending ? "Creating…" : "Create invitation"}
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
