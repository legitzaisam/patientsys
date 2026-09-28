import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { getStaffProfile, restoreExTeamMember } from "@/lib/clinic.functions";
import { can } from "@/lib/permissions";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StaffProfilePage } from "@/components/profile/staff-profile-page";
import { asProfileTab } from "@/components/profile/profile-helpers";
import type {
  ProfileSubject,
  ProfileTabKey,
  ProfileViewer,
  StaffDocumentRow,
} from "@/components/profile/profile-types";

export const Route = createFileRoute("/_authenticated/team/$id")({
  validateSearch: (search: Record<string, unknown>): { tab?: ProfileTabKey } => {
    const tab = asProfileTab(search["tab"]);
    return tab ? { tab } : {};
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
  component: StaffProfileRoute,
});

function StaffProfileRoute() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: identity } = useIdentity();
  const queryClient = useQueryClient();
  const fetchProfile = useServerFn(getStaffProfile);

  const restore = useMutation({
    mutationFn: useServerFn(restoreExTeamMember),
    onSuccess: () => {
      toast.success("Access restored");
      queryClient.invalidateQueries({ queryKey: ["staff-profile", id] });
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["ex-team"] });
      queryClient.invalidateQueries({ queryKey: ["performance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data } = useQuery({
    queryKey: ["staff-profile", id],
    queryFn: () => fetchProfile({ data: { userId: id } }),
    enabled: Boolean(identity?.isStaff),
  });

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

  const revoked = Boolean(data?.revoked);
  const canViewTeam = can(identity, "team.view");
  const mode = data?.canManage ? "manage" : "frontdesk";
  const profile = data?.profile as Record<string, unknown> | null | undefined;
  const str = (v: unknown) => (v == null ? "" : String(v));
  const displayName = str(profile?.["full_name"]) || data?.email || "Team member";

  const subject: ProfileSubject | null = data
    ? {
        userId: id,
        fullName: str(profile?.["full_name"]),
        email: data.email ?? "",
        jobTitle: str(profile?.["job_title"]),
        role: data.role ?? "",
        registrationBody: str(profile?.["registration_body"]),
        registrationNumber: str(profile?.["registration_number"]),
        registrationExpiry: str(profile?.["registration_expiry"]).slice(0, 10),
        insuranceProvider: str(profile?.["insurance_provider"]),
        insuranceExpiry: str(profile?.["insurance_expiry"]).slice(0, 10),
        qualifications: str(profile?.["qualifications"]),
        workingArrangement: str(profile?.["working_arrangement"]),
        avatarPath: (profile?.["avatar_url"] as string | null | undefined) ?? null,
        commissionRate:
          profile?.["commission_rate"] == null ? null : Number(profile["commission_rate"]),
        pattern: data.pattern ?? [],
        patternSummary: data.patternSummary ?? "Hours not set",
        bookable: data.bookable ?? [],
        upcomingUnavailable: data.upcomingUnavailable ?? [],
        compliance: data.compliance ?? null,
        requests: (data.requests ?? []) as ProfileSubject["requests"],
        documents: (data.documents ?? []) as StaffDocumentRow[],
        presentCategories: data.presentCategories ?? [],
        capabilities: data.capabilities ?? null,
        revoked,
        daysRemaining: data.daysRemaining ?? 0,
      }
    : null;

  const viewer: ProfileViewer = {
    userId: identity.userId,
    email: identity.email,
    isOwner: identity.isOwner,
    isAdmin: identity.isAdmin,
    isManager: identity.isManager,
    roles: identity.roles,
    canSelfApply: false,
    requiresOwner: false,
    canCommission: Boolean(data?.canCommission),
    treats: (data?.role ?? "") === "practitioner" || (data?.role ?? "") === "owner",
  };

  return (
    <AppShell identity={identity}>
      {canViewTeam ? (
        <Link
          to="/team"
          className="-mt-2 mb-2 inline-flex min-h-6 items-center gap-2 py-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to team
        </Link>
      ) : null}

      <div className="page-header">
        <div>
          <h1 className="page-title">Staff profile</h1>
          <p className="page-subtitle">
            {revoked
              ? `${displayName} was removed from the team. Their name stays on this profile so you know who they were.`
              : mode === "manage"
                ? `Review and update ${displayName}'s details.`
                : `${displayName}'s hours and what you can book them for.`}
          </p>
        </div>
      </div>

      {revoked ? (
        <Card
          className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4"
          data-qc="staff-revoked"
        >
          <p className="text-sm text-muted-foreground">
            Access removed
            {data?.daysRemaining
              ? ` · ${data.daysRemaining} day${data.daysRemaining === 1 ? "" : "s"} left in the archive`
              : ""}
            . Patient records they worked on stay on the system.
          </p>
          {identity.isOwner ? (
            <Button
              variant="outline"
              size="sm"
              disabled={restore.isPending}
              onClick={() => restore.mutate({ data: { userId: id } })}
            >
              {restore.isPending ? "Restoring…" : "Restore access"}
            </Button>
          ) : null}
        </Card>
      ) : null}

      {subject ? (
        <StaffProfilePage
          mode={mode}
          subject={subject}
          viewer={viewer}
          hasSeparateManager={Boolean(identity.hasSeparateManager)}
          tab={tab ?? "overview"}
          onTabChange={(next) =>
            navigate({
              params: { id },
              search: next === "overview" ? {} : { tab: next },
              replace: true,
            })
          }
        />
      ) : (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}
    </AppShell>
  );
}
