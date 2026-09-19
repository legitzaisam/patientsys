import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Check, X } from "lucide-react";
import { getMyProfile, saveMyProfile } from "@/lib/clinic.functions";
import { joinStaffName, splitStaffName, STAFF_TITLES } from "@/lib/staff-name";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { StaffAvatar } from "@/components/staff-files";
import { MyPerformanceKpis } from "@/components/performance/my-performance-kpis";
import { ProfileAccountTabs } from "@/components/profile-account-tabs";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — Aetheria" },
      {
        name: "description",
        content: "Update your practitioner details, registration and documents.",
      },
      { property: "og:title", content: "My profile — Aetheria" },
      { property: "og:description", content: "Keep your registration and job details up to date." },
    ],
  }),
  component: ProfilePage,
});

const STATUS: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Awaiting manager approval", className: "text-warning-ink", icon: Clock },
  approved: { label: "Approved", className: "text-success", icon: Check },
  declined: { label: "Declined", className: "text-destructive", icon: X },
};

function ProfilePage() {
  const { data: identity } = useIdentity();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);

  const { data } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
    enabled: !!identity?.isStaff,
  });

  const [form, setForm] = useState({
    title: "",
    fullName: "",
    jobTitle: "",
    registrationBody: "",
    registrationNumber: "",
  });

  // Sync from server only when those fields change — not on every query object identity.
  useEffect(() => {
    if (!data?.profile) return;
    const split = splitStaffName(data.profile.full_name ?? "");
    setForm({
      title: split.title,
      fullName: split.name,
      jobTitle: data.profile.job_title ?? "",
      registrationBody: data.profile.registration_body ?? "",
      registrationNumber: data.profile.registration_number ?? "",
    });
  }, [
    data?.profile?.full_name,
    data?.profile?.job_title,
    data?.profile?.registration_body,
    data?.profile?.registration_number,
  ]);

  const saveProfile = useServerFn(saveMyProfile);

  const submit = useMutation({
    mutationFn: async () =>
      saveProfile({
        data: {
          fullName: joinStaffName(form.title, form.fullName),
          jobTitle: form.jobTitle,
          registrationBody: form.registrationBody,
          registrationNumber: form.registrationNumber,
        },
      }),
    onSuccess: () => {
      toast.success("Profile saved");
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!identity.isStaff)
    return (
      <AppShell identity={identity}>
        <p className="text-sm text-muted-foreground">Staff access only.</p>
      </AppShell>
    );

  const requests = (data?.requests ?? []) as any[];

  return (
    <AppShell identity={identity}>
      <div className="mb-6">
        <h1 className="page-title">My profile</h1>
        <p className="page-subtitle">
          Update your name, job title and registration details — changes apply as soon as you save.
        </p>
      </div>

      <div
        className={
          requests.length > 0
            ? "grid items-start gap-5 lg:grid-cols-3"
            : undefined
        }
      >
        <Card className={requests.length > 0 ? "overflow-hidden p-0 lg:col-span-2" : "overflow-hidden p-0"}>
          <div className="grid sm:grid-cols-[13.5rem_minmax(0,1fr)]">
            <aside className="flex flex-col items-center border-b border-edge bg-glass-2/70 px-5 pt-5 pb-6 sm:border-b-0 sm:border-r sm:px-6 sm:pt-6 sm:pb-7">
              <div className="flex w-full max-w-[8.5rem] flex-col items-center gap-3">
                <div className="w-full text-center">
                  <p className="text-balance text-sm font-semibold leading-none tracking-[-0.012em] text-foreground">
                    {joinStaffName(form.title, form.fullName) || "Your name"}
                  </p>
                  <p className="mt-1 text-pretty text-2xs leading-snug text-muted-foreground">
                    {form.jobTitle.trim() || identity.email}
                  </p>
                </div>
                <StaffAvatar
                  userId={identity.userId}
                  fullName={joinStaffName(form.title, form.fullName) || identity.email}
                  avatarPath={data?.profile?.avatar_url ?? null}
                  size="md"
                />
              </div>
            </aside>

            <div className="flex min-w-0 flex-col">
              <div className="grid gap-x-5 gap-y-4 p-5 pb-4 sm:grid-cols-2 sm:gap-x-6 sm:p-6 sm:px-7 sm:pb-4">
                <div className="field-stack min-w-0">
                  <Label htmlFor="p-title">Title</Label>
                  <select
                    id="p-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="flex h-9 w-full rounded-[11px] border border-edge bg-glass-2 px-3 text-[13px] shadow-inset-hi outline-none transition-colors hover:border-edge-2 focus-visible:border-accent-deep focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">—</option>
                    {STAFF_TITLES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field-stack min-w-0">
                  <Label htmlFor="p-name">Full name</Label>
                  <Input
                    id="p-name"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    autoComplete="name"
                  />
                </div>
                <div className="field-stack min-w-0">
                  <Label htmlFor="p-job">Job title</Label>
                  <Input
                    id="p-job"
                    value={form.jobTitle}
                    onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                    placeholder="e.g. Aesthetic practitioner"
                  />
                </div>
                <div className="field-stack min-w-0">
                  <Label htmlFor="p-email">Work email</Label>
                  <Input id="p-email" value={identity.email} disabled />
                </div>
                <div className="field-stack min-w-0">
                  <Label htmlFor="p-body">Registration body</Label>
                  <Input
                    id="p-body"
                    value={form.registrationBody}
                    onChange={(e) => setForm({ ...form, registrationBody: e.target.value })}
                    placeholder="e.g. JCCP, NMC"
                  />
                </div>
                <div className="field-stack min-w-0">
                  <Label htmlFor="p-no">Registration number</Label>
                  <Input
                    id="p-no"
                    value={form.registrationNumber}
                    onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                  />
                </div>
                <div className="flex items-center justify-end sm:col-span-2">
                  <Button
                    disabled={submit.isPending || !form.fullName.trim()}
                    onClick={() => submit.mutate()}
                  >
                    {submit.isPending ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {requests.length > 0 ? (
          <Card className="flex h-[308px] min-h-0 flex-col overflow-hidden p-5">
            <h2 className="section-title">Earlier change requests</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Past requests sent for manager review. New edits save immediately.
            </p>
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
              {requests.map((r) => {
                const s = STATUS[r.status] ?? STATUS["pending"]!;
                const Icon = s.icon;
                return (
                  <div key={r.id} className="rounded-2xl border border-glass-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs ${s.className}`}>
                        <Icon className="h-3.5 w-3.5" /> {s.label}
                      </span>
                      <span className="text-2xs tabular-nums text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("en-GB")}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-foreground">{r.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {[r.job_title, [r.registration_body, r.registration_number].filter(Boolean).join(" ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {r.note && <p className="mt-2 text-xs italic text-muted-foreground">“{r.note}”</p>}
                    {r.reviewer_note && (
                      <p className="mt-2 text-xs text-muted-foreground">Manager: {r.reviewer_note}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ) : null}
      </div>

      {identity.roles.includes("practitioner") || identity.isOwner ? (
        <div className="mt-6">
          <MyPerformanceKpis />
        </div>
      ) : null}

      <div className="mt-6">
        <ProfileAccountTabs userId={identity.userId} identity={identity} />
      </div>
    </AppShell>
  );
}
