import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile, listMyDocuments } from "@/lib/clinic.functions";
import { useIdentity } from "@/lib/use-identity";
import { AppShell } from "@/components/app-shell";
import { StaffProfilePage } from "@/components/profile/staff-profile-page";
import { asProfileTab } from "@/components/profile/profile-helpers";
import type {
  ProfileSubject,
  ProfileTabKey,
  ProfileViewer,
  StaffDocumentRow,
} from "@/components/profile/profile-types";

export const Route = createFileRoute("/_authenticated/profile")({
  validateSearch: (search: Record<string, unknown>): { tab?: ProfileTabKey } => {
    const tab = asProfileTab(search["tab"]);
    return tab ? { tab } : {};
  },
  head: () => ({
    meta: [
      { title: "My profile — Aetheria" },
      {
        name: "description",
        content: "Your details, earnings, schedule and documents in one place.",
      },
      { property: "og:title", content: "My profile — Aetheria" },
      { property: "og:description", content: "Keep your registration and job details up to date." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: identity } = useIdentity();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchDocuments = useServerFn(listMyDocuments);

  const { data } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => fetchProfile(),
    enabled: !!identity?.isStaff,
  });
  const { data: documents } = useQuery({
    queryKey: ["my-profile", "documents"],
    queryFn: () => fetchDocuments({ data: {} }),
    enabled: !!identity?.isStaff,
  });

  if (!identity) return <div className="p-12 text-sm text-muted-foreground">Loading…</div>;
  if (!identity.isStaff)
    return (
      <AppShell identity={identity}>
        <p className="text-sm text-muted-foreground">Staff access only.</p>
      </AppShell>
    );

  const profile = data?.profile;
  const docs = (documents ?? []) as StaffDocumentRow[];
  const subject: ProfileSubject = {
    userId: identity.userId,
    fullName: profile?.full_name ?? "",
    email: data?.email ?? identity.email ?? "",
    jobTitle: profile?.job_title ?? "",
    role: identity.roles.find((r) => r !== "patient") ?? "",
    registrationBody: profile?.registration_body ?? "",
    registrationNumber: profile?.registration_number ?? "",
    registrationExpiry: (profile?.registration_expiry ?? "").slice(0, 10),
    insuranceProvider: profile?.insurance_provider ?? "",
    insuranceExpiry: (profile?.insurance_expiry ?? "").slice(0, 10),
    qualifications: profile?.qualifications ?? "",
    workingArrangement: profile?.working_arrangement ?? "",
    avatarPath: profile?.avatar_url ?? null,
    commissionRate: null,
    pattern: data?.pattern ?? [],
    patternSummary: data?.patternSummary ?? "Hours not set",
    bookable: data?.bookable ?? [],
    upcomingUnavailable: [],
    requests: (data?.requests ?? []) as ProfileSubject["requests"],
    documents: docs,
    presentCategories: [...new Set(docs.map((d) => d.category).filter(Boolean))],
    capabilities: null,
    revoked: false,
    daysRemaining: 0,
  };
  const viewer: ProfileViewer = {
    userId: identity.userId,
    email: identity.email,
    isOwner: identity.isOwner,
    isAdmin: identity.isAdmin,
    isManager: identity.isManager,
    mfaRequired: identity.mfaRequired,
    roles: identity.roles,
    canSelfApply: Boolean(data?.canSelfApply ?? identity.isOwner),
    requiresOwner: Boolean(data?.requiresOwner),
    canCommission: false,
    treats: identity.roles.includes("practitioner") || Boolean(identity.treatsPatients),
  };

  return (
    <AppShell identity={identity}>
      <div className="page-header">
        <div>
          <h1 className="page-title">My profile</h1>
          <p className="page-subtitle">
            Your details, earnings, schedule and documents in one place.
          </p>
        </div>
      </div>
      {data ? (
        <StaffProfilePage
          mode="self"
          subject={subject}
          viewer={viewer}
          hasSeparateManager={Boolean(data.hasSeparateManager)}
          tab={tab ?? "overview"}
          onTabChange={(next) =>
            navigate({ search: next === "overview" ? {} : { tab: next }, replace: true })
          }
        />
      ) : (
        <p className="text-sm text-muted-foreground">Loading your profile…</p>
      )}
    </AppShell>
  );
}
