import { createFileRoute, Link } from "@tanstack/react-router";
import { isDirtyForm, useUnsavedChanges } from "@/hooks/use-unsaved-changes";
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
import { ProfileAccountTabs, type ProfileTab } from "@/components/profile-account-tabs";
import { Textarea } from "@/components/ui/textarea";
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

/** Statutory registers a UK aesthetics practitioner may hold; "None" for unregistered staff. */
const REGISTRATION_BODIES = ["GMC", "NMC", "GPhC", "GDC", "HCPC", "None"] as const;

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

  const blankForm = {
    title: "",
    fullName: "",
    jobTitle: "",
    registrationBody: "",
    registrationNumber: "",
    registrationExpiry: "",
    insuranceProvider: "",
    insuranceExpiry: "",
    qualifications: "",
  };
  // Profile, then Security and Documents, as tabs above the heading.
  const [tab, setTab] = useState<"profile" | ProfileTab>("profile");
  const [form, setForm] = useState(blankForm);
  // What the server holds, so we can tell an edited form from a saved one.
  const [saved, setSaved] = useState<typeof blankForm | null>(null);

  // Sync from server only when those fields change — not on every query object identity.
  useEffect(() => {
    if (!data?.profile) return;
    const split = splitStaffName(data.profile.full_name ?? "");
    const next = {
      title: split.title,
      fullName: split.name,
      jobTitle: data.profile.job_title ?? "",
      registrationBody: data.profile.registration_body ?? "",
      registrationNumber: data.profile.registration_number ?? "",
      registrationExpiry: (data.profile.registration_expiry ?? "").slice(0, 10),
      insuranceProvider: data.profile.insurance_provider ?? "",
      insuranceExpiry: (data.profile.insurance_expiry ?? "").slice(0, 10),
      qualifications: data.profile.qualifications ?? "",
    };
    setForm(next);
    setSaved(next);
  }, [
    data?.profile?.full_name,
    data?.profile?.job_title,
    data?.profile?.registration_body,
    data?.profile?.registration_number,
    data?.profile?.registration_expiry,
    data?.profile?.insurance_provider,
    data?.profile?.insurance_expiry,
    data?.profile?.qualifications,
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
          registrationExpiry: form.registrationExpiry,
          insuranceProvider: form.insuranceProvider,
          insuranceExpiry: form.insuranceExpiry,
          qualifications: form.qualifications,
        },
      }),
    onSuccess: () => {
      toast.success("Profile saved");
      setSaved(form);
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leaveGuard = useUnsavedChanges(
    isDirtyForm(form, saved) && !submit.isPending,
    "profile-unsaved",
  );

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
      {leaveGuard}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {tab === "profile" ? "My profile" : tab === "security" ? "Security" : "Documents"}
          </h1>
          <p className="page-subtitle">
            {tab === "profile"
              ? "Your name, job title, registration and insurance — changes apply as soon as you save."
              : tab === "security"
                ? "Email sign-in codes, password, and the devices currently signed in as you."
                : "Records required for JCCP and UK clinic practice. Only you and clinic managers can open them."}
          </p>
        </div>
        <div
          role="tablist"
          aria-label="My profile sections"
          className="flex h-[34px] shrink-0 items-center gap-0.5 rounded-full border border-edge bg-glass-2 p-0.5 shadow-inset-hi"
        >
          {(
            [
              { key: "profile", label: "Profile" },
              { key: "security", label: "Security" },
              { key: "documents", label: "Documents" },
            ] as const
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              role="tab"
              aria-selected={tab === o.key}
              onClick={() => setTab(o.key)}
              data-qc={`profile-tab-${o.key}`}
              className={`h-7 cursor-pointer whitespace-nowrap rounded-full px-3.5 text-xs tracking-[0.02em] transition-colors ${
                tab === o.key
                  ? "bg-accent-soft font-semibold text-foreground shadow-[inset_0_0_0_1px_var(--edge)]"
                  : "text-ink-2 hover:bg-[rgba(47,63,102,0.08)] hover:text-foreground active:bg-[rgba(47,63,102,0.14)]"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {tab !== "profile" ? (
        <ProfileAccountTabs userId={identity.userId} identity={identity} tab={tab} />
      ) : (
        <>
          <div
            className={requests.length > 0 ? "grid items-start gap-5 lg:grid-cols-3" : undefined}
          >
            <Card
              className={
                requests.length > 0 ? "overflow-hidden p-0 lg:col-span-2" : "overflow-hidden p-0"
              }
            >
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
                      <p className="text-xs text-muted-foreground">
                        Ask the clinic owner to change this.
                      </p>
                    </div>
                    <div className="field-stack min-w-0">
                      <Label htmlFor="p-body">Registration body</Label>
                      <select
                        id="p-body"
                        value={form.registrationBody}
                        onChange={(e) => setForm({ ...form, registrationBody: e.target.value })}
                        data-qc="registration-body"
                        className="flex h-9 w-full rounded-[11px] border border-edge bg-glass-2 px-3 text-[13px] shadow-inset-hi outline-none transition-colors hover:border-edge-2 focus-visible:border-accent-deep focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="">—</option>
                        {REGISTRATION_BODIES.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                        {form.registrationBody &&
                        !(REGISTRATION_BODIES as readonly string[]).includes(
                          form.registrationBody,
                        ) ? (
                          <option value={form.registrationBody}>{form.registrationBody}</option>
                        ) : null}
                      </select>
                    </div>
                    <div className="field-stack min-w-0">
                      <Label htmlFor="p-no">Registration number</Label>
                      <Input
                        id="p-no"
                        value={form.registrationNumber}
                        onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                        disabled={form.registrationBody === "None"}
                      />
                    </div>
                    <div className="field-stack min-w-0">
                      <Label htmlFor="p-reg-expiry">Registration expiry</Label>
                      <Input
                        id="p-reg-expiry"
                        type="date"
                        value={form.registrationExpiry}
                        onChange={(e) => setForm({ ...form, registrationExpiry: e.target.value })}
                        disabled={form.registrationBody === "None"}
                      />
                    </div>
                    <div className="field-stack min-w-0">
                      <Label htmlFor="p-insurer">Insurance provider</Label>
                      <Input
                        id="p-insurer"
                        value={form.insuranceProvider}
                        onChange={(e) => setForm({ ...form, insuranceProvider: e.target.value })}
                        placeholder="e.g. Hamilton Fraser"
                      />
                    </div>
                    <div className="field-stack min-w-0">
                      <Label htmlFor="p-ins-expiry">Insurance expiry</Label>
                      <Input
                        id="p-ins-expiry"
                        type="date"
                        value={form.insuranceExpiry}
                        onChange={(e) => setForm({ ...form, insuranceExpiry: e.target.value })}
                      />
                    </div>
                    <div className="field-stack min-w-0 sm:col-span-2">
                      <Label htmlFor="p-quals">Qualifications</Label>
                      <Textarea
                        id="p-quals"
                        rows={2}
                        value={form.qualifications}
                        onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
                        placeholder="e.g. Level 7 in Aesthetic Medicine, Foundation botulinum toxin and dermal fillers"
                        className="rounded-xl"
                      />
                      <p className="text-xs text-muted-foreground">
                        The clinic owner is reminded 60 days before a registration or insurance
                        expiry.
                      </p>
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
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs ${s.className}`}
                          >
                            <Icon className="h-3.5 w-3.5" /> {s.label}
                          </span>
                          <span className="text-2xs tabular-nums text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString("en-GB")}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-foreground">{r.full_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[
                            r.job_title,
                            [r.registration_body, r.registration_number].filter(Boolean).join(" "),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {r.note && (
                          <p className="mt-2 text-xs italic text-muted-foreground">“{r.note}”</p>
                        )}
                        {r.reviewer_note && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Manager: {r.reviewer_note}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : null}
          </div>

          {identity.roles.includes("practitioner") ||
          (identity.isOwner && identity.treatsPatients) ? (
            <div className="mt-6">
              <MyPerformanceKpis />
            </div>
          ) : null}
        </>
      )}
    </AppShell>
  );
}
