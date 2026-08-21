import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, UserCog, Trash2, Pencil, Clock, Plus, HelpCircle, Users, Bell, KeyRound } from "lucide-react";
import {
  listTeam,
  createStaffAccount,
  updateStaffMember,
  revokeStaffAccess,
  listProfileChangeRequests,
  reviewProfileChange,
  setStaffPassword,
} from "@/lib/clinic.functions";
import { can } from "@/lib/permissions";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { InviteStaffDialog } from "@/components/invite-staff-dialog";
import { TreatmentCatalogueSettings } from "@/components/treatment-catalogue-settings";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const Route = createFileRoute("/_authenticated/team/")({
  component: TeamPage,
});

const ROLES = [
  { value: "owner", label: "Manager", blurb: "Full control: delete records, price list, team accounts" },
  { value: "practitioner", label: "Practitioner", blurb: "Full clinical work, cannot delete records or manage team" },
  { value: "front_desk", label: "Receptionist", blurb: "Bookings, payments and paperwork, no deletions" },
] as const;

function roleLabel(role: string) {
  return ROLES.find((r) => r.value === role)?.label ?? role.replace("_", " ");
}

function RoleSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-xl border border-edge-2 bg-glass-2 shadow-inset-hi px-3 text-sm text-foreground"
    >
      {ROLES.map((r) => (
        <option key={r.value} value={r.value}>
          {r.label}
        </option>
      ))}
    </select>
  );
}

function TeamPage() {
  const { data: identity } = useIdentity();
  const queryClient = useQueryClient();
  const fetchTeam = useServerFn(listTeam);
  const requestsRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    jobTitle: "",
    role: "practitioner",
    registrationBody: "",
    registrationNumber: "",
  });

  const { data: team } = useQuery({
    queryKey: ["team"],
    queryFn: () => fetchTeam(),
    enabled: can(identity, "team.view"),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["team"] });

  const create = useMutation({
    mutationFn: useServerFn(createStaffAccount),
    onSuccess: () => {
      toast.success("Account created");
      setOpen(false);
      setForm({ email: "", password: "", fullName: "", jobTitle: "", role: "practitioner", registrationBody: "", registrationNumber: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: useServerFn(updateStaffMember),
    onSuccess: () => {
      toast.success("Access updated");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: useServerFn(revokeStaffAccess),
    onSuccess: () => {
      toast.success("Access revoked");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setPassword = useMutation({
    mutationFn: useServerFn(setStaffPassword),
    onSuccess: () => {
      toast.success("Password set — they can sign in now");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fetchRequests = useServerFn(listProfileChangeRequests);
  const { data: requests } = useQuery({
    queryKey: ["profile-change-requests"],
    queryFn: () => fetchRequests(),
    enabled: can(identity, "team.approve_changes"),
  });

  const review = useMutation({
    mutationFn: useServerFn(reviewProfileChange),
    onSuccess: () => {
      toast.success("Request reviewed");
      queryClient.invalidateQueries({ queryKey: ["profile-change-requests"] });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  const canViewTeam = can(identity, "team.view");
  const canApprove = can(identity, "team.approve_changes");
  const canAdmin = Boolean(identity.isManager);
  const canEditTreatments = can(identity, "settings.treatments");
  if (!canViewTeam)
    return (
      <AppShell identity={identity}>
        <p className="text-sm text-muted-foreground">
          You do not have access to the team page. Ask your manager to enable it in Settings.
        </p>
      </AppShell>
    );

  return (
    <AppShell identity={identity}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Team &amp; access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {(team ?? []).length} staff accounts{canAdmin ? " · you hold manager access" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {canAdmin && <InviteStaffDialog onInvited={invalidate} />}
        {canAdmin && (
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create with password
          </Button>
        )}

        {canApprove && (
        <Button
          variant="outline"
          onClick={() => requestsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
        >
          <Bell className="mr-2 h-4 w-4" />
          Review requests
          {(requests ?? []).filter((r: any) => r.status === "pending").length > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-2xs font-medium text-destructive-foreground">
              {(requests ?? []).filter((r: any) => r.status === "pending").length}
            </span>
          )}
        </Button>
        )}

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost">
              <HelpCircle className="mr-2 h-4 w-4" />
              Role help
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 rounded-xl" align="start">
            <p className="mb-3 text-sm font-medium text-foreground">Access levels</p>
            <div className="space-y-3">
              {ROLES.map((r) => (
                <div key={r.value} className="flex gap-3">
                  <div className="mt-0.5 shrink-0">
                    {r.value === "owner" ? (
                      <ShieldCheck className="h-4 w-4 text-ink-3" />
                    ) : (
                      <Users className="h-4 w-4 text-ink-3" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-foreground">{r.label}</p>
                    <p className="text-xs text-muted-foreground">{r.blurb}</p>
                  </div>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
            <DialogHeader>
              <DialogTitle>New staff account</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field-stack sm:col-span-2">
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <div className="field-stack">
                <Label htmlFor="email">Work email</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="field-stack">
                <Label htmlFor="password">Temporary password</Label>
                <Input id="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} />
              </div>
              <div className="field-stack">
                <Label htmlFor="jobTitle">Job title</Label>
                <Input id="jobTitle" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
              </div>
              <div className="field-stack">
                <Label>Access level</Label>
                <RoleSelect value={form.role} onChange={(role) => setForm({ ...form, role })} />
              </div>
              <div className="field-stack">
                <Label htmlFor="regBody">Registration body</Label>
                <Input id="regBody" value={form.registrationBody} onChange={(e) => setForm({ ...form, registrationBody: e.target.value })} />
              </div>
              <div className="field-stack">
                <Label htmlFor="regNo">Registration number</Label>
                <Input id="regNo" value={form.registrationNumber} onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() =>
                  create.mutate({
                    data: {
                      email: form.email.trim(),
                      password: form.password,
                      fullName: form.fullName.trim(),
                      jobTitle: form.jobTitle,
                      role: form.role as "owner" | "practitioner" | "front_desk",
                      registrationBody: form.registrationBody,
                      registrationNumber: form.registrationNumber,
                    },
                  })
                }
                disabled={create.isPending || !form.email || form.password.length < 8 || !form.fullName}
              >
                Create account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      <div className="space-y-3">
        {(team ?? []).map((m: any) => (
          <Card key={m.userId} className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-56 flex-1">
                <Link
                  to="/team/$id"
                  params={{ id: m.userId }}
                  className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                >
                  {m.fullName || m.email}
                  {m.isSelf && <Badge variant="secondary" className="ml-2 rounded-xl">You</Badge>}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {m.email}
                  {m.jobTitle ? ` · ${m.jobTitle}` : ""}
                  {m.registrationNumber ? ` · ${m.registrationBody} ${m.registrationNumber}` : ""}
                </p>
                {canAdmin && !m.hasSignedIn && (
                  <Badge variant="secondary" className="mt-1 rounded-xl">
                    Never signed in — set a password
                  </Badge>
                )}
              </div>
              {canAdmin && (
              <div className="w-44">
                <RoleSelect
                  value={m.role}
                  onChange={(role) =>
                    update.mutate({
                      data: {
                        userId: m.userId,
                        role: role as "owner" | "practitioner" | "front_desk",
                        fullName: m.fullName,
                        jobTitle: m.jobTitle,
                        registrationBody: m.registrationBody,
                        registrationNumber: m.registrationNumber,
                      },
                    })
                  }
                />
              </div>
              )}
              <div className="w-24 text-xs tracking-[0.02em] text-muted-foreground">
                {roleLabel(m.role)}
              </div>
              {canAdmin && (
                <>
                  <EditStaffDialog member={m} onSave={(data) => update.mutate({ data })} saving={update.isPending} />
                  <SetPasswordDialog
                    member={m}
                    saving={setPassword.isPending}
                    onSave={(password) => setPassword.mutate({ data: { userId: m.userId, password } })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Revoke access"
                    disabled={m.isSelf || revoke.isPending}
                    onClick={() => revoke.mutate({ data: { userId: m.userId } })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </Card>
        ))}
      </div>

      {canApprove && (
      <div ref={requestsRef} id="profile-change-requests" className="mt-10">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">Profile change requests</h2>
          {(requests ?? []).filter((r: any) => r.status === "pending").length > 0 && (
            <Badge variant="secondary" className="rounded-full">
              {(requests ?? []).filter((r: any) => r.status === "pending").length} pending
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Updates submitted by staff to their own details. Nothing changes until you approve it.
        </p>
        <div className="mt-4 space-y-3">
          {(requests ?? []).length === 0 && (
            <Card className="border-dashed p-6 text-sm text-muted-foreground">
              No requests yet.
            </Card>
          )}
          {(requests ?? []).map((r: any) => (
            <RequestCard key={r.id} r={r} onReview={(v) => review.mutate({ data: v })} busy={review.isPending} />
          ))}
        </div>
      </div>
      )}

      <div className="mt-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">Diary treatment colours</h2>
          <Link to="/settings" className="text-xs font-medium text-accent-ink hover:underline">
            Open full settings
          </Link>
        </div>
        <TreatmentCatalogueSettings canEdit={canEditTreatments} />
      </div>
    </AppShell>
  );
}

function EditStaffDialog({
  member,
  onSave,
  saving,
}: {
  member: any;
  onSave: (data: any) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: member.fullName ?? "",
    jobTitle: member.jobTitle ?? "",
    registrationBody: member.registrationBody ?? "",
    registrationNumber: member.registrationNumber ?? "",
    role: member.role as string,
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v)
          setForm({
            fullName: member.fullName ?? "",
            jobTitle: member.jobTitle ?? "",
            registrationBody: member.registrationBody ?? "",
            registrationNumber: member.registrationNumber ?? "",
            role: member.role,
          });
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Edit ${member.fullName || member.email}`}>
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {member.fullName || member.email}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="field-stack sm:col-span-2">
            <Label htmlFor={`e-name-${member.userId}`}>Full name</Label>
            <Input
              id={`e-name-${member.userId}`}
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          <div className="field-stack">
            <Label htmlFor={`e-job-${member.userId}`}>Job title</Label>
            <Input
              id={`e-job-${member.userId}`}
              value={form.jobTitle}
              onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
            />
          </div>
          <div className="field-stack">
            <Label>Access level</Label>
            <RoleSelect value={form.role} onChange={(role) => setForm({ ...form, role })} />
          </div>
          <div className="field-stack">
            <Label htmlFor={`e-body-${member.userId}`}>Registration body</Label>
            <Input
              id={`e-body-${member.userId}`}
              value={form.registrationBody}
              onChange={(e) => setForm({ ...form, registrationBody: e.target.value })}
            />
          </div>
          <div className="field-stack">
            <Label htmlFor={`e-no-${member.userId}`}>Registration number</Label>
            <Input
              id={`e-no-${member.userId}`}
              value={form.registrationNumber}
              onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={saving || !form.fullName.trim()}
            onClick={() => {
              onSave({
                userId: member.userId,
                role: form.role as "owner" | "practitioner" | "front_desk",
                fullName: form.fullName.trim(),
                jobTitle: form.jobTitle,
                registrationBody: form.registrationBody,
                registrationNumber: form.registrationNumber,
              });
              setOpen(false);
            }}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestCard({ r, onReview, busy }: { r: any; onReview: (v: any) => void; busy: boolean }) {
  const [note, setNote] = useState("");
  const pending = r.status === "pending";
  const line = (label: string, from: string, to: string) =>
    (from ?? "") === (to ?? "") ? null : (
      <p key={label} className="text-xs text-muted-foreground">
        {label}: <span className="line-through">{from || "—"}</span> → <span className="text-foreground">{to || "—"}</span>
      </p>
    );

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-56 flex-1">
          <div className="flex items-center gap-2 text-sm text-foreground">
            {r.current?.full_name || r.full_name}
            {pending ? (
              <Badge variant="secondary">
                <Clock className="h-3 w-3" /> Pending
              </Badge>
            ) : (
              <Badge variant="outline" className="capitalize">
                {r.status}
              </Badge>
            )}
          </div>
          <div className="mt-2 space-y-1">
            {line("Name", r.current?.full_name ?? "", r.full_name ?? "")}
            {line("Job title", r.current?.job_title ?? "", r.job_title ?? "")}
            {line("Registration body", r.current?.registration_body ?? "", r.registration_body ?? "")}
            {line("Registration number", r.current?.registration_number ?? "", r.registration_number ?? "")}
          </div>
          {r.note && <p className="mt-2 text-xs italic text-muted-foreground">“{r.note}”</p>}
        </div>
        {pending && (
          <div className="w-full space-y-2 sm:w-64">
            <Textarea
              rows={2}
              placeholder="Note back to the practitioner (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={busy}
                onClick={() => onReview({ id: r.id, approve: true, reviewerNote: note })}
              >
                Approve
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={busy}
                onClick={() => onReview({ id: r.id, approve: false, reviewerNote: note })}
              >
                Decline
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function SetPasswordDialog({
  member,
  onSave,
  saving,
}: {
  member: { fullName: string; email: string };
  onSave: (password: string) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Set password">
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>Set a password</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Give {member.fullName || member.email} a password so they can sign in at the normal sign-in
          page with their email. Share it with them privately and ask them to change it later.
        </p>
        <div className="field-stack">
          <Label htmlFor={`pw-${member.email}`}>New password</Label>
          <Input
            id={`pw-${member.email}`}
            type="text"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        <DialogFooter>
          <Button
            disabled={saving || password.length < 8}
            onClick={() => {
              onSave(password);
              setPassword("");
              setOpen(false);
            }}
          >
            Save password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
