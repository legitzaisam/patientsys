import { createFileRoute } from "@tanstack/react-router";
import { isDirtyForm, useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Clock, Check, X } from "lucide-react";
import { getMyProfile, saveMyInstantProfile, saveMyProfile, submitProfileChange } from "@/lib/clinic.functions";
import { checkEmail } from "@/lib/email";
import { joinStaffName, splitStaffName, STAFF_TITLES } from "@/lib/staff-name";
import { WORKING_ARRANGEMENTS } from "@/lib/profile-change-policy";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { StaffAvatar } from "@/components/staff-files";
import { ProfileAccountTabs } from "@/components/profile-account-tabs";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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

const SELECT_CLASS =
  "flex h-9 w-full rounded-[11px] border border-edge bg-glass-2 px-3 text-[13px] shadow-inset-hi outline-none transition-colors hover:border-edge-2 focus-visible:border-accent-deep focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const STATUS: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Awaiting approval", className: "text-warning-ink", icon: Clock },
  approved: { label: "Approved", className: "text-success", icon: Check },
  declined: { label: "Declined", className: "text-destructive", icon: X },
};

const blankForm = {
  title: "",
  fullName: "",
  jobTitle: "",
  workEmail: "",
  workingArrangement: "",
  registrationBody: "",
  registrationNumber: "",
  registrationExpiry: "",
  insuranceProvider: "",
  insuranceExpiry: "",
  qualifications: "",
};

function pendingLabel(requiresOwner?: boolean) {
  return requiresOwner ? "Awaiting the clinic owner" : "Awaiting approval";
}

function ProfilePage() {
  const { data: identity } = useIdentity();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);

  const { data } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
    enabled: !!identity?.isStaff,
  });

  const [form, setForm] = useState(blankForm);
  const [saved, setSaved] = useState<typeof blankForm | null>(null);
  const [instantSavedAt, setInstantSavedAt] = useState<number | null>(null);
  const [lockedOpen, setLockedOpen] = useState(false);
  const [lockedEmail, setLockedEmail] = useState("");
  const [lockedArrangement, setLockedArrangement] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const hydratedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!data?.profile || !identity?.userId) return;
    const split = splitStaffName(data.profile.full_name ?? "");
    const next = {
      title: split.title,
      fullName: split.name,
      jobTitle: data.profile.job_title ?? "",
      workEmail: data.email ?? identity.email ?? "",
      workingArrangement: data.profile.working_arrangement ?? "",
      registrationBody: data.profile.registration_body ?? "",
      registrationNumber: data.profile.registration_number ?? "",
      registrationExpiry: (data.profile.registration_expiry ?? "").slice(0, 10),
      insuranceProvider: data.profile.insurance_provider ?? "",
      insuranceExpiry: (data.profile.insurance_expiry ?? "").slice(0, 10),
      qualifications: data.profile.qualifications ?? "",
    };
    const firstLoad = hydratedFor.current !== identity.userId;
    setSaved((prev) => {
      if (!prev || firstLoad) return next;
      return {
        ...prev,
        qualifications: next.qualifications,
        insuranceProvider: next.insuranceProvider,
        insuranceExpiry: next.insuranceExpiry,
      };
    });
    setForm((prev) => {
      if (firstLoad || hydratedFor.current !== identity.userId) return next;
      return {
        ...prev,
        qualifications: next.qualifications,
        insuranceProvider: next.insuranceProvider,
        insuranceExpiry: next.insuranceExpiry,
      };
    });
    hydratedFor.current = identity.userId;
  }, [
    data?.email,
    data?.profile?.full_name,
    data?.profile?.job_title,
    data?.profile?.working_arrangement,
    data?.profile?.registration_body,
    data?.profile?.registration_number,
    data?.profile?.registration_expiry,
    data?.profile?.insurance_provider,
    data?.profile?.insurance_expiry,
    data?.profile?.qualifications,
    identity?.email,
    identity?.userId,
  ]);

  const saveInstantFn = useServerFn(saveMyInstantProfile);
  const saveProfileFn = useServerFn(saveMyProfile);
  const submitChangeFn = useServerFn(submitProfileChange);

  const canSelfApply = Boolean(data?.canSelfApply ?? identity?.isOwner);

  const instantDirty = Boolean(
    saved &&
      (form.qualifications !== saved.qualifications ||
        form.insuranceProvider !== saved.insuranceProvider ||
        form.insuranceExpiry !== saved.insuranceExpiry),
  );
  const gatedDirty = Boolean(
    saved &&
      (form.title !== saved.title ||
        form.fullName !== saved.fullName ||
        form.jobTitle !== saved.jobTitle ||
        form.registrationBody !== saved.registrationBody ||
        form.registrationNumber !== saved.registrationNumber ||
        form.registrationExpiry !== saved.registrationExpiry),
  );
  const lockedDirty = Boolean(
    saved &&
      (form.workEmail !== saved.workEmail || form.workingArrangement !== saved.workingArrangement),
  );

  function invalidateProfile() {
    queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    queryClient.invalidateQueries({ queryKey: ["me"] });
    queryClient.invalidateQueries({ queryKey: ["team"] });
  }

  const saveInstant = useMutation({
    mutationFn: async () =>
      saveInstantFn({
        data: {
          qualifications: form.qualifications,
          insuranceProvider: form.insuranceProvider,
          insuranceExpiry: form.insuranceExpiry,
        },
      }),
    onSuccess: () => {
      setSaved((prev) =>
        prev
          ? {
              ...prev,
              qualifications: form.qualifications,
              insuranceProvider: form.insuranceProvider,
              insuranceExpiry: form.insuranceExpiry,
            }
          : prev,
      );
      setInstantSavedAt(Date.now());
      queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  useEffect(() => {
    if (!instantDirty || saveInstant.isPending) return;
    const t = window.setTimeout(() => saveInstant.mutate(), 700);
    return () => window.clearTimeout(t);
    // form fields are the dirty signal; mutate identity is stable enough for this debounce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.qualifications, form.insuranceProvider, form.insuranceExpiry, instantDirty]);

  const saveOwner = useMutation({
    mutationFn: async () => {
      const emailCheck = checkEmail(form.workEmail, "work email");
      if (!emailCheck.ok) throw new Error(emailCheck.error);
      return saveProfileFn({
        data: {
          fullName: joinStaffName(form.title, form.fullName),
          jobTitle: form.jobTitle,
          registrationBody: form.registrationBody,
          registrationNumber: form.registrationNumber,
          registrationExpiry: form.registrationExpiry,
          insuranceProvider: form.insuranceProvider,
          insuranceExpiry: form.insuranceExpiry,
          qualifications: form.qualifications,
          workEmail: emailCheck.email,
          workingArrangement: form.workingArrangement,
        },
      });
    },
    onSuccess: () => {
      toast.success("Profile saved");
      setSaved(form);
      invalidateProfile();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requestGated = useMutation({
    mutationFn: async () =>
      submitChangeFn({
        data: {
          fullName: joinStaffName(form.title, form.fullName),
          jobTitle: form.jobTitle,
          registrationBody: form.registrationBody,
          registrationNumber: form.registrationNumber,
          registrationExpiry: form.registrationExpiry,
          note: requestNote.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Sent for approval");
      setRequestNote("");
      if (saved) {
        setForm((prev) => ({
          ...prev,
          title: saved.title,
          fullName: saved.fullName,
          jobTitle: saved.jobTitle,
          registrationBody: saved.registrationBody,
          registrationNumber: saved.registrationNumber,
          registrationExpiry: saved.registrationExpiry,
        }));
      }
      invalidateProfile();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const requestLocked = useMutation({
    mutationFn: async () => {
      const emailCheck = checkEmail(lockedEmail, "work email");
      if (!emailCheck.ok) throw new Error(emailCheck.error);
      return submitChangeFn({
        data: {
          fullName: joinStaffName(saved?.title ?? form.title, saved?.fullName ?? form.fullName),
          jobTitle: saved?.jobTitle ?? form.jobTitle,
          registrationBody: saved?.registrationBody ?? form.registrationBody,
          registrationNumber: saved?.registrationNumber ?? form.registrationNumber,
          registrationExpiry: saved?.registrationExpiry ?? form.registrationExpiry,
          workEmail: emailCheck.email,
          workingArrangement: lockedArrangement,
          note: requestNote.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success("Change request sent");
      setLockedOpen(false);
      setRequestNote("");
      invalidateProfile();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const leaveGuard = useUnsavedChanges(
    Boolean(
      (canSelfApply && isDirtyForm(form, saved) && !saveOwner.isPending && !saveInstant.isPending) ||
        (!canSelfApply && gatedDirty && !requestGated.isPending),
    ),
    "profile-unsaved",
  );

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!identity.isStaff)
    return (
      <AppShell identity={identity}>
        <p className="text-sm text-muted-foreground">Staff access only.</p>
      </AppShell>
    );

  const requests = (data?.requests ?? []) as {
    id: string;
    status: string;
    created_at: string;
    full_name?: string | null;
    job_title?: string | null;
    registration_body?: string | null;
    registration_number?: string | null;
    work_email?: string | null;
    working_arrangement?: string | null;
    note?: string | null;
    reviewer_note?: string | null;
    requires_owner?: boolean;
  }[];

  function openLockedRequest() {
    setLockedEmail(saved?.workEmail ?? form.workEmail);
    setLockedArrangement(saved?.workingArrangement ?? form.workingArrangement);
    setLockedOpen(true);
  }

  return (
    <AppShell identity={identity}>
      {leaveGuard}
      <div className="page-header">
        <div>
          <h1 className="page-title">My profile</h1>
          <p className="page-subtitle">Your details, registration and documents.</p>
        </div>
      </div>

      <div className={requests.length > 0 ? "grid items-start gap-5 lg:grid-cols-3" : undefined}>
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
                    className={SELECT_CLASS}
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
                  <Input
                    id="p-email"
                    value={form.workEmail}
                    onChange={(e) => setForm({ ...form, workEmail: e.target.value })}
                    disabled={!canSelfApply}
                    autoComplete="email"
                  />
                </div>
                <div className="field-stack min-w-0">
                  <Label htmlFor="p-body">Registration body</Label>
                  <select
                    id="p-body"
                    value={form.registrationBody}
                    onChange={(e) => setForm({ ...form, registrationBody: e.target.value })}
                    data-qc="registration-body"
                    className={SELECT_CLASS}
                  >
                    <option value="">—</option>
                    {REGISTRATION_BODIES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                    {form.registrationBody &&
                    !(REGISTRATION_BODIES as readonly string[]).includes(form.registrationBody) ? (
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
                  <Label htmlFor="p-arrange">Working arrangement</Label>
                  <select
                    id="p-arrange"
                    data-qc="working-arrangement"
                    value={form.workingArrangement}
                    onChange={(e) => setForm({ ...form, workingArrangement: e.target.value })}
                    disabled={!canSelfApply}
                    className={SELECT_CLASS}
                  >
                    <option value="">—</option>
                    {WORKING_ARRANGEMENTS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                    {form.workingArrangement &&
                    !(WORKING_ARRANGEMENTS as readonly string[]).includes(
                      form.workingArrangement as (typeof WORKING_ARRANGEMENTS)[number],
                    ) ? (
                      <option value={form.workingArrangement}>{form.workingArrangement}</option>
                    ) : null}
                  </select>
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
                  <div className="flex items-baseline justify-between gap-2">
                    <Label htmlFor="p-quals">Qualifications</Label>
                    {instantSavedAt ? (
                      <span className="text-2xs text-muted-foreground">Saved</span>
                    ) : instantDirty ? (
                      <span className="text-2xs text-muted-foreground">Saving…</span>
                    ) : null}
                  </div>
                  <Textarea
                    id="p-quals"
                    rows={2}
                    value={form.qualifications}
                    onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
                    placeholder="e.g. Level 7 in Aesthetic Medicine, Foundation botulinum toxin and dermal fillers"
                    className="rounded-xl"
                  />
                </div>
                {!canSelfApply ? (
                  <div className="field-stack min-w-0 sm:col-span-2">
                    <Label htmlFor="p-note">Note for the reviewer (optional)</Label>
                    <Textarea
                      id="p-note"
                      rows={2}
                      value={requestNote}
                      onChange={(e) => setRequestNote(e.target.value)}
                      placeholder="Why this should change"
                      className="rounded-xl"
                    />
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-2">
                  {!canSelfApply ? (
                    <Button
                      type="button"
                      variant="outline"
                      data-qc="profile-request-locked"
                      onClick={openLockedRequest}
                    >
                      Request a change
                    </Button>
                  ) : null}
                  {canSelfApply ? (
                    <Button
                      disabled={
                        saveOwner.isPending || !form.fullName.trim() || (!gatedDirty && !lockedDirty)
                      }
                      onClick={() => saveOwner.mutate()}
                    >
                      {saveOwner.isPending ? "Saving…" : "Save changes"}
                    </Button>
                  ) : (
                    <Button
                      data-qc="profile-request-approval"
                      disabled={requestGated.isPending || !form.fullName.trim() || !gatedDirty}
                      onClick={() => requestGated.mutate()}
                    >
                      {requestGated.isPending ? "Sending…" : "Request approval"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {requests.length > 0 ? (
          <Card className="flex h-[308px] min-h-0 flex-col overflow-hidden p-5">
            <h2 className="section-title">Change requests</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Requests waiting for a manager or the clinic owner, and earlier decisions.
            </p>
            <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto">
              {requests.map((r) => {
                const s = STATUS[r.status] ?? STATUS["pending"]!;
                const Icon = s.icon;
                const label = r.status === "pending" ? pendingLabel(r.requires_owner) : s.label;
                return (
                  <div key={r.id} className="rounded-2xl border border-glass-line p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs ${s.className}`}>
                        <Icon className="h-3.5 w-3.5" /> {label}
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
                        r.work_email,
                        r.working_arrangement,
                      ]
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

      <div className="mt-6">
        <ProfileAccountTabs
          userId={identity.userId}
          identity={identity}
          showPerformance={identity.roles.includes("practitioner") || Boolean(identity.isOwner)}
        />
      </div>

      <Dialog open={lockedOpen} onOpenChange={setLockedOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request a change</DialogTitle>
            <DialogDescription>Work email and working arrangement.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="field-stack">
              <Label htmlFor="p-locked-email">Work email</Label>
              <Input
                id="p-locked-email"
                value={lockedEmail}
                onChange={(e) => setLockedEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="field-stack">
              <Label htmlFor="p-locked-arrange">Working arrangement</Label>
              <select
                id="p-locked-arrange"
                value={lockedArrangement}
                onChange={(e) => setLockedArrangement(e.target.value)}
                className={SELECT_CLASS}
              >
                <option value="">—</option>
                {WORKING_ARRANGEMENTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-stack">
              <Label htmlFor="p-locked-note">Note (optional)</Label>
              <Textarea
                id="p-locked-note"
                rows={2}
                value={requestNote}
                onChange={(e) => setRequestNote(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setLockedOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={requestLocked.isPending || !lockedEmail.trim()}
              onClick={() => requestLocked.mutate()}
            >
              {requestLocked.isPending ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
