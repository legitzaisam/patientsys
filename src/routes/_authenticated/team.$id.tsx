import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type TouchEvent } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { getStaffProfile, updateStaffMember } from "@/lib/clinic.functions";
import { can } from "@/lib/permissions";
import { useIdentity } from "@/lib/use-identity";
import { usePanelWidth } from "@/hooks/use-panel-width";
import { AppShell } from "@/components/app-shell";
import { StaffAvatar, StaffDocuments } from "@/components/staff-files";
import { StaffDocCompliance } from "@/components/staff-doc-compliance";
import { StaffChatPanel } from "@/components/staff-chat-panel";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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

  const [chatWidth, setChatWidth] = usePanelWidth("staff-messages", 360);
  const [resizing, setResizing] = useState(false);
  const resizeStart = useRef({ x: 0, width: 360 });

  function startResize(e: MouseEvent | TouchEvent) {
    const clientX = "touches" in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
    resizeStart.current = { x: clientX, width: chatWidth };
    setResizing(true);
  }

  useEffect(() => {
    if (!resizing) return;
    function onMove(e: globalThis.MouseEvent | globalThis.TouchEvent) {
      const clientX = "touches" in e ? (e.touches[0]?.clientX ?? 0) : e.clientX;
      const delta = resizeStart.current.x - clientX;
      const next = Math.max(280, Math.min(520, resizeStart.current.width + delta));
      setChatWidth(next);
    }
    function onUp() {
      setResizing(false);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [resizing, setChatWidth]);

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

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!identity.isStaff)
    return (
      <AppShell identity={identity}>
        <p className="text-sm text-muted-foreground">Staff access only.</p>
      </AppShell>
    );

  // Own details live on My profile — staff profile is for others viewing you.
  if (identity.userId === id) {
    return <Navigate to="/profile" replace />;
  }

  const canEdit = identity.isManager;
  const canViewTeam = can(identity, "team.view");
  const showChat = true;
  const canViewDocuments = Boolean(data?.canViewDocuments);
  const displayName = form.fullName || data?.profile?.full_name || "Team member";
  const asideTitle =
    form.jobTitle.trim() || (canEdit ? roleLabel(form.role) : data?.email || "Team member");

  return (
    <AppShell identity={identity}>
      {canViewTeam ? (
        <Link
          to="/team"
          className="-mt-1 mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to team
        </Link>
      ) : null}

      <div
        className={
          showChat
            ? "relative grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_var(--chat-width)] md:gap-[26px]"
            : "relative space-y-5"
        }
        style={showChat ? ({ "--chat-width": `${chatWidth}px` } as CSSProperties) : undefined}
      >
        <div className={showChat ? "min-w-0 space-y-5" : undefined}>
          <div>
            <h1 className="page-title">Staff profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {canEdit
                ? `Review and update ${displayName}'s details.`
                : `View ${displayName}'s details. Only managers can edit.`}
            </p>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="grid sm:grid-cols-[13.5rem_minmax(0,1fr)]">
              <aside className="flex flex-col items-center border-b border-edge bg-glass-2/70 px-5 pt-5 pb-6 sm:border-b-0 sm:border-r sm:px-6 sm:pt-6 sm:pb-7">
                <div className="flex w-full max-w-[8.5rem] flex-col items-center gap-3">
                  <div className="w-full text-center">
                    <p className="text-balance text-sm font-semibold leading-none tracking-[-0.012em] text-foreground">
                      {form.fullName.trim() || displayName}
                    </p>
                    <p className="mt-1 text-pretty text-2xs leading-snug text-muted-foreground">
                      {asideTitle}
                    </p>
                  </div>
                  <StaffAvatar
                    userId={id}
                    fullName={displayName}
                    avatarPath={data?.profile?.avatar_url ?? null}
                    readOnly={!canEdit}
                    size="md"
                    queryKey={["staff-profile", id]}
                  />
                </div>
              </aside>

              <div className="flex min-w-0 flex-col">
                <div className="grid gap-x-5 gap-y-4 p-5 pb-4 sm:grid-cols-2 sm:gap-x-6 sm:p-6 sm:px-7 sm:pb-4">
                  <div className="field-stack min-w-0 sm:col-span-2">
                    <Label htmlFor="sp-name">Full name</Label>
                    <Input
                      id="sp-name"
                      value={form.fullName}
                      readOnly={!canEdit}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    />
                  </div>
                  <div className="field-stack min-w-0">
                    <Label htmlFor="sp-job">Job title</Label>
                    <Input
                      id="sp-job"
                      value={form.jobTitle}
                      readOnly={!canEdit}
                      onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                      placeholder="e.g. Aesthetic practitioner"
                    />
                  </div>
                  <div className="field-stack min-w-0">
                    <Label htmlFor="sp-email">Work email</Label>
                    <Input id="sp-email" value={data?.email ?? ""} disabled />
                  </div>
                  <div className="field-stack min-w-0">
                    <Label htmlFor="sp-body">Registration body</Label>
                    <Input
                      id="sp-body"
                      value={form.registrationBody}
                      readOnly={!canEdit}
                      onChange={(e) => setForm({ ...form, registrationBody: e.target.value })}
                      placeholder="e.g. JCCP, NMC"
                    />
                  </div>
                  <div className="field-stack min-w-0">
                    <Label htmlFor="sp-no">Registration number</Label>
                    <Input
                      id="sp-no"
                      value={form.registrationNumber}
                      readOnly={!canEdit}
                      onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                    />
                  </div>
                  {canEdit ? (
                    <div className="field-stack min-w-0">
                      <Label htmlFor="sp-role">Access level</Label>
                      <select
                        id="sp-role"
                        value={form.role}
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
                  ) : null}
                  {canEdit ? (
                    <div className="field-stack min-w-0">
                      <Label htmlFor="sp-commission">Commission rate</Label>
                      <div className="flex max-w-[10rem] items-center gap-2">
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
                  ) : null}
                  {canEdit ? (
                    <div className="flex items-center justify-end sm:col-span-2">
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
                        {save.isPending ? "Saving…" : "Save changes"}
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>

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

        {showChat ? (
          <StaffChatPanel
            peerUserId={id}
            {...(displayName !== "Team member" ? { peerName: displayName } : {})}
            autoFocus={Boolean(openChat)}
            onResizeStart={startResize}
          />
        ) : null}
      </div>
    </AppShell>
  );
}
