import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Mail, Plus, Shield } from "lucide-react";
import { inviteStaffMember, listRolePermissions } from "@/lib/clinic.functions";
import { checkEmail } from "@/lib/email";
import { PERMISSION_KEYS, PERMISSION_META, type PermissionKey } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const EMPTY = {
  fullName: "",
  email: "",
  jobTitle: "",
  role: "front_desk" as InviteRole,
  registrationBody: "",
  registrationNumber: "",
};

export function InviteStaffDialog({ onInvited }: { onInvited?: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [result, setResult] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

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
      setForm(EMPTY);
      toast.success("Invitation created");
      onInvited?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectedRole = ROLES.find((r) => r.value === form.role);
  const accessDescription = selectedRole
    ? roleAccessDescription(selectedRole.value, selectedRole.baseline, accessData?.grants)
    : "";
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
          setEmailError(null);
          setEmailSuggestion(null);
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
            <DialogTitle className="text-balance text-[17px] tracking-[-0.016em]">
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
                <Button className="text-xs" asChild>
                  <a href={mailto}>
                    <Mail className="mr-1 h-4 w-4" />
                    Email instructions
                  </a>
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-4 -mr-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-3.5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="field-stack sm:col-span-2">
                    <Label htmlFor="inv-name">Full name</Label>
                    <Input
                      id="inv-name"
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    />
                  </div>
                  <div className="field-stack">
                    <Label htmlFor="inv-email">Work email</Label>
                    <Input
                      id="inv-email"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      aria-invalid={Boolean(emailError)}
                      onChange={(e) => {
                        setForm({ ...form, email: e.target.value });
                        // Only show email errors after blur or submit — not while typing.
                        setEmailError(null);
                        setEmailSuggestion(null);
                      }}
                      onBlur={() => {
                        if (!form.email.trim()) {
                          setEmailError(null);
                          setEmailSuggestion(null);
                          return;
                        }
                        const check = checkEmail(form.email, "work email");
                        setEmailError(check.ok ? null : check.error);
                        setEmailSuggestion(check.ok ? null : (check.suggestion ?? null));
                      }}
                    />
                    {emailError && (
                      <p className="text-xs text-destructive">
                        {emailError}
                        {emailSuggestion ? (
                          <>
                            {" "}
                            <button
                              type="button"
                              className="font-medium underline underline-offset-2 hover:text-destructive/90"
                              onClick={() => {
                                setForm((f) => ({ ...f, email: emailSuggestion }));
                                setEmailError(null);
                                setEmailSuggestion(null);
                              }}
                            >
                              Yes
                            </button>
                          </>
                        ) : null}
                      </p>
                    )}
                  </div>
                  <div className="field-stack">
                    <Label htmlFor="inv-job">Job title</Label>
                    <Input
                      id="inv-job"
                      value={form.jobTitle}
                      onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                    />
                  </div>
                  <div className="field-stack sm:col-span-2">
                    <Label>Access level</Label>
                    <div className="flex flex-wrap gap-2">
                      {ROLES.map((r) => (
                        <Button
                          key={r.value}
                          type="button"
                          size="sm"
                          variant={form.role === r.value ? "selected" : "outline"}
                          onClick={() =>
                            setForm({
                              ...form,
                              role: r.value,
                              ...(r.value === "front_desk"
                                ? { registrationBody: "", registrationNumber: "" }
                                : {}),
                            })
                          }
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
                          <p className="mt-1 text-xs text-muted-foreground">{accessDescription}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  {(form.role === "practitioner" ||
                    form.role === "manager" ||
                    form.role === "owner") && (
                    <>
                      <div className="field-stack">
                        <Label htmlFor="inv-body">Registration body</Label>
                        <Input
                          id="inv-body"
                          value={form.registrationBody}
                          onChange={(e) => setForm({ ...form, registrationBody: e.target.value })}
                        />
                      </div>
                      <div className="field-stack">
                        <Label htmlFor="inv-no">Registration number</Label>
                        <Input
                          id="inv-no"
                          value={form.registrationNumber}
                          onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  They sign in with a temporary password, then choose their own. You can fine-tune
                  what they see under staff access.
                </p>
              </div>
              <div className="mt-4 flex justify-end gap-2" data-slot="dialog-footer">
                <Button type="button" variant="outline" className="text-xs" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="text-xs"
                  enterSubmit
                  disabled={
                    invite.isPending ||
                    !form.fullName.trim() ||
                    !form.email.trim()
                  }
                  onClick={() => {
                    const check = checkEmail(form.email, "work email");
                    if (!check.ok) {
                      setEmailError(check.error);
                      setEmailSuggestion(check.suggestion ?? null);
                      return;
                    }
                    setEmailError(null);
                    setEmailSuggestion(null);
                    invite.mutate({
                      data: {
                        email: check.email,
                        fullName: form.fullName.trim(),
                        jobTitle: form.jobTitle,
                        role: form.role,
                        registrationBody: form.registrationBody,
                        registrationNumber: form.registrationNumber,
                      },
                    });
                  }}
                >
                  {invite.isPending ? "Creating…" : "Create invitation"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
