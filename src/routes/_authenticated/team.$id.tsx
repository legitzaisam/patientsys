import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { getStaffProfile, updateStaffMember } from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { StaffAvatar, StaffDocuments } from "@/components/staff-files";
import { StaffDocCompliance } from "@/components/staff-doc-compliance";
import { StaffChatPanel } from "@/components/staff-chat-panel";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/team/$id")({
  validateSearch: (search: Record<string, unknown>): { chat?: boolean } => {
    const raw = search["chat"];
    if (raw === true || raw === "1" || raw === 1) return { chat: true };
    return {};
  },
  head: () => ({
    meta: [
      { title: "Staff profile — Aetheria" },
      {
        name: "description",
        content: "View and manage a staff member's profile, registration details and documents.",
      },
      { property: "og:title", content: "Staff profile — Aetheria" },
      { property: "og:description", content: "View and manage a staff member's profile." },
    ],
  }),
  component: StaffProfilePage,
});

const ROLES = [
  { value: "owner", label: "Clinic owner" },
  { value: "manager", label: "Manager" },
  { value: "practitioner", label: "Practitioner" },
  { value: "front_desk", label: "Receptionist" },
] as const;

function roleLabel(role: string) {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

function StaffProfilePage() {
  const { id } = Route.useParams();
  const { chat: openChat } = Route.useSearch();
  const { data: identity } = useIdentity();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getStaffProfile);

  const save = useMutation({
    mutationFn: useServerFn(updateStaffMember),
    onSuccess: () => {
      toast.success("Profile updated");
      queryClient.invalidateQueries({ queryKey: ["staff-profile", id] });
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["performance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data } = useQuery({
    queryKey: ["staff-profile", id],
    queryFn: () => fetchProfile({ data: { userId: id } }),
    enabled: Boolean(identity?.isStaff),
  });

  const [form, setForm] = useState({
    fullName: "",
    jobTitle: "",
    registrationBody: "",
    registrationNumber: "",
    role: "practitioner" as "owner" | "manager" | "practitioner" | "front_desk",
    commissionRate: "0",
  });

  useEffect(() => {
    if (!data?.profile) return;
    setForm({
      fullName: data.profile.full_name ?? "",
      jobTitle: data.profile.job_title ?? "",
      registrationBody: data.profile.registration_body ?? "",
      registrationNumber: data.profile.registration_number ?? "",
      role: (data.role as "owner" | "manager" | "practitioner" | "front_desk") || "practitioner",
      commissionRate: String(Number(data.profile.commission_rate ?? 0)),
    });
  }, [data?.profile, data?.role]);

  useEffect(() => {
    if (!openChat) return;
    const el = document.getElementById("staff-chat");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [openChat, data?.profile?.full_name]);

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!identity.isStaff)
    return (
      <AppShell identity={identity}>
        <p className="text-sm text-muted-foreground">Staff access only.</p>
      </AppShell>
    );

  const canEdit = identity.isOwner;
  const isSelf = identity.userId === id;
  const showChat = !isSelf;
  const canViewPrivate = Boolean(data?.canViewPrivateDetails);
  const canViewDocuments = Boolean(data?.canViewDocuments);
  const displayName = form.fullName || data?.profile?.full_name || "Team member";

  return (
    <AppShell identity={identity}>
      <Link
        to="/team"
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to team
      </Link>

      <div className="mb-6">
        <h1 className="page-title">Staff profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {canEdit
            ? `Review and update ${displayName}'s details.`
            : canViewPrivate
              ? `View ${displayName}'s details and documents.`
              : `Contact ${displayName} and check essential document status.`}
        </p>
      </div>

      {canViewPrivate ? (
        <Card className="p-5">
          <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
            <div className="sm:w-40">
              <StaffAvatar
                userId={id}
                fullName={displayName}
                avatarPath={data?.profile?.avatar_url ?? null}
                readOnly={!canEdit && !isSelf}
                queryKey={["staff-profile", id]}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field-stack sm:col-span-2">
                <Label htmlFor="sp-name">Full name</Label>
                <Input
                  id="sp-name"
                  value={form.fullName}
                  readOnly={!canEdit}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
              </div>
              <div className="field-stack">
                <Label htmlFor="sp-job">Job title</Label>
                <Input
                  id="sp-job"
                  value={form.jobTitle}
                  readOnly={!canEdit}
                  onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                />
              </div>
              <div className="field-stack">
                <Label htmlFor="sp-email">Work email</Label>
                <Input id="sp-email" value={data?.email ?? ""} disabled />
              </div>
              <div className="field-stack">
                <Label htmlFor="sp-body">Registration body</Label>
                <Input
                  id="sp-body"
                  value={form.registrationBody}
                  readOnly={!canEdit}
                  onChange={(e) => setForm({ ...form, registrationBody: e.target.value })}
                />
              </div>
              <div className="field-stack">
                <Label htmlFor="sp-no">Registration number</Label>
                <Input
                  id="sp-no"
                  value={form.registrationNumber}
                  readOnly={!canEdit}
                  onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                />
              </div>
              <div className="field-stack">
                <Label htmlFor="sp-role">Access level</Label>
                <select
                  id="sp-role"
                  value={form.role}
                  disabled={!canEdit}
                  onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}
                  className="h-10 w-full rounded-xl border border-edge-2 bg-glass-2 px-3 text-sm text-foreground shadow-inset-hi disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              {canEdit && (
                <div className="field-stack">
                  <Label htmlFor="sp-commission">Commission rate</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="sp-commission"
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={form.commissionRate}
                      onChange={(e) => setForm({ ...form, commissionRate: e.target.value })}
                      className="rounded-xl"
                    />
                    <span className="shrink-0 text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="text-2xs text-muted-foreground">
                    Share of treatment revenue paid to this person.
                  </p>
                </div>
              )}
            </div>
          </div>
          {canEdit && (
            <div className="mt-5 flex items-center justify-end gap-4">
              <Button
                disabled={save.isPending || !form.fullName.trim()}
                onClick={() =>
                  save.mutate({
                    data: {
                      userId: id,
                      role: form.role,
                      fullName: form.fullName.trim(),
                      jobTitle: form.jobTitle,
                      registrationBody: form.registrationBody,
                      registrationNumber: form.registrationNumber,
                      commissionRate: Number(form.commissionRate),
                    },
                  })
                }
              >
                Save changes
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <Card className="p-5">
          <div className="flex flex-wrap items-center gap-4">
            <StaffAvatar
              userId={id}
              fullName={displayName}
              avatarPath={data?.profile?.avatar_url ?? null}
              readOnly
              size="sm"
              queryKey={["staff-profile", id]}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">
                  {displayName}
                </h2>
                {data?.role ? (
                  <Badge variant="secondary" className="rounded-xl">
                    {roleLabel(data.role)}
                  </Badge>
                ) : null}
              </div>
              {form.jobTitle ? (
                <p className="mt-1 text-sm text-muted-foreground">{form.jobTitle}</p>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Team member</p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Private details stay with clinic managers. Use chat to get in touch.
              </p>
            </div>
          </div>
        </Card>
      )}

      {showChat && (
        <div className="mt-6">
          <StaffChatPanel
            peerUserId={id}
            {...(displayName !== "Team member" ? { peerName: displayName } : {})}
            autoFocus={Boolean(openChat)}
          />
        </div>
      )}

      <div className="mt-6">
        {canViewDocuments ? (
          <StaffDocuments userId={id} readOnly queryKey={["staff-documents", id]} />
        ) : (
          <StaffDocCompliance
            userId={id}
            fullName={displayName}
            presentCategories={data?.presentCategories ?? []}
          />
        )}
      </div>
    </AppShell>
  );
}
