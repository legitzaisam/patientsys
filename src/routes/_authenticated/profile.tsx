import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, Check, X } from "lucide-react";
import { getMyProfile, submitProfileChange } from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { StaffAvatar, StaffDocuments } from "@/components/staff-files";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My profile — Aetheria" },
      {
        name: "description",
        content: "Review your practitioner details and submit changes for manager approval.",
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
    fullName: "",
    jobTitle: "",
    registrationBody: "",
    registrationNumber: "",
    note: "",
  });

  useEffect(() => {
    if (!data?.profile) return;
    setForm({
      fullName: data.profile.full_name ?? "",
      jobTitle: data.profile.job_title ?? "",
      registrationBody: data.profile.registration_body ?? "",
      registrationNumber: data.profile.registration_number ?? "",
      note: "",
    });
  }, [data?.profile]);

  const submit = useMutation({
    mutationFn: useServerFn(submitProfileChange),
    onSuccess: () => {
      toast.success("Sent to your manager for approval");
      setForm((f) => ({ ...f, note: "" }));
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
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
  const pending = requests.find((r) => r.status === "pending");

  return (
    <AppShell identity={identity}>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold tracking-[-0.016em] text-foreground">My profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Changes to your name, role or registration details are reviewed by a manager before they go live.
        </p>
      </div>

      <div className={cn("grid gap-6", identity.isManager ? "lg:grid-cols-1" : "lg:grid-cols-[1.4fr_1fr]")}>
        <Card className="p-5">
          <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
            <div className="sm:w-40">
              <StaffAvatar
                userId={identity.userId}
                fullName={form.fullName || identity.email}
                avatarPath={data?.profile?.avatar_url ?? null}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="p-name">Full name</Label>
              <Input id="p-name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-job">Job title</Label>
              <Input id="p-job" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-email">Work email</Label>
              <Input id="p-email" value={identity.email} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-body">Registration body</Label>
              <Input
                id="p-body"
                value={form.registrationBody}
                onChange={(e) => setForm({ ...form, registrationBody: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-no">Registration number</Label>
              <Input
                id="p-no"
                value={form.registrationNumber}
                onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="p-note">Note for your manager (optional)</Label>
              <Textarea
                id="p-note"
                rows={3}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="e.g. renewed JCCP registration, new number attached"
              />
            </div>
            </div>
          </div>
        {!identity.isManager && (
          <div className="mt-5 flex items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground">
              {pending
                ? "You already have a change awaiting approval."
                : "Your details stay unchanged until a manager approves."}
            </p>
            <Button
              disabled={submit.isPending || !form.fullName.trim() || !!pending}
              onClick={() =>
                submit.mutate({
                  data: {
                    fullName: form.fullName,
                    jobTitle: form.jobTitle,
                    registrationBody: form.registrationBody,
                    registrationNumber: form.registrationNumber,
                    note: form.note,
                  },
                })
              }
            >
              Send for approval
            </Button>
          </div>
        )}
      </Card>

      {!identity.isManager && (
        <Card className="p-5">
          <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-foreground">Request history</h2>
          <div className="mt-4 space-y-3">
            {requests.length === 0 && <p className="text-sm text-muted-foreground">No changes requested yet.</p>}
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
      )}
      </div>

      <div className="mt-6">
        <StaffDocuments userId={identity.userId} />
      </div>
    </AppShell>
  );
}
