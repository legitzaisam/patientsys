import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ForcePasswordChangeGate,
  StaffWelcomeDialog,
} from "@/components/force-password-change-gate";
import { MfaGate } from "@/components/mfa-gate";
import { IdleWatchdog } from "@/components/idle-watchdog";
import {
  hasClearedPasswordGate,
  hasSatisfiedMfaGate,
  markMfaGateSatisfied,
  shouldShowWelcomeAfterGate,
} from "@/lib/password-gate-session";
import { DEMO_MODE } from "@/lib/demo/enabled";
import { FloatingDockProvider } from "@/components/floating-dock/dock-context";
import { FloatingNotesProvider } from "@/components/dashboard/floating-notes";
import {
  canSee,
  firstVisiblePortalPath,
  firstVisibleStaffPath,
  isAccessAdmin,
  pageNodeForPath,
} from "@/lib/access-catalogue";
import { useIdentity } from "@/lib/use-identity";

const wasStaffKey = (userId: string) => `aetheria:was-staff:${userId}`;

function markWasStaff(userId: string) {
  try {
    sessionStorage.setItem(wasStaffKey(userId), "1");
  } catch {
    /* private mode / blocked storage */
  }
}

function consumeWasStaff(userId: string) {
  try {
    const key = wasStaffKey(userId);
    if (sessionStorage.getItem(key) !== "1") return false;
    sessionStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Where a signed-out visitor goes. Portal paths carry the full path through the
 * patient login as `?next=`, so a link in an offer email lands on the offer
 * after sign-in instead of on the portal home. Staff paths go to /auth as
 * before.
 */
export function loggedOutDestination(location: { pathname: string; search: string }) {
  if (location.pathname === "/my-record" || location.pathname.startsWith("/my-record/")) {
    return `/portal?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`;
  }
  return "/auth";
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const [ready, setReady] = useState(DEMO_MODE);

  useEffect(() => {
    if (DEMO_MODE) return;
    let active = true;
    // getSession reads local storage and survives Vite HMR; getUser() hits the
    // network and was treating a reload blip as a missing account.
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (!data.session) {
        // Use a hard navigation to avoid a client-side route transition that
        // triggers a hydration mismatch on /auth.
        window.location.replace(loggedOutDestination(window.location));
      } else {
        setReady(true);
      }
    });

    // Only a real sign-out should leave the app. A null session during
    // INITIAL_SESSION or token refresh is transient and must not wipe the tab.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === "SIGNED_OUT") {
        setReady(false);
        window.location.replace("/auth");
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-deep border-t-transparent" />
      </div>
    );
  }

  return <IdentityGate />;
}

/**
 * Every page below reads identity and renders "Loading…" until it arrives, so a
 * failing getMe would leave them all spinning forever. Surfacing the failure
 * once here covers the whole authenticated tree.
 */
function IdentityGate() {
  const { data: identity, error, isError, isFetching, refetch, isLoading } = useIdentity();
  const [signingOutRevoked, setSigningOutRevoked] = useState(false);
  const [mfaSatisfied, setMfaSatisfied] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Revoked staff must not fall through to the patient shell — kick them out
  // as soon as identity reflects the lost staff role.
  useEffect(() => {
    if (!identity?.userId || signingOutRevoked) return;
    if (identity.isStaff) {
      markWasStaff(identity.userId);
      return;
    }
    if (!consumeWasStaff(identity.userId)) return;
    setSigningOutRevoked(true);
    void (async () => {
      try {
        await supabase.auth.signOut();
      } finally {
        window.location.replace("/auth");
      }
    })();
  }, [identity, signingOutRevoked]);

  // Banned / revoked accounts: getMe fails — sign out instead of showing the error card forever.
  useEffect(() => {
    if (!isError || signingOutRevoked) return;
    const message = error instanceof Error ? error.message : "";
    if (!message.includes("clinic access has been removed")) return;
    setSigningOutRevoked(true);
    void (async () => {
      try {
        await supabase.auth.signOut();
      } finally {
        window.location.replace("/auth");
      }
    })();
  }, [isError, error, signingOutRevoked]);

  useEffect(() => {
    if (!identity) return;
    if (identity.isAdmin && !identity.isOwner) {
      if (pathname !== "/access") navigate({ to: "/access", replace: true });
      return;
    }
    if (pathname === "/access") {
      if (!isAccessAdmin(identity)) navigate({ to: "/dashboard", replace: true });
      return;
    }
    if (!identity.isStaff) {
      const inPortal = pathname === "/my-record" || pathname.startsWith("/my-record/");
      const node = pageNodeForPath(pathname);
      if (inPortal && node && !canSee(identity, node.id)) {
        const next = firstVisiblePortalPath(identity);
        if (next && next !== pathname) navigate({ to: next, replace: true });
        return;
      }
      if (inPortal && pathname === "/my-record/plan" && !canSee(identity, "portal-plan-overview")) {
        const next =
          (["portal-plan-timeline", "portal-plan-journal", "portal-plan-routine"] as const).find((id) =>
            canSee(identity, id),
          ) ?? null;
        const route =
          next === "portal-plan-timeline"
            ? "/my-record/plan/timeline"
            : next === "portal-plan-journal"
              ? "/my-record/plan/journal"
              : next === "portal-plan-routine"
                ? "/my-record/plan/routine"
                : null;
        if (route) navigate({ to: route, replace: true });
        return;
      }
      if (!inPortal) {
        const next = firstVisiblePortalPath(identity) ?? "/my-record";
        navigate({ to: next, replace: true });
      }
      return;
    }
    const node = pageNodeForPath(pathname);
    if (node && !canSee(identity, node.id)) {
      const next = firstVisibleStaffPath(identity);
      if (next !== pathname) navigate({ to: next, replace: true });
    }
  }, [identity, navigate, pathname]);

  if (signingOutRevoked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-deep border-t-transparent" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass-card max-w-md p-8 text-center">
          <h1 className="page-title">
            We could not load your account
          </h1>
          <p className="page-subtitle">
            {error instanceof Error ? error.message : "Something went wrong reaching the clinic."}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => void refetch()} disabled={isFetching}>
              {isFetching ? "Retrying…" : "Try again"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void supabase.auth.signOut().then(() => window.location.replace("/auth"));
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading || !identity || signingOutRevoked) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-deep border-t-transparent" />
      </div>
    );
  }

  // Synchronous check so we never paint the patient shell for a just-revoked member.
  let lostStaffAccess = false;
  try {
    lostStaffAccess =
      !identity.isStaff && sessionStorage.getItem(wasStaffKey(identity.userId)) === "1";
  } catch {
    lostStaffAccess = false;
  }
  if (lostStaffAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-deep border-t-transparent" />
      </div>
    );
  }

  const needsPassword =
    Boolean(identity.mustChangePassword) && !hasClearedPasswordGate(identity.userId);
  const needsMfa =
    !DEMO_MODE &&
    !needsPassword &&
    Boolean(identity.mfaRequired) &&
    !mfaSatisfied &&
    !hasSatisfiedMfaGate(identity.userId) &&
    !identity.emailMfaSatisfied;
  // Welcome only after the invite password gate — not after later password resets.
  const showWelcome =
    Boolean(identity.isStaff) &&
    !needsPassword &&
    !needsMfa &&
    shouldShowWelcomeAfterGate(identity.userId);

  if (needsPassword) {
    return (
      <ForcePasswordChangeGate
        userId={identity.userId}
        welcomePending={Boolean(identity.welcomePending)}
      />
    );
  }

  if (needsMfa) {
    return (
      <MfaGate
        email={identity.email}
        onSatisfied={() => {
          markMfaGateSatisfied(identity.userId);
          setMfaSatisfied(true);
          void refetch();
        }}
      />
    );
  }

  return (
    <>
      <StaffWelcomeDialog
        open={showWelcome}
        userId={identity.userId}
        name={identity.profile?.full_name}
      />
      <IdleWatchdog enabled={Boolean(identity.isStaff)} />
      {/* Above the route components: pages register chat context with the dock
          (rendered inside AppShell, a child of each route). */}
      <FloatingDockProvider>
        <FloatingNotesProvider>
          <Outlet />
        </FloatingNotesProvider>
      </FloatingDockProvider>
    </>
  );
}
