import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { getStaffProfile, updateStaffMember } from "@/lib/clinic.functions";
import { can } from "@/lib/permissions";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { StaffAvatar, StaffDocuments } from "@/components/staff-files";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StaffChatPanel } from "@/components/staff-chat-panel";

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
    role: "practitioner" as "owner" | "practitioner" | "front_desk",
    commissionRate: "0",
  });

  useEffect(() => {
    if (!data?.profile) return;
    setForm({
      fullName: data.profile.full_name ?? "",
      jobTitle: data.profile.job_title ?? "",
      registrationBody: data.profile.registration_body ?? "",
      registrationNumber: data.profile.registration_number ?? "",
      role: (data.role as "owner" | "practitioner" | "front_desk") ?? "practitioner",
      commissionRate: String(Number(data.profile.commission_rate ?? 0)),
    });
  }, [data?.profile, data?.role]);

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!identity.isStaff)
    return (
      <AppShell identity={identity}>
        <p className="text-sm text-muted-foreground">Staff access only.</p>
      </AppShell>
    );


  useEffect(() => {
    if (!openChat) return;
    const el = document.getElementById("staff-chat");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [openChat, data?.profile?.full_name]);

  const canEdit = can(identity, "team.view") && identity.isOwner;
  const isSelf = identity.userId === id;

  return (
    <AppShell identity={identity}>
      <Link to="/team" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to team
      </Link>

      <div className="mb-6">
        <h1 className="page-title">Staff profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and update {data?.profile?.full_name || "this team member"}'s details.
        </p>
      </div>

      <Card className="p-5">
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
          <div className="sm:w-40">
            <StaffAvatar
              userId={id}
              fullName={form.fullName || data?.profile?.full_name || data?.email || "Staff"}
              avatarPath={data?.profile?.avatar_url ?? null}
              queryKey={["staff-profile", id]}
            />
          </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="field-stack sm:col-span-2">
                <Label htmlFor="sp-name">Full name</Label>
                <Input id="sp-name" value={form.fullName} readOnly={!canEdit} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
              </div>
              <div className="field-stack">
                <Label htmlFor="sp-job">Job title</Label>
                <Input id="sp-job" value={form.jobTitle} readOnly={!canEdit} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
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
                  onChange={(e) => setForm({ ...form, registrationBody: e.target.value })}
                />
              </div>
              <div className="field-stack">
                <Label htmlFor="sp-no">Registration number</Label>
                <Input
                  id="sp-no"
                  value={form.registrationNumber}
                  onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                />
              </div>
              <div className="field-stack">
                <Label htmlFor="sp-role">Access level</Label>
                <select
                  id="sp-role"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as typeof form.role })}
                  className="h-10 w-full rounded-xl border border-edge-2 bg-glass-2 shadow-inset-hi px-3 text-sm text-foreground"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
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

      {!isSelf && (
        <div className="mt-6">
          <StaffChatPanel
            peerUserId={id}
            {...(form.fullName || data?.profile?.full_name
              ? { peerName: form.fullName || data?.profile?.full_name || "" }
              : {})}
            autoFocus={Boolean(openChat)}
          />
        </div>
      )}

      <div className="mt-6">
        <StaffDocuments userId={id} readOnly queryKey={["staff-documents", id]} />
      </div>
    </AppShell>
  );
}
