import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Mail, Plus, ShieldCheck } from "lucide-react";
import { inviteStaffMember } from "@/lib/clinic.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ROLES = [
  { value: "front_desk", label: "Receptionist", blurb: "Diary, patients, bookings and paperwork" },
  { value: "practitioner", label: "Practitioner", blurb: "Clinical work, own earnings and retention" },
  { value: "owner", label: "Manager", blurb: "Full control of the clinic and team" },
] as const;

const EMPTY = {
  fullName: "",
  email: "",
  jobTitle: "",
  role: "front_desk" as "owner" | "practitioner" | "front_desk",
  registrationBody: "",
  registrationNumber: "",
};

export function InviteStaffDialog({ onInvited }: { onInvited?: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [result, setResult] = useState<{ email: string; setupLink: string } | null>(null);

  const invite = useMutation({
    mutationFn: useServerFn(inviteStaffMember),
    onSuccess: (r: { email: string; setupLink: string }) => {
      setResult({ email: r.email, setupLink: r.setupLink });
      setForm(EMPTY);
      toast.success("Invitation created");
      onInvited?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleLabel = ROLES.find((r) => r.value === form.role)?.label ?? "";
  const mailto = result
    ? `mailto:${result.email}?subject=${encodeURIComponent("Your Aetheria clinic account")}&body=${encodeURIComponent(
        `Hello,\n\nAn account has been created for you on our clinic software.\n\nUse this secure link to set your password and sign in:\n${result.setupLink}\n\nThe link is single-use and expires. Do not forward it to anyone else.\n\nThank you.`,
      )}`
    : "";

  return (
    <>
      <Button
        onClick={() => {
          setResult(null);
          setOpen(true);
        }}
        className="rounded-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Invite staff
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{result ? "Invitation ready" : "Invite a team member"}</DialogTitle>
          </DialogHeader>

          {result ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {result.email} now has a pending account with the access level you chose. Share this
                single-use setup link so they can set their own password.
              </p>
              <div className="flex items-center gap-2">
                <Input readOnly value={result.setupLink} className="text-xs" />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Copy setup link"
                  onClick={() => {
                    navigator.clipboard.writeText(result.setupLink);
                    toast.success("Setup link copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Send it over a channel only they can read. Never post it in a shared inbox or group chat.
              </p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResult(null)}>
                  Invite another
                </Button>
                <Button asChild>
                  <a href={mailto}>
                    <Mail className="mr-2 h-4 w-4" />
                    Email instructions
                  </a>
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="inv-name">Full name</Label>
                  <Input
                    id="inv-name"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-email">Work email</Label>
                  <Input
                    id="inv-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inv-job">Job title</Label>
                  <Input
                    id="inv-job"
                    value={form.jobTitle}
                    onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Access level</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {ROLES.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setForm({ ...form, role: r.value })}
                        className={`rounded-2xl border p-3 text-left transition-colors ${
                          form.role === r.value
                            ? "border-accent bg-glass-2"
                            : "border-edge hover:bg-glass-2"
                        }`}
                      >
                        <span className="flex items-center gap-2 text-sm text-foreground">
                          <ShieldCheck className="h-3.5 w-3.5 text-accent-ink" />
                          {r.label}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">{r.blurb}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {form.role === "practitioner" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="inv-body">Registration body</Label>
                      <Input
                        id="inv-body"
                        value={form.registrationBody}
                        onChange={(e) => setForm({ ...form, registrationBody: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
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
              <p className="text-xs text-muted-foreground">
                No password is set here. {roleLabel} access is applied the moment they complete setup, and
                you can fine-tune what they see in Settings › Staff access.
              </p>
              <DialogFooter>
                <Button
                  disabled={invite.isPending || !form.fullName.trim() || !form.email.trim()}
                  onClick={() =>
                    invite.mutate({
                      data: {
                        email: form.email.trim(),
                        fullName: form.fullName.trim(),
                        jobTitle: form.jobTitle,
                        role: form.role,
                        registrationBody: form.registrationBody,
                        registrationNumber: form.registrationNumber,
                        redirectTo: `${window.location.origin}/auth`,
                      },
                    })
                  }
                >
                  Send invitation
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
