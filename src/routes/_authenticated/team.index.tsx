import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Pencil, Clock, KeyRound } from "lucide-react";
import {
  listTeam,
  updateStaffMember,
  revokeStaffAccess,
  listExTeamMembers,
  restoreExTeamMember,
  listProfileChangeRequests,
  reviewProfileChange,
  setStaffPassword,
} from "@/lib/clinic.functions";
import { can } from "@/lib/permissions";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { InviteStaffDialog } from "@/components/invite-staff-dialog";
import { AccessControlSettings } from "@/components/access-control-settings";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/team/")({
  component: TeamPage,
});

const ROLES = [
  { value: "owner", label: "Clinic owner" },
  { value: "manager", label: "Manager" },
  { value: "practitioner", label: "Practitioner" },
  { value: "front_desk", label: "Receptionist" },
] as const;

function RoleSelect({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        className ??
        "h-9 w-full rounded-xl border border-edge-2 bg-glass-2 shadow-inset-hi px-3 text-sm text-foreground"
      }
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

  const { data: team } = useQuery({
    queryKey: ["team"],
    queryFn: () => fetchTeam(),
    enabled: can(identity, "team.view"),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["team"] });
    void queryClient.invalidateQueries({ queryKey: ["ex-team"] });
  };

  const fetchExTeam = useServerFn(listExTeamMembers);
  const { data: exTeam } = useQuery({
    queryKey: ["ex-team"],
    queryFn: () => fetchExTeam(),
    enabled: can(identity, "team.view"),
  });

  const restoreEx = useMutation({
    mutationFn: useServerFn(restoreExTeamMember),
    onSuccess: () => {
      toast.success("Team access restored");
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

  const restoreAccess = useServerFn(updateStaffMember);
  const revoke = useMutation({
    mutationFn: useServerFn(revokeStaffAccess),
    onError: (e: Error) => toast.error(e.message),
  });

  const requestRevoke = (m: {
    userId: string;
    role: "owner" | "manager" | "practitioner" | "front_desk";
    fullName: string;
    email?: string;
    jobTitle?: string;
    registrationBody?: string;
    registrationNumber?: string;
    isSelf?: boolean;
  }) => {
    if (m.isSelf) return;
    const label = m.fullName || m.email || "Staff member";
    const snapshot = {
      userId: m.userId,
      role: m.role,
      fullName: m.fullName || "",
      ...(m.jobTitle ? { jobTitle: m.jobTitle } : {}),
      ...(m.registrationBody ? { registrationBody: m.registrationBody } : {}),
      ...(m.registrationNumber ? { registrationNumber: m.registrationNumber } : {}),
    };

    revoke.mutate(
      { data: { userId: m.userId } },
      {
        onSuccess: () => {
          invalidate();
          toast.success(`Access revoked for ${label}`, {
            action: {
              label: "Undo",
              onClick: () => {
                void restoreAccess({ data: snapshot })
                  .then(() => {
                    toast.success("Access restored");
                    invalidate();
                  })
                  .catch((e: Error) => toast.error(e.message));
              },
            },
            duration: 6000,
          });
        },
      },
    );
  };

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
  const canAdmin = Boolean(identity.isOwner);
  const canManageAccess = Boolean(identity.isOwner);
  if (!canViewTeam)
    return (
      <AppShell identity={identity}>
        <p className="text-sm text-muted-foreground">
          You do not have access to the team page. Ask your manager to enable it under Staff access.
        </p>
      </AppShell>
    );

  return (
    <AppShell identity={identity}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Team &amp; access</h1>
          <p className="page-subtitle">
            {(team ?? []).length} staff accounts{canAdmin ? " · you hold manager access" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
        {canAdmin && <InviteStaffDialog onInvited={invalidate} />}
        </div>
      </div>

      <div
        className={
          canApprove
            ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] lg:items-start"
            : undefined
        }
      >
        <div className="space-y-3">
          {(team ?? []).map((m: any) => (
            <Card key={m.userId} className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="min-w-56 flex-1 space-y-0.5">
                  <Link
                    to="/team/$id"
                    params={{ id: m.userId }}
                    className="block text-sm font-medium text-foreground underline-offset-2 hover:underline"
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
                    <p className="text-xs text-muted-foreground">
                      Never signed in — set a password
                    </p>
                  )}
                </div>
                {canAdmin && (
                <div className="w-32">
                  <RoleSelect
                    value={m.role}
                    className="h-8 w-full rounded-xl border border-edge-2 bg-glass-2 px-2 text-xs text-foreground shadow-inset-hi"
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
                {canAdmin && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Revoke access"
                      disabled={m.isSelf || revoke.isPending}
                      onClick={() =>
                        requestRevoke({
                          userId: m.userId,
                          role: m.role,
                          fullName: m.fullName,
                          email: m.email,
                          jobTitle: m.jobTitle,
                          registrationBody: m.registrationBody,
                          registrationNumber: m.registrationNumber,
                          isSelf: m.isSelf,
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <EditStaffDialog
                      member={m}
                      onSave={(data) => update.mutate({ data })}
                      saving={update.isPending}
                      onSetPassword={(password) =>
                        setPassword.mutate({ data: { userId: m.userId, password } })
                      }
                      passwordSaving={setPassword.isPending}
                    />
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>

        {canApprove && (
          <aside
            id="profile-change-requests"
            className="rounded-[22px] border border-edge bg-glass-2/50 p-4 lg:sticky lg:top-4"
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <h2 className="section-title">
                Profile change requests
              </h2>
              {(requests ?? []).filter((r: any) => r.status === "pending").length > 0 && (
                <Badge variant="secondary" className="rounded-full">
                  {(requests ?? []).filter((r: any) => r.status === "pending").length} pending
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Staff updates wait here until you approve.
            </p>
            <div className="mt-3 space-y-3">
              {(requests ?? []).length === 0 && (
                <Card className="border-dashed p-4 text-xs text-muted-foreground">
                  No requests yet.
                </Card>
              )}
              {(requests ?? []).map((r: any) => (
                <RequestCard key={r.id} r={r} onReview={(v) => review.mutate({ data: v })} busy={review.isPending} />
              ))}
            </div>
          </aside>
        )}
      </div>

      <section className="mt-10 space-y-3">
        <div>
          <h2 className="section-title">
            Former team members
          </h2>
          <p className="page-subtitle">
            Staff identity is kept here for 90 days after access is removed. Patient records,
            appointments and clinical notes stay on the system permanently — they are never
            deleted with this archive.
          </p>
        </div>
        {(exTeam ?? []).length === 0 ? (
          <Card className="border-dashed p-4 text-sm text-muted-foreground">
            No former team members in the retention window.
          </Card>
        ) : (
          <div className="space-y-3">
            {(exTeam ?? []).map((m: any) => (
              <Card key={m.id} className="p-4">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-56 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {m.fullName || m.email || "Former team member"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.email}
                      {m.jobTitle ? ` · ${m.jobTitle}` : ""}
                      {m.role ? ` · ${String(m.role).replaceAll("_", " ")}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Removed {new Date(m.revokedAt).toLocaleDateString("en-GB")} ·{" "}
                      {m.daysRemaining} day{m.daysRemaining === 1 ? "" : "s"} left in archive
                    </p>
                  </div>
                  {canAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={restoreEx.isPending}
                      onClick={() => restoreEx.mutate({ data: { userId: m.userId } })}
                    >
                      Restore access
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {canAdmin && (
        <div className="mt-10">
          <AccessControlSettings canEdit={Boolean(identity.isOwner)} />
        </div>
      )}
    </AppShell>
  );
}

function EditStaffDialog({
  member,
  onSave,
  saving,
  onSetPassword,
  passwordSaving,
}: {
  member: any;
  onSave: (data: any) => void;
  saving: boolean;
  onSetPassword: (password: string) => void;
  passwordSaving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
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
        if (v) {
          setForm({
            fullName: member.fullName ?? "",
            jobTitle: member.jobTitle ?? "",
            registrationBody: member.registrationBody ?? "",
            registrationNumber: member.registrationNumber ?? "",
            role: member.role,
          });
          setPassword("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Edit ${member.fullName || member.email}`}>
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[min(90dvh,720px)] w-[calc(100vw-2rem)] max-w-md flex-col gap-0 overflow-hidden rounded-[22px] border-edge-2 bg-card/95 p-5 shadow-popover sm:rounded-[22px]">
        <DialogHeader className="shrink-0 pr-8 text-left">
          <DialogTitle>
            Edit {member.fullName || member.email}
          </DialogTitle>
          <DialogDescription>
            Update details, access level, or set a sign-in password.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 -mr-4 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="field-stack sm:col-span-2 border-t border-edge pt-3">
              <Label htmlFor={`e-pw-${member.userId}`}>Sign-in password</Label>
              <p className="text-xs text-muted-foreground">
                Optional. Share it privately and ask them to change it after they sign in.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  id={`e-pw-${member.userId}`}
                  type="text"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="sm:flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0 text-xs"
                  disabled={passwordSaving || password.length < 8}
                  onClick={() => {
                    onSetPassword(password);
                    setPassword("");
                  }}
                >
                  <KeyRound className="mr-1.5 h-3.5 w-3.5" />
                  {passwordSaving ? "Saving…" : "Set password"}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="text-xs"
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
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
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
    <Card className="p-3.5">
      <div className="space-y-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-foreground">
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
          <div className="space-y-2">
            <Textarea
              rows={2}
              placeholder="Note back (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="text-xs"
            />
            <div className="flex gap-2">
              <Button
                className="flex-1 text-xs"
                disabled={busy}
                onClick={() => onReview({ id: r.id, approve: true, reviewerNote: note })}
              >
                Approve
              </Button>
              <Button
                variant="outline"
                className="flex-1 text-xs"
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
